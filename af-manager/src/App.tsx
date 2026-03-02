import { useEffect, useRef, useLayoutEffect } from 'react';
import { HashRouter, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Database, List, Grid, Filter, Settings as SettingsIcon, ShieldCheck, Trash2, BookOpen, ZoomIn, ZoomOut } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

import DataTab from './tabs/DataTab';
import ListTab from './tabs/ListTab';
import GridTab from './tabs/GridTab';
import CriteriaTab from './tabs/CriteriaTab';
import SettingsTab from './tabs/SettingsTab';
import HelpTab from './tabs/HelpTab';
import { db } from './db';
import { runCriteriaMatcher } from './utils/matcher';
import { runDiscardCalc } from './utils/discardCalc';
import { useAppStore } from './store/useAppStore';
import { DEFAULT_DESIGN, type AppDesignSettings } from './types';
import { useTranslation } from './i18n';

// Per-tab zoom overlay component
function TabZoomOverlay({ design, tabZoom, onAdjustZoom }: { design: AppDesignSettings; tabZoom: number; onAdjustZoom: (delta: number) => void }) {
  if (!design.showTabZoomControls) return null;
  return (
    <div style={{ position: 'absolute', top: '0.6rem', right: '0.8rem', zIndex: 50, display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0.3rem 0.6rem', backdropFilter: 'blur(8px)', opacity: 0.8 }}>
      <button onClick={() => onAdjustZoom(-0.1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }} title="タブを縮小">
        <ZoomOut size={15} />
      </button>
      <span style={{ fontSize: 'calc(var(--font-size-sub) * 0.94)', color: 'var(--text-muted)', minWidth: '2.5rem', textAlign: 'center' }}>{Math.round(tabZoom * 100)}%</span>
      <button onClick={() => onAdjustZoom(+0.1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }} title="タブを拡大">
        <ZoomIn size={15} />
      </button>
    </div>
  );
}

async function handleKeepCalc(language: string) {
  try {
    const [artifacts, conditions] = await Promise.all([
      db.artifacts.toArray(),
      db.conditions.toArray()
    ]);
    if (conditions.length === 0) { alert(language === 'en' ? 'No criteria set.' : '条件が登録されていません。'); return; }
    const updated = runCriteriaMatcher(artifacts, conditions);
    await db.artifacts.bulkPut(updated);
    const keptCount = updated.filter(a => a.keepFlag).length;
    alert(language === 'en' ? `Calculation complete.\nKept: ${keptCount} item(s)` : `確保フラグの一括計算が完了しました。\n確保対象: ${keptCount} 件`);
  } catch (e) {
    console.error(e);
    alert(language === 'en' ? 'An error occurred.' : 'エラーが発生しました。');
  }
}

async function handleDiscardCalc(language: string) {
  try {
    const settings = await db.settings.get('global');
    if (!settings) { alert(language === 'en' ? 'Settings not found.' : '設定が見つかりません。'); return; }
    const msg = await runDiscardCalc(settings, language);
    alert(msg);
  } catch (e) {
    console.error(e);
    alert(language === 'en' ? 'An error occurred.' : 'エラーが発生しました。');
  }
}


function AppInner() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const settingsQuery = useLiveQuery(() => db.settings.get('global'));

  const mainRef = useRef<HTMLElement>(null);
  const scrollMap = useRef<Record<string, number>>({});
  const settingsDirty = useAppStore(state => state.settingsDirty);
  const setSettingsDirty = useAppStore(state => state.setSettingsDirty);
  const collapsed = useAppStore(state => state.sidebarCollapsed);
  const setCollapsed = useAppStore(state => state.setSidebarCollapsed);
  const setGlobalSettings = useAppStore(state => state.setGlobalSettings);

  // Sync settings to store
  useEffect(() => {
    if (settingsQuery) {
      setGlobalSettings(settingsQuery);
    }
  }, [settingsQuery, setGlobalSettings]);

  // Preserve scroll state
  useLayoutEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;
    const restoreY = scrollMap.current[location.pathname] || 0;
    mainEl.scrollTop = restoreY;
  }, [location.pathname]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    scrollMap.current[location.pathname] = e.currentTarget.scrollTop;
  };

  // Apply design settings from DB to DOM
  const dbSettings = useLiveQuery(() => db.settings.get('global'));
  useEffect(() => {
    const d = { ...DEFAULT_DESIGN, ...(dbSettings?.design ?? {}) };
    const root = document.documentElement;
    root.style.setProperty('--font-size-main', `${d.fontSizeMain} px`);
    root.style.setProperty('--font-size-sub', `${d.fontSizeSub} px`);
    root.style.setProperty('--font-family-main', d.fontFamilyMain || "'Inter', 'Segoe UI', system-ui, sans-serif");
    root.style.setProperty('--font-family-sub', d.fontFamilySub || "'Inter', 'Segoe UI', system-ui, sans-serif");
    (document.body.style as any).zoom = String(d.zoom);
    if (d.theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }, [dbSettings?.design]);

  const currentDesign = { ...DEFAULT_DESIGN, ...(dbSettings?.design ?? {}) };
  const updateDesign = async (patch: Partial<AppDesignSettings>) => {
    const newDesign = { ...currentDesign, ...patch };
    const current = await db.settings.get('global');
    if (current) await db.settings.put({ ...current, design: newDesign });
  };

  const currentTabZoom = currentDesign.tabZoom[location.pathname] ?? 1;
  const handleAdjustTabZoom = (delta: number) => {
    const newVal = Math.round(Math.max(0.5, Math.min(2, currentTabZoom + delta)) * 100) / 100;
    updateDesign({ tabZoom: { ...currentDesign.tabZoom, [location.pathname]: newVal } });
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    if (!settingsDirty) return;
    e.preventDefault();
    if (confirm(language === 'en' ? 'There are unsaved changes in the Settings tab. Move without saving?' : '設定タブに未保存の変更があります。保存せずに移動しますか？')) {
      setSettingsDirty(false);
      navigate(to);
    }
  };

  const guardedKeepCalc = () => {
    if (settingsDirty && !confirm(language === 'en' ? 'There are unsaved changes in Settings. Run Keep Calc without saving?' : '設定タブに未保存の変更があります。保存せずに確保フラグ計算を実行しますか？')) return;
    handleKeepCalc(language);
  };

  const guardedDiscardCalc = () => {
    if (settingsDirty && !confirm(language === 'en' ? 'There are unsaved changes in Settings. Run Discard Calc without saving?' : '設定タブに未保存の変更があります。保存せずに廃棄フラグ計算を実行しますか？')) return;
    handleDiscardCalc(language);
  };

  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? '60px' : '165px',
    minWidth: collapsed ? '60px' : '165px',
    transition: 'width 0.22s ease, min-width 0.22s ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 8px',
    boxSizing: 'border-box',
  };

  const ChevronLeft = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
  const ChevronRight = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  return (
    <div className="app-container">
      <aside className="sidebar" style={sidebarStyle}>
        {/* Toggle button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? (language === 'en' ? 'Expand Sidebar' : 'サイドバーを展開') : (language === 'en' ? 'Collapse Sidebar' : 'サイドバーを格納')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', padding: '0.4rem 0', marginBottom: '1.5rem',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', borderRadius: '6px', transition: 'color 0.18s',
          }}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>

        {/* Navigation Items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
          <NavLink to="/data" onClick={(e) => handleNavClick(e, '/data')} className={({ isActive }) => `nav - link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''} `} title={t('TAB_DATA', 'データ管理')}>
            <Database size={22} style={{ flexShrink: 0 }} />
            <span className="nav-text">{t('TAB_DATA', 'データ管理')}</span>
          </NavLink>
          <NavLink to="/list" onClick={(e) => handleNavClick(e, '/list')} className={({ isActive }) => `nav - link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''} `} title={t('TAB_LIST', '所持AFリスト')}>
            <List size={22} style={{ flexShrink: 0 }} />
            <span className="nav-text">{t('TAB_LIST', '所持AFリスト')}</span>
          </NavLink>
          <NavLink to="/grid" onClick={(e) => handleNavClick(e, '/grid')} className={({ isActive }) => `nav - link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''} `} title={t('TAB_GRID', 'ゲーム内UI')}>
            <Grid size={22} style={{ flexShrink: 0 }} />
            <span className="nav-text">{t('TAB_GRID', 'ゲーム内UI')}</span>
          </NavLink>
          <NavLink to="/criteria" onClick={(e) => handleNavClick(e, '/criteria')} className={({ isActive }) => `nav - link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''} `} title={t('TAB_CRITERIA', '確保AF条件')}>
            <Filter size={22} style={{ flexShrink: 0 }} />
            <span className="nav-text">{t('TAB_CRITERIA', '確保AF条件')}</span>
          </NavLink>
          <NavLink to="/settings" onClick={(e) => handleNavClick(e, '/settings')} className={({ isActive }) => `nav - link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''} `} title={t('TAB_SETTINGS', '設定')}>
            <SettingsIcon size={22} style={{ flexShrink: 0 }} />
            <span className="nav-text">{t('TAB_SETTINGS', '設定')}</span>
          </NavLink>
          <NavLink to="/help" onClick={(e) => handleNavClick(e, '/help')} className={({ isActive }) => `nav - link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''} `} title={language === 'en' ? 'How to use' : '使い方'}>
            <BookOpen size={22} style={{ flexShrink: 0 }} />
            <span className="nav-text">{language === 'en' ? 'How to use' : '使い方'}</span>
          </NavLink>
        </nav>
        {/* Quick Action Buttons */}
        <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: collapsed ? 'center' : 'stretch' }}>
          {!collapsed && <div style={{ fontSize: 'calc(var(--font-size-sub) * 0.87)', color: 'var(--text-muted)', marginBottom: '0.3rem', letterSpacing: '0.05em' }}>{language === 'en' ? 'Quick Calc' : 'クイック計算'}</div>}
          <button
            onClick={guardedKeepCalc}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: '0.5rem',
              padding: collapsed ? '0.6rem 0' : '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.4)',
              background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', cursor: 'pointer',
              fontSize: 'var(--font-size-sub)', fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap',
              width: collapsed ? '40px' : 'auto', height: collapsed ? '40px' : 'auto',
            }}
            title={language === 'en' ? 'Calculate Keep Flags' : '確保フラグを一括計算'}
          >
            <ShieldCheck size={18} style={{ flexShrink: 0 }} /> {!collapsed && (language === 'en' ? 'Keep Flags' : '確保フラグ計算')}
          </button>
          <button
            onClick={guardedDiscardCalc}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: '0.5rem',
              padding: collapsed ? '0.6rem 0' : '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', cursor: 'pointer',
              fontSize: 'var(--font-size-sub)', fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap',
              width: collapsed ? '40px' : 'auto', height: collapsed ? '40px' : 'auto',
            }}
            title={language === 'en' ? 'Calculate Discard Flags' : '廃棄フラグを一括計算'}
          >
            <Trash2 size={18} style={{ flexShrink: 0 }} /> {!collapsed && (language === 'en' ? 'Discard Flags' : '廃棄フラグ計算')}
          </button>
        </div>
      </aside>

      <main className="main-content" ref={mainRef} onScroll={handleScroll} style={{ position: 'relative', overflowX: 'hidden' }}>
        <TabZoomOverlay design={currentDesign} tabZoom={currentTabZoom} onAdjustZoom={handleAdjustTabZoom} />
        <div style={{ transform: `scale(${currentTabZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s', minHeight: '100%' }}>
          {(location.pathname === '/' || location.pathname === '/data') && <Navigate to="/data" replace />}
          {currentDesign.enableTabPersistence ? (
            <>
              <div style={{ display: location.pathname === '/data' ? 'block' : 'none' }}><DataTab /></div>
              <div style={{ display: location.pathname === '/list' ? 'block' : 'none' }}><ListTab /></div>
              <div style={{ display: location.pathname === '/grid' ? 'block' : 'none' }}><GridTab /></div>
              <div style={{ display: location.pathname === '/criteria' ? 'block' : 'none' }}><CriteriaTab /></div>
              <div style={{ display: location.pathname === '/settings' ? 'block' : 'none' }}><SettingsTab /></div>
              <div style={{ display: location.pathname === '/help' ? 'block' : 'none' }}><HelpTab /></div>
            </>
          ) : (
            <>
              {location.pathname === '/data' && <DataTab />}
              {location.pathname === '/list' && <ListTab />}
              {location.pathname === '/grid' && <GridTab />}
              {location.pathname === '/criteria' && <CriteriaTab />}
              {location.pathname === '/settings' && <SettingsTab />}
              {location.pathname === '/help' && <HelpTab />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}


function App() {
  return (
    <HashRouter>
      <AppInner />
    </HashRouter>
  );
}

export default App;

