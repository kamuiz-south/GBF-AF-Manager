import { db } from '../db';
import type { Settings } from '../types';
import { evaluateArtifact, isRareArtifact } from './evaluator';

/**
 * Runs the full discard-flag calculation:
 *   1. Re-evaluates all artifact scores with current settings
 *   2. Resets all discard flags
 *   3. Classifies AFs as: protected / unnecessaryForDiscard / unprotected
 *   4. Flags the lowest-scoring unprotected AFs as discard candidates
 *   5. Saves to DB and alerts the user
 *
 * Call this from both the sidebar button (App.tsx) and the Settings tab button.
 * When adding new protection options, update ONLY this file.
 */
export async function runDiscardCalc(settings: Settings, language: string = 'ja'): Promise<string> {
    const artifacts = await db.artifacts.toArray();
    const memos = await db.memos.toArray();
    const memoIds = new Set(memos.filter(m => m.memo && m.memo.trim() !== '').map(m => m.id));
    const b = settings.discardBehavior;

    // Step 1: Re-evaluate scores, reset discard flags
    artifacts.forEach(a => {
        a.evaluationScore = evaluateArtifact(a, settings);
        a.discardFlag = false;
    });

    const total = artifacts.length;
    const target = b.targetInventoryCount;

    // Step 2: No action needed if already at/below target
    if (total <= target) {
        await db.artifacts.bulkPut(artifacts);
        return language === 'en'
            ? `Discard calc complete.\nCurrent AF count (${total}) is at or below target (${target}). No discards proposed.`
            : `廃棄フラグの計算完了。\n現在のAF数(${total})が目標数(${target})以下のため、廃棄提案はありません。`;
    }

    // Step 3: Classify each artifact
    const protectedSet: typeof artifacts = [];
    const unnecForDiscard: typeof artifacts = [];
    const unprotected: typeof artifacts = [];

    for (const a of artifacts) {
        const eq = (a as any).equip_npc_info;
        const isEquippedAF = eq && !Array.isArray(eq) && typeof eq === 'object';
        const isProtected =
            ((b.protectLocked ?? true) && a.is_locked) ||
            ((b.protectKeepFlag ?? true) && !!a.keepFlag) ||
            ((b.protectRareAF ?? true) && isRareArtifact(a)) ||
            ((b.protectEquipped ?? true) && isEquippedAF) ||
            ((b.protectMemos ?? true) && memoIds.has(a.id)) ||
            (b.protectedAttributes?.includes(a.attribute.toString()) ?? false);

        if (isProtected) {
            protectedSet.push(a);
        } else if (b.treatUnnecessaryAsDiscard && a.is_unnecessary) {
            a.discardFlag = true;
            unnecForDiscard.push(a);
        } else {
            unprotected.push(a);
        }
    }

    const needToDiscard = total - target;
    const stillNeed = Math.max(0, needToDiscard - unnecForDiscard.length);

    // Step 4a: Unnecessary-only discards are enough
    if (stillNeed === 0) {
        await db.artifacts.bulkPut(artifacts);
        return language === 'en'
            ? `Discard calc complete.\nTarget reached by discarding trash only.\nProposed discards: ${unnecForDiscard.length}`
            : `廃棄フラグの計算完了。\n不用品の廃棄のみで目標数に届きます。\n廃棄提案: ${unnecForDiscard.length}件`;
    }

    // Step 4b: Not enough unprotected AFs — flag all and warn
    unprotected.sort((a, b) => (a.evaluationScore || 0) - (b.evaluationScore || 0));

    if (stillNeed > unprotected.length) {
        unprotected.forEach(a => { a.discardFlag = true; });
        await db.artifacts.bulkPut(artifacts);
        const shortfall = stillNeed - unprotected.length;
        return language === 'en'
            ? `Discard calc complete.\nProposed discards: ${unprotected.length + unnecForDiscard.length}\n⚠️ Short by ${shortfall} items. Consider managing favorites.`
            : `廃棄フラグの計算完了。\n廃棄提案: ${unprotected.length + unnecForDiscard.length}件\n⚠️ ${shortfall}件足りません。お気に入りの整理もご検討ください。`;
    }

    // Step 4c: Flag exactly the right number (lowest scores first)
    for (let i = 0; i < stillNeed; i++) {
        unprotected[i].discardFlag = true;
    }

    await db.artifacts.bulkPut(artifacts);
    return language === 'en'
        ? `Discard calc complete.\nProposed discards: ${unnecForDiscard.length + stillNeed} (Trash ${unnecForDiscard.length} + Low Score ${stillNeed})\nProtected: ${protectedSet.length}`
        : `廃棄フラグの計算完了。\n廃棄提案: ${unnecForDiscard.length + stillNeed}件 (不用品${unnecForDiscard.length}件 + 低評価${stillNeed}件)\n保護中: ${protectedSet.length}件`;
}
