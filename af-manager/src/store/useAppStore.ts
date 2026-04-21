import { create } from 'zustand';
import type { AppArtifact, Settings } from '../types';

export interface ToastItem {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

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

    /** Toast notification state */
    toasts: ToastItem[];
    showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
    hideToast: (id: string) => void;
}

const SIDEBAR_COLLAPSED_KEY = 'af-manager-sidebar-collapsed';

export const useAppStore = create<AppState>((set, get) => ({
    globalSettings: null,
    setGlobalSettings: (settings) => set({ globalSettings: settings }),

    selectedArtifact: null,
    setSelectedArtifact: (artifact) => set({ selectedArtifact: artifact }),

    settingsDirty: false,
    setSettingsDirty: (dirty) => set({ settingsDirty: dirty }),

    sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
    setSidebarCollapsed: (collapsed) => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
        set({ sidebarCollapsed: collapsed });
    },

    toasts: [],
    showToast: (message, type = 'info', duration?) => {
        const state = get();
        const settings = state.globalSettings;
        const durationMs = duration ?? ((settings?.notificationDuration ?? 3) * 1000);
        const maxCount = settings?.notificationMaxCount ?? 1;

        const id = Math.random().toString(36).substr(2, 9);

        set((prev) => {
            const current = prev.toasts;
            // If already at max, remove oldest (last in array)
            const trimmed = current.length >= maxCount
                ? current.slice(0, maxCount - 1)
                : current;
            return { toasts: [{ id, message, type }, ...trimmed] };
        });

        if (durationMs > 0) {
            setTimeout(() => {
                useAppStore.getState().hideToast(id);
            }, durationMs);
        }
    },
    hideToast: (id: string) => {
        set((prev) => ({ toasts: prev.toasts.filter(t => t.id !== id) }));
    },
}));
