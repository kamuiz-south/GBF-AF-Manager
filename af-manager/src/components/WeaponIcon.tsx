import React from 'react';
import { isWeaponKind } from './weaponKinds';
import { WEAPON_ASSETS } from './weaponAssets';

interface WeaponIconProps {
  kind: string | number;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  /** Accessible name. When omitted the icon is treated as decorative. */
  label?: string;
}

const WeaponIcon: React.FC<WeaponIconProps> = ({
  kind,
  size = 19,
  className = '',
  style = {},
  label,
}) => {
  const kindKey = String(kind);
  if (!isWeaponKind(kindKey)) return null;

  // v1.1.3 ships no bundled weapon artwork. A kind without an image asset is
  // intentionally rendered as nothing.
  const assetUrl = WEAPON_ASSETS[kindKey];
  if (!assetUrl) return null;

  const sizeValue = typeof size === 'number' ? `${size}px` : size;
  const accessibilityProps = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const };
  const maskUrl = `url("${assetUrl}")`;

  return (
    <span
      className={className}
      {...accessibilityProps}
      style={{
        width: sizeValue,
        height: sizeValue,
        display: 'inline-block',
        verticalAlign: 'middle',
        backgroundColor: 'currentColor',
        maskImage: maskUrl,
        WebkitMaskImage: maskUrl,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        ...style,
      }}
    />
  );
};

export default WeaponIcon;
