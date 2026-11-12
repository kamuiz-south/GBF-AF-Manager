import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';

// Custom skill-name suggestion input.
// The native <datalist> popup is drawn by the webview itself (WebView2 on the Tauri build),
// which anchors/resizes it differently from the browser and cannot be styled. This component
// renders the suggestion list inside the page instead, so the left edge always lines up with
// the input and the layout is identical in the browser and the desktop app.
type SkillSuggestInputProps = {
    value: string;
    options: readonly string[];
    placeholder: string;
    showListLabel: string;
    onChange: (value: string) => void;
    onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
    compact?: boolean;
};

const SkillSuggestInput = ({ value, options, placeholder, showListLabel, onChange, onBlur, compact = false }: SkillSuggestInputProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [placement, setPlacement] = useState<'below' | 'above'>('below');
    const [maxHeight, setMaxHeight] = useState(260);
    const [listWidth, setListWidth] = useState<number | null>(null);

    const filtered = useMemo(() => {
        const q = value.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o => o.toLowerCase().includes(q));
    }, [options, value]);

    // Decide whether the list opens below or above, cap its height to the viewport,
    // and widen it up to the nearest clipping container so long names stay readable
    // without ever overflowing the panel.
    const updateGeometry = useCallback(() => {
        const input = inputRef.current;
        if (!input) return;
        const rect = input.getBoundingClientRect();
        // getBoundingClientRect() is in viewport pixels (already scaled by the app's CSS zoom),
        // while inline widths/heights are in local CSS pixels. Convert so the list stays the
        // same physical size at every zoom level and never overflows the panel.
        const zoom = input.offsetWidth > 0 ? rect.width / input.offsetWidth : 1;
        const toLocal = (value: number) => value / zoom;
        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        const nextPlacement: 'below' | 'above' = toLocal(spaceBelow) < 200 && spaceAbove > spaceBelow ? 'above' : 'below';
        const space = nextPlacement === 'below' ? spaceBelow : spaceAbove;
        setPlacement(nextPlacement);
        setMaxHeight(Math.max(90, Math.min(280, toLocal(space))));

        let limit = window.innerWidth - 12;
        let el: HTMLElement | null = wrapperRef.current?.parentElement ?? null;
        while (el) {
            const style = window.getComputedStyle(el);
            if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
                limit = Math.min(limit, el.getBoundingClientRect().right - 28);
                break;
            }
            el = el.parentElement;
        }
        setListWidth(Math.max(input.offsetWidth, Math.min(560, Math.floor(toLocal(limit - rect.left)))));
    }, []);

    const openList = useCallback(() => {
        updateGeometry();
        setActive(0);
        setOpen(true);
    }, [updateGeometry]);

    const closeList = useCallback(() => {
        setOpen(false);
        setActive(-1);
    }, []);

    // Keep the list glued to the input while the panel scrolls or the window resizes.
    useEffect(() => {
        if (!open) return;
        const handle = (ev: Event) => {
            if (listRef.current && ev.target instanceof Node && listRef.current.contains(ev.target)) return;
            updateGeometry();
        };
        window.addEventListener('scroll', handle, true);
        window.addEventListener('resize', handle);
        return () => {
            window.removeEventListener('scroll', handle, true);
            window.removeEventListener('resize', handle);
        };
    }, [open, updateGeometry]);

    useEffect(() => {
        if (!open) return;
        const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
        el?.scrollIntoView({ block: 'nearest' });
    }, [active, open, filtered.length]);

    // Close the list when the whole window loses focus (for example, the user alt-tabs away).
    useEffect(() => {
        if (!open) return;
        const handleWindowBlur = () => closeList();
        window.addEventListener('blur', handleWindowBlur);
        return () => window.removeEventListener('blur', handleWindowBlur);
    }, [open, closeList]);

    const selectOption = (option: string) => {
        onChange(option);
        closeList();
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        // Let the IME handle Enter/arrows while a Japanese composition is in progress
        // (confirming a conversion must not accidentally pick the first suggestion).
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) { openList(); return; }
            if (filtered.length > 0) setActive(prev => (prev + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) { openList(); return; }
            if (filtered.length > 0) setActive(prev => (prev <= 0 ? filtered.length - 1 : prev - 1));
        } else if (e.key === 'Enter') {
            if (open && active >= 0 && active < filtered.length) {
                e.preventDefault();
                selectOption(filtered[active]);
            }
        } else if (e.key === 'Escape') {
            if (open) { e.preventDefault(); closeList(); }
        } else if (e.key === 'Tab') {
            closeList();
        }
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <input
                ref={inputRef}
                className="input"
                placeholder={placeholder}
                value={value}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open && filtered.length > 0}
                autoComplete="off"
                onChange={e => {
                    onChange(e.target.value);
                    openList();
                }}
                onClick={() => { if (!open) openList(); }}
                onKeyDown={handleKeyDown}
                onBlur={e => { closeList(); onBlur?.(e); }}
                style={compact
                    ? { padding: '0.3rem 1.6rem 0.3rem 0.6rem' }
                    : { paddingRight: '2rem' }}
            />
            <button
                type="button"
                tabIndex={-1}
                aria-label={showListLabel}
                title={showListLabel}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                    inputRef.current?.focus();
                    if (open) closeList(); else openList();
                }}
                style={{
                    position: 'absolute',
                    right: compact ? '0.3rem' : '0.45rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.1rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                }}
            >
                <ChevronDown size={14} />
            </button>
            {open && filtered.length > 0 && (
                <div
                    ref={listRef}
                    role="listbox"
                    style={{
                        position: 'absolute',
                        left: 0,
                        width: listWidth ?? '100%',
                        ...(placement === 'below' ? { top: 'calc(100% + 4px)' } : { bottom: 'calc(100% + 4px)' }),
                        maxHeight,
                        overflowY: 'auto',
                        padding: '0.25rem',
                        background: 'var(--panel-bg)',
                        border: '1px solid var(--panel-border)',
                        borderRadius: '8px',
                        boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                        backdropFilter: 'var(--glass-blur)',
                        WebkitBackdropFilter: 'var(--glass-blur)',
                        zIndex: 1000,
                    }}
                >
                    {filtered.map((option, index) => (
                        <div
                            key={`${index}-${option}`}
                            role="option"
                            aria-selected={index === active}
                            data-active={index === active ? 'true' : undefined}
                            title={option}
                            onMouseDown={e => {
                                e.preventDefault();
                                selectOption(option);
                            }}
                            onMouseEnter={() => setActive(index)}
                            style={{
                                padding: compact ? '0.3rem 0.5rem' : '0.4rem 0.6rem',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                textAlign: 'left',
                                fontSize: 'var(--font-size-main)',
                                color: 'var(--text-main)',
                                background: index === active ? 'rgba(59,130,246,0.25)' : 'transparent',
                            }}
                        >
                            {option}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SkillSuggestInput;
