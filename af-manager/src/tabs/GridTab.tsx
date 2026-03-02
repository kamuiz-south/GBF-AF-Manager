import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Heart, Package, Star, Trash2 } from 'lucide-react';
import { db } from '../db';
import { useAppStore } from '../store/useAppStore';
import { isRareArtifact } from '../utils/evaluator';
import { useTranslation, type TranslationKey } from '../i18n';

const ATTR_TEXT_COLORS: Record<string, string> = {
    "1": "#ef4444", // Fire
    "2": "#3b82f6", // Water
    "3": "#f97316", // Earth
    "4": "#10b981", // Wind
    "5": "#fbbf24", // Light
    "6": "#a855f7", // Dark
};

const ATTR_BADGE_COLORS: Record<string, { bg: string, text: string }> = {
    "1": { bg: "#ef4444", text: "#fff" },
    "2": { bg: "#3b82f6", text: "#fff" },
    "3": { bg: "#f97316", text: "#fff" },
    "4": { bg: "#10b981", text: "#fff" },
    "5": { bg: "#fbbf24", text: "#000" },
    "6": { bg: "#a855f7", text: "#fff" },
};

export default function GridTab() {
    const { t, language } = useTranslation();
    const [currentPage, setCurrentPage] = useState(0);
    const artifacts = useLiveQuery(() => db.artifacts.toArray()) || [];

    const selectedArtifact = useAppStore(state => state.selectedArtifact);
    const setSelectedArtifact = useAppStore(state => state.setSelectedArtifact);
    const conditions = useLiveQuery(() => db.conditions.toArray()) || [];
    const memos = useLiveQuery(() => db.memos.toArray()) || [];

    const updateMemo = async (id: number, text: string) => {
        await db.memos.put({ id, memo: text });
    };

    const [filterAttr, setFilterAttr] = useState('');
    const [filterKind, setFilterKind] = useState('');

    const ITEMS_PER_PAGE = 20;
    // Sort by inventory order, then apply attribute/kind filters
    const sorted = [...artifacts].sort((a, b) => {
        const orderA = a.inventoryOrder ?? a.id;
        const orderB = b.inventoryOrder ?? b.id;
        return orderA - orderB;
    });
    const filtered = sorted.filter(a =>
        (filterAttr === '' || a.attribute === filterAttr) &&
        (filterKind === '' || a.kind === filterKind)
    );
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const pageItems = filtered.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

    // When filters change, snap back to page 0
    useEffect(() => {
        setCurrentPage(0);
    }, [filterAttr, filterKind]);

    useEffect(() => {
        if (!selectedArtifact && pageItems.length > 0) {
            setSelectedArtifact(pageItems[0]);
        }
    }, [pageItems, selectedArtifact, setSelectedArtifact]);

    const settings = useLiveQuery(() => db.settings.get('global'));
    const noMaxHeight = settings?.design?.gridDetailNoMaxHeight;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', height: '100%', maxWidth: '850px', margin: '0 auto' }}>
            {/* Detail View (Top) */}
            <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', minHeight: noMaxHeight ? 'none' : '260px', maxHeight: noMaxHeight ? 'none' : '310px', overflowY: 'auto' }}>
                {selectedArtifact ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.3)', margin: 0 }}>{selectedArtifact.name}</h3>
                                <span style={{ background: 'var(--dim-bg)', padding: '2px 8px', borderRadius: '12px', fontSize: 'var(--font-size-sub)' }}>
                                    Lv {selectedArtifact.level}/{selectedArtifact.max_level}
                                </span>
                                <span style={{
                                    background: ATTR_BADGE_COLORS[selectedArtifact.attribute]?.bg || '#777',
                                    color: ATTR_BADGE_COLORS[selectedArtifact.attribute]?.text || '#fff',
                                    fontSize: 'var(--font-size-sub)', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px'
                                }}>
                                    {language === 'en'
                                        ? `${t(`ATTR_${selectedArtifact.attribute}` as TranslationKey)} / ${t(`WPN_${selectedArtifact.kind}` as TranslationKey)}`
                                        : `${t(`ATTR_${selectedArtifact.attribute}` as TranslationKey)} / ${t(`WPN_${selectedArtifact.kind}` as TranslationKey)}`
                                    }
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                {selectedArtifact.is_locked && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-gold)', color: '#000', padding: '2px 5px', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}><Heart size={13} /> {language === 'en' ? 'Fav' : 'お気に入り'}</span>}
                                {selectedArtifact.is_unnecessary && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-purple)', color: '#fff', padding: '2px 5px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Package size={13} /> {language === 'en' ? 'Trash' : '不用品'}</span>}
                                {selectedArtifact.discardFlag && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-danger)', color: '#fff', padding: '2px 5px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Trash2 size={13} /> {language === 'en' ? 'Discard' : '廃棄提案'}</span>}
                                {selectedArtifact.keepFlag && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-blue)', color: '#fff', padding: '2px 5px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Star size={13} /> {language === 'en' ? 'Keep' : '確保提案'}</span>}
                                <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>ID: {selectedArtifact.id}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                            <SkillRow skill={selectedArtifact.skill1_info} group={1} />
                            <SkillRow skill={selectedArtifact.skill2_info} group={1} />
                            <SkillRow skill={selectedArtifact.skill3_info} group={2} />
                            <SkillRow skill={selectedArtifact.skill4_info} group={3} />

                            {/* Equipped Character display */}
                            <div style={{ marginTop: '0.5rem', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                                {getEquippedCharacter(selectedArtifact, language)}
                            </div>

                            {/* Keep condition title */}
                            {selectedArtifact.keepFlag && (() => {
                                const cond = conditions.find(c => c.id === selectedArtifact.keepFlag);
                                return cond ? (
                                    <div style={{ fontSize: 'var(--font-size-sub)', color: 'var(--accent-blue-hover)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                                        <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{language === 'en' ? '✓ Keep:' : '✓ 確保条件:'}</span>
                                        <span>{cond.name || (language === 'en' ? '(No Name)' : '(名称なし)')}</span>
                                    </div>
                                ) : null;
                            })()}

                            {/* Memo field */}
                            <div style={{ marginTop: '0.4rem' }}>
                                <input
                                    key={selectedArtifact.id}
                                    type="text"
                                    className="input"
                                    style={{ width: '100%', padding: '0.3rem 0.6rem', fontSize: 'var(--font-size-sub)' }}
                                    placeholder={language === 'en' ? 'Memo...' : 'メモ...'}
                                    defaultValue={memos.find(m => m.id === selectedArtifact.id)?.memo || ''}
                                    onBlur={e => updateMemo(selectedArtifact.id, e.target.value)}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '3rem' }}>{language === 'en' ? 'Select an AF or import data' : 'AFを選択してくださいまたはデータを取り込んでください'}</div>
                )}
            </div>

            {/* Grid View (Bottom) */}
            <div className="glass-panel" style={{ padding: '0.8rem 2rem 0.6rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                {/* Grid header: count left, filters right */}
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '550px', gap: '0.6rem' }}>
                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginRight: 'auto' }}>
                        {filtered.length} / {artifacts.length} {language === 'en' ? 'items' : '件'}
                    </span>
                    <select className="input" style={{ padding: '0.3rem 0.5rem', width: 'auto', fontSize: 'var(--font-size-sub)' }}
                        value={filterAttr}
                        onChange={e => { setFilterAttr(e.target.value); }}>
                        <option value="">{language === 'en' ? 'Attr: ' : '属性: '}{t('UI_ALL')}</option>
                        {(['1', '2', '3', '4', '5', '6'] as const).map(k => (
                            <option key={k} value={k}>{t(`ATTR_${k}` as TranslationKey)}</option>
                        ))}
                    </select>
                    <select className="input" style={{ padding: '0.3rem 0.5rem', width: 'auto', fontSize: 'var(--font-size-sub)' }}
                        value={filterKind}
                        onChange={e => { setFilterKind(e.target.value); }}>
                        <option value="">{language === 'en' ? 'Weapon: ' : '武器種: '}{t('UI_ALL')}</option>
                        {(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const).map(k => (
                            <option key={k} value={k}>{t(`WPN_${k}` as TranslationKey)}</option>
                        ))}
                    </select>
                    {(filterAttr || filterKind) && (
                        <button style={{ fontSize: 'calc(var(--font-size-sub) * 0.94)', padding: '0.25rem 0.5rem', background: 'var(--dim-bg)', border: '1px solid var(--dim-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                            onClick={() => { setFilterAttr(''); setFilterKind(''); }}>
                            {language === 'en' ? '✕ Clear' : '✕ 解除'}
                        </button>
                    )}
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gridTemplateRows: 'repeat(4, 1fr)',
                    gap: '12px',
                    width: '100%',
                    maxWidth: '550px'
                }}>
                    {pageItems.map((item) => {
                        const isSelected = selectedArtifact?.id === item.id;

                        let statusColor = 'rgba(0,0,0,0.4)';
                        let statusText = `Lv${item.level}`;

                        if (item.is_locked && item.discardFlag) {
                            statusColor = '#d97706'; statusText = language === 'en' ? 'Discard?' : '廃棄？'; // amber conflict badge
                        } else if (item.keepFlag && !item.is_locked) {
                            statusColor = '#3b82f6'; statusText = 'Keep';
                        } else if (item.discardFlag && !item.is_unnecessary) {
                            statusColor = '#ef4444'; statusText = language === 'en' ? 'Discard' : '廃棄';
                        } else if (item.is_locked) {
                            statusColor = '#fbbf24'; statusText = 'Fav';
                        } else if (item.is_unnecessary) {
                            statusColor = '#8b5cf6'; statusText = 'Trash';
                        }

                        const isRare = isRareArtifact(item);
                        // equip_npc_info is [] when empty, or a plain object when equipped
                        const equipInfo = item.equip_npc_info;
                        const isEquipped = !Array.isArray(equipInfo);
                        return (
                            <div
                                key={item.id}
                                onClick={() => setSelectedArtifact(item)}
                                style={{
                                    aspectRatio: '1/1',
                                    background: isSelected
                                        ? 'var(--grid-item-selected-bg)'
                                        : isRare
                                            ? 'var(--grid-item-rare-bg)'
                                            : 'var(--grid-item-bg)',
                                    border: `2px solid ${isSelected ? '#3b82f6' : isRare ? 'var(--grid-item-rare-border)' : 'var(--dim-border)'}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'column',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: isSelected ? '0 0 16px rgba(59, 130, 246, 0.4)' : 'none',
                                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                    zIndex: isSelected ? 10 : 1
                                }}
                            >
                                {/* 装備中 badge — top-left */}
                                {isEquipped && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, left: 0,
                                        background: '#dc2626',
                                        color: '#fff',
                                        fontSize: 'calc(var(--font-size-sub) * 0.75)',
                                        fontWeight: 700,
                                        padding: '2px 4px',
                                        borderBottomRightRadius: '5px',
                                        lineHeight: 1.2,
                                        zIndex: 3
                                    }}>{language === 'en' ? 'EQP' : '装備中'}</div>
                                )}

                                <div style={{
                                    position: 'absolute',
                                    top: '40%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    fontWeight: 900,
                                    color: ATTR_TEXT_COLORS[item.attribute] || 'rgba(255, 255, 255, 0.5)',
                                    fontSize: language === 'en' ? 'calc(var(--font-size-main) * 1.0)' : 'calc(var(--font-size-main) * 1.4)',
                                    textShadow: 'var(--weapon-text-shadow)'
                                }}>
                                    {language === 'en'
                                        ? t(`WPN_${item.kind}` as TranslationKey).slice(0, 3)
                                        : t(`WPN_${item.kind}` as TranslationKey)?.[0] || '?'}
                                </div>

                                <div style={{
                                    position: 'absolute',
                                    bottom: 0, left: 0, right: 0,
                                    background: statusColor,
                                    color: (statusColor === '#fbbf24') ? '#000' : '#fff',
                                    fontSize: 'calc(var(--font-size-sub) * 0.94)',
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    padding: '3px 0',
                                    boxShadow: '0 -2px 8px rgba(0,0,0,0.2)'
                                }}>
                                    {statusText}
                                </div>
                            </div>
                        );
                    })}

                    {/* Fill empty cells */}
                    {Array.from({ length: 20 - pageItems.length }).map((_, i) => (
                        <div key={`empty-${i}`} style={{
                            aspectRatio: '1/1',
                            background: 'var(--grid-item-bg)',
                            border: '1px dashed var(--dim-border)',
                            borderRadius: '8px'
                        }} />
                    ))}
                </div>

                {/* Pagination Controls */}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.4rem' }}>
                    <button
                        className="btn btn-ghost"
                        style={{ padding: '0.3rem', borderRadius: '6px' }}
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage(0)}
                        title={language === 'en' ? 'First Page' : '最初のページへ'}
                    >
                        <ChevronsLeft size={18} />
                    </button>
                    <button
                        className="btn btn-ghost"
                        style={{ padding: '0.3rem', borderRadius: '6px' }}
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage(c => Math.max(0, c - 1))}
                        title={language === 'en' ? 'Previous Page' : '前のページへ'}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-main)', fontWeight: 500, background: 'rgba(0,0,0,0.3)', padding: '0.2rem 1rem', borderRadius: '1rem' }}>
                        {currentPage + 1} / {Math.max(1, totalPages)}
                    </span>
                    <button
                        className="btn btn-ghost"
                        style={{ padding: '0.3rem', borderRadius: '6px' }}
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setCurrentPage(c => Math.min(totalPages - 1, c + 1))}
                        title={language === 'en' ? 'Next Page' : '次のページへ'}
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button
                        className="btn btn-ghost"
                        style={{ padding: '0.3rem', borderRadius: '6px' }}
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setCurrentPage(Math.max(0, totalPages - 1))}
                        title={language === 'en' ? 'Last Page' : '最後のページへ'}
                    >
                        <ChevronsRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function getEquippedCharacter(artifact: any, language: string) {
    const info = artifact.equip_npc_info;
    const prefix = language === 'en' ? 'Equipped By: ' : '装備キャラ: ';
    const noneText = language === 'en' ? 'None' : 'なし';
    const unknownText = language === 'en' ? '(Unknown)' : '(名前不明)';

    if (!info) return prefix + noneText;

    // Case 1: object form {user_npc_id, name, image} — equipped
    if (!Array.isArray(info) && typeof info === 'object' && info.user_npc_id) {
        return `${prefix}${info.name || unknownText}`;
    }

    // Case 2: non-empty array — equipped (legacy or future format)
    if (Array.isArray(info) && info.length > 0) {
        const npc = info[0];
        return `${prefix}${npc?.name || unknownText}`;
    }

    // Case 3: empty array [] — not equipped
    return prefix + noneText;
}

function SkillRow({ skill, group }: { skill?: any; group: 1 | 2 | 3 }) {
    if (!skill || !skill.name) return <div style={{ background: 'rgba(0,0,0,0.1)', borderRadius: '8px', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>-</div>;

    const isMax = skill.skill_quality === 5;
    const maxColor = 'var(--accent-purple)';
    const groupLabel = group === 1 ? '[Ⅰ]' : group === 2 ? '[Ⅱ]' : '[Ⅲ]';
    const groupColor = 'var(--accent-success)'; // teal/green equivalent

    return (
        <div style={{ background: 'var(--criteria-detail-bg)', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid var(--dim-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                <span style={{ color: isMax ? maxColor : 'var(--accent-gold)', fontWeight: isMax ? 'bold' : 600, minWidth: '36px', flexShrink: 0 }}>
                    ★{skill.skill_quality}
                </span>
                <span style={{ color: 'var(--text-main)', fontSize: 'calc(var(--font-size-sub) * 0.94)', minWidth: '36px', flexShrink: 0 }}>
                    Lv{skill.level}
                </span>
                <span style={{ color: groupColor, fontSize: 'var(--font-size-sub)', fontWeight: 600, minWidth: '30px', flexShrink: 0 }}>
                    {groupLabel}
                </span>
                <span style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-main)', wordBreak: 'break-all', lineHeight: '1.4', minWidth: 0 }}>
                    {skill.name}
                </span>
            </div>
            <span style={{ color: isMax ? maxColor : 'var(--accent-blue-hover)', fontSize: 'var(--font-size-sub)', fontWeight: 500, marginLeft: '0.8rem', flexShrink: 0 }}>
                {skill.effect_value}
            </span>
        </div>
    );
}
