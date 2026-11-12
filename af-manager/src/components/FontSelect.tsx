import type { RefObject } from 'react';
import { ChevronDown } from 'lucide-react';

const FONT_OPTIONS = [
    { label: 'System Default', value: "'Inter', 'Segoe UI', system-ui, sans-serif" },
    { label: 'Arial', value: "Arial, sans-serif" },
    { label: 'Meiryo', value: "'Meiryo', sans-serif" },
    { label: 'メイリオ', value: "'メイリオ', 'Meiryo', sans-serif" },
    { label: 'MS PGothic', value: "'MS PGothic', sans-serif" },
    { label: 'ＭＳ Ｐゴシック', value: "'ＭＳ Ｐゴシック', 'MS PGothic', sans-serif" },
    { label: 'Yu Gothic', value: "'Yu Gothic', 'YuGothic', sans-serif" },
    { label: '游ゴシック', value: "'游ゴシック', 'Yu Gothic', sans-serif" },
    { label: 'BIZ UDGothic', value: "'BIZ UDGothic', sans-serif" },
    { label: 'Noto Sans JP', value: "'Noto Sans JP', sans-serif" },
    { label: 'Monospace', value: "monospace" },
    { label: 'Serif (Mincho)', value: "'Yu Mincho', 'MS PMincho', serif" }
];

type FontSelectProps = {
    label: string;
    value: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onHover: (value: string) => void;
    onSelect: (value: string) => void;
    onLeave: () => void;
    systemFonts: readonly string[];
    theme: string;
    language: string;
    containerRef?: RefObject<HTMLDivElement | null>;
};

export default function FontSelect({
    label,
    value,
    isOpen,
    onOpenChange,
    onHover,
    onSelect,
    onLeave,
    systemFonts,
    theme,
    language,
    containerRef,
}: FontSelectProps) {
    const allFontOpts = [
        ...FONT_OPTIONS,
        ...systemFonts.map(f => ({ label: f, value: f })),
    ];
    const selectedLabel = allFontOpts.find(o => o.value === value)?.label ?? value;
    const dropdownBg = theme === 'dark' ? '#1e293b' : '#ffffff';
    const dropdownHover = theme === 'dark' ? '#334155' : '#f1f5f9';

    return (
        <div ref={containerRef}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                <button
                    type="button"
                    className="input"
                    style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-main)', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => onOpenChange(!isOpen)}
                >
                    <span style={{ fontFamily: value }}>{selectedLabel}</span>
                    <ChevronDown size={14} style={{ flexShrink: 0 }} />
                </button>
                {isOpen && (
                    <div
                        style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300, maxHeight: '220px', overflowY: 'auto', background: dropdownBg, border: '1px solid var(--accent-blue)', borderRadius: '6px', boxShadow: '0 6px 20px rgba(0,0,0,0.5)' }}
                        onMouseLeave={onLeave}
                    >
                        {FONT_OPTIONS.length > 0 && (
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '5px 10px 2px', letterSpacing: '0.06em', background: dropdownBg }}>{language === 'en' ? 'BUILT-IN' : 'プリセット'}</div>
                                {FONT_OPTIONS.map(opt => (
                                    <div
                                        key={opt.value}
                                        style={{ padding: '7px 12px', cursor: 'pointer', fontFamily: opt.value, background: value === opt.value ? 'var(--accent-blue)' : dropdownBg, color: value === opt.value ? '#fff' : 'var(--text-main)' }}
                                        onMouseEnter={e => { onHover(opt.value); (e.currentTarget as HTMLElement).style.background = value === opt.value ? 'var(--accent-blue)' : dropdownHover; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = value === opt.value ? 'var(--accent-blue)' : dropdownBg; }}
                                        onClick={() => { onSelect(opt.value); onOpenChange(false); onLeave(); }}
                                    >
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                        )}
                        {systemFonts.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--dim-border)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '5px 10px 2px', letterSpacing: '0.06em', background: dropdownBg }}>{language === 'en' ? 'SYSTEM' : 'システムフォント'}</div>
                                {systemFonts.map(f => (
                                    <div
                                        key={f}
                                        style={{ padding: '7px 12px', cursor: 'pointer', fontFamily: f, background: value === f ? 'var(--accent-blue)' : dropdownBg, color: value === f ? '#fff' : 'var(--text-main)' }}
                                        onMouseEnter={e => { onHover(f); (e.currentTarget as HTMLElement).style.background = value === f ? 'var(--accent-blue)' : dropdownHover; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = value === f ? 'var(--accent-blue)' : dropdownBg; }}
                                        onClick={() => { onSelect(f); onOpenChange(false); onLeave(); }}
                                    >
                                        {f}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
