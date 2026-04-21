export const ATTRIBUTE_IDS = ["1", "2", "3", "4", "5", "6"] as const;
export const KIND_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;

export type AttributeId = (typeof ATTRIBUTE_IDS)[number];
export type KindId = (typeof KIND_IDS)[number];

export const KIND_NAMES_SHORT_JP: Record<string, string> = {
    '1': '剣', '2': '短剣', '3': '槍', '4': '斧', '5': '杖', '6': '銃', '7': '格闘', '8': '弓', '10': '刀', '9': '楽器'
};

export const KIND_NAMES_SHORT_EN: Record<string, string> = {
    '1': 'SWD', '2': 'DAG', '3': 'SPR', '4': 'AXE', '5': 'STF', '6': 'GUN', '7': 'ML', '8': 'BOW', '10': 'KAT', '9': 'HRF'
};

export function getKindNamesShort(lang: string) {
    return lang === 'en' ? KIND_NAMES_SHORT_EN : KIND_NAMES_SHORT_JP;
}

export function getAttributeOps(t: (key: any) => string) {
    return ATTRIBUTE_IDS.map(id => ({ val: id, label: t(`ATTR_${id}`) }));
}

export function getKindOps(t: (key: any) => string) {
    return KIND_IDS.map(id => ({ val: id, label: t(`WPN_${id}`) }));
}
