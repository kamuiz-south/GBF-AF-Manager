import { useState, useEffect, useCallback } from 'react';
import { Download, Upload, Trash2, Plus, Minus, RefreshCw, Palette, Zap, Save, Settings as SettingsIcon, ShieldAlert, MonitorUp, HardDrive } from 'lucide-react';
import { db } from '../db';
import type { Settings } from '../types';
import { DEFAULT_DESIGN } from '../types';
import { exportDatabase, importDatabase, exportMemos, importMemos, exportConditions, importConditions } from '../utils/backup';
import { G1_SKILLS, G2_SKILLS, G3_SKILLS } from '../data/skillMaster';
import { evaluateArtifact } from '../utils/evaluator';
import { runDiscardCalc } from '../utils/discardCalc';
import { useAppStore } from '../store/useAppStore';
import { useTranslation, type TranslationKey } from '../i18n';
import { translateSkill } from '../utils/skillMapping';

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

export const DEFAULT_SETTINGS: Settings = {
    id: 'global',
    language: 'ja',
    evaluationFormula: {
        group1Multiplier: 1,
        group2Multiplier: 1,
        group3Multiplier: 1,
        skillMultipliers: {},
        qualityValues: {},
        exceptions: []
    },
    discardBehavior: {
        treatUnnecessaryAsDiscard: true,
        targetInventoryCount: 1500,
        protectLocked: true,
        protectKeepFlag: true,
        protectRareAF: true,
        protectEquipped: true,
    }
};

