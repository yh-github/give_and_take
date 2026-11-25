import type { ComponentType } from 'react';

export interface SvgSpriteProps {
  className?: string;
  title?: string;
}

export interface SvgSpriteAsset {
  kind: 'svg';
  Component: ComponentType<SvgSpriteProps>;
  label?: string;
}

export interface ImageSpriteAsset {
  kind: 'image';
  src: string;
  srcSet?: string;
  alt?: string;
  className?: string;
}

export type SpriteAsset = SvgSpriteAsset | ImageSpriteAsset;
