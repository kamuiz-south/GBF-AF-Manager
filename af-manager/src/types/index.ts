export interface SkillInfo {
  skill_id: number;
  skill_quality: number;
  level: number;
  name: string;
  is_max_quality: boolean;
  effect_value: string;
  icon_image: string;
}

export interface ArtifactRaw {
  artifact_id: number;
  max_level: number;
  name: string;
  comment: string;
  rarity: string;
  skill1_info: SkillInfo;
  skill2_info: SkillInfo;
  skill3_info: SkillInfo;
  skill4_info: SkillInfo;
  id: number;
  level: string;
  kind: string; // "1" to "10" (weapon type)
  attribute: string; // "1" to "6" (element)
  next_exp: number;
  remain_next_exp: number;
  exp_width: number;
  is_locked: boolean;
  is_unnecessary: boolean;
  equip_npc_info: [] | { user_npc_id: number; image: string; name: string };  // [] = not equipped; object = equipped character
}

export interface AppArtifact extends ArtifactRaw {
  keepFlag?: string; // the condition ID that flagged this item for keeping
  evaluationScore?: number; // pre-calculated score
  inventoryOrder?: number; // JSON array index from import to preserve exact fetch order
  discardFlag?: boolean; // App suggested discard flag (differs from is_unnecessary)
}

export interface ArtifactMemo {
  id: number;
  memo: string;
}

export interface Condition {
  id: string; // uuid
  listId: string; // e.g., "default", allows multiple lists
  priority: number; // visual order
  name: string; // user-facing name

  methodType: 1 | 2; // Method 1 (grid count) vs Method 2 (specific character)

  // Method 1 specific
  targetCount: Record<string, number>; // e.g., {"3_10": 2} for Earth Katana x2

  // Method 2 specific
  characterName: string;
  attributes: string[];
  weaponKinds: string[]; // First weapon kind
  weaponKinds2?: string[]; // Optional second weapon kind
  targetCountMethod2: number;

  // Shared Skill Logic
  skills: {
    skill1: string;
    skill2: string;
    skill3: string;
    skill4: string;
  };
  excludeSkills: string[];
  skillPriorities: {
    skill1: number | null;
    skill2: number | null;
    skill3: number | null;
    skill4: number | null;
  };
  skillMustMatch: {
    skill1: boolean;
    skill2: boolean;
    skill3: boolean;
    skill4: boolean;
  };
  invertSkill3Quality?: boolean; // If true, sort skill 3 by lowest quality instead of highest
  excludeFavorites?: boolean; // If true, ignore AFs that are locked/favorited

  occupyKeepFlag: boolean; // if true, only flags it if it currently has no keepFlag
  memo?: string; // optional per-condition memo
  disabled?: boolean; // if true, this condition is excluded from keep-flag calculation
}

export interface FooterColorSetting {
  bg: string;
  text: 'white' | 'black';
}

export interface ArtifactStatusColors {
  fav: FooterColorSetting;
  trash: FooterColorSetting;
  keep: FooterColorSetting;
  discard: FooterColorSetting;
  conflict: FooterColorSetting;
}

export interface ConditionGroup {
  id: string;      // uuid (条件の listId に対応)
  name: string;    // ユーザーが設定するグループ名
  color?: string;  // ラベル色（任意）
  order: number;   // 表示順
  sentinelPriority?: number; // 空フォルダの仮想位置（条件カードのpriorityと同一空間で管理）
  disabled?: boolean; // フォルダ全体の無効化状態（空フォルダ時に使用）
}
export interface AppDesignSettings {
  zoom: number;               // global zoom (0.7–1.5, default 1.0)
  tabZoom: Record<string, number>;  // per-tab zoom overrides
  showTabZoomControls: boolean;     // show ± buttons on tabs
  theme: 'dark' | 'light';
  fontSizeMain: number;       // body/main text size in px (default 14)
  fontSizeSub: number;        // secondary/muted text size in px (default 12)
  enableTabPersistence: boolean; // keep tabs mounted to retain state/scroll
  gridDetailNoMaxHeight?: boolean; // remove max-height limit on GridTab detail panel
  gridWeaponFontSize?: number;  // font size for weapon kind text in GridTab
  fontFamilyMain?: string;
  fontFamilySub?: string;
  markFavoriteNoKeep?: boolean;     // Highlight locked AFs without keep flag
  hideFavoriteNoKeepIfMemo?: boolean; // Don't highlight them if they have a memo
  detailSkillNoWrap?: boolean;      // Detail view long skill names clipping
  showCriteriaSkillBadge?: boolean; // Show target skill badge on condition cards (default true)
  showCriteriaMethodBadge?: boolean; // Show method type badge on condition cards (default true)
  hideFavoriteNoKeepIfEquipped?: boolean; // Don't highlight them if they are equipped
  useLegacyM1Grid?: boolean; // Restore old UI for Method 1 quantity settings
  swapCriteriaDetailGrid?: boolean; // Swap rows/cols in criteria detail table
  dimCompletedCriteriaCells?: boolean; // Dim completed combinations
  criteriaDetailTableThreshold: number; // How many items before switching to table view (default 5)
  hideFavoriteNoKeepIfQuirky?: boolean; // Don't highlight them if they are Quirky (Rare)
  useWeaponIcons?: boolean;          // Display weapon type as icon in grid
  useWeaponIconsWithText?: boolean;  // Display weapon type as icon AND text in grid
  useWeaponIconsInTables?: boolean;  // Display weapon type as icon in tables
  statusColors?: ArtifactStatusColors; // Custom colors for grid footers
}

