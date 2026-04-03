// === River Crossing: Items ===
export const items = [
  { id: 'apple', name: 'Apple', emoji: '🍎' }, { id: 'bread', name: 'Bread', emoji: '🥖' },
  { id: 'gold', name: 'Gold', emoji: '💰' }, { id: 'gem', name: 'Gem', emoji: '💎' },
  { id: 'sword', name: 'Sword', emoji: '🗡️' }, { id: 'bug_spray', name: 'Poison', emoji: '🧪' },
  { id: 'key', name: 'Key', emoji: '🔑' }, { id: 'wand', name: 'Wand', emoji: '🪄' },
  { id: 'hat', name: 'Hat', emoji: '🎩' }, { id: 'bone', name: 'Bone', emoji: '🦴' },
  { id: 'shield', name: 'Shield', emoji: '🛡️' }, { id: 'map', name: 'Map', emoji: '🗺️' },
  { id: 'lantern', name: 'Lantern', emoji: '🏮' }, { id: 'flute', name: 'Flute', emoji: '🪈' },
  { id: 'flower', name: 'Flower', emoji: '🌸' }, { id: 'fish', name: 'Fish', emoji: '🐟' }
];

// === River Crossing: Entity Templates ===
export const entities = [
  { id: 'troll', name: 'Troll', emoji: '🧌', allowedReqs: ['apple', 'bread', 'gold', 'gem', 'sword', 'wand', 'shield', 'fish'] },
  { id: 'baker', name: 'Baker', emoji: '👨‍🍳', allowedReqs: ['gold', 'gem', 'hat', 'apple', 'flower', 'bread'] },
  { id: 'spider', name: 'Spider', emoji: '🕷️', allowedReqs: ['sword', 'bug_spray', 'wand', 'lantern', 'flute'] },
  { id: 'chest', name: 'Chest', emoji: '🧳', allowedReqs: ['key', 'sword', 'shield', 'bone'] },
  { id: 'wizard', name: 'Wizard', emoji: '🧙‍♂️', allowedReqs: ['wand', 'gold', 'gem', 'hat', 'apple', 'map', 'flute', 'bug_spray'] },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', allowedReqs: ['sword', 'wand', 'gold', 'gem', 'shield', 'key'] }, 
  { id: 'dog', name: 'Hound', emoji: '🐕', allowedReqs: ['bone', 'apple', 'bread', 'fish', 'flower'] },
  { id: 'goblin', name: 'Goblin', emoji: '👺', allowedReqs: ['gold', 'gem', 'apple', 'bread', 'hat', 'map', 'lantern', 'sword'] },
  { id: 'mermaid', name: 'Mermaid', emoji: '🧜‍♀️', allowedReqs: ['gem', 'flute', 'hat', 'flower', 'fish', 'gold'] },
  { id: 'ghost', name: 'Ghost', emoji: '👻', allowedReqs: ['lantern', 'flute', 'bone', 'flower', 'map'] },
  { id: 'knight', name: 'Knight', emoji: '🪖', allowedReqs: ['sword', 'shield', 'map', 'apple', 'bread', 'key'] },
  { id: 'merchant', name: 'Merchant', emoji: '👳‍♂️', allowedReqs: ['gold', 'gem', 'map', 'sword', 'lantern', 'hat'] },
  { id: 'fairy', name: 'Fairy', emoji: '🧚‍♀️', allowedReqs: ['flower', 'apple', 'wand', 'hat', 'flute', 'gem'] },
  { id: 'bear', name: 'Bear', emoji: '🐻', allowedReqs: ['fish', 'apple', 'bread', 'bone', 'flower'] }
];

// === River Crossing: Map Layout ===
export const mapNodes = [
  { x: 12, y: 82, zone: 1 }, { x: 88, y: 82, zone: 1 }, { x: 25, y: 65, zone: 1 }, { x: 75, y: 65, zone: 1 }, 
  { x: 50, y: 52, zone: 1, isGatekeeper: true, gkIdx: 0, unlocksZones: [2] },
  { x: 15, y: 35, zone: 2 }, { x: 85, y: 32, zone: 2 }, { x: 50, y: 22, zone: 2, isGoal: true } 
];

// === River Crossing: Scenery ===
export const sceneryNodes = [
  { x: 8, y: 22, e: '🌲', s: 'text-3xl' }, { x: 85, y: 12, e: '⛰️', s: 'text-5xl' },
  { x: 32, y: 28, e: '🌲', s: 'text-2xl' }, { x: 75, y: 35, e: '🌲', s: 'text-4xl' },
  { x: 15, y: 68, e: '🪨', s: 'text-2xl' }, { x: 48, y: 38, e: '⛰️', s: 'text-4xl' },
];
