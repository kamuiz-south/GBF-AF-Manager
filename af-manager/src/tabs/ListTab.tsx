import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ArrowUpDown, Heart, Package, Star, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { db } from '../db';
import type { AppArtifact } from '../types';
import { useTranslation, type TranslationKey } from '../i18n';

export default function ListTab() {
    const { t, language } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAttr, setFilterAttr] = useState('');
    const [filterKind, setFilterKind] = useState('');
    const [sortField, setSortField] = useState<keyof AppArtifact | 'inventoryOrder' | 'attr_kind' | 'memoText'>('inventoryOrder');
    const [sortAsc, setSortAsc] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Initial load for page size from db
    useEffect(() => {
        db.settings.get('global').then(s => {
            if (s?.pageLimit) setPageSize(s.pageLimit);
        });
    }, []);

    // Fetch all items from DB
    const artifacts = useLiveQuery(() => db.artifacts.toArray()) || [];
    const memos = useLiveQuery(() => db.memos.toArray()) || [];
    const conditions = useLiveQuery(() => db.conditions.toArray()) || [];

    // Join memo data and sort/filter
    const displayList = artifacts
        .map(a => {
            const memo = memos.find(m => m.id === a.id)?.memo || '';
            return { ...a, memoText: memo };
        })
        .filter(a =>
            (filterAttr === '' || a.attribute === filterAttr) &&
            (filterKind === '' || a.kind === filterKind) &&
            (
                String(a.id).includes(searchTerm) ||
                a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.memoText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.skill1_info?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.skill2_info?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.skill3_info?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.skill4_info?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
        )
        .sort((a, b) => {
            if (sortField === 'attr_kind') {
                const attrDiff = parseInt(a.attribute) - parseInt(b.attribute);
                if (attrDiff !== 0) return sortAsc ? attrDiff : -attrDiff;
                const kindDiff = parseInt(a.kind) - parseInt(b.kind);
                return sortAsc ? kindDiff : -kindDiff;
            }
            let valA: any = sortField === 'memoText' ? a.memoText : a[sortField as keyof AppArtifact];
            let valB: any = sortField === 'memoText' ? b.memoText : b[sortField as keyof AppArtifact];
            if (valA === undefined) valA = 0;
            if (valB === undefined) valB = 0;
            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });

    const updateMemo = async (id: number, memoText: string) => {
        await db.memos.put({ id, memo: memoText });
    };

    const handlePageSizeChange = async (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
        const settings = await db.settings.get('global');
        if (settings) {
            await db.settings.put({ ...settings, pageLimit: newSize });
        }
    };

    const toggleSort = (field: keyof AppArtifact | 'inventoryOrder' | 'attr_kind' | 'memoText') => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false); // default desc for new field
        }
    };

    const totalPages = Math.ceil(displayList.length / pageSize);
    const paginatedItems = displayList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // reset page to 1 if filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterAttr, filterKind, sortField, sortAsc, pageSize]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>

            {/* Controls Bar */}
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="input"
                        placeholder={language === 'en' ? 'Search by ID, name, skill, memo...' : 'IDやAF名、スキル名、メモで検索...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '2.2rem' }}
                    />
                </div>

                {/* Attribute filter */}
                <select className="input" style={{ padding: '0.4rem 0.6rem', width: 'auto' }}
                    value={filterAttr}
                    onChange={e => setFilterAttr(e.target.value)}>
                    <option value="">{language === 'en' ? 'Attr: ' : '属性: '}{t('UI_ALL')}</option>
                    {(['1', '2', '3', '4', '5', '6'] as const).map(k => (
                        <option key={k} value={k}>{t(`ATTR_${k}` as TranslationKey)}</option>
                    ))}
                </select>

                {/* Kind filter */}
                <select className="input" style={{ padding: '0.4rem 0.6rem', width: 'auto' }}
                    value={filterKind}
                    onChange={e => { setFilterKind(e.target.value); setCurrentPage(1); }}>
                    <option value="">{language === 'en' ? 'Weapon: ' : '武器種: '}{t('UI_ALL')}</option>
                    {(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const).map(k => (
                        <option key={k} value={k}>{t(`WPN_${k}` as TranslationKey)}</option>
                    ))}
                </select>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-main)' }}>
                        {language === 'en' ? 'Showing: ' : '表示件数: '}{displayList.length} / {artifacts.length}
                    </div>
                </div>
            </div>

            {/* Top Pagination Controls */}
            {displayList.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '-0.5rem', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--panel-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem', borderRadius: '6px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(1)} title={language === 'en' ? 'First Page' : '最初のページへ'}><ChevronsLeft size={16} /></button>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem', borderRadius: '6px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(c => Math.max(1, c - 1))} title={language === 'en' ? 'Previous Page' : '前のページへ'}><ChevronLeft size={16} /></button>
                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-main)', minWidth: '4rem', textAlign: 'center', fontWeight: 600 }}>
                            {currentPage} / {totalPages || 1}
                        </span>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem', borderRadius: '6px' }} disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))} title={language === 'en' ? 'Next Page' : '次のページへ'}><ChevronRight size={16} /></button>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem', borderRadius: '6px' }} disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(totalPages)} title={language === 'en' ? 'Last Page' : '最後のページへ'}><ChevronsRight size={16} /></button>
                    </div>
                    <div style={{ position: 'absolute', right: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <select className="input" style={{ padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: 'var(--font-size-sub)' }}
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
                            <option value={10}>{language === 'en' ? '10 / page' : '10件 / ページ'}</option>
                            <option value={50}>{language === 'en' ? '50 / page' : '50件 / ページ'}</option>
                            <option value={100}>{language === 'en' ? '100 / page' : '100件 / ページ'}</option>
                            <option value={200}>{language === 'en' ? '200 / page' : '200件 / ページ'}</option>
                            <option value={300}>{language === 'en' ? '300 / page' : '300件 / ページ'}</option>
                            <option value={500}>{language === 'en' ? '500 / page' : '500件 / ページ'}</option>
                            <option value={750}>{language === 'en' ? '750 / page' : '750件 / ページ'}</option>
                            <option value={1500}>{language === 'en' ? '1500 / page' : '1500件 / ページ'}</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Table Area */}
            <div className="glass-panel" style={{ flex: 1, overflow: 'auto', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--panel-bg)', backdropFilter: 'blur(10px)', zIndex: 1 }}>
                        <tr>
                            <th style={thStyle} onClick={() => toggleSort('id')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>ID <ArrowUpDown size={14} /></div>
                            </th>
                            <th style={thStyle}>{language === 'en' ? 'Name' : '名前'}</th>
                            <th style={thStyle} onClick={() => toggleSort('attr_kind')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>{language === 'en' ? 'Attr / Wpn' : '属性・武器種'} <ArrowUpDown size={14} /></div>
                            </th>
                            <th style={thStyle} onClick={() => toggleSort('level')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>Lv <ArrowUpDown size={14} /></div>
                            </th>
                            <th style={thStyle} onClick={() => toggleSort('evaluationScore')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>{language === 'en' ? 'Score' : '評価値'} <ArrowUpDown size={14} /></div>
                            </th>
                            <th style={thStyle}>{language === 'en' ? 'Skill 1' : 'スキル1'}</th>
                            <th style={thStyle}>{language === 'en' ? 'Skill 2' : 'スキル2'}</th>
                            <th style={thStyle}>{language === 'en' ? 'Skill 3' : 'スキル3'}</th>
                            <th style={thStyle}>{language === 'en' ? 'Skill 4' : 'スキル4'}</th>
                            <th style={{ ...thStyle, minWidth: '100px' }}>{language === 'en' ? 'Status' : '状態'}</th>
                            <th style={thStyle} onClick={() => toggleSort('memoText')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>{language === 'en' ? 'Memo' : 'メモ'} <ArrowUpDown size={14} /></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedItems.map(a => (
                            <tr key={a.id} style={{ borderBottom: '1px solid var(--panel-border)', backgroundColor: a.keepFlag ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                <td style={tdStyle}>
                                    <div style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{a.id}</div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={a.name}>{a.name}</div>
                                </td>
                                <td style={tdStyle}><span style={{ minWidth: '4em', display: 'inline-block' }}>{t(`ATTR_${a.attribute}` as TranslationKey, a.attribute)} / {t(`WPN_${a.kind}` as TranslationKey, a.kind)}</span></td>
                                <td style={tdStyle}>{a.level}/{a.max_level}</td>
                                <td style={tdStyle}>
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{a.evaluationScore != null ? a.evaluationScore.toFixed(2) : '-'}</span>
                                </td>
                                <td style={tdStyle}><SkillCell skill={a.skill1_info} /></td>
                                <td style={tdStyle}><SkillCell skill={a.skill2_info} /></td>
                                <td style={tdStyle}><SkillCell skill={a.skill3_info} /></td>
                                <td style={tdStyle}><SkillCell skill={a.skill4_info} /></td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', maxWidth: '140px' }}>
                                        {a.is_locked && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-gold)', color: '#000', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}><Heart size={12} /> {language === 'en' ? 'Fav' : 'お気に入り'}</span>}
                                        {a.is_unnecessary && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-purple)', color: '#fff', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Package size={12} /> {language === 'en' ? 'Trash' : '不用品'}</span>}
                                        {a.keepFlag && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-blue)', color: '#fff', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Star size={12} /> {language === 'en' ? 'Keep' : '確保提案'}</span>
                                                {(() => { const cond = conditions.find(c => c.id === a.keepFlag); return cond ? <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', color: 'var(--accent-blue-hover)' }}>{cond.name || (language === 'en' ? '(No Name)' : '(名称なし)')}</span> : null; })()}
                                            </div>
                                        )}
                                        {a.discardFlag && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-danger)', color: '#fff', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Trash2 size={12} /> {language === 'en' ? 'Discard' : '廃棄提案'}</span>}
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <input
                                        type="text"
                                        className="input"
                                        style={{ padding: '0.3rem 0.5rem', background: 'transparent', borderColor: 'transparent', borderBottomColor: 'var(--panel-border)', borderRadius: 0, minWidth: '160px' }}
                                        placeholder={language === 'en' ? 'Memo...' : 'メモ...'}
                                        defaultValue={a.memoText}
                                        onBlur={(e) => {
                                            if (e.target.value !== a.memoText) updateMemo(a.id, e.target.value);
                                        }}
                                    />
                                </td>
                            </tr>
                        ))}
                        {displayList.length === 0 && (
                            <tr>
                                <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {language === 'en' ? 'No data. Please import JSON from the Data Tab.' : 'データがありません。データ取得タブからJSONをインポートしてください。'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Pagination Controls */}
            {displayList.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '-0.5rem', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--panel-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem', borderRadius: '6px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(1)} title="最初のページへ"><ChevronsLeft size={16} /></button>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem', borderRadius: '6px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(c => Math.max(1, c - 1))} title="前のページへ"><ChevronLeft size={16} /></button>
                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-main)', minWidth: '4rem', textAlign: 'center', fontWeight: 600 }}>
                            {currentPage} / {totalPages || 1}
                        </span>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem', borderRadius: '6px' }} disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))} title="次のページへ"><ChevronRight size={16} /></button>
                        <button className="btn btn-ghost" style={{ padding: '0.3rem', borderRadius: '6px' }} disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(totalPages)} title="最後のページへ"><ChevronsRight size={16} /></button>
                    </div>
                    <div style={{ position: 'absolute', right: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <select className="input" style={{ padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: 'var(--font-size-sub)' }}
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
                            <option value={10}>10件 / ページ</option>
                            <option value={50}>50件 / ページ</option>
                            <option value={100}>100件 / ページ</option>
                            <option value={200}>200件 / ページ</option>
                            <option value={300}>300件 / ページ</option>
                            <option value={500}>500件 / ページ</option>
                            <option value={750}>750件 / ページ</option>
                            <option value={1500}>1500件 / ページ</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}

function SkillCell({ skill }: { skill?: any }) {
    if (!skill || !skill.name) return <span style={{ color: 'var(--text-muted)' }}>-</span>;

    // Check if the skill is quality 5 to apply special colored styling
    const isMax = skill.skill_quality === 5;
    const maxColor = '#E3B7FF';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '160px' }}>
            <div style={{ fontSize: 'var(--font-size-sub)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={skill.name}>
                {skill.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'calc(var(--font-size-sub) * 0.94)' }}>
                <span style={{ color: isMax ? maxColor : 'var(--text-muted)' }}>{skill.effect_value || `- Lv.${skill.level}`}</span>
                <span style={{ color: isMax ? maxColor : 'var(--accent-gold)', fontWeight: isMax ? 'bold' : 'normal' }}>★{skill.skill_quality}</span>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = { padding: '1rem', color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)', fontWeight: 600, borderBottom: '1px solid var(--panel-border)' };
const tdStyle: React.CSSProperties = { padding: '1rem', fontSize: 'var(--font-size-main)', verticalAlign: 'top' };
