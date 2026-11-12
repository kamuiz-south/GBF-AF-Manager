import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../i18n';

const COLLAPSED_SECTIONS_KEY = 'af-ref-collapsed-sections';

function readCollapsedSections(): Set<string> {
    try {
        const raw = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
        if (!raw) return new Set();

        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();

        return new Set(parsed.filter((id): id is string => typeof id === 'string'));
    } catch {
        return new Set();
    }
}

function writeCollapsedSections(collapsed: Set<string>) {
    try {
        if (collapsed.size === 0) {
            localStorage.removeItem(COLLAPSED_SECTIONS_KEY);
        } else {
            localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(Array.from(collapsed)));
        }
    } catch {
        // Persistence is best-effort; the section still toggles for this session.
    }
}

export default function CollapsibleSection({
    id,
    title,
    icon,
    children,
}: {
    id: string;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    const { language } = useTranslation();
    const [isOpen, setIsOpen] = useState(() => !readCollapsedSections().has(id));
    const contentId = `section-content-${id}`;

    const toggle = () => {
        const next = !isOpen;
        setIsOpen(next);

        const collapsed = readCollapsedSections();

        // Store only collapsed IDs so newly added sections stay expanded by default.
        if (next) {
            collapsed.delete(id);
        } else {
            collapsed.add(id);
        }

        writeCollapsedSections(collapsed);
    };

    const toggleLabel = isOpen
        ? (language === 'en' ? 'Collapse section' : 'セクションを折りたたむ')
        : (language === 'en' ? 'Expand section' : 'セクションを展開する');

    return (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: isOpen ? '1rem' : 0,
                    paddingBottom: isOpen ? '0.6rem' : 0,
                    borderBottom: isOpen ? '1px solid var(--panel-border)' : 'none',
                }}
            >
                <h3 style={{ fontSize: 'var(--font-size-main)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    {icon} {title}
                </h3>
                <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    aria-label={toggleLabel}
                    title={toggleLabel}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.2rem',
                        borderRadius: '4px',
                        flexShrink: 0,
                    }}
                >
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
            </div>
            {isOpen && <div id={contentId}>{children}</div>}
        </div>
    );
}
