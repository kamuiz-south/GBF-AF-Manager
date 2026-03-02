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
  fontFamilyMain?: string;
  fontFamilySub?: string;
}

export const DEFAULT_DESIGN: AppDesignSettings = {
  zoom: 1,
  tabZoom: {},
  showTabZoomControls: false,
  theme: 'dark',
  fontSizeMain: 14,
  fontSizeSub: 12,
  enableTabPersistence: true,
  fontFamilyMain: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontFamilySub: "'Inter', 'Segoe UI', system-ui, sans-serif",
};

export interface Settings {
  id: string; // 'global'
  evaluationFormula: {
    group1Multiplier: number;
    group2Multiplier: number;
    group3Multiplier: number;
    skillMultipliers: Record<number, number>;
    qualityValues: Record<number, number>; // map quality level (1-5) to custom score value
    exceptions: Array<{
      conditionGroup: number;
      conditionSkillName: string;
      targetGroup: number;
      targetSkillName: string;
      scoreModifier: number;
    }>;
  };
  discardBehavior: {
    treatUnnecessaryAsDiscard: boolean;
    targetInventoryCount: number;
    protectLocked: boolean;
    protectKeepFlag: boolean;
    protectRareAF: boolean;  // protect rare AFs from discard flag
    protectEquipped: boolean; // protect equipped AFs from discard flag
    protectMemos?: boolean;   // protect AFs that have a memo associated with them
    protectedAttributes?: string[]; // e.g., ["fire", "water"]
  };
  design?: AppDesignSettings;   // UI design preferences
  httpPort?: number;            // Tauri HTTP server port (default 1422)
  language?: 'ja' | 'en';      // UI language (default 'ja')
  pageLimit?: number;          // Stored user preference for list items per page
}
