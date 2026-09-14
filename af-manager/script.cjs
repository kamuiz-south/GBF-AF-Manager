const fs = require('fs');
let content = fs.readFileSync('src/tabs/ReferenceTab.tsx', 'utf8');

// 1. Add imports
content = content.replace(
  'import { Library, FileText, ChevronDown, Boxes, ArrowUpDown } from \'lucide-react\';',
  'import { Library, FileText, ChevronDown, Boxes, ArrowUpDown, History, ChevronRight, Calendar, Trash2 } from \'lucide-react\';'
);
content = content.replace(
  'import WeaponIcon from \'../components/WeaponIcon\';',
  'import WeaponIcon from \'../components/WeaponIcon\';\nimport type { AppArtifact } from \'../types\';\nimport { useAppStore } from \'../store/useAppStore\';'
);

// 2. Add maps
const mapsCode = `
const ATTR_MAP: Record<string, string> = { '1': '火', '2': '水', '3': '土', '4': '風', '5': '光', '6': '闇' };
const ATTR_MAP_EN: Record<string, string> = { '1': 'Fire', '2': 'Water', '3': 'Earth', '4': 'Wind', '5': 'Light', '6': 'Dark' };
const KIND_MAP: Record<string, string> = { '1': '剣', '2': '短剣', '3': '槍', '4': '斧', '5': '杖', '6': '銃', '7': '格闘', '8': '弓', '9': '楽器', '10': '刀' };
const KIND_MAP_EN: Record<string, string> = { '1': 'Sabre', '2': 'Dagger', '3': 'Spear', '4': 'Axe', '5': 'Staff', '6': 'Gun', '7': 'Melee', '8': 'Bow', '9': 'Harp', '10': 'Katana' };
`;

content = content.replace('const Section =', mapsCode + '\nconst Section =');

// 3. Add state and helpers
const statesCode = `
    const showToast = useAppStore(state => state.showToast);

    // ログ表示用ステート
    const upgradeLogs = useLiveQuery(() => db.upgradeLogs.orderBy('timestamp').reverse().toArray()) || [];
    const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
    const [expandedConditions, setExpandedConditions] = useState<Record<string, boolean>>({});
    const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

    const updateLogMaxCount = async (maxCount: number) => {
        const latest = await db.settings.get('global');
        if (latest) {
            await db.settings.put({ ...latest, upgradeLogMaxCount: maxCount });
            const allLogs = await db.upgradeLogs.orderBy('timestamp').toArray();
            if (allLogs.length > maxCount) {
                const toDelete = allLogs.slice(0, allLogs.length - maxCount);
                await db.upgradeLogs.bulkDelete(toDelete.map(l => l.id!));
            }
        }
    };

    const formatDateTime = (isoString: string) => {
        try {
            const d = new Date(isoString);
            return d.toLocaleString(language === 'en' ? 'en-US' : 'ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch {
            return isoString;
        }
    };

    const renderCompactAF = (af: AppArtifact, isOld: boolean, otherList: AppArtifact[]) => {
        const isDiff = !otherList.some(o => o.id === af.id);
        const diffColor = isDiff
            ? (isOld ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)')
            : 'rgba(255, 255, 255, 0.02)';
        const diffBorder = isDiff
            ? (isOld ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)')
            : '1px solid var(--panel-border)';

        const skills = [af.skill1_info, af.skill2_info, af.skill3_info, af.skill4_info].filter(Boolean);
        const q5Outline = '0px 0px 3px var(--max-quality-outline), -1px -1px 0 var(--max-quality-outline), 1px -1px 0 var(--max-quality-outline), -1px 1px 0 var(--max-quality-outline), 1px 1px 0 var(--max-quality-outline)';

        return (
            <div key={af.id} style={{
                background: diffColor, border: diffBorder, borderRadius: '8px', padding: '0.8rem',
                marginBottom: '0.6rem', boxShadow: isDiff ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
            }}>
                <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sub)', color: 'var(--text-main)' }}>
                        {af.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>Lv{af.level}</span>
                    </span>
                    {af.evaluationScore !== undefined && (
                        <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)', color: 'var(--accent-blue-hover)', fontWeight: 600 }}>
                            {language === 'en' ? 'Score: ' : 'スコア: '}{af.evaluationScore.toFixed(1)}
                        </span>
                    )}
                </div>
                <div>
                    {skills.map((sk, idx) => {
                        if (!sk?.name) return null;
                        const glabel = idx < 2 ? '[I]' : idx === 2 ? '[II]' : '[III]';
                        const isQ5 = sk.skill_quality === 5;
                        return (
                            <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', fontSize: 'calc(var(--font-size-sub) * 0.88)', opacity: 0.95, marginBottom: '0.1rem' }}>
                                <span style={{ 
                                    color: isQ5 ? 'var(--max-quality-text)' : 'var(--accent-gold)', 
                                    minWidth: '22px', flexShrink: 0, textShadow: isQ5 ? q5Outline : 'none', fontWeight: isQ5 ? 'bold' : 'normal'
                                }}>★{sk.skill_quality}</span>
                                <span style={{ color: 'var(--text-main)', flexShrink: 0 }}>Lv{sk.level}</span>
                                <span style={{ color: 'var(--accent-success)', minWidth: '26px', flexShrink: 0 }}>{glabel}</span>
                                <span style={{ color: 'var(--text-main)', flex: 1, wordBreak: 'break-all' }}>{language === 'en' ? translateSkill(sk.name, language) : sk.name}</span>
                                <span style={{ 
                                    color: isQ5 ? 'var(--max-quality-text)' : 'var(--accent-blue-hover)', 
                                    flexShrink: 0, textShadow: isQ5 ? q5Outline : 'none'
                                }}>{sk.effect_value}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
`;
content = content.replace('const globalSettings = useLiveQuery(() => db.settings.get(\'global\'));', 'const globalSettings = useLiveQuery(() => db.settings.get(\'global\'));\n' + statesCode);