export default function SettingsTab() {
    const { t, language } = useTranslation();
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [skillGroup, setSkillGroup] = useState<1 | 2 | 3>(1);
    const [isDirty, setIsDirty] = useState(false);
    const [hasDiscardChanges, setHasDiscardChanges] = useState(false);
    const [localFonts, setLocalFonts] = useState<string[]>([]);
    const [localFontMain, setLocalFontMain] = useState('');
    const [localFontSub, setLocalFontSub] = useState('');
    const setSettingsDirty = useAppStore(state => state.setSettingsDirty);

    const updateSettings = useCallback((s: Settings) => {
        setSettings(s);
        setIsDirty(true);
        setSettingsDirty(true);
    }, [setSettingsDirty]);

    const updateDiscardSettings = useCallback((patch: Partial<Settings['discardBehavior']>) => {
        setSettings(prev => ({
            ...prev,
            discardBehavior: { ...prev.discardBehavior, ...patch }
        }));
        setHasDiscardChanges(true);
    }, []);

    useEffect(() => {
        db.settings.get('global').then(res => {
            if (res) {
                setSettings(res);
                setLocalFontMain(res.design?.fontFamilyMain ?? "'Inter', 'Segoe UI', system-ui, sans-serif");
                setLocalFontSub(res.design?.fontFamilySub ?? "'Inter', 'Segoe UI', system-ui, sans-serif");
            }
            setLoading(false);
        });
    }, []);

    const loadSystemFonts = async () => {
        if (!('queryLocalFonts' in window)) {
            alert(language === 'en' ? 'Your browser does not support local font access APIs. Please type the font name manually.' : 'お使いの環境（ブラウザ）はシステムフォントの自動取得APIに対応していません。\n直接フォント名を手入力してください。');
            return;
        }
        try {
            const fonts: any[] = await (window as any).queryLocalFonts();
            const familyNames = Array.from(new Set(fonts.map(f => f.family))).sort();
            setLocalFonts(familyNames as string[]);
            alert(language === 'en' ? `✅ Permission granted! Loaded ${familyNames.length} fonts. You can select them from the list.` : `✅ 許可されました！ ${familyNames.length}件のフォントを読み込みました。候補リストから選択できます。`);
        } catch (e: any) {
            console.error(e);
            alert(language === 'en' ? 'Access to local fonts was denied or an error occurred. Please allow permission in browser settings.' : 'ローカルフォントへのアクセスが拒否されたか、エラーが発生しました。ブラウザの設定で権限を許可してください。');
        }
    };

    // Unsaved changes warning on browser tab close / navigation away
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!isDirty) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty, hasDiscardChanges]);

    const updateMultiplier = (baseId: number, val: number) => {
        const newMultipliers = { ...settings.evaluationFormula.skillMultipliers };
        if (isNaN(val) || val === 1) {
            delete newMultipliers[baseId];
        } else {
            newMultipliers[baseId] = val;
        }
        updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, skillMultipliers: newMultipliers } });
    };

    const handleSave = async () => {
        await db.settings.put(settings);
        setIsDirty(false);
        setSettingsDirty(false);
        try {
            const artifacts = await db.artifacts.toArray();
            artifacts.forEach(a => { a.evaluationScore = evaluateArtifact(a, settings); });
            await db.artifacts.bulkPut(artifacts);
            alert(language === 'en' ? 'Settings saved and artifact scores recalculated.' : '設定を保存し、評価値を再計算しました。');
        } catch (e) {
            console.error(e);
            alert(language === 'en' ? 'Settings saved. (Failed to recalculate scores)' : '設定を保存しました。(評価値の再計算に失敗しました)');
        }
    };

    const handleImportClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e: ProgressEvent<FileReader>) => {
                try {
                    await importDatabase(e.target?.result as string);
                    alert(language === 'en' ? 'Restore complete. Reloading page.' : '復元が完了しました。ページをリロードします。');
                    window.location.reload();
                } catch (err) {
                    console.error(err);
                    alert(language === 'en' ? 'Failed to restore settings.' : '復元に失敗しました。');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleImportConditionsClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev: ProgressEvent<FileReader>) => {
                try {
                    await importConditions(ev.target?.result as string);
                    alert(language === 'en' ? 'Criteria import complete.' : '条件のインポートが完了しました。');
                } catch (err: any) {
                    console.error(err);
                    alert((language === 'en' ? 'Import Failed: ' : 'インポートに失敗: ') + (err.message || ''));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleImportMemosClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev: ProgressEvent<FileReader>) => {
                try {
                    await importMemos(ev.target?.result as string);
                    alert(language === 'en' ? 'Memo import complete.' : 'AFメモのインポートが完了しました。');
                } catch (err: any) {
                    console.error(err);
                    alert((language === 'en' ? 'Import Failed: ' : 'インポートに失敗: ') + (err.message || ''));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleClearAll = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete all data (AFs, Criteria, Memos)? This cannot be undone.' : 'すべての登録データ（AF、条件、メモ）を削除しますか？この操作は取り消せません。')) {
            await db.artifacts.clear();
            await db.conditions.clear();
            await db.memos.clear();
            alert(language === 'en' ? 'Data cleared.' : 'データをクリアしました。');
            window.location.reload();
        }
    };

    const handleClearArtifactsOnly = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete ONLY Artifact Data? (Memos and Criteria will remain)' : '所持AFデータのみを削除しますか？（メモ・条件は残ります）')) {
            await db.artifacts.clear();
            alert(language === 'en' ? 'Artifact data deleted.' : '所持AFデータを削除しました。');
            window.location.reload();
        }
    };

    const handleClearMemosOnly = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete ONLY Memo Data?' : 'メモデータのみを削除しますか？（AF・条件は残ります）')) {
            await db.memos.clear();
            alert(language === 'en' ? 'Memo data deleted.' : 'メモデータを削除しました。');
        }
    };

    const handleClearConditionsOnly = async () => {
        if (confirm(language === 'en' ? 'Are you sure you want to delete ONLY Criteria Data? (AFs and Memos will remain)' : '確保AF条件のみを削除しますか？（AF・メモは残ります）')) {
            await db.conditions.clear();
            alert(language === 'en' ? 'Criteria data deleted.' : '確保AF条件を削除しました。');
        }
    };

    const runDiscardLogic = async () => {
        if (isDirty && !confirm(language === 'en' ? 'There are unsaved evaluation formula changes. Please save them first.\nDo you want to ignore and continue?' : '評価計算式の未保存の変更があります。先に画面上部の「設定を保存」を行ってください。\n無視して続行しますか？')) return;
        try {
            const wasChanged = hasDiscardChanges;
            if (wasChanged) {
                await db.settings.put(settings);
                setHasDiscardChanges(false);
            }
            const msg = await runDiscardCalc(settings, language);

            if (wasChanged) {
                alert((language === 'en' ? 'Settings saved.\n\n' : '設定を保存しました。\n\n') + msg);
            } else {
                alert(msg);
            }
        } catch (e) {
            console.error(e);
            alert(language === 'en' ? 'An error occurred.' : 'エラーが発生しました。');
        }
    };

    // 《評価計算式》のみエクスポート
    const handleExportCalcSettings = () => {
        const { group1Multiplier, group2Multiplier, group3Multiplier, skillMultipliers, qualityValues, exceptions } = settings.evaluationFormula;
        const blob = new Blob([JSON.stringify({ group1Multiplier, group2Multiplier, group3Multiplier, skillMultipliers, qualityValues, exceptions }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `af_calc_settings_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    };

    // 《評価計算式》のみインポート
    const handleImportCalcSettings = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'application/json';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev: ProgressEvent<FileReader>) => {
                try {
                    const data = JSON.parse(ev.target?.result as string);
                    const current = await db.settings.get('global');
                    if (!current) { alert(language === 'en' ? 'Please save settings first.' : '先に設定を一度保存してください。'); return; }
                    const merged: Settings = {
                        ...current,
                        evaluationFormula: {
                            ...current.evaluationFormula,
                            group1Multiplier: data.group1Multiplier ?? current.evaluationFormula.group1Multiplier,
                            group2Multiplier: data.group2Multiplier ?? current.evaluationFormula.group2Multiplier,
                            group3Multiplier: data.group3Multiplier ?? current.evaluationFormula.group3Multiplier,
                            skillMultipliers: data.skillMultipliers ?? current.evaluationFormula.skillMultipliers,
                            qualityValues: data.qualityValues ?? current.evaluationFormula.qualityValues,
                            exceptions: data.exceptions ?? current.evaluationFormula.exceptions,
                        }
                    };
                    await db.settings.put(merged);
                    setSettings(merged);
                    alert(language === 'en' ? 'Calc settings imported. Please hit "Save Settings" if you want to recalculate evaluation scores.' : '評価計算式設定をインポートしました。評価値を再計算する場合は「設定を保存」を押してください。');
                } catch (err: any) {
                    alert((language === 'en' ? 'Import Failed: ' : 'インポート失敗: ') + (err.message || ''));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // デザイン設定
    const currentDesign = { ...DEFAULT_DESIGN, ...(settings.design ?? {}) };
    const updateDesign = async (patch: Partial<typeof DEFAULT_DESIGN>) => {
        const newDesign = { ...currentDesign, ...patch };
        const newSettings = { ...settings, design: newDesign };
        await db.settings.put(newSettings);
        setSettings(newSettings);
    };
    const resetDesign = async () => {
        const newSettings = { ...settings, design: { ...DEFAULT_DESIGN } };
        await db.settings.put(newSettings);
        setSettings(newSettings);
    };


    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', paddingBottom: '3rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 'calc(var(--font-size-main) * 1.8)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <SettingsIcon /> {language === 'en' ? 'Settings' : '設定'}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                    <select
                        className="input"
                        style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--font-size-main)', cursor: 'pointer' }}
                        value={settings.language || 'ja'}
                        onChange={async (e) => {
                            const newLang = e.target.value as 'en' | 'ja';

                            // Update local state so the dropdown value changes visually
                            setSettings(prev => ({ ...prev, language: newLang }));

                            // Immediately save only the language to the database
                            // to avoid unintentionally saving other modified but unsaved settings.
                            const currentDbSettings = await db.settings.get('global');
                            if (currentDbSettings) {
                                await db.settings.put({ ...currentDbSettings, language: newLang });
                            } else {
                                await db.settings.put({ ...DEFAULT_SETTINGS, language: newLang });
                            }
                        }}
                    >
                        <option value="ja">日本語</option>
                        <option value="en">English</option>
                    </select>
                    <button className="btn btn-primary" onClick={handleSave} style={{ background: isDirty ? 'var(--accent-blue)' : undefined, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <Save size={18} /> {isDirty ? (language === 'en' ? 'Save & Calc *' : '保存＋再計算 *') : (language === 'en' ? 'Save Settings' : '設定を保存')}
                    </button>
                </div>
            </header>

            {/* Evaluation Settings */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <SettingsIcon size={18} /> {language === 'en' ? 'Evaluation Formula' : '評価値の計算式'}
                </h3>
                <div style={{ background: 'var(--dim-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                        {language === 'en' ? '【 Base Skill Evaluation Value 】' : '【 基本となる各スキルの評価値 】'}
                    </div>
                    <div style={{ paddingLeft: '1rem', marginBottom: '1rem' }}>
                        {language === 'en' ? '[ Skill Base Value ] = (Quality Star 1-5) × (Individual Skill Multiplier)' : '　[ スキル評価値 ] ＝ (品質の星数 1〜5) × (スキル別乗算係数)'}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                        {language === 'en' ? '【 Final Overall AF Evaluation Score 】' : '【 最終的なAFの全体評価スコア 】'}
                    </div>
                    <div style={{ paddingLeft: '1rem' }}>
                        <div>　( {language === 'en' ? 'G1 Multiplier' : 'G1係数'} × [ S1{language === 'en' ? 'Value' : '評価値'} + S2{language === 'en' ? 'Value' : '評価値'} ] )</div>
                        <div>+ ( {language === 'en' ? 'G2 Multiplier' : 'G2係数'} × [ S3{language === 'en' ? 'Value' : '評価値'} ] )</div>
                        <div>+ ( {language === 'en' ? 'G3 Multiplier' : 'G3係数'} × [ S4{language === 'en' ? 'Value' : '評価値'} ] )</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: 'var(--font-size-main)' }}>{language === 'en' ? 'Group 1 (S1, S2) Multiplier' : 'グループ1 (S1, S2) 係数'}</label>
                        <input type="number" className="input" step="0.1"
                            value={settings.evaluationFormula.group1Multiplier}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group1Multiplier: e.target.value === '' ? '' as any : parseFloat(e.target.value) } })}
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group1Multiplier: 0 } }) }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: 'var(--font-size-main)' }}>{language === 'en' ? 'Group 2 (S3) Multiplier' : 'グループ2 (S3) 係数'}</label>
                        <input type="number" className="input" step="0.1"
                            value={settings.evaluationFormula.group2Multiplier}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group2Multiplier: e.target.value === '' ? '' as any : parseFloat(e.target.value) } })}
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group2Multiplier: 0 } }) }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: 'var(--font-size-main)' }}>{language === 'en' ? 'Group 3 (S4) Multiplier' : 'グループ3 (S4) 係数'}</label>
                        <input type="number" className="input" step="0.1"
                            value={settings.evaluationFormula.group3Multiplier}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group3Multiplier: e.target.value === '' ? '' as any : parseFloat(e.target.value) } })}
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, group3Multiplier: 0 } }) }}
                        />
                    </div>
                </div>

                {/* Quality Values Q1-Q5 */}
                <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.5rem' }}>{language === 'en' ? 'Quality Modifier Settings (Q1-Q5)' : '品質レベル別評価値設定 (Q1～Q5)'}</h4>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>{language === 'en' ? 'Set the value for each Quality Level (stars 1-5). If empty, the star count itself (1-5) is used.' : '品質星数（1～5）ごとの評価値を設定できます。未入力時は品質数値をそのまま使用します。'}</p>
                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                        {[1, 2, 3, 4, 5].map((q: number) => (
                            <div key={q} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                                <label style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>Q{q} (★{q})</label>
                                <input type="number" className="input" step="0.1"
                                    style={{ width: '72px', padding: '0.3rem 0.5rem' }}
                                    placeholder={String(q)}
                                    value={settings.evaluationFormula.qualityValues?.[q] ?? ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const val = parseFloat(e.target.value);
                                        const newQV = { ...(settings.evaluationFormula.qualityValues || {}) };
                                        if (isNaN(val)) { delete newQV[q]; } else { newQV[q] = val; }
                                        updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, qualityValues: newQV } });
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '2.5rem' }}>
                    <h4 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.8rem', borderBottom: '1px solid var(--dim-border)', paddingBottom: '0.5rem' }}>{language === 'en' ? 'Individual Skill Multipliers' : 'スキル個別乗算係数設定'}</h4>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        {language === 'en' ? 'Set multipliers for specific skills. Default is 1.0. Applies across all quality levels.' : '全スキルの乗算係数を設定できます。デフォルトは1.0。スキル名単位で設定し、全品質共通で適用されます。'}
                    </p>

                    {/* Group Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        {([1, 2, 3] as const).map((g: 1 | 2 | 3) => (
                            <button
                                key={g}
                                className={`btn ${skillGroup === g ? 'btn-primary' : 'btn-ghost'} `}
                                style={{ padding: '0.4rem 1.2rem', fontSize: 'var(--font-size-main)', border: '1px solid var(--panel-border)' }}
                                onClick={() => setSkillGroup(g)}
                            >
                                G{g} {g === 1 ? '(S1/S2)' : g === 2 ? '(S3)' : '(S4)'}
                            </button>
                        ))}
                    </div>

                    {/* G1: 2-column compact grid */}
                    {skillGroup === 1 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {G1_SKILLS.map((skill: { baseId: number; name: string; }) => (
                                <div key={skill.baseId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--criteria-detail-bg)', padding: '0.5rem 0.8rem', borderRadius: '8px', gap: '0.5rem' }}>
                                    <span style={{ fontSize: 'var(--font-size-main)', flex: 1 }}>{language === 'en' ? translateSkill(skill.name, language) : skill.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>x</span>
                                        <input type="number" className="input" step="0.1"
                                            style={{ width: '72px', padding: '0.25rem 0.5rem' }}
                                            value={settings.evaluationFormula.skillMultipliers?.[skill.baseId] ?? 1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMultiplier(skill.baseId, e.target.value === '' ? '' as any : parseFloat(e.target.value))}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateMultiplier(skill.baseId, 0) }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* G2: 1-column (long names) */}
                    {skillGroup === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {G2_SKILLS.map((skill: { baseId: number; name: string; }) => (
                                <div key={skill.baseId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--criteria-detail-bg)', padding: '0.5rem 0.8rem', borderRadius: '8px', gap: '0.8rem' }}>
                                    <span style={{ fontSize: 'var(--font-size-sub)', flex: 1, lineHeight: '1.4' }}>{language === 'en' ? translateSkill(skill.name, language) : skill.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>x</span>
                                        <input type="number" className="input" step="0.1"
                                            style={{ width: '72px', padding: '0.25rem 0.5rem' }}
                                            value={settings.evaluationFormula.skillMultipliers?.[skill.baseId] ?? 1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMultiplier(skill.baseId, e.target.value === '' ? '' as any : parseFloat(e.target.value))}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateMultiplier(skill.baseId, 0) }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* G3: 1-column (long names) */}
                    {skillGroup === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {G3_SKILLS.map((skill: { baseId: number; name: string; }) => (
                                <div key={skill.baseId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--criteria-detail-bg)', padding: '0.5rem 0.8rem', borderRadius: '8px', gap: '0.8rem' }}>
                                    <span style={{ fontSize: 'var(--font-size-sub)', flex: 1, lineHeight: '1.4' }}>{language === 'en' ? translateSkill(skill.name, language) : skill.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                        <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>x</span>
                                        <input type="number" className="input" step="0.1"
                                            style={{ width: '72px', padding: '0.25rem 0.5rem' }}
                                            value={settings.evaluationFormula.skillMultipliers?.[skill.baseId] ?? 1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMultiplier(skill.baseId, e.target.value === '' ? '' as any : parseFloat(e.target.value))}
                                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '') updateMultiplier(skill.baseId, 0) }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* === Exceptions / Combo Conditions (inside same panel) === */}
                <hr style={{ border: 'none', borderTop: '1px solid var(--dim-border)', margin: '1.5rem 0' }} />
                <h3 style={{ fontSize: 'var(--font-size-main)', marginBottom: '0.8rem', color: 'var(--text-main)' }}>{language === 'en' ? 'Skill Combination Modifiers (+/-)' : 'スキル組み合わせ条件（加算/減算）'}</h3>
                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    {language === 'en'
                        ? <>Add or subtract from the total score when two specific skills appear together on the same Artifact.<br />Please ensure the Condition Skill and Target Skill are different.</>
                        : <>指定した2つのスキルが同一AFに存在する場合に、評価値を加算または減算できます。<br />条件スキルと対象スキルは異なるスキルを選択してください。</>}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1rem', maxHeight: '700px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {(settings.evaluationFormula.exceptions || []).map((ex: any, idx: number) => {
                        const allSkills = [
                            ...G1_SKILLS.map(s => ({ group: 1, baseId: s.baseId, name: s.name })),
                            ...G2_SKILLS.map(s => ({ group: 2, baseId: s.baseId, name: s.name })),
                            ...G3_SKILLS.map(s => ({ group: 3, baseId: s.baseId, name: s.name })),
                        ];

                        // Helper to normalize legacy strings to numbers on the fly for the <select> value
                        const normalizeVal = (val: any, grp: number) => {
                            if (typeof val === 'number') return val;
                            const matched = allSkills.find(s => s.group === grp && s.name === val);
                            return matched ? matched.baseId : '';
                        };

                        const currentCondId = normalizeVal(ex.conditionSkillName, ex.conditionGroup);
                        const currentTargetId = normalizeVal(ex.targetSkillName, ex.targetGroup);

                        const availForTarget = allSkills.filter(s => !(s.group === ex.conditionGroup && s.baseId === currentCondId));
                        const availForCond = allSkills.filter(s => !(s.group === ex.targetGroup && s.baseId === currentTargetId));

                        const updateEx = (patch: Partial<typeof ex>) => {
                            const newExs = settings.evaluationFormula.exceptions.map((e: any, i: number) => i === idx ? { ...e, ...patch } : e);
                            updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                        };
                        return (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--criteria-detail-bg)', padding: '0.8rem', borderRadius: '8px' }}>
                                <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', flexShrink: 0 }}>{language === 'en' ? 'If:' : '条件:'}</span>
                                <select className="input" style={{ padding: '0.3rem', fontSize: 'var(--font-size-sub)', width: '60px' }}
                                    value={ex.conditionGroup}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateEx({ conditionGroup: parseInt(e.target.value), conditionSkillName: '' })}>
                                    <option value={1}>G1</option>
                                    <option value={2}>G2</option>
                                    <option value={3}>G3</option>
                                </select>
                                <select className="input" style={{ padding: '0.3rem', fontSize: 'var(--font-size-sub)', flex: 1, minWidth: '140px' }}
                                    value={currentCondId}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateEx({ conditionSkillName: parseInt(e.target.value) || '' })}>
                                    <option value="">{language === 'en' ? '-- Select Skill --' : '-- スキルを選択 --'}</option>
                                    {availForCond.filter(s => s.group === ex.conditionGroup).map((s: { baseId: number, name: string; }) => <option key={s.baseId} value={s.baseId}>{language === 'en' ? translateSkill(s.name, language) : s.name}</option>)}
                                </select>
                                <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', flexShrink: 0 }}>{language === 'en' ? 'and:' : 'と:'}</span>
                                <select className="input" style={{ padding: '0.3rem', fontSize: 'var(--font-size-sub)', width: '60px' }}
                                    value={ex.targetGroup}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateEx({ targetGroup: parseInt(e.target.value), targetSkillName: '' })}>
                                    <option value={1}>G1</option>
                                    <option value={2}>G2</option>
                                    <option value={3}>G3</option>
                                </select>
                                <select className="input" style={{ padding: '0.3rem', fontSize: 'var(--font-size-sub)', flex: 1, minWidth: '140px' }}
                                    value={currentTargetId}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateEx({ targetSkillName: parseInt(e.target.value) || '' })}>
                                    <option value="">{language === 'en' ? '-- Select Skill --' : '-- スキルを選択 --'}</option>
                                    {availForTarget.filter(s => s.group === ex.targetGroup).map((s: { baseId: number, name: string; }) => <option key={s.baseId} value={s.baseId}>{language === 'en' ? translateSkill(s.name, language) : s.name}</option>)}
                                </select>
                                <br />
                                <select className="input" style={{ padding: '0.3rem', fontSize: 'var(--font-size-sub)', width: '70px' }}
                                    value={(typeof ex.isSubtract === 'boolean' ? ex.isSubtract : ex.scoreModifier < 0) ? '-' : '+'}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                        const absVal = Math.abs((ex.scoreModifier as number) || 0);
                                        const isSub = e.target.value === '-';
                                        updateEx({ isSubtract: isSub, scoreModifier: isSub ? -absVal : absVal });
                                    }}>
                                    <option value="+">{language === 'en' ? 'Add' : '加算'}</option>
                                    <option value="-">{language === 'en' ? 'Sub' : '減算'}</option>
                                </select>
                                <input type="number" className="input" step="0.1" min="0" style={{ width: '72px', padding: '0.3rem' }}
                                    value={(ex.scoreModifier as any) === '' ? '' : Math.abs((ex.scoreModifier as number) || 0)}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        if (e.target.value === '') {
                                            updateEx({ scoreModifier: '' as any });
                                        } else {
                                            const v = Math.abs(parseFloat(e.target.value) || 0);
                                            const isNegative = typeof ex.isSubtract === 'boolean' ? ex.isSubtract : ex.scoreModifier < 0;
                                            updateEx({ scoreModifier: isNegative ? -v : v });
                                        }
                                    }}
                                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                        if (e.target.value === '') updateEx({ scoreModifier: 0 });
                                    }}
                                />
                                <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: 'var(--font-size-sub)' }}
                                    onClick={() => {
                                        const newExs = settings.evaluationFormula.exceptions.filter((_: any, i: number) => i !== idx);
                                        updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: newExs } });
                                    }}>{language === 'en' ? 'Del' : '削除'}</button>
                            </div>
                        );
                    })}
                </div>
                <button className="btn btn-ghost" style={{ border: '1px solid var(--panel-border)', fontSize: 'var(--font-size-main)' }}
                    onClick={() => {
                        const newEx = { conditionGroup: 1, conditionSkillName: '', targetGroup: 1, targetSkillName: '', scoreModifier: 0, isSubtract: false };
                        updateSettings({ ...settings, evaluationFormula: { ...settings.evaluationFormula, exceptions: [...(settings.evaluationFormula.exceptions || []), newEx] } });
                    }}>
                    {language === 'en' ? '+ Add Rule' : '＋ 条件行を追加'}
                </button>
            </div>  {/* end glass-panel eval+exceptions */}

            {/* Discard Settings */}
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '0.8rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} /> {language === 'en' ? 'Discard Settings' : 'AF廃棄設定'}
                </h3>
                <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    {language === 'en'
                        ? <>Discard flags will be suggested when "Your AFs &gt; Target Inventory Count" based on the deficit.<br />Candidates are chosen from lowest evaluation score upwards, excluding protected AFs.</>
                        : <>廃棄フラグは「目標所持数 &lt; 現在のAF数」の場合に、不足分の必要枚数分廃棄を提案するフラグです。<br />保護された以外のAFの中から、評価値の低い順に廃棄候補が選ばれます。</>}
                </p>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: 'var(--font-size-main)', fontWeight: 600 }}>{language === 'en' ? 'Target Inventory Count' : '目標所持数'}</label>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{language === 'en' ? 'Suggests discard if inventory exceeds this.' : 'AF所持数がこの数を超えたときに廃棄を提案します。'}</p>
                    <input
                        type="number"
                        className="input"
                        style={{ maxWidth: '200px' }}
                        value={settings.discardBehavior.targetInventoryCount}
                        onChange={e => updateDiscardSettings({ targetInventoryCount: parseInt(e.target.value) || 1500 })}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectLocked ?? true}
                            onChange={e => updateDiscardSettings({ protectLocked: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect Favorites (Locked)' : 'お気に入りを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'If OFF, favorite AFs can be flagged. A "Discard?" warning badge will appear.' : 'OFFにするとお気に入りのAFも廃棄候補になります。「廃棄？」バッジで警告します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectKeepFlag ?? true}
                            onChange={e => updateDiscardSettings({ protectKeepFlag: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect Target Criteria AFs' : '確保されたAFを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes AFs caught by "Criteria" from discard selection.' : '「欲しい条件」で確保フラグが立ったAFを廃棄候補から除外します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.treatUnnecessaryAsDiscard}
                            onChange={e => updateDiscardSettings({ treatUnnecessaryAsDiscard: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Include "Packaged" in Discard Quota' : '不用品を廃棄予定に含める'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'If ON, packaged (trash) AFs count toward your discard goal and evaluate first.' : 'ONの場合、ゲーム内不用品マークのAFは先に廃棄提案になったり、その分廃棄必要数が減ります。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectRareAF ?? true}
                            onChange={e => updateDiscardSettings({ protectRareAF: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect Quirk Artifacts' : 'クァーキー・アーティファクトを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes specific quirk artifacts like Fantosmik Fengtooth from discard.' : '幻麗の犀牙などドロップ率が希少なクァーキーAFを廃棄候補から除外します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectEquipped ?? true}
                            onChange={e => updateDiscardSettings({ protectEquipped: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect Equipped AFs' : '装備中のAFを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes AFs currently equipped by characters.' : 'キャラに装備中のAFを廃棄候補から除外します。'}</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', fontSize: 'var(--font-size-main)' }}>
                        <input type="checkbox" style={{ marginTop: '3px' }}
                            checked={settings.discardBehavior.protectMemos ?? true}
                            onChange={e => updateDiscardSettings({ protectMemos: e.target.checked })}
                        />
                        <span><strong>{language === 'en' ? 'Protect AFs with Memos' : 'メモ付きのAFを保護'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'Excludes AFs that have any memo text attached.' : 'メモ欄にテキストが入力されているAFを廃棄候補から除外します。'}</span></span>
                    </label>
                </div>

                <div style={{ marginBottom: '1.5rem', background: 'var(--grid-item-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', fontWeight: 600, marginBottom: '0.6rem' }}>
                        {language === 'en' ? 'Protect Specific Elements' : '特定の属性を保護'}
                    </label>
                    <p style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                        {language === 'en' ? 'Checked elements are protected from discard flags.' : 'チェックを入れた属性のAFは廃棄提案の対象から除外されます。'}
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {[
                            { val: '1', label: '火', color: '#f87171' },
                            { val: '2', label: '水', color: '#60a5fa' },
                            { val: '3', label: '土', color: '#fbb117' },
                            { val: '4', label: '風', color: '#4ade80' },
                            { val: '5', label: '光', color: '#fef08a' },
                            { val: '6', label: '闇', color: '#c084fc' }
                        ].map(attr => {
                            const isChecked = settings.discardBehavior.protectedAttributes?.includes(attr.val) ?? false;
                            return (
                                <label key={attr.val} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'var(--dim-bg)', padding: '0.3rem 0.6rem', borderRadius: '4px', border: `1px solid ${isChecked ? attr.color : 'transparent'}` }}>
                                    <input type="checkbox"
                                        checked={isChecked}
                                        onChange={e => {
                                            const set = new Set(settings.discardBehavior.protectedAttributes ?? []);
                                            if (e.target.checked) set.add(attr.val);
                                            else set.delete(attr.val);
                                            updateDiscardSettings({ protectedAttributes: Array.from(set) });
                                        }}
                                    />
                                    <span style={{ fontSize: 'var(--font-size-sub)', fontWeight: 600, color: attr.color }}>{t(`ATTR_${attr.val}` as TranslationKey, attr.label)}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <button className="btn btn-primary" onClick={runDiscardLogic} style={{ background: 'var(--accent-purple)' }}>
                    {hasDiscardChanges ? (language === 'en' ? 'Save & Recalculate Discard *' : '保存＋廃棄フラグ再計算 *') : (language === 'en' ? 'Recalculate Discard Only' : '廃棄フラグ 一括計算')}
                </button>
            </div>

            {/* Moved Data Management below Advanced Settings */}

            {/* ── App Design Settings ─────────────────────────── */}
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Palette size={18} /> {language === 'en' ? 'App Design Settings' : 'アプリデザイン設定'}
                </h3>

                {/* Zoom */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                        {language === 'en' ? 'Global Zoom:' : '全体ズーム率:'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ zoom: Math.max(0.7, currentDesign.zoom - 0.05) })} style={{ padding: '0.4rem', border: '1px solid var(--panel-border)' }}>
                            <Minus size={16} />
                        </button>
                        <span style={{ fontSize: 'calc(var(--font-size-main) * 1.1)', fontWeight: 600, color: 'var(--accent-blue)', minWidth: '3.5rem', textAlign: 'center' }}>
                            {Math.round(currentDesign.zoom * 100)}%
                        </span>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ zoom: Math.min(1.5, currentDesign.zoom + 0.05) })} style={{ padding: '0.4rem', border: '1px solid var(--panel-border)' }}>
                            <Plus size={16} />
                        </button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.6rem' }}>{language === 'en' ? '70% ~ 150% (Default: 100%)' : '70% ～ 150%（デフォルト: 100%）'}</div>
                </div>

                {/* Per-tab zoom toggle */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: 'pointer', fontSize: 'var(--font-size-main)', fontWeight: 600 }}>
                        <input type="checkbox"
                            checked={currentDesign.showTabZoomControls}
                            onChange={e => updateDesign({ showTabZoomControls: e.target.checked })} />
                        {language === 'en' ? 'Show Tab-specific Zoom Controls' : 'タブ別ズーム調整ボタンを表示'}
                    </label>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.3rem', marginLeft: '1.6rem' }}>
                        {language === 'en' ? 'When ON, +/- buttons appear on each tab for individual scaling. (Scale is retained even if turned OFF).' : 'ONにすると各タブの右上に±ボタンが表示され、タブ毎に拡大縮小できます（設定はOFFにしても維持されます）'}
                    </div>
                </div>

                {/* Theme */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.6rem', fontWeight: 600 }}>{language === 'en' ? 'Theme' : 'テーマ'}</label>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                        {(['dark', 'light'] as const).map(th => (
                            <button key={th}
                                onClick={() => updateDesign({ theme: th })}
                                style={{
                                    padding: '0.4rem 1.2rem', borderRadius: '6px', border: `1.5px solid ${currentDesign.theme === th ? 'var(--accent-blue)' : 'var(--panel-border)'} `,
                                    background: currentDesign.theme === th ? 'rgba(59,130,246,0.15)' : 'var(--dim-bg)',
                                    color: currentDesign.theme === th ? 'var(--accent-blue)' : 'var(--text-muted)',
                                    cursor: 'pointer', fontWeight: currentDesign.theme === th ? 700 : 400, fontSize: 'var(--font-size-main)'
                                }}>
                                {th === 'dark' ? (language === 'en' ? '🌙 Dark' : '🌙 ダーク') : (language === 'en' ? '☀️ Light' : '☀️ ライト')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Font Family Selection */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <datalist id="font-options">
                        {FONT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        {localFonts.map(f => <option key={f} value={f} />)}
                    </datalist>

                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                            {language === 'en' ? 'Main Text Font' : '本文フォント'}
                        </label>
                        <input type="text" list="font-options" className="input"
                            style={{ width: '100%', padding: '0.4rem', fontSize: 'var(--font-size-main)' }}
                            value={localFontMain}
                            onChange={e => setLocalFontMain(e.target.value)}
                            onBlur={() => updateDesign({ fontFamilyMain: localFontMain })}
                            placeholder={language === 'en' ? 'Enter or select font name' : 'フォント名を入力または選択'}
                        />
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                            {language === 'en' ? 'Secondary Text Font' : '補助テキストフォント'}
                        </label>
                        <input type="text" list="font-options" className="input"
                            style={{ width: '100%', padding: '0.4rem', fontSize: 'var(--font-size-main)' }}
                            value={localFontSub}
                            onChange={e => setLocalFontSub(e.target.value)}
                            onBlur={() => updateDesign({ fontFamilySub: localFontSub })}
                            placeholder={language === 'en' ? 'Enter or select font name' : 'フォント名を入力または選択'}
                        />
                    </div>
                </div>

                {/* Manual Local Font Load Button */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <button className="btn btn-ghost" onClick={loadSystemFonts} style={{ padding: '0.4rem 1rem', fontSize: 'var(--font-size-sub)', border: '1px solid var(--panel-border)' }}>
                        <RefreshCw size={14} /> {language === 'en' ? 'Load system fonts to list (Requires Permission)' : 'PCのインストール済みフォントを候補に追加（権限要求）'}
                    </button>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.95)', color: 'var(--text-muted)', marginTop: '0.4rem', marginLeft: '0.2rem' }}>
                        {language === 'en'
                            ? '* By allowing browser permissions, all fonts installed on your PC will be suggested. (Due to API limits, Japanese fonts may appear under English names like "Meiryo").'
                            : '※ブラウザのセキュリティ権限を許可することで、PC内のすべてのフォントがサジェスト表示されるようになります。（APIの仕様上、日本語フォントは「Meiryo」など英語名でリストアップされる場合があります）'}
                    </div>
                </div>

                {/* Font sizes */}
                <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                        {language === 'en' ? 'Main Text size: ' : '本文フォントサイズ: '}<span style={{ color: 'var(--accent-blue)' }}>{currentDesign.fontSizeMain}px</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', maxWidth: '350px' }}>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ fontSizeMain: Math.max(10, currentDesign.fontSizeMain - 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Minus size={14} /></button>
                        <input type="range" min={10} max={20} step={1}
                            value={currentDesign.fontSizeMain}
                            onChange={e => updateDesign({ fontSizeMain: parseInt(e.target.value) })}
                            style={{ flex: 1 }} />
                        <button className="btn btn-ghost" onClick={() => updateDesign({ fontSizeMain: Math.min(20, currentDesign.fontSizeMain + 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Plus size={14} /></button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{language === 'en' ? 'Card text, descriptions, etc. (Default: 14px)' : 'カード内テキスト、説明文など（デフォルト: 14px）'}</div>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                        {language === 'en' ? 'Secondary Text size: ' : '補助テキストフォントサイズ: '}<span style={{ color: 'var(--accent-blue)' }}>{currentDesign.fontSizeSub}px</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', maxWidth: '350px' }}>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ fontSizeSub: Math.max(9, currentDesign.fontSizeSub - 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Minus size={14} /></button>
                        <input type="range" min={9} max={16} step={1}
                            value={currentDesign.fontSizeSub}
                            onChange={e => updateDesign({ fontSizeSub: parseInt(e.target.value) })}
                            style={{ flex: 1 }} />
                        <button className="btn btn-ghost" onClick={() => updateDesign({ fontSizeSub: Math.min(16, currentDesign.fontSizeSub + 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Plus size={14} /></button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{language === 'en' ? 'Labels, ID displays, secondary info (Default: 12px)' : 'ラベル、ID表示、補足情報など（デフォルト: 12px）'}</div>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                        {language === 'en' ? 'Grid Weapon Text size: ' : 'ゲーム内UIタブ グリッド内武器種文字サイズ: '}<span style={{ color: 'var(--accent-blue)' }}>{currentDesign.gridWeaponFontSize ?? 19}px</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', maxWidth: '350px' }}>
                        <button className="btn btn-ghost" onClick={() => updateDesign({ gridWeaponFontSize: Math.max(10, (currentDesign.gridWeaponFontSize ?? 19) - 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Minus size={14} /></button>
                        <input type="range" min={10} max={40} step={1}
                            value={currentDesign.gridWeaponFontSize ?? 19}
                            onChange={e => updateDesign({ gridWeaponFontSize: parseInt(e.target.value) })}
                            style={{ flex: 1 }} />
                        <button className="btn btn-ghost" onClick={() => updateDesign({ gridWeaponFontSize: Math.min(40, (currentDesign.gridWeaponFontSize ?? 19) + 1) })} style={{ padding: '0.2rem', border: '1px solid var(--panel-border)' }}><Plus size={14} /></button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{language === 'en' ? 'Weapon Kind characters in Grid (Default: 19px)' : 'ゲーム内UIタブのカード中央に表示される武器種文字（デフォルト: 19px）'}</div>
                </div>

                <div style={{ marginBottom: '1.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--panel-border)' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer', fontSize: 'var(--font-size-main)', fontWeight: 600 }}>
                        <input type="checkbox" style={{ marginTop: '4px' }}
                            checked={currentDesign.gridDetailNoMaxHeight ?? false}
                            onChange={e => updateDesign({ gridDetailNoMaxHeight: e.target.checked })} />
                        <span><strong>{language === 'en' ? 'Disable Max Height on In-Game UI details pane' : 'ゲーム内UIタブの上部詳細の縦幅制限をなくす'}</strong><br /><span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? 'When ON, the detail pane will expand fully without a scrollbar. (Takes up more vertical space).' : 'ONにするとスクロールバーが出なくなり、スキル等すべてが一度に表示されるようになります。（画面縦幅を多めに占有します）'}</span></span>
                    </label>
                </div>

                <button className="btn btn-ghost" onClick={resetDesign}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--panel-border)', fontSize: 'var(--font-size-main)' }}>
                    <RefreshCw size={15} /> {language === 'en' ? 'Restore Defaults' : 'デフォルトに戻す'}
                </button>
                <p style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {language === 'en' ? '* UI changes apply immediately (No need to save).' : '※デザイン設定は即座に反映されます（「設定を保存」は不要です）'}
                </p>
            </div>

            {/* ── Performance Settings ─────────────────────────── */}
            <div className="glass-panel" style={{ padding: '2rem', borderColor: 'var(--dim-border)', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={18} /> {language === 'en' ? 'Performance Settings' : '軽量化・パフォーマンス設定'}
                </h3>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer', fontSize: 'var(--font-size-main)', fontWeight: 600 }}>
                        <input type="checkbox" style={{ marginTop: '4px' }}
                            checked={currentDesign.enableTabPersistence ?? true}
                            onChange={e => updateDesign({ enableTabPersistence: e.target.checked })} />
                        <span>
                            {language === 'en' ? 'Preserve Tab State & Scroll Position' : '各タブの「状態」と「スクロール位置」を維持する'}
                            <br />
                            <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.97)', color: 'var(--text-muted)', fontWeight: 400, display: 'inline-block', marginTop: '0.3rem', lineHeight: 1.5 }}>
                                {language === 'en'
                                    ? <>When ON, switching between tabs preserves your search criteria and scroll positions.<br />When OFF, switching tabs resets them to their initial state.<br /><span style={{ color: 'var(--accent-blue)' }}>* ON is recommended, but turn OFF if you experience memory issues or lag on older PCs.</span></>
                                    : <>ONの場合、別のタブを開いても以前のタブの検索条件やスクロール位置がそのまま残ります。<br />OFFにするとタブ移動のたびに画面（表示件数や条件指定など）が初期状態にリセットされます。<br /><span style={{ color: 'var(--accent-blue)' }}>※ONを推奨しますが、旧PC等でメモリ不足や動作の重さを感じる場合はOFFにしてください。</span></>}
                            </span>
                        </span>
                    </label>
                </div>
            </div>

            {/* ── Advanced Settings (Port) ─────────────────────── */}
            <div className="glass-panel" style={{ padding: '2rem', borderColor: 'var(--dim-border)', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MonitorUp size={18} /> {language === 'en' ? 'Desktop App Advanced Settings' : 'デスクトップアプリ版 上級者設定'}
                </h3>

                <label style={{ display: 'block', fontSize: 'var(--font-size-main)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    {language === 'en' ? 'AF Collector Receive Port Number' : 'AF Collector 受信ポート番号'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.6rem' }}>
                    <input type="number" className="input"
                        style={{ width: '100px' }}
                        min={1024} max={65535}
                        value={settings.httpPort ?? 1422}
                        onChange={e => updateSettings({ ...settings, httpPort: parseInt(e.target.value) || 1422 })}
                    />
                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>{language === 'en' ? '(Default: 1422)' : '（デフォルト: 1422）'}</span>
                </div>
                <p style={{ fontSize: 'var(--font-size-sub)', color: '#f59e0b', marginBottom: '0.6rem' }}>
                    {language === 'en' ? '⚠ Restart the Desktop Application after saving to apply port changes.' : '⚠ 変更を反映するにはアプリ設定を保存後、デスクトップアプリ版を再起動してください。'}
                </p>
                <details style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)' }}>
                    <summary style={{ cursor: 'pointer', marginBottom: '0.4rem' }}>{language === 'en' ? '🔧 What is a port?' : '🔧 ポートとは？'}</summary>
                    <p style={{ marginTop: '0.4rem', lineHeight: 1.6 }}>
                        {language === 'en'
                            ? <>A Port is an "entryway" number through which apps communicate on your computer.<br />The GBF AF Manager Desktop App "listens" for data on this port when started,<br />and the AF Collector Chrome Extension sends data to this port.<br />Only change this if it conflicts with another application's port number.</>
                            : <>ポート（Port）とは、コンピュータ内でアプリ同士が通信するための「窓口番号」です。<br />GBF AF Managerアプリ（デスクトップ版）は起動時にこの番号で通信待受を開始し、<br />ブラウザ拡張機能（AF Collector）がこの番号宛てにデータを送信します。<br />別のアプリと番号が被る（ポート競合）場合のみ変更してください。</>}
                    </p>
                </details>
            </div>

            {/* Data Management (Moved here per G2) */}
            <div className="glass-panel" style={{ padding: '2rem', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <h3 style={{ fontSize: 'calc(var(--font-size-main) * 1.2)', marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <HardDrive size={18} /> {language === 'en' ? 'Data Management (Backup & Restore)' : 'データ管理 (Backup & Restore)'}
                </h3>

                <p style={{ fontSize: 'var(--font-size-main)', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    {language === 'en' ? 'Regular backups are recommended to prevent data loss from browser cache clears.' : 'ブラウザのキャッシュクリア等でデータが消えないよう、定期的なバックアップを推奨します。'}
                </p>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
                    <button className="btn btn-ghost" onClick={exportDatabase} style={{ border: '1px solid var(--panel-border)' }}>
                        <Download size={18} /> {language === 'en' ? 'Export All Data' : 'データをエクスポート (全部)'}
                    </button>
                    <button className="btn btn-ghost" onClick={handleImportClick} style={{ border: '1px solid var(--panel-border)' }}>
                        <Upload size={18} /> {language === 'en' ? 'Import All Data' : 'データをインポート (復元)'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(59,130,246,0.3)' }}>
                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', alignSelf: 'center', minWidth: '9em' }}>{language === 'en' ? 'Criteria Only:' : '確保AF条件のみ:'}</span>
                    <button className="btn btn-ghost" onClick={exportConditions} style={{ fontSize: 'var(--font-size-sub)', border: '1px solid var(--panel-border)', width: '184px', justifyContent: 'flex-start' }}>
                        <Download size={15} /> {language === 'en' ? 'Export Criteria' : '条件をエクスポート'}
                    </button>
                    <button className="btn btn-ghost" onClick={handleImportConditionsClick} style={{ fontSize: 'var(--font-size-sub)', border: '1px solid var(--panel-border)', width: '174px', justifyContent: 'flex-start' }}>
                        <Upload size={15} /> {language === 'en' ? 'Import Criteria' : '条件をインポート'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(59,130,246,0.3)' }}>
                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', alignSelf: 'center', minWidth: '9em' }}>{language === 'en' ? 'Memos Only:' : 'AFメモのみ:'}</span>
                    <button className="btn btn-ghost" onClick={exportMemos} style={{ fontSize: 'var(--font-size-sub)', border: '1px solid var(--panel-border)', width: '184px', justifyContent: 'flex-start' }}>
                        <Download size={15} /> {language === 'en' ? 'Export Memos' : 'メモをエクスポート'}
                    </button>
                    <button className="btn btn-ghost" onClick={handleImportMemosClick} style={{ fontSize: 'var(--font-size-sub)', border: '1px solid var(--panel-border)', width: '174px', justifyContent: 'flex-start' }}>
                        <Upload size={15} /> {language === 'en' ? 'Import Memos' : 'メモをインポート'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(244,162,97,0.4)' }}>
                    <span style={{ fontSize: 'var(--font-size-sub)', color: 'var(--text-muted)', alignSelf: 'center', minWidth: '9em' }}>{language === 'en' ? 'Calc Formula Only:' : '評価計算式のみ:'}</span>
                    <button className="btn btn-ghost" onClick={handleExportCalcSettings} style={{ fontSize: 'var(--font-size-sub)', border: '1px solid var(--panel-border)', width: '184px', justifyContent: 'flex-start' }}>
                        <Download size={15} /> {language === 'en' ? 'Export Formula' : '計算式をエクスポート'}
                    </button>
                    <button className="btn btn-ghost" onClick={handleImportCalcSettings} style={{ fontSize: 'var(--font-size-sub)', border: '1px solid var(--panel-border)', width: '174px', justifyContent: 'flex-start' }}>
                        <Upload size={15} /> {language === 'en' ? 'Import Formula' : '計算式をインポート'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                    <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-sub)' }} onClick={handleClearArtifactsOnly}>
                        <Trash2 size={15} /> {language === 'en' ? 'Delete AF Inventory' : '所持AFのみ削除'}
                    </button>
                    <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-sub)' }} onClick={handleClearMemosOnly}>
                        <Trash2 size={15} /> {language === 'en' ? 'Delete Memos' : 'AFメモのみ削除'}
                    </button>
                    <button className="btn btn-danger" style={{ fontSize: 'var(--font-size-sub)' }} onClick={handleClearConditionsOnly}>
                        <Trash2 size={15} /> {language === 'en' ? 'Delete Criteria' : '確保AF条件のみ削除'}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-danger" onClick={handleClearAll}>
                        <Trash2 size={18} /> {language === 'en' ? 'Clear All Data' : 'すべてのデータを削除'}
                    </button>
                </div>
            </div>

        </div >
    );
}
