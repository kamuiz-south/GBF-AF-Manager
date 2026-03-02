import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Play, ChevronUp, ChevronDown, ChevronRight, Trash2, Filter, Copy } from 'lucide-react';
import { db } from '../db';
import type { AppArtifact, Condition } from '../types';
import { runCriteriaMatcher } from '../utils/matcher';
import { useTranslation, type TranslationKey } from '../i18n';
import { translateSkill, reverseTranslateSkill } from '../utils/skillMapping';

const ATTR_NAMES: Record<string, string> = { '1': '火', '2': '水', '3': '土', '4': '風', '5': '光', '6': '闇' };
const KIND_NAMES_SHORT: Record<string, string> = {
    '1': '剣', '2': '短剣', '3': '槍', '4': '斧', '5': '杖', '6': '銃', '7': '格闘', '8': '弓', '9': '楽器', '10': '刀'
};

export default function CriteriaTab() {
    const { t, language } = useTranslation();
    const conditions = useLiveQuery(() => db.conditions.orderBy('priority').toArray()) || [];
    const [isAdding, setIsAdding] = useState(false);
    const topRef = useRef<HTMLDivElement>(null);

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
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [selectedKeepAF, setSelectedKeepAF] = useState<AppArtifact | null>(null);
    const [condMemo, setCondMemo] = useState('');

    const allArtifacts = useLiveQuery(() => db.artifacts.toArray()) || [];

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        // Validation for Method 2
        if (methodType === 2) {
            if (!characterName) {
                alert(language === 'en' ? 'Please enter a character name.' : 'キャラクター名を入力してください');
                return;
            }
            if (m2Kind2 && m2Kind1 === m2Kind2) {
                alert(language === 'en' ? 'The 2nd Weapon Kind cannot be the same as the 1st.' : '武器種2つ目に1つ目と同じものは選択できません。');
                return;
            }
        }

        // Validation for Method 1
        if (methodType === 1) {
            const sum = Object.values(method1Grid).reduce((a, b) => a + b, 0);
            if (sum <= 0) {
                alert(language === 'en' ? 'Total target count is 0! Please set target counts for at least one cell.' : '確保マスの合計個数が0です！1つ以上のマスに目標個数を設定してください。');
                return;
            }
        }

        // Validate skill priorities (must be unique 1-4)
        const priorities = [skillPriorities.skill1, skillPriorities.skill2, skillPriorities.skill3, skillPriorities.skill4].filter(p => p !== null) as number[];
        const uniquePriorities = new Set(priorities);
        if (priorities.length !== uniquePriorities.size) {
            alert(language === 'en' ? '☆ Priority numbers (1-4) cannot be duplicated.' : '☆優先度の数字(1〜4)は重複して設定できません');
            return;
        }

        const newCond: Condition = {
            id: editingId || crypto.randomUUID(),
            listId: 'default',
            priority: editingId ? (conditions.find(c => c.id === editingId)?.priority ?? conditions.length) : conditions.length,
            name: name || (methodType === 1 ? (language === 'en' ? `Condition ${conditions.length + 1}` : `条件 ${conditions.length + 1}`) : (language === 'en' ? `For ${characterName}` : `${characterName} 用`)),
            methodType,
            targetCount: methodType === 1 ? { ...method1Grid } : {},
            characterName,
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

    const ATTRIBUTE_OPS = [
        { val: "1", label: t('ATTR_1') }, { val: "2", label: t('ATTR_2') }, { val: "3", label: t('ATTR_3') },
        { val: "4", label: t('ATTR_4') }, { val: "5", label: t('ATTR_5') }, { val: "6", label: t('ATTR_6') }
    ];

    const KIND_OPS = [
        { val: "1", label: t('WPN_1') }, { val: "2", label: t('WPN_2') }, { val: "3", label: t('WPN_3') },
        { val: "4", label: t('WPN_4') }, { val: "5", label: t('WPN_5') }, { val: "6", label: t('WPN_6') },
        { val: "7", label: t('WPN_7') }, { val: "8", label: t('WPN_8') }, { val: "9", label: t('WPN_9') }, { val: "10", label: t('WPN_10') }
    ];

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
            alert(language === 'en' ? 'Calculations complete, keep flags updated!' : '計算を実行し、確保フラグを更新しました！');
        } catch (e) {
            console.error(e);
            alert(language === 'en' ? 'An error occurred during calculation.' : '計算中にエラーが発生しました。');
        }
    };

    const moveUp = async (index: number) => {
        if (index === 0) return;
        const current = conditions[index];
        const prev = conditions[index - 1];
        await db.conditions.bulkPut([
            { ...current, priority: index - 1 },
            { ...prev, priority: index }
        ]);
    };

    const moveDown = async (index: number) => {
        if (index === conditions.length - 1) return;
        const current = conditions[index];
        const next = conditions[index + 1];
        await db.conditions.bulkPut([
            { ...current, priority: index + 1 },
            { ...next, priority: index }
        ]);
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
        // Scroll to top to see edit form (using scrollIntoView to handle nested containers like main-content)
        setTimeout(() => {
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    return (
        <div ref={topRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', maxWidth: '900px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ fontSize: 'calc(var(--font-size-main) * 1.8)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)' }}>
                        <Filter /> {language === 'en' ? 'Target AF Criteria Settings' : '欲しいAFの条件設定'}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)', margin: 0 }}>
                        {language === 'en' ? 'Add conditions and sort them so higher priorities are at the top.' : '条件を追加し、確保優先度の高いものが上になるように並びかえてください。'}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleRunMatcher} style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-size-sub)' }}>
                    <Play size={16} fill="currentColor" /> {language === 'en' ? 'Calculate Keep Flags' : '確保フラグの一括計算'}
                </button>
            </header>

            {/* Conditions List */}
            <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)' }}>
                        {language === 'en' ? 'Target Priority List' : '条件優先度リスト'}
                        {conditions.length > 0 && (
                            <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.8rem' }}>
                                ({language === 'en' ? 'Kept/Cap: ' : '確保数/上限: '}{allArtifacts.filter(a => !!a.keepFlag).length} / {conditions.reduce((sum, c) => {
                                    if (c.methodType === 1) return sum + Object.values(c.targetCount).reduce((a, b) => a + b, 0);
                                    return sum + (c.targetCountMethod2 || 0);
                                }, 0)}{language === 'en' ? ')' : '個)'}
                            </span>
                        )}
                    </h3>
                    <button className="btn btn-ghost" onClick={() => setIsAdding(!isAdding)} style={{ border: '1px solid var(--panel-border)' }}>
                        <Plus size={16} /> {language === 'en' ? 'Add Condition' : '条件を追加'}
                    </button>
                </div>

                {isAdding && (
                    <div style={{ background: 'var(--criteria-new-bg)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--accent-blue)' }}>
                        <h4 style={{ marginBottom: '1.5rem', color: 'var(--accent-blue-hover)' }}>{editingId ? (language === 'en' ? 'Edit Condition' : '条件の編集') : (language === 'en' ? 'Create New Condition' : '新規条件の作成')}</h4>

                        <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="radio" checked={methodType === 1} onChange={() => setMethodType(1)} /> {language === 'en' ? 'Method 1 (Skill Oriented)' : '方法1 (スキル指向)'}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="radio" checked={methodType === 2} onChange={() => setMethodType(2)} /> {language === 'en' ? 'Method 2 (Character Oriented)' : '方法2 (キャラ指向)'}
                            </label>
                        </div>

                        <input className="input" placeholder={language === 'en' ? 'Condition Name (Optional)' : '条件名 (任意)'} value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: '1.5rem', width: '100%' }} />

                        {methodType === 1 ? (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>{language === 'en' ? 'Enter the target number of AFs in the Element x Weapon Kind cells (blanks are treated as 0)' : '確保したい属性×武器種のマスに目標個数を入力してください（未入力は0扱い）'}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                                    {ATTRIBUTE_OPS.map(a => (
                                        <div key={a.val} style={{ border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0.8rem', background: 'var(--dim-bg)' }}>
                                            <h5 style={{ margin: '0 0 0.8rem 0', color: 'var(--text-main)', borderBottom: '1px solid var(--dim-border)', paddingBottom: '0.4rem' }}>{a.label}{language === 'en' ? '' : '属性'}</h5>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                                    <button type="button" className="btn btn-ghost"
                                                        style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', padding: '2px 8px', border: '1px solid var(--panel-border)' }}
                                                        onClick={() => KIND_OPS.forEach(k => handleM1GridChange(a.val, k.val, String(Math.max(0, (method1Grid[`${a.val}_${k.val}`] || 0) - 1))))}
                                                    >{language === 'en' ? 'All -1' : '全-1'}</button>
                                                    <button type="button" className="btn btn-ghost"
                                                        style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', padding: '2px 8px', border: '1px solid var(--panel-border)' }}
                                                        onClick={() => KIND_OPS.forEach(k => handleM1GridChange(a.val, k.val, String((method1Grid[`${a.val}_${k.val}`] || 0) + 1)))}
                                                    >{language === 'en' ? 'All +1' : '全+1'}</button>
                                                </div>
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
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', background: 'var(--dim-bg)', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <input className="input" placeholder={language === 'en' ? 'Character Name (for display only)' : 'キャラクター名 (表示用)'} value={characterName} onChange={e => setCharacterName(e.target.value)} style={{ flex: 1 }} />
                                    <input type="number" className="input" min="1" value={targetCountMethod2} onChange={e => setTargetCountMethod2(parseInt(e.target.value))} placeholder={language === 'en' ? 'Count' : '確保個数'} style={{ width: '100px' }} />
                                    {language === 'en' ? null : <span style={{ fontSize: 'var(--font-size-main)' }}>個</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <select className="input" value={m2Attr} onChange={e => setM2Attr(e.target.value)} style={{ width: '120px' }}>
                                        {ATTRIBUTE_OPS.map(o => <option key={`m2a-${o.val}`} value={o.val}>{o.label}{language === 'en' ? '' : '属性'}</option>)}
                                    </select>
                                    <select className="input" value={m2Kind1} onChange={e => setM2Kind1(e.target.value)} style={{ width: '120px' }}>
                                        {KIND_OPS.map(o => <option key={`m2k1-${o.val}`} value={o.val}>{o.label}</option>)}
                                    </select>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)' }}>{language === 'en' ? 'or' : 'または'}</span>
                                    <select className="input" value={m2Kind2} onChange={e => setM2Kind2(e.target.value)} style={{ width: '120px' }}>
                                        <option value="">{language === 'en' ? '(None)' : '(指定なし)'}</option>
                                        {KIND_OPS.map(o => <option key={`m2k2-${o.val}`} value={o.val}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.8rem', color: 'var(--text-main)' }}>{language === 'en' ? 'Target Skills (At least 1 required)' : '希望スキル設定 (最低1つは入力必須)'}</h5>

                            <datalist id="skill-list-g1">{SKILL_OPTS_G1.map(s => <option key={s} value={language === 'en' ? translateSkill(s, language) : s} />)}</datalist>
                            <datalist id="skill-list-g2">{SKILL_OPTS_G2.map(s => <option key={s} value={language === 'en' ? translateSkill(s, language) : s} />)}</datalist>
                            <datalist id="skill-list-g3">{SKILL_OPTS_G3.map(s => <option key={s} value={language === 'en' ? translateSkill(s, language) : s} />)}</datalist>

                            {[1, 2, 3, 4].map(num => {
                                const k = `skill${num}` as keyof typeof skills;
                                const isG1 = num === 1 || num === 2;
                                const groupName = isG1 ? 'G1' : (num === 3 ? 'G2' : 'G3');
                                const listId = isG1 ? 'skill-list-g1' : (num === 3 ? 'skill-list-g2' : 'skill-list-g3');

                                return (
                                    <div key={k} style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                                        <div style={{ width: '60px', color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)' }}>{language === 'en' ? `Skill ${num}` : `スキル${num}`} <br /><small>({groupName})</small></div>
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

                        {/* Exclude Favorited AFs */}
                        <div style={{ marginTop: '0.8rem', marginBottom: '1rem', padding: '0 0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)', width: 'fit-content' }}>
                                <input
                                    type="checkbox"
                                    checked={excludeFavorites}
                                    onChange={e => setExcludeFavorites(e.target.checked)}
                                />
                                <span style={{ fontSize: 'var(--font-size-sub)' }}>
                                    {language === 'en' ? 'Exclude favorited AFs (Do not use locked items)' : 'お気に入り(鍵付き)のAFを候補から除外する'}
                                </span>
                            </label>
                        </div>

                        {/* Exclude Skills */}
                        <div style={{ marginBottom: '1.5rem', marginTop: '1rem', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                                <h5 style={{ fontSize: 'var(--font-size-main)', margin: 0, color: 'var(--text-muted)' }}>{language === 'en' ? 'Exclude Target Skills' : '除外スキル設定'}</h5>
                                <button className="btn btn-ghost" onClick={() => setExcludeSkillsUI([...excludeSkillsUI, { id: crypto.randomUUID(), group: 'G1', skill: '' }])} style={{ fontSize: 'var(--font-size-sub)', padding: '0.2rem 0.6rem', border: '1px solid var(--panel-border)' }}>
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
                        <div style={{ marginTop: '1rem' }}>
                            <label style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                                📝 {language === 'en' ? 'Memo (Optional)' : 'メモ（任意）'}
                            </label>
                            <textarea
                                className="input"
                                style={{ width: '100%', height: '72px', resize: 'vertical', fontFamily: 'inherit', fontSize: 'var(--font-size-main)' }}
                                placeholder={language === 'en' ? 'Enter notes or remarks for this condition...' : 'この条件へのメモや備考などを入力できます...'}
                                value={condMemo}
                                onChange={e => setCondMemo(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn btn-ghost" onClick={handleCancelAdd}>{language === 'en' ? 'Cancel' : 'キャンセル'}</button>
                            <button className="btn btn-primary" onClick={handleSave}>{editingId ? (language === 'en' ? 'Save Changes' : '保存する') : (language === 'en' ? 'Add Condition' : '追加する')}</button>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {conditions.map((c, i) => {
                        const isExpanded = expandedIds.has(c.id);
                        return (
                            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', background: 'var(--criteria-card-bg)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--panel-border)', transition: 'all 0.2s', ':hover': { borderColor: 'var(--accent-blue)', opacity: 1 } } as any}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => toggleExpand(c.id)}>
                                        <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-main)', color: 'var(--accent-gold)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {i + 1}. {c.name}
                                        </div>
                                        <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-main)', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{ background: 'var(--dim-border)', padding: '2px 6px', borderRadius: '4px' }}>
                                                {c.methodType === 1 ? (language === 'en' ? 'Skill Oriented' : 'スキル指向') : (language === 'en' ? `Character Oriented: ${c.characterName} (Count: ${c.targetCountMethod2})` : `キャラ指向: ${c.characterName} (確保: ${c.targetCountMethod2}個)`)}
                                            </span>
                                            {/* Show the priority-1 skill in the summary badge */}
                                            {(() => {
                                                const sk = Object.entries(c.skillPriorities)
                                                    .find(([, p]) => p === 1);
                                                const skName = sk ? c.skills[sk[0] as keyof typeof c.skills] : '';
                                                return skName ? (
                                                    <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {language === 'en' ? 'Target Skill:' : '対象スキル:'} <span style={{ color: 'var(--skill-name-color)', fontWeight: 500 }}>{language === 'en' ? translateSkill(skName, language) : skName}</span> {c.skillMustMatch[sk![0] as keyof typeof c.skillMustMatch] ? (language === 'en' ? '(Must Match)' : '(必須)') : (language === 'en' ? '(Optional)' : '(任意)')}
                                                    </span>
                                                ) : null;
                                            })()}
                                            {c.memo && (
                                                <span style={{ color: 'var(--text-muted)', fontStyle: 'normal', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    📝 {c.memo}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-ghost" onClick={() => handleCopy(c)} style={{ padding: '0.4rem', fontSize: 'var(--font-size-sub)', color: 'var(--accent-blue-hover)' }} title={language === 'en' ? 'Copy' : 'コピー'}>
                                            <Copy size={16} /> <span style={{ marginLeft: '0.2rem' }}>{language === 'en' ? 'Copy' : 'コピー'}</span>
                                        </button>
                                        <div style={{ width: '1px', background: 'var(--panel-border)', margin: '0 0.5rem' }} />
                                        <button className="btn btn-ghost" onClick={() => handleEdit(c)} style={{ padding: '0.4rem', fontSize: 'var(--font-size-sub)' }} title={language === 'en' ? 'Edit' : '再編集'}>
                                            {language === 'en' ? 'Edit' : '編集'}
                                        </button>
                                        <div style={{ width: '1px', background: 'var(--panel-border)', margin: '0 0.5rem' }} />
                                        <button className="btn btn-ghost" onClick={() => moveUp(i)} disabled={i === 0} style={{ padding: '0.4rem', opacity: i === 0 ? 0.3 : 1 }} title={language === 'en' ? 'Move Up' : '優先度を上げる'}>
                                            <ChevronUp size={20} />
                                        </button>
                                        <button className="btn btn-ghost" onClick={() => moveDown(i)} disabled={i === conditions.length - 1} style={{ padding: '0.4rem', opacity: i === conditions.length - 1 ? 0.3 : 1 }} title={language === 'en' ? 'Move Down' : '優先度を下げる'}>
                                            <ChevronDown size={20} />
                                        </button>
                                        {deletingId === c.id ? (
                                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginLeft: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                                <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--accent-danger)', marginRight: '0.2rem' }}>{language === 'en' ? 'Delete?' : '本当に削除しますか？'}</span>
                                                <button className="btn btn-danger" onClick={() => { handleDelete(c.id); setDeletingId(null); }} style={{ padding: '0.2rem 0.6rem', fontSize: 'var(--font-size-sub)' }}>{language === 'en' ? 'Delete' : '削除'}</button>
                                                <button className="btn btn-ghost" onClick={() => setDeletingId(null)} style={{ padding: '0.2rem 0.6rem', fontSize: 'var(--font-size-sub)', color: 'var(--text-main)' }}>{language === 'en' ? 'Cancel' : 'キャンセル'}</button>
                                            </div>
                                        ) : (
                                            <button className="btn btn-danger" onClick={() => setDeletingId(c.id)} style={{ padding: '0.4rem', marginLeft: '0.5rem' }} title={language === 'en' ? 'Delete' : '削除'}>
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isExpanded && (() => {
                                    const keptAFs = allArtifacts
                                        .filter(a => a.keepFlag === c.id)
                                        .sort((a, b) => {
                                            const attrDiff = parseInt(a.attribute) - parseInt(b.attribute);
                                            if (attrDiff !== 0) return attrDiff;
                                            return parseInt(a.kind) - parseInt(b.kind);
                                        });
                                    return (
                                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--panel-border)', display: 'flex', gap: '1.5rem' }}>
                                            {/* Left: condition details */}
                                            <div style={{ flex: 1, fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', minWidth: 0 }}>
                                                {c.methodType === 1 && (
                                                    <div style={{ marginBottom: '0.6rem' }}>
                                                        <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Target Amount (Element × Kind):' : '確保対象の属性×武器種:'}</strong>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
                                                            {Object.entries(c.targetCount)
                                                                .sort(([a], [b]) => {
                                                                    const [aAttr, aKind] = a.split('_').map(Number);
                                                                    const [bAttr, bKind] = b.split('_').map(Number);
                                                                    return aAttr !== bAttr ? aAttr - bAttr : aKind - bKind;
                                                                })
                                                                .map(([key, count]) => {
                                                                    const [attr, kind] = key.split('_');
                                                                    return <span key={key} style={{ background: 'var(--criteria-detail-bg)', padding: '2px 6px', borderRadius: '4px', fontSize: 'var(--font-size-sub)' }}>{ATTRIBUTE_OPS.find(a => a.val === attr)?.label}{language === 'en' ? '' : '属性'}・{KIND_OPS.find(k => k.val === kind)?.label} ({count}{language === 'en' ? '' : '個'})</span>;
                                                                })}
                                                        </div>
                                                    </div>
                                                )}
                                                {c.methodType === 2 && (
                                                    <div style={{ marginBottom: '0.6rem' }}>
                                                        <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Character Oriented Target:' : 'キャラ指定条件:'}</strong><br />
                                                        {language === 'en' ? 'Element:' : '属性:'} {ATTRIBUTE_OPS.find(a => a.val === c.attributes[0])?.label}<br />
                                                        {language === 'en' ? 'Weapon Kind:' : '武器種:'} {KIND_OPS.find(k => k.val === c.weaponKinds[0])?.label}{c.weaponKinds2?.[0] ? ` ${language === 'en' ? 'or' : 'または'} ${KIND_OPS.find(k => k.val === c.weaponKinds2?.[0])?.label}` : ''}
                                                    </div>
                                                )}
                                                <div style={{ marginTop: '0.5rem' }}>
                                                    <strong style={{ color: 'var(--text-main)' }}>{language === 'en' ? 'Target Skills:' : '対象スキルの設定:'}</strong>
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
                                                                    <span style={{ color: 'var(--skill-name-color)', fontWeight: 500 }}>{language === 'en' ? translateSkill(s, language) : s}</span> —
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
                                                        {c.methodType === 1
                                                            ? Object.values(c.targetCount).reduce((a, b) => a + b, 0)
                                                            : (c.targetCountMethod2 || 0)}{language === 'en' ? '' : '件'}
                                                    </span>
                                                </div>

                                                {/* Selected AF detail box */}
                                                {selectedKeepAF && selectedKeepAF.keepFlag === c.id && (
                                                    <div style={{ background: 'var(--dim-bg)', borderRadius: '8px', padding: '0.8rem', borderLeft: '3px solid var(--accent-blue)', border: '1px solid var(--dim-border)' }}>
                                                        <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: 'var(--font-size-sub)' }}>
                                                            {selectedKeepAF.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Lv{selectedKeepAF.level}</span>
                                                        </div>
                                                        {[selectedKeepAF.skill1_info, selectedKeepAF.skill2_info, selectedKeepAF.skill3_info, selectedKeepAF.skill4_info].map((sk, idx) => {
                                                            if (!sk?.name) return null;
                                                            const glabel = idx < 2 ? '[I]' : idx === 2 ? '[II]' : '[III]';
                                                            const isMax = sk.skill_quality === 5;
                                                            return (
                                                                <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', marginBottom: '0.2rem', fontSize: 'calc(var(--font-size-sub) * 0.97)', lineHeight: '1.4' }}>
                                                                    <span style={{ color: isMax ? 'var(--accent-purple)' : 'var(--accent-gold)', minWidth: '22px', flexShrink: 0 }}>★{sk.skill_quality}</span>
                                                                    <span style={{ color: 'var(--accent-success)', minWidth: '26px', flexShrink: 0 }}>{glabel}</span>
                                                                    <span style={{ color: 'var(--text-main)', flex: 1, wordBreak: 'break-all' }}>{language === 'en' ? translateSkill(sk.name, language) : sk.name}</span>
                                                                    <span style={{ color: 'var(--accent-blue-hover)', flexShrink: 0 }}>{sk.effect_value}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* AF list table */}
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
                                                                    <tr
                                                                        key={af.id}
                                                                        onClick={() => setSelectedKeepAF(af)}
                                                                        style={{
                                                                            cursor: 'pointer',
                                                                            background: selectedKeepAF?.id === af.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                                                                            borderBottom: '1px solid var(--dim-border)',
                                                                        }}
                                                                    >
                                                                        <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text-muted)' }}>{af.id}</td>
                                                                        <td style={{ padding: '0.3rem 0.5rem' }}>{language === 'en' ? t(`ATTR_${af.attribute}` as TranslationKey) : (ATTR_NAMES[af.attribute] || af.attribute)}</td>
                                                                        <td style={{ padding: '0.3rem 0.5rem' }}>{language === 'en' ? t(`WPN_${af.kind}` as TranslationKey) : (KIND_NAMES_SHORT[af.kind] || af.kind)}</td>
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
                        );
                    })}

                    {conditions.length === 0 && !isAdding && (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem', background: 'var(--dim-bg)', borderRadius: '8px' }}>
                            {language === 'en' ? <>No AF target conditions are set.<br />Please add one using the "Add Condition" button above.</> : <>現在、確保AF条件は設定されていません。<br />右上の「条件を追加」から設定してください。</>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
