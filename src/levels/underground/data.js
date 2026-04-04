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
  { x: 50, y: 6, zone: 1, isPreset: 'mushroom' }, { x: 30, y: 12, zone: 1 }, { x: 70, y: 12, zone: 1 },
  { x: 28, y: 20, zone: 1, isGatekeeper: true, id: 'rock_left_1', emoji: '🪨', unlocksZones: [2] },
  { x: 72, y: 20, zone: 1, isGatekeeper: true, id: 'rock_right_1', emoji: '🪨', unlocksZones: [3] },
  { x: 20, y: 25, zone: 2, isPreset: 'pickaxe' },
  { x: 25, y: 30, zone: 2 }, { x: 25, y: 36, zone: 2 },
  { x: 75, y: 30, zone: 3 }, { x: 75, y: 36, zone: 3 },
  { x: 80, y: 38, zone: 3, isPreset: 'pickaxe' },
  { x: 28, y: 44, zone: 2, isGatekeeper: true, id: 'rock_left_2', emoji: '🪨', unlocksZones: [4] },
  { x: 72, y: 44, zone: 3, isGatekeeper: true, id: 'rock_right_2', emoji: '🪨', unlocksZones: [5] },
  { x: 35, y: 52, zone: 4 }, { x: 35, y: 58, zone: 4, isPreset: 'mushroom' },
  { x: 65, y: 52, zone: 5 }, { x: 65, y: 58, zone: 5 },
  { x: 50, y: 62, zone: 1, isPreset: 'pickaxe' },
  { x: 40, y: 66, zone: 4, isGatekeeper: true, id: 'rock_left_3', emoji: '🪨', unlocksZones: [6] },
  { x: 60, y: 66, zone: 5, isGatekeeper: true, id: 'rock_right_3', emoji: '🪨', unlocksZones: [6] },
  { x: 50, y: 72, zone: 6, isPreset: 'mushroom' }, 
  { x: 50, y: 78, zone: 6, isGatekeeper: true, id: 'rock_final_1', emoji: '🪨', unlocksZones: [7] },
  { x: 50, y: 84, zone: 7 }, 
  { x: 50, y: 88, zone: 7, isGatekeeper: true, id: 'rock_final_2', emoji: '🪨', unlocksZones: [8] },
  { x: 50, y: 92, zone: 8 }, 
  { x: 50, y: 95, zone: 8, isGatekeeper: true, id: 'vault_rock', emoji: '🪨', unlocksZones: [9] },
  { x: 42, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 46, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 50, y: 98, zone: 9, isGoal: true, isPreset: 'treasure', isTreasure: true },
  { x: 54, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true },
  { x: 58, y: 98, zone: 9, isPreset: 'treasure', isTreasure: true }
];

// === Underground: Scenery ===
export const sceneryNodes = [
  { x: 15, y: 20, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 }, { x: 22, y: 20, e: '🪨', s: 'text-5xl brightness-50', z: 90 },
  { x: 78, y: 20, e: '🪨', s: 'text-5xl brightness-[0.4]', z: 90 }, { x: 85, y: 20, e: '🪨', s: 'text-6xl brightness-50', z: 90 },
  { x: 15, y: 44, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 }, { x: 22, y: 44, e: '🪨', s: 'text-5xl brightness-50', z: 90 },
  { x: 78, y: 44, e: '🪨', s: 'text-5xl brightness-[0.4]', z: 90 }, { x: 85, y: 44, e: '🪨', s: 'text-6xl brightness-50', z: 90 },
  { x: 28, y: 66, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 }, { x: 34, y: 66, e: '🪨', s: 'text-5xl brightness-50', z: 90 },
  { x: 72, y: 66, e: '🪨', s: 'text-5xl brightness-[0.4]', z: 90 }, { x: 66, y: 66, e: '🪨', s: 'text-6xl brightness-50', z: 90 },
  { x: 34, y: 78, e: '🪨', s: 'text-6xl brightness-50', z: 90 }, { x: 66, y: 78, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 },
  { x: 34, y: 88, e: '🪨', s: 'text-6xl brightness-50', z: 90 }, { x: 66, y: 88, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 },
  { x: 34, y: 95, e: '🪨', s: 'text-6xl brightness-50', z: 90 }, { x: 66, y: 95, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 },
];
