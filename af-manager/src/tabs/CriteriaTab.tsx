import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, RefreshCw, ChevronUp, ChevronDown, ChevronRight, Trash2, Filter, Copy, Folder, FolderOpen, FileText, Check, AlertTriangle, GripVertical } from 'lucide-react';
import { db } from '../db';
import type { AppArtifact, Condition, ConditionGroup } from '../types';
import { DEFAULT_DESIGN } from '../types';
import { runCriteriaMatcher } from '../utils/matcher';
import { useTranslation, type TranslationKey } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { translateSkill, reverseTranslateSkill } from '../utils/skillMapping';
import { getKindNamesShort, getAttributeOps, getKindOps, ATTRIBUTE_IDS, KIND_IDS } from '../data/constants';
import WeaponIcon from '../components/WeaponIcon';

// Move M1TableInput OUTSIDE to prevent re-mounting on every render
const M1TableInput = ({ value, onChange }: { value: number; onChange: (v: string) => void }) => {
    return (
        <input 
            type="text" 
            inputMode="numeric"
            className="input-m1-grid"
            style={{ 
                width: '100%', border: 'none', background: 'transparent', textAlign: 'center', padding: '1px', 
                fontSize: '15px', color: 'var(--text-main)', outline: 'none', fontWeight: 600,
                appearance: 'none', margin: 0
            }}
            value={value || ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                onChange(val);
            }}
        />
    );
};

