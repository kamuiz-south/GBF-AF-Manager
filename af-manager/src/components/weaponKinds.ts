export type WeaponKind = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

export const WEAPON_KINDS: readonly WeaponKind[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
];

const WEAPON_KIND_SET = new Set<string>(WEAPON_KINDS);

export function isWeaponKind(value: string): value is WeaponKind {
  return WEAPON_KIND_SET.has(value);
}
