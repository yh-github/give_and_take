import { CAVE_ENTITIES, CAVE_ITEMS } from '../cave_shared/data.ts';
import type { EntityTemplate, ItemDefinition } from '../../types/index.ts';

/**
 * Items and Entity Templates for `deep_cave` ("The Abyssal Descent").
 * Re-exported from `cave_shared` so both cave realms share art & item definitions.
 */
export const items: ItemDefinition[] = CAVE_ITEMS;
export const entities: EntityTemplate[] = CAVE_ENTITIES;
