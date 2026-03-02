import { db } from '../db';

export async function exportDatabase() {
    const artifacts = await db.artifacts.toArray();
    const memos = await db.memos.toArray();
    const conditions = await db.conditions.toArray();
    const settings = await db.settings.toArray();

    const data = JSON.stringify({ artifacts, memos, conditions, settings });
    downloadJson(data, `af_manager_backup_${today()}.json`);
}

export async function importDatabase(jsonString: string) {
    const data = JSON.parse(jsonString);
    if (data.artifacts) await db.artifacts.bulkPut(data.artifacts);
    if (data.memos) await db.memos.bulkPut(data.memos);
    if (data.conditions) await db.conditions.bulkPut(data.conditions);
    if (data.settings) await db.settings.bulkPut(data.settings);
}

/** Export only the memos table */
export async function exportMemos() {
    const memos = await db.memos.toArray();
    const data = JSON.stringify({ memos });
    downloadJson(data, `af_memos_${today()}.json`);
}

/** Import (merge/overwrite) only memos */
export async function importMemos(jsonString: string) {
    const data = JSON.parse(jsonString);
    if (!data.memos || !Array.isArray(data.memos)) {
        throw new Error('Memos data not found. Please check the file. / memos データが見つかりません。正しいファイルか確認してください。');
    }
    await db.memos.bulkPut(data.memos);
}

/** Export only the conditions table */
export async function exportConditions() {
    const conditions = await db.conditions.toArray();
    const data = JSON.stringify({ conditions });
    downloadJson(data, `af_conditions_${today()}.json`);
}

/** Import (merge/overwrite) only conditions */
export async function importConditions(jsonString: string) {
    const data = JSON.parse(jsonString);
    if (!data.conditions || !Array.isArray(data.conditions)) {
        throw new Error('Conditions data not found. Please check the file. / conditions データが見つかりません。正しいファイルか確認してください。');
    }
    await db.conditions.bulkPut(data.conditions);
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
