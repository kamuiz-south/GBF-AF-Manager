import { DEFAULT_DESIGN, type AppDesignSettings } from '../types';

const DEFAULT_FONT_FAMILY = "'Inter', 'Segoe UI', system-ui, sans-serif";

/** Key shared with the inline boot script in index.html. */
export const THEME_CACHE_KEY = 'af-manager-theme';

export function resolveDesign(design?: Partial<AppDesignSettings>): AppDesignSettings {
    return { ...DEFAULT_DESIGN, ...(design ?? {}) };
}

/**
 * Apply design settings directly to the document.
 *
 * This runs before the first React render during startup, and again whenever
 * the live settings record changes. Keeping it outside React prevents the
 * initial frame from flashing the default theme/zoom.
 */
export function applyDesignToDocument(design: AppDesignSettings): void {
    const root = document.documentElement;

    root.style.setProperty('--font-size-main', `${design.fontSizeMain}px`);
    root.style.setProperty('--font-size-sub', `${design.fontSizeSub}px`);
    root.style.setProperty('--font-family-main', design.fontFamilyMain || DEFAULT_FONT_FAMILY);
    root.style.setProperty('--font-family-sub', design.fontFamilySub || DEFAULT_FONT_FAMILY);
    root.style.setProperty('--app-zoom', String(design.zoom));

    const isLight = design.theme === 'light';
    root.dataset.theme = design.theme;
    document.body.classList.toggle('theme-light', isLight);

    // Remember the theme so the inline splash can use the right background
    // before IndexedDB is available.
    try {
        localStorage.setItem(THEME_CACHE_KEY, design.theme);
    } catch {
        // localStorage can be unavailable; the splash falls back to dark.
    }
}
