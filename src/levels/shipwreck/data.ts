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

// === Ship Wreck: Map Layout (Zones 1-5) ===
// Zone 1: Seabed outside the wreck (y: 72-95)
// Zone 2: Deck 2 — Cargo Hold & Bilge (y: 58-80)
// Zone 3: Deck 3 — Gun Deck & Galley (y: 41-58)
// Zone 4: Deck 4 — Upper Crew Quarters (y: 25-41)
// Zone 5: Captain's Cabin Air Pocket (y: 8-25, requires Human)
export const mapNodes: MapNode[] = [
  // Zone 1: Seabed
  { x: 18, y: 88, zone: 1, id: 'sea_witch' },
  { x: 12, y: 74, zone: 1, isPreset: 'kelp' },
  { x: 78, y: 90, zone: 1, isPreset: 'starfish' },

  // Zone 2: Cargo Hold & Bilge
  { x: 40, y: 69, zone: 2, isClamNode: true },
  { x: 70, y: 68, zone: 2 },
  { x: 56, y: 75, zone: 2, isPreset: 'doubloon' },

  // Zone 3: Gun Deck & Galley
  { x: 34, y: 49, zone: 3, isClamNode: true },
  { x: 68, y: 49, zone: 3 },
  { x: 58, y: 53, zone: 3, isPreset: 'spyglass' },

  // Zone 4: Upper Crew Quarters
  { x: 36, y: 33, zone: 4, isClamNode: true },
  { x: 64, y: 33, zone: 4 },

  // Zone 5: Captain's Stern Air Pocket
  { x: 50, y: 16, zone: 5, isGoalNode: true, requiresHuman: true }
];

// === Ship Wreck: Scenery ===
export const sceneryNodes: SceneryNode[] = [
  { x: 6, y: 93, e: '🪸', s: 'text-4xl', z: 20 },
  { x: 92, y: 84, e: '🪸', s: 'text-4xl', z: 20 },
  { x: 8, y: 58, e: '🪸', s: 'text-3xl', z: 20 },
  { x: 94, y: 52, e: '🪸', s: 'text-3xl', z: 20 }
];
