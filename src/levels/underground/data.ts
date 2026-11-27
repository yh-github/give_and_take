import mapNodesData from './mapNodes.json';
import { CAVE_ENTITIES, CAVE_ITEMS } from '../cave_shared/data.ts';
import type {
  EntityTemplate,
  ItemDefinition,
  MapNode,
  SceneryNode
} from '../../types/index.ts';

// === Underground: Items ===
export const items: ItemDefinition[] = CAVE_ITEMS;

// === Underground: Entity Templates ===
export const entities: EntityTemplate[] = CAVE_ENTITIES;

export const mapNodes: MapNode[] = mapNodesData;

// === Underground: Scenery ===
export const sceneryNodes: SceneryNode[] = [];
