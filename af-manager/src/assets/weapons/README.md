# Weapon icon replacement

v1.1.3 and later use original hand-drawn weapon icons. No external weapon
icon source is bundled with the app.

## How to add icons

Drop image files into this folder using the weapon kind number as the filename:

| File | Weapon |
|---|---|
| `1.svg` / `1.png` | Sword |
| `2.svg` / `2.png` | Dagger |
| `3.svg` / `3.png` | Spear |
| `4.svg` / `4.png` | Axe |
| `5.svg` / `5.png` | Staff |
| `6.svg` / `6.png` | Gun |
| `7.svg` / `7.png` | Fist |
| `8.svg` / `8.png` | Bow |
| `9.svg` / `9.png` | Harp |
| `10.svg` / `10.png` | Katana |

Supported extensions: `.svg`, `.png`, `.webp`. If several files exist for the
same kind, SVG wins, then WebP, then PNG. Use one file per kind.

No code change is required. Vite discovers the files automatically. A kind
without an image is intentionally not displayed.

## Recommended source format

- **SVG preferred.** It stays sharp at every size and has the smallest file size.
- If using raster: **512 x 512 px** recommended, **256 x 256 px minimum**.
  The largest current on-screen size is about 52 CSS px; 512 px covers 4x DPI
  and leaves room for future layouts.
- Square canvas, transparent background, tightly centered artwork with about
  4-8% padding so strokes do not clip at the edges.
- **Monochrome silhouette** (white or black is fine). The app applies the image
  as a CSS mask and tints it with the current text color, so the artwork's own
  color is ignored. Do not include a background rectangle or a colored frame.
- Match the existing visual weight: simple solid shapes, no fine text, no
  gradients or shadows that disappear when masked.
- Do not use the actual in-game image files. These should be original drawings
  inspired by the official icons, not copied game assets.

If full-color icons are wanted instead of tinted silhouettes, the renderer needs
a small mode change; ask before preparing full-color artwork.
