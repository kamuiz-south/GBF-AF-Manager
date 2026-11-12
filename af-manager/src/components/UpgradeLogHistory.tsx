import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useTranslation } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { Trash2, History, ChevronRight, ChevronDown, Calendar } from 'lucide-react';
import type { AppArtifact, Condition, UpgradeLogEntry } from '../types';
import { translateSkill } from '../utils/skillMapping';
import { DEFAULT_SETTINGS, DEFAULT_UPGRADE_LOG_MAX_COUNT } from '../data/defaultSettings';
import CollapsibleSection from './CollapsibleSection';

const ATTR_MAP: Record<string, string> = { '1': '火', '2': '水', '3': '土', '4': '風', '5': '光', '6': '闇' };
const ATTR_MAP_EN: Record<string, string> = { '1': 'Fire', '2': 'Water', '3': 'Earth', '4': 'Wind', '5': 'Light', '6': 'Dark' };
const KIND_MAP: Record<string, string> = { '1': '剣', '2': '短剣', '3': '槍', '4': '斧', '5': '杖', '6': '銃', '7': '格闘', '8': '弓', '9': '楽器', '10': '刀' };
const KIND_MAP_EN: Record<string, string> = { '1': 'Sabre', '2': 'Dagger', '3': 'Spear', '4': 'Axe', '5': 'Staff', '6': 'Gun', '7': 'Melee', '8': 'Bow', '9': 'Harp', '10': 'Katana' };

// 更新前後で共通のAFは差分ではないため、既定では両側から除外する。
// 設定で「更新項目の確保AFをすべて表示」がONの場合は除外しない。
function getChangedArtifacts(entry: UpgradeLogEntry) {
    const oldIds = new Set(entry.oldArtifacts.map(af => af.id));
    const newIds = new Set(entry.newArtifacts.map(af => af.id));
    return {
        oldArtifacts: entry.oldArtifacts.filter(af => !newIds.has(af.id)),
        newArtifacts: entry.newArtifacts.filter(af => !oldIds.has(af.id)),
        commonIds: new Set([...oldIds].filter(id => newIds.has(id))),
    };
}

type DisplayUpgradeLogEntry = UpgradeLogEntry & {
    keptCount: number;
    resolvedTargetCount?: number;
    commonIds: Set<number>;
};

const EMPTY_IDS = new Set<number>();

function resolveTargetCount(entry: UpgradeLogEntry, condition?: Condition): number | undefined {
    if (entry.targetCount !== undefined) return entry.targetCount;
    if (!condition) return undefined;

    const isMethod2 =
        entry.methodType === 2 ||
        (entry.methodType === undefined &&
            (entry.characterName !== undefined || condition.methodType === 2));

    return isMethod2
        ? condition.targetCountMethod2
        : condition.targetCount?.[`${entry.attribute}_${entry.weaponKind}`];
}

