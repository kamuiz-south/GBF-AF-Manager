import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { db } from './db'
import type { Settings } from './types'
import { useAppStore } from './store/useAppStore'
import { applyDesignToDocument, resolveDesign } from './utils/applyDesign'

const BOOT_SPLASH_MIN_VISIBLE_MS = 160
const BOOT_SPLASH_REMOVE_DELAY_MS = 200
const SETTINGS_LOAD_TIMEOUT_MS = 3000
const bootStartedAt = performance.now()

async function loadInitialSettings(): Promise<Settings | undefined> {
  try {
    return await Promise.race([
      db.settings.get('global').catch((error) => {
        console.error('Failed to load settings before startup:', error)
        return undefined
      }),
      new Promise<undefined>((resolve) => {
        window.setTimeout(() => resolve(undefined), SETTINGS_LOAD_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    console.error('Failed to load settings before startup:', error)
    return undefined
  }
}

function dismissBootSplash() {
  const splash = document.getElementById('boot-splash')
  if (!splash) return

  splash.classList.add('boot-splash--hidden')
  window.setTimeout(() => splash.remove(), BOOT_SPLASH_REMOVE_DELAY_MS)
}

function scheduleBootSplashDismiss() {
  const elapsed = performance.now() - bootStartedAt
  const remaining = Math.max(0, BOOT_SPLASH_MIN_VISIBLE_MS - elapsed)

  window.setTimeout(() => {
    // rAF is paused in hidden tabs, so only use it while the page is visible.
    if (document.visibilityState === 'visible') {
      requestAnimationFrame(dismissBootSplash)
    } else {
      dismissBootSplash()
    }
  }, remaining)
}

async function bootstrap() {
  const settings = await loadInitialSettings()

  // Seed the shared store before React mounts so components that read
  // language/theme from it render with the persisted values immediately.
  useAppStore.getState().setGlobalSettings(settings ?? null)

  // Apply the persisted design before React mounts so the first painted frame
  // already has the correct theme, zoom, and text sizes.
  applyDesignToDocument(resolveDesign(settings?.design))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App initialSettings={settings} />
    </StrictMode>,
  )

  scheduleBootSplashDismiss()
}

void bootstrap()