export const DEFAULT_DESIGN: AppDesignSettings = {
  zoom: 1,
  tabZoom: {},
  showTabZoomControls: false,
  theme: 'dark',
  fontSizeMain: 14,
  fontSizeSub: 12,
  gridWeaponFontSize: 19,
  enableTabPersistence: true,
  fontFamilyMain: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontFamilySub: "'Inter', 'Segoe UI', system-ui, sans-serif",
  gridDetailNoMaxHeight: true,
  detailSkillNoWrap: true,
  markFavoriteNoKeep: true,
  hideFavoriteNoKeepIfMemo: true,
  hideFavoriteNoKeepIfEquipped: true,
  showCriteriaSkillBadge: true,
  showCriteriaMethodBadge: true,
  swapCriteriaDetailGrid: false,
  dimCompletedCriteriaCells: true,
  useLegacyM1Grid: false,
  criteriaDetailTableThreshold: 5,
  useWeaponIcons: false,
  useWeaponIconsWithText: false,
  useWeaponIconsInTables: false,
  hideFavoriteNoKeepIfQuirky: true,
  statusColors: {
    fav: { bg: '#fbbf24', text: 'black' },
    trash: { bg: '#8b5cf6', text: 'white' },
    keep: { bg: '#3b82f6', text: 'white' },
    discard: { bg: '#ef4444', text: 'white' },
    conflict: { bg: '#d97706', text: 'white' },
  },
};

export interface ExceptionItem {
  id?: string; // added for D&D stability
  type?: 'item';
  conditionGroup: number;
  conditionSkillName: string | number;
  targetGroup: number;
  targetSkillName: string | number;
  scoreModifier: number;
  isSubtract?: boolean;
}

export interface ExceptionFolder {
  id: string;
  type: 'folder';
  name: string;
  isOpen: boolean;
  children: ExceptionItem[];
}

export interface Settings {
  id: string; // 'global'
  evaluationFormula: {
    group1Multiplier: number;
    group2Multiplier: number;
    group3Multiplier: number;
    skillMultipliers: Record<number, number>;
    qualityValues: Record<number, number>; // map quality level (1-5) to custom score value
    exceptions: Array<ExceptionItem | ExceptionFolder>;
    quirkyArtifactScores?: Record<number, number>; // map artifact_id to custom evaluation score
  };
  discardBehavior: {
    treatUnnecessaryAsDiscard: boolean;
    targetInventoryCount: number;
    protectLocked: boolean;
    protectKeepFlag: boolean;
    protectRareAF: boolean;  // protect rare AFs from discard flag
    protectEquipped: boolean; // protect equipped AFs from discard flag
    protectMemos?: boolean;   // protect AFs that have a memo associated with them
    protectLv5Skills?: boolean; // protect AFs that have any Lv5 skill
    protectedAttributes?: string[]; // e.g., ["fire", "water"]
  };
  design?: AppDesignSettings;   // UI design preferences
  httpPort?: number;            // Tauri HTTP server port (default 1422)
  language?: 'ja' | 'en';      // UI language (default 'ja')
  pageLimit?: number;          // Stored user preference for list items per page
  lastImportedAt?: string;     // ISO timestamp of the most recent AF data import
  notificationDuration?: number;   // Toast display duration in seconds (default: 3)
  notificationMaxCount?: number;   // Max simultaneous toasts (default: 1)
  saveWindowState?: boolean;       // Save and restore window size/position (default: true)
  windowState?: { width: number; height: number; x: number; y: number }; // Stored window geometry
}
