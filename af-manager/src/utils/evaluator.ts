import type { AppArtifact, Settings } from '../types';
import { RARE_AF_IDS, G1_SKILLS, G2_SKILLS, G3_SKILLS } from '../data/skillMaster';

export function isRareArtifact(artifact: AppArtifact): boolean {
    return RARE_AF_IDS.has(artifact.artifact_id);
}

export function evaluateArtifact(artifact: AppArtifact, settings: Settings): number {
    // Rare AFs are excluded from evaluation
    if (isRareArtifact(artifact)) return -1;

    if (!settings || !settings.evaluationFormula) return 0;

    const f = settings.evaluationFormula;

    // Quality value mapping (configurable, falls back to raw quality 1-5)
    const qv = f.qualityValues || {};
    const qualVal = (q: number) => qv[q] ?? q;

    const s1 = qualVal(artifact.skill1_info?.skill_quality || 0);
    const s2 = qualVal(artifact.skill2_info?.skill_quality || 0);
    const s3 = qualVal(artifact.skill3_info?.skill_quality || 0);
    const s4 = qualVal(artifact.skill4_info?.skill_quality || 0);

    // Helper to extract the actual base name without any sub-member text suffix
    const getCleanName = (name?: string) => {
        if (!name) return "";
        // Cut off at the fullwidth space + diamond, or any similar delimiter
        return name.split("　◆")[0].split(" ◆")[0].trim();
    };

    const s1_clean = getCleanName(artifact.skill1_info?.name);
    const s2_clean = getCleanName(artifact.skill2_info?.name);
    const s3_clean = getCleanName(artifact.skill3_info?.name);
    const s4_clean = getCleanName(artifact.skill4_info?.name);

    // Multipliers keyed by baseId from SettingsTab config
    const sm = f.skillMultipliers || {};

    // Map clean name to baseId for multiplier lookup
    const findBaseIdByName = (name: string, group: number) => {
        if (!name) return 0;
        const fromMaster = (group === 1 ? G1_SKILLS : group === 2 ? G2_SKILLS : G3_SKILLS).find(s => s.name === name);
        return fromMaster ? fromMaster.baseId : 0;
    };

    const s1_mult = sm[findBaseIdByName(s1_clean, 1)] ?? 1;
    const s2_mult = sm[findBaseIdByName(s2_clean, 1)] ?? 1;
    const s3_mult = sm[findBaseIdByName(s3_clean, 2)] ?? 1;
    const s4_mult = sm[findBaseIdByName(s4_clean, 3)] ?? 1;

    let score = f.group1Multiplier * (s1 * s1_mult + s2 * s2_mult) +
        f.group2Multiplier * (s3 * s3_mult) +
        f.group3Multiplier * (s4 * s4_mult);

    // Helper to find name from baseId for backwards compatibility
    // (If the user already has saved exceptions using the legacy baseId number, we need to map it back to name)
    const findName = (idOrName: string | number, group: number) => {
        if (!idOrName) return "";
        if (typeof idOrName === 'string' && isNaN(Number(idOrName))) return idOrName;
        const fromMaster = (group === 1 ? G1_SKILLS : group === 2 ? G2_SKILLS : G3_SKILLS).find(s => s.baseId === Number(idOrName));
        return fromMaster ? fromMaster.name : "";
    };

    // Apply Exceptions
    if (f.exceptions && Array.isArray(f.exceptions)) {
        for (const ex of f.exceptions) {
            if (!ex.conditionSkillName || !ex.targetSkillName) continue;

            const condName = findName(ex.conditionSkillName, ex.conditionGroup);
            const targetName = findName(ex.targetSkillName, ex.targetGroup);

            if (!condName || !targetName) continue;

            const condSlots = getMatchingSlotsByName(s1_clean, s2_clean, s3_clean, s4_clean, ex.conditionGroup, condName);
            const targetSlots = getMatchingSlotsByName(s1_clean, s2_clean, s3_clean, s4_clean, ex.targetGroup, targetName);

            // Need at least one match for both
            if (condSlots.length > 0 && targetSlots.length > 0) {
                // Check if they can be satisfied by distinct slots
                const hasValidCombination = condSlots.some(cSlot =>
                    targetSlots.some(tSlot => cSlot !== tSlot)
                );

                if (hasValidCombination) {
                    score += ex.scoreModifier;
                }
            }
        }
    }

    return Math.round(score * 100) / 100;
}

/**
 * Returns an array of slot indices [1, 2, 3, 4] where the clean skill exactly matches the given name.
 */
function getMatchingSlotsByName(s1: string, s2: string, s3: string, s4: string, group: number, targetName: string): number[] {
    if (!targetName) return [];

    const slots: number[] = [];

    if (group === 1) {
        if (s1 === targetName) slots.push(1);
        if (s2 === targetName) slots.push(2);
    } else if (group === 2) {
        if (s3 === targetName) slots.push(3);
    } else if (group === 3) {
        if (s4 === targetName) slots.push(4);
    }

    return slots;
}
