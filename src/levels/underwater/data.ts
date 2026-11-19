import type {
  EntityTemplate,
  ItemDefinition,
  MapNode,
  SceneryNode
} from '../../types/index.ts';

// === Underwater: Items ===
export const items: ItemDefinition[] = [
  { id: 'pearl', name: 'Pearl', emoji: '⚪' }, { id: 'shell', name: 'Shell', emoji: '🐚' },
  { id: 'starfish', name: 'Starfish', emoji: '⭐' }, { id: 'trident', name: 'Trident', emoji: '🔱' },
  { id: 'comb', name: 'Dinglehopper', emoji: '🍴' }, { id: 'mirror', name: 'Looking Glass', emoji: '🪞' },
  { id: 'boot', name: 'Old Boot', emoji: '🥾' }, { id: 'locket', name: 'Golden Locket', emoji: '📿' },
  { id: 'fish', name: 'Fish', emoji: '🐟' }, { id: 'gold_fish', name: 'Goldfish', emoji: '🐠' },
  { id: 'crown', name: 'Glowing Crown', emoji: '👑' }, { id: 'gem', name: 'Gem', emoji: '💎' },
  { id: 'crystal', name: 'Crystal', emoji: '🔮' }
];

// === Underwater: Entity Templates ===
export const entities: EntityTemplate[] = [
  { id: 'mermaid_teal', name: 'Teal Mermaid', emoji: '🧜‍♀️', color: '#2dd4bf', allowedReqs: ['comb', 'mirror', 'boot', 'starfish', 'locket'] },
  { id: 'mermaid_red', name: 'Red Mermaid', emoji: '🧜‍♀️', color: '#fb7185', allowedReqs: ['comb', 'mirror', 'boot', 'starfish', 'locket'] },
  { id: 'mermaid_purple', name: 'Purple Mermaid', emoji: '🧜‍♀️', color: '#a855f7', allowedReqs: ['comb', 'mirror', 'boot', 'starfish', 'locket'] },
  { id: 'mermaid_green', name: 'Green Mermaid', emoji: '🧜‍♀️', color: '#4ade80', allowedReqs: ['comb', 'mirror', 'boot', 'starfish', 'locket'] },
  { id: 'octopus', name: 'Octopus', emoji: '🐙', allowedReqs: ['trident', 'pearl', 'starfish', 'locket'] },
  { id: 'crab', name: 'Crab', emoji: '🦀', allowedReqs: ['shell', 'pearl', 'boot', 'comb'] },
  { id: 'dolphin', name: 'Dolphin', emoji: '🐬', allowedReqs: ['fish', 'gold_fish'], roamClass: 'elevator' },
  { id: 'clam', name: 'Giant Clam', emoji: '🐚', allowedReqs: ['pearl', 'shell', 'starfish', 'comb', 'mirror'] },
  { id: 'sea_witch', name: 'Sea Witch', emoji: '😈', allowedReqs: ['pearl', 'locket', 'trident'] }
];

// === Underwater: Map Layout ===
export const mapNodes: MapNode[] = [
  /* Zone 1: Sunlit Shallows -> Dolphin station + 2 Reef Traders + Shallow Bubble Vent */
  { x: 26, y: 27, zone: 1 }, { x: 74, y: 27, zone: 1 }, { x: 50, y: 22, zone: 1 },
  { x: 24, y: 40, zone: 1, isPreset: 'bubble_vent', isVent: true },
  /* Zone 2: Twilight Reef -> 3 Mermaids + Deep Reef Bubble Vent + Sea Witch Trench Gate */
  { x: 26, y: 50, zone: 2 }, { x: 74, y: 50, zone: 2 }, { x: 42, y: 59, zone: 2 },
  { x: 75, y: 59, zone: 2, isPreset: 'bubble_vent', isVent: true },
  { x: 50, y: 70, zone: 2, id: 'sea_witch', isGatekeeper: true },
  /* Zone 3: Abyssal Trench & Seabed -> Clams + Crabs/Octopus + Goal Clam */
  { x: 50, y: 80, zone: 3, isClamNode: true },
  { x: 36, y: 86, zone: 3 }, { x: 70, y: 86, zone: 3 },
  { x: 24, y: 94, zone: 3, isClamNode: true }, { x: 50, y: 95, zone: 3, isGoalNode: true }, { x: 76, y: 94, zone: 3, isClamNode: true }
];

// === Underwater: Scenery ===
export const sceneryNodes: SceneryNode[] = [
  { x: 9, y: 24, e: '🪸', s: 'text-4xl', z: 20 }, { x: 91, y: 28, e: '🪸', s: 'text-5xl', z: 20 },
  { x: 7, y: 48, e: '🪸', s: 'text-5xl', z: 20 }, { x: 92, y: 53, e: '🪸', s: 'text-4xl', z: 20 },
  { x: 10, y: 64, e: '🪸', s: 'text-3xl', z: 20 }, { x: 90, y: 66, e: '🪸', s: 'text-3xl', z: 20 },
  { x: 6, y: 56, e: '🌱', s: 'text-3xl', z: 20 }, { x: 94, y: 60, e: '🌱', s: 'text-3xl', z: 20 },
];
