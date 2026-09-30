import { db } from '../db';
import type { AppArtifact, Condition, UpgradeLogEntry } from '../types';

/**
 * 確保フラグ計算の直前に呼ぶ。
 * 現在DBにある keepFlag=true のAFをスナップショットとして退避する。
 *
 * triggerType が 'manual' の場合、既に 'import' 由来のスナップショットが
 * 存在するときは上書きしない（インポート直後に手動計算しても比較元が正しく保たれる）。
 */
export async function saveKeepFlagSnapshot(
    triggerType: 'import' | 'manual'
): Promise<void> {
    try {
        // manual 呼び出し時: import 由来のスナップショットが残っていれば上書きしない
        if (triggerType === 'manual') {
            const existing = await db.keepFlagSnapshot.get('latest');
            if (existing?.triggerType === 'import') return;
        }

        const all = await db.artifacts.toArray();
        const kept = all.filter(a => !!a.keepFlag);
        await db.keepFlagSnapshot.put({
            id: 'latest',
            timestamp: new Date().toISOString(),
            triggerType,
            keptArtifacts: kept,
        });
    } catch (e) {
        console.error('[upgradeLogger] saveKeepFlagSnapshot failed', e);
    }
}

/**
 * 確保フラグ計算の直後に呼ぶ。
 * スナップショットと新しい確保AFを比較し差分があればログに保存する。
 * スナップショットが存在しない場合は何もしない。
 */
export async function generateUpgradeLog(
    newKeptArtifacts: AppArtifact[],
    conditions: Condition[]
): Promise<void> {
    try {
        const snapshot = await db.keepFlagSnapshot.get('latest');
        if (!snapshot) return;

        const condMap = new Map(conditions.map(c => [c.id, c]));

        // グルーピングキー生成:
        //   方法1 → condId__attribute__kind
        //   方法2 → condId__characterName（武器種をまたいでキャラ単位でまとめる）
        const groupKey = (a: AppArtifact, condId: string): string => {
            const cond = condMap.get(condId);
            if (cond?.methodType === 2) {
                return `${condId}__char__${cond.characterName || '__unknown__'}`;
            }
            return `${condId}__${a.attribute}__${a.kind}`;
        };

        // 旧: スナップショット -> グループキー -> AF[]
        const oldMap = new Map<string, AppArtifact[]>();
        for (const a of snapshot.keptArtifacts) {
            const condId = a.keepFlag ?? '__unknown__';
            const key = groupKey(a, condId);
            if (!oldMap.has(key)) oldMap.set(key, []);
            oldMap.get(key)!.push(a);
        }

        // 新: 計算後 -> グループキー -> AF[]
        const newMap = new Map<string, AppArtifact[]>();
        for (const a of newKeptArtifacts) {
            const condId = a.keepFlag ?? '__unknown__';
            const key = groupKey(a, condId);
            if (!newMap.has(key)) newMap.set(key, []);
            newMap.get(key)!.push(a);
        }

        const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);

        const entries: UpgradeLogEntry[] = [];
        for (const key of allKeys) {
            const oldList = oldMap.get(key) ?? [];
            const newList = newMap.get(key) ?? [];

            const oldIds = new Set(oldList.map(a => a.id));
            const newIds = new Set(newList.map(a => a.id));
            const same =
                oldIds.size === newIds.size &&
                [...oldIds].every(id => newIds.has(id));
            if (same) continue;

            // キーを分解
            const parts = key.split('__');
            const condId = parts[0];
            const isCharKey = parts[1] === 'char';
            const cond = condMap.get(condId);

            // attribute/weaponKindは方法1のみ意味がある。方法2はリストから取得
            let attribute = '';
            let weaponKind = '';
            if (!isCharKey) {
                attribute = parts[1] ?? '';
                weaponKind = parts[2] ?? '';
            } else {
                // 方法2: 実際のAFから代表的な属性を取得（表示用）
                const sample = newList[0] || oldList[0];
                attribute = sample?.attribute ?? '';
                weaponKind = sample?.kind ?? '';
            }

            entries.push({
                conditionId: condId,
                conditionName: cond?.name ?? condId,
                priority: cond?.priority ?? 9999,
                attribute,
                weaponKind,
                oldArtifacts: oldList,
                newArtifacts: newList,
                methodType: cond?.methodType,
                characterName: isCharKey ? (cond?.characterName || '') : undefined,
            });
        }

        if (entries.length === 0) {
            await db.keepFlagSnapshot.delete('latest');
            return;
        }

        entries.sort((a, b) => a.priority - b.priority);

        await db.upgradeLogs.add({
            timestamp: snapshot.timestamp,
            triggerType: snapshot.triggerType,
            entries,
        });

        // 上限件数を超えた古いログを削除
        const settings = await db.settings.get('global');
        const maxCount = settings?.upgradeLogMaxCount ?? 20;
        const allLogs = await db.upgradeLogs.orderBy('timestamp').toArray();
        if (allLogs.length > maxCount) {
            const toDelete = allLogs.slice(0, allLogs.length - maxCount);
            await db.upgradeLogs.bulkDelete(toDelete.map(l => l.id!));
        }

        await db.keepFlagSnapshot.delete('latest');
    } catch (e) {
        console.error('[upgradeLogger] generateUpgradeLog failed', e);
    }
}
