import type { AppArtifact, Condition } from '../types';

export function runCriteriaMatcher(artifacts: AppArtifact[], conditions: Condition[]): AppArtifact[] {
    // Reset all keep flags first
    const updatedArtifacts: AppArtifact[] = artifacts.map(a => ({ ...a, keepFlag: undefined }));

    // Sort conditions by priority (lowest number first, e.g. 1 is highest priority)
    const sortedConditions = [...conditions].sort((a, b) => a.priority - b.priority);

    for (const cond of sortedConditions) {
        let requiredCount = cond.methodType === 1
            ? Object.values(cond.targetCount).reduce((a, b) => a + b, 0)
            : cond.targetCountMethod2;

        if (!requiredCount || requiredCount <= 0) continue;

        let candidates = updatedArtifacts.filter(a => {
            // 1. Check exclusivity
            if (cond.occupyKeepFlag && a.keepFlag) return false;

            // 1.5 Check Exclude Favorites
            if (cond.excludeFavorites && a.is_locked) return false;

            // Helper to extract the actual base name without any sub-member text suffix
            const getCleanName = (name?: string) => {
                if (!name) return "";
                return name.split("　◆")[0].split(" ◆")[0].trim();
            };

            const allSkillNames = [
                a.skill1_info?.name, a.skill2_info?.name, a.skill3_info?.name, a.skill4_info?.name
            ].filter(Boolean).map(getCleanName);

            // 2. Check Method Specific Filtering
            if (cond.methodType === 1) {
                const key = `${a.attribute}_${a.kind}`;
                if (!cond.targetCount[key] || cond.targetCount[key] <= 0) return false;
            } else if (cond.methodType === 2) {
                if (cond.attributes && cond.attributes.length > 0) {
                    if (!cond.attributes.includes(a.attribute.toString())) return false;
                }

                const validKinds = [...(cond.weaponKinds || []), ...(cond.weaponKinds2 || [])].filter(Boolean);
                if (validKinds.length > 0) {
                    if (!validKinds.includes(a.kind.toString())) return false;
                }
            }

            // 3. Check Skill Must Match
            if (cond.skillMustMatch.skill1 && cond.skills.skill1) {
                if (!allSkillNames.includes(getCleanName(cond.skills.skill1))) return false;
            }
            if (cond.skillMustMatch.skill2 && cond.skills.skill2) {
                if (!allSkillNames.includes(getCleanName(cond.skills.skill2))) return false;
            }
            if (cond.skillMustMatch.skill3 && cond.skills.skill3) {
                if (!allSkillNames.includes(getCleanName(cond.skills.skill3))) return false;
            }
            if (cond.skillMustMatch.skill4 && cond.skills.skill4) {
                if (!allSkillNames.includes(getCleanName(cond.skills.skill4))) return false;
            }

            // 4. Check Exclude Skills (Must be after checking mandatory skills according to user logic requirement)
            if (cond.excludeSkills && cond.excludeSkills.length > 0) {
                const hasExcluded = cond.excludeSkills.some(ex => allSkillNames.includes(getCleanName(ex)));
                if (hasExcluded) return false;
            }

            // 5. Check Has At Least One Target Skill
            const targetSkills = [
                cond.skills.skill1,
                cond.skills.skill2,
                cond.skills.skill3,
                cond.skills.skill4
            ].filter(Boolean).map(getCleanName); // Only consider skills that the user actually specified

            if (targetSkills.length > 0) {
                const hasAtLeastOne = targetSkills.some(ts => allSkillNames.includes(ts));
                if (!hasAtLeastOne) return false;
            }

            return true;
        });

        // 5. Sort candidates
        candidates.sort((a, b) => {
            // Priority 1: Has optional skill matches (Count & Priority Score)
            const aMatchScore = calculateOptionalSkillMatchScore(a, cond);
            const bMatchScore = calculateOptionalSkillMatchScore(b, cond);
            if (aMatchScore !== bMatchScore) return bMatchScore - aMatchScore;

            // Priority 2: Quality of matched skills based on P1 -> P2 -> P3 -> P4
            for (let p = 1; p <= 4; p++) {
                const aQ = getQualityOfPriority(a, cond, p);
                const bQ = getQualityOfPriority(b, cond, p);
                if (aQ !== bQ) {
                    // Check if this priority 'p' corresponds to skill3, and if we should invert it
                    if (cond.invertSkill3Quality && cond.skillPriorities.skill3 === p && cond.skills.skill3 === "最大HP上昇/防御力-70%") {
                        if (aQ === 0) return 1; // b has it, a doesn't -> b first
                        if (bQ === 0) return -1; // a has it, b doesn't -> a first
                        return aQ - bQ; // Both have it, LOWER quality comes first
                    }
                    return bQ - aQ; // HIGHER quality comes first (default)
                }
            }

            // Priority 3: Eval Score
            if (a.evaluationScore !== b.evaluationScore) {
                return (b.evaluationScore || 0) - (a.evaluationScore || 0);
            }

            // Priority 4: ID (Oldest first)
            return a.id - b.id;
        });

        // 6. Assign Keep Flags
        const method1Fulfillment = { ...cond.targetCount };
        let method2Fulfillment = 0;

        for (const cand of candidates) {
            if (cond.methodType === 1) {
                const key = `${cand.attribute}_${cand.kind}`;
                if (method1Fulfillment[key] > 0 && (!cand.keepFlag || !cond.occupyKeepFlag)) {
                    cand.keepFlag = cond.id;
                    method1Fulfillment[key]--;
                }
            } else {
                if (method2Fulfillment < cond.targetCountMethod2 && (!cand.keepFlag || !cond.occupyKeepFlag)) {
                    cand.keepFlag = cond.id;
                    method2Fulfillment++;
                }
            }
        }
    }

    return updatedArtifacts;
}

