import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, Upload, Trash2, Plus, Minus, RefreshCw, Palette, Zap, Save, Settings as SettingsIcon, ShieldAlert, MonitorUp, HardDrive, ArrowRight, Calculator, Sun, Moon, GripVertical, Copy, ChevronRight, ChevronDown, FolderPlus, AlertTriangle, Folder, Edit2, RotateCcw, Bell } from 'lucide-react';
import { db } from '../db';
import type { Settings } from '../types';
import { DEFAULT_DESIGN } from '../types';
import { exportDatabase, importDatabase, exportMemos, importMemos, exportConditions, importConditions } from '../utils/backup';
import { G1_SKILLS, G2_SKILLS, G3_SKILLS } from '../data/skillMaster';
import { evaluateArtifact } from '../utils/evaluator';
import { runDiscardCalc } from '../utils/discardCalc';
import { alertUnnecessaryKeeps } from '../utils/alertUnnecessaryKeeps';
import { useAppStore } from '../store/useAppStore';
import { useTranslation, type TranslationKey } from '../i18n';
import { translateSkill, truncateSkill } from '../utils/skillMapping';

const FONT_OPTIONS = [
    { label: 'System Default', value: "'Inter', 'Segoe UI', system-ui, sans-serif" },
    { label: 'Arial', value: "Arial, sans-serif" },
    { label: 'Meiryo', value: "'Meiryo', sans-serif" },
    { label: 'メイリオ', value: "'メイリオ', 'Meiryo', sans-serif" },
    { label: 'MS PGothic', value: "'MS PGothic', sans-serif" },
    { label: 'ＭＳ Ｐゴシック', value: "'ＭＳ Ｐゴシック', 'MS PGothic', sans-serif" },
    { label: 'Yu Gothic', value: "'Yu Gothic', 'YuGothic', sans-serif" },
    { label: '游ゴシック', value: "'游ゴシック', 'Yu Gothic', sans-serif" },
    { label: 'BIZ UDGothic', value: "'BIZ UDGothic', sans-serif" },
    { label: 'Noto Sans JP', value: "'Noto Sans JP', sans-serif" },
    { label: 'Monospace', value: "monospace" },
    { label: 'Serif (Mincho)', value: "'Yu Mincho', 'MS PMincho', serif" }
];

export const DEFAULT_SETTINGS: Settings = {
    id: 'global',
    language: 'ja',
    evaluationFormula: {
        group1Multiplier: 1,
        group2Multiplier: 1,
        group3Multiplier: 1,
        skillMultipliers: {},
        qualityValues: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
        exceptions: []
    },
    discardBehavior: {
        treatUnnecessaryAsDiscard: true,
        targetInventoryCount: 1000,
        protectLocked: false,
        protectKeepFlag: true,
        protectRareAF: true,
        protectEquipped: true,
    },
    pageLimit: 10,
    saveWindowState: true
};

