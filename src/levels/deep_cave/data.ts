import type { EntityTemplate, ItemDefinition } from '../../types/index.ts';

/**
 * Items and Entity Templates for `deep_cave` ("The Abyssal Descent").
 * Shares Underground art while keeping module imports JSON-free for Web Workers & Node fuzzers.
 */

export const items: ItemDefinition[] = [
  { id: 'crystal', name: 'Crystal', emoji: '🔮' },
  { id: 'gold_nugget', name: 'Gold Nugget', emoji: '🪙' },
  { id: 'mushroom', name: 'Mushroom', emoji: '🍄' },
  { id: 'emerald', name: 'Emerald', emoji: '🟩' },
  { id: 'relic', name: 'Relic', emoji: '🏺' },
  { id: 'rope', name: 'Rope', emoji: '🪢' },
  { id: 'bone', name: 'Bone', emoji: '🦴' },
  { id: 'gem', name: 'Gem', emoji: '💎' },
  { id: 'pickaxe', name: 'Pickaxe', emoji: '⛏️' }
];

export const entities: EntityTemplate[] = [
  { id: 'troll', name: 'Cave Troll', emoji: '🧌', allowedReqs: ['crystal', 'gold_nugget', 'mushroom', 'emerald', 'relic', 'bone', 'gem'] },
  { id: 'miner', name: 'Miner', emoji: '👷', allowedReqs: ['rope', 'mushroom', 'gold_nugget', 'crystal', 'gem', 'bone'] },
  { id: 'scorpion', name: 'Scorpion', emoji: '🦂', allowedReqs: ['bone', 'crystal', 'gold_nugget', 'emerald', 'gem', 'rope'] },
  { id: 'spider', name: 'Giant Spider', emoji: '🕷️', allowedReqs: ['rope', 'bone', 'emerald', 'relic', 'mushroom'] },
  { id: 'bat', name: 'Vampire Bat', emoji: '🦇', allowedReqs: ['relic', 'mushroom', 'bone', 'crystal', 'rope', 'gold_nugget'] },
  { id: 'slime', name: 'Acid Slime', emoji: '🦠', allowedReqs: ['crystal', 'bone', 'mushroom', 'gem', 'relic'] },
  { id: 'ghost', name: 'Miner Ghost', emoji: '👻', allowedReqs: ['gold_nugget', 'bone', 'emerald', 'rope', 'crystal'] },
  { id: 'mole', name: 'Giant Mole', emoji: '🐭', allowedReqs: ['mushroom', 'relic', 'crystal', 'gold_nugget', 'bone', 'emerald'] },
  { id: 'goblin', name: 'Cave Goblin', emoji: '👺', allowedReqs: ['gold_nugget', 'gem', 'mushroom', 'emerald', 'rope'] }
];
