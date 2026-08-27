import { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Upload, Database, CheckCircle2, AlertTriangle, FileJson, Trash2 } from 'lucide-react';
import { db } from '../db';
import { MAX_AF_INVENTORY } from '../constants';
import { parseArtifactData } from '../utils/parser';
import { evaluateArtifact } from '../utils/evaluator';
import { runCriteriaMatcher } from '../utils/matcher';
import { runDiscardCalc } from '../utils/discardCalc';
import { alertUnnecessaryKeeps } from '../utils/alertUnnecessaryKeeps';
import type { Settings } from '../types';
import { useTranslation } from '../i18n';
import { useAppStore } from '../store/useAppStore';

const DEFAULT_SETTINGS: Settings = {
    id: 'global',
    evaluationFormula: { group1Multiplier: 1, group2Multiplier: 1, group3Multiplier: 1, skillMultipliers: {}, qualityValues: {}, exceptions: [] },
    discardBehavior: { treatUnnecessaryAsDiscard: true, targetInventoryCount: MAX_AF_INVENTORY, protectLocked: true, protectKeepFlag: true, protectRareAF: true, protectEquipped: true },
};

export default function DataTab() {
    const { t, language } = useTranslation();
    const showToast = useAppStore(state => state.showToast);
    const [jsonInput, setJsonInput] = useState('');
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
    const [dragOver, setDragOver] = useState(false);

    const totalArtifacts = useLiveQuery(() => db.artifacts.count()) || 0;
    const globalSettings = useLiveQuery(() => db.settings.get('global'));
    const lastImportedAt = globalSettings?.lastImportedAt;

    const recordImportTimestamp = async () => {
        const s = await db.settings.get('global') || DEFAULT_SETTINGS;
        await db.settings.put({ ...s, lastImportedAt: new Date().toISOString() });
    };

    // Phase 2: AF Collector 拡張機能からの直接送信を受け取る
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type !== 'AF_COLLECTOR_PUSH') return;
            // 同一ページのpostMessageのみ許可（拡張機能content scriptから来る）
            const json = event.data.payload;
            if (!json?.af_collector) return;
            importCollectorJson(json).catch((e: any) => {
                if (e?.message !== '取り込みをキャンセルしました。') {
                    setStatus({ type: 'error', message: e?.message || '取り込みに失敗しました' });
                }
            });
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalArtifacts]);

    // Phase 3: Tauri デスクトップアプリ経由でのイベントを受け取る
    useEffect(() => {
        let unlisten: (() => void) | null = null;
        (async () => {
            try {
                const { listen } = await import('@tauri-apps/api/event');
                unlisten = await listen<any>('af-data-received', (event) => {
                    const json = event.payload;
                    if (!json?.af_collector) return;
                    importCollectorJson(json).catch((e: any) => {
                        if (e?.message !== '取り込みをキャンセルしました。') {
                            setStatus({ type: 'error', message: e?.message || '取り込みに失敗しました' });
                        }
                    });
                });
            } catch (_) {
                // Tauri環境外（ブラウザ開発時など）ではスキップ
            }
        })();
        return () => { if (unlisten) unlisten(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 共通の設定取得
    const getSettings = async (): Promise<Settings> => {
        let s = await db.settings.get('global');
        if (!s) { s = DEFAULT_SETTINGS; await db.settings.put(s); }
        return s;
    };

    // af_collector JSON（全ページマージ済み）を取り込む
    const importCollectorJson = async (json: any) => {
        const artifacts = json.artifacts;
        if (!Array.isArray(artifacts) || artifacts.length === 0) {
            throw new Error('artifacts フィールドが空です。');
        }
        const settings = await getSettings();

        // _page と _pos からゲーム内UIの並び順を復元
        // inventoryOrder = page * 1000 + pos で一意かつ順序を保持
        const newItems = artifacts.map((item: any) => ({
            ...item,
            // AppArtifact の DB キーは item.id（インスタンスID = 固有値）
            keepFlag: undefined as string | undefined,
            discardFlag: false,
            evaluationScore: 0,
            inventoryOrder: (item._page ?? 0) * 1000 + (item._pos ?? 0),
        }));
        newItems.forEach((item: any) => {
            item.evaluationScore = evaluateArtifact(item, settings);
        });

        const replace = confirm(
            language === 'en'
                ? `Detected data from AF Collector (${artifacts.length} items, ${json.total_pages} pages).\nDiscard the current inventory (${totalArtifacts} items) and replace it with this new data?\n\n* Keep/Discard flags will be reset.`
                : `AF Collectorからのデータ（${artifacts.length}件、${json.total_pages}ページ分）を検出しました。\n現在の所持AFデータ（${totalArtifacts}件）を破棄して新規データに置き換えますか？\n\n※ 確保フラグや廃棄フラグはリセットされます。`
        );
        if (!replace) throw new Error(language === 'en' ? 'Import canceled.' : '取り込みをキャンセルしました。');

        await db.artifacts.clear();
        await db.artifacts.bulkPut(newItems);
        await recordImportTimestamp();

        const autoKeep = settings.autoFlagUpdate?.keepFlag ?? false;
        const autoDiscard = settings.autoFlagUpdate?.discardFlag ?? false;

        if (!autoKeep && !autoDiscard) {
            // 自動更新なし
            setStatus({
                type: 'success',
                message: language === 'en' ? `✅ Imported ${newItems.length} artifacts (${json.total_pages} pages). Please run the Keep condition calculations next.` : `✅ ${newItems.length}件のAFを取り込みました（${json.total_pages}ページ分）。確保フラグ計算を実行してください。`
            });
            return;
        }

        // 1. 取り込み完了通知
        showToast(language === 'en' ? 'AF data imported. Running Auto Flag Update...' : 'AFデータ取り込み完了。自動フラグ更新を実施します。', 'info');

        // 2. 確保フラグ計算
        if (autoKeep) {
            const conditions = await db.conditions.toArray();
            const allItems = await db.artifacts.toArray();
            const updated = runCriteriaMatcher(allItems, conditions);
            await db.artifacts.bulkPut(updated);
            const keptCount = updated.filter((a: any) => a.keepFlag).length;
            showToast(language === 'en' ? `Calculation complete.\nKept: ${keptCount} item(s)` : `確保フラグの一括計算が完了しました。\n確保対象: ${keptCount}件`, 'success');
        }

        // 3. 廃棄フラグ計算
        if (autoDiscard) {
            const discardMsg = await runDiscardCalc(settings, language);
            showToast(discardMsg, 'info');
        }

        // 4. 完了通知
        showToast(language === 'en' ? 'Auto Flag Update completed.' : '自動フラグ更新が完了しました。', 'success');

        // 5. 確保フラグと廃棄フラグが競合する不用品チェック（確保フラグを計算した場合）
        if (autoKeep) {
            await alertUnnecessaryKeeps(language);
        }

        setStatus({
            type: 'success',
            message: language === 'en' ? `✅ Imported ${newItems.length} artifacts (${json.total_pages} pages). Auto Flag Update applied.` : `✅ ${newItems.length}件のAFを取り込みました（${json.total_pages}ページ分）。自動フラグ更新を実行しました。`
        });
    };

    // 通常の単ページJSONを取り込む（既存動作）
    const handleImport = async () => {
        try {
            if (!jsonInput.trim()) { setStatus({ type: 'error', message: language === 'en' ? 'Please input JSON data' : 'JSONデータを入力してください' }); return; }
            setStatus({ type: 'idle', message: language === 'en' ? 'Parsing...' : '解析中...' });
            const existingCount = await db.artifacts.count();
            const newItems = parseArtifactData(jsonInput, existingCount);
            const settings = await getSettings();
            newItems.forEach(item => { item.evaluationScore = evaluateArtifact(item, settings); });
            await db.artifacts.bulkPut(newItems);
            await recordImportTimestamp();
            setStatus({ type: 'success', message: language === 'en' ? `Imported ${newItems.length} artifacts! You can continue pasting the next page.` : `${newItems.length}件のアーティファクトを取り込みました！新しいページがあれば続けて入力してください。` });
            setJsonInput('');
        } catch (e: any) {
            console.error(e);
            setStatus({ type: 'error', message: e.message || (language === 'en' ? 'Import failed' : 'データの取り込みに失敗しました') });
        }
    };

    // ファイル処理（D&D・ファイル選択共通）
    const handleFile = useCallback(async (file: File) => {
        try {
            setStatus({ type: 'idle', message: language === 'en' ? 'Loading...' : '読み込み中...' });
            const text = await file.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch {
                throw new Error(language === 'en' ? 'Invalid JSON format.' : '不正なJSONデータです。');
            }

            if (json.settings || (json.conditions && !json.artifacts && !json.list && !json.af_collector)) {
                // Settings or Conditions-only file detected -> definitely a backup file
                showToast(language === 'en' ? 'Error: This is a Backup or Criteria file.\nPlease import it from the "Settings" tab.' : 'エラー：これはバックアップデータ、または条件の復元用ファイルです。\n「設定」タブの画面から復元してください。', 'error');
                setStatus({ type: 'idle', message: '' });
                return;
            }

            if (json.af_collector === true) {
                await importCollectorJson(json);
            } else {
                // 通常のJSONファイル（既存形式）
                const existingCount = await db.artifacts.count();
                const newItems = parseArtifactData(text, existingCount);
                const settings = await getSettings();
                newItems.forEach(item => { item.evaluationScore = evaluateArtifact(item, settings); });
                await db.artifacts.bulkPut(newItems);
                await recordImportTimestamp();
                setStatus({ type: 'success', message: language === 'en' ? `Imported ${newItems.length} artifacts!` : `${newItems.length}件のアーティファクトを取り込みました！` });
            }
        } catch (e: any) {
            console.error(e);
            setStatus({ type: 'error', message: e.message || (language === 'en' ? 'File load failed' : 'ファイルの読み込みに失敗しました') });
        }
    }, [totalArtifacts, language]);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = () => setDragOver(false);

    const clearData = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete ALL AF data?' : '全ての所持AFデータを削除しますか？')) {
            await db.artifacts.clear();
            setStatus({ type: 'success', message: language === 'en' ? 'All AF data has been deleted.' : '全てのAFデータを削除しました。' });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', height: '100%', maxWidth: '800px', margin: '0 auto' }}>

            {/* Header Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: 'calc(var(--font-size-main) * 1.5)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={22} /> {t('DATA_TITLE', '所持AFのデータ取り込み')}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {language === 'en' ? 'Loaded Artifacts' : '現在保持されているAF数'}: <strong style={{ color: 'var(--text-main)', fontSize: 'calc(var(--font-size-main) * 1.1)' }}>{totalArtifacts}</strong> {language === 'en' ? 'items' : '件'}
                        {lastImportedAt && (
                            <div style={{ marginTop: '0.2rem', fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)' }}>
                                {language === 'en' ? 'Last import:' : '最終取込:'} {new Date(lastImportedAt).toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                    {totalArtifacts > 0 && (
                        <button className="btn btn-ghost" style={{ border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', padding: '0.4rem 0.8rem' }} onClick={clearData} title={language === 'en' ? 'Delete Data' : '所持AFデータを削除'}>
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* AF取り込み方法の説明（3通り） */}
            <div className="glass-panel" style={{ padding: '1.2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 600, fontSize: 'var(--font-size-main)' }}>
                    {language === 'en' ? '💡 3 ways to import Artifact data:' : '💡 AFデータの取り込み方法は3通りあります'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <span style={{ background: 'var(--accent-blue)', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', height: 'fit-content' }}>1</span>
                        <div>
                            <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Direct push from Extension (AF Collector) [Recommended]' : '拡張機能（AF Collector）からの直接送信 【推奨】'}</strong><br />
                            {language === 'en' ? 'Use the extension "AF Collector" to scan pages in-game, then press "Send" to push data directly here. (Works on same browser or desktop app)' : '拡張機能「AF Collector」を併用し、ゲーム内でAF一覧の全ページを収集後、拡張機能内の「送信」ボタンを押すことでデータがこのアプリへ直接届きます。（※同一ブラウザ、またはデスクトップアプリ版にて利用可）'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <span style={{ background: 'var(--accent-blue)', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', height: 'fit-content' }}>2</span>
                        <div>
                            <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Bulk JSON Drag & Drop' : '一括JSONファイルのドラッグ＆ドロップ'}</strong><br />
                            {language === 'en' ? <>After scanning with AF Collector, click "Download" to save the file (<code>af_data_YYYY-MM-DD.json</code>) and drop it into the zone below.</> : <>拡張機能「AF Collector」で収集後、「DL（ダウンロード）」ボタンから取得したファイル（<code>af_data_YYYY-MM-DD.json</code>）を直下の枠にドラッグ＆ドロップして一括で取り込みます。</>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <span style={{ background: 'var(--accent-blue)', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', height: 'fit-content' }}>3</span>
                        <div>
                            <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Manual Import (Paste Code)' : '手動インポート（テキスト貼り付け）'}</strong><br />
                            {language === 'en' ? <>Paste the JSON response from <code>rest/artifact/list/X</code> obtained via browser dev tools into the bottom textbox.</> : <>ブラウザ開発者ツール（F12）のネットワーク等から取得した、ゲームの通信（<code>rest/artifact/list/X</code>）のJSONテキストを一番下のテキストエリアにコピペして取り込みます。</>}
                        </div>
                    </div>
                </div>
            </div>

            {/* D&D ゾーン（AF Collector連携） */}
            <div
                className="glass-panel"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                style={{
                    padding: '2rem',
                    border: `2px dashed ${dragOver ? 'var(--accent-blue)' : 'var(--panel-border)'}`,
                    borderRadius: '12px',
                    textAlign: 'center',
                    transition: 'border-color 0.2s, background 0.2s',
                    background: dragOver ? 'rgba(59,130,246,0.08)' : undefined,
                    cursor: 'default',
                }}
            >
                <FileJson size={36} style={{ color: dragOver ? 'var(--accent-blue)' : 'var(--text-muted)', marginBottom: '0.8rem' }} />
                <div style={{ fontWeight: 600, color: dragOver ? 'var(--accent-blue)' : 'var(--text-main)', marginBottom: '0.4rem' }}>
                    {language === 'en' ? 'Drop AF Collector data file here' : 'AF Collectorのデータファイルをここにドロップ'}
                </div>
                <div style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    {language === 'en' ? <>Drop <code>af_data_YYYY-MM-DD.json</code> here for bulk import</> : <><code>af_data_YYYY-MM-DD.json</code> を全ページ収集後にドロップすると一括取り込みできます</>}
                </div>
                <label style={{ cursor: 'pointer' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.4rem 1rem', borderRadius: '6px', fontSize: 'var(--font-size-sub)',
                        border: '1px solid var(--panel-border)', color: 'var(--text-muted)',
                        background: 'var(--dim-bg)',
                    }}>
                        <Upload size={14} /> {language === 'en' ? 'Select File' : 'ファイルを選択'}
                    </span>
                    <input type="file" accept=".json" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                </label>
            </div>

            {/* ステータス表示 */}
            {status.message && (
                <div style={{
                    padding: '1rem', borderRadius: '8px',
                    backgroundColor: status.type === 'success' ? 'rgba(16,185,129,0.1)' : status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'var(--dim-bg)',
                    color: status.type === 'success' ? 'var(--accent-success)' : status.type === 'error' ? 'var(--accent-danger)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    border: `1px solid ${status.type === 'success' ? 'rgba(16,185,129,0.3)' : status.type === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--dim-border)'}`,
                }}>
                    {status.type === 'success' ? <CheckCircle2 size={18} /> : status.type === 'error' ? <AlertTriangle size={18} /> : null}
                    <span>{status.message}</span>
                </div>
            )}

            {/* 手動ペースト（既存） */}
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-main)' }}>{language === 'en' ? 'Manual Import (Paste JSON)' : '手動インポート（単ページJSON貼り付け）'}</h3>
                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    {language === 'en' ? <>Paste the response JSON from <code>rest/artifact/list/X</code>. You can paste multiple pages consecutively.</> : <>ゲームの開発者ツールなどで取得した <code>rest/artifact/list/X</code> のレスポンスJSONを貼り付けてください。<br />1ページ目から順番に1つずつ取り込むことも、連続したページをまとめて貼り付けることもできます。</>}
                </p>
                <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    className="input"
                    style={{ height: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: 'var(--font-size-sub)' }}
                    placeholder='{"list": [{"artifact_id": 301100101, ...}]}'
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleImport} style={{ minWidth: '160px' }}>
                        <Upload size={18} /> {language === 'en' ? 'Import JSON' : 'JSONを取り込む'}
                    </button>
                </div>
            </div>
        </div>
    );
}
