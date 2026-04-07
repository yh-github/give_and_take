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

export const mapNodes = [
  { x: 68, y: 6, zone: 1, isPreset: 'mushroom' }, { x: 50, y: 14, zone: 1 }, { x: 80, y: 10, zone: 1 },
  // Zone 1 accessible pickaxe — above the first rocks
  { x: 35, y: 16, zone: 1, isPreset: 'pickaxe' },

  // Path 1 (Left Path) — gatekeeper rocks and entity slots, kept inside left corridor (x=28-38)
  { x: 35, y: 22, zone: 1, isGatekeeper: true, id: 'rock_left_1', emoji: '🪨', unlocksZones: [2] },
  { x: 30, y: 27, zone: 2 },
  { x: 38, y: 34, zone: 2 }, { x: 28, y: 40, zone: 2 },
  { x: 35, y: 46, zone: 2, isGatekeeper: true, id: 'rock_left_2', emoji: '🪨', unlocksZones: [4] },
  { x: 30, y: 54, zone: 4 }, { x: 38, y: 60, zone: 4, isPreset: 'mushroom' },
  { x: 35, y: 68, zone: 4, isGatekeeper: true, id: 'rock_left_3', emoji: '🪨', unlocksZones: [6] },

  // Path 2 (Right Path) — with horizontal spread
  { x: 85, y: 25, zone: 1, isGatekeeper: true, id: 'rock_right_1', emoji: '🪨', unlocksZones: [3] },
  { x: 75, y: 32, zone: 3 }, { x: 90, y: 38, zone: 3 },
  { x: 80, y: 42, zone: 3, isPreset: 'pickaxe' },
  { x: 85, y: 48, zone: 3, isGatekeeper: true, id: 'rock_right_2', emoji: '🪨', unlocksZones: [5] },
  { x: 78, y: 56, zone: 5 }, { x: 90, y: 63, zone: 5 },
  { x: 85, y: 71, zone: 5, isGatekeeper: true, id: 'rock_right_3', emoji: '🪨', unlocksZones: [6] },

  // Final Descent
  { x: 65, y: 74, zone: 6, isPreset: 'mushroom' },
  { x: 65, y: 78, zone: 6, isGatekeeper: true, id: 'rock_final_1', emoji: '🪨', unlocksZones: [7] },
  { x: 60, y: 84, zone: 7 },
  { x: 65, y: 88, zone: 7, isGatekeeper: true, id: 'rock_final_2', emoji: '🪨', unlocksZones: [8] },
  { x: 70, y: 92, zone: 8 },
  { x: 65, y: 95, zone: 8, isGatekeeper: true, id: 'vault_rock', emoji: '🪨', unlocksZones: [9] },

  // Treasure Room
  { x: 55, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 60, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 65, y: 98, zone: 9, isGoal: true, isPreset: 'treasure', isTreasure: true },
  { x: 70, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 75, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },

  // Decorative Rocks
  // { x: 40, y: 15, zone: 1, isExtraRock: true, size: 'small', id: 'extra_rock_1', emoji: '🪨' },
  // { x: 95, y: 18, zone: 1, isExtraRock: true, size: 'small', id: 'extra_rock_2', emoji: '🪨' },
  // // { x: 70, y: 30, zone: 3, isExtraRock: true, size: 'small', id: 'extra_rock_3', emoji: '🪨' },
  // { x: 30, y: 45, zone: 2, isExtraRock: true, size: 'small', id: 'extra_rock_4', emoji: '🪨' },
  // { x: 95, y: 52, zone: 3, isExtraRock: true, size: 'small', id: 'extra_rock_5', emoji: '🪨' },
  // { x: 75, y: 80, zone: 6, isExtraRock: true, size: 'small', id: 'extra_rock_6', emoji: '🪨' }
];

// === Underground: Scenery ===
export const sceneryNodes = [
];