function calculateOptionalSkillMatchScore(artifact: AppArtifact, cond: Condition): number {
    let score = 0;

    const getCleanName = (name?: string) => {
        if (!name) return "";
        return name.split("　◆")[0].split(" ◆")[0].trim();
    };

    const allSkillNames = [
        artifact.skill1_info?.name, artifact.skill2_info?.name, artifact.skill3_info?.name, artifact.skill4_info?.name
    ].filter(Boolean).map(getCleanName);

    const weights = [0, 100, 75, 50, 25];

    if (!cond.skillMustMatch.skill1 && cond.skills.skill1 && allSkillNames.includes(getCleanName(cond.skills.skill1))) {
        score += weights[cond.skillPriorities.skill1 || 4];
    }
    if (!cond.skillMustMatch.skill2 && cond.skills.skill2 && allSkillNames.includes(getCleanName(cond.skills.skill2))) {
        score += weights[cond.skillPriorities.skill2 || 4];
    }
    if (!cond.skillMustMatch.skill3 && cond.skills.skill3 && allSkillNames.includes(getCleanName(cond.skills.skill3))) {
        score += weights[cond.skillPriorities.skill3 || 4];
    }
    if (!cond.skillMustMatch.skill4 && cond.skills.skill4 && allSkillNames.includes(getCleanName(cond.skills.skill4))) {
        score += weights[cond.skillPriorities.skill4 || 4];
    }

    return score;
}

function getQualityOfPriority(artifact: AppArtifact, cond: Condition, targetPriority: number): number {
    const skills = [
        artifact.skill1_info, artifact.skill2_info, artifact.skill3_info, artifact.skill4_info
    ].filter(Boolean) as any[];

    // Find which skill index (1-4) corresponds to the requested priority
    let skillNameTarget = "";
    if (cond.skillPriorities.skill1 === targetPriority && cond.skills.skill1) skillNameTarget = cond.skills.skill1;
    if (cond.skillPriorities.skill2 === targetPriority && cond.skills.skill2) skillNameTarget = cond.skills.skill2;
    if (cond.skillPriorities.skill3 === targetPriority && cond.skills.skill3) skillNameTarget = cond.skills.skill3;
    if (cond.skillPriorities.skill4 === targetPriority && cond.skills.skill4) skillNameTarget = cond.skills.skill4;

    if (!skillNameTarget) return 0; // The user didn't assign this priority to any valid skill

    const getCleanName = (name?: string) => {
        if (!name) return "";
        return name.split("　◆")[0].split(" ◆")[0].trim();
    };

    const cleanTarget = getCleanName(skillNameTarget);

    // Find the skill in the artifact that exactly matches this clean name and return its quality
    const matchedSkill = skills.find(s => getCleanName(s.name) === cleanTarget);
    return matchedSkill ? matchedSkill.skill_quality : 0;
}
