import React, { type CSSProperties } from 'react';
import { resolveSpriteAsset } from './registry.ts';

export interface SpriteIconProps {
  id?: string | null;
  emoji?: string | null;
  spriteSrc?: string | null;
  alt?: string;
  title?: string;
  className?: string;
  sizeClassName?: string;
  style?: CSSProperties;
  testId?: string;
}

/**
 * Unified icon renderer across maps, inventory, tooltips, modals, and flying loot.
 * Renders a registered SVG sprite, a quality raster/URL image asset, or falls back to emoji.
 */
export function SpriteIcon({
  id,
  emoji,
  spriteSrc,
  alt,
  title,
  className = '',
  sizeClassName = 'w-[1.15em] h-[1.15em]',
  style,
  testId
}: SpriteIconProps) {
  const asset = resolveSpriteAsset(id, spriteSrc);

  if (!asset) {
    return (
      <span
        data-testid={testId}
        data-sprite-id={id || undefined}
        title={title}
        className={className}
        style={style}
      >
        {emoji ?? ''}
      </span>
    );
  }

  const label = alt || title || (asset.kind === 'svg' ? asset.label : asset.alt) || id || undefined;

  return (
    <span
      data-testid={testId}
      data-sprite-id={id || undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      title={title}
      className={`inline-flex items-center justify-center align-middle leading-none select-none shrink-0 ${sizeClassName} ${className}`}
      style={style}
    >
      {asset.kind === 'image' ? (
        <img
          src={asset.src}
          srcSet={asset.srcSet}
          alt={label || ''}
          decoding="async"
          draggable={false}
          className={`w-full h-full object-contain pointer-events-none select-none ${asset.className || ''}`}
        />
      ) : (
        <asset.Component className="w-full h-full overflow-visible" />
      )}
    </span>
  );
}

export interface SvgEmbeddedSpriteProps {
  id?: string | null;
  emoji?: string | null;
  spriteSrc?: string | null;
  x: number;
  y: number;
  size: number;
  className?: string;
}

/**
 * Renders a SpriteIcon cleanly inside an existing `<svg>` canvas (e.g. GiantClamSVG, SunkenVaultSVG)
 * without relying on `<foreignObject>`.
 */
export function SvgEmbeddedSprite({
  id,
  emoji,
  spriteSrc,
  x,
  y,
  size,
  className = ''
}: SvgEmbeddedSpriteProps) {
  const asset = resolveSpriteAsset(id, spriteSrc);
  const left = x - size / 2;
  const top = y - size / 2;

  if (!asset) {
    return (
      <text
        x={x}
        y={y + size * 0.34}
        textAnchor="middle"
        fontSize={size}
        className={className}
      >
        {emoji ?? ''}
      </text>
    );
  }

  if (asset.kind === 'image') {
    return (
      <image
        href={asset.src}
        x={left}
        y={top}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        className={className}
      />
    );
  }

  return (
    <svg x={left} y={top} width={size} height={size} className={className} overflow="visible">
      <asset.Component className="w-full h-full overflow-visible" />
    </svg>
  );
}

export { SPRITE_REGISTRY, resolveSpriteAsset, hasCustomSprite } from './registry.ts';
export type { SpriteAsset, SvgSpriteAsset, ImageSpriteAsset, SvgSpriteProps } from './types.ts';
