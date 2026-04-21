import { db } from '../db';

export async function exportDatabase(language?: 'ja' | 'en') {
    const artifacts = await db.artifacts.toArray();
    const memos = await db.memos.toArray();
    const conditions = await db.conditions.toArray();
    const groups = await db.groups?.toArray() ?? [];
    const settings = await db.settings.toArray();

    const data = JSON.stringify({ artifacts, memos, conditions, groups, settings }, null, 2);
    const prefix = language === 'ja' ? 'AFマネージャー_全データバックアップ_' : 'AF_Manager_FullBackup_';
    downloadJson(data, `${prefix}${today()}.json`);
}

export async function importDatabase(jsonString: string) {
    const data = JSON.parse(jsonString);
    // Use transaction to ensure UI observers (CriteriaTab) don't see inconsistent state (conditions without their groups)
    await db.transaction('rw', [db.artifacts, db.memos, db.conditions, db.groups, db.settings], async () => {
        if (data.artifacts) await db.artifacts.bulkPut(data.artifacts);
        if (data.memos) await db.memos.bulkPut(data.memos);
        if (data.conditions) await db.conditions.bulkPut(data.conditions);
        if (data.groups && db.groups) await db.groups.bulkPut(data.groups);
        if (data.settings) await db.settings.bulkPut(data.settings);
    });
}

/** Export only the memos table */
export async function exportMemos(language?: 'ja' | 'en') {
    const memos = await db.memos.toArray();
    const data = JSON.stringify({ memos }, null, 2);
    const prefix = language === 'ja' ? 'AFメモバックアップ_' : 'AF_Memos_Backup_';
    downloadJson(data, `${prefix}${today()}.json`);
}

/** Import (merge/overwrite) only memos */
export async function importMemos(jsonString: string) {
    const data = JSON.parse(jsonString);
    if (!data.memos || !Array.isArray(data.memos)) {
        throw new Error('Memos data not found. Please check the file. / memos データが見つかりません。正しいファイルか確認してください。');
    }
    await db.transaction('rw', db.memos, async () => {
        await db.memos.bulkPut(data.memos);
    });
}

/** Export only the conditions table */
export async function exportConditions(language?: 'ja' | 'en') {
    const conditions = await db.conditions.toArray();
    const groups = await db.groups?.toArray() ?? [];
    const data = JSON.stringify({ conditions, groups }, null, 2);
    const prefix = language === 'ja' ? '確保AF条件バックアップ_' : 'AF_Conditions_Backup_';
    downloadJson(data, `${prefix}${today()}.json`);
}

/** Import (merge/overwrite) only conditions */
export async function importConditions(jsonString: string) {
    const data = JSON.parse(jsonString);
    if (!data.conditions || !Array.isArray(data.conditions)) {
        throw new Error('Conditions data not found. Please check the file. / conditions データが見つかりません。正しいファイルか確認してください。');
    }
    // Transactional update to prevent self-healing logic in UI from resetting folder assignments
    await db.transaction('rw', [db.conditions, db.groups], async () => {
        await db.conditions.bulkPut(data.conditions);
        if (data.groups && Array.isArray(data.groups) && db.groups) {
            await db.groups.bulkPut(data.groups);
        }
    });
}

// ---- helpers ----
function downloadJson(data: string, filename: string) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function today() {
    return new Date().toISOString().split('T')[0];
}
