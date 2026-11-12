import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Heart, Package, Star, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Settings as SettingsIcon } from 'lucide-react';
import { db } from '../db';
import { MAX_AF_INVENTORY } from '../constants';
import { DEFAULT_DESIGN, type AppArtifact } from '../types';
import { useTranslation, type TranslationKey } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { getCleanName } from '../utils/evaluator';
import { G1_SKILLS, G2_SKILLS, G3_SKILLS, SKILL_MASTER_BY_BASE_ID } from '../data/skillMaster';
import { translateSkill } from '../utils/skillMapping';
import { useSkillFilter } from '../hooks/useSkillFilter';
import { SkillFilterPopup } from '../components/SkillFilterPopup';
import { DEFAULT_PAGE_LIMIT } from '../data/defaultSettings';

type SortField = keyof AppArtifact | 'inventoryOrder' | 'attr_kind' | 'memoText';

const FALLBACK_COLUMN_WIDTHS = { id: 72, name: 180 };
const EMPTY_ARTIFACTS: AppArtifact[] = [];
const GAME_UI_COLUMNS = 5;
const GAME_UI_ROWS = 4;
const GAME_UI_ITEMS_PER_PAGE = GAME_UI_COLUMNS * GAME_UI_ROWS;

const ROW_LABELS_JA = ['最上段', '上から2', '下から2', '最下段'];
const ROW_LABELS_EN = ['top row', 'upper-middle row', 'lower-middle row', 'bottom row'];
const COLUMN_LABELS_JA = ['左から1', '左から2', '中央', '右から2', '右から1'];
const COLUMN_LABELS_EN = ['1st from left', '2nd from left', 'center', '2nd from right', '1st from right'];

type InventoryPosition = {
    page: number;
    row: number;
    column: number;
};

/**
 * Resolve where an artifact appears in the in-game artifact list.
 * AF Collector metadata is used when available; manually imported data
 * falls back to the in-game 5 x 4 layout.
 */
function getInventoryPosition(artifact: AppArtifact): InventoryPosition | null {
    let page: number | undefined = artifact._page;
    let pos: number | undefined = artifact._pos;

    if (
        typeof page !== 'number' || !Number.isFinite(page) ||
        typeof pos !== 'number' || !Number.isFinite(pos)
    ) {
        const order = artifact.inventoryOrder;
        if (typeof order !== 'number' || !Number.isFinite(order) || order < 0) return null;

        page = Math.floor(order / GAME_UI_ITEMS_PER_PAGE) + 1;
        pos = order % GAME_UI_ITEMS_PER_PAGE;
    }

    if (
        typeof page !== 'number' || !Number.isFinite(page) ||
        typeof pos !== 'number' || !Number.isFinite(pos) ||
        page < 1 || pos < 0 || pos >= GAME_UI_ITEMS_PER_PAGE
    ) {
        return null;
    }

    return {
        page,
        row: Math.floor(pos / GAME_UI_COLUMNS) + 1,
        column: (pos % GAME_UI_COLUMNS) + 1,
    };
}

function getRowLabel(row: number, language: 'ja' | 'en') {
    return language === 'en'
        ? (ROW_LABELS_EN[row - 1] ?? `row ${row} from top`)
        : (ROW_LABELS_JA[row - 1] ?? `上から${row}`);
}

function getColumnLabel(column: number, language: 'ja' | 'en') {
    return language === 'en'
        ? (COLUMN_LABELS_EN[column - 1] ?? `column ${column} from left`)
        : (COLUMN_LABELS_JA[column - 1] ?? `左から${column}`);
}

/** Convert ASCII digits to full-width digits for the Japanese tooltip. */
function toFullWidthDigits(value: string) {
    return value.replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0xFEE0));
}

function formatInventoryPosition(position: InventoryPosition, language: 'ja' | 'en') {
    const row = getRowLabel(position.row, language);
    const column = getColumnLabel(position.column, language);

    if (language === 'en') {
        return `Page ${position.page}, ${row}, ${column}`;
    }

    return toFullWidthDigits(`${position.page}P\u3000${row}\u3000${column}`);
}

