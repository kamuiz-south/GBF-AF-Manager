import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { AppArtifact } from '../types';
import { getCleanName } from '../utils/evaluator';
import { SKILL_MASTER_BY_BASE_ID } from '../data/skillMaster';

export function useSkillFilter() {
    const settings = useLiveQuery(() => db.settings.get('global'));
    const skillFilterFields = settings?.skillFilterFields || [[], [], []];
    const skillFilterMySets = settings?.skillFilterMySets || {};
    
    const [isSkillFilterOpen, setIsSkillFilterOpen] = useState(false);

    // Save skill filter fields to DB
    const saveSkillFilterFields = useCallback(async (newFields: number[][]) => {
        const currentSettings = await db.settings.get('global');
        if (currentSettings) {
            await db.settings.put({ ...currentSettings, skillFilterFields: newFields });
        }
    }, []);

    const saveMySet = useCallback(async (slot: number, fields: number[][]) => {
        const currentSettings = await db.settings.get('global');
        if (currentSettings) {
            const currentSets = currentSettings.skillFilterMySets || {};
            await db.settings.put({
                ...currentSettings,
                skillFilterMySets: {
                    ...currentSets,
                    [slot]: { fields, locked: currentSets[slot]?.locked || false }
                }
            });
        }
    }, []);

    const deleteMySet = useCallback(async (slot: number) => {
        const currentSettings = await db.settings.get('global');
        if (currentSettings) {
            const currentSets = currentSettings.skillFilterMySets || {};
            const newSets = { ...currentSets };
            delete newSets[slot];
            await db.settings.put({
                ...currentSettings,
                skillFilterMySets: newSets
            });
        }
    }, []);

    const toggleMySetLock = useCallback(async (slot: number) => {
        const currentSettings = await db.settings.get('global');
        if (currentSettings) {
            const currentSets = currentSettings.skillFilterMySets || {};
            if (currentSets[slot]) {
                await db.settings.put({
                    ...currentSettings,
                    skillFilterMySets: {
                        ...currentSets,
                        [slot]: { ...currentSets[slot], locked: !currentSets[slot].locked }
                    }
                });
            }
        }
    }, []);

    // Skill filter matching logic
    // Fields are connected by AND, skills within a field are connected by OR.
    // baseId === 0 (unselected "--") is treated as "not configured" and ignored.
    const matchesSkillFilter = useCallback((a: AppArtifact): boolean => {
        // Filter out empty fields and unselected skills (baseId === 0)
        const validFields = skillFilterFields
            .map(f => f.filter(baseId => baseId > 0))
            .filter(f => f.length > 0);

        if (validFields.length === 0) return true; // No filter configured -> match all

        const afSkillNames = [
            getCleanName(a.skill1_info?.name),
            getCleanName(a.skill2_info?.name),
            getCleanName(a.skill3_info?.name),
            getCleanName(a.skill4_info?.name)
        ].filter(Boolean);

        // Fields are connected by AND
        return validFields.every(field => {
            // Skills within a field are connected by OR
            return field.some(baseId => {
                const skillInfo = SKILL_MASTER_BY_BASE_ID.get(baseId);
                if (!skillInfo) return false;
                return afSkillNames.includes(skillInfo.name);
            });
        });
    }, [skillFilterFields]);

    return {
        skillFilterFields,
        skillFilterMySets,
        saveSkillFilterFields,
        saveMySet,
        deleteMySet,
        toggleMySetLock,
        isSkillFilterOpen,
        setIsSkillFilterOpen,
        matchesSkillFilter,
    };
}
