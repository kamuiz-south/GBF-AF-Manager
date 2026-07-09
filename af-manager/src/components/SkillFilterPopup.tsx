import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Lock, Unlock } from 'lucide-react';
import { G1_SKILLS, G2_SKILLS, G3_SKILLS } from '../data/skillMaster';
import { translateSkill } from '../utils/skillMapping';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    skillFilterFields: number[][];
    saveSkillFilterFields: (fields: number[][]) => void;
    skillFilterMySets?: Record<number, { fields: number[][]; locked: boolean }>;
    saveMySet?: (slot: number, fields: number[][]) => void;
    deleteMySet?: (slot: number) => void;
    toggleMySetLock?: (slot: number) => void;
    language: 'ja' | 'en';
    theme: string;
}

export function SkillFilterPopup({
    isOpen,
    onClose,
    skillFilterFields,
    saveSkillFilterFields,
    skillFilterMySets = {},
    saveMySet,
    deleteMySet,
    toggleMySetLock,
    language,
    theme,
}: Props) {
    const [mode, setMode] = useState<'normal' | 'register' | 'delete'>('normal');
    const presetAreaRef = useRef<HTMLDivElement>(null);

    // キャンセル処理: マイセット領域外のクリック
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (mode !== 'normal' && presetAreaRef.current && !presetAreaRef.current.contains(e.target as Node)) {
                setMode('normal');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [mode]);

    // キャンセル処理: フィルターの変更時
    useEffect(() => {
        setMode('normal');
    }, [skillFilterFields]);

    if (!isOpen) return null;

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: 'var(--bg-color)',
                border: '3px solid var(--panel-border)',
                borderRadius: '12px',
                padding: '1.5rem',
                width: '500px',
                maxWidth: '90vw',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-main)', fontWeight: 700 }}>
                        {language === 'en' ? 'Skill Filter Settings' : 'スキルフィルター設定'}
                    </h3>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem' }} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Description */}
                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    {language === 'en'
                        ? 'Fields are connected by AND. Skills within a field are connected by OR.'
                        : 'フィールド間はAND（すべて一致）、フィールド内はOR（いずれか一致）の関係です。'}
                </p>

                {/* Fields */}
                {skillFilterFields.map((field, fieldIdx) => (
                    <div key={fieldIdx} style={{ marginBottom: '0.8rem' }}>
                        {fieldIdx > 0 && (
                            <div style={{ textAlign: 'center', padding: '0.3rem 0', fontSize: 'var(--font-size-sub)', color: 'var(--accent-gold)', fontWeight: 700 }}>AND</div>
                        )}
                        <div style={{ border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0.6rem' }}>
                            <div style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                                {language === 'en' ? `Field ${fieldIdx + 1}` : `条件${fieldIdx + 1}`}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {field.map((baseId, skillIdx) => (
                                    <div key={skillIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {skillIdx > 0 && (
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>OR</span>
                                        )}
                                        {skillIdx === 0 && <span style={{ minWidth: '28px' }} />}
                                        <select
                                            className="input"
                                            style={{ flex: 1, padding: '0.2rem', paddingRight: '1.2rem', fontSize: 'var(--font-size-sub)' }}
                                            value={baseId}
                                            onChange={e => {
                                                const newFields = skillFilterFields.map((f, fi) =>
                                                    fi === fieldIdx ? f.map((s, si) => si === skillIdx ? Number(e.target.value) : s) : [...f]
                                                );
                                                saveSkillFilterFields(newFields);
                                            }}
                                        >
                                            <option value="">--</option>
                                            <optgroup label="Gr [I]">
                                                {G1_SKILLS.map(s => <option key={s.baseId} value={s.baseId}>{translateSkill(s.name, language)}</option>)}
                                            </optgroup>
                                            <optgroup label="Gr [II]">
                                                {G2_SKILLS.map(s => <option key={s.baseId} value={s.baseId}>{translateSkill(s.name, language)}</option>)}
                                            </optgroup>
                                            <optgroup label="Gr [III]">
                                                {G3_SKILLS.map(s => <option key={s.baseId} value={s.baseId}>{translateSkill(s.name, language)}</option>)}
                                            </optgroup>
                                        </select>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ padding: '0.2rem', color: 'var(--accent-danger)' }}
                                            onClick={() => {
                                                const newFields = skillFilterFields.map((f, fi) =>
                                                    fi === fieldIdx ? f.filter((_, si) => si !== skillIdx) : [...f]
                                                );
                                                saveSkillFilterFields(newFields);
                                            }}
                                            title={language === 'en' ? 'Remove' : '削除'}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {/* Add Skill button */}
                                <button
                                    className="btn"
                                    style={{
                                        alignSelf: 'flex-start',
                                        padding: '0.2rem 0.6rem',
                                        fontSize: 'var(--font-size-sub)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        marginTop: '0.2rem',
                                        background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : undefined,
                                        border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : undefined,
                                        color: theme === 'dark' ? '#fff' : undefined,
                                    }}
                                    onClick={() => {
                                        const newFields = skillFilterFields.map((f, fi) =>
                                            fi === fieldIdx ? [...f, 0] : [...f]
                                        );
                                        saveSkillFilterFields(newFields);
                                    }}
                                >
                                    <Plus size={14} /> {language === 'en' ? 'Add Skill' : 'スキルを追加'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Footer / Presets & Reset */}
                <div ref={presetAreaRef} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        
                        {/* Left Side: Label and Buttons */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
                            <div style={{ 
                                fontSize: 'calc(var(--font-size-sub) * 0.95)', 
                                color: 'var(--text-muted)', 
                                border: '1px solid var(--panel-border)', 
                                padding: '0.2rem 0.6rem', 
                                borderRadius: '6px',
                                background: 'var(--dim-bg)',
                                marginTop: '0.4rem' // slightly down to align with round buttons
                            }}>
                                {language === 'en' ? 'My Set' : 'マイセット'}
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', gap: '0.8rem' }}>
                            {[1, 2, 3].map(slot => {
                                const mySet = skillFilterMySets[slot];
                                const hasData = !!mySet && mySet.fields.some(f => f.length > 0);
                                const isLocked = mySet?.locked || false;
                                
                                let animation = 'none';
                                if (mode === 'register' && !isLocked) animation = 'pulse-green 1.5s infinite';
                                else if (mode === 'delete' && !isLocked && hasData) animation = 'pulse-red 1.5s infinite';
                                
                                const textColor = hasData ? 'var(--accent-gold)' : (theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)');
                                const bg = hasData
                                    ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.1)')
                                    : (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.18)');
                                
                                return (
                                    <button
                                        key={slot}
                                        className="btn"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '50%',
                                            background: bg,
                                            outline: (mode === 'register' && !isLocked) ? '2px solid var(--accent-green)' : (mode === 'delete' && !isLocked && hasData) ? '2px solid var(--accent-danger)' : '2px solid transparent',
                                            outlineOffset: '1px',
                                            cursor: (mode === 'register' && isLocked) ? 'not-allowed' : (mode === 'delete' && (!hasData || isLocked)) ? 'not-allowed' : 'pointer',
                                            color: textColor,
                                            animation: animation,
                                            position: 'relative'
                                        }}
                                        onClick={() => {
                                            if (mode === 'register') {
                                                if (!isLocked && saveMySet) {
                                                    saveMySet(slot, skillFilterFields);
                                                    setMode('normal');
                                                }
                                            } else if (mode === 'delete') {
                                                if (!isLocked && hasData && deleteMySet) {
                                                    deleteMySet(slot);
                                                    setMode('normal');
                                                }
                                            } else {
                                                if (hasData) {
                                                    saveSkillFilterFields(mySet.fields);
                                                }
                                            }
                                        }}
                                        title={
                                            mode === 'register' ? (isLocked ? 'Locked' : 'Save to My Set') 
                                            : mode === 'delete' ? (isLocked ? 'Locked' : 'Delete My Set') 
                                            : 'Load My Set'
                                        }
                                    >
                                        <strong style={{ fontSize: 'calc(var(--font-size-main) * 1.3)' }}>{slot}</strong>
                                        
                                        <div 
                                            style={{ 
                                                position: 'absolute',
                                                bottom: '-4px',
                                                right: '-4px',
                                                background: 'var(--bg-color)',
                                                borderRadius: '50%',
                                                padding: '3px',
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                cursor: mode === 'normal' ? 'pointer' : 'default',
                                                opacity: mode === 'normal' ? 1 : 0.6,
                                                border: '1px solid var(--panel-border)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (mode === 'normal' && toggleMySetLock) {
                                                    toggleMySetLock(slot);
                                                }
                                            }}
                                        >
                                            {isLocked ? <Lock size={12} color="var(--accent-gold)" /> : <Unlock size={12} color="var(--text-muted)" />}
                                        </div>
                                    </button>
                                );
                            })}
                                </div>

                                {/* Second Row: Actions */}
                                <div style={{ display: 'flex', gap: '0.8rem' }}>
                                    <button
                                        className="btn"
                                        style={{
                                            padding: '0.4rem 1.2rem',
                                            fontSize: 'var(--font-size-sub)',
                                            background: 'var(--dim-bg)',
                                            color: 'var(--text-main)',
                                            animation: mode === 'register' ? 'pulse-green 1.5s infinite' : 'none',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            outline: mode === 'register' ? '2px solid var(--accent-green)' : '2px solid transparent',
                                            outlineOffset: '1px'
                                        }}
                                        onClick={() => setMode(mode === 'register' ? 'normal' : 'register')}
                                    >
                                        {language === 'en' ? 'Register' : '登録'}
                                    </button>
                                    
                                    <button
                                        className="btn"
                                        style={{
                                            padding: '0.4rem 1.2rem',
                                            fontSize: 'var(--font-size-sub)',
                                            background: 'var(--dim-bg)',
                                            color: 'var(--text-main)',
                                            animation: mode === 'delete' ? 'pulse-red 1.5s infinite' : 'none',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            outline: mode === 'delete' ? '2px solid var(--accent-danger)' : '2px solid transparent',
                                            outlineOffset: '1px'
                                        }}
                                        onClick={() => setMode(mode === 'delete' ? 'normal' : 'delete')}
                                    >
                                        {language === 'en' ? 'Clear' : '消去'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <button
                            className="btn"
                            style={{
                                padding: '0.4rem 1rem',
                                fontSize: 'var(--font-size-sub)',
                                color: 'var(--accent-danger)',
                                background: theme === 'dark' ? 'var(--panel-bg)' : undefined,
                                border: theme === 'dark' ? '1px solid var(--panel-border)' : undefined,
                            }}
                            onClick={() => saveSkillFilterFields([[], [], []])}
                        >
                            {language === 'en' ? 'Reset All' : 'リセット'}
                        </button>
                    </div>
                </div>
                
                {/* CSS for animations */}
                <style>{`
                    @keyframes pulse-green {
                        0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
                        70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
                    }
                    @keyframes pulse-red {
                        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                        70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
}
