import type {
  EntityTemplate,
  ItemDefinition,
  MapNode,
  SceneryNode
} from '../../types/index.ts';

// === Underwater: Items ===
// 1) Fish (only caught by swimming/timing ring; never given as creature rewards)
// 2) Human trinkets (only traded from surface roaming boats for fish)
// 3) Mermaid magic (only given by circling mermaids for human trinkets)
// 4) Seabed/shipwreck salvage & relics (only from seabed pickups & deep creatures)
export const items: ItemDefinition[] = [
  { id: 'fish', name: 'Fish', emoji: '🐟' },
  { id: 'gold_fish', name: 'Goldfish', emoji: '🐠' },
  { id: 'blowfish', name: 'Lanternfish', emoji: '🐡' },

  { id: 'comb', name: 'Dinglehopper', emoji: '🍴' },
  { id: 'boot', name: 'Old Boot', emoji: '🥾' },
  { id: 'mirror', name: 'Looking Glass', emoji: '🪞' },
  { id: 'locket', name: 'Golden Locket', emoji: '📿' },
  { id: 'pocket_watch', name: 'Pocket Watch', emoji: '🧭' },
  { id: 'music_box', name: 'Music Box', emoji: '🎻' },

  { id: 'mermaid_voice', name: 'Mermaid Song', emoji: '🎵' },

  { id: 'sea_kelp', name: 'Glowing Kelp', emoji: '🌿' },
  { id: 'starfish', name: 'Starfish', emoji: '⭐' },
  { id: 'doubloon', name: 'Gold Doubloon', emoji: '🪙' },
  { id: 'shell', name: 'Conch Shell', emoji: '🐚' },
  { id: 'anchor_key', name: 'Anchor Key', emoji: '🗝️' },
  { id: 'pearl', name: 'Pearl', emoji: '⚪' },
  { id: 'abyssal_pearl', name: 'Abyssal Pearl', emoji: '🔮' },
  { id: 'trident', name: 'Trident', emoji: '🔱' },
  { id: 'gem', name: 'Gem', emoji: '💎' },
  { id: 'crown', name: 'Sunken Crown', emoji: '👑' }
];

// === Underwater: Entity Templates ===
export const entities: EntityTemplate[] = [
  { id: 'mermaid_teal', name: 'Teal Mermaid', emoji: '🧜‍♀️', color: '#2dd4bf', allowedReqs: ['comb', 'boot', 'mirror', 'locket', 'pocket_watch', 'music_box'] },
  { id: 'mermaid_red', name: 'Red Mermaid', emoji: '🧜‍♀️', color: '#fb7185', allowedReqs: ['comb', 'boot', 'mirror', 'locket', 'pocket_watch', 'music_box'] },
  { id: 'mermaid_purple', name: 'Purple Mermaid', emoji: '🧜‍♀️', color: '#a855f7', allowedReqs: ['comb', 'boot', 'mirror', 'locket', 'pocket_watch', 'music_box'] },
  { id: 'dolphin', name: 'Dolphin', emoji: '🐬', allowedReqs: ['fish', 'gold_fish', 'blowfish'], roamClass: 'elevator' },
  { id: 'sea_witch', name: 'Sea Witch', emoji: '😈', allowedReqs: ['mermaid_voice'] },
  { id: 'clam', name: 'Giant Clam', emoji: '🐚', allowedReqs: ['sea_kelp', 'starfish', 'doubloon', 'shell', 'pearl', 'anchor_key'] },
  { id: 'crab', name: 'Hermit Crab', emoji: '🦀', allowedReqs: ['sea_kelp', 'starfish', 'doubloon', 'shell', 'pearl'] },
  { id: 'octopus', name: 'Octopus', emoji: '🐙', allowedReqs: ['sea_kelp', 'starfish', 'doubloon', 'shell', 'pearl', 'trident'] },
  { id: 'sunken_vault', name: 'Sunken Galleon Vault', emoji: '🧰', allowedReqs: ['pearl', 'anchor_key', 'shell', 'trident', 'gem'] }
];

// === Underwater: Interactive Reef Kelp Habitats (Zones 1 & 2) ===
export interface ReefKelpHabitat {
  id: string;
  x: number;
  y: number;
  fishType: 'fish' | 'gold_fish' | 'blowfish';
}

export const reefKelpHabitats: readonly ReefKelpHabitat[] = [
  { id: 'kelp_shallow', x: 11, y: 26, fishType: 'fish' },
  { id: 'kelp_mid', x: 89, y: 39, fishType: 'gold_fish' },
  { id: 'kelp_deep', x: 11, y: 52, fishType: 'blowfish' },
  { id: 'kelp_abyss', x: 90, y: 80, fishType: 'blowfish' }
];

// === Underwater: Map Layout ===
export const mapNodes: MapNode[] = [
  /* Zone 1: Sunlit Shallows -> Dolphin shuttle + Shallow Circling Mermaid */
  { x: 50, y: 22, zone: 1 },
  { x: 30, y: 29, zone: 1, orbit: { rx: 22, ry: 8, duration: 7.5, delay: 0 } },
  /* Zone 2: Twilight Reef -> Mid & Deep Circling Mermaids + Sea Witch Grotto */
  { x: 70, y: 42, zone: 2, orbit: { rx: 24, ry: 9, duration: 8.5, delay: -2.2 } },
  { x: 32, y: 53, zone: 2, orbit: { rx: 22, ry: 8, duration: 9.2, delay: -4.5 } },
  { x: 50, y: 63, zone: 2, id: 'sea_witch' },
  /* Zone 3: Abyssal Trench & Seabed -> Harvestable Presets, Clams, Crab, Octopus, Sunken Vault */
  { x: 18, y: 76, zone: 3, isPreset: 'kelp' },
  { x: 82, y: 78, zone: 3, isPreset: 'starfish' },
  { x: 20, y: 85, zone: 3, isPreset: 'doubloon' },
  { x: 82, y: 87, zone: 3, isPreset: 'kelp' },
  { x: 36, y: 81, zone: 3 },
  { x: 68, y: 82, zone: 3 },
  { x: 22, y: 93, zone: 3, isClamNode: true },
  { x: 78, y: 93, zone: 3, isClamNode: true },
  { x: 36, y: 90, zone: 3, isClamNode: true },
  { x: 50, y: 95, zone: 3, isGoalNode: true }
];

// === Underwater: Scenery ===
export const sceneryNodes: SceneryNode[] = [
  { x: 8, y: 21, e: '🪸', s: 'text-4xl', z: 20 },
  { x: 91, y: 29, e: '🪸', s: 'text-5xl', z: 20 },
  { x: 7, y: 47, e: '🪸', s: 'text-5xl', z: 20 },
  { x: 92, y: 54, e: '🪸', s: 'text-4xl', z: 20 },
  { x: 9, y: 66, e: '🪸', s: 'text-3xl', z: 20 },
  { x: 90, y: 67, e: '🪸', s: 'text-3xl', z: 20 }
];
