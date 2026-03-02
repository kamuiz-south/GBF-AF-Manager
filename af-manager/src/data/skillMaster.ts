/**
 * skillMaster.ts
 * 
 * All possible AF skills grouped by category.
 * 
 * Skill ID structure:
 *   - skill_id is 5 digits: e.g. 10111
 *   - Last digit = skill_quality (1-5)
 *   - Math.floor(skill_id / 10) = "base ID" = unique identifier for a skill name
 * 
 * G1 and G2 (except 40011, 50011) have 5 skill IDs per skill (one per quality).
 * G3 and G2's 40011/50011 have only 1 skill ID (fixed quality).
 * 
 * Rare AFs (artifact_id in RARE_AF_IDS) are excluded from evaluation.
 */

export const RARE_AF_IDS = new Set<number>([
    401110401,
    401110402,
    401110403,
    401110404,
    401110405,
]);

export interface SkillInfo {
    baseId: number;   // Math.floor(skill_id / 10)
    name: string;
    group: 1 | 2 | 3;
    fixedQuality?: number; // for G3 and special G2 with only 1 quality
}

export const SKILL_MASTER: SkillInfo[] = [
    // ─── G1 Skills (S1 & S2) ────────────────────────
    { baseId: 1011, name: '攻撃力', group: 1 },
    { baseId: 1021, name: 'HP', group: 1 },
    { baseId: 1031, name: 'クリティカル確率', group: 1 },
    { baseId: 1041, name: '奥義ダメージ', group: 1 },
    { baseId: 1051, name: 'アビリティダメージ', group: 1 },
    { baseId: 1061, name: '弱体成功率', group: 1 },
    { baseId: 1071, name: 'ダブルアタック確率', group: 1 },
    { baseId: 1081, name: 'トリプルアタック確率', group: 1 },
    { baseId: 1091, name: '防御力', group: 1 },
    { baseId: 1101, name: '弱体耐性', group: 1 },
    { baseId: 1111, name: '回避率', group: 1 },
    { baseId: 1121, name: '回復性能', group: 1 },
    { baseId: 1131, name: '自属性攻撃力', group: 1 },
    { baseId: 1141, name: '有利属性軽減', group: 1 },

    // ─── G2 Skills (S3) ─────────────────────────────
    { baseId: 2011, name: '通常攻撃ダメージ上限', group: 2 },
    { baseId: 2021, name: 'アビリティダメージ上限', group: 2 },
    { baseId: 2031, name: '奥義ダメージ上限', group: 2 },
    { baseId: 2041, name: '通常攻撃の与ダメージ上昇', group: 2 },
    { baseId: 2051, name: 'アビリティ与ダメージ上昇', group: 2 },
    { baseId: 2061, name: '奥義与ダメージ上昇', group: 2 },
    { baseId: 2071, name: '奥義ダメージ特殊上限UP', group: 2 },
    { baseId: 2081, name: 'チェイン与ダメージUP', group: 2 },
    { baseId: 2091, name: 'ターンダメージを軽減', group: 2 },
    { baseId: 2101, name: '再生', group: 2 },
    { baseId: 2111, name: 'HPが100%の時、与ダメージUP', group: 2 },
    { baseId: 2121, name: 'HPが50%以上の時、トリプルアタック確率UP', group: 2 },
    { baseId: 2131, name: 'HPが50%以下の時、被ダメージを軽減', group: 2 },
    { baseId: 2141, name: 'クリティカル発動時、ダメージ上限UP', group: 2 },
    { baseId: 2151, name: '最大HP上昇/防御力-70%', group: 2 },
    { baseId: 2161, name: '通常攻撃ダメージ上限UP/アビリティダメージ上限-80％/奥義ダメージ上限-60％', group: 2 },
    { baseId: 2171, name: 'アビリティダメージ上限UP/通常攻撃ダメージ上限-20％/奥義ダメージ上限-60％', group: 2 },
    { baseId: 2181, name: '奥義ダメージ上限UP/通常攻撃ダメージ上限-20％/アビリティダメージ上限-80％', group: 2 },
    { baseId: 2191, name: '確率で強化効果が無効化されない', group: 2 },
    { baseId: 2201, name: '確率で攻撃開始時に自分の弱体効果を1つ回復', group: 2 },

    // ─── G3 Skills (S4) — All 29 from G3.txt ────────────────────
    { baseId: 5002, name: '弱体アビリティ使用時、敵に被ダメージUP(2回)', group: 3, fixedQuality: 1 },
    { baseId: 5003, name: '回復アビリティ使用時、自分の次に配置されたキャラに自属性追撃効果(1回)', group: 3, fixedQuality: 1 },
    { baseId: 5004, name: 'リンクアビリティを一定回数使用時に自分のリンクアビリティの再使用間隔を1ターン短縮', group: 3, fixedQuality: 1 },
    { baseId: 5005, name: '使用間隔が10ターン以上のアビリティ使用時、自分に与ダメージUP', group: 3, fixedQuality: 1 },
    { baseId: 5006, name: 'アビリティを一定回数使用する度に自分にダメージ上限UP(累積)', group: 3, fixedQuality: 1 },
    { baseId: 5007, name: 'アビリティダメージを一定量与える毎に自分にアビリティ与ダメージ上昇(累積)', group: 3, fixedQuality: 1 },
    { baseId: 5008, name: '1回攻撃発動時、自分に一定個数ランダムな強化効果', group: 3, fixedQuality: 1 },
    { baseId: 5010, name: 'ターン終了時、自分がそのターン中に消費したHPに応じて敵に無属性ダメージ', group: 3, fixedQuality: 1 },
    { baseId: 5011, name: 'ターン終了時、自分がそのターン中に消費した奥義ゲージ量に応じて自分に与ダメージ上昇', group: 3, fixedQuality: 1 },
    { baseId: 5012, name: '攻撃開始時に敵の弱体効果の数が3つ以下の時、自分にブロック効果', group: 3, fixedQuality: 1 },
    { baseId: 5013, name: 'ターン終了時にHPが50%以下の敵がいる時、一度だけ自分のHPを回復', group: 3, fixedQuality: 1 },
    { baseId: 5014, name: 'サブメンバー時、一定ターン毎に敵全体にランダムな弱体効果を1つ付与(重複不可)', group: 3, fixedQuality: 1 },
    { baseId: 5015, name: '一定回数敵の攻撃行動のターゲットになった場合、一度だけ自分に自属性追撃(1回)効果', group: 3, fixedQuality: 1 },
    { baseId: 5016, name: '攻撃行動を行わなかった場合、ターン終了時に自分に一定個数ランダムな強化効果', group: 3, fixedQuality: 1 },
    { baseId: 5017, name: 'キュアポーションまたはオールポーション使用時にフェイタルチェインゲージUP(重複不可)', group: 3, fixedQuality: 1 },
    { baseId: 5018, name: '敵に一定回数攻撃を与えた時、一度だけ自分に乱撃(3ヒット)効果(1回)', group: 3, fixedQuality: 1 },
    { baseId: 5019, name: '戦闘不能になった時、一度だけ味方全体に一定個数ランダムな強化効果', group: 3, fixedQuality: 1 },
    { baseId: 5020, name: 'バトル登場時に一度だけ自分の与ダメージUP', group: 3, fixedQuality: 1 },
    { baseId: 5021, name: 'バトル開始時に自分に一定個数ランダムな強化効果', group: 3, fixedQuality: 1 },
    { baseId: 5022, name: 'バトル開始時から1ターンの間被ダメージ減少', group: 3, fixedQuality: 1 },
    { baseId: 5023, name: 'バトル開始時と5ターン毎に自分にバリア効果', group: 3, fixedQuality: 1 },
    { baseId: 5024, name: 'バトル開始時に最大HPの20%を消費するが3ターン後、自分にダメージ上限UP', group: 3, fixedQuality: 1 },
    { baseId: 5025, name: '1番目のアビリティ使用時にHPを一定割合消費するが、1番目のアビリティの使用間隔を1ターン短縮(レベルに応じて消費割合DOWN)', group: 3, fixedQuality: 1 },
    { baseId: 5026, name: '攻撃開始時、確率で自分に乱撃(6ヒット)効果(1回)', group: 3, fixedQuality: 1 },
    { baseId: 5027, name: '確率でターンの進行時に経過ターンを5ターン進める(重複不可)', group: 3, fixedQuality: 1 },
    { baseId: 5028, name: 'ターン終了時、確率で敵の強化効果を全て無効化(重複不可)', group: 3, fixedQuality: 1 },
    { baseId: 5029, name: 'バトル終了時にランダムな耳飾りを入手することがある(レベルに応じて入手確率UP/重複不可)', group: 3, fixedQuality: 1 },
    { baseId: 3031, name: 'アイテムドロップ率UP(重複不可)', group: 3, fixedQuality: 1 },
    { baseId: 3032, name: '獲得経験値UP(重複不可)', group: 3, fixedQuality: 1 },
];

export const SKILL_MASTER_BY_BASE_ID = new Map<number, SkillInfo>(
    SKILL_MASTER.map(s => [s.baseId, s])
);

export const G1_SKILLS = SKILL_MASTER.filter(s => s.group === 1);
export const G2_SKILLS = SKILL_MASTER.filter(s => s.group === 2);
export const G3_SKILLS = SKILL_MASTER.filter(s => s.group === 3);

/** Get base ID from a raw skill_id */
export function getBaseSkillId(skillId: number): number {
    return Math.floor(skillId / 10);
}
