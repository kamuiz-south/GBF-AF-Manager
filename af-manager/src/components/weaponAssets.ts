import { isWeaponKind, type WeaponKind } from './weaponKinds';

/**
 * Drop-in weapon image assets.
 *
 * Add files named `1.svg` ... `10.svg` (or .png / .webp) under
 * `src/assets/weapons/`. Vite picks them up automatically; no code change is
 * needed. A kind without an image is intentionally not rendered.
 *
 * Images are treated as alpha masks and tinted with the current text color.
 * Use a transparent background and a monochrome silhouette.
 */
const assetModules = import.meta.glob('../assets/weapons/*.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const EXTENSION_PRIORITY: Record<string, number> = {
  '.svg': 0,
  '.webp': 1,
  '.png': 2,
};

const candidates = new Map<WeaponKind, { url: string; priority: number }>();

for (const [filePath, url] of Object.entries(assetModules)) {
  const match = filePath.match(/\/([^/]+)\.(svg|png|webp)$/i);
  if (!match) continue;

  const kind = match[1];
  if (!isWeaponKind(kind)) continue;

  const extension = `.${match[2].toLowerCase()}`;
  const priority = EXTENSION_PRIORITY[extension] ?? Number.MAX_SAFE_INTEGER;
  const current = candidates.get(kind);

  if (!current || priority < current.priority) {
    candidates.set(kind, { url, priority });
  }
}

export const WEAPON_ASSETS: Partial<Record<WeaponKind, string>> = Object.fromEntries(
  [...candidates.entries()].map(([kind, { url }]) => [kind, url]),
);