export default function CriteriaTab() {
    const { t, language } = useTranslation();
    const showToast = useAppStore(state => state.showToast);
    const rawConditions = useLiveQuery(() => db.conditions.orderBy('priority').toArray());
    const rawGroups = useLiveQuery(() => db.groups.orderBy('order').toArray());
    const conditions = rawConditions || [];
    const groups = (rawGroups || []) as ConditionGroup[];
    const [isAdding, setIsAdding] = useState(false);
    const topRef = useRef<HTMLDivElement>(null);
    const editFormRef = useRef<HTMLDivElement>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('af-manager-collapsed-groups');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editGroupName, setEditGroupName] = useState('');

    const [methodType, setMethodType] = useState<1 | 2>(1);
    const [name, setName] = useState('');

    // Method 1 Form State
    // keys are "attr_kind", e.g. "1_1" for Fire Sword
    const [method1Grid, setMethod1Grid] = useState<Record<string, number>>({});

    // Method 2 Form State
    const [characterName, setCharacterName] = useState('');
    const [targetCountMethod2, setTargetCountMethod2] = useState(1);
    const [m2Attr, setM2Attr] = useState('1'); // Require 1
    const [m2Kind1, setM2Kind1] = useState('1'); // Require 1
    const [m2Kind2, setM2Kind2] = useState(''); // Optional 2nd

    // Shared Skills State
    const [skills, setSkills] = useState({ skill1: '', skill2: '', skill3: '', skill4: '' });
    const [skillMustMatch, setSkillMustMatch] = useState({ skill1: false, skill2: false, skill3: false, skill4: false });
    const [skillPriorities, setSkillPriorities] = useState<{ skill1: number | null, skill2: number | null, skill3: number | null, skill4: number | null }>({ skill1: null, skill2: null, skill3: null, skill4: null });
    const [invertSkill3Quality, setInvertSkill3Quality] = useState(false);
    const [excludeSkillsUI, setExcludeSkillsUI] = useState<{ id: string, group: 'G1' | 'G2' | 'G3', skill: string }[]>([]);
    const [excludeFavorites, setExcludeFavorites] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [selectedKeepAF, setSelectedKeepAF] = useState<AppArtifact | null>(null);
    const [condMemo, setCondMemo] = useState('');

    // D&D State (作業1)
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [draggedType, setDraggedType] = useState<'cond' | 'group' | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [dragOverPos, setDragOverPos] = useState<'top' | 'bottom' | 'inside' | null>(null);
    const [canDragItemId, setCanDragItemId] = useState<string | null>(null);

    const allArtifacts = useLiveQuery(() => db.artifacts.toArray()) || [];
    const dbSettings = useLiveQuery(() => db.settings.get('global'));
    const currentDesign = { ...DEFAULT_DESIGN, ...(dbSettings?.design ?? {}) };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        let effectiveCharacterName = characterName.trim();

        // Validation for Method 2
        if (methodType === 2) {
            if (!effectiveCharacterName) {
                const attrLabel = t(`ATTR_${m2Attr}` as TranslationKey);
                const kinds = getKindNamesShort(language);
                const k1 = kinds[m2Kind1] || '';
                const k2 = m2Kind2 ? kinds[m2Kind2] || '' : '';
                if (language === 'en') {
                    effectiveCharacterName = `${attrLabel} ${k1}${k2 ? '/' + k2 : ''} character`;
                } else {
                    effectiveCharacterName = `${attrLabel}${k1}${k2}キャラ`;
                }
            }
            if (m2Kind2 && m2Kind1 === m2Kind2) {
                showToast(language === 'en' ? 'The 2nd Weapon Kind cannot be the same as the 1st.' : '武器種2つ目に1つ目と同じものは選択できません。', 'error');
                return;
            }
        }

        // Validation for Method 1
        if (methodType === 1) {
            const sum = Object.values(method1Grid).reduce((a, b) => a + b, 0);
            if (sum <= 0) {
                showToast(language === 'en' ? 'Total target count is 0! Please set target counts for at least one cell.' : '確保マスの合計個数が0です！1つ以上のマスに目標個数を設定してください。', 'error');
                return;
            }
        }

        // Validate skill priorities (must be unique 1-4)
        const priorities = [skillPriorities.skill1, skillPriorities.skill2, skillPriorities.skill3, skillPriorities.skill4].filter(p => p !== null) as number[];
        const uniquePriorities = new Set(priorities);
        if (priorities.length !== uniquePriorities.size) {
            showToast(language === 'en' ? '☆ Priority numbers (1-4) cannot be duplicated.' : '☆優先度の数字(1〜4)は重複して設定できません', 'error');
            return;
        }

        const newCond: Condition = {
            id: editingId || crypto.randomUUID(),
            listId: editingId ? (conditions.find(c => c.id === editingId)?.listId || 'default') : 'default',
            priority: editingId ? (conditions.find(c => c.id === editingId)?.priority ?? conditions.length) : conditions.length,
            name: name || (methodType === 1 
                ? (language === 'en' ? `Condition ${conditions.length + 1}` : `条件 ${conditions.length + 1}`) 
                : (language === 'en' ? `For ${effectiveCharacterName}` : `${effectiveCharacterName} 用`)),
            methodType,
            targetCount: methodType === 1 ? { ...method1Grid } : {},
            characterName: effectiveCharacterName,
            attributes: methodType === 2 ? [m2Attr] : [],
            weaponKinds: methodType === 2 ? [m2Kind1] : [],
            weaponKinds2: methodType === 2 && m2Kind2 ? [m2Kind2] : [],
            targetCountMethod2,
            skills,
            excludeSkills: excludeSkillsUI.map(e => e.skill).filter(Boolean),
            skillPriorities,
            skillMustMatch,
            invertSkill3Quality,
            excludeFavorites,
            occupyKeepFlag: true,
            memo: condMemo || undefined,
        };
        await db.conditions.put(newCond);

        setIsAdding(false);
        setEditingId(null);

        // reset form
        setName('');
        setCharacterName('');
        setMethod1Grid({});
        setSkills({ skill1: '', skill2: '', skill3: '', skill4: '' });
        setSkillMustMatch({ skill1: false, skill2: false, skill3: false, skill4: false });
        setSkillPriorities({ skill1: null, skill2: null, skill3: null, skill4: null });
        setInvertSkill3Quality(false);
        setExcludeSkillsUI([]);
        setExcludeFavorites(false);
        setM2Kind2('');
        setCondMemo('');
    };

    const handleM1GridChange = (attr: string, kind: string, val: string) => {
        const num = parseInt(val);
        const key = `${attr}_${kind}`;
        setMethod1Grid(prev => {
            const next = { ...prev };
            if (isNaN(num) || num <= 0) {
                delete next[key];
            } else {
                next[key] = num;
            }
            return next;
        });
    };

    const handleGlobalM1Adjust = (delta: number) => {
        setMethod1Grid(prev => {
            const next = { ...prev };
            ATTRIBUTE_OPS.forEach(a => {
                KIND_OPS.forEach(k => {
                    const key = `${a.val}_${k.val}`;
                    const newVal = Math.max(0, (next[key] || 0) + delta);
                    if (newVal === 0) delete next[key];
                    else next[key] = newVal;
                });
            });
            return next;
        });
    };

    const namesShort = getKindNamesShort(language);
    const ATTRIBUTE_OPS = getAttributeOps(t);
    const KIND_OPS = getKindOps(t);

    const SKILL_OPTS_G1 = ["攻撃力", "HP", "クリティカル確率", "奥義ダメージ", "アビリティダメージ", "弱体成功率", "ダブルアタック確率", "トリプルアタック確率", "防御力", "弱体耐性", "回避率", "回復性能", "自属性攻撃力", "有利属性軽減"];
    const SKILL_OPTS_G2 = ["通常攻撃ダメージ上限", "アビリティダメージ上限", "奥義ダメージ上限", "通常攻撃の与ダメージ上昇", "アビリティ与ダメージ上昇", "奥義与ダメージ上昇", "奥義ダメージ特殊上限UP", "チェイン与ダメージUP", "ターンダメージを軽減", "再生", "HPが100%の時、与ダメージUP", "HPが50%以上の時、トリプルアタック確率UP", "HPが50%以下の時、被ダメージを軽減", "クリティカル発動時、ダメージ上限UP", "最大HP上昇/防御力-70%", "通常攻撃ダメージ上限UP/アビリティダメージ上限-80％/奥義ダメージ上限-60％", "アビリティダメージ上限UP/通常攻撃ダメージ上限-20％/奥義ダメージ上限-60％", "奥義ダメージ上限UP/通常攻撃ダメージ上限-20％/アビリティダメージ上限-80％", "確率で強化効果が無効化されない", "確率で攻撃開始時に自分の弱体効果を1つ回復"];
    const SKILL_OPTS_G3 = [
        "弱体アビリティ使用時、敵に被ダメージUP(2回)",
        "回復アビリティ使用時、自分の次に配置されたキャラに自属性追撃効果(1回)",
        "リンクアビリティを一定回数使用時に自分のリンクアビリティの再使用間隔を1ターン短縮",
        "使用間隔が10ターン以上のアビリティ使用時、自分に与ダメージUP",
        "アビリティを一定回数使用する度に自分にダメージ上限UP(累積)",
        "アビリティダメージを一定量与える毎に自分にアビリティ与ダメージ上昇(累積)",
        "1回攻撃発動時、自分に一定個数ランダムな強化効果",
        "ターン終了時、自分がそのターン中に消費したHPに応じて敵に無属性ダメージ",
        "ターン終了時、自分がそのターン中に消費した奥義ゲージ量に応じて自分に与ダメージ上昇",
        "攻撃開始時に敵の弱体効果の数が3つ以下の時、自分にブロック効果",
        "ターン終了時にHPが50%以下の敵がいる時、一度だけ自分のHPを回復",
        "サブメンバー時、一定ターン毎に敵全体にランダムな弱体効果を1つ付与(重複不可)",
        "一定回数敵の攻撃行動のターゲットになった場合、一度だけ自分に自属性追撃(1回)効果",
        "攻撃行動を行わなかった場合、ターン終了時に自分に一定個数ランダムな強化効果",
        "キュアポーションまたはオールポーション使用時にフェイタルチェインゲージUP(重複不可)",
        "敵に一定回数攻撃を与えた時、一度だけ自分に乱撃(3ヒット)効果(1回)",
        "戦闘不能になった時、一度だけ味方全体に一定個数ランダムな強化効果",
        "バトル登場時に一度だけ自分の与ダメージUP",
        "バトル開始時に自分に一定個数ランダムな強化効果",
        "バトル開始時から1ターンの間被ダメージ減少",
        "バトル開始時と5ターン毎に自分にバリア効果",
        "バトル開始時に最大HPの20%を消費するが3ターン後、自分にダメージ上限UP",
        "1番目のアビリティ使用時にHPを一定割合消費するが、1番目のアビリティの使用間隔を1ターン短縮(レベルに応じて消費割合DOWN)",
        "攻撃開始時、確率で自分に乱撃(6ヒット)効果(1回)",
        "確率でターンの進行時に経過ターンを5ターン進める(重複不可)",
        "ターン終了時、確率で敵の強化効果を全て無効化(重複不可)",
        "バトル終了時にランダムな耳飾りを入手することがある(レベルに応じて入手確率UP/重複不可)",
        "アイテムドロップ率UP(重複不可)",
        "獲得経験値UP(重複不可)",
    ];

    const handleRunMatcher = async () => {
        try {
            const allArtifacts = await db.artifacts.toArray();
            const updated = runCriteriaMatcher(allArtifacts, conditions);
            await db.artifacts.bulkPut(updated);
            showToast(language === 'en' ? 'Calculations complete, keep flags updated!' : '計算を実行し、確保フラグを更新しました！', 'success');
        } catch (e) {
            console.error(e);
            showToast(language === 'en' ? 'An error occurred during calculation.' : '計算中にエラーが発生しました。', 'error');
        }
    };

    // === 孤立データの自動修復 (Self-Healing on Load) ===
    useEffect(() => {
        // Wait until BOTH queries have initial results to avoid false "missing group" detection
        if (rawConditions === undefined || rawGroups === undefined) return;
        if (rawConditions.length === 0) return;

        const validGroupIds = new Set(rawGroups.map(g => g.id));
        const needsFix = rawConditions.filter(c => !c.listId || (c.listId !== 'default' && !validGroupIds.has(c.listId)));
        if (needsFix.length > 0) {
            const fixed = needsFix.map(c => ({ ...c, listId: 'default' }));
            db.conditions.bulkPut(fixed).catch(console.error);
        }
    }, [rawConditions, rawGroups]);


    // === 新しいブロック順序管理ロジック ===
    type BlockType = { type: 'group'; id: string; group: ConditionGroup; conds: Condition[]; topPriority: number; }
        | { type: 'ungrouped'; id: string; conds: Condition[]; topPriority: number; };

    const getBlocks = (): BlockType[] => {
        const blocks: BlockType[] = [];
        const seenGroups = new Set<string>();

        // 1. 各グループのブロックを作る
        for (const g of groups) {
            const inGroup = conditions.filter(c => c.listId === g.id).sort((a, b) => a.priority - b.priority);
            // グループが空の場合は仮想的に大きい優先度を設定（後に追加順等で並ぶ）
            const topP = inGroup.length > 0 ? inGroup[0].priority : 99999 + g.order;
            blocks.push({ type: 'group', id: g.id, group: g, conds: inGroup, topPriority: topP });
            seenGroups.add(g.id);
        }

        // 2. 未分類条件（および存在しないフォルダに所属している「迷子」の条件）のブロックを作る
        const ungrouped = conditions.filter(c => !c.listId || c.listId === 'default' || (c.listId !== 'default' && !seenGroups.has(c.listId))).sort((a, b) => a.priority - b.priority);
        for (const c of ungrouped) {
            blocks.push({ type: 'ungrouped', id: c.id, conds: [c], topPriority: c.priority });
        }

        // 3. 全体を topPriority 順にソート (これが画面上のトップレベルの並びとなる)
        blocks.sort((a, b) => a.topPriority - b.topPriority);
        return blocks;
    };

    const saveBlocksOrder = async (blocks: BlockType[]) => {
        let p = 0;
        let gOrder = 0;
        const condUpdates: Condition[] = [];
        const groupUpdates: ConditionGroup[] = [];

        for (const b of blocks) {
            if (b.type === 'group') {
                groupUpdates.push({ ...b.group, order: gOrder++ });
                for (const c of b.conds) {
                    condUpdates.push({ ...c, priority: p++, listId: b.id });
                }
            } else {
                for (const c of b.conds) {
                    condUpdates.push({ ...c, priority: p++, listId: 'default' });
                }
            }
        }
        if (condUpdates.length > 0) await db.conditions.bulkPut(condUpdates);
        if (groupUpdates.length > 0) await db.groups.bulkPut(groupUpdates);
    };

    const moveBlock = async (blockIndex: number, delta: -1 | 1) => {
        const blocks = getBlocks();
        const target = blockIndex + delta;
        if (target < 0 || target >= blocks.length) return;
        const temp = blocks[blockIndex];
        blocks[blockIndex] = blocks[target];
        blocks[target] = temp;
        await saveBlocksOrder(blocks);
    };

    const moveIntraGroup = async (groupId: string, condId: string, delta: -1 | 1) => {
        const blocks = getBlocks();
        const groupBlock = blocks.find(b => b.type === 'group' && b.id === groupId);
        if (!groupBlock) return;
        const conds = groupBlock.conds;
        const idx = conds.findIndex(c => c.id === condId);
        if (idx === -1) return;
        const target = idx + delta;
        if (target < 0 || target >= conds.length) return;
        const temp = conds[idx];
        conds[idx] = conds[target];
        conds[target] = temp;
        await saveBlocksOrder(blocks);
    };

    const handleDelete = async (id: string) => {
        await db.conditions.delete(id);
    };

    const handleCopy = async (c: Condition) => {
        const copyCond: Condition = {
            ...c,
            id: crypto.randomUUID(),
            priority: conditions.length,
            name: `${c.name} ${language === 'en' ? '(Copy)' : ' - コピー'}`,
        };
        await db.conditions.put(copyCond);
    };

    const handleEdit = (c: Condition) => {
        setEditingId(c.id);
        setName(c.name);
        setMethodType(c.methodType);
        setCharacterName(c.characterName || '');
        setTargetCountMethod2(c.targetCountMethod2 || 1);
        setM2Attr(c.attributes?.[0] || '1');
        setM2Kind1(c.weaponKinds?.[0] || '1');
        setM2Kind2(c.weaponKinds2?.[0] || '');
        setMethod1Grid(c.targetCount || {});
        setSkills(c.skills || { skill1: '', skill2: '', skill3: '', skill4: '' });
        setSkillMustMatch(c.skillMustMatch || { skill1: false, skill2: false, skill3: false, skill4: false });
        setSkillPriorities(c.skillPriorities || { skill1: null, skill2: null, skill3: null, skill4: null });
        setInvertSkill3Quality(c.invertSkill3Quality || false);
        setExcludeFavorites(c.excludeFavorites || false);

        const initExcludeUI = (c.excludeSkills || []).map(skillName => {
            let group: 'G1' | 'G2' | 'G3' = 'G1';
            if (SKILL_OPTS_G2.includes(skillName)) group = 'G2';
            else if (SKILL_OPTS_G3.includes(skillName)) group = 'G3';
            return { id: crypto.randomUUID(), group, skill: skillName };
        });
        setExcludeSkillsUI(initExcludeUI);

        setCondMemo(c.memo || '');
        setIsAdding(true);
        // Scroll specifically to the edit form header
        setTimeout(() => {
            editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
        setEditingId(null);
        setName('');
        setCharacterName('');
        setMethod1Grid({});
        setSkills({ skill1: '', skill2: '', skill3: '', skill4: '' });
        setSkillMustMatch({ skill1: false, skill2: false, skill3: false, skill4: false });
        setSkillPriorities({ skill1: null, skill2: null, skill3: null, skill4: null });
        setInvertSkill3Quality(false);
        setExcludeSkillsUI([]);
        setExcludeFavorites(false);
        setM2Kind2('');
        setCondMemo('');
    };

    const handleToggleDisabled = async (c: Condition) => {
        await db.conditions.put({ ...c, disabled: !c.disabled });
    };

    const handleAddGroup = async () => {
        const trimmed = newGroupName.trim();
        if (!trimmed) return;
        await db.groups.put({ id: crypto.randomUUID(), name: trimmed, order: groups.length });
        setNewGroupName('');
    };

    const handleRenameGroup = (group: ConditionGroup) => {
        setEditingGroupId(group.id);
        setEditGroupName(group.name);
    };

    const submitGroupRename = async () => {
        if (!editingGroupId) return;
        const trimmed = editGroupName.trim();
        if (trimmed) {
            const group = groups.find(g => g.id === editingGroupId);
            if (group) await db.groups.put({ ...group, name: trimmed });
        }
        setEditingGroupId(null);
        setEditGroupName('');
    };

    const handleDeleteGroupOnly = async (group: ConditionGroup) => {
        const affected = conditions.filter(c => c.listId === group.id);
        if (affected.length > 0) await db.conditions.bulkPut(affected.map(c => ({ ...c, listId: 'default' })));
        await db.groups.delete(group.id);
        setDeletingGroupId(null);
    };

    const handleDeleteGroupAndConds = async (group: ConditionGroup) => {
        const affectedCount = conditions.filter(c => c.listId === group.id).length;
        const confirmMsg = language === 'en' 
            ? `Are you sure you want to delete folder "${group.name}" and all ${affectedCount} conditions inside?` 
            : `フォルダ「${group.name}」と、その中の全${affectedCount}件の条件をすべて削除してよろしいですか？`;
        
        if (window.confirm(confirmMsg)) {
            const affected = conditions.filter(c => c.listId === group.id);
            if (affected.length > 0) {
                await db.conditions.bulkDelete(affected.map(c => c.id));
            }
            await db.groups.delete(group.id);
            setDeletingGroupId(null);
        }
    };

    const handleMoveConditionToGroup = async (cond: Condition, newListId: string) => {
        await db.conditions.put({ ...cond, listId: newListId });
    };

    const handleToggleGroupDisabled = async (groupConds: Condition[]) => {
        if (groupConds.length === 0) return;
        const isAllDisabled = groupConds.every(c => c.disabled);
        const nextState = !isAllDisabled;
        const updated = groupConds.map(c => ({ ...c, disabled: nextState }));
        await db.conditions.bulkPut(updated);
    };

    const toggleGroupCollapse = (groupId: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
            try {
                localStorage.setItem('af-manager-collapsed-groups', JSON.stringify([...next]));
            } catch (e) {
                console.error("Failed to save collapsed groups", e);
            }
            return next;
        });
    };

    // ... handled by moveBlock / moveIntraGroup

    return (
        <div ref={topRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', maxWidth: '900px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: 'calc(var(--font-size-main) * 1.8)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)' }}>
                        <Filter /> {language === 'en' ? 'Target AF Criteria Settings' : '欲しいAFの条件設定'}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)', margin: 0 }}>
                        {language === 'en' ? 'Add conditions and sort them so higher priorities are at the top.' : '条件を追加し、確保優先度の高いものが上になるように並びかえてください。'}
                    </p>
                </div>
                <button className="btn btn-calc-glow" onClick={handleRunMatcher} style={{ padding: '0.45rem 1rem', fontSize: 'calc(var(--font-size-main) * 0.95)' }}>
                    <RefreshCw size={16} style={{ marginRight: '0.4rem' }} /> {language === 'en' ? 'Calculate Keep Flags' : '確保フラグの一括計算'}
                </button>
            </header>

            {/* Conditions List */}
            <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)' }}>
                        {language === 'en' ? 'Target Priority List' : '条件優先度リスト'}
                        {conditions.length > 0 && (() => {
                            const totalKeptCount = allArtifacts.filter(a => !!a.keepFlag).length;
                            const activeKeptCount = allArtifacts.filter(a => {
                                if (!a.keepFlag) return false;
                                return conditions.some(c => c.id === a.keepFlag && !c.disabled);
                            }).length;
                            const activeCap = conditions.filter(c => !c.disabled).reduce((sum, c) => {
                                if (c.methodType === 1) return sum + Object.values(c.targetCount).reduce((a, b) => a + b, 0);
                                return sum + (c.targetCountMethod2 || 0);
                            }, 0);
                            const totalCap = conditions.reduce((sum, c) => {
                                if (c.methodType === 1) return sum + Object.values(c.targetCount).reduce((a, b) => a + b, 0);
                                return sum + (c.targetCountMethod2 || 0);
                            }, 0);
                            const percent = activeCap > 0 ? Math.floor((activeKeptCount / activeCap) * 100) : 0;
                            const hasDisabled = activeCap !== totalCap;
                            return (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginLeft: '1rem' }}>
                                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', fontWeight: 400 }}>
                                        {language === 'en' ? 'Keep Rate:' : '確保率:'} {percent}%
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                                        {Array.from({ length: 10 }, (_, i) => {
                                            const blockFill = percent - i * 10;
                                            const blockPercent = Math.max(0, Math.min(1, blockFill / 10));
                                            
                                            const isFilled = blockPercent > 0;
                                            const bg = isFilled ? 'var(--text-main)' : 'var(--text-muted)';
                                            const op = 0.2 + (0.85 - 0.2) * blockPercent;

                                            return (
                                                <div key={i} style={{
                                                    width: '4px', height: '12px',
                                                    background: bg,
                                                    opacity: op,
                                                    borderRadius: '1px',
                                                    transition: 'opacity 0.3s ease, background-color 0.3s ease',
                                                }} />
                                            );
                                        })}
                                    </div>
                                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', fontWeight: 400 }}>
                                        {activeKeptCount}{language === 'en' ? ' / ' : '件 / '}{activeCap}{language === 'en' ? ' AFs' : '件'}
                                    </span>
                                    {activeCap >= 1500 && (
                                        <span
                                            title={language === 'en'
                                                ? 'Active target count has reached the in-game inventory limit (1500)'
                                                : '有効な確保対象の合計数がゲーム内の所持上限（1500）に達しています'}
                                            style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}
                                        >
                                            <AlertTriangle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        </span>
                                    )}
                                    {hasDisabled && (
                                        <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.92)', color: 'var(--text-muted)', fontWeight: 400, opacity: 0.5 }}>
                                            （{language === 'en' ? 'Total: ' : '全体: '}{totalKeptCount}{language === 'en' ? ' / ' : ' / '}{totalCap}{language === 'en' ? ' AFs' : '件'}）
                                        </span>
                                    )}
                                </div>
                            );
                        })()}
                    </h3>
                    <button className="btn btn-ghost" onClick={() => setIsAdding(!isAdding)} style={{ border: '1px solid var(--panel-border)' }}>
                        <Plus size={16} /> {language === 'en' ? 'Add Condition' : '条件を追加'}
                    </button>
                </div>

                {isAdding && (
                    <div ref={editFormRef} style={{ background: 'var(--criteria-new-bg)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid var(--accent-blue)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                            <h4 style={{ margin: 0, color: 'var(--accent-blue-hover)' }}>{editingId ? (language === 'en' ? 'Edit Condition' : '条件の編集') : (language === 'en' ? 'Create New Condition' : '新規条件の作成')}</h4>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                                    <input type="radio" checked={methodType === 1} onChange={() => setMethodType(1)} /> {language === 'en' ? 'Method 1: Skill Oriented' : '方法1：スキル指向'}
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                                    <input type="radio" checked={methodType === 2} onChange={() => setMethodType(2)} /> {language === 'en' ? 'Method 2: Character Oriented' : '方法2：キャラ指向'}
                                </label>
                            </div>
                        </div>

                        <input className="input" placeholder={language === 'en' ? 'Condition Name (Optional)' : '条件名 (任意)'} value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: '0.8rem', width: '100%' }} />

                        {methodType === 1 ? (
                            <div style={{ marginBottom: '0.8rem' }}>
                                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>{language === 'en' ? 'Enter the target number of AFs in the Element x Weapon Kind cells (blanks are treated as 0)' : '確保したい属性×武器種のマスに目標個数を入力してください（未入力は0扱い）'}</p>
                                
                                {currentDesign.useLegacyM1Grid ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                                        {ATTRIBUTE_OPS.map(a => (
                                            <div key={a.val} style={{ border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0.8rem', background: 'var(--dim-bg)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', borderBottom: '1px solid var(--dim-border)', paddingBottom: '0.4rem' }}>
                                                    <h5 style={{ margin: 0, color: 'var(--text-main)' }}>{a.label}{language === 'en' ? '' : '属性'}</h5>
                                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                        <button type="button" className="btn btn-ghost"
                                                            style={{ fontSize: 'calc(var(--font-size-sub) * 0.8)', padding: '1px 6px', border: '1px solid var(--panel-border)' }}
                                                            onClick={() => KIND_OPS.forEach(k => handleM1GridChange(a.val, k.val, String(Math.max(0, (method1Grid[`${a.val}_${k.val}`] || 0) - 1))))}
                                                        >{language === 'en' ? 'All -1' : '全-1'}</button>
                                                        <button type="button" className="btn btn-ghost"
                                                            style={{ fontSize: 'calc(var(--font-size-sub) * 0.8)', padding: '1px 6px', border: '1px solid var(--panel-border)' }}
                                                            onClick={() => KIND_OPS.forEach(k => handleM1GridChange(a.val, k.val, String((method1Grid[`${a.val}_${k.val}`] || 0) + 1)))}
                                                        >{language === 'en' ? 'All +1' : '全+1'}</button>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                                        {KIND_OPS.map(k => (
                                                            <div key={k.val} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', width: '30px' }}>{k.label}</span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-ghost hover-action-btn"
                                                                        title={language === 'en' ? 'Decrease' : '減らす'}
                                                                        style={{ padding: '0.1rem 0.3rem', fontSize: '1rem', lineHeight: '1.2' }}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            const current = method1Grid[`${a.val}_${k.val}`] || 0;
                                                                            if (current > 0) handleM1GridChange(a.val, k.val, String(current - 1));
                                                                        }}
                                                                    >-</button>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="input no-spinner"
                                                                        style={{ width: '32px', padding: '0.2rem', textAlign: 'center', fontSize: 'var(--font-size-sub)' }}
                                                                        value={method1Grid[`${a.val}_${k.val}`] || ''}
                                                                        onChange={e => handleM1GridChange(a.val, k.val, e.target.value)}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-ghost hover-action-btn"
                                                                        title={language === 'en' ? 'Increase' : '増やす'}
                                                                        style={{ padding: '0.1rem 0.3rem', fontSize: '1rem', lineHeight: '1.2' }}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            const current = method1Grid[`${a.val}_${k.val}`] || 0;
                                                                            handleM1GridChange(a.val, k.val, String(current + 1));
                                                                        }}
                                                                    >+</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto', background: 'var(--dim-bg)', borderRadius: '12px', border: '1px solid var(--panel-border)', padding: '0.4rem' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '460px', tableLayout: 'fixed' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '0.2rem 0', border: 'none', width: '30px', background: 'transparent' }}></th>
                                                    <th style={{ padding: '0.2rem 0', borderBottom: '2px solid var(--panel-border)', width: '60px', color: 'var(--text-main)', fontSize: '12.5px', fontWeight: 400 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                                            <button type="button" className="btn btn-ghost" 
                                                                style={{ padding: 0, fontSize: '0.95rem', width: '18px', height: '18px', border: 'none', background: 'transparent' }}
                                                                onClick={(e) => { e.stopPropagation(); handleGlobalM1Adjust(-1); }}>-</button>
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>ALL</span>
                                                            <button type="button" className="btn btn-ghost" 
                                                                style={{ padding: 0, fontSize: '0.95rem', width: '18px', height: '18px', border: 'none', background: 'transparent' }}
                                                                onClick={(e) => { e.stopPropagation(); handleGlobalM1Adjust(1); }}>+</button>
                                                        </div>
                                                    </th>
                                                    {KIND_OPS.map(k => (
                                                        <th key={k.val} style={{ padding: '0.3rem 0', fontSize: '12.5px', color: 'var(--text-main)', borderBottom: '2px solid var(--panel-border)', fontWeight: 400 }}>
                                                            {currentDesign.useWeaponIconsInTables ? (
                                                                <WeaponIcon kind={k.val} size="1.5em" style={{ verticalAlign: 'middle' }} />
                                                            ) : (
                                                                namesShort[k.val] || k.label
                                                            )}
                                                        </th>
                                                    ))}
                                                    <th style={{ padding: '0.2rem 0', border: 'none', width: '30px', background: 'transparent' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ATTRIBUTE_OPS.map((a, idx) => (
                                                    <tr key={a.val}>
                                                        <td style={{ padding: '0.1rem', textAlign: 'center', border: 'none', background: 'transparent' }}>
                                                            <button type="button" className="btn btn-ghost"
                                                                style={{ padding: 0, fontSize: '1rem', width: '24px', height: '24px', border: 'none', background: 'transparent' }}
                                                                onClick={() => KIND_OPS.forEach(k => handleM1GridChange(a.val, k.val, String(Math.max(0, (method1Grid[`${a.val}_${k.val}`] || 0) - 1))))}
                                                            >-</button>
                                                        </td>
                                                        <td style={{ padding: '0.3rem', fontSize: '12.5px', fontWeight: 400, color: 'var(--text-main)', textAlign: 'center', background: idx % 2 === 0 ? 'var(--zebra-even)' : 'var(--zebra-odd)', borderBottom: '1px solid var(--dim-border)', borderLeft: '1px solid var(--dim-border)' }}>
                                                            {a.label}
                                                        </td>
                                                        {KIND_OPS.map(k => (
                                                            <td key={k.val} style={{ padding: '1px', border: '1px solid var(--dim-border)', borderTop: 'none', background: (method1Grid[`${a.val}_${k.val}`] || 0) > 0 ? 'rgba(59,130,246,0.1)' : (idx % 2 === 0 ? 'var(--zebra-even)' : 'var(--zebra-odd)') }}>
                                                                <M1TableInput 
                                                                    value={method1Grid[`${a.val}_${k.val}`] || 0}
                                                                    onChange={(val) => handleM1GridChange(a.val, k.val, val)}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td style={{ padding: '0.1rem', textAlign: 'center', border: 'none', background: 'transparent' }}>
                                                            <button type="button" className="btn btn-ghost"
                                                                style={{ padding: 0, fontSize: '1rem', width: '24px', height: '24px', border: 'none', background: 'transparent' }}
                                                                onClick={() => KIND_OPS.forEach(k => handleM1GridChange(a.val, k.val, String((method1Grid[`${a.val}_${k.val}`] || 0) + 1)))}
                                                            >+</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '0.8rem', background: 'var(--dim-bg)', padding: '0.8rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                                    <input className="input" placeholder={language === 'en' ? 'Character Name (for display only)' : 'キャラクター名 (表示用)'} value={characterName} onChange={e => setCharacterName(e.target.value)} style={{ flex: 1 }} />
                                    <input type="number" className="input" min="1" value={targetCountMethod2} onChange={e => setTargetCountMethod2(parseInt(e.target.value))} placeholder={language === 'en' ? 'Count' : '確保個数'} style={{ width: '80px' }} />
                                    {language === 'en' ? null : <span style={{ fontSize: 'var(--font-size-main)' }}>個</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                                    <select className="input" value={m2Attr} onChange={e => setM2Attr(e.target.value)} style={{ width: '110px' }}>
                                        {ATTRIBUTE_OPS.map(o => <option key={`m2a-${o.val}`} value={o.val}>{o.label}{language === 'en' ? '' : '属性'}</option>)}
                                    </select>
                                    <select className="input" value={m2Kind1} onChange={e => setM2Kind1(e.target.value)} style={{ width: '110px' }}>
                                        {KIND_OPS.map(o => <option key={`m2k1-${o.val}`} value={o.val}>{o.label}</option>)}
                                    </select>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)' }}>{language === 'en' ? 'or' : 'または'}</span>
                                    <select className="input" value={m2Kind2} onChange={e => setM2Kind2(e.target.value)} style={{ width: '110px' }}>
                                        <option value="">{language === 'en' ? '(None)' : '(指定なし)'}</option>
                                        {KIND_OPS.map(o => <option key={`m2k2-${o.val}`} value={o.val}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '0.8rem' }}>
                            <h5 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{language === 'en' ? 'Target Skills (At least 1 required)' : '希望スキル設定 (最低1つは入力必須)'}</h5>

                            <datalist id="skill-list-g1">{SKILL_OPTS_G1.map(s => <option key={s} value={language === 'en' ? translateSkill(s, language) : s} />)}</datalist>
                            <datalist id="skill-list-g2">{SKILL_OPTS_G2.map(s => <option key={s} value={language === 'en' ? translateSkill(s, language) : s} />)}</datalist>
                            <datalist id="skill-list-g3">{SKILL_OPTS_G3.map(s => <option key={s} value={language === 'en' ? translateSkill(s, language) : s} />)}</datalist>

                            {[1, 2, 3, 4].map(num => {
                                const k = `skill${num}` as keyof typeof skills;
                                const isG1 = num === 1 || num === 2;
                                const groupName = isG1 ? 'G1' : (num === 3 ? 'G2' : 'G3');
                                const listId = isG1 ? 'skill-list-g1' : (num === 3 ? 'skill-list-g2' : 'skill-list-g3');

                                return (
                                    <div key={k} style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.4rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                                        <div style={{ width: '60px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.1 }}>{language === 'en' ? `Skill ${num}` : `スキル${num}`} <br /><small>({groupName})</small></div>
                                        <input
                                            className="input"
                                            list={listId}
                                            placeholder={language === 'en' ? 'Skill Name (Optional)' : `スキル名 (空欄可)`}
                                            value={language === 'en' ? translateSkill(skills[k], language) : skills[k]}
                                            onChange={e => {
                                                let val = e.target.value;
                                                if (language === 'en') {
                                                    val = reverseTranslateSkill(val, language);
                                                }
                                                setSkills({ ...skills, [k]: val });
                                            }}
                                            onBlur={(e) => {
                                                if (e.target.value.trim() === '') {
                                                    setSkillPriorities(prev => ({ ...prev, [k]: null }));
                                                    setSkillMustMatch(prev => ({ ...prev, [k]: false }));
                                                }
                                            }}
                                            style={{ flex: 1 }}
                                        />
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', minWidth: '90px' }}>
                                            <input
                                                type="checkbox"
                                                checked={skillMustMatch[k]}
                                                onChange={e => setSkillMustMatch({ ...skillMustMatch, [k]: e.target.checked })}
                                                disabled={!skills[k]}
                                            />
                                            <span style={{ fontSize: 'var(--font-size-sub)', color: skills[k] ? 'inherit' : 'var(--text-muted)' }}>{language === 'en' ? 'Must Match' : '必須にする'}</span>
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ fontSize: 'var(--font-size-sub)', color: skills[k] ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{language === 'en' ? '☆Priority:' : '☆優先順位:'}</span>
                                            <select
                                                className="input"
                                                style={{ width: '65px', padding: '0.2rem 0.4rem', textAlign: 'center' }}
                                                value={skillPriorities[k] ?? ''}
                                                onChange={e => {
                                                    const val = e.target.value === '' ? null : parseInt(e.target.value);
                                                    setSkillPriorities({ ...skillPriorities, [k]: val });
                                                }}
                                                disabled={!skills[k]}
                                            >
                                                <option value="">---</option>
                                                <option value="1">1</option>
                                                <option value="2">2</option>
                                                <option value="3">3</option>
                                                <option value="4">4</option>
                                            </select>
                                        </div>
                                        <button
                                            title={language === 'en' ? 'Reset this skill row' : 'このスキル行をリセット'}
                                            onClick={() => {
                                                setSkills({ ...skills, [k]: '' });
                                                setSkillMustMatch({ ...skillMustMatch, [k]: false });
                                                setSkillPriorities({ ...skillPriorities, [k]: null });
                                                if (k === 'skill3') setInvertSkill3Quality(false);
                                            }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem', flexShrink: 0, opacity: skills[k] ? 1 : 0.3 }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                );
                            })}

                            {skills.skill3 === "最大HP上昇/防御力-70%" && (
                                <div style={{ marginTop: '-0.4rem', marginBottom: '1.2rem', padding: '0.6rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                                        <input
                                            type="checkbox"
                                            checked={invertSkill3Quality}
                                            onChange={e => setInvertSkill3Quality(e.target.checked)}
                                        />
                                        <span style={{ fontSize: 'var(--font-size-sub)' }}>
                                            {language === 'en'
                                                ? 'Invert quality sorting for "Max HP boost for a 70% hit to DEF"'
                                                : '「最大HP上昇/防御力-70%」の☆評価を逆転させる（☆が少ないものを優先確保する）'}
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>
                        {/* Exclude Skills */}
                        <div style={{ marginBottom: '0.8rem', marginTop: '0.8rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                                <h5 style={{ fontSize: 'var(--font-size-main)', margin: 0, color: 'var(--text-muted)' }}>{language === 'en' ? 'Exclude Target Skills' : '除外スキル設定'}</h5>
                                <button className="btn btn-ghost" onClick={() => setExcludeSkillsUI([...excludeSkillsUI, { id: crypto.randomUUID(), group: 'G1', skill: '' }])} style={{ fontSize: 'var(--font-size-sub)', padding: '0.15rem 0.5rem', border: '1px solid var(--panel-border)' }}>
                                    <Plus size={14} /> {language === 'en' ? 'Add Exclude Skill' : '除外スキルを追加'}
                                </button>
                            </div>

                            {excludeSkillsUI.map((item, idx) => {
                                const listId = item.group === 'G1' ? 'skill-list-g1' : (item.group === 'G2' ? 'skill-list-g2' : 'skill-list-g3');
                                return (
                                    <div key={item.id} style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.6rem', alignItems: 'center' }}>
                                        <select
                                            className="input"
                                            value={item.group}
                                            onChange={e => {
                                                const newEx = [...excludeSkillsUI];
                                                newEx[idx].group = e.target.value as 'G1' | 'G2' | 'G3';
                                                newEx[idx].skill = ''; // reset skill on group change
                                                setExcludeSkillsUI(newEx);
                                            }}
                                            style={{ width: '80px', padding: '0.3rem' }}
                                        >
                                            <option value="G1">G1</option>
                                            <option value="G2">G2</option>
                                            <option value="G3">G3</option>
                                        </select>
                                        <input
                                            className="input"
                                            list={listId}
                                            placeholder={language === 'en' ? 'Skill to exclude (Optional)' : `除外スキル (空欄可)`}
                                            value={language === 'en' ? translateSkill(item.skill, language) : item.skill}
                                            onChange={e => {
                                                let val = e.target.value;
                                                if (language === 'en') {
                                                    val = reverseTranslateSkill(val, language);
                                                }
                                                const newEx = [...excludeSkillsUI];
                                                newEx[idx].skill = val;
                                                setExcludeSkillsUI(newEx);
                                            }}
                                            style={{ flex: 1, padding: '0.3rem 0.6rem' }}
                                        />
                                        <button
                                            title={language === 'en' ? 'Remove' : '削除'}
                                            onClick={() => {
                                                const newEx = [...excludeSkillsUI];
                                                newEx.splice(idx, 1);
                                                setExcludeSkillsUI(newEx);
                                            }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)', padding: '0.2rem', opacity: 0.8 }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Memo field */}
                        <div style={{ marginTop: '0.6rem' }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                                📝 {language === 'en' ? 'Memo (Optional)' : 'メモ（任意）'}
                            </label>
                            <textarea
                                className="input"
                                style={{ width: '100%', height: '56px', resize: 'vertical', fontFamily: 'inherit', fontSize: 'var(--font-size-main)' }}
                                placeholder={language === 'en' ? 'Enter notes or remarks for this condition...' : 'この条件へのメモや備考などを入力できます...'}
                                value={condMemo}
                                onChange={e => setCondMemo(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', padding: '0 0.2rem' }}>
                                <input
                                    type="checkbox"
                                    checked={excludeFavorites}
                                    onChange={e => setExcludeFavorites(e.target.checked)}
                                />
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                    {language === 'en' ? 'Exclude favorited AFs from matching' : 'お気に入りのAFを条件合致から除外'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn btn-ghost" onClick={handleCancelAdd}>{language === 'en' ? 'Cancel' : 'キャンセル'}</button>
                                <button className="btn btn-primary" onClick={handleSave}>{editingId ? (language === 'en' ? 'Save Changes' : '保存する') : (language === 'en' ? 'Add Condition' : '追加する')}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Group management bar */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <input
                        className="input"
                        style={{ flex: 1, padding: '0.3rem 0.6rem', fontSize: 'var(--font-size-sub)' }}
                        placeholder={language === 'en' ? 'New folder name...' : '新しいフォルダ名...'}
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddGroup(); }}
                    />
                    <button className="btn btn-ghost" onClick={handleAddGroup} disabled={!newGroupName.trim()} style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--font-size-sub)', whiteSpace: 'nowrap', border: '1px solid var(--panel-border)' }}>
                        + {language === 'en' ? 'Add Folder' : 'フォルダ追加'}
                    </button>
                </div>

                {/* Condition list – inline priority-order rendering */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                        // Map to flattened RenderItem based on blocks
                        const blocks = getBlocks();
                        let displayNumCounter = 1;

                        type CondRenderItem = { kind?: 'cond'; cond: Condition; blockIndex: number; isIntraGroup: boolean; intraIndex: number; intraCount: number; displayNum: number; parentDisabled?: boolean };

                        const renderCondCard = (item: CondRenderItem) => {
                            const { cond: c, blockIndex, isIntraGroup, intraIndex, intraCount, displayNum, parentDisabled } = item;
                            // No need to check collapsedGroups here, as the `items` array already filters them out
                            const isExpanded = expandedIds.has(c.id);
                            
                            const applyDimming = c.disabled && !parentDisabled;

                            return (
                                // STEP3: ラッパーdiv – D&DイベントとpaddingBottomでgapを再現
                                <div key={c.id}
                                    draggable={canDragItemId === c.id}
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'cond', id: c.id, listId: c.listId || 'default' }));
                                        setDraggedId(c.id);
                                        setDraggedType('cond');
                                    }}
                                    onDragEnd={() => {
                                        setCanDragItemId(null);
                                        setDraggedId(null);
                                        setDraggedType(null);
                                        setDragOverId(null);
                                        setDragOverPos(null);
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const relY = (e.clientY - rect.top) / rect.height;
                                        const pos = relY < 0.5 ? 'top' : 'bottom';

                                        setDragOverId(c.id);
                                        if (draggedId === c.id) {
                                            setDragOverPos(null);
                                        } else {
                                            // STEP4.1: 無移動判定
                                            let isNoMove = false;
                                            if (draggedType === 'cond') {
                                                const sourceBlock = blocks.find(b => b.conds.some(cc => cc.id === draggedId));
                                                const targetBlock = blocks[blockIndex];
                                                if (sourceBlock && targetBlock && sourceBlock.id === targetBlock.id) {
                                                    // 同一グループ内
                                                    const sIdx = sourceBlock.conds.findIndex(cc => cc.id === draggedId);
                                                    if (pos === 'top' && intraIndex === sIdx + 1) isNoMove = true;
                                                    if (pos === 'bottom' && intraIndex === sIdx - 1) isNoMove = true;
                                                } else {
                                                    // グループ跨ぎ or トップレベル
                                                    const sBlockIdx = blocks.findIndex(b => b.id === draggedId);
                                                    if (sBlockIdx !== -1) {
                                                        // ターゲットが独立したカード（非グループ内）の場合のみ、トップレベルでの隣接判定を適用
                                                        if (!isIntraGroup) {
                                                            if (pos === 'top' && blockIndex === sBlockIdx + 1) isNoMove = true;
                                                            if (pos === 'bottom' && blockIndex === sBlockIdx - 1) isNoMove = true;
                                                        }
                                                    }
                                                }
                                            } else if (draggedType === 'group') {
                                                // グループを掴んでいる場合、他のグループの「中」や「条件カード間」には表示しない
                                                if (isIntraGroup) {
                                                    isNoMove = true;
                                                } else {
                                                    const sBlockIdx = blocks.findIndex(b => b.id === draggedId);
                                                    if (sBlockIdx !== -1) {
                                                        if (pos === 'top' && blockIndex === sBlockIdx + 1) isNoMove = true;
                                                        if (pos === 'bottom' && blockIndex === sBlockIdx - 1) isNoMove = true;
                                                    }
                                                }
                                            }
                                            setDragOverPos(isNoMove ? null : pos);
                                        }
                                    }}
                                    onDragLeave={(e) => {
                                        // 子要素への移動はleaveとして扱わない
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                            setDragOverId(null);
                                            setDragOverPos(null);
                                        }
                                    }}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const pos = dragOverPos;
                                        setDragOverId(null);
                                        setDragOverPos(null);
                                        if (!pos || !draggedId || draggedId === c.id) return;

                                        try {
                                            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                                            const currentBlocks = getBlocks();

                                            if (data.type === 'cond') {
                                                let draggedCond: Condition | null = null;
                                                for (const b of currentBlocks) {
                                                    const idx = b.conds.findIndex(cc => cc.id === data.id);
                                                    if (idx !== -1) {
                                                        draggedCond = b.conds.splice(idx, 1)[0];
                                                        break;
                                                    }
                                                }
                                                if (!draggedCond) return;

                                                for (const b of currentBlocks) {
                                                    const targetIdx = b.conds.findIndex(cc => cc.id === c.id);
                                                    if (targetIdx !== -1) {
                                                        const insertIdx = pos === 'bottom' ? targetIdx + 1 : targetIdx;
                                                        b.conds.splice(insertIdx, 0, draggedCond);
                                                        break;
                                                    }
                                                }
                                            } else if (data.type === 'group') {
                                                const sourceIdx = currentBlocks.findIndex(b => b.type === 'group' && b.id === data.id);
                                                if (sourceIdx !== -1) {
                                                    const groupBlock = currentBlocks.splice(sourceIdx, 1)[0];
                                                    const targetIdx = currentBlocks.findIndex(b => b.conds.some(cc => cc.id === c.id));
                                                    if (targetIdx !== -1) {
                                                        const insertIdx = pos === 'bottom' ? targetIdx + 1 : targetIdx;
                                                        currentBlocks.splice(insertIdx, 0, groupBlock);
                                                    }
                                                }
                                            }
                                            await saveBlocksOrder(currentBlocks);
                                        } catch (err) { console.error(err); }
                                    }}
                                    style={{ position: 'relative', paddingBottom: isIntraGroup ? '0.4rem' : '0.8rem' }}>
                                    {/* ドロップインジケーター – ラッパー内にgap中央に表示 */}
                                    {dragOverId === c.id && dragOverPos && dragOverPos !== 'inside' && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 0, right: 0,
                                            height: '3px',
                                            background: 'var(--accent-blue)',
                                            zIndex: 10,
                                            top: dragOverPos === 'top' ? `calc(${isIntraGroup ? '-0.2rem - 1.5px' : '-0.4rem - 1.5px'})` : 'auto',
                                            bottom: dragOverPos === 'bottom' ? `calc(${isIntraGroup ? '0.2rem - 1.5px' : '0.4rem - 1.5px'})` : 'auto',
                                            pointerEvents: 'none',
                                            borderRadius: '2px'
                                        }} />
                                    )}
                                    {/* 実カード本体 */}
                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: 'var(--criteria-card-bg)', padding: '0.8rem 1rem', borderRadius: '8px', border: '2px solid var(--panel-border)', transition: 'all 0.2s', opacity: applyDimming ? 0.45 : 1, filter: applyDimming ? 'grayscale(0.4)' : 'none' } as any}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: groups.length > 0 ? 'stretch' : 'flex-start' }}>
                                        {/* Left: clickable info + group assignment */}
                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                            <div style={{ cursor: 'pointer' }} onClick={() => toggleExpand(c.id)}>
                                                <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-main)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {displayNum}.
                                                    </span>
                                                    <span style={{ color: 'var(--accent-gold)' }}>{c.name}</span>
                                                </div>
                                                <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-main)', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {(currentDesign.showCriteriaMethodBadge ?? true) && (
                                                    <span style={{ background: 'var(--dim-border)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {c.methodType === 1 ? (language === 'en' ? 'Skill Oriented' : 'スキル指向') : (language === 'en' ? `Character Oriented: ${c.characterName}` : `キャラ指向：${c.characterName}`)}
                                                    </span>
                                                    )}
                                                    {/* Skill badge: show highest-priority filled skill */}
                                                    {(() => {
                                                        const SKILL_KEYS = ['skill1', 'skill2', 'skill3', 'skill4'] as const;
                                                        if (!(currentDesign.showCriteriaSkillBadge ?? true)) return null;
                                                        const filledKeys = SKILL_KEYS.filter(k => c.skills[k]);
                                                        if (filledKeys.length === 0) return null;
                                                        // 1. If any must-match skills exist, pick among them using S3>S4>S1>S2 order
                                                        const MUST_MATCH_ORDER: typeof SKILL_KEYS[number][] = ['skill3', 'skill4', 'skill1', 'skill2'];
                                                        const mustMatchKeys = filledKeys.filter(k => c.skillMustMatch[k]);
                                                        let topKey: typeof SKILL_KEYS[number];
                                                        if (mustMatchKeys.length > 0) {
                                                            topKey = MUST_MATCH_ORDER.find(k => mustMatchKeys.includes(k))!;
                                                        } else {
                                                            // 2. Otherwise, fall back to ☆priority ascending sort
                                                            const sorted = [...filledKeys].sort((a, b) => (c.skillPriorities[a] ?? Infinity) - (c.skillPriorities[b] ?? Infinity));
                                                            topKey = sorted[0];
                                                        }
                                                        const skName = c.skills[topKey];
                                                        return skName ? (
                                                            <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                {language === 'en' ? 'Target Skill:' : '対象スキル:'} <span style={{ color: 'var(--skill-name-color)' }}>{language === 'en' ? translateSkill(skName, language) : skName}</span> {c.skillMustMatch[topKey] ? (language === 'en' ? '(Must Match)' : '(必須)') : (language === 'en' ? '(Optional)' : '(任意)')}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                    {c.memo && (
                                                        <span style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <FileText size={14} /> {c.memo}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Group assignment dropdown — always at bottom of left column */}
                                            {groups.length > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.4rem' }} onClick={e => e.stopPropagation()}>
                                                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{language === 'en' ? 'Folder:' : 'フォルダ:'}</span>
                                                    <select
                                                        className="input select-muted"
                                                        style={{ flex: 1, padding: '0.15rem 0.4rem', fontSize: 'var(--font-size-sub)' }}
                                                        value={c.listId || 'default'}
                                                        onChange={e => handleMoveConditionToGroup(c, e.target.value)}
                                                    >
                                                        <option value="default">{language === 'en' ? 'Ungrouped' : '未分類'}</option>
                                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: 2-row action buttons */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end', marginLeft: '0.8rem', flexShrink: 0 }}>
                                            {/* Row 1: Disable | Copy | Edit */}
                                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', height: '32px', border: '1px solid transparent' }}>
                                                {deletingId === c.id ? (
                                                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0 0.5rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', height: '100%', boxSizing: 'border-box' }}>
                                                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--accent-danger)', fontWeight: 700, marginRight: '0.2rem' }}>{language === 'en' ? 'Delete?' : '削除?'}</span>
                                                        <button className="btn btn-danger" onClick={() => { handleDelete(c.id); setDeletingId(null); }} style={{ padding: '0.1rem 0.5rem', fontSize: 'var(--font-size-sub)', height: '22px' }}>{language === 'en' ? 'Delete' : '削除'}</button>
                                                        <button className="btn btn-ghost" onClick={() => setDeletingId(null)} style={{ padding: '0.1rem 0.5rem', fontSize: 'var(--font-size-sub)', height: '22px' }}>{language === 'en' ? 'Cancel' : 'キャンセル'}</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button className="btn btn-ghost" onClick={() => handleToggleDisabled(c)} style={{ padding: '0.3rem 0.5rem', fontSize: 'var(--font-size-sub)', color: c.disabled ? 'var(--accent-success)' : 'var(--text-muted)' }} title={c.disabled ? (language === 'en' ? 'Enable' : '有効にする') : (language === 'en' ? 'Disable' : '無効にする')}>
                                                            {c.disabled ? (language === 'en' ? '✓ Enable' : '✓ 有効') : (language === 'en' ? '⊘ Disable' : '⊘ 無効')}
                                                        </button>
                                                        <div style={{ width: '1px', background: 'var(--panel-border)', alignSelf: 'stretch' }} />
                                                        <button className="btn btn-ghost" onClick={() => handleCopy(c)} style={{ padding: '0.4rem', fontSize: 'var(--font-size-sub)', color: 'var(--accent-blue-hover)' }} title={language === 'en' ? 'Copy' : 'コピー'}>
                                                            <Copy size={16} />
                                                        </button>
                                                        <button className="btn btn-ghost" onClick={() => handleEdit(c)} style={{ padding: '0.4rem', fontSize: 'var(--font-size-sub)' }} title={language === 'en' ? 'Edit' : '再編集'}>
                                                            {language === 'en' ? 'Edit' : '編集'}
                                                        </button>
                                                        <div style={{ width: '1px', background: 'var(--panel-border)', alignSelf: 'stretch' }} />
                                                        <button className="btn btn-ghost" onClick={() => setDeletingId(c.id)} style={{ padding: '0.4rem', color: 'var(--accent-danger)', opacity: 0.7 }} title={language === 'en' ? 'Delete' : '削除'}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            {/* Row 2: Up | Down | Grip */}
                                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                                {isIntraGroup ? (
                                                    <>
                                                        <button className="btn btn-ghost" onClick={() => moveIntraGroup(c.listId!, c.id, -1)} disabled={intraIndex === 0} style={{ padding: '0.4rem', opacity: intraIndex === 0 ? 0.3 : 1 }} title={language === 'en' ? 'Move Up (In Folder)' : 'フォルダ内で優先度を上げる'}>
                                                            <ChevronUp size={18} />
                                                        </button>
                                                        <button className="btn btn-ghost" onClick={() => moveIntraGroup(c.listId!, c.id, 1)} disabled={intraIndex >= intraCount! - 1} style={{ padding: '0.4rem', opacity: intraIndex >= intraCount! - 1 ? 0.3 : 1 }} title={language === 'en' ? 'Move Down (In Folder)' : 'フォルダ内で優先度を下げる'}>
                                                            <ChevronDown size={18} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    // Ungrouped top-level move
                                                    <>
                                                        <button className="btn btn-ghost" onClick={() => moveBlock(blockIndex, -1)} disabled={blockIndex === 0} style={{ padding: '0.4rem', opacity: blockIndex === 0 ? 0.3 : 1 }} title={language === 'en' ? 'Move Block Up' : 'ブロックごと優先度を上げる'}>
                                                            <ChevronUp size={18} />
                                                        </button>
                                                        <button className="btn btn-ghost" onClick={() => moveBlock(blockIndex, 1)} disabled={blockIndex >= blocks.length - 1} style={{ padding: '0.4rem', opacity: blockIndex >= blocks.length - 1 ? 0.3 : 1 }} title={language === 'en' ? 'Move Block Down' : 'ブロックごと優先度を下げる'}>
                                                            <ChevronDown size={18} />
                                                        </button>
                                                    </>
                                                )}
                                                <div style={{ width: '1px', background: 'var(--panel-border)', alignSelf: 'stretch' }} />
                                                <div 
                                                    style={{ padding: '0.4rem', color: 'var(--text-muted)', cursor: 'grab', opacity: 0.7, display: 'flex', alignItems: 'center' }} 
                                                    title={language === 'en' ? 'Drag' : 'ドラッグ'}
                                                    onMouseDown={() => setCanDragItemId(c.id)}
                                                    onMouseUp={() => setCanDragItemId(null)}
                                                    onMouseLeave={() => setCanDragItemId(null)}
                                                >
                                                    <GripVertical size={18} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded condition detail */}
                                    {isExpanded && (() => {
                                        const keptAFs = allArtifacts
                                            .filter(a => a.keepFlag === c.id)
                                            .sort((a, b) => {
                                                const attrDiff = parseInt(a.attribute) - parseInt(b.attribute);
                                                if (attrDiff !== 0) return attrDiff;
                                                return parseInt(a.kind) - parseInt(b.kind);
                                            });

                                        const collectedCounts: Record<string, number> = {};
                                        keptAFs.forEach(af => {
                                            const key = `${af.attribute}_${af.kind}`;
                                            collectedCounts[key] = (collectedCounts[key] || 0) + 1;
                                        });
                                        const dimCompleted = currentDesign.dimCompletedCriteriaCells ?? true;

                                        return (
                                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--panel-border)', display: 'flex', gap: '1.5rem' }}>
                                                {/* Left: condition details */}
                                                <div style={{ flex: 1, fontSize: 'var(--font-size-main)', color: 'var(--text-main)', minWidth: 0 }}>
                                                    {c.methodType === 1 && (
                                                        <div style={{ marginBottom: '0.8rem' }}>
                                                            <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.3rem', letterSpacing: '0.02em' }}>{language === 'en' ? 'Target Amount (Element × Kind):' : '【確保対象の属性×武器種】'}</div>
                                                            {(() => {
                                                                const entries = Object.entries(c.targetCount).filter(([, v]) => v > 0);
                                                                if (entries.length < currentDesign.criteriaDetailTableThreshold) {
                                                                    // Badge view for 4 or fewer
                                                                    return (
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
                                                                            {entries
                                                                                .sort(([a], [b]) => {
                                                                                    const [aAttr, aKind] = a.split('_').map(Number);
                                                                                    const [bAttr, bKind] = b.split('_').map(Number);
                                                                                    return aAttr !== bAttr ? aAttr - bAttr : aKind - bKind;
                                                                                })
                                                                                .map(([key, count]) => {
                                                                                    const [attr, kind] = key.split('_');
                                                                                        const currentCount = collectedCounts[key] || 0;
                                                        const isCompleted = currentCount >= count;
                                                        const isDimmed = dimCompleted && isCompleted;
                                                        return (
                                                             <span key={key} style={{ 
                                                                 background: 'var(--criteria-detail-bg)', 
                                                                 padding: '2px 6px', 
                                                                 borderRadius: '4px', 
                                                                 fontSize: 'var(--font-size-sub)',
                                                                 opacity: isDimmed ? 0.4 : 1,
                                                                 transition: 'opacity 0.2s',
                                                                 display: 'inline-flex',
                                                                 alignItems: 'center',
                                                                 gap: '4px'
                                                             }}>
                                                                 {ATTRIBUTE_OPS.find(a => a.val === attr)?.label}{language === 'en' ? '' : '属性'}・{KIND_OPS.find(k => k.val === kind)?.label} ({count}{language === 'en' ? '' : '個'})
                                                                 {isDimmed && <Check size={14} strokeWidth={3} style={{ color: 'var(--accent-success)', opacity: 1 }} />}
                                                             </span>



                                                        );
                                                                                })}
                                                                        </div>
                                                                    );
                                                                }
                                                                // Grid table for 5+
                                                                const ATTRS = ATTRIBUTE_IDS;
                                                                const KINDS = KIND_IDS;
                                                                const showSwapped = currentDesign.swapCriteriaDetailGrid;
                                                                const isSlanted = language === 'en';
                                                                const tableStyle: React.CSSProperties = { marginTop: '0.4rem', borderCollapse: 'collapse', fontSize: 'var(--font-size-sub)' };

                                                                if (showSwapped) {
                                                                    // Rows: Elements, Cols: Weapons
                                                                    const activeKinds = KINDS.filter(k => ATTRS.some(a => c.targetCount[`${a}_${k}`] > 0));
                                                                    const activeAttrs = ATTRS.filter(a => KINDS.some(k => (c.targetCount[`${a}_${k}`] || 0) > 0));
                                                                    return (
                                                                        <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: '0.5rem' }}>
                                                                            <table style={tableStyle}>
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th style={{ padding: '1px 4px', borderBottom: '1px solid var(--panel-border)' }}></th>
                                                                                        {activeKinds.map(k => (
                                                                                            <th key={k} className={isSlanted ? "slanted-th" : ""} style={{ 
                                                                                                borderBottom: '1px solid var(--panel-border)', 
                                                                                                padding: isSlanted ? '0 2px' : '1px 2px', 
                                                                                                textAlign: 'center',
                                                                                                width: currentDesign.useWeaponIconsInTables ? 'auto' : (!isSlanted ? '32px' : 'auto'),
                                                                                                minWidth: currentDesign.useWeaponIconsInTables ? 'auto' : (!isSlanted ? '32px' : 'auto')
                                                                                            }}>
                                                                                                {currentDesign.useWeaponIconsInTables ? (
                                                                                                    <div style={isSlanted ? { display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '2px', transform: 'none', margin: 0, width: '100%', justifyContent: 'center' } : undefined}>
                                                                                                        <WeaponIcon kind={k} size="1.5em" style={{ verticalAlign: 'middle', color: 'var(--text-muted)' }} />
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    isSlanted ? <div>{namesShort[k]}</div> : <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{namesShort[k]}</span>
                                                                                                )}
                                                                                            </th>
                                                                                        ))}
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {activeAttrs.map((a, idx) => (
                                                                                        <tr key={a} style={{ background: idx % 2 === 0 ? 'rgba(128, 128, 128, 0.05)' : 'transparent' }}>
                                                                                            <td style={{ padding: '2px 6px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', borderRight: '1px solid var(--panel-border)', borderBottom: '1px solid var(--dim-border)' }}>
                                                                                                {t(`ATTR_${a}` as TranslationKey)}
                                                                                            </td>
                                                                                            {activeKinds.map(k => {
                                                                                                const val = c.targetCount[`${a}_${k}`];
                                                                                                const currentCount = collectedCounts[`${a}_${k}`] || 0;
                                                                                                const isCompleted = val > 0 && currentCount >= val;
                                                                                                const isDimmed = dimCompleted && isCompleted;
                                                                                                return (
                                                                                                    <td key={k} style={{ 
                                                                                                        padding: '2px 6px', 
                                                                                                        textAlign: 'center', 
                                                                                                        color: val ? 'var(--text-main)' : 'transparent', 
                                                                                                        borderRight: '1px solid var(--dim-border)', 
                                                                                                        borderBottom: '1px solid var(--dim-border)',
                                                                                                        position: 'relative'
                                                                                                    }}>
                                                                                                        <span style={{ 
                                                                                                            display: 'inline-block',
                                                                                                            opacity: isDimmed ? 0.4 : (val ? 1 : 0),
                                                                                                            transition: 'opacity 0.2s'
                                                                                                        }}>
                                                                                                            {val || ''}
                                                                                                        </span>
                                                                                                        {isDimmed && (
                                                                                                            <Check size={17} strokeWidth={3} style={{ 
                                                                                                                position: 'absolute', 
                                                                                                                top: '50%', 
                                                                                                                left: '50%', 
                                                                                                                transform: 'translate(-50%, -50%)', 
                                                                                                                opacity: 0.35,
                                                                                                                color: 'var(--accent-success)',
                                                                                                                pointerEvents: 'none',
                                                                                                                zIndex: 1
                                                                                                            }} />
                                                                                                        )}
                                                                                                    </td>
                                                                                                );
                                                                                            })}
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    );
                                                                }

                                                                // Default: Rows: Weapons, Cols: Elements
                                                                return (
                                                                    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                                                        <table style={tableStyle}>
                                                                            <thead>
                                                                                <tr>
                                                                                    <th style={{ padding: '1px 4px', borderBottom: '1px solid var(--panel-border)' }}></th>
                                                                                    {ATTRS.map(a => (
                                                                                        <th key={a} className={isSlanted ? "slanted-th" : ""} style={{ padding: isSlanted ? '0 2px' : '1px 6px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid var(--panel-border)' }}>
                                                                                            {isSlanted ? <div>{t(`ATTR_${a}` as TranslationKey)}</div> : t(`ATTR_${a}` as TranslationKey)}
                                                                                        </th>
                                                                                    ))}
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {KINDS.filter(k => ATTRS.some(a => c.targetCount[`${a}_${k}`] > 0)).map((k, idx) => {
                                                                                    return (
                                                                                        <tr key={k} style={{ background: idx % 2 === 0 ? 'rgba(128, 128, 128, 0.05)' : 'transparent' }}>
                                                                                            <td style={{ padding: '2px 6px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', borderRight: '1px solid var(--panel-border)', borderBottom: '1px solid var(--dim-border)' }}>
                                                                                            {currentDesign.useWeaponIconsInTables ? (
                                                                                                <WeaponIcon kind={k} size="1.5em" style={{ verticalAlign: 'middle', color: 'var(--text-muted)' }} />
                                                                                            ) : (
                                                                                                namesShort[k]
                                                                                            )}
                                                                                            </td>
                                                                                            {ATTRS.map(a => {
                                                                                                const val = c.targetCount[`${a}_${k}`];
                                                                                                const currentCount = collectedCounts[`${a}_${k}`] || 0;
                                                                                                const isCompleted = val > 0 && currentCount >= val;
                                                                                                const isDimmed = dimCompleted && isCompleted;
                                                                                                return (
                                                                                                    <td key={a} style={{ 
                                                                                                        padding: '2px 6px', 
                                                                                                        textAlign: 'center', 
                                                                                                        color: val ? 'var(--text-main)' : 'transparent', 
                                                                                                        borderRight: '1px solid var(--dim-border)', 
                                                                                                        borderBottom: '1px solid var(--dim-border)',
                                                                                                        position: 'relative'
                                                                                                    }}>
                                                                                                        <span style={{ 
                                                                                                            display: 'inline-block',
                                                                                                            opacity: isDimmed ? 0.4 : (val ? 1 : 0),
                                                                                                            transition: 'opacity 0.2s'
                                                                                                        }}>
                                                                                                            {val || ''}
                                                                                                        </span>
                                                                                                        {isDimmed && (
                                                                                                            <Check size={17} strokeWidth={3} style={{ 
                                                                                                                position: 'absolute', 
                                                                                                                top: '50%', 
                                                                                                                left: '50%', 
                                                                                                                transform: 'translate(-50%, -50%)', 
                                                                                                                opacity: 0.35,
                                                                                                                color: 'var(--accent-success)',
                                                                                                                pointerEvents: 'none',
                                                                                                                zIndex: 1
                                                                                                            }} />
                                                                                                        )}
                                                                                                    </td>
                                                                                                );
                                                                                            })}
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                    {c.methodType === 2 && (
                                                        <div style={{ marginBottom: '0.8rem' }}>
                                                            <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.3rem', letterSpacing: '0.02em' }}>{language === 'en' ? 'Character Oriented Target:' : '【キャラ指定条件】'}</div>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
                                                                <span style={{ background: 'var(--criteria-detail-bg)', padding: '2px 6px', borderRadius: '4px', fontSize: 'var(--font-size-sub)' }}>
                                                                    {language === 'en' ? 'Element:' : '属性:'} {ATTRIBUTE_OPS.find(a => a.val === c.attributes[0])?.label}
                                                                </span>
                                                                <span style={{ background: 'var(--criteria-detail-bg)', padding: '2px 6px', borderRadius: '4px', fontSize: 'var(--font-size-sub)' }}>
                                                                    {language === 'en' ? 'Weapon Kind:' : '武器種:'} {KIND_OPS.find(k => k.val === c.weaponKinds[0])?.label}{c.weaponKinds2?.[0] ? ` ${language === 'en' ? 'or' : 'または'} ${KIND_OPS.find(k => k.val === c.weaponKinds2?.[0])?.label}` : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div style={{ marginTop: '0.8rem' }}>
                                                        <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.3rem', letterSpacing: '0.02em' }}>{language === 'en' ? 'Target Skills:' : '【対象スキルの設定】'}</div>
                                                        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.3rem', lineHeight: '1.5' }}>
                                                            {([1, 2, 3, 4] as const).map(num => {
                                                                const k = `skill${num}` as const;
                                                                const s = c.skills[k];
                                                                const p = c.skillPriorities[k];
                                                                const m = c.skillMustMatch[k];
                                                                if (!s) return null;
                                                                const slotLabel = num <= 2 ? '[Ⅰ]' : num === 3 ? '[Ⅱ]' : '[Ⅲ]';
                                                                const isInverted = k === 'skill3' && c.invertSkill3Quality && s === "最大HP上昇/防御力-70%";
                                                                return (
                                                                    <li key={num} style={{ fontSize: 'var(--font-size-sub)' }}>
                                                                        <span style={{ color: '#5eead4', fontWeight: 600, marginRight: '0.3rem' }}>{slotLabel}</span>
                                                                        <span style={{ color: 'var(--skill-name-color)' }}>{language === 'en' ? translateSkill(s, language) : s}</span> —
                                                                        <span style={{ color: 'var(--accent-gold)' }}>★{language === 'en' ? 'Priority:' : '優先度:'}{p}</span>
                                                                        {m ? <span style={{ color: 'var(--accent-danger)' }}>{language === 'en' ? ' (Must Match)' : ' (必須)'}</span> : (language === 'en' ? ' (Optional)' : ' (任意)')}
                                                                        {isInverted && <span style={{ color: 'var(--accent-danger)', marginLeft: '0.5rem', fontWeight: 600 }}>{language === 'en' ? '[Quality Inverted]' : '[☆評価逆転]'}</span>}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                    {c.excludeSkills && c.excludeSkills.length > 0 && (
                                                        <div style={{ marginTop: '0.5rem' }}>
                                                            <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Exclude Skills:' : '除外スキル:'}</strong>
                                                            <ul style={{ paddingLeft: '1.2rem', marginTop: '0.3rem', lineHeight: '1.5' }}>
                                                                {c.excludeSkills.map((ex, idx) => (
                                                                    <li key={idx} style={{ fontSize: 'var(--font-size-sub)', color: 'var(--accent-danger)' }}>
                                                                        <span style={{ fontWeight: 500 }}>{language === 'en' ? translateSkill(ex, language) : ex}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {c.excludeFavorites && (
                                                        <div style={{ marginTop: '0.5rem', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                                                            🚫 {language === 'en' ? 'Favorited AFs are excluded' : 'お気に入り(鍵付き)のAFを除外'}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right: kept AF panel */}
                                                <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                    <div style={{ fontSize: 'var(--font-size-sub)', fontWeight: 600, color: 'var(--accent-blue-hover)', borderBottom: '1px solid var(--dim-border)', paddingBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{language === 'en' ? 'Saved AFs matching this condition' : '確保中のAF一覧'}</span>
                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                                                            {keptAFs.length}{language === 'en' ? ' matched' : '件'} / {language === 'en' ? 'Cap ' : '上限'}
                                                            {c.methodType === 1 ? Object.values(c.targetCount).reduce((a, b) => a + b, 0) : (c.targetCountMethod2 || 0)}{language === 'en' ? '' : '件'}
                                                        </span>
                                                    </div>
                                                    {selectedKeepAF && selectedKeepAF.keepFlag === c.id && (
                                                        <div style={{ background: 'var(--dim-bg)', borderRadius: '8px', padding: '0.8rem', border: '1px solid var(--dim-border)' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: 'var(--font-size-sub)' }}>
                                                                {selectedKeepAF.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Lv{selectedKeepAF.level}</span>
                                                            </div>
                                                            {[selectedKeepAF.skill1_info, selectedKeepAF.skill2_info, selectedKeepAF.skill3_info, selectedKeepAF.skill4_info].map((sk, idx) => {
                                                                if (!sk?.name) return null;
                                                                const glabel = idx < 2 ? '[I]' : idx === 2 ? '[II]' : '[III]';
                                                                const isQ5 = sk.skill_quality === 5;
                                                                const q5Outline = '0px 0px 3px var(--max-quality-outline), -1px -1px 0 var(--max-quality-outline), 1px -1px 0 var(--max-quality-outline), -1px 1px 0 var(--max-quality-outline), 1px 1px 0 var(--max-quality-outline)';
                                                                
                                                                return (
                                                                    <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', marginBottom: '0.2rem', fontSize: 'calc(var(--font-size-sub) * 0.97)', lineHeight: '1.4' }}>
                                                                        <span style={{ 
                                                                            color: isQ5 ? 'var(--max-quality-text)' : 'var(--accent-gold)', 
                                                                            minWidth: '22px', 
                                                                            flexShrink: 0,
                                                                            textShadow: isQ5 ? q5Outline : 'none'
                                                                        }}>★{sk.skill_quality}</span>
                                                                        <span style={{ color: 'var(--accent-success)', minWidth: '26px', flexShrink: 0 }}>{glabel}</span>
                                                                        <span style={{ color: 'var(--text-main)', flex: 1, wordBreak: 'break-all' }}>{language === 'en' ? translateSkill(sk.name, language) : sk.name}</span>
                                                                        <span style={{ 
                                                                            color: isQ5 ? 'var(--max-quality-text)' : 'var(--accent-blue-hover)', 
                                                                            flexShrink: 0,
                                                                            textShadow: isQ5 ? q5Outline : 'none'
                                                                        }}>{sk.effect_value}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {keptAFs.length === 0 ? (
                                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)', padding: '1rem', textAlign: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                                                            {language === 'en' ? <><br />No AFs match this condition.<br />Please execute "Calculate Keep Flags".</> : <>確保対象のAFがありません。<br />「確保フラグ一括計算」を実行してください。</>}
                                                        </div>
                                                    ) : (
                                                        <div style={{ maxHeight: '600px', overflowY: 'auto', borderRadius: '6px', border: '1px solid var(--dim-border)' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'calc(var(--font-size-sub) * 0.97)' }}>
                                                                <thead style={{ position: 'sticky', top: 0, background: 'var(--panel-bg)' }}>
                                                                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--dim-border)' }}>
                                                                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 500 }}>ID</th>
                                                                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 500 }}>{language === 'en' ? 'Element' : '属性'}</th>
                                                                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 500 }}>{language === 'en' ? 'Weapon' : '武器種'}</th>
                                                                        <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem', fontWeight: 500 }}>{language === 'en' ? 'Score' : '評価値'}</th>
                                                                        <th style={{ textAlign: 'center', padding: '0.3rem 0.5rem', fontWeight: 500 }}>{language === 'en' ? 'Status' : '状態'}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {keptAFs.map(af => (
                                                                        <tr key={af.id} onClick={() => setSelectedKeepAF(af)} style={{ cursor: 'pointer', background: selectedKeepAF?.id === af.id ? 'rgba(59,130,246,0.15)' : 'transparent', borderBottom: '1px solid var(--dim-border)' }}>
                                                                            <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text-muted)' }}>{af.id}</td>
                                                                            <td style={{ padding: '0.3rem 0.5rem' }}>{t(`ATTR_${af.attribute}` as TranslationKey)}</td>
                                                                            <td style={{ padding: '0.3rem 0.5rem' }}>{language === 'en' ? t(`WPN_${af.kind}` as TranslationKey) : (namesShort[af.kind] || af.kind)}</td>
                                                                            <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: 'var(--accent-gold)' }}>{af.evaluationScore != null ? af.evaluationScore.toFixed(1) : '-'}</td>
                                                                            <td style={{ padding: '0.3rem 0.5rem', textAlign: 'center' }}>
                                                                                {af.is_locked && <span style={{ color: 'var(--accent-gold)', fontSize: 'calc(var(--font-size-sub) * 0.87)', marginRight: '2px' }}>Fav</span>}
                                                                                {af.is_unnecessary && <span style={{ color: 'var(--accent-purple)', fontSize: 'calc(var(--font-size-sub) * 0.87)' }}>{language === 'en' ? 'Trash' : '不用'}</span>}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    </div>
                                </div>
                            );
                        };

                        return blocks.map((block, bIdx) => {
                            if (block.type === 'group') {
                                const group = block.group;
                                const isCollapsed = collapsedGroups.has(group.id);
                                const isEditing = editingGroupId === group.id;
                                const groupCondCount = block.conds.length;
                                const isThisGroupAllDisabled = groupCondCount > 0 && block.conds.every(c => c.disabled);

                                return (
                                    // STEP3: ラッパーdiv – D&DイベントとpaddingBottomでgapを再現
                                    <div key={`group-${group.id}`}
                                        draggable={canDragItemId === group.id}
                                        onDragStart={(e) => {
                                            e.stopPropagation();
                                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', id: group.id }));
                                            setDraggedId(group.id);
                                            setDraggedType('group');
                                        }}
                                        onDragEnd={() => {
                                            setCanDragItemId(null);
                                            setDraggedId(null);
                                            setDraggedType(null);
                                            setDragOverId(null);
                                            setDragOverPos(null);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDragOverId(group.id);
                                            if (draggedId === group.id) {
                                                setDragOverPos(null);
                                                return;
                                            }
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const relY = (e.clientY - rect.top) / rect.height;
                                            // 判定閾値を調整
                                            const PADDING_PX = 16; 
                                            const distFromBottom = rect.height - (e.clientY - rect.top);
                                            // 上端15%以内なら top, 下端PADDING_PX以内なら bottom, それ以外は inside
                                            const rawPos = relY < 0.15 ? 'top' : distFromBottom < PADDING_PX ? 'bottom' : 'inside';
                                            
                                            // STEP4.1: 無移動判定の再構築
                                            let isNoMove = false;
                                            const sBlockIdx = blocks.findIndex(b => b.id === draggedId);
                                            
                                            if (rawPos === 'top' && sBlockIdx !== -1 && bIdx === sBlockIdx + 1) isNoMove = true;
                                            if (rawPos === 'bottom' && sBlockIdx !== -1 && bIdx === sBlockIdx - 1) isNoMove = true;

                                            if (rawPos === 'inside') {
                                                if (draggedType === 'group') {
                                                    isNoMove = true; // グループ内にグループは入れられない
                                                } else if (draggedType === 'cond') {
                                                    // 既にこのグループの最後にいるなら抑制
                                                    const sBlock = blocks.find(b => b.conds.some(cc => cc.id === draggedId));
                                                    if (sBlock && sBlock.id === group.id) {
                                                        const sIdx = sBlock.conds.findIndex(cc => cc.id === draggedId);
                                                        if (sIdx === sBlock.conds.length - 1) isNoMove = true;
                                                    }
                                                }
                                            }
                                            
                                            setDragOverPos(isNoMove ? null : rawPos);
                                        }}
                                        onDragLeave={(e) => {
                                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                setDragOverId(null);
                                                setDragOverPos(null);
                                            }
                                        }}
                                        onDrop={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const pos = dragOverPos;
                                            setDragOverId(null);
                                            setDragOverPos(null);
                                            if (!pos || !draggedId || draggedId === group.id) return;

                                            try {
                                                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                                                const currentBlocks = getBlocks();

                                                if (data.type === 'cond') {
                                                    let draggedCond: Condition | null = null;
                                                    for (const b of currentBlocks) {
                                                        const idx = b.conds.findIndex(cc => cc.id === data.id);
                                                        if (idx !== -1) {
                                                            draggedCond = b.conds.splice(idx, 1)[0];
                                                            break;
                                                        }
                                                    }
                                                    if (!draggedCond) return;

                                                    if (pos === 'inside') {
                                                        const targetGroup = currentBlocks.find(b => b.type === 'group' && b.id === group.id);
                                                        if (targetGroup) targetGroup.conds.push(draggedCond);
                                                    } else {
                                                        const targetBlockIdx = currentBlocks.findIndex(b => b.type === 'group' && b.id === group.id);
                                                        if (targetBlockIdx !== -1) {
                                                            const insertIdx = pos === 'bottom' ? targetBlockIdx + 1 : targetBlockIdx;
                                                            currentBlocks.splice(insertIdx, 0, { type: 'ungrouped', id: draggedCond.id, conds: [draggedCond], topPriority: 0 });
                                                        }
                                                    }
                                                } else if (data.type === 'group') {
                                                    const sourceIdx = currentBlocks.findIndex(b => b.type === 'group' && b.id === data.id);
                                                    if (sourceIdx !== -1) {
                                                        const groupBlock = currentBlocks.splice(sourceIdx, 1)[0];
                                                        const targetIdx = currentBlocks.findIndex(b => b.type === 'group' && b.id === group.id);
                                                        if (targetIdx !== -1) {
                                                            const insertIdx = pos === 'bottom' ? targetIdx + 1 : targetIdx;
                                                            currentBlocks.splice(insertIdx, 0, groupBlock);
                                                        }
                                                    }
                                                }
                                                await saveBlocksOrder(currentBlocks);
                                            } catch (err) { console.error(err); }
                                        }}
                                        style={{ position: 'relative', paddingBottom: '0.8rem' }}>
                                    {/* ドロップインジケーター – ラッパー内のgap中央に表示 */}
                                    {dragOverId === group.id && dragOverPos && dragOverPos !== 'inside' && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 0, right: 0,
                                            height: '3px',
                                            background: 'var(--accent-blue)',
                                            zIndex: 10,
                                            top: dragOverPos === 'top' ? 'calc(-0.4rem - 1.5px)' : 'auto',
                                            bottom: dragOverPos === 'bottom' ? 'calc(0.4rem - 1.5px)' : 'auto',
                                            pointerEvents: 'none',
                                            borderRadius: '2px'
                                        }} />
                                    )}
                                    {/* 実グループカード本体 */}
                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: 'var(--dim-bg)', borderRadius: '8px', border: '1px solid var(--panel-border)', boxShadow: dragOverId === group.id && dragOverPos === 'inside' ? '0 0 0 2px var(--accent-blue)' : 'none', overflow: 'hidden', opacity: isThisGroupAllDisabled ? 0.45 : 1, filter: isThisGroupAllDisabled ? 'grayscale(0.4)' : 'none', transition: 'all 0.2s' }}>

                                        <div key={`hdr-${group.id}`}
                                            onClick={() => !isEditing && toggleGroupCollapse(group.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem 0.4rem 1.0rem', cursor: isEditing ? 'default' : 'pointer', userSelect: 'none' }}
                                        >
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                {!isEditing && (isCollapsed ? <Folder size={15} color="var(--accent-gold)" /> : <FolderOpen size={15} color="var(--accent-gold)" />)}
                                                {isEditing ? (
                                                    <input
                                                        className="input"
                                                        style={{ flex: 1, padding: '0.15rem 0.4rem', fontSize: 'var(--font-size-sub)' }}
                                                        value={editGroupName}
                                                        onChange={e => setEditGroupName(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') submitGroupRename();
                                                            if (e.key === 'Escape') setEditingGroupId(null);
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span style={{ fontWeight: 700, fontSize: 'calc(var(--font-size-sub) + 1px)', color: 'var(--accent-gold)' }}>
                                                        {group.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)' }}>({groupCondCount})</span>
                                                    </span>
                                                )}
                                            </div>
                                            {isEditing ? (
                                                <>
                                                    <button className="btn btn-primary" onClick={e => { e.stopPropagation(); submitGroupRename(); }} style={{ padding: '0.15rem 0.5rem', fontSize: 'calc(var(--font-size-sub)*0.9)' }}>{language === 'en' ? 'Save' : '保存'}</button>
                                                    <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); setEditingGroupId(null); }} style={{ padding: '0.15rem 0.5rem', fontSize: 'calc(var(--font-size-sub)*0.9)' }}>{language === 'en' ? 'Cancel' : 'キャンセル'}</button>
                                                </>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', height: '24px' }}>
                                                    {deletingGroupId === group.id ? (
                                                        <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0 0.4rem', borderRadius: '6px', boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.3)', height: '100%', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
                                                            <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--accent-danger)', fontWeight: 700, padding: '0 0.4rem 0 0.5rem' }}>{language === 'en' ? 'Delete Folder?' : 'フォルダ削除?'}</span>
                                                            <button className="btn btn-danger" onClick={() => handleDeleteGroupAndConds(group)} style={{ padding: '0.1rem 0.5rem', fontSize: 'calc(var(--font-size-sub)*0.95)', lineHeight: 1, height: '18px' }}>{language === 'en' ? 'ALL(Include Conds)' : '全削除(条件込)'}</button>
                                                            <button className="btn btn-danger" onClick={() => handleDeleteGroupOnly(group)} style={{ padding: '0.1rem 0.5rem', fontSize: 'calc(var(--font-size-sub)*0.95)', lineHeight: 1, height: '18px' }}>{language === 'en' ? 'Folder Only' : 'フォルダのみ削除'}</button>
                                                            <button className="btn btn-ghost" onClick={() => setDeletingGroupId(null)} style={{ padding: '0.1rem 0.5rem', fontSize: 'calc(var(--font-size-sub)*0.95)', lineHeight: 1, height: '18px' }}>{language === 'en' ? 'Cancel' : 'キャンセル'}</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button 
                                                                className="btn btn-ghost" 
                                                                onClick={e => { e.stopPropagation(); handleToggleGroupDisabled(block.conds); }} 
                                                                style={{ padding: '0.2rem 0.5rem', color: isThisGroupAllDisabled ? 'var(--accent-success)' : 'var(--text-muted)' }} 
                                                                title={isThisGroupAllDisabled ? (language === 'en' ? 'Enable All in Folder' : 'フォルダ内を一括有効') : (language === 'en' ? 'Disable All in Folder' : 'フォルダ内を一括無効')}
                                                            >
                                                                <span style={{ fontSize: 'calc(var(--font-size-sub) + 1px)' }}>{isThisGroupAllDisabled ? '✓' : '⊘'}</span>
                                                            </button>
                                                            <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); handleRenameGroup(group); }} style={{ padding: '0.2rem 0.6rem', opacity: 0.7 }} title={language === 'en' ? 'Rename Folder' : 'フォルダ名を変更'}><span style={{ fontSize: 'calc(var(--font-size-sub) + 1px)' }}>✎</span></button>
                                                            {(() => {
                                                                const isThisEmptyGroup = groupCondCount === 0;
                                                                const prevBlock = bIdx > 0 ? blocks[bIdx - 1] : null;
                                                                const isPrevNonEmpty = prevBlock ? prevBlock.conds.length > 0 : false;
                                                                const isUpDisabled = bIdx === 0 || (isThisEmptyGroup && isPrevNonEmpty);
                                                                return (
                                                                    <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); moveBlock(bIdx, -1); }} disabled={isUpDisabled} style={{ padding: '0.2rem 0.5rem', opacity: isUpDisabled ? 0.3 : 1 }} title={language === 'en' ? 'Move Folder Up' : 'フォルダを上へ'}><ChevronUp size={14} /></button>
                                                                );
                                                            })()}
                                                            <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); moveBlock(bIdx, 1); }} disabled={bIdx >= blocks.length - 1} style={{ padding: '0.2rem 0.5rem', opacity: bIdx >= blocks.length - 1 ? 0.3 : 1 }} title={language === 'en' ? 'Move Folder Down' : 'フォルダを下へ'}><ChevronDown size={14} /></button>
                                                            
                                                            <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); setDeletingGroupId(group.id); }} style={{ padding: '0.2rem 0.6rem', color: 'var(--accent-danger)', opacity: 0.7 }} title={language === 'en' ? 'Delete Folder' : 'フォルダを削除'}><Trash2 size={15} /></button>
                                                        </>
                                                    )}
                                                    <div 
                                                        style={{ padding: '0.2rem 0.3rem', color: 'var(--text-muted)', cursor: 'grab', opacity: 0.7, display: 'flex', alignItems: 'center' }} 
                                                        title={language === 'en' ? 'Drag Folder' : 'フォルダをドラッグ'}
                                                        onMouseDown={() => setCanDragItemId(group.id)}
                                                        onMouseUp={() => setCanDragItemId(null)}
                                                        onMouseLeave={() => setCanDragItemId(null)}
                                                    >
                                                        <GripVertical size={15} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {!isCollapsed && block.conds.length > 0 && (
                                            <>
                                                <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0 0.8rem', opacity: 0.6 }} />
                                                <div style={{ display: 'flex', flexDirection: 'column', padding: '0.8rem 0.6rem 0.4rem' }}>
                                                    {block.conds.map((cond, i) => renderCondCard({
                                                        kind: 'cond', cond, blockIndex: bIdx, isIntraGroup: true, intraIndex: i, intraCount: block.conds.length, displayNum: displayNumCounter++, parentDisabled: isThisGroupAllDisabled
                                                    }))}
                                                </div>
                                            </>
                                        )}
                                        {isCollapsed && (() => {
                                            displayNumCounter += block.conds.length;
                                            return null;
                                        })()}
                                    </div>
                                    </div>
                                );
                            } else {
                                // Ungrouped condition
                                return renderCondCard({
                                    kind: 'cond', cond: block.conds[0], blockIndex: bIdx, isIntraGroup: false, intraIndex: 0, intraCount: 1, displayNum: displayNumCounter++
                                });
                            }
                        });
                    })()}

                    {conditions.length === 0 && !isAdding && (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem', background: 'var(--dim-bg)', borderRadius: '8px' }}>
                            {language === 'en' ? <>No AF target conditions are set.<br />Please add one using the "Add Condition" button above.</> : <>現在、確保AF条件は設定されていません。<br />右上の「条件を追加」から設定してください。</>}
                        </div>
                    )}
                </div>
            </div>

            {/* 展開・格納時のガタつき防止用の余白（リスト枠外） */}
            <div style={{ height: '500px' }} />
        </div>
    );
}