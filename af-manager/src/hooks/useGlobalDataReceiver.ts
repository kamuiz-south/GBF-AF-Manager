import { useEffect, useRef } from 'react';
import { db } from '../db';
import { evaluateArtifact } from '../utils/evaluator';
import { runCriteriaMatcher } from '../utils/matcher';
import { runDiscardCalc } from '../utils/discardCalc';
import { alertUnnecessaryKeeps } from '../utils/alertUnnecessaryKeeps';
import { saveKeepFlagSnapshot, generateUpgradeLog } from '../utils/upgradeLogger';
import type { Settings } from '../types';
import { useTranslation } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { MAX_AF_INVENTORY } from '../constants';

const DEFAULT_SETTINGS: Settings = {
    id: 'global',
    evaluationFormula: { group1Multiplier: 1, group2Multiplier: 1, group3Multiplier: 1, skillMultipliers: {}, qualityValues: {}, exceptions: [] },
    discardBehavior: { treatUnnecessaryAsDiscard: true, targetInventoryCount: MAX_AF_INVENTORY, protectLocked: true, protectKeepFlag: true, protectRareAF: true, protectEquipped: true },
};

const getSettings = async (): Promise<Settings> => {
    let s = await db.settings.get('global');
    if (!s) { s = DEFAULT_SETTINGS; await db.settings.put(s); }
    return s;
};

const recordImportTimestamp = async () => {
    const s = await db.settings.get('global') || DEFAULT_SETTINGS;
    await db.settings.put({ ...s, lastImportedAt: new Date().toISOString() });
};

export function useCollectorImport() {
    const { language } = useTranslation();
    const showToast = useAppStore(state => state.showToast);

    const importCollectorJson = async (json: any) => {
        const artifacts = json.artifacts;
        if (!Array.isArray(artifacts) || artifacts.length === 0) {
            throw new Error('artifacts フィールドが空です。');
        }
        const settings = await getSettings();
        const totalArtifacts = await db.artifacts.count();

        const newItems = artifacts.map((item: any) => ({
            ...item,
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

        await saveKeepFlagSnapshot('import');
        await db.artifacts.clear();
        await db.artifacts.bulkPut(newItems);
        await recordImportTimestamp();

        const autoKeep = settings.autoFlagUpdate?.keepFlag ?? false;
        const autoDiscard = settings.autoFlagUpdate?.discardFlag ?? false;

        if (!autoKeep && !autoDiscard) {
            showToast(language === 'en' ? `✅ Imported ${newItems.length} artifacts (${json.total_pages} pages). Please run the Keep condition calculations next.` : `✅ ${newItems.length}件のAFを取り込みました（${json.total_pages}ページ分）。確保フラグ計算を実行してください。`, 'success');
            return;
        }

        showToast(language === 'en' ? 'AF data imported. Running Auto Flag Update...' : 'AFデータ取り込み完了。自動フラグ更新を実施します。', 'info');

        if (autoKeep) {
            const conditions = await db.conditions.toArray();
            const allItems = await db.artifacts.toArray();
            const updated = runCriteriaMatcher(allItems, conditions);
            await db.artifacts.bulkPut(updated);
            const keptCount = updated.filter((a: any) => a.keepFlag).length;
            showToast(language === 'en' ? `Calculation complete.\nKept: ${keptCount} item(s)` : `確保フラグの一括計算が完了しました。\n確保対象: ${keptCount}件`, 'success');
            await generateUpgradeLog(updated.filter((a: any) => !!a.keepFlag), conditions);
        }

        if (autoDiscard) {
            const discardMsg = await runDiscardCalc(settings, language);
            showToast(discardMsg, 'info');
        }

        showToast(language === 'en' ? 'Auto Flag Update completed.' : '自動フラグ更新が完了しました。', 'success');

        if (autoKeep) {
            await alertUnnecessaryKeeps(language);
        }
    };

    return { importCollectorJson };
}

export function useGlobalDataReceiver() {
    const { language } = useTranslation();
    const showToast = useAppStore(state => state.showToast);
    const { importCollectorJson } = useCollectorImport();
    
    // 最新のコールバックをrefで保持（依存配列の変更による頻繁な再登録を防ぐ）
    const importFnRef = useRef(importCollectorJson);
    useEffect(() => {
        importFnRef.current = importCollectorJson;
    }, [importCollectorJson]);

    // Phase 2: AF Collector 拡張機能からの直接送信を受け取る
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type !== 'AF_COLLECTOR_PUSH') return;
            const json = event.data.payload;
            if (!json?.af_collector) return;
            importFnRef.current(json).catch((e: any) => {
                if (e?.message !== '取り込みをキャンセルしました。' && e?.message !== 'Import canceled.') {
                    showToast(e?.message || (language === 'en' ? 'Import failed' : '取り込みに失敗しました'), 'error');
                }
            });
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [language, showToast]);

    // Phase 3: Tauri デスクトップアプリ経由でのイベントを受け取る
    useEffect(() => {
        let unlistenPromise: Promise<() => void> | null = null;
        
        (async () => {
            try {
                const { listen } = await import('@tauri-apps/api/event');
                unlistenPromise = listen<any>('af-data-received', (event) => {
                    const json = event.payload;
                    if (!json?.af_collector) return;
                    importFnRef.current(json).catch((e: any) => {
                        if (e?.message !== '取り込みをキャンセルしました。' && e?.message !== 'Import canceled.') {
                            showToast(e?.message || (language === 'en' ? 'Import failed' : '取り込みに失敗しました'), 'error');
                        }
                    });
                });
            } catch (_) {
                // Tauri環境外ではスキップ
            }
        })();
        
        return () => {
            if (unlistenPromise) {
                unlistenPromise.then(unlisten => unlisten());
            }
        };
    }, [language, showToast]);
}
