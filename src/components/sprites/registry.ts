import type { SpriteAsset } from './types.ts';
import { LanternfishSprite } from './items/LanternfishSprite.tsx';

/**
 * Central sprite registry mapping item/entity IDs (or explicit `spriteId` keys)
 * to either inline React SVG components (`kind: 'svg'`) or raster/external image assets (`kind: 'image'`).
 * Anything not registered here automatically falls back to its emoji.
 */
export const SPRITE_REGISTRY: Record<string, SpriteAsset> = {
  rope: {
    kind: 'image',
    src: './sprites/rope.png',
    alt: 'Rope'
  },
  blowfish: {
    kind: 'svg',
    Component: LanternfishSprite,
    label: 'Lanternfish'
  },
  sea_witch: {
    kind: 'image',
    src: './sprites/sea_witch.png',
    alt: 'Sea Witch'
  }
};

export function resolveSpriteAsset(id?: string | null, spriteSrc?: string | null): SpriteAsset | null {
  if (spriteSrc) {
    return {
      kind: 'image',
      src: spriteSrc,
      alt: id || undefined
    };
  }
  if (!id) return null;
  return SPRITE_REGISTRY[id] || null;
}

export function hasCustomSprite(id?: string | null, spriteSrc?: string | null): boolean {
  return Boolean(resolveSpriteAsset(id, spriteSrc));
}