export default function SettingsTab() {
    const { t, language } = useTranslation();
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [skillGroup, setSkillGroup] = useState<1 | 2 | 3>(1);
    const [isDirty, setIsDirty] = useState(false);
    const [hasDiscardChanges, setHasDiscardChanges] = useState(false);
    const [localFonts, setLocalFonts] = useState<string[]>([]);
    const [localFontMain, setLocalFontMain] = useState('');
    const [localFontSub, setLocalFontSub] = useState('');
    const [confirmDeleteExIdx, setConfirmDeleteExIdx] = useState<number | null>(null);
    const setSettingsDirty = useAppStore(state => state.setSettingsDirty);
    const showToast = useAppStore(state => state.showToast);

    const updateSettings = useCallback((s: Settings) => {
        setSettings(s);
        setIsDirty(true);
        setSettingsDirty(true);
    }, [setSettingsDirty]);

    const updateDiscardSettings = useCallback((patch: Partial<Settings['discardBehavior']>) => {
        setSettings(prev => ({
            ...prev,
            discardBehavior: { ...prev.discardBehavior, ...patch }
        }));
        setHasDiscardChanges(true);
    }, []);

    useEffect(() => {
        db.settings.get('global').then(res => {
            if (res) {
                let finalSettings = res;
                let modified = false;

                if (res.evaluationFormula && Array.isArray(res.evaluationFormula.exceptions)) {
                    const normalizeExceptions = (exs: any[]): any[] => {
                        return exs.map(ex => {
                            let newEx = { ...ex };
                            if (!newEx.id) {
                                newEx.id = Math.random().toString(36).substr(2, 9);
                                modified = true;
                            }
                            if (!newEx.type) {
                                newEx.type = Array.isArray(newEx.children) ? 'folder' : 'item';
                                modified = true;
                            }
                            if (newEx.type === 'folder' && Array.isArray(newEx.children)) {
                                newEx.children = normalizeExceptions(newEx.children);
                            }
                            return newEx;
                        });
                    };

                    const normalizedExs = normalizeExceptions(res.evaluationFormula.exceptions);
                    if (modified) {
                        finalSettings = {
                            ...res,
                            evaluationFormula: {
                                ...res.evaluationFormula,
                                exceptions: normalizedExs
                            }
                        };
                        db.settings.put(finalSettings).catch(console.error);
                    }
                }

                setSettings(finalSettings);
                setLocalFontMain(finalSettings.design?.fontFamilyMain ?? "'Inter', 'Segoe UI', system-ui, sans-serif");
                setLocalFontSub(finalSettings.design?.fontFamilySub ?? "'Inter', 'Segoe UI', system-ui, sans-serif");
            }
            setLoading(false);
        });
    }, []);

    const loadSystemFonts = async () => {
        if (!('queryLocalFonts' in window)) {
            showToast(language === 'en' ? 'Your browser does not support local font access APIs. Please type the font name manually.' : 'お使いの環境（ブラウザ）はシステムフォントの自動取得APIに対応していません。\n直接フォント名を手入力してください。', 'error');
            return;
        }
        try {
            const fonts: any[] = await (window as any).queryLocalFonts();
            const familyNames = Array.from(new Set(fonts.map(f => f.family))).sort();
            setLocalFonts(familyNames as string[]);
            showToast(language === 'en' ? `✅ Permission granted! Loaded ${familyNames.length} fonts. You can select them from the list.` : `✅ 許可されました！ ${familyNames.length}件のフォントを読み込みました。候補リストから選択できます。`, 'success');
        } catch (e: any) {
            console.error(e);
            showToast(language === 'en' ? 'Access to local fonts was denied or an error occurred. Please allow permission in browser settings.' : 'ローカルフォントへのアクセスが拒否されたか、エラーが発生しました。ブラウザの設定で権限を許可してください。', 'error');
        }
    };

    // Unsaved changes warning on browser tab close / navigation away
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!isDirty) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty, hasDiscardChanges]);

    const updateMultiplier = (baseId: number, val: number) => {
        const newMultipliers = { ...settings.evaluationFormula.skillMultipliers };
        if (isNaN(val) || val === 1) {
            delete newMultipliers[baseId];
        } else {
            newMultipliers[baseId] = val;
        }
        updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, skillMultipliers: newMultipliers } });
    };

    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [draggedType, setDraggedType] = useState<'item' | 'folder' | null>(null);
    const [draggedItemParentId, setDraggedItemParentId] = useState<string | null>(null); // For nested D&D
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [dragOverPos, setDragOverPos] = useState<'top' | 'bottom' | 'inside' | null>(null);
    const [canDragItemId, setCanDragItemId] = useState<string | null>(null);
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const isImpossible = (ex: any) => {
        if (!ex.conditionSkillName || !ex.targetSkillName) return true;
        if (ex.conditionGroup === 2 && ex.targetGroup === 2) return true;
        if (ex.conditionGroup === 3 && ex.targetGroup === 3) return true;
        return false;
    };

    const handleSave = async () => {
        await db.settings.put(settings);
        setIsDirty(false);
        setSettingsDirty(false);
        try {
            const artifacts = await db.artifacts.toArray();
            artifacts.forEach(a => { a.evaluationScore = evaluateArtifact(a, settings); });
            await db.artifacts.bulkPut(artifacts);
            showToast(language === 'en' ? 'Settings saved and artifact scores recalculated.' : '設定を保存し、評価値を再計算しました。', 'success');
        } catch (e) {
            console.error(e);
            showToast(language === 'en' ? 'Settings saved. (Failed to recalculate scores)' : '設定を保存しました。(評価値の再計算に失敗しました)', 'error');
        }
    };

    const handleImportClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e: ProgressEvent<FileReader>) => {
                try {
                    const resultStr = e.target?.result as string;

                    // JSONの中身をチェックしてAFデータかバックアップかを判定
                    let parsed;
                    try {
                        parsed = JSON.parse(resultStr);
                    } catch {
                        throw new Error(language === 'en' ? 'Invalid JSON format.' : '不正なJSONデータです。');
                    }

                    if (parsed.af_collector === true || Array.isArray(parsed.list)) {
                        showToast(language === 'en' ? 'Error: This file is an Artifact Data file, not a Backup.\nPlease import it from the "AF Data Acquisition" tab.' : 'エラー：これはAF取込用のデータファイルです。\n「AFデータ取得」タブの画面から取り込んでください。', 'error');
                        return;
                    }

                    await importDatabase(resultStr);
                    showToast(language === 'en' ? 'Restore complete. Reloading page.' : '復元が完了しました。ページをリロードします。', 'success');
                    window.location.reload();
                } catch (err: any) {
                    console.error(err);
                    showToast((language === 'en' ? 'Failed to restore settings: ' : '復元に失敗しました: ') + (err.message || ''), 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleImportConditionsClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev: ProgressEvent<FileReader>) => {
                try {
                    await importConditions(ev.target?.result as string);
                    showToast(language === 'en' ? 'Criteria import complete.' : '条件のインポートが完了しました。', 'success');
                } catch (err: any) {
                    console.error(err);
                    showToast((language === 'en' ? 'Import Failed: ' : 'インポートに失敗: ') + (err.message || ''), 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleImportMemosClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev: ProgressEvent<FileReader>) => {
                try {
                    await importMemos(ev.target?.result as string);
                    showToast(language === 'en' ? 'Memo import complete.' : 'AFメモのインポートが完了しました。', 'success');
                } catch (err: any) {
                    console.error(err);
                    showToast((language === 'en' ? 'Import Failed: ' : 'インポートに失敗: ') + (err.message || ''), 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleClearAll = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete all data (AFs, Criteria, Memos)? This cannot be undone.' : 'すべての登録データ（AF、条件、メモ）を削除しますか？この操作は取り消せません。')) {
            await db.artifacts.clear();
            await db.conditions.clear();
            await db.groups.clear();
            await db.memos.clear();
            showToast(language === 'en' ? 'Data cleared.' : 'データをクリアしました。', 'success');
            window.location.reload();
        }
    };

    const handleClearArtifactsOnly = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete ONLY Artifact Data? (Memos and Criteria will remain)' : '所持AFデータのみを削除しますか？（メモ・条件は残ります）')) {
            await db.artifacts.clear();
            showToast(language === 'en' ? 'Artifact data deleted.' : '所持AFデータを削除しました。', 'success');
            window.location.reload();
        }
    };

    const handleClearMemosOnly = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete ONLY Memo Data?' : 'メモデータのみを削除しますか？（AF・条件は残ります）')) {
            await db.memos.clear();
            showToast(language === 'en' ? 'Memo data deleted.' : 'メモデータを削除しました。', 'success');
        }
    };

    const handleClearConditionsOnly = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete ONLY Criteria Data? (AFs and Memos will remain)' : '確保AF条件のみを削除しますか？（AF・メモは残ります）')) {
            await db.conditions.clear();
            await db.groups.clear();
            showToast(language === 'en' ? 'Criteria data deleted.' : '確保AF条件を削除しました。', 'success');
        }
    };

    const runDiscardLogic = async () => {
        if (isDirty && !confirm(language === 'en' ? 'There are unsaved evaluation formula changes. Please save them first.\nDo you want to ignore and continue?' : '評価計算式の未保存の変更があります。先に画面上部の「設定を保存」を行ってください。\n無視して続行しますか？')) return;
        try {
            const wasChanged = hasDiscardChanges;
            if (wasChanged) {
                await db.settings.put(settings);
                setHasDiscardChanges(false);
            }
            const msg = await runDiscardCalc(settings, language);

            if (wasChanged) {
                showToast((language === 'en' ? 'Settings saved.\n\n' : '設定を保存しました。\n\n') + msg, 'success');
            } else {
                showToast(msg, 'info');
            }
            await alertUnnecessaryKeeps(language);
        } catch (e) {
            console.error(e);
            showToast(language === 'en' ? 'An error occurred.' : 'エラーが発生しました。', 'error');
        }
    };

    // 《評価計算式》のみエクスポート
    const handleExportCalcSettings = () => {
        const { group1Multiplier, group2Multiplier, group3Multiplier, skillMultipliers, qualityValues, exceptions, quirkyArtifactScores } = settings.evaluationFormula;
        const blob = new Blob([JSON.stringify({ group1Multiplier, group2Multiplier, group3Multiplier, skillMultipliers, qualityValues, exceptions, quirkyArtifactScores }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        const prefix = language === 'en' ? 'AF_EvaluationFormula_Backup_' : 'AF評価計算式バックアップ_';
        a.download = `${prefix}${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    };

    // 《評価計算式》のみインポート
    const handleImportCalcSettings = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'application/json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev: ProgressEvent<FileReader>) => {
                try {
                    const data = JSON.parse(ev.target?.result as string);
                    const current = await db.settings.get('global');
                    if (!current) { showToast(language === 'en' ? 'Please save settings first.' : '先に設定を一度保存してください。', 'info'); return; }
                    const merged: Settings = {
                        ...current,
                        evaluationFormula: {
                            ...current.evaluationFormula,
                            group1Multiplier: data.group1Multiplier ?? current.evaluationFormula.group1Multiplier,
                            group2Multiplier: data.group2Multiplier ?? current.evaluationFormula.group2Multiplier,
                            group3Multiplier: data.group3Multiplier ?? current.evaluationFormula.group3Multiplier,
                            skillMultipliers: data.skillMultipliers ?? current.evaluationFormula.skillMultipliers,
                            qualityValues: data.qualityValues ?? current.evaluationFormula.qualityValues,
                            exceptions: data.exceptions ?? current.evaluationFormula.exceptions,
                            quirkyArtifactScores: data.quirkyArtifactScores ?? current.evaluationFormula.quirkyArtifactScores,
                        }
                    };
                    await db.settings.put(merged);
                    setSettings(merged);
                    showToast(language === 'en' ? 'Calc settings imported. Please hit "Save Settings" if you want to recalculate evaluation scores.' : '評価計算式設定をインポートしました。評価値を再計算する場合は「設定を保存」を押してください。', 'success');
                } catch (err: any) {
                    showToast((language === 'en' ? 'Import Failed: ' : 'インポート失敗: ') + (err.message || ''), 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // デザイン設定
    const currentDesign = { ...DEFAULT_DESIGN, ...(settings.design ?? {}) };
    const updateDesign = (patch: Partial<typeof DEFAULT_DESIGN>, persist: boolean = true) => {
        const newDesign = { ...currentDesign, ...patch };
        const newSettings = { ...settings, design: newDesign };
        setSettings(newSettings); // Update React state first
        if (persist) {
            // Always read from DB to avoid overwriting fields managed elsewhere (e.g. skillFilterFields)
            db.settings.get('global').then(latest => {
                const base = latest ?? settings;
                db.settings.put({ ...base, design: newDesign }).catch(console.error);
            });
        }
    };
    const resetDesign = () => {
        const newSettings = { ...settings, design: { ...DEFAULT_DESIGN }, pageLimit: 10 };
        setSettings(newSettings);
        db.settings.get('global').then(latest => {
            const base = latest ?? settings;
            db.settings.put({ ...base, design: { ...DEFAULT_DESIGN }, pageLimit: 10 }).catch(console.error);
        });
    };


    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', paddingBottom: '3rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                    <h2 style={{ fontSize: 'calc(var(--font-size-main) * 1.8)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <SettingsIcon /> {language === 'en' ? 'Settings' : '設定'}
                    </h2>
                    {/* Navigation Icons */}
                    <nav style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255,255,255,0.03)', padding: '0.3rem', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                        {[
                            { id: 'evaluation-settings', icon: Calculator, label: language === 'en' ? 'Formula' : '計算式' },
                            { id: 'discard-settings', icon: ShieldAlert, label: language === 'en' ? 'Discard' : '廃棄設定' },
                            { id: 'design-settings', icon: Palette, label: language === 'en' ? 'Design' : 'デザイン' },
                            { id: 'performance-settings', icon: Zap, label: language === 'en' ? 'Performance' : '軽量化' },
                            { id: 'notification-settings', icon: Bell, label: language === 'en' ? 'Notification' : '通知設定' },
                            { id: 'advanced-settings', icon: MonitorUp, label: language === 'en' ? 'Advanced' : '上級者' },
                            { id: 'data-settings', icon: HardDrive, label: language === 'en' ? 'Backup & Restore' : 'バックアップ・復元' },
                        ].map(item => (
                            <button
                                key={item.id}
                                className="btn btn-ghost"
                                title={item.label}
                                style={{ padding: '0.4rem', color: 'var(--text-muted)' }}
                                onClick={() => {
                                    const el = document.getElementById(item.id);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                            >
                                <item.icon size={18} />
                            </button>
                        ))}
                    </nav>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                    <select
                        className="input"
                        style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--font-size-main)', cursor: 'pointer' }}
                        value={settings.language || 'ja'}
                        onChange={async (e) => {
                            const newLang = e.target.value as 'en' | 'ja';

                            // Update local state so the dropdown value changes visually
                            setSettings(prev => ({ ...prev, language: newLang }));

                            // Immediately save only the language to the database
                            // to avoid unintentionally saving other modified but unsaved settings.
                            const currentDbSettings = await db.settings.get('global');
                            if (currentDbSettings) {
                                await db.settings.put({ ...currentDbSettings, language: newLang });
                            } else {
                                await db.settings.put({ ...DEFAULT_SETTINGS, language: newLang });
                            }
                        }}
                    >
                        <option value="ja">日本語</option>
                        <option value="en">English</option>
                    </select>
                    <button className="btn btn-calc-glow" onClick={handleSave} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <Save size={18} style={{ marginRight: '0.4rem' }} /> {isDirty ? (language === 'en' ? 'Save & Recalc Scores' : '保存＋評価値再計算') : (language === 'en' ? 'Save Settings' : '設定を保存')}
                    </button>
                </div>
            </header>

            {/* Evaluation Settings */}
            <div id="evaluation-settings" className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', scrollMarginTop: '2rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calculator size={18} /> {language === 'en' ? 'Evaluation Formula' : '評価値の計算式'}
                </h3>
                <div style={{ background: 'var(--dim-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '1.2rem', marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 400, color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: 'calc(var(--font-size-sub) * 0.95)', opacity: 0.8 }}>
                        {language === 'en' ? '【 Base Skill Evaluation Value 】' : '【 基本となる各スキルの評価値 】'}
                    </div>
                    <div style={{ paddingLeft: '1.2rem', marginBottom: '1.2rem', color: 'var(--text-main)', fontWeight: 400 }}>
                        {language === 'en' ? '　[ Skill Evaluation Value ] ＝ ( ★ Quality Coefficient ) × ( Skill Base Point )' : '　[ スキル評価値 ] ＝ ( ★品質係数 ) × ( スキル別基礎点 )'}
                    </div>
                    <div style={{ fontWeight: 400, color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: 'calc(var(--font-size-sub) * 0.95)', opacity: 0.8 }}>
                        {language === 'en' ? '【 Final Overall AF Evaluation Score 】' : '【 最終的なAFの全体評価スコア 】'}
                    </div>
                    <div style={{ paddingLeft: '1.2rem', color: 'var(--text-main)', fontWeight: 400 }}>
                        <div>　( {language === 'en' ? 'Group Ⅰ Coefficient' : 'グループⅠ係数'} × [ {language === 'en' ? 'Skill 1' : 'スキル1'}{language === 'en' ? ' Value' : '評価値'} + {language === 'en' ? 'Skill 2' : 'スキル2'}{language === 'en' ? ' Value' : '評価値'} ] )</div>
                        <div>+ ( {language === 'en' ? 'Group Ⅱ Coefficient' : 'グループⅡ係数'} × [ {language === 'en' ? 'Skill 3' : 'スキル3'}{language === 'en' ? ' Value' : '評価値'} ] )</div>
                        <div>+ ( {language === 'en' ? 'Group Ⅲ Coefficient' : 'グループⅢ係数'} × [ {language === 'en' ? 'Skill 4' : 'スキル4'}{language === 'en' ? ' Value' : '評価値'} ] )</div>
                        <div>+ ( {language === 'en' ? 'Skill Combination Correction' : 'スキル組み合わせ補正'} )</div>
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.5rem' }}>{language === 'en' ? 'Group Multiplier Settings (G1-G3)' : 'グループ係数設定 (G1～G3)'}</h4>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>{language === 'en' ? 'Set evaluation multipliers for each skill group based on their slot position.' : '各グループ（スキルスロット位置）ごとの評価倍率を設定できます。'}</p>
                    <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                            <label style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'GⅠ' : 'GⅠ(S1/S2)'}</label>
                            <input type="number" className="input" step="0.1"
                                style={{ width: '100px', padding: '0.3rem 0.5rem' }}
                                value={settings.evaluationFormula.group1Multiplier}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group1Multiplier: e.target.value === '' ? '' as any : parseFloat(e.target.value) } })}
                                onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group1Multiplier: 1 } }) }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                            <label style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'GⅡ' : 'GⅡ(S3)'}</label>
                            <input type="number" className="input" step="0.1"
                                style={{ width: '100px', padding: '0.3rem 0.5rem' }}
                                value={settings.evaluationFormula.group2Multiplier}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group2Multiplier: e.target.value === '' ? '' as any : parseFloat(e.target.value) } })}
                                onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group2Multiplier: 1 } }) }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                            <label style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'GⅢ' : 'GⅢ(S4)'}</label>
                            <input type="number" className="input" step="0.1"
                                style={{ width: '100px', padding: '0.3rem 0.5rem' }}
                                value={settings.evaluationFormula.group3Multiplier}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group3Multiplier: e.target.value === '' ? '' as any : parseFloat(e.target.value) } })}
                                onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group3Multiplier: 1 } }) }}
                            />
                        </div>
                    </div>
                </div>

                {/* Quality Values Q1-Q5 */}
                <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.5rem' }}>{language === 'en' ? 'Quality Modifier Settings (Q1-Q5)' : 'スキル品質係数設定 (★1～★5)'}</h4>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>{language === 'en' ? 'Set the value for each Quality Level (stars 1-5).' : 'スキルの初期値段階＝品質★1～5 ごとの品質係数を設定できます。'}</p>
                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                        {[1, 2, 3, 4, 5].map((q: number) => (
                            <div key={q} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                                <label style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>★{q}</label>
                                <input type="number" className="input" step="0.1"
                                    style={{ width: '72px', padding: '0.3rem 0.5rem' }}
                                    value={settings.evaluationFormula.qualityValues?.[q] ?? ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const raw = e.target.value;
                                        const val = raw === '' ? '' as any : parseFloat(raw);
                                        const newQV = { ...(settings.evaluationFormula.qualityValues || {}) };
                                        newQV[q] = val;
                                        updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, qualityValues: newQV } });
                                    }}
                                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                        if (e.target.value === '') {
                                            const newQV = { ...(settings.evaluationFormula.qualityValues || {}) };
                                            newQV[q] = 1;
                                            updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, qualityValues: newQV } });
                                        }
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.8rem', borderBottom: '1px solid var(--dim-border)', paddingBottom: '0.5rem' }}>{language === 'en' ? 'Individual Skill Multipliers' : 'スキル別基礎点設定'}</h4>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        {language === 'en' ? 'Set multipliers for specific skills. Applies across all quality levels.' : '全スキルの基礎点数を設定できます。スキル名単位で設定し、全品質共通で適用されます。'}
                    </p>

                    {/* Group Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        {([1, 2, 3] as const).map((g: 1 | 2 | 3) => (
                            <button
                                key={g}
                                className="btn btn-ghost"
                                style={{ 
                                    padding: '0.4rem 1.2rem', 
                                    fontSize: 'var(--font-size-main)', 
                                    border: skillGroup === g ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--panel-border)',
                                    background: skillGroup === g ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                    color: skillGroup === g ? 'var(--accent-blue-hover)' : 'var(--text-muted)'
                                }}
                                onClick={() => setSkillGroup(g)}
                            >
                                {g === 1 ? (language === 'en' ? 'Group I (S1/S2)' : 'グループⅠ(S1/S2)') : g === 2 ? (language === 'en' ? 'Group II (S3)' : 'グループⅡ(S3)') : (language === 'en' ? 'Group III (S4)' : 'グループⅢ(S4)')}
                            </button>
                        ))}
                    </div>

                    {/* G1: 2-column compact grid */}
                    {skillGroup === 1 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {G1_SKILLS.map((skill: { baseId: number; name: string; }) => (
                                <div key={skill.baseId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--criteria-detail-bg)', padding: '0.5rem 0.8rem', borderRadius: '8px', gap: '0.5rem' }}>
                                    <span style={{ fontSize: 'var(--font-size-main)', flex: 1 }}>{language === 'en' ? translateSkill(skill.name, language) : skill.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>x</span>
                                        <input type="number" className="input" step="0.1"
                                            style={{ width: '72px', padding: '0.25rem 0.5rem' }}
                                            value={settings.evaluationFormula.skillMultipliers?.[skill.baseId] ?? 1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMultiplier(skill.baseId, e.target.value === '' ? '' as any : parseFloat(e.target.value))}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateMultiplier(skill.baseId, 0) }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* G2: 1-column (long names) */}
                    {skillGroup === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {G2_SKILLS.map((skill: { baseId: number; name: string; }) => (
                                <div key={skill.baseId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--criteria-detail-bg)', padding: '0.5rem 0.8rem', borderRadius: '8px', gap: '0.8rem' }}>
                                    <span style={{ fontSize: 'var(--font-size-main)', flex: 1, lineHeight: '1.4' }}>{language === 'en' ? translateSkill(skill.name, language) : skill.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>x</span>
                                        <input type="number" className="input" step="0.1"
                                            style={{ width: '72px', padding: '0.25rem 0.5rem' }}
                                            value={settings.evaluationFormula.skillMultipliers?.[skill.baseId] ?? 1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMultiplier(skill.baseId, e.target.value === '' ? '' as any : parseFloat(e.target.value))}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateMultiplier(skill.baseId, 0) }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* G3: 1-column (long names) */}
                    {skillGroup === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {G3_SKILLS.map((skill: { baseId: number; name: string; }) => (
                                <div key={skill.baseId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--criteria-detail-bg)', padding: '0.5rem 0.8rem', borderRadius: '8px', gap: '0.8rem' }}>
                                    <span style={{ fontSize: 'var(--font-size-main)', flex: 1, lineHeight: '1.4' }}>{language === 'en' ? translateSkill(skill.name, language) : skill.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>x</span>
                                        <input type="number" className="input" step="0.1"
                                            style={{ width: '72px', padding: '0.25rem 0.5rem' }}
                                            value={settings.evaluationFormula.skillMultipliers?.[skill.baseId] ?? 1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMultiplier(skill.baseId, e.target.value === '' ? '' as any : parseFloat(e.target.value))}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateMultiplier(skill.baseId, 0) }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--dim-border)', margin: '1.5rem 0' }} />
                <h3 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.8rem', color: 'var(--text-main)' }}>{language === 'en' ? 'Skill Combination Modifiers (+/-)' : 'スキル組み合わせ条件（加算/減算）'}</h3>
                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    {language === 'en'
                        ? <>Add or subtract from the total score when two specific skills appear together on the same Artifact.<br />Please ensure the Condition Skill and Target Skill are different.</>
                        : <>指定した2つのスキルが同一AFに存在する場合に、評価値を加算または減算できます。<br />条件スキルと対象スキルは異なるスキルを選択してください。</>}
                </p>

                <div style={{ 
                    border: '1px solid var(--panel-border)', 
                    borderRadius: '12px', 
                    padding: '0.6rem', 
                    resize: 'vertical', 
                    overflow: 'hidden', 
                    minHeight: '300px', 
                    maxHeight: '1200px',
                    background: 'rgba(255,255,255,0.01)', 
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0', overflowY: 'auto', padding: '2px' }}>
                        {(settings.evaluationFormula.exceptions || []).map((entry: any, entryIdx: number) => {
                        const allSkills = [
                            ...G1_SKILLS.map(s => ({ group: 1, baseId: s.baseId, name: s.name })),
                            ...G2_SKILLS.map(s => ({ group: 2, baseId: s.baseId, name: s.name })),
                            ...G3_SKILLS.map(s => ({ group: 3, baseId: s.baseId, name: s.name })),
                        ];

                        const normalizeVal = (val: any, grp: number) => {
                            if (typeof val === 'number') return val;
                            const matched = allSkills.find(s => s.group === grp && s.name === val);
                            return matched ? matched.baseId : '';
                        };


                        const updateEntry = (updated: any, idx: number) => {
                            const newExs = [...(settings.evaluationFormula.exceptions || [])];
                            newExs[idx] = updated;
                            updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                        };

                        const handleItemMove = (srcIdx: number, srcParent: number | null, dstIdx: number, dstParent: number | null) => {
                            const newExs = JSON.parse(JSON.stringify(settings.evaluationFormula.exceptions));
                            let item: any;
                            if (srcParent === null) {
                                item = newExs.splice(srcIdx, 1)[0];
                            } else {
                                item = newExs[srcParent].children.splice(srcIdx, 1)[0];
                            }
                            
                            // Adjust destination indices if moving an item from the root shifts following items/folders
                            let finalDstParent = dstParent;
                            if (srcParent === null && dstParent !== null && srcIdx < dstParent) {
                                finalDstParent = Math.max(0, dstParent - 1);
                            }

                            let finalDstIdx = dstIdx;
                            if (srcParent === dstParent && srcIdx < dstIdx) {
                                finalDstIdx = Math.max(0, dstIdx - 1);
                            }

                            if (finalDstParent === null) {
                                newExs.splice(finalDstIdx, 0, item);
                            } else {
                                newExs[finalDstParent].children.splice(finalDstIdx, 0, item);
                            }
                            updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                        };

                        const renderItem = (ex: any, idx: number, parentIdx: number | null, isInsideFolder = false) => {
                            const currentCondId = normalizeVal(ex.conditionSkillName, ex.conditionGroup);
                            const currentTargetId = normalizeVal(ex.targetSkillName, ex.targetGroup);
                            const itemImpossible = isImpossible(ex);

                            const updateItem = (patch: any) => {
                                if ('conditionSkillName' in patch) {
                                    const found = allSkills.find(s => s.baseId === patch.conditionSkillName);
                                    if (found) patch.conditionGroup = found.group;
                                }
                                if ('targetSkillName' in patch) {
                                    const found = allSkills.find(s => s.baseId === patch.targetSkillName);
                                    if (found) patch.targetGroup = found.group;
                                }
                                if (isInsideFolder && parentIdx !== null) {
                                    const folder = { ...settings.evaluationFormula.exceptions[parentIdx] as any };
                                    folder.children = folder.children.map((c: any, i: number) => i === idx ? { ...c, ...patch } : c);
                                    updateEntry(folder, parentIdx);
                                } else {
                                    updateEntry({ ...ex, ...patch }, idx);
                                }
                            };

                            const duplicateItem = () => {
                                const copy = { ...ex, id: generateId() };
                                if (isInsideFolder && parentIdx !== null) {
                                    const folder = { ...settings.evaluationFormula.exceptions[parentIdx] as any };
                                    folder.children.splice(idx + 1, 0, copy);
                                    updateEntry(folder, parentIdx);
                                } else {
                                    const newExs = [...(settings.evaluationFormula.exceptions || [])];
                                    newExs.splice(idx + 1, 0, copy);
                                    updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                                }
                            };

                            const deleteItem = () => {
                                if (isInsideFolder && parentIdx !== null) {
                                    const folder = { ...settings.evaluationFormula.exceptions[parentIdx] as any };
                                    folder.children = folder.children.filter((_: any, i: number) => i !== idx);
                                    updateEntry(folder, parentIdx);
                                } else {
                                    const newExs = settings.evaluationFormula.exceptions.filter((_: any, i: number) => i !== idx);
                                    updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                                }
                                setConfirmDeleteExIdx(null);
                            };

                            const confirmId = `${parentIdx !== null ? parentIdx : 'root'}-${idx}`;
                            const isConfirming = confirmDeleteExIdx === confirmId as any;

                            const itemId = ex.id || confirmId;

                            return (
                                <div key={itemId} 
                                    style={{ position: 'relative', padding: '2px 0' }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // Folders cannot be dropped inside other folders (only at root)
                                        if (draggedType === 'folder' && isInsideFolder) {
                                            if (dragOverId !== null) setDragOverId(null);
                                            if (dragOverPos !== null) setDragOverPos(null);
                                            return;
                                        }

                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const relY = (e.clientY - rect.top) / rect.height;
                                        setDragOverId(itemId);
                                        const pos = relY < 0.5 ? 'top' : 'bottom';
                                        
                                        // Suppress indicator if target is adjacent to current position
                                        const targetIdx = pos === 'bottom' ? idx + 1 : idx;
                                        const isSameParent = draggedItemParentId === (parentIdx !== null ? String(parentIdx) : 'root');
                                        if (isSameParent && draggedIdx !== null && (targetIdx === draggedIdx || targetIdx === draggedIdx + 1)) {
                                            setDragOverPos(null);
                                        } else {
                                            setDragOverPos(pos);
                                        }
                                    }}
                                    onDragLeave={() => {
                                        setDragOverId(null);
                                        setDragOverPos(null);
                                    }}
                                    onDragEnd={() => {
                                        setCanDragItemId(null);
                                        setDraggedIdx(null);
                                        setDraggedType(null);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const pos = dragOverPos;
                                        setDragOverId(null);
                                        setDragOverPos(null);
                                        try {
                                            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                                            const targetIdx = pos === 'bottom' ? idx + 1 : idx;

                                            if (data.type === 'item') {
                                                handleItemMove(data.idx, data.parentIdx, targetIdx, parentIdx);
                                            } else if (data.type === 'folder' && parentIdx === null) {
                                                const newExs = [...settings.evaluationFormula.exceptions];
                                                const folder = newExs.splice(data.idx, 1)[0];
                                                let finalDst = targetIdx;
                                                if (data.idx < targetIdx) finalDst = Math.max(0, targetIdx - 1);
                                                newExs.splice(finalDst, 0, folder);
                                                updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                                            }
                                        } catch(err) { console.error(err); }
                                    }}
                                >
                                    {/* Indicator Line (Combined gap-center) */}
                                    {dragOverId === itemId && dragOverPos && dragOverPos !== 'inside' && (
                                        <div style={{ 
                                            position: 'absolute', 
                                            left: 0, right: 0, 
                                            height: '2px', 
                                            background: 'var(--accent-blue)', 
                                            zIndex: 10,
                                            top: dragOverPos === 'top' ? '-1px' : 'auto',
                                            bottom: dragOverPos === 'bottom' ? '-1px' : 'auto',
                                            pointerEvents: 'none'
                                        }} />
                                    )}

                                    <div 
                                        draggable={canDragItemId === itemId}
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'item', idx, parentIdx }));
                                            setDraggedIdx(idx);
                                            setDraggedType('item');
                                            setDraggedItemParentId(parentIdx !== null ? String(parentIdx) : 'root');
                                        }}
                                        onDragEnd={() => {
                                            setCanDragItemId(null);
                                            setDraggedIdx(null);
                                            setDraggedType(null);
                                        }}
                                        style={{ 
                                            display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'var(--criteria-detail-bg)', 
                                            padding: isInsideFolder ? '0.4rem 2px' : '0.4rem 3px 0.4rem 2px', borderRadius: '8px', border: '1px solid transparent',
                                            borderColor: isConfirming ? 'var(--accent-danger)' : 'transparent', transition: 'all 0.1s'
                                    }}>

                                    {itemImpossible && (
                                        <div title={language === 'en' ? 'Invalid combination' : '不可能な組み合わせ'} style={{ display: 'flex', color: '#f59e0b' }}>
                                            <AlertTriangle size={16} />
                                        </div>
                                    )}

                                    <select className="input" style={{ padding: '0.2rem', paddingRight: '1.2rem', fontSize: 'var(--font-size-sub)', flex: 2, minWidth: '100px' }}
                                        value={currentCondId}
                                        onChange={(e) => updateItem({ conditionSkillName: parseInt(e.target.value) || '' })}>
                                        <option value="">--</option>
                                        <optgroup label="Gr [I]">
                                            {G1_SKILLS.filter(s => !(s.baseId === currentTargetId && ex.targetGroup === 1)).map(s => <option key={s.baseId} value={s.baseId}>{language === 'en' ? translateSkill(s.name, language) : truncateSkill(s.name, language)}</option>)}
                                        </optgroup>
                                        <optgroup label="Gr [II]">
                                            {G2_SKILLS.filter(s => !(s.baseId === currentTargetId && ex.targetGroup === 2)).map(s => <option key={s.baseId} value={s.baseId}>{language === 'en' ? translateSkill(s.name, language) : truncateSkill(s.name, language)}</option>)}
                                        </optgroup>
                                        <optgroup label="Gr [III]">
                                            {G3_SKILLS.filter(s => !(s.baseId === currentTargetId && ex.targetGroup === 3)).map(s => <option key={s.baseId} value={s.baseId}>{language === 'en' ? translateSkill(s.name, language) : truncateSkill(s.name, language)}</option>)}
                                        </optgroup>
                                    </select>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>&</span>
                                    <select className="input" style={{ padding: '0.2rem', paddingRight: '1.2rem', fontSize: 'var(--font-size-sub)', flex: 2, minWidth: '100px' }}
                                        value={currentTargetId}
                                        onChange={(e) => updateItem({ targetSkillName: parseInt(e.target.value) || '' })}>
                                        <option value="">--</option>
                                        <optgroup label="Gr [I]">
                                            {G1_SKILLS.filter(s => !(s.baseId === currentCondId && ex.conditionGroup === 1)).map(s => <option key={s.baseId} value={s.baseId}>{language === 'en' ? translateSkill(s.name, language) : truncateSkill(s.name, language)}</option>)}
                                        </optgroup>
                                        <optgroup label="Gr [II]">
                                            {G2_SKILLS.filter(s => !(s.baseId === currentCondId && ex.conditionGroup === 2)).map(s => <option key={s.baseId} value={s.baseId}>{language === 'en' ? translateSkill(s.name, language) : truncateSkill(s.name, language)}</option>)}
                                        </optgroup>
                                        <optgroup label="Gr [III]">
                                            {G3_SKILLS.filter(s => !(s.baseId === currentCondId && ex.conditionGroup === 3)).map(s => <option key={s.baseId} value={s.baseId}>{language === 'en' ? translateSkill(s.name, language) : truncateSkill(s.name, language)}</option>)}
                                        </optgroup>
                                    </select>

                                    <ArrowRight size={12} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />

                                    <select className="input" style={{ 
                                        padding: '0.2rem', fontSize: 'var(--font-size-sub)', fontWeight: 800, width: '40px', textAlign: 'center',
                                        color: (typeof ex.isSubtract === 'boolean' ? ex.isSubtract : ex.scoreModifier < 0) ? 'var(--accent-danger)' : 'var(--accent-success)'
                                    }}
                                        value={(typeof ex.isSubtract === 'boolean' ? ex.isSubtract : ex.scoreModifier < 0) ? '-' : '+'}
                                        onChange={(e) => {
                                            const absVal = Math.abs(ex.scoreModifier || 0);
                                            const isSub = e.target.value === '-';
                                            updateItem({ isSubtract: isSub, scoreModifier: isSub ? -absVal : absVal });
                                        }}>
                                        <option value="+">+</option>
                                        <option value="-">-</option>
                                    </select>
                                    <input type="number" className="input" step="0.1" min="0" style={{ width: '54px', padding: '0.2rem', fontSize: 'var(--font-size-sub)' }}
                                        value={ex.scoreModifier === '' ? '' : Math.abs(ex.scoreModifier || 0)}
                                        onChange={(e) => {
                                            if (e.target.value === '') { updateItem({ scoreModifier: '' }); }
                                            else {
                                                const v = Math.abs(parseFloat(e.target.value) || 0);
                                                const isNegative = typeof ex.isSubtract === 'boolean' ? ex.isSubtract : ex.scoreModifier < 0;
                                                updateItem({ scoreModifier: isNegative ? -v : v });
                                            }
                                        }}
                                    />

                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                        {!isConfirming && (
                                            <>
                                                <button className="btn btn-ghost" style={{ padding: '0.2rem', color: 'var(--text-muted)' }} title={language === 'en' ? 'Duplicate' : '複製'} onClick={duplicateItem}>
                                                    <Copy size={14} />
                                                </button>
                                                <button className="btn btn-ghost" style={{ padding: '0.2rem', color: 'var(--text-muted)', opacity: 0.6 }} onClick={() => setConfirmDeleteExIdx(confirmId as any)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                        {isConfirming && (
                                            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                                <button className="btn btn-danger" onClick={deleteItem} style={{ padding: '0.1rem 0.3rem', fontSize: '10px' }}>{language === 'en' ? 'Del' : '削除'}</button>
                                                <button className="btn btn-ghost" onClick={() => setConfirmDeleteExIdx(null)} style={{ padding: '0.1rem 0.3rem', fontSize: '10px' }}>×</button>
                                            </div>
                                        )}
                                        <div 
                                            onMouseDown={() => setCanDragItemId(itemId)}
                                            onMouseUp={() => setCanDragItemId(null)}
                                            style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', padding: '0.2rem' }} 
                                            title={language === 'en' ? 'Drag' : 'ドラッグ'}
                                        >
                                            <GripVertical size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                        };

                        if (entry.type === 'folder') {
                            const folderId = entry.id || `folder-${entryIdx}`;
                            return (
                                <div key={folderId} 
                                    style={{ position: 'relative', padding: '0.4rem 0' }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const relY = (e.clientY - rect.top) / rect.height;
                                        setDragOverId(folderId);
                                        
                                        const rawPos = relY < 0.2 ? 'top' : relY > 0.8 ? 'bottom' : 'inside';
                                        
                                        // Suppress inside for folder dragging
                                        const pos = (draggedType === 'folder' && rawPos === 'inside') ? null : rawPos;

                                        // Suppress indicator if adjacent to origin
                                        const targetIdx = pos === 'bottom' ? entryIdx + 1 : entryIdx;
                                        if (draggedItemParentId === 'root' && draggedIdx !== null && (targetIdx === draggedIdx || targetIdx === draggedIdx + 1) && pos !== 'inside') {
                                            setDragOverPos(null);
                                        } else {
                                            setDragOverPos(pos as any);
                                        }
                                    }}
                                    onDragLeave={() => {
                                        setDragOverId(null);
                                        setDragOverPos(null);
                                    }}
                                    onDragEnd={() => {
                                        setCanDragItemId(null);
                                        setDraggedIdx(null);
                                        setDraggedType(null);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const pos = dragOverPos;
                                        setDragOverId(null);
                                        setDragOverPos(null);
                                        try {
                                            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                                            if (data.type === 'item') {
                                                if (pos === 'top' || pos === 'bottom') {
                                                    const targetIdx = pos === 'bottom' ? entryIdx + 1 : entryIdx;
                                                    handleItemMove(data.idx, data.parentIdx, targetIdx, null);
                                                } else if (pos === 'inside') {
                                                    handleItemMove(data.idx, data.parentIdx, entry.children.length, entryIdx);
                                                }
                                            } else if (data.type === 'folder' && data.idx !== entryIdx) {
                                                const targetIdx = pos === 'bottom' ? entryIdx + 1 : entryIdx;
                                                const newExs = [...settings.evaluationFormula.exceptions];
                                                const folder = newExs.splice(data.idx, 1)[0];
                                                let finalDst = targetIdx;
                                                if (data.idx < targetIdx) finalDst = Math.max(0, targetIdx - 1);
                                                newExs.splice(finalDst, 0, folder);
                                                updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                                            }
                                        } catch(err) { console.error(err); }
                                    }}
                                >
                                    {/* Indicator Line */}
                                    {dragOverId === folderId && dragOverPos && dragOverPos !== 'inside' && (
                                        <div style={{ 
                                            position: 'absolute', left: 0, right: 0, height: '2px', 
                                            background: 'var(--accent-blue)', zIndex: 10,
                                            top: dragOverPos === 'top' ? '-1px' : 'auto',
                                            bottom: dragOverPos === 'bottom' ? '-1px' : 'auto',
                                            pointerEvents: 'none'
                                        }} />
                                    )}

                                    <div 
                                        draggable={canDragItemId === folderId}
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', idx: entryIdx }));
                                            setDraggedIdx(entryIdx);
                                            setDraggedType('folder');
                                            setDraggedItemParentId('root');
                                        }}
                                        onDragEnd={() => {
                                            setCanDragItemId(null);
                                            setDraggedIdx(null);
                                            setDraggedType(null);
                                        }}
                                        style={{ 
                                            display: 'flex', flexDirection: 'column', gap: '0.4rem', 
                                            background: dragOverId === folderId && dragOverPos === 'inside' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)', 
                                            padding: '0.4rem 0', borderRadius: '10px', border: '1px solid var(--panel-border)', 
                                            borderColor: confirmDeleteExIdx === folderId ? 'var(--accent-danger)' : 'var(--panel-border)',
                                            transition: 'all 0.1s' 
                                    }}>
                                        <div 
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 3px 0.2rem 2px', cursor: 'pointer' }}
                                            onClick={() => updateEntry({ ...entry, isOpen: !entry.isOpen }, entryIdx)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                {entry.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </div>
                                            <Folder size={16} style={{ color: 'var(--accent-blue)', opacity: 0.8 }} />
                                            
                                            {renamingFolderId === folderId ? (
                                                <input 
                                                    className="input" 
                                                    autoFocus
                                                    style={{ background: 'var(--panel-bg)', border: '1px solid var(--accent-blue)', padding: '0.1rem 0.3rem', fontSize: 'var(--font-size-sub)', fontWeight: 600, flex: 1 }}
                                                    value={entry.name}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => updateEntry({ ...entry, name: e.target.value }, entryIdx)}
                                                    onBlur={() => setRenamingFolderId(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            setRenamingFolderId(null);
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                                                    <span style={{ fontSize: 'var(--font-size-sub)', fontWeight: 600 }}>{entry.name}</span>
                                                    <button 
                                                        className="btn btn-ghost" 
                                                        style={{ padding: '0.1rem', opacity: 0.5 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setRenamingFolderId(folderId);
                                                        }}
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            )}

                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.2rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                {confirmDeleteExIdx !== folderId && (
                                                    <>
                                                        <button className="btn btn-ghost" style={{ padding: '0.2rem', color: 'var(--text-muted)' }} title={language === 'en' ? 'Duplicate Folder' : 'フォルダを複製'}
                                                            onClick={() => {
                                                                const copy = JSON.parse(JSON.stringify(entry));
                                                                copy.id = generateId();
                                                                copy.children = copy.children.map((c: any) => ({ ...c, id: generateId() }));
                                                                const newExs = [...settings.evaluationFormula.exceptions];
                                                                newExs.splice(entryIdx + 1, 0, copy);
                                                                updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                                                            }}>
                                                            <Copy size={14} />
                                                        </button>
                                                        <button className="btn btn-ghost" style={{ padding: '0.2rem', color: 'var(--text-muted)', opacity: 0.6 }}
                                                            onClick={() => setConfirmDeleteExIdx(folderId)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                                {confirmDeleteExIdx === folderId && (
                                                    <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                                        <button className="btn btn-danger" style={{ padding: '0.1rem 0.3rem', fontSize: '10px' }}
                                                            onClick={() => {
                                                                const newExs = settings.evaluationFormula.exceptions.filter((_: any, i: number) => i !== entryIdx);
                                                                updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                                                                setConfirmDeleteExIdx(null);
                                                            }}>
                                                            {language === 'en' ? 'Delete' : '削除'}
                                                        </button>
                                                        <button className="btn btn-ghost" onClick={() => setConfirmDeleteExIdx(null)} style={{ padding: '0.1rem 0.3rem', fontSize: '10px' }}>×</button>
                                                    </div>
                                                )}
                                                <div 
                                                    onMouseDown={(e) => { e.stopPropagation(); setCanDragItemId(folderId); }}
                                                    onMouseUp={(e) => { e.stopPropagation(); setCanDragItemId(null); }}
                                                    style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', padding: '0.2rem' }} 
                                                    title={language === 'en' ? 'Drag' : 'ドラッグ'}
                                                >
                                                    <GripVertical size={16} />
                                                </div>
                                            </div>
                                        </div>
                                        {entry.isOpen && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '0', minHeight: '10px' }}>
                                                {entry.children.map((child: any, childIdx: number) => renderItem(child, childIdx, entryIdx, true))}
                                                {entry.children.length === 0 && (
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '0.4rem', border: '1px dashed var(--panel-border)', borderRadius: '6px' }}>
                                                        {language === 'en' ? 'Empty' : '空'}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        } else {
                            return renderItem(entry, entryIdx, null, false);
                        }
                    })}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button className="btn btn-ghost" style={{ border: '1px solid var(--panel-border)', fontSize: 'var(--font-size-sub)', flex: 1, padding: '0.4rem' }}
                        onClick={() => {
                            const newEx = { id: generateId(), type: 'item' as const, conditionGroup: 1, conditionSkillName: '', targetGroup: 1, targetSkillName: '', scoreModifier: 0, isSubtract: false };
                            updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: [...(settings.evaluationFormula.exceptions || []), newEx] } });
                        }}>
                        {language === 'en' ? '＋ Add Rule' : '＋ 条件行を追加'}
                    </button>
                    <button className="btn btn-ghost" style={{ border: '1px solid var(--panel-border)', fontSize: 'var(--font-size-sub)', padding: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        title={language === 'en' ? 'Add Folder' : 'フォルダを作成'}
                        onClick={() => {
                            const newFolder = { id: generateId(), type: 'folder' as const, name: language === 'en' ? 'New Folder' : '新しいフォルダ', isOpen: true, children: [] };
                            updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: [...(settings.evaluationFormula.exceptions || []), newFolder] } });
                        }}>
                        <FolderPlus size={16} />
                    </button>
                </div>

                {/* === Quirky Artifact Settings (レアAF) === */}
                <hr style={{ border: 'none', borderTop: '1px solid var(--dim-border)', margin: '1.5rem 0' }} />
                <h3 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.8rem', color: 'var(--text-main)' }}>
                    {language === 'en' ? 'Quirky Artifact Evaluation Scores' : 'クァーキー・アーティファクトの設定'}
                </h3>
                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    {language === 'en' ? 'Set fixed evaluation scores for specific rare artifacts. Default is -1 if empty.' : '特定のレアアーティファクトに対する固定の評価値を設定できます。未指定時は一律 -1 として扱われます。'}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                    {[
                        { id: 401110401, key: 'RARE_401110401' },
                        { id: 401110402, key: 'RARE_401110402' },
                        { id: 401110403, key: 'RARE_401110403' },
                        { id: 401110404, key: 'RARE_401110404' },
                        { id: 401110405, key: 'RARE_401110405' },
                    ].map(rare => (
                        <div key={rare.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--criteria-detail-bg)', padding: '0.6rem 0.8rem', borderRadius: '8px', gap: '0.5rem' }}>
                            <span style={{ fontSize: 'var(--font-size-sub)', flex: 1 }}>{t(rare.key as any, rare.key)}</span>
                            <input type="number" className="input" step="0.1"
                                style={{ width: '72px', padding: '0.25rem 0.5rem' }}
                                placeholder="-1"
                                value={settings.evaluationFormula.quirkyArtifactScores?.[rare.id] ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                    const newScores = { ...(settings.evaluationFormula.quirkyArtifactScores || {}) };
                                    if (val === undefined) {
                                        delete newScores[rare.id];
                                    } else {
                                        newScores[rare.id] = val;
                                    }
                                    updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, quirkyArtifactScores: newScores } });
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>  {/* end glass-panel eval+exceptions */}

            {/* Discard Settings */}
            <div id="discard-settings" className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', scrollMarginTop: '2rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '0.8rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} /> {language === 'en' ? 'Discard Settings' : 'AF廃棄設定'}
                </h3>
                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    {language === 'en'
                        ? <>Discard flags will be suggested when "Your AFs &gt; Target Inventory Count" based on the deficit.<br />Candidates are chosen from lowest evaluation score upwards, excluding protected AFs.</>
                        : <>廃棄フラグは「目標所持数 &lt; 現在のAF数」の場合に、不足分の必要枚数分廃棄を提案するフラグです。<br />保護された以外のAFの中から、評価値の低い順に廃棄候補が選ばれます。</>}
                </p>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: 'var(--font-size-main)', fontWeight: 600 }}>{language === 'en' ? 'Target Inventory Count' : '目標所持数'}</label>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{language === 'en' ? 'Suggests discard if inventory exceeds this.' : 'AF所持数がこの数を超えたときに廃棄を提案します。'}</p>
                    <input
                        type="number"
                        className="input"
                        style={{ maxWidth: '200px' }}
                        value={settings.discardBehavior.targetInventoryCount}
                        onChange={e => updateDiscardSettings({ targetInventoryCount: parseInt(e.target.value) || 1500 })}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectLocked ?? true}
                            onChange={e => updateDiscardSettings({ protectLocked: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect Favorites (Locked)' : 'お気に入りを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'If OFF, favorite AFs can be flagged. A "Discard?" warning badge will appear.' : 'OFFにするとお気に入りのAFも廃棄候補になります。「廃棄？」バッジで警告します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectKeepFlag ?? true}
                            onChange={e => updateDiscardSettings({ protectKeepFlag: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect Target Criteria AFs' : '確保されたAFを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes AFs caught by "Criteria" from discard selection.' : '「欲しい条件」で確保フラグが立ったAFを廃棄候補から除外します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.treatUnnecessaryAsDiscard}
                            onChange={e => updateDiscardSettings({ treatUnnecessaryAsDiscard: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Include "Packaged" in Discard Quota' : '不用品を廃棄予定に含める'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'If ON, packaged (trash) AFs count toward your discard goal and evaluate first.' : 'ONの場合、ゲーム内不用品マークのAFは先に廃棄提案になったり、その分廃棄必要数が減ります。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectRareAF ?? true}
                            onChange={e => updateDiscardSettings({ protectRareAF: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect Quirk Artifacts' : 'クァーキー・アーティファクトを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes specific quirk artifacts like Fantosmik Fengtooth from discard.' : '幻麗の犀牙など、ドロップ率が低い希少なクァーキーAFを廃棄候補から除外します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectEquipped ?? true}
                            onChange={e => updateDiscardSettings({ protectEquipped: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect Equipped AFs' : '装備中のAFを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes AFs currently equipped by characters.' : 'キャラに装備中のAFを廃棄候補から除外します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectMemos ?? true}
                            onChange={e => updateDiscardSettings({ protectMemos: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect AFs with Memos' : 'メモ付きのAFを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes AFs that have any memo text attached.' : 'メモ欄にテキストが入力されているAFを廃棄候補から除外します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectLv5Skills ?? true}
                            onChange={e => updateDiscardSettings({ protectLv5Skills: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect AFs with Lv5 Skills' : 'Lv5スキル持ちのAFを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes AFs that have at least one level 5 skill.' : 'いずれかのスキルがLv5まで強化されているAFを廃棄候補から除外します。'}</span></span>
                    </label>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                            <input type="checkbox" style={{ marginTop: '3px' }}
                                checked={settings.discardBehavior.protectQuality5Skills ?? false}
                                onChange={e => updateDiscardSettings({ protectQuality5Skills: e.target.checked })}
                            />
                            <span><strong>{language === 'en' ? 'Protect AFs with ☆5 Skills' : '☆5スキル持ちのAFを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes AFs that have at least one skill with a maximum initial value (☆5).' : 'いずれかのスキルの初期値が最高値（☆5）のAFを廃棄候補から除外します。'}</span></span>
                        </label>

                        {settings.discardBehavior.protectQuality5Skills && (
                            <div style={{ marginLeft: '1.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'var(--grid-item-bg)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                        <input type="radio" 
                                            checked={(settings.discardBehavior.protectQuality5Method ?? 'all') === 'all'}
                                            onChange={() => updateDiscardSettings({ protectQuality5Method: 'all' })}
                                        />
                                        <span>{language === 'en' ? 'All Skills' : 'すべてのスキル'}</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                        <input type="radio" 
                                            checked={settings.discardBehavior.protectQuality5Method === 'specific'}
                                            onChange={() => updateDiscardSettings({ protectQuality5Method: 'specific' })}
                                        />
                                        <span>{language === 'en' ? 'Specific Skills Only' : '特定のスキルのみ'}</span>
                                    </label>
                                </div>

                                {settings.discardBehavior.protectQuality5Method === 'specific' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <div style={{ 
                                            border: '1px solid var(--panel-border)', 
                                            borderRadius: '8px', 
                                            padding: '0.6rem', 
                                            resize: 'vertical', 
                                            overflow: 'hidden', 
                                            minHeight: '100px', 
                                            maxHeight: '400px',
                                            background: 'rgba(255,255,255,0.01)', 
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', padding: '2px' }}>
                                                {(settings.discardBehavior.protectedQuality5SkillsList || []).map((item, idx) => {
                                                    const updateItem = (newBaseId: number) => {
                                                        const newList = [...(settings.discardBehavior.protectedQuality5SkillsList || [])];
                                                        let newGroup = 1;
                                                        const found = [...G1_SKILLS, ...G2_SKILLS, ...G3_SKILLS].find(s => s.baseId === newBaseId);
                                                        if (found) {
                                                            if (G1_SKILLS.some(s => s.baseId === newBaseId)) newGroup = 1;
                                                            else if (G2_SKILLS.some(s => s.baseId === newBaseId)) newGroup = 2;
                                                            else if (G3_SKILLS.some(s => s.baseId === newBaseId)) newGroup = 3;
                                                        }
                                                        newList[idx] = { conditionGroup: newGroup, conditionSkillName: newBaseId };
                                                        updateDiscardSettings({ protectedQuality5SkillsList: newList });
                                                    };

                                                    const removeItem = () => {
                                                        const newList = settings.discardBehavior.protectedQuality5SkillsList!.filter((_, i) => i !== idx);
                                                        updateDiscardSettings({ protectedQuality5SkillsList: newList });
                                                    };

                                                    return (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <select className="input" style={{ flex: 1, padding: '0.2rem', paddingRight: '1.2rem', fontSize: 'var(--font-size-sub)', minWidth: '100px' }}
                                                                value={item.conditionSkillName || ""}
                                                                onChange={e => updateItem(Number(e.target.value) || 0)}
                                                            >
                                                                <option value="">--</option>
                                                                <optgroup label="Gr [I]">
                                                                    {G1_SKILLS.filter(s => s.fixedQuality !== 1).map(s => <option key={s.baseId} value={s.baseId}>{translateSkill(s.name, language)}</option>)}
                                                                </optgroup>
                                                                <optgroup label="Gr [II]">
                                                                    {G2_SKILLS.filter(s => s.fixedQuality !== 1).map(s => <option key={s.baseId} value={s.baseId}>{translateSkill(s.name, language)}</option>)}
                                                                </optgroup>
                                                            </select>
                                                            <button className="btn btn-ghost" style={{ padding: '0.3rem', color: 'var(--accent-danger)' }} onClick={removeItem} title={language === 'en' ? 'Remove' : '削除'}>
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <button className="btn" style={{ 
                                            alignSelf: 'flex-start', padding: '0.3rem 0.8rem', fontSize: 'var(--font-size-sub)', 
                                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                                            background: currentDesign.theme === 'dark' ? 'rgba(255,255,255,0.1)' : undefined,
                                            border: currentDesign.theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : undefined,
                                            color: currentDesign.theme === 'dark' ? '#fff' : undefined
                                        }}
                                            onClick={() => {
                                                const newList = [...(settings.discardBehavior.protectedQuality5SkillsList || [])];
                                                newList.push({ conditionGroup: 1, conditionSkillName: '' });
                                                updateDiscardSettings({ protectedQuality5SkillsList: newList });
                                            }}
                                        >
                                            <Plus size={14} /> {language === 'en' ? 'Add Skill' : 'スキルを追加'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem', background: 'var(--grid-item-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', fontWeight: 600, marginBottom: '0.6rem' }}>
                        {language === 'en' ? 'Protect Specific Elements' : '特定の属性を保護'}
                    </label>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                        {language === 'en' ? 'Checked elements are protected from discard flags.' : 'チェックを入れた属性のAFは廃棄提案の対象から除外されます。'}
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {[
                            { val: '1', label: '火', color: '#f87171' },
                            { val: '2', label: '水', color: '#60a5fa' },
                            { val: '3', label: '土', color: '#fbb117' },
                            { val: '4', label: '風', color: '#4ade80' },
                            { val: '5', label: '光', color: '#fef08a' },
                            { val: '6', label: '闇', color: '#c084fc' }
                        ].map(attr => {
                            const isChecked = settings.discardBehavior.protectedAttributes?.includes(attr.val) ?? false;
                            return (
                                <label key={attr.val} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'var(--dim-bg)', padding: '0.3rem 0.6rem', borderRadius: '4px', border: `1px solid ${isChecked ? attr.color : 'transparent'}` }}>
                                    <input type="checkbox"
                                        checked={isChecked}
                                        onChange={e => {
                                            const set = new Set(settings.discardBehavior.protectedAttributes ?? []);
                                            if (e.target.checked) set.add(attr.val);
                                            else set.delete(attr.val);
                                            updateDiscardSettings({ protectedAttributes: Array.from(set) });
                                        }}
                                    />
                                    <span style={{ fontSize: 'var(--font-size-sub)', fontWeight: 600, color: attr.color }}>{t(`ATTR_${attr.val}` as TranslationKey, attr.label)}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <button className="btn btn-calc-glow-purple" onClick={runDiscardLogic}>
                    <RefreshCw size={18} style={{ marginRight: '0.4rem' }} /> {hasDiscardChanges ? (language === 'en' ? 'Save & Recalc Discard' : '保存＋廃棄フラグ再計算') : (language === 'en' ? 'Recalculate Discard Only' : '廃棄フラグ 一括計算')}
                </button>
            </div>

            {/* Moved Data Management below Advanced Settings */}

            {/* ── App Design Settings ─────────────────────────── */}
            <div id="design-settings" className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', scrollMarginTop: '2rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Palette size={18} /> {language === 'en' ? 'App Design Settings' : 'アプリデザイン設定'}
                </h3>

                {/* Zoom */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                        {language === 'en' ? 'Global Zoom:' : '全体ズーム率:'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ zoom: Math.max(0.7, currentDesign.zoom - 0.05) })} style={{ padding: '0.4rem', border: '1px solid var(--panel-border)' }}>
                            <Minus size={16} />
                        </button>
                        <span style={{ fontSize: 'calc(var(--font-size-main) * 1.1)', fontWeight: 600, color: 'var(--accent-blue)', minWidth: '3.5rem', textAlign: 'center' }}>
                            {Math.round(currentDesign.zoom * 100)}%
                        </span>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ zoom: Math.min(1.5, currentDesign.zoom + 0.05) })} style={{ padding: '0.4rem', border: '1px solid var(--panel-border)' }}>
                            <Plus size={16} />
                        </button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.6rem' }}>{language === 'en' ? '70% ~ 150% (Default: 100%)' : '70% ～ 150%（デフォルト: 100%）'}</div>
                </div>

                {/* Per-tab zoom toggle */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: 'pointer', fontSize: 'var(--font-size-main)', fontWeight: 600 }}>
                        <input type="checkbox"
                            checked={currentDesign.showTabZoomControls}
                            onChange={e => updateDesign({ showTabZoomControls: e.target.checked })} />
                        {language === 'en' ? 'Show Tab-specific Zoom Controls' : 'タブ別ズーム調整ボタンを表示'}
                    </label>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.3rem', marginLeft: '1.6rem' }}>
                        {language === 'en' ? 'When ON, +/- buttons appear on each tab for individual scaling. (Scale is retained even if turned OFF).' : 'ONにすると各タブの右上に±ボタンが表示され、タブ毎に拡大縮小できます（設定はOFFにしても維持されます）'}
                    </div>
                </div>

                {/* Theme */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.6rem', fontWeight: 600 }}>{language === 'en' ? 'Theme' : 'テーマ'}</label>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                        {(['dark', 'light'] as const).map(th => (
                            <button key={th}
                                onClick={() => updateDesign({ theme: th })}
                                style={{
                                    padding: '0.4rem 1.2rem', borderRadius: '6px', border: `1.5px solid ${currentDesign.theme === th ? 'var(--accent-blue)' : 'var(--panel-border)'} `,
                                    background: currentDesign.theme === th ? 'rgba(59,130,246,0.15)' : 'var(--dim-bg)',
                                    color: currentDesign.theme === th ? 'var(--accent-blue)' : 'var(--text-muted)',
                                    cursor: 'pointer', fontWeight: currentDesign.theme === th ? 700 : 400, fontSize: 'var(--font-size-main)',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                                }}>
                                {th === 'dark' ? <><Moon size={16} /> {language === 'en' ? 'Dark' : 'ダーク'}</> : <><Sun size={16} /> {language === 'en' ? 'Light' : 'ライト'}</>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Font Family Selection */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <datalist id="font-options">
                        {FONT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        {localFonts.map(f => <option key={f} value={f} />)}
                    </datalist>

                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                            {language === 'en' ? 'Main Text Font' : '本文フォント'}
                        </label>
                        <input type="text" list="font-options" className="input"
                            style={{ width: '100%', padding: '0.4rem', fontSize: 'var(--font-size-main)' }}
                            value={localFontMain}
                            onChange={e => setLocalFontMain(e.target.value)}
                            onBlur={() => updateDesign({ fontFamilyMain: localFontMain })}
                            placeholder={language === 'en' ? 'Enter or select font name' : 'フォント名を入力または選択'}
                        />
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                            {language === 'en' ? 'Secondary Text Font' : '補助テキストフォント'}
                        </label>
                        <input type="text" list="font-options" className="input"
                            style={{ width: '100%', padding: '0.4rem', fontSize: 'var(--font-size-main)' }}
                            value={localFontSub}
                            onChange={e => setLocalFontSub(e.target.value)}
                            onBlur={() => updateDesign({ fontFamilySub: localFontSub })}
                            placeholder={language === 'en' ? 'Enter or select font name' : 'フォント名を入力または選択'}
                        />
                    </div>
                </div>

                {/* Manual Local Font Load Button */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <button className="btn btn-ghost" onClick={loadSystemFonts} style={{ padding: '0.4rem 1rem', fontSize: 'var(--font-size-sub)', border: '1px solid var(--panel-border)' }}>
                        <RefreshCw size={14} /> {language === 'en' ? 'Load system fonts to list (Requires Permission)' : 'PCのインストール済みフォントを候補に追加（権限要求）'}
                    </button>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)', marginTop: '0.4rem', marginLeft: '0.2rem' }}>
                        {language === 'en'
                            ? '* By allowing browser permissions, all fonts installed on your PC will be suggested. (Due to API limits, Japanese fonts may appear under English names like "Meiryo").'
                            : '※ブラウザのセキュリティ権限を許可することで、PC内のすべてのフォントがサジェスト表示されるようになります。（APIの仕様上、日本語フォントは「Meiryo」など英語名でリストアップされる場合があります）'}
                    </div>
                </div>

                {/* Font sizes */}
                <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                        {language === 'en' ? 'Main Text size: ' : '本文フォントサイズ: '}<span style={{ color: 'var(--accent-blue)' }}>{currentDesign.fontSizeMain}px</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', maxWidth: '350px' }}>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ fontSizeMain: Math.max(10, currentDesign.fontSizeMain - 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Minus size={14} /></button>
                        <input type="range" min={10} max={20} step={1}
                            value={currentDesign.fontSizeMain}
                            onChange={e => updateDesign({ fontSizeMain: parseInt(e.target.value) }, false)}
                            onBlur={() => updateDesign({}, true)}
                            style={{ flex: 1 }} />
                        <button className="btn btn-ghost" onClick={() => updateDesign({ fontSizeMain: Math.min(20, currentDesign.fontSizeMain + 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Plus size={14} /></button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{language === 'en' ? 'Card text, descriptions, etc. (Default: 14px)' : 'カード内テキスト、説明文など（デフォルト: 14px）'}</div>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                        {language === 'en' ? 'Secondary Text size: ' : '補助テキストフォントサイズ: '}<span style={{ color: 'var(--accent-blue)' }}>{currentDesign.fontSizeSub}px</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', maxWidth: '350px' }}>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ fontSizeSub: Math.max(9, currentDesign.fontSizeSub - 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Minus size={14} /></button>
                        <input type="range" min={9} max={16} step={1}
                            value={currentDesign.fontSizeSub}
                            onChange={e => updateDesign({ fontSizeSub: parseInt(e.target.value) }, false)}
                            onBlur={() => updateDesign({}, true)}
                            style={{ flex: 1 }} />
                        <button className="btn btn-ghost" onClick={() => updateDesign({ fontSizeSub: Math.min(16, currentDesign.fontSizeSub + 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Plus size={14} /></button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{language === 'en' ? 'Labels, ID displays, secondary info (Default: 12px)' : 'ラベル、ID表示、補足情報など（デフォルト: 12px）'}</div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.useWeaponIconsInTables ?? false}
                            onChange={e => updateDesign({ useWeaponIconsInTables: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Convert weapon types to icons in tables' : '表における武器種をアイコンに置き換える'}</strong><br />
                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                            {language === 'en' ? 'Replaces weapon text with icons in Criteria Creation Grid, Condition Cards, and Data Tab tables.' : '確保AF条件の作成画面や条件カードの基準表、およびデータタブの所持数表の武器種テキストをアイコンに置換します。'}
                        </span></span>
                    </label>
                </div>
                {/* ── ゲーム内UIタブ ── */}
                <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--panel-border)', marginBottom: '0.8rem' }}>
                    {language === 'en' ? '▸ In-Game UI Tab' : '▸ ゲーム内UIタブ'}
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                        {language === 'en' ? 'Grid Weapon Text size: ' : 'グリッド内武器種文字サイズ: '}<span style={{ color: 'var(--accent-blue)' }}>{currentDesign.gridWeaponFontSize ?? 19}px</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', maxWidth: '350px' }}>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ gridWeaponFontSize: Math.max(10, (currentDesign.gridWeaponFontSize ?? 19) - 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Minus size={14} /></button>
                        <input type="range" min={10} max={40} step={1}
                            value={currentDesign.gridWeaponFontSize ?? 19}
                            onChange={e => updateDesign({ gridWeaponFontSize: parseInt(e.target.value) }, false)}
                            onBlur={() => updateDesign({}, true)}
                            style={{ flex: 1 }} />
                        <button className="btn btn-ghost" onClick={() => updateDesign({ gridWeaponFontSize: Math.min(40, (currentDesign.gridWeaponFontSize ?? 19) + 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Plus size={14} /></button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{language === 'en' ? 'Weapon Kind characters in Grid (Default: 19px)' : 'カード中央に表示される武器種文字（デフォルト: 19px）'}</div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.useWeaponIcons ?? false}
                            onChange={e => updateDesign({ useWeaponIcons: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Display weapon type as icon in grid' : 'グリッド内武器種表示を武器アイコンにする'}</strong><br />
                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                            {language === 'en' ? 'Displays icons instead of text for weapon types (size links to the setting above).' : '文字の代わりに武器種別のアイコンを表示します（大きさは上記の設定に連動します）。'}
                        </span></span>
                    </label>
                    {currentDesign.useWeaponIcons && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginLeft: '2rem', marginTop: '0.8rem' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                                <input type="checkbox" style={{ marginTop: '3px' }}
                                    checked={currentDesign.useWeaponIconsWithText ?? false}
                                    onChange={e => updateDesign({ useWeaponIconsWithText: e.target.checked })} />
                                <span><strong>{language === 'en' ? 'Also display weapon text' : '武器種の文字も表示する'}</strong></span>
                            </label>
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.15)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'calc(var(--font-size-sub) * 1.05)', fontWeight: 500, color: 'var(--text-muted)' }}>{language === 'en' ? 'Status Label Colors' : 'グリッド内ステータス配色設定'}</span>
                        <button className="btn btn-ghost" 
                                onClick={() => {
                                    if (window.confirm(language === 'en' ? 'Restore status label colors to default?' : '配色設定をデフォルトに戻してもよろしいですか？')) {
                                        updateDesign({ statusColors: DEFAULT_DESIGN.statusColors });
                                    }
                                }}
                                style={{ fontSize: 'var(--font-size-sub)', padding: '0.3rem 0.6rem', border: '1px solid var(--panel-border)' }}>
                            <RotateCcw size={13} style={{ marginRight: '4px' }} />
                            {language === 'en' ? 'Restore Defaults' : 'デフォルトに戻す'}
                        </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {[
                            { key: 'fav', label: language === 'en' ? 'Fav' : 'お気に入り', text: 'Fav' },
                            { key: 'trash', label: language === 'en' ? 'Trash' : '不用品', text: 'Trash' },
                            { key: 'keep', label: language === 'en' ? 'Keep' : '確保提案', text: 'Keep' },
                            { key: 'discard', label: language === 'en' ? 'Discard' : '廃棄提案', text: language === 'en' ? 'Discard' : '廃棄' },
                            { key: 'conflict', label: language === 'en' ? 'Discard?' : 'お気に入りかつ廃棄提案', text: language === 'en' ? 'Discard?' : '廃棄？' }
                        ].map(({ key, label, text }) => {
                            const config = (currentDesign.statusColors as any)?.[key] || (DEFAULT_DESIGN.statusColors as any)[key];
                            return (
                                <div key={key} style={{ 
                                    display: 'flex', alignItems: 'center', gap: '0.8rem', 
                                    background: currentDesign.theme === 'light' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 17, 26, 0.4)', 
                                    padding: '0.2rem 0.6rem', borderRadius: '8px',
                                    border: currentDesign.theme === 'light' ? '1px solid var(--panel-border)' : 'none'
                                }}>
                                    <div style={{ 
                                        width: '60px', textAlign: 'center', fontSize: '11px', fontWeight: 600, 
                                        padding: '1px 0', borderRadius: '3px', 
                                        background: config.bg, 
                                        color: config.text === 'white' ? '#fff' : '#000',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                        flexShrink: 0
                                    }}>
                                        {text}
                                    </div>
                                    <span style={{ fontSize: 'var(--font-size-main)', fontWeight: 500, color: 'var(--text-main)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <input type="color" 
                                                   value={config.bg} 
                                                   onChange={e => updateDesign({ statusColors: { ...currentDesign.statusColors, [key]: { ...config, bg: e.target.value } } as any }, false)}
                                                   onBlur={() => updateDesign({}, true)}
                                                   style={{ width: '42px', height: '28px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                                        </div>
                                        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px' }}>
                                            <button onClick={() => updateDesign({ statusColors: { ...currentDesign.statusColors, [key]: { ...config, text: 'white' } } as any })}
                                                    style={{ 
                                                        padding: '4px 12px', fontSize: '11px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                                                        background: config.text === 'white' ? 'var(--accent-blue)' : 'transparent',
                                                        color: config.text === 'white' ? '#fff' : 'var(--text-muted)',
                                                        fontWeight: 600
                                                    }}>W</button>
                                            <button onClick={() => updateDesign({ statusColors: { ...currentDesign.statusColors, [key]: { ...config, text: 'black' } } as any })}
                                                    style={{ 
                                                        padding: '4px 12px', fontSize: '11px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                                                        background: config.text === 'black' ? 'var(--accent-blue)' : 'transparent',
                                                        color: config.text === 'black' ? '#fff' : 'var(--text-muted)',
                                                        fontWeight: 600
                                                    }}>B</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.gridDetailNoMaxHeight ?? false}
                            onChange={e => updateDesign({ gridDetailNoMaxHeight: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Disable Max Height on In-Game UI details pane' : '上部詳細の縦幅制限をなくす'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'When ON, the detail pane will expand fully without a scrollbar.' : 'ONにするとスクロールバーが出なくなり、スキル等すべてが一度に表示されるようになります。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.detailSkillNoWrap ?? false}
                            onChange={e => updateDesign({ detailSkillNoWrap: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Prevent skill name wrapping in Detail View' : '詳細でスキル名を折り返さない'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'When ON, long skill names stay on one line (may require scrolling).' : 'ONにするとスキル名が長くて途切れる場合でも折り返さず1行で表示されます。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.markFavoriteNoKeep ?? false}
                            onChange={e => updateDesign({ markFavoriteNoKeep: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Display unlock mark on Grid cards for locked AFs without keep flag' : 'お気に入り＆確保フラグなしAFに解錠マークを表示する'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'When ON, displays an unlock suggestion mark on the top right.' : 'ONにすると、グリッド内AFカード右上にお気に入り解除推奨の目印を表示します。'}</span></span>
                    </label>
                    {currentDesign.markFavoriteNoKeep && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginLeft: '2rem' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                                <input type="checkbox" style={{ marginTop: '3px' }}
                                    checked={currentDesign.hideFavoriteNoKeepIfMemo ?? false}
                                    onChange={e => updateDesign({ hideFavoriteNoKeepIfMemo: e.target.checked })} />
                                <span><strong>{language === 'en' ? 'Hide mark if memo exists' : 'メモがある場合はマークを隠す'}</strong></span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                                <input type="checkbox" style={{ marginTop: '3px' }}
                                    checked={currentDesign.hideFavoriteNoKeepIfEquipped ?? true}
                                    onChange={e => updateDesign({ hideFavoriteNoKeepIfEquipped: e.target.checked })} />
                                <span><strong>{language === 'en' ? 'Hide mark if equipped' : '装備中キャラがいる場合はマークを隠す'}</strong></span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                                <input type="checkbox" style={{ marginTop: '3px' }}
                                    checked={currentDesign.hideFavoriteNoKeepIfQuirky ?? true}
                                    onChange={e => updateDesign({ hideFavoriteNoKeepIfQuirky: e.target.checked })} />
                                <span><strong>{language === 'en' ? 'Hide mark for Quirky Artifacts' : 'クァーキー・アーティファクトにはマークを隠す'}</strong></span>
                            </label>
                        </div>
                    )}
                </div>

                {/* ── 確保AF条件タブ ── */}
                <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--panel-border)', marginBottom: '0.8rem' }}>
                    {language === 'en' ? '▸ Keep AF Conditions Tab' : '▸ 確保AF条件タブ'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.showCriteriaMethodBadge ?? true}
                            onChange={e => updateDesign({ showCriteriaMethodBadge: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Show Method Type badge on Condition Cards' : '条件カードに確保方法を表示する'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'When ON, shows whether the condition uses Skill-Oriented or Character-Oriented method.' : 'ONにすると、スキル指向/キャラ指向のバッジを条件カードに表示します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.showCriteriaSkillBadge ?? true}
                            onChange={e => updateDesign({ showCriteriaSkillBadge: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Show Target Skill badge on Condition Cards' : '条件カードに対象スキルを表示する'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'When ON, a representative target skill name badge is shown on each condition card summary.' : 'ONにすると、条件カードの要約行に代表的な対象スキル名をバッジ表示します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.useLegacyM1Grid ?? false}
                            onChange={e => updateDesign({ useLegacyM1Grid: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Restore old UI for Method 1 quantity settings' : '方法1の確保個数の設定UIを旧仕様に戻す'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'When ON, the original block-style UI for element x weapon kind is used.' : 'ONにすると、属性×武器種の入力に旧来のブロック形式を使用します。'}</span></span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                        <div style={{ width: '13px', marginTop: '3px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.1rem', userSelect: 'none' }}>・</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.2rem' }}>
                                <span style={{ fontSize: 'var(--font-size-main)', fontWeight: 600, color: 'var(--text-main)' }}>
                                    {language === 'en' ? 'Criteria Detail Table Threshold' : '確保条件詳細のテーブル切替しきい値'}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <input type="number" min="1" max="60"
                                        value={currentDesign.criteriaDetailTableThreshold}
                                        onChange={e => updateDesign({ criteriaDetailTableThreshold: parseInt(e.target.value) || 5 })}
                                        style={{ width: '75px', padding: '0.2rem 0.4rem', fontSize: 'var(--font-size-main)', background: 'var(--dim-bg)', border: '1px solid var(--panel-border)', borderRadius: '4px', color: 'var(--text-main)', textAlign: 'center' }}
                                    />
                                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                                        {language === 'en' ? 'items' : '種類以上'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                {language === 'en' 
                                    ? 'Automatically switches the detail view to a table format when the number of target types reaches this value.' 
                                    : '確保対象の種類数（属性×武器種の組み合わせ）がこの値以上になると、詳細表示がテーブル形式に自動で切り替わります。'}
                            </div>
                        </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.swapCriteriaDetailGrid ?? false}
                            onChange={e => updateDesign({ swapCriteriaDetailGrid: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Swap Rows/Cols in Criteria Details (Match Method 1)' : '確保条件詳細の行と列を入れ替える（作成方法1に合わせる）'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Aligns the detail table with the creation grid (Rows: Element, Cols: Weapon Kind).' : '詳細表示の表を、作成方法1と同じ「行：属性 / 列：武器種」の構成に変更します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={currentDesign.dimCompletedCriteriaCells ?? true}
                            onChange={e => updateDesign({ dimCompletedCriteriaCells: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Change display of collected items' : '収集済み項目の表示を変更する'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'In Method 1 detail view, mark items with completed target count with a checkmark and dim them.' : '方法1の詳細表示で、目標数の確保が完了している項目にチェックマークを付け暗く表示します。'}</span></span>
                    </label>
                </div>

                <button className="btn btn-ghost" 
                    onClick={() => {
                        if (window.confirm(language === 'en' ? 'Restore ALL design settings to default?' : 'すべてのデザイン設定をデフォルトに戻してもよろしいですか？')) {
                            resetDesign();
                        }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--panel-border)', fontSize: 'var(--font-size-main)' }}>
                    <RefreshCw size={15} /> {language === 'en' ? 'Restore Defaults' : 'デフォルトに戻す'}
                </button>
                <p style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {language === 'en' ? '* UI changes apply immediately (No need to save).' : '※デザイン設定は即座に反映されます（「設定を保存」は不要です）'}
                </p>
            </div>

            {/* ── Notification Settings ────────────────────────── */}
            <div id="notification-settings" className="glass-panel" style={{ padding: '2rem', borderColor: 'var(--dim-border)', marginBottom: '1.5rem', scrollMarginTop: '2rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bell size={18} /> {language === 'en' ? 'Notification Settings' : '通知設定'}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-main)', fontWeight: 600 }}>
                                {language === 'en' ? 'Display Duration (seconds)' : '通知表示時間（秒）'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {language === 'en' ? 'How long each notification stays on screen.' : '各通知が画面に表示される秒数です。'}
                            </div>
                        </div>
                        <input
                            type="number"
                            className="input"
                            min={1}
                            max={60}
                            style={{ width: '80px', padding: '0.3rem 0.5rem', flexShrink: 0 }}
                            value={settings.notificationDuration ?? 3}
                            onChange={async e => {
                                const val = Math.max(1, Math.min(60, parseInt(e.target.value) || 3));
                                const newSettings = { ...settings, notificationDuration: val };
                                setSettings(newSettings);
                                const latest = await db.settings.get('global');
                                db.settings.put({ ...(latest ?? settings), notificationDuration: val }).catch(console.error);
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-main)', fontWeight: 600 }}>
                                {language === 'en' ? 'Max Simultaneous Notifications' : '最大同時表示件数'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {language === 'en' ? 'When exceeded, the oldest notification is hidden first.' : '超過した場合、古い通知から順に非表示になります。'}
                            </div>
                        </div>
                        <input
                            type="number"
                            className="input"
                            min={1}
                            max={10}
                            style={{ width: '80px', padding: '0.3rem 0.5rem', flexShrink: 0 }}
                            value={settings.notificationMaxCount ?? 1}
                            onChange={async e => {
                                const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                                const newSettings = { ...settings, notificationMaxCount: val };
                                setSettings(newSettings);
                                const latest = await db.settings.get('global');
                                db.settings.put({ ...(latest ?? settings), notificationMaxCount: val }).catch(console.error);
                            }}
                        />
                    </div>
                </div>

                <p style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '1rem' }}>
                    {language === 'en' ? '* Changes apply immediately (No need to save).' : '※通知設定は即座に反映されます（「設定を保存」は不要です）'}
                </p>
            </div>

            {/* ── Performance Settings ─────────────────────────── */}
            <div id="performance-settings" className="glass-panel" style={{ padding: '2rem', borderColor: 'var(--dim-border)', marginBottom: '1.5rem', scrollMarginTop: '2rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={18} /> {language === 'en' ? 'Performance Settings' : '軽量化・パフォーマンス設定'}
                </h3>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer', fontSize: 'var(--font-size-main)', fontWeight: 600 }}>
                        <input type="checkbox" style={{ marginTop: '4px' }}
                            checked={currentDesign.enableTabPersistence ?? true}
                            onChange={e => updateDesign({ enableTabPersistence: e.target.checked })} />
                        <span>
                            {language === 'en' ? 'Preserve Tab State & Scroll Position' : '各タブの「状態」と「スクロール位置」を維持する'}
                            <br />
                            <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', fontWeight: 400, display: 'inline-block', marginTop: '0.3rem', lineHeight: 1.5 }}>
                                {language === 'en'
                                    ? <>When ON, switching between tabs preserves your search criteria and scroll positions.<br />When OFF, switching tabs resets them to their initial state.<br /><span style={{ color: 'var(--accent-blue)' }}>* ON is recommended, but turn OFF if you experience memory issues or lag on older PCs.</span></>
                                    : <>ONの場合、別のタブを開いても以前のタブの検索条件やスクロール位置がそのまま残ります。<br />OFFにするとタブ移動のたびに画面（表示件数や条件指定など）が初期状態にリセットされます。<br /><span style={{ color: 'var(--accent-blue)' }}>※ONを推奨しますが、旧PC等でメモリ不足や動作の重さを感じる場合はOFFにしてください。</span></>}
                            </span>
                        </span>
                    </label>
                </div>
            </div>

            {/* ── Advanced Settings (Port) ─────────────────────── */}
            <div id="advanced-settings" className="glass-panel" style={{ padding: '2rem', borderColor: 'var(--dim-border)', marginBottom: '1.5rem', scrollMarginTop: '2rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MonitorUp size={18} /> {language === 'en' ? 'Desktop App Advanced Settings' : 'デスクトップアプリ版 上級者設定'}
                </h3>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer', fontSize: 'var(--font-size-main)', fontWeight: 600 }}>
                        <input type="checkbox" style={{ marginTop: '4px' }}
                            checked={settings.saveWindowState ?? true}
                            onChange={async e => {
                                const enabled = e.target.checked;
                                const newSettings = { ...settings, saveWindowState: enabled };
                                setSettings(newSettings);
                                const latest = await db.settings.get('global');
                                db.settings.put({ ...(latest ?? settings), saveWindowState: enabled }).catch(console.error);
                                // バックエンド側の設定ファイルも更新（次回起動時に反映）
                                invoke('set_window_state_enabled', { enabled }).catch(console.error);
                            }} />
                        <span>
                            {language === 'en' ? 'Save Window Size and Position' : 'ウィンドウのサイズと位置を保存・復元する'}
                            <br />
                            <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', fontWeight: 400, display: 'inline-block', marginTop: '0.3rem', lineHeight: 1.5 }}>
                                {language === 'en'
                                    ? 'When ON, the application will remember its size and position when reopened.'
                                    : 'ONの場合、次回アプリ起動時に前回終了時のウィンドウサイズと位置を自動で再現します。'}
                            </span>
                        </span>
                    </label>
                </div>

                <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    {language === 'en' ? 'AF Collector Receive Port Number' : 'AF Collector 受信ポート番号'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.6rem' }}>
                    <input type="number" className="input"
                        style={{ width: '100px' }}
                        min={1024} max={65535}
                        value={settings.httpPort ?? 1422}
                        onChange={e => updateSettings({ ...settings, httpPort: parseInt(e.target.value) || 1422 })}
                    />
                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? '(Default: 1422)' : '（デフォルト: 1422）'}</span>
                </div>
                <p style={{ fontSize: 'var(--font-size-sub)', color: '#f59e0b', marginBottom: '0.6rem' }}>
                    {language === 'en' ? '⚠ Restart the Desktop Application after saving to apply port changes.' : '⚠ 変更を反映するにはアプリ設定を保存後、デスクトップアプリ版を再起動してください。'}
                </p>
                <details style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                    <summary style={{ cursor: 'pointer', marginBottom: '0.4rem' }}>{language === 'en' ? '🔧 What is a port?' : '🔧 ポートとは？'}</summary>
                    <p style={{ marginTop: '0.4rem', lineHeight: 1.6 }}>
                        {language === 'en'
                            ? <>A Port is an "entryway" number through which apps communicate on your computer.<br />The GBF AF Manager Desktop App "listens" for data on this port when started,<br />and the AF Collector Chrome Extension sends data to this port.<br />Only change this if it conflicts with another application's port number.</>
                            : <>ポート（Port）とは、コンピュータ内でアプリ同士が通信するための「窓口番号」です。<br />GBF AF Managerアプリ（デスクトップ版）は起動時にこの番号で通信待受を開始し、<br />ブラウザ拡張機能（AF Collector）がこの番号宛てにデータを送信します。<br />別のアプリと番号が被る（ポート競合）場合のみ変更してください。</>}
                    </p>
                </details>
            </div>

            {/* Data Management (Moved here per G2) */}
            <div id="data-settings" className="glass-panel" style={{ padding: '2rem', borderColor: 'rgba(239, 68, 68, 0.2)', scrollMarginTop: '2rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <HardDrive size={18} /> {language === 'en' ? 'Backup & Restore' : 'バックアップ・復元'}
                </h3>

                <p style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    {language === 'en' ? 'Regular backups are recommended to prevent data loss from browser cache clears.' : 'ブラウザのキャッシュクリア等でデータが消えないよう、定期的なバックアップを推奨します。'}
                </p>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sub)' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', borderBottom: '1px solid var(--panel-border)', fontWeight: 600 }}>
                                {language === 'en' ? 'Data Type' : 'データ項目'}
                            </th>
                            <th style={{ textAlign: 'center', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', borderBottom: '1px solid var(--panel-border)', fontWeight: 600 }}>
                                {language === 'en' ? 'Export' : 'エクスポート'}
                            </th>
                            <th style={{ textAlign: 'center', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', borderBottom: '1px solid var(--panel-border)', fontWeight: 600 }}>
                                {language === 'en' ? 'Import' : 'インポート'}
                            </th>
                            <th style={{ textAlign: 'center', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 16px', borderBottom: '1px solid var(--panel-border)', fontWeight: 600 }}>
                                {language === 'en' ? 'Reset' : 'リセット'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* ALL DATA */}
                        <tr style={{ background: 'rgba(59, 130, 246, 0.03)' }}>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(59, 130, 246, 0.15)', fontWeight: 600 }}>
                                {language === 'en' ? 'All Backup Data' : 'すべてのバックアップデータ'}
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(59, 130, 246, 0.15)', textAlign: 'center' }}>
                                <button className="btn btn-calc-glow" onClick={async () => { await exportDatabase(language); showToast(language === 'en' ? 'All data exported successfully.' : '全データのエクスポートが完了しました。', 'success'); }} style={{ minWidth: '120px' }}>
                                    <Download size={16} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Export' : 'エクスポート'}</span>
                                </button>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(59, 130, 246, 0.15)', textAlign: 'center' }}>
                                <button className="btn btn-calc-glow" onClick={handleImportClick} style={{ minWidth: '120px' }}>
                                    <Upload size={16} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Import' : 'インポート'}</span>
                                </button>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(59, 130, 246, 0.15)', textAlign: 'center' }}>
                                <button className="btn btn-danger" onClick={handleClearAll} style={{ minWidth: '120px' }}>
                                    <Trash2 size={16} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Clear All' : 'すべて削除'}</span>
                                </button>
                            </td>
                        </tr>

                        {/* Criteria */}
                        <tr>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                {language === 'en' ? 'Criteria' : '確保条件'}
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }}>
                                <button className="btn btn-ghost" onClick={async () => { await exportConditions(language); showToast(language === 'en' ? 'Criteria exported successfully.' : '条件データのエクスポートが完了しました。', 'success'); }} style={{ minWidth: '120px', border: '1px solid var(--panel-border)' }}>
                                    <Download size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Export' : 'エクスポート'}</span>
                                </button>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }}>
                                <button className="btn btn-ghost" onClick={handleImportConditionsClick} style={{ minWidth: '120px', border: '1px solid var(--panel-border)' }}>
                                    <Upload size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Import' : 'インポート'}</span>
                                </button>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }}>
                                <button className="btn btn-danger" onClick={handleClearConditionsOnly} style={{ minWidth: '120px' }}>
                                    <Trash2 size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Delete' : '条件削除'}</span>
                                </button>
                            </td>
                        </tr>

                        {/* Memos */}
                        <tr>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                {language === 'en' ? 'Memos' : 'AF詳細メモ'}
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }}>
                                <button className="btn btn-ghost" onClick={async () => { await exportMemos(language); showToast(language === 'en' ? 'Memos exported successfully.' : 'AF詳細メモのエクスポートが完了しました。', 'success'); }} style={{ minWidth: '120px', border: '1px solid var(--panel-border)' }}>
                                    <Download size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Export' : 'エクスポート'}</span>
                                </button>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }}>
                                <button className="btn btn-ghost" onClick={handleImportMemosClick} style={{ minWidth: '120px', border: '1px solid var(--panel-border)' }}>
                                    <Upload size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Import' : 'インポート'}</span>
                                </button>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }}>
                                <button className="btn btn-danger" onClick={handleClearMemosOnly} style={{ minWidth: '120px' }}>
                                    <Trash2 size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Delete' : 'メモ削除'}</span>
                                </button>
                            </td>
                        </tr>

                        {/* Formula */}
                        <tr>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                {language === 'en' ? 'Evaluation Formula' : '評価計算式'}
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }}>
                                <button className="btn btn-ghost" onClick={async () => { await handleExportCalcSettings(); showToast(language === 'en' ? 'Evaluation formula exported successfully.' : '評価計算式のエクスポートが完了しました。', 'success'); }} style={{ minWidth: '120px', border: '1px solid var(--panel-border)' }}>
                                    <Download size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Export' : 'エクスポート'}</span>
                                </button>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }}>
                                <button className="btn btn-ghost" onClick={handleImportCalcSettings} style={{ minWidth: '120px', border: '1px solid var(--panel-border)' }}>
                                    <Upload size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Import' : 'インポート'}</span>
                                </button>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)' }}>
                                -
                            </td>
                        </tr>

                        {/* Inventory */}
                        <tr>
                            <td style={{ padding: '10px 16px' }}>
                                {language === 'en' ? 'Artifact Inventory' : '所持AFデータ'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)' }}>
                                -
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)' }}>
                                -
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <button className="btn btn-danger" onClick={handleClearArtifactsOnly} style={{ minWidth: '120px' }}>
                                    <Trash2 size={15} /> <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>{language === 'en' ? 'Delete' : 'データ削除'}</span>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '2rem', padding: '1rem', borderTop: '1px solid var(--panel-border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>
                <p style={{ margin: '0 0 0.5rem 0' }}>{language === 'en' ? 'Credits & Open Source Licenses' : 'クレジット・オープンソースライセンス'}</p>
                <p style={{ margin: 0 }}>UI Icons by Lucide Contributors (ISC License) / Weapon Icons based on FontAwesome Free (CC BY 4.0)</p>
            </div>
        </div>
    );
}
