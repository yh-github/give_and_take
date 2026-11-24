import type {
  EntityTemplate,
  ItemDefinition,
  MapNode,
  SceneryNode
} from '../../types/index.ts';

// === Ship Wreck: Items ===
export const items: ItemDefinition[] = [
  // Free Salvage Pickups (seabed & flooded holds)
  { id: 'sea_kelp', name: 'Glowing Kelp', emoji: '🌿' },
  { id: 'starfish', name: 'Starfish', emoji: '⭐' },
  { id: 'doubloon', name: 'Gold Doubloon', emoji: '🪙' },
  { id: 'spyglass', name: 'Brass Spyglass', emoji: '🔭' },

  // Shipwreck Relics & Treasures
  { id: 'pearl', name: 'Pearl', emoji: '⚪' },
  { id: 'shell', name: 'Conch Shell', emoji: '🐚' },
  { id: 'anchor_key', name: 'Anchor Key', emoji: '🗝️' },
  { id: 'compass', name: 'Compass', emoji: '🧭' },
  { id: 'chalice', name: 'Chalice', emoji: '🏆' },
  { id: 'trident', name: 'Trident', emoji: '🔱' },
  { id: 'abyssal_pearl', name: 'Abyssal Pearl', emoji: '🔮' },
  { id: 'gem', name: 'Gem', emoji: '💎' },

  // Final Victory Treasure
  { id: 'crown', name: 'Sunken Crown', emoji: '👑' }
];

// === Ship Wreck: Entity Templates ===
export const entities: EntityTemplate[] = [
  { id: 'sea_witch', name: 'Sea Witch', emoji: '😈', allowedReqs: ['pearl', 'anchor_key', 'compass', 'chalice', 'trident', 'gem', 'abyssal_pearl'] },
  { id: 'clam', name: 'Giant Clam', emoji: '🐚', allowedReqs: ['sea_kelp', 'starfish', 'doubloon', 'spyglass', 'shell', 'pearl'] },
  { id: 'crab', name: 'Hermit Crab', emoji: '🦀', allowedReqs: ['sea_kelp', 'starfish', 'doubloon', 'spyglass', 'shell', 'pearl'] },
  { id: 'octopus', name: 'Octopus', emoji: '🐙', allowedReqs: ['sea_kelp', 'starfish', 'doubloon', 'spyglass', 'shell', 'pearl', 'trident'] },
  { id: 'captains_chest', name: "Captain's Treasure", emoji: '🧰', allowedReqs: [] }
];

// === Ship Wreck: Map Layout (2D Crashed Galleon, 100 x 100) ===
// Zone 1: Exterior Seabed & Sand Trench (left & beneath keel)
// Zone 2: Shattered Stern & Cargo Bilge
// Zone 3: Midship Gun Deck & Hold
// Zone 4: Flooded Forepeak Beneath the Waterline
// Zone 5: Windowless Bow Air Pocket (requires Human)
export const mapNodes: MapNode[] = [
  // Zone 1: Seabed Exterior
  { x: 11, y: 69, zone: 1, id: 'sea_witch' },
  { x: 20, y: 54, zone: 1, isPreset: 'kelp' },
  { x: 46, y: 90, zone: 1, isPreset: 'starfish' },

  // Zone 2: Shattered Stern & Cargo Bilge
  { x: 37, y: 69, zone: 2, isClamNode: true },
  { x: 46, y: 56, zone: 2 },
  { x: 47, y: 73, zone: 2, isPreset: 'doubloon' },

  // Zone 3: Midship Gun Deck & Hold
  { x: 59, y: 44, zone: 3, isClamNode: true },
  { x: 64, y: 63, zone: 3 },
  { x: 55, y: 65, zone: 3, isPreset: 'spyglass' },

  // Zone 4: Flooded Forepeak Directly Below Air Pocket
  { x: 77, y: 46, zone: 4, isClamNode: true },
  { x: 85, y: 40, zone: 4 },

  // Zone 5: Sealed Windowless Bow Air Pocket
  { x: 81, y: 23, zone: 5, isGoalNode: true, requiresHuman: true }
];

// === Ship Wreck: Scenery ===
export const sceneryNodes: SceneryNode[] = [
  { x: 5, y: 88, e: '🪸', s: 'text-4xl', z: 20 },
  { x: 27, y: 92, e: '🪸', s: 'text-3xl', z: 20 },
  { x: 64, y: 86, e: '🪸', s: 'text-4xl', z: 20 },
  { x: 95, y: 64, e: '🪸', s: 'text-3xl', z: 20 }
];