function getArtifactNameTitle(artifact: AppArtifact, language: 'ja' | 'en') {
    const position = getInventoryPosition(artifact);
    if (!position) return artifact.name;

    const detail = formatInventoryPosition(position, language);
    return language === 'en'
        ? `${artifact.name}\nIn-game: ${detail}`
        : `${artifact.name}\nゲーム内表示：${detail}`;
}

/**
 * Measure ID/Name column widths from the full owned-AF list.
 * This runs only when the AF list or the relevant font settings change,
 * not on pagination, filtering, or sorting.
 */
function measureFixedColumnWidths(
    artifacts: AppArtifact[],
    language: 'ja' | 'en',
    fontSizeMain: number,
    fontSizeSub: number,
    fontFamilyMain: string,
    fontFamilySub: string,
) {
    if (typeof document === 'undefined') return FALLBACK_COLUMN_WIDTHS;

    const context = document.createElement('canvas').getContext('2d');
    if (!context) return FALLBACK_COLUMN_WIDTHS;

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const cellPadding = rootFontSize * 2;
    const idHeaderExtra = rootFontSize * 0.3 + 14; // sort icon + gap
    const buffer = 4;

    // ID header (bold sub font) and ID values (normal sub font)
    context.font = `600 ${fontSizeSub}px ${fontFamilySub}`;
    let idWidth = context.measureText('ID').width + idHeaderExtra;

    context.font = `${fontSizeSub}px ${fontFamilySub}`;
    for (const artifact of artifacts) {
        idWidth = Math.max(idWidth, context.measureText(String(artifact.id)).width);
    }

    // Name values (bold main font) and name header (bold sub font)
    context.font = `600 ${fontSizeMain}px ${fontFamilyMain}`;
    let nameWidth = 0;
    for (const artifact of artifacts) {
        nameWidth = Math.max(nameWidth, context.measureText(artifact.name).width);
    }

    context.font = `600 ${fontSizeSub}px ${fontFamilySub}`;
    nameWidth = Math.max(nameWidth, context.measureText(language === 'en' ? 'Name' : '名前').width);

    return {
        id: Math.ceil(idWidth + cellPadding + buffer),
        name: Math.ceil(nameWidth + cellPadding + buffer),
    };
}

const activeSortHeaderStyle: React.CSSProperties = {
    background: 'var(--dim-bg)',
    boxShadow: 'inset 0 -2px 0 var(--accent-blue)',
};