export default function UpgradeLogHistory() {
    const { language } = useTranslation();
    const globalSettings = useLiveQuery(() => db.settings.get('global'));
    const showToast = useAppStore(state => state.showToast);

    // ログ表示用ステート
    const upgradeLogsResult = useLiveQuery(() => db.upgradeLogs.orderBy('timestamp').reverse().toArray());
    const upgradeLogs = useMemo(() => upgradeLogsResult ?? [], [upgradeLogsResult]);
    const conditionsResult = useLiveQuery(() => db.conditions.toArray());
    const conditions = useMemo(() => conditionsResult ?? [], [conditionsResult]);
    const conditionMap = useMemo(
        () => new Map(conditions.map(condition => [condition.id, condition])),
        [conditions]
    );
    const showAllArtifacts = globalSettings?.upgradeLogShowAllArtifacts ?? false;

    // ログ更新時だけ差分を計算する（折りたたみ操作などの再レンダーでは再計算しない）
    const displayLogs = useMemo(
        () => upgradeLogs.map(log => ({
            ...log,
            entries: log.entries.map(entry => {
                const changed = getChangedArtifacts(entry);
                return {
                    ...entry,
                    oldArtifacts: showAllArtifacts ? entry.oldArtifacts : changed.oldArtifacts,
                    newArtifacts: showAllArtifacts ? entry.newArtifacts : changed.newArtifacts,
                    keptCount: entry.newKeptCount ?? entry.newArtifacts.length,
                    resolvedTargetCount: resolveTargetCount(entry, conditionMap.get(entry.conditionId)),
                    commonIds: showAllArtifacts ? changed.commonIds : EMPTY_IDS,
                } as DisplayUpgradeLogEntry;
            }),
        })),
        [upgradeLogs, showAllArtifacts, conditionMap]
    );
    const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
    const [expandedConditions, setExpandedConditions] = useState<Record<string, boolean>>({});
    const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});
    const [tempMaxCount, setTempMaxCount] = useState<string | null>(null);

    const updateLogMaxCount = async (maxCount: number) => {
        const latest = await db.settings.get('global');
        await db.settings.put({ ...(latest ?? DEFAULT_SETTINGS), upgradeLogMaxCount: maxCount });
        const allLogs = await db.upgradeLogs.orderBy('timestamp').toArray();
        if (allLogs.length > maxCount) {
            const toDelete = allLogs.slice(0, allLogs.length - maxCount);
            await db.upgradeLogs.bulkDelete(toDelete.map(l => l.id!));
        }
    };

    const updateShowAllArtifacts = async (showAll: boolean) => {
        const latest = await db.settings.get('global');
        await db.settings.put({ ...(latest ?? DEFAULT_SETTINGS), upgradeLogShowAllArtifacts: showAll });
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

    const renderCompactAF = (af: AppArtifact, isOld: boolean, isMethod2: boolean, isCommon: boolean = false) => {
        // 共通AFを全表示する場合は、更新前後のどちらにも存在するため中立色にする。
        const diffClass = isCommon ? 'diff-none' : (isOld ? 'diff-old' : 'diff-new');

        const skills = [af.skill1_info, af.skill2_info, af.skill3_info, af.skill4_info].filter(Boolean);
        const q5Outline = '0px 0px 3px var(--max-quality-outline), -1px -1px 0 var(--max-quality-outline), 1px -1px 0 var(--max-quality-outline), -1px 1px 0 var(--max-quality-outline), 1px 1px 0 var(--max-quality-outline)';

        return (
            <div key={af.id} className={`upgrade-log-af-card ${diffClass}`}>
                <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sub)', color: 'var(--text-main)' }}>
                        {af.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 'calc(var(--font-size-sub) * 0.9)' }}>Lv{af.level}</span>
                        {isMethod2 && (
                            <span style={{ fontWeight: 400, marginLeft: '0.4rem' }}>
                                ({language === 'en' ? KIND_MAP_EN[af.kind] || af.kind : KIND_MAP[af.kind] || af.kind})
                            </span>
                        )}
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

    return (
        <>
        <CollapsibleSection id="upgrade-log-history" title={language === 'en' ? 'Keep AF Upgrade History' : '確保AF更新履歴'} icon={<History size={18} />}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '1.5rem', rowGap: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: 'var(--font-size-sub)' }}>
                            {language === 'en' ? 'Show all kept AFs in changes:' : '更新項目の確保AFをすべて表示:'}
                        </span>
                        <div className="settings-toggle-group">
                            <button
                                className={`btn ${showAllArtifacts ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ padding: '0.2rem 0.7rem', minWidth: '52px', borderRadius: '6px', fontSize: 'var(--font-size-sub)', ...(showAllArtifacts ? {} : { color: 'var(--text-muted)' }) }}
                                onClick={() => updateShowAllArtifacts(true)}
                            >ON</button>
                            <button
                                className={`btn ${!showAllArtifacts ? 'settings-toggle-btn-off-active' : 'btn-ghost'}`}
                                style={{ padding: '0.2rem 0.7rem', minWidth: '52px', borderRadius: '6px', fontSize: 'var(--font-size-sub)', ...(!showAllArtifacts ? {} : { color: 'var(--text-muted)' }) }}
                                onClick={() => updateShowAllArtifacts(false)}
                            >OFF</button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: 'var(--font-size-sub)' }}>
                            {language === 'en' ? 'Max Logs:' : '最大保持件数:'}
                        </span>
                        <input
                            type="number" min={1} max={200}
                            value={tempMaxCount !== null ? tempMaxCount : (globalSettings?.upgradeLogMaxCount ?? DEFAULT_UPGRADE_LOG_MAX_COUNT)}
                            className="input"
                            style={{ width: '60px', padding: '0.2rem 0.4rem', textAlign: 'center', fontSize: 'var(--font-size-sub)' }}
                            onChange={e => {
                                setTempMaxCount(e.target.value);
                            }}
                            onBlur={e => {
                                const val = parseInt(e.target.value);
                                if (!val || val < 1) {
                                    setTempMaxCount(globalSettings?.upgradeLogMaxCount?.toString() ?? String(DEFAULT_UPGRADE_LOG_MAX_COUNT));
                                    return;
                                }
                                const current = upgradeLogs.length;
                                if (current > val) {
                                    const willDelete = current - val;
                                    const ok = confirm(language === 'en' ? `This will delete ${willDelete} oldest log(s) to fit the new limit. Continue?` : `上限を変更すると古いログ${willDelete}件が削除されます。続行しますか？`);
                                    if (!ok) {
                                        setTempMaxCount(globalSettings?.upgradeLogMaxCount?.toString() ?? String(DEFAULT_UPGRADE_LOG_MAX_COUNT));
                                        return;
                                    }
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
                            const ok = confirm(language === 'en' ? `Delete all ${upgradeLogs.length} upgrade log(s)? This cannot be undone.` : `確保AF更新履歴 ${upgradeLogs.length}件をすべて削除しますか？この操作は元に戻せません。`);
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
                    {displayLogs.map(log => {
                        const isLogExpanded = !!expandedLogs[log.id!];
                        const condGroups: Record<string, typeof log.entries> = {};
                        for (const entry of log.entries) {
                            if (!condGroups[entry.conditionId]) condGroups[entry.conditionId] = [];
                            condGroups[entry.conditionId].push(entry);
                        }
                        const sortedCondIds = Object.keys(condGroups).sort((a, b) => condGroups[a][0].priority - condGroups[b][0].priority);

                        return (
                            <div key={log.id} className="upgrade-log-card">
                                <div
                                    className="upgrade-log-card-header"
                                    onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id!]: !prev[log.id!] }))}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        {isLogExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        <Calendar size={14} style={{ color: 'var(--accent-blue-hover)' }} />
                                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-main)' }}>{formatDateTime(log.timestamp)}</span>
                                        <span style={{
                                            fontSize: 'calc(var(--font-size-sub) * 0.9)', padding: '0.1rem 0.5rem', borderRadius: '4px',
                                            background: log.triggerType === 'import' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                            color: log.triggerType === 'import' ? 'var(--accent-blue-hover)' : 'var(--accent-success)',
                                            border: `1px solid ${log.triggerType === 'import' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                                        }}>
                                            {log.triggerType === 'import' ? (language === 'en' ? 'Import (AF Update)' : '所持AFデータ更新') : (language === 'en' ? 'Manual Calc (Cond Update)' : '確保条件更新')}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                                        {log.entries.length} {language === 'en' ? 'changes' : '件の変更'}
                                    </span>
                                </div>
                                {isLogExpanded && (
                                    <div className="upgrade-log-card-body">
                                        {sortedCondIds.map(condId => {
                                            const entriesForCond = condGroups[condId];
                                            const condName = entriesForCond[0].conditionName;
                                            const priority = entriesForCond[0].priority;
                                            const condKey = `${log.id}__${condId}`;
                                            const isCondExpanded = !!expandedConditions[condKey];
                                            return (
                                                <div key={condId} className="upgrade-log-cond-card">
                                                    <div
                                                        className="upgrade-log-cond-header"
                                                        onClick={() => setExpandedConditions(prev => ({ ...prev, [condKey]: !prev[condKey] }))}
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
                                                        <div className="upgrade-log-cond-body">
                                                            {entriesForCond.map(entry => {
                                                                const isMethod2 = entry.methodType === 2 && entry.characterName !== undefined;
                                                                const entryKey = isMethod2
                                                                    ? `${log.id}__${condId}__char__${entry.characterName}`
                                                                    : `${log.id}__${condId}__${entry.attribute}__${entry.weaponKind}`;
                                                                const isEntryExpanded = expandedEntries[entryKey] !== false;

                                                                // ヘッダーラベル
                                                                const entryLabel = isMethod2
                                                                    ? (entry.characterName || (language === 'en' ? 'Unknown Character' : '不明キャラ'))
                                                                    : (() => {
                                                                        const attrName = language === 'en' ? (ATTR_MAP_EN[entry.attribute] || entry.attribute) : (ATTR_MAP[entry.attribute] || entry.attribute);
                                                                        const kindName = language === 'en' ? (KIND_MAP_EN[entry.weaponKind] || entry.weaponKind) : (KIND_MAP[entry.weaponKind] || entry.weaponKind);
                                                                        return `${attrName} / ${kindName}`;
                                                                    })();
                                                                return (
                                                                    <div key={entryKey} className="upgrade-log-entry-card">
                                                                        <div
                                                                            className="upgrade-log-entry-header"
                                                                            onClick={() => setExpandedEntries(prev => ({ ...prev, [entryKey]: !prev[entryKey] }))}
                                                                        >
                                                                            {isEntryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                            <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', fontWeight: 600, color: 'var(--text-main)' }}>
                                                                                {entryLabel}
                                                                                <span style={{ marginLeft: '0.5rem', fontSize: 'calc(var(--font-size-sub) * 0.88)', fontWeight: 400, color: 'var(--text-muted)' }}>
                                                                                    {language === 'en'
                                                                                        ? `(Kept: ${entry.keptCount}/${entry.resolvedTargetCount ?? '?'})`
                                                                                        : `（確保数：${entry.keptCount}/${entry.resolvedTargetCount ?? '?'}）`}
                                                                                </span>
                                                                            </span>
                                                                        </div>
                                                                        {isEntryExpanded && (
                                                                            <div className="upgrade-log-entry-body">
                                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)', fontWeight: 600, color: 'var(--accent-danger)', marginBottom: '0.5rem', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.2rem' }}>
                                                                                        {language === 'en' ? 'Before (Replaced)' : '更新前 (変更・消失)'}
                                                                                    </div>
                                                                                    {entry.oldArtifacts.length === 0 ? (
                                                                                        <div className="upgrade-log-empty-slot">(None)</div>
                                                                                    ) : (
                                                                                        entry.oldArtifacts.map(af => renderCompactAF(af, true, isMethod2, entry.commonIds.has(af.id)))
                                                                                    )}
                                                                                </div>
                                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.9)', fontWeight: 600, color: 'var(--accent-success)', marginBottom: '0.5rem', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '0.2rem' }}>
                                                                                        {language === 'en' ? 'After (Current)' : '更新後 (確保)'}
                                                                                    </div>
                                                                                    {entry.newArtifacts.length === 0 ? (
                                                                                        <div className="upgrade-log-empty-slot">(None)</div>
                                                                                    ) : (
                                                                                        entry.newArtifacts.map(af => renderCompactAF(af, false, isMethod2, entry.commonIds.has(af.id)))
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
        </CollapsibleSection>
        <div style={{ height: '750px' }} />
        </>
    );
}
