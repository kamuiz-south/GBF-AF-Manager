import { create } from 'zustand';
import type { AppArtifact, Settings } from '../types';

interface AppState {
    globalSettings: Settings | null;
    setGlobalSettings: (settings: Settings | null) => void;

    selectedArtifact: AppArtifact | null;
    setSelectedArtifact: (artifact: AppArtifact | null) => void;

    /** True when SettingsTab has unsaved changes */
    settingsDirty: boolean;
    setSettingsDirty: (dirty: boolean) => void;

    /** Sidebar UI state */
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
    globalSettings: null,
    setGlobalSettings: (settings) => set({ globalSettings: settings }),

    selectedArtifact: null,
    setSelectedArtifact: (artifact) => set({ selectedArtifact: artifact }),

    settingsDirty: false,
    setSettingsDirty: (dirty) => set({ settingsDirty: dirty }),

    sidebarCollapsed: false,
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