function SortHeader({
    field,
    label,
    activeField,
    sortAsc,
    onSort,
    style,
}: {
    field: SortField;
    label: string;
    activeField: SortField;
    sortAsc: boolean;
    onSort: (field: SortField) => void;
    style?: React.CSSProperties;
}) {
    const isActive = activeField === field;

    return (
        <th
            style={isActive ? { ...(style ?? {}), ...activeSortHeaderStyle } : style}
            aria-sort={isActive ? (sortAsc ? 'ascending' : 'descending') : undefined}
        >
            <button
                type="button"
                onClick={() => onSort(field)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                    font: 'inherit',
                    padding: 0,
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
                {isActive
                    ? (sortAsc
                        ? <ArrowUp size={14} color="var(--accent-blue)" aria-hidden="true" />
                        : <ArrowDown size={14} color="var(--accent-blue)" aria-hidden="true" />)
                    : <ArrowUpDown size={14} style={{ opacity: 0.45 }} aria-hidden="true" />}
            </button>
        </th>
    );
}

export default function ListTab() {
    const { t, language } = useTranslation();
    const design = useAppStore(state => state.globalSettings?.design);
    const theme = design?.theme || 'dark';
    const fontSizeMain = design?.fontSizeMain ?? DEFAULT_DESIGN.fontSizeMain;
    const fontSizeSub = design?.fontSizeSub ?? DEFAULT_DESIGN.fontSizeSub;
    const fontFamilyMain = design?.fontFamilyMain || DEFAULT_DESIGN.fontFamilyMain || 'sans-serif';
    const fontFamilySub = design?.fontFamilySub || DEFAULT_DESIGN.fontFamilySub || 'sans-serif';
    const [fontsReady, setFontsReady] = useState(() => (
        typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded'
    ));
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAttr, setFilterAttr] = useState('');
    const [filterKind, setFilterKind] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterSkill, setFilterSkill] = useState('');
    const {
        skillFilterFields,
        skillFilterMySets,
        saveSkillFilterFields,
        saveMySet,
        deleteMySet,
        toggleMySetLock,
        isSkillFilterOpen,
        setIsSkillFilterOpen,
        matchesSkillFilter
    } = useSkillFilter();
    const [sortField, setSortField] = useState<SortField>('inventoryOrder');
    const [sortAsc, setSortAsc] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_LIMIT);

    // Initial load for page size from db
    useEffect(() => {
        db.settings.get('global').then(s => {
            if (s?.pageLimit) setPageSize(s.pageLimit);
        });
    }, []);

    // Re-measure once after web fonts finish loading.
    useEffect(() => {
        if (typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded') return;

        let cancelled = false;
        document.fonts.ready
            .then(() => {
                if (!cancelled) setFontsReady(true);
            })
            .catch(() => {
                if (!cancelled) setFontsReady(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Fetch all items from DB
    const artifacts = useLiveQuery(() => db.artifacts.toArray()) ?? EMPTY_ARTIFACTS;
    const memos = useLiveQuery(() => db.memos.toArray()) || [];
    const conditions = useLiveQuery(() => db.conditions.toArray()) || [];

    // Measure against the full owned-AF list so widths stay stable across pages/filters.
    const columnWidths = useMemo(
        () => measureFixedColumnWidths(artifacts, language, fontSizeMain, fontSizeSub, fontFamilyMain, fontFamilySub),
        [artifacts, language, fontSizeMain, fontSizeSub, fontFamilyMain, fontFamilySub, fontsReady]
    );

    const isLv5Search = /^(?:れべる|レベル|Level|Lv)\.?\s*[5５]$/i.test(searchTerm.trim());
    const isStar5Search = /^(?:★|☆|ほし|ホシ|星|star)\.?\s*[5５]$/i.test(searchTerm.trim());

    // Memo lookup map for O(1) performance
    const memoMap = useMemo(() => {
        const map = new Map<number, string>();
        memos.forEach(m => map.set(m.id, m.memo));
        return map;
    }, [memos]);

    // Join memo data and sort/filter with useMemo to prevent unnecessary recalculations
    const displayList = useMemo(() => {
        return artifacts
            .map(a => {
                return { ...a, memoText: memoMap.get(a.id) || '' };
            })
            .filter(a =>
                (filterAttr === '' || a.attribute === filterAttr) &&
                (filterKind === '' || a.kind === filterKind) &&
                (filterStatus === '' ||
                    (filterStatus === 'fav' && a.is_locked) ||
                    (filterStatus === 'trash' && a.is_unnecessary) ||
                    (filterStatus === 'keep' && a.keepFlag) ||
                    (filterStatus === 'discard' && a.discardFlag) ||
                    (filterStatus === 'none' && !a.is_locked && !a.is_unnecessary && !a.keepFlag && !a.discardFlag)
                ) &&
                (
                    searchTerm === '' || (
                        isStar5Search ? (
                            [a.skill1_info?.skill_quality, a.skill2_info?.skill_quality, a.skill3_info?.skill_quality, a.skill4_info?.skill_quality].some(q => q === 5)
                        ) : isLv5Search ? (
                            [a.skill1_info?.level, a.skill2_info?.level, a.skill3_info?.level, a.skill4_info?.level].some(lvl => lvl === 5)
                        ) : (
                            String(a.id).includes(searchTerm) ||
                            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            a.memoText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.skill1_info?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.skill2_info?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.skill3_info?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.skill4_info?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                        )
                    )
                ) &&
                (
                    filterSkill === '' ||
                    (filterSkill === 'active' && matchesSkillFilter(a)) ||
                    (filterSkill.startsWith('skill_') && (() => {
                        const baseId = parseInt(filterSkill.replace('skill_', ''));
                        const skillInfo = SKILL_MASTER_BY_BASE_ID.get(baseId);
                        if (!skillInfo) return false;
                        const targetName = getCleanName(skillInfo.name);
                        return [a.skill1_info, a.skill2_info, a.skill3_info, a.skill4_info]
                            .some(s => getCleanName(s?.name) === targetName);
                    })())
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
                if (valA === undefined) valA = sortField === 'inventoryOrder' ? Number.MAX_SAFE_INTEGER : 0;
                if (valB === undefined) valB = sortField === 'inventoryOrder' ? Number.MAX_SAFE_INTEGER : 0;

                // inventoryOrderでのソート時に値が同じ（または両方未定義の値）であれば、ID降順にフォールバック
                if (sortField === 'inventoryOrder' && valA === valB) {
                    return sortAsc ? a.id - b.id : b.id - a.id;
                }

                if (valA < valB) return sortAsc ? -1 : 1;
                if (valA > valB) return sortAsc ? 1 : -1;
                return 0;
            });
    }, [
        artifacts, memoMap,
        searchTerm, filterAttr, filterKind, filterStatus, filterSkill,
        sortField, sortAsc, isLv5Search, isStar5Search, matchesSkillFilter
    ]);

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

    const toggleSort = (field: SortField) => {
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
    }, [searchTerm, filterAttr, filterKind, filterStatus, filterSkill, skillFilterFields, sortField, sortAsc, pageSize]);

    // Keyboard navigation for pages
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
                return;
            }
            if (isSkillFilterOpen) {
                return;
            }

            const activeEl = document.activeElement;
            const listContainer = document.getElementById('list-scroll-container');
            if (listContainer && (activeEl === listContainer || listContainer.contains(activeEl))) {
                if (listContainer.scrollWidth > listContainer.clientWidth) {
                    // リストがアクティブかつ横スクロール可能な場合はページ送りをせずスクロールを優先する
                    return;
                }
            }
            
            if (e.key === 'ArrowLeft') {
                setCurrentPage(c => Math.max(1, c - 1));
            } else if (e.key === 'ArrowRight') {
                setCurrentPage(c => Math.min(totalPages, c + 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [totalPages, isSkillFilterOpen]);

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

                {/* Status filter */}
                <select className="input" style={{ padding: '0.4rem 0.6rem', width: 'auto' }}
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
                    <option value="">{language === 'en' ? 'Status: All' : '状態: すべて'}</option>
                    <option value="fav">{language === 'en' ? 'Favorite' : 'お気に入り'}</option>
                    <option value="trash">{language === 'en' ? 'Trash' : '不用品'}</option>
                    <option value="keep">{language === 'en' ? 'Keep' : '確保提案'}</option>
                    <option value="discard">{language === 'en' ? 'Discard' : '廃棄提案'}</option>
                    <option value="none">{language === 'en' ? 'None' : 'ラベルなし'}</option>
                </select>

                {/* Skill filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <select className="input" style={{ padding: '0.4rem 0.6rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        value={filterSkill}
                        onChange={e => { setFilterSkill(e.target.value); setCurrentPage(1); }}>
                        <option value="">{language === 'en' ? 'Skill: All' : 'スキル: すべて'}</option>
                        <option value="active">{language === 'en' ? 'Skill Filter Active' : 'スキルフィルター有効'}</option>
                        <optgroup label={language === 'en' ? '── Gr [I] ──' : '── Gr [Ⅰ] ──'}>
                            {G1_SKILLS.map(s => (
                                <option key={s.baseId} value={`skill_${s.baseId}`}>{translateSkill(s.name, language)}</option>
                            ))}
                        </optgroup>
                        <optgroup label={language === 'en' ? '── Gr [II] ──' : '── Gr [Ⅱ] ──'}>
                            {G2_SKILLS.map(s => (
                                <option key={s.baseId} value={`skill_${s.baseId}`}>{translateSkill(s.name, language)}</option>
                            ))}
                        </optgroup>
                        <optgroup label={language === 'en' ? '── Gr [III] ──' : '── Gr [Ⅲ] ──'}>
                            {G3_SKILLS.map(s => (
                                <option key={s.baseId} value={`skill_${s.baseId}`}>{translateSkill(s.name, language)}</option>
                            ))}
                        </optgroup>
                    </select>
                    <button className="btn btn-ghost" style={{ padding: '0.4rem', borderRadius: '6px' }}
                        onClick={() => setIsSkillFilterOpen(true)}
                        title={language === 'en' ? 'Skill Filter Settings' : 'スキルフィルター設定'}>
                        <SettingsIcon size={16} />
                    </button>
                </div>

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
                            <option value={5}>{language === 'en' ? '5 / page' : '5件 / ページ'}</option>
                            <option value={10}>{language === 'en' ? '10 / page' : '10件 / ページ'}</option>
                            <option value={50}>{language === 'en' ? '50 / page' : '50件 / ページ'}</option>
                            <option value={100}>{language === 'en' ? '100 / page' : '100件 / ページ'}</option>
                            <option value={200}>{language === 'en' ? '200 / page' : '200件 / ページ'}</option>
                            <option value={300}>{language === 'en' ? '300 / page' : '300件 / ページ'}</option>
                            <option value={500}>{language === 'en' ? '500 / page' : '500件 / ページ'}</option>
                            <option value={750}>{language === 'en' ? '750 / page' : '750件 / ページ'}</option>
                            <option value={1000}>{language === 'en' ? '1000 / page' : '1000件 / ページ'}</option>
                            <option value={1250}>{language === 'en' ? '1250 / page' : '1250件 / ページ'}</option>
                            <option value={MAX_AF_INVENTORY}>{language === 'en' ? `${MAX_AF_INVENTORY} / page` : `${MAX_AF_INVENTORY}件 / ページ`}</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Table Area */}
            <div id="list-scroll-container" tabIndex={-1} className="glass-panel" style={{ flex: 1, overflow: 'auto', borderRadius: '12px', outline: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 'max(1100px, calc(var(--font-size-sub) * 95))' }}>
                    <colgroup>
                        <col style={{ width: `${columnWidths.id}px` }} />
                        <col style={{ width: `${columnWidths.name}px` }} />
                    </colgroup>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--panel-bg)', backdropFilter: 'blur(10px)', zIndex: 1 }}>
                        <tr>
                            <SortHeader field="id" label="ID" activeField={sortField} sortAsc={sortAsc} onSort={toggleSort} style={{ ...thStyle, width: columnWidths.id, minWidth: columnWidths.id }} />
                            <th style={{ ...thStyle, width: columnWidths.name, minWidth: columnWidths.name }}>{language === 'en' ? 'Name' : '名前'}</th>
                            <SortHeader field="attr_kind" label={language === 'en' ? 'Attr / Wpn' : '属性・武器種'} activeField={sortField} sortAsc={sortAsc} onSort={toggleSort} style={thStyle} />
                            <SortHeader field="level" label="Lv" activeField={sortField} sortAsc={sortAsc} onSort={toggleSort} style={thStyle} />
                            <SortHeader field="evaluationScore" label={language === 'en' ? 'Score' : '評価値'} activeField={sortField} sortAsc={sortAsc} onSort={toggleSort} style={thStyle} />
                            <th style={thStyle}>{language === 'en' ? 'Skill 1' : 'スキル1'}</th>
                            <th style={thStyle}>{language === 'en' ? 'Skill 2' : 'スキル2'}</th>
                            <th style={thStyle}>{language === 'en' ? 'Skill 3' : 'スキル3'}</th>
                            <th style={thStyle}>{language === 'en' ? 'Skill 4' : 'スキル4'}</th>
                            <th style={{ ...thStyle, minWidth: '260px' }}>{language === 'en' ? 'Status' : '状態'}</th>
                            <SortHeader field="memoText" label={language === 'en' ? 'Memo' : 'メモ'} activeField={sortField} sortAsc={sortAsc} onSort={toggleSort} style={{ ...thStyle, minWidth: '320px' }} />
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedItems.map(a => (
                            <tr key={a.id} style={{ borderBottom: '1px solid var(--panel-border)', backgroundColor: a.keepFlag ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                <td style={{ ...tdStyle, width: columnWidths.id, minWidth: columnWidths.id }}>
                                    <div style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{a.id}</div>
                                </td>
                                <td style={{ ...tdStyle, width: columnWidths.name, minWidth: columnWidths.name }}>
                                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }} title={getArtifactNameTitle(a, language)}>{a.name}</div>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '260px' }}>
                                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                            {a.is_locked && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--favorite-tag-bg)', color: '#000', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}><Heart size={12} /> {language === 'en' ? 'Fav' : 'お気に入り'}</span>}
                                            {a.is_unnecessary && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-purple)', color: '#fff', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Package size={12} /> {language === 'en' ? 'Trash' : '不用品'}</span>}
                                            {a.keepFlag && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-blue)', color: '#fff', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Star size={12} /> {language === 'en' ? 'Keep' : '確保提案'}</span>}
                                            {a.discardFlag && <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', background: 'var(--accent-danger)', color: '#fff', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><Trash2 size={12} /> {language === 'en' ? 'Discard' : '廃棄提案'}</span>}
                                        </div>
                                        {a.keepFlag && (() => {
                                            const cond = conditions.find(c => c.id === a.keepFlag);
                                            return cond ? <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', color: 'var(--accent-blue-hover)', wordBreak: 'break-word', lineHeight: 1.2 }}>{cond.name || (language === 'en' ? '(No Name)' : '(名称なし)')}</div> : null;
                                        })()}
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <input
                                        type="text"
                                        className="input"
                                        style={{ padding: '0.3rem 0.5rem', background: 'transparent', borderColor: 'transparent', borderBottomColor: 'var(--panel-border)', borderRadius: 0, width: '100%', minWidth: '320px' }}
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
                                <td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {artifacts.length === 0
                                        ? (language === 'en' ? 'No data. Please import JSON from the Data Tab.' : 'データがありません。AFデータ取得タブからJSONをインポートしてください。')
                                        : (language === 'en' ? 'No matching AFs.' : '該当AFはありません。')}
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
                            <option value={5}>5件 / ページ</option>
                            <option value={10}>10件 / ページ</option>
                            <option value={50}>50件 / ページ</option>
                            <option value={100}>100件 / ページ</option>
                            <option value={200}>200件 / ページ</option>
                            <option value={300}>300件 / ページ</option>
                            <option value={500}>500件 / ページ</option>
                            <option value={750}>750件 / ページ</option>
                            <option value={1000}>1000件 / ページ</option>
                            <option value={1250}>1250件 / ページ</option>
                            <option value={MAX_AF_INVENTORY}>{MAX_AF_INVENTORY}件 / ページ</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Skill Filter Popup */}
            <SkillFilterPopup
                isOpen={isSkillFilterOpen}
                onClose={() => setIsSkillFilterOpen(false)}
                skillFilterFields={skillFilterFields}
                saveSkillFilterFields={saveSkillFilterFields}
                skillFilterMySets={skillFilterMySets}
                saveMySet={saveMySet}
                deleteMySet={deleteMySet}
                toggleMySetLock={toggleMySetLock}
                language={language}
                theme={theme}
            />
        </div>
    );
}

function SkillCell({ skill }: { skill?: any }) {
    if (!skill || !skill.name) return <span style={{ color: 'var(--text-muted)' }}>-</span>;

    // Check if the skill is quality 5 to apply special colored styling
    const isMax = skill.skill_quality === 5;
    const isLevel5 = skill.level === 5;

    const outlineStyle = '0px 0px 3px var(--max-quality-outline), -1px -1px 0 var(--max-quality-outline), 1px -1px 0 var(--max-quality-outline), -1px 1px 0 var(--max-quality-outline), 1px 1px 0 var(--max-quality-outline)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '160px' }}>
            <div style={{ fontSize: 'var(--font-size-sub)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={skill.name}>
                {skill.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'calc(var(--font-size-sub) * 0.94)' }}>
                <span style={{ 
                    color: isMax ? 'var(--max-quality-text)' : 'var(--text-muted)',
                    textShadow: isMax ? outlineStyle : 'none'
                }}>{skill.effect_value || `- Lv.${skill.level}`}</span>
                <span style={{ 
                    color: isMax ? 'var(--max-quality-text)' : 'var(--accent-gold)', 
                    fontWeight: 500,
                    textShadow: isMax ? outlineStyle : 'none'
                }}>
                    ★{skill.skill_quality}
                    <span style={{ 
                        color: isLevel5 ? 'var(--max-quality-text)' : 'var(--text-muted)', 
                        fontWeight: 500, 
                        marginLeft: '4px', 
                        fontSize: '0.9em',
                        textShadow: isLevel5 ? outlineStyle : 'none'
                    }}>Lv{skill.level}</span>
                </span>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = { padding: '1rem', color: 'var(--text-muted)', fontSize: 'var(--font-size-sub)', fontWeight: 600, borderBottom: '1px solid var(--panel-border)' };
const tdStyle: React.CSSProperties = { padding: '1rem', fontSize: 'var(--font-size-main)', verticalAlign: 'top' };
