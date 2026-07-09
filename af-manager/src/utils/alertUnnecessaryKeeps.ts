import { db } from '../db';

const ATTR_MAP: Record<string, string> = {
  '1': '火', '2': '水', '3': '土', '4': '風', '5': '光', '6': '闇'
};

const ATTR_MAP_EN: Record<string, string> = {
  '1': 'Fire', '2': 'Water', '3': 'Earth', '4': 'Wind', '5': 'Light', '6': 'Dark'
};

const KIND_MAP: Record<string, string> = {
  '1': '剣', '2': '短剣', '3': '槍', '4': '斧', '5': '杖', '6': '銃', '7': '格闘', '8': '弓', '9': '楽器', '10': '刀'
};

const KIND_MAP_EN: Record<string, string> = {
  '1': 'Sabre', '2': 'Dagger', '3': 'Spear', '4': 'Axe', '5': 'Staff', '6': 'Gun', '7': 'Melee', '8': 'Bow', '9': 'Harp', '10': 'Katana'
};

export async function alertUnnecessaryKeeps(language: string = 'ja') {
    try {
        const artifacts = await db.artifacts.toArray();
        const targets = artifacts.filter(a => a.is_unnecessary && !!a.keepFlag);

        if (targets.length === 0) return;

        const listStr = targets.map(a => {
            const attr = language === 'en' ? (ATTR_MAP_EN[a.attribute] || a.attribute) : (ATTR_MAP[a.attribute] || a.attribute);
            const kind = language === 'en' ? (KIND_MAP_EN[a.kind] || a.kind) : (KIND_MAP[a.kind] || a.kind);
            return `[${a.id}(${attr}/${kind})]`;
        }).join(', ');

        if (language === 'en') {
            // setTimeout to ensure it runs after UI renders (like toast) and doesn't block immediately
            setTimeout(() => {
                alert(`[Warning!] There are ${targets.length} AF(s) marked as Trash but proposed to Keep:\n\n${listStr}`);
            }, 50);
        } else {
            setTimeout(() => {
                alert(`【注意！】不用品かつ確保提案のあるAFが ${targets.length} 件あります:\n\n${listStr}`);
            }, 50);
        }
    } catch (e) {
        console.error("Failed to check unnecessary keep conflicts", e);
    }
}
