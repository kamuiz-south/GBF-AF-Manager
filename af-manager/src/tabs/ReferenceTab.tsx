import { useState, useMemo } from 'react';
import { Library, FileText, ChevronDown, Boxes, ArrowUpDown } from 'lucide-react';
import { useTranslation } from '../i18n';
import { G1_SKILLS, G2_SKILLS, G3_SKILLS } from '../data/skillMaster';
import { SKILL_EFFECT_DATA } from '../data/skillEffectData';
import { translateSkill } from '../utils/skillMapping';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ATTRIBUTE_IDS, KIND_IDS, getKindNamesShort } from '../data/constants';
import WeaponIcon from '../components/WeaponIcon';

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: 'var(--font-size-main)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--panel-border)' }}>
            {icon} {title}
        </h3>
        {children}
    </div>
);

const DotCheckbox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <label className="dot-checkbox-container">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="dot-checkbox"></span>
        <span>{label}</span>
    </label>
);

type FilterKey = 'all' | 'fav' | 'trash' | 'keep' | 'discard';

export default function ReferenceTab() {
    const { t, language } = useTranslation();
    const [selectedSkillId, setSelectedSkillId] = useState<number>(G1_SKILLS[0].baseId);
    
    // State persistence
    const [filters, setFilters] = useState<Set<FilterKey>>(() => {
        const saved = localStorage.getItem('af-ref-filters');
        return saved ? new Set(JSON.parse(saved)) : new Set(['all']);
    });
    const [isTransposed, setIsTransposed] = useState(() => {
        return localStorage.getItem('af-ref-transposed') === 'true';
    });

    const effectData = SKILL_EFFECT_DATA[selectedSkillId];
    const allArtifacts = useLiveQuery(() => db.artifacts.toArray()) || [];
    const globalSettings = useLiveQuery(() => db.settings.get('global'));

    const handleFilterChange = (key: FilterKey) => {
        setFilters(prev => {
            const next = new Set(prev);
            if (key === 'all') {
                next.clear();
                next.add('all');
            } else {
                if (next.has(key)) {
                    next.delete(key);
                    if (next.size === 0) next.add('all');
                } else {
                    next.add(key);
                    next.delete('all');
                    // Exclusive logic: Favorite and Trash
                    if (key === 'fav') next.delete('trash');
                    if (key === 'trash') next.delete('fav');
                }
            }
            // Save to storage
            localStorage.setItem('af-ref-filters', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const toggleTranspose = () => {
        const next = !isTransposed;
        setIsTransposed(next);
        localStorage.setItem('af-ref-transposed', String(next));
    };

    const filteredArtifacts = useMemo(() => {
        if (filters.has('all')) return allArtifacts;
        return allArtifacts.filter(af => {
            let match = true;
            if (filters.has('fav') && !af.is_locked) match = false;
            if (filters.has('trash') && !af.is_unnecessary) match = false;
            if (filters.has('keep') && !af.keepFlag) match = false;
            if (filters.has('discard') && !af.discardFlag) match = false;
            return match;
        });
    }, [allArtifacts, filters]);

    const counts = useMemo(() => {
        const grid: Record<string, number> = {};
        filteredArtifacts.forEach(af => {
            const key = `${af.attribute}_${af.kind}`;
            grid[key] = (grid[key] || 0) + 1;
        });
        return grid;
    }, [filteredArtifacts]);

    const attributeLabels = ATTRIBUTE_IDS.map(id => ({ id, label: t(`ATTR_${id}` as any) }));
    const kindLabels = KIND_IDS.map(id => ({ id, label: getKindNamesShort(language)[id] }));


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '820px', margin: '0 auto', paddingBottom: '3rem' }}>
            <header>
                <h2 style={{ fontSize: 'calc(var(--font-size-main) * 1.8)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                    <Library /> {language === 'en' ? 'Data' : 'データ'}
                </h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                    {language === 'en' ? 'Reference data for AF mechanisms and game specifications.' : 'アーティファクトの仕様やデータに関する参考資料を確認できます。'}
                </p>
            </header>

            {/* Skill Effect Values Section */}
            <Section title={language === 'en' ? 'Skill Effect Values' : 'スキル効果量表'} icon={<FileText size={18} />}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '650px' }}>
                        <select
                            className="input"
                            value={selectedSkillId}
                            onChange={(e) => setSelectedSkillId(Number(e.target.value))}
                            style={{ appearance: 'none', paddingRight: '2rem' }}
                        >
                            <optgroup label={language === 'en' ? 'Group 1 (S1/S2)' : 'グループ 1 (スキル1/2)'}>
                                {G1_SKILLS.map(s => (
                                    <option key={s.baseId} value={s.baseId}>
                                        {language === 'en' ? translateSkill(s.name, language) : s.name}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label={language === 'en' ? 'Group 2 (S3)' : 'グループ 2 (スキル3)'}>
                                {G2_SKILLS.map(s => (
                                    <option key={s.baseId} value={s.baseId}>
                                        {language === 'en' ? translateSkill(s.name, language) : s.name}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label={language === 'en' ? 'Group 3 (S4)' : 'グループ 3 (スキル4)'}>
                                {G3_SKILLS.map(s => (
                                    <option key={s.baseId} value={s.baseId}>
                                        {language === 'en' ? translateSkill(s.name, language) : s.name}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', textAlign: 'center', fontSize: 'var(--font-size-main)' }}>
                        <thead>
                            <tr>
                                <th style={{ background: 'var(--dim-bg)', border: '1px solid var(--panel-border)', padding: '0.8rem', color: 'var(--text-muted)' }}>☆ \ Lv</th>
                                {[1, 2, 3, 4, 5].map(lv => (
                                    <th key={lv} style={{ background: 'var(--dim-bg)', border: '1px solid var(--panel-border)', padding: '0.8rem', color: 'var(--text-muted)' }}>
                                        Lv{lv}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3, 4, 5].map((star, rIdx) => {
                                const isSupportedStar = effectData && effectData.baseValues[rIdx] !== null;
                                return (
                                    <tr key={star} style={{ background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                        <td style={{ border: '1px solid var(--panel-border)', padding: '0.8rem', fontWeight: 600, color: 'var(--text-main)', background: 'var(--dim-bg)' }}>
                                            ☆{star}
                                        </td>
                                        {[1, 2, 3, 4, 5].map((lv, cIdx) => {
                                            if (!effectData || !isSupportedStar) {
                                                return <td key={lv} style={{ border: '1px solid var(--panel-border)', padding: '0.8rem', color: 'rgba(255,255,255,0.2)' }}>-</td>;
                                            }
                                            
                                            const baseValue = effectData.baseValues[rIdx] as number;
                                            const bonus = effectData.lvBonus ?? 0;
                                            const calculatedVal = baseValue + (bonus * cIdx);
                                            const formattedVal = parseFloat(calculatedVal.toFixed(2));

                                            return (
                                                <td key={lv} style={{ border: '1px solid var(--panel-border)', padding: '0.8rem', color: 'var(--text-main)' }}>
                                                    {formattedVal}{effectData.suffix}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Section>

            {/* Owned Artifact Counts Section */}
            <Section title={language === 'en' ? 'Owned Artifact Counts' : '所持アーティファクト個数'} icon={<Boxes size={18} />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '0.6rem', background: 'rgba(255,255,255,0.03)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                    <DotCheckbox label={language === 'en' ? 'All' : 'すべて'} checked={filters.has('all')} onChange={() => handleFilterChange('all')} />
                    <DotCheckbox label={language === 'en' ? 'Favorite' : 'お気に入り'} checked={filters.has('fav')} onChange={() => handleFilterChange('fav')} />
                    <DotCheckbox label={language === 'en' ? 'Trash' : '不用品'} checked={filters.has('trash')} onChange={() => handleFilterChange('trash')} />
                    <DotCheckbox label={language === 'en' ? 'Keep Sug.' : '確保提案'} checked={filters.has('keep')} onChange={() => handleFilterChange('keep')} />
                    <DotCheckbox label={language === 'en' ? 'Discard Sug.' : '廃棄提案'} checked={filters.has('discard')} onChange={() => handleFilterChange('discard')} />
                </div>
                <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)', color: 'var(--text-muted)', marginBottom: '0.8rem', paddingLeft: '0.5rem' }}>
                    {language === 'en' ? '※ Multiple selections are applied with AND. "All" clears others.' : '※ 複数選択時はAND条件で抽出（「すべて」選択時は他が解除されます）'}
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'center', fontSize: 'var(--font-size-sub)', minWidth: '600px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '100px', padding: '0.6rem', border: '1px solid var(--panel-border)', background: 'var(--dim-bg)', color: 'var(--text-muted)' }}>
                                    {isTransposed 
                                        ? (language === 'en' ? 'Wpn \\ Attr' : '武器種 \\ 属性') 
                                        : (language === 'en' ? 'Attr \\ Wpn' : '属性 \\ 武器種')}
                                </th>
                                {(isTransposed ? attributeLabels : kindLabels).map(labelObj => (
                                    <th key={labelObj.id} style={{ 
                                        padding: '0.6rem', border: '1px solid var(--panel-border)', background: 'var(--dim-bg)', color: 'var(--text-main)',
                                        minWidth: '40px'
                                    }}>
                                        {globalSettings?.design?.useWeaponIconsInTables && !isTransposed ? (
                                            <WeaponIcon kind={labelObj.id} size="1.5em" style={{ verticalAlign: 'middle', color: 'var(--text-main)' }} />
                                        ) : (
                                            labelObj.label
                                        )}
                                    </th>
                                ))}
                                <th style={{ width: '60px', padding: '0.6rem', border: '1px solid var(--panel-border)', background: 'var(--dim-bg)', color: 'var(--accent-gold)', fontWeight: 600 }}>
                                    {language === 'en' ? 'Total' : '合計'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {(isTransposed ? kindLabels : attributeLabels).map((rowObj, rIdx) => {
                                let rowSum = 0;
                                return (
                                    <tr key={rowObj.id} style={{ background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                        <td style={{ border: '1px solid var(--panel-border)', padding: '0.6rem', fontWeight: 600, color: 'var(--text-main)', background: 'var(--dim-bg)' }}>
                                            {globalSettings?.design?.useWeaponIconsInTables && isTransposed ? (
                                                <WeaponIcon kind={rowObj.id} size="1.5em" style={{ verticalAlign: 'middle', color: 'var(--text-main)' }} />
                                            ) : (
                                                rowObj.label
                                            )}
                                        </td>
                                        {(isTransposed ? attributeLabels : kindLabels).map(colObj => {
                                            const attrId = isTransposed ? colObj.id : rowObj.id;
                                            const kindId = isTransposed ? rowObj.id : colObj.id;
                                            const count = counts[`${attrId}_${kindId}`] || 0;
                                            rowSum += count;

                                            return (
                                                <td key={colObj.id} style={{ 
                                                    border: '1px solid var(--panel-border)', padding: '0.6rem', 
                                                    color: count > 0 ? 'var(--text-main)' : 'var(--text-muted)',
                                                    fontWeight: count > 0 ? 600 : 400,
                                                    opacity: count > 0 ? 1 : 0.4
                                                }}>
                                                    {count}
                                                </td>
                                            );
                                        })}
                                        <td style={{ border: '1px solid var(--panel-border)', padding: '0.6rem', fontWeight: 700, color: 'var(--accent-gold)', background: 'rgba(212,175,55,0.05)' }}>
                                            {rowSum}
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Bottom Total Row */}
                            <tr style={{ background: 'var(--dim-bg)' }}>
                                <td style={{ border: '1px solid var(--panel-border)', padding: '0.6rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                                    {language === 'en' ? 'Total' : '合計'}
                                </td>
                                {(isTransposed ? attributeLabels : kindLabels).map(colObj => {
                                    const colSum = (isTransposed ? kindLabels : attributeLabels).reduce((sum, rowObj) => {
                                        const attrId = isTransposed ? colObj.id : rowObj.id;
                                        const kindId = isTransposed ? rowObj.id : colObj.id;
                                        return sum + (counts[`${attrId}_${kindId}`] || 0);
                                    }, 0);
                                    return (
                                        <td key={`total-${colObj.id}`} style={{ border: '1px solid var(--panel-border)', padding: '0.6rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                                            {colSum}
                                        </td>
                                    );
                                })}
                                <td style={{ border: '1px solid var(--panel-border)', padding: '0.6rem', fontWeight: 800, color: 'var(--accent-gold)', background: 'rgba(212,175,55,0.15)' }}>
                                    {filteredArtifacts.length}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.8rem' }}>
                    <button className="btn btn-ghost" onClick={toggleTranspose} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--panel-border)', fontSize: 'var(--font-size-sub)' }}>
                        <ArrowUpDown size={14} /> {language === 'en' ? 'Swap Axes' : '縦軸と横軸を入れ替える'}
                    </button>
                </div>
            </Section>
        </div>
    );
}
