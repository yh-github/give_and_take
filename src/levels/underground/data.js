// === Underground: Items ===
export const items = [
  { id: 'crystal', name: 'Crystal', emoji: '🔮' }, { id: 'gold_nugget', name: 'Gold Nugget', emoji: '🪙' },
  { id: 'mushroom', name: 'Mushroom', emoji: '🍄' }, { id: 'emerald', name: 'Emerald', emoji: '🟩' },
  { id: 'relic', name: 'Relic', emoji: '🏺' }, { id: 'rope', name: 'Rope', emoji: '🪢' },
  { id: 'bone', name: 'Bone', emoji: '🦴' }, { id: 'gem', name: 'Gem', emoji: '💎' }, 
  { id: 'pickaxe', name: 'Pickaxe', emoji: '⛏️' }
];

// === Underground: Entity Templates ===
export const entities = [
  { id: 'miner', name: 'Miner', emoji: '👷', allowedReqs: ['rope', 'mushroom', 'gold_nugget', 'crystal', 'gem', 'bone'] },
  { id: 'scorpion', name: 'Scorpion', emoji: '🦂', allowedReqs: ['bone', 'crystal', 'gold_nugget', 'emerald', 'gem', 'rope'] },
  { id: 'spider', name: 'Giant Spider', emoji: '🕷️', allowedReqs: ['rope', 'bone', 'emerald', 'relic', 'mushroom'] },
  { id: 'bat', name: 'Vampire Bat', emoji: '🦇', allowedReqs: ['relic', 'mushroom', 'bone', 'crystal', 'rope', 'gold_nugget'] },
  { id: 'slime', name: 'Acid Slime', emoji: '🦠', allowedReqs: ['crystal', 'bone', 'mushroom', 'gem', 'relic'] },
  { id: 'ghost', name: 'Miner Ghost', emoji: '👻', allowedReqs: ['gold_nugget', 'bone', 'emerald', 'rope', 'crystal'] },
  { id: 'mole', name: 'Giant Mole', emoji: '🐭', allowedReqs: ['mushroom', 'relic', 'crystal', 'gold_nugget', 'bone', 'emerald'] },
  { id: 'goblin', name: 'Cave Goblin', emoji: '👺', allowedReqs: ['gold_nugget', 'gem', 'mushroom', 'emerald', 'rope'] },
];

// === Underground: Map Layout ===
export const mapNodes = [
  { x: 53, y: 6, zone: 1, isPreset: 'mushroom' }, { x: 35, y: 14, zone: 1 }, { x: 74, y: 14, zone: 1 },
  // Path 1 (Leftish) - Centered at x=35
  { x: 35, y: 22, zone: 1, isGatekeeper: true, id: 'rock_left_1', emoji: '🪨', unlocksZones: [2] },
  { x: 35, y: 28, zone: 2 },
  { x: 35, y: 32, zone: 2 }, { x: 35, y: 38, zone: 2 },
  { x: 35, y: 46, zone: 2, isGatekeeper: true, id: 'rock_left_2', emoji: '🪨', unlocksZones: [4] },
  { x: 35, y: 54, zone: 4 }, { x: 35, y: 60, zone: 4, isPreset: 'mushroom' },
  { x: 35, y: 68, zone: 4, isGatekeeper: true, id: 'rock_left_3', emoji: '🪨', unlocksZones: [6] },

  // Path 2 (Rightish) - Centered at x=68
  { x: 74, y: 25, zone: 1, isGatekeeper: true, id: 'rock_right_1', emoji: '🪨', unlocksZones: [3] },
  { x: 68, y: 32, zone: 3 }, { x: 68, y: 38, zone: 3 },
  { x: 68, y: 40, zone: 3, isPreset: 'pickaxe' },
  { x: 74, y: 43, zone: 3, isGatekeeper: true, id: 'rock_right_2', emoji: '🪨', unlocksZones: [5] },
  { x: 68, y: 54, zone: 5 }, { x: 68, y: 60, zone: 5 },
  { x: 74, y: 71, zone: 5, isGatekeeper: true, id: 'rock_right_3', emoji: '🪨', unlocksZones: [6] },

  // Center / Misc
  { x: 50, y: 62, zone: 1, isPreset: 'pickaxe' },
  { x: 50, y: 72, zone: 6, isPreset: 'mushroom' }, 
  { x: 50, y: 78, zone: 6, isGatekeeper: true, id: 'rock_final_1', emoji: '🪨', unlocksZones: [7] },
  { x: 50, y: 84, zone: 7 }, 
  { x: 50, y: 88, zone: 7, isGatekeeper: true, id: 'rock_final_2', emoji: '🪨', unlocksZones: [8] },
  { x: 50, y: 92, zone: 8 }, 
  { x: 50, y: 95, zone: 8, isGatekeeper: true, id: 'vault_rock', emoji: '🪨', unlocksZones: [9] },
  
  // Treasure Room
  { x: 45, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 49, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 53, y: 98, zone: 9, isGoal: true, isPreset: 'treasure', isTreasure: true },
  { x: 57, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 61, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },

  // Decorative Rocks
  { x: 25, y: 15, zone: 1, isExtraRock: true, size: 'small', id: 'extra_rock_1', emoji: '🪨' },
  { x: 80, y: 18, zone: 1, isExtraRock: true, size: 'small', id: 'extra_rock_2', emoji: '🪨' },
  { x: 55, y: 30, zone: 1, isExtraRock: true, size: 'small', id: 'extra_rock_3', emoji: '🪨' },
  { x: 22, y: 45, zone: 2, isExtraRock: true, size: 'small', id: 'extra_rock_4', emoji: '🪨' },
  { x: 83, y: 50, zone: 3, isExtraRock: true, size: 'small', id: 'extra_rock_5', emoji: '🪨' },
  { x: 60, y: 80, zone: 6, isExtraRock: true, size: 'small', id: 'extra_rock_6', emoji: '🪨' }
];

// === Underground: Scenery ===
export const sceneryNodes = [
];