// 4. Add UI
const jsxCode = `
            {/* 確保AF更新履歴 */}
            <Section title={language === 'en' ? 'Keep AF Upgrade History' : '確保AF更新履歴'} icon={<History size={18} />}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: 'var(--font-size-sub)' }}>
                                {language === 'en' ? 'Max Logs:' : '最大保持件数:'}
                            </span>
                            <input
                                type="number" min={1} max={200}
                                value={globalSettings?.upgradeLogMaxCount ?? 20}
                                className="input"
                                style={{ width: '60px', padding: '0.2rem 0.4rem', textAlign: 'center', fontSize: 'var(--font-size-sub)' }}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    if (!val || val < 1) return;
                                }}
                                onBlur={e => {
                                    const val = parseInt(e.target.value);
                                    if (!val || val < 1) return;
                                    const current = upgradeLogs.length;
                                    if (current > val) {
                                        const willDelete = current - val;
                                        const ok = confirm(language === 'en' ? \`This will delete \${willDelete} oldest log(s) to fit the new limit. Continue?\` : \`上限を変更すると古いログ\${willDelete}件が削除されます。続行しますか？\`);
                                        if (!ok) return;
                                    }
                                    updateLogMaxCount(val);
                                }}
                            />
                        </div>
                        <button
                            className="btn btn-danger"
                            style={{ fontSize: 'var(--font-size-sub)', padding: '0.3rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: upgradeLogs.length === 0 ? 0.5 : 1 }}
                            disabled={upgradeLogs.length === 0}
                            onClick={async () => {
                                if (upgradeLogs.length === 0) return;
                                const ok = confirm(language === 'en' ? \`Delete all \${upgradeLogs.length} upgrade log(s)? This cannot be undone.\` : \`確保AF更新履歴 \${upgradeLogs.length}件をすべて削除しますか？この操作は元に戻せません。\`);
                                if (!ok) return;
                                await db.upgradeLogs.clear();
                                showToast(language === 'en' ? 'All upgrade logs deleted.' : '確保AF更新履歴をすべて削除しました。', 'success');
                            }}
                        >
                            <Trash2 size={14} />
                            {language === 'en' ? 'Clear All' : '一括削除'}
                        </button>
                    </div>
                </div>

                {upgradeLogs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: 'var(--font-size-sub)' }}>
                        {language === 'en' ? 'No update logs found.' : '更新履歴はありません。'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {upgradeLogs.map(log => {
                            const isLogExpanded = !!expandedLogs[log.id!];
                            const condGroups: Record<string, typeof log.entries> = {};
                            for (const entry of log.entries) {
                                if (!condGroups[entry.conditionId]) condGroups[entry.conditionId] = [];
                                condGroups[entry.conditionId].push(entry);
                            }
                            const sortedCondIds = Object.keys(condGroups).sort((a, b) => condGroups[a][0].priority - condGroups[b][0].priority);

                            return (
                                <div key={log.id} style={{ border: '1px solid var(--panel-border)', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.1)' }}>
                                    <div
                                        onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id!]: !prev[log.id!] }))}
                                        style={{ padding: '0.8rem 1.2rem', background: 'var(--dim-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                            {isLogExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            <Calendar size={14} style={{ color: 'var(--accent-blue-hover)' }} />
                                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-main)' }}>{formatDateTime(log.timestamp)}</span>
                                            <span style={{
                                                fontSize: 'calc(var(--font-size-sub) * 0.9)', padding: '0.1rem 0.5rem', borderRadius: '4px',
                                                background: log.triggerType === 'import' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                color: log.triggerType === 'import' ? 'var(--accent-blue-hover)' : 'var(--accent-success)',
                                                border: \`1px solid \${log.triggerType === 'import' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}\`
                                            }}>
                                                {log.triggerType === 'import' ? (language === 'en' ? 'Import' : 'データ取り込み') : (language === 'en' ? 'Manual Calc' : '手動フラグ計算')}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                                            {log.entries.length} {language === 'en' ? 'changes' : '件の変更'}
                                        </span>
                                    </div>
                                    {isLogExpanded && (
                                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(0,0,0,0.15)' }}>
                                            {sortedCondIds.map(condId => {
                                                const entriesForCond = condGroups[condId];
                                                const condName = entriesForCond[0].conditionName;
                                                const priority = entriesForCond[0].priority;
                                                const condKey = \`\${log.id}__\${condId}\`;
                                                const isCondExpanded = !!expandedConditions[condKey];
                                                return (
                                                    <div key={condId} style={{ border: '1px solid var(--dim-border)', borderRadius: '6px', overflow: 'hidden' }}>
                                                        <div
                                                            onClick={() => setExpandedConditions(prev => ({ ...prev, [condKey]: !prev[condKey] }))}
                                                            style={{ padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                                {isCondExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)' }}>P.{priority}</span>
                                                                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sub)', color: 'var(--text-main)' }}>{condName}</span>
                                                            </div>
                                                            <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)', color: 'var(--text-muted)' }}>
                                                                {entriesForCond.length} {language === 'en' ? 'subgroups' : '箇所の変更'}
                                                            </span>
                                                        </div>
                                                        {isCondExpanded && (
                                                            <div style={{ padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(0,0,0,0.1)' }}>
                                                                {entriesForCond.map(entry => {
                                                                    const entryKey = \`\${log.id}__\${condId}__\${entry.attribute}__\${entry.weaponKind}\`;
                                                                    const isEntryExpanded = !!expandedEntries[entryKey];
                                                                    const attrName = language === 'en' ? (ATTR_MAP_EN[entry.attribute] || entry.attribute) : (ATTR_MAP[entry.attribute] || entry.attribute);
                                                                    const kindName = language === 'en' ? (KIND_MAP_EN[entry.weaponKind] || entry.weaponKind) : (KIND_MAP[entry.weaponKind] || entry.weaponKind);
                                                                    return (
                                                                        <div key={entryKey} style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                                                            <div
                                                                                onClick={() => setExpandedEntries(prev => ({ ...prev, [entryKey]: !prev[entryKey] }))}
                                                                                style={{ padding: '0.5rem 0.8rem', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', userSelect: 'none' }}
                                                                            >
                                                                                {isEntryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                                <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', fontWeight: 600, color: 'var(--text-main)' }}>
                                                                                    {attrName} / {kindName}
                                                                                </span>
                                                                            </div>
                                                                            {isEntryExpanded && (
                                                                                <div style={{ padding: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.15)' }}>
                                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                        <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)', fontWeight: 600, color: 'var(--accent-danger)', marginBottom: '0.5rem', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.2rem' }}>
                                                                                            {language === 'en' ? 'Before (Replaced)' : '更新前 (変更・消失)'}
                                                                                        </div>
                                                                                        {entry.oldArtifacts.length === 0 ? (
                                                                                            <div style={{ color: 'var(--text-muted)', fontSize: 'calc(var(--font-size-sub) * 0.9)', textAlign: 'center', padding: '1rem' }}>(None)</div>
                                                                                        ) : (
                                                                                            entry.oldArtifacts.map(af => renderCompactAF(af, true, entry.newArtifacts))
                                                                                        )}
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                        <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)', fontWeight: 600, color: 'var(--accent-success)', marginBottom: '0.5rem', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '0.2rem' }}>
                                                                                            {language === 'en' ? 'After (Current)' : '更新後 (確保)'}
                                                                                        </div>
                                                                                        {entry.newArtifacts.length === 0 ? (
                                                                                            <div style={{ color: 'var(--text-muted)', fontSize: 'calc(var(--font-size-sub) * 0.9)', textAlign: 'center', padding: '1rem' }}>(None)</div>
                                                                                        ) : (
                                                                                            entry.newArtifacts.map(af => renderCompactAF(af, false, entry.oldArtifacts))
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>
`;

content = content.replace('        </div>\n    );\n}', jsxCode + '\n        </div>\n    );\n}');

fs.writeFileSync('src/tabs/ReferenceTab.tsx', content);
