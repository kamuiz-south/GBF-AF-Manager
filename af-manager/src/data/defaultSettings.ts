import type { Settings } from '../types';
import { MAX_AF_INVENTORY } from '../constants';

export const DEFAULT_NOTIFICATION_MAX_COUNT = 4;
export const DEFAULT_NOTIFICATION_DURATION = 3;
export const DEFAULT_UPGRADE_LOG_MAX_COUNT = 20;
export const DEFAULT_PAGE_LIMIT = 10;
export const DEFAULT_HTTP_PORT = 1422;
export const DEFAULT_HTTP_PORT_AUTO_FALLBACK = true;
export const DEFAULT_LANGUAGE: NonNullable<Settings['language']> = 'ja';
export const DEFAULT_AUTO_FLAG_UPDATE: NonNullable<Settings['autoFlagUpdate']> = {
    keepFlag: false,
    discardFlag: false,
};

type ResolvedDiscardBehavior = Required<Settings['discardBehavior']>;

/**
 * Canonical defaults for every discard-protection option.
 * New settings records persist all fields; older records are resolved through
 * resolveDiscardBehavior() so missing/null values use these values.
 */
export const DEFAULT_DISCARD_BEHAVIOR: ResolvedDiscardBehavior = {
    treatUnnecessaryAsDiscard: true,
    targetInventoryCount: MAX_AF_INVENTORY,
    protectLocked: false,
    protectKeepFlag: true,
    protectRareAF: true,
    protectEquipped: true,
    protectMemos: true,
    protectLv5Skills: true,
    protectQuality5Skills: false,
    protectQuality5Method: 'all',
    protectedQuality5SkillsList: [],
    protectedAttributes: [],
};

export function resolveDiscardBehavior(
    value?: Settings['discardBehavior']
): ResolvedDiscardBehavior {
    const defined = value
        ? Object.fromEntries(
            Object.entries(value).filter(([, v]) => v !== undefined && v !== null)
        )
        : {};
    const resolved = { ...DEFAULT_DISCARD_BEHAVIOR, ...defined } as ResolvedDiscardBehavior;
    return {
        ...resolved,
        protectedQuality5SkillsList: Array.isArray(resolved.protectedQuality5SkillsList)
            ? [...resolved.protectedQuality5SkillsList]
            : [],
        protectedAttributes: Array.isArray(resolved.protectedAttributes)
            ? [...resolved.protectedAttributes]
            : [],
    };
}

/**
 * Canonical defaults used when no global settings record exists.
 *
 * The quality coefficients match the v1.1.2 evaluation-formula preset.
 */
export const DEFAULT_SETTINGS: Settings = {
    id: 'global',
    language: DEFAULT_LANGUAGE,
    evaluationFormula: {
        group1Multiplier: 1,
        group2Multiplier: 1,
        group3Multiplier: 1,
        skillMultipliers: {},
        qualityValues: { 1: 1, 2: 1.05, 3: 1.1, 4: 1.25, 5: 1.5 },
        exceptions: [],
    },
    discardBehavior: resolveDiscardBehavior(),
    httpPort: DEFAULT_HTTP_PORT,
    httpPortAutoFallback: DEFAULT_HTTP_PORT_AUTO_FALLBACK,
    notificationDuration: DEFAULT_NOTIFICATION_DURATION,
    notificationMaxCount: DEFAULT_NOTIFICATION_MAX_COUNT,
    pageLimit: DEFAULT_PAGE_LIMIT,
    saveWindowState: true,
    upgradeLogMaxCount: DEFAULT_UPGRADE_LOG_MAX_COUNT,
    upgradeLogShowAllArtifacts: false,
    autoFlagUpdate: { ...DEFAULT_AUTO_FLAG_UPDATE },
};
