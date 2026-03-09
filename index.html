import React, { useState, useEffect, useRef } from 'react';

// --- SHARED DATA ---
const RIVER_CROSSING_ITEMS = [
  { id: 'apple', name: 'Apple', emoji: '🍎' }, { id: 'bread', name: 'Bread', emoji: '🥖' },
  { id: 'gold', name: 'Gold', emoji: '💰' }, { id: 'gem', name: 'Gem', emoji: '💎' },
  { id: 'sword', name: 'Sword', emoji: '🗡️' }, { id: 'bug_spray', name: 'Poison', emoji: '🧪' },
  { id: 'key', name: 'Key', emoji: '🔑' }, { id: 'wand', name: 'Wand', emoji: '🪄' },
  { id: 'hat', name: 'Hat', emoji: '🎩' }, { id: 'bone', name: 'Bone', emoji: '🦴' },
  { id: 'shield', name: 'Shield', emoji: '🛡️' }, { id: 'map', name: 'Map', emoji: '🗺️' },
  { id: 'lantern', name: 'Lantern', emoji: '🏮' }, { id: 'flute', name: 'Flute', emoji: '🪈' },
  { id: 'flower', name: 'Flower', emoji: '🌸' }, { id: 'fish', name: 'Fish', emoji: '🐟' }
];

const UNDERGROUND_ITEMS = [
  { id: 'crystal', name: 'Crystal', emoji: '🔮' }, { id: 'gold_nugget', name: 'Gold Nugget', emoji: '🪙' },
  { id: 'mushroom', name: 'Mushroom', emoji: '🍄' }, { id: 'emerald', name: 'Emerald', emoji: '🟩' },
  { id: 'relic', name: 'Relic', emoji: '🏺' }, { id: 'rope', name: 'Rope', emoji: '🪢' },
  { id: 'key', name: 'Key', emoji: '🔑' }, { id: 'bone', name: 'Bone', emoji: '🦴' },
  { id: 'gem', name: 'Gem', emoji: '💎' }, { id: 'pickaxe', name: 'Pickaxe', emoji: '⛏️' }
];

const UNDERWATER_ITEMS = [
  { id: 'pearl', name: 'Pearl', emoji: '⚪' }, { id: 'red_fish', name: 'Red Fish', emoji: '🐡' },
  { id: 'blue_fish', name: 'Blue Fish', emoji: '🐟' }, { id: 'green_fish', name: 'Green Fish', emoji: '🐠' },
  { id: 'shell', name: 'Shell', emoji: '🐚' }, { id: 'starfish', name: 'Starfish', emoji: '⭐' },
  { id: 'trident', name: 'Trident', emoji: '🔱' }, { id: 'anchor', name: 'Anchor', emoji: '⚓' }
];

const RIVER_CROSSING_ENTITIES = [
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

const UNDERGROUND_ENTITIES = [
  { id: 'miner', name: 'Miner', emoji: '👷', allowedReqs: ['key', 'rope', 'mushroom', 'gold_nugget', 'crystal', 'gem', 'bone'] },
  { id: 'cave_troll', name: 'Cave Troll', emoji: '🧌', allowedReqs: ['bone', 'crystal', 'gold_nugget', 'emerald', 'gem', 'key', 'rope'] },
  { id: 'spider', name: 'Giant Spider', emoji: '🕷️', allowedReqs: ['key', 'rope', 'bone', 'emerald', 'relic', 'mushroom'] },
  { id: 'bat', name: 'Vampire Bat', emoji: '🦇', allowedReqs: ['relic', 'mushroom', 'bone', 'crystal', 'rope', 'gold_nugget'] },
  { id: 'slime', name: 'Acid Slime', emoji: '🦠', allowedReqs: ['crystal', 'bone', 'key', 'mushroom', 'gem', 'relic'] },
  { id: 'ghost', name: 'Miner Ghost', emoji: '👻', allowedReqs: ['key', 'gold_nugget', 'bone', 'emerald', 'rope', 'crystal'] },
  { id: 'mole', name: 'Giant Mole', emoji: '🐭', allowedReqs: ['mushroom', 'relic', 'crystal', 'gold_nugget', 'bone', 'emerald'] },
  { id: 'goblin', name: 'Cave Goblin', emoji: '👺', allowedReqs: ['gold_nugget', 'gem', 'mushroom', 'emerald', 'key', 'rope'] },
];

const UNDERWATER_ENTITIES = []; 

// --- BACKGROUND COMPONENTS ---
const BridgeSVG = () => (
  <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-28 -z-10" viewBox="0 0 60 100">
    <circle cx="10" cy="5" r="4" fill="#3e1c00"/><circle cx="50" cy="5" r="4" fill="#3e1c00"/>
    <circle cx="10" cy="95" r="4" fill="#3e1c00"/><circle cx="50" cy="95" r="4" fill="#3e1c00"/>
    <path d="M 10 5 Q 15 50 10 95" fill="none" stroke="#3e1c00" strokeWidth="2" />
    <path d="M 50 5 Q 45 50 50 95" fill="none" stroke="#3e1c00" strokeWidth="2" />
    {[15, 30, 45, 60, 75].map((y, i) => ( <rect key={y} x={12} y={y} width="36" height="8" fill="#8b5a2b" stroke="#4a2211" strokeWidth="1" rx="1" transform={`rotate(${i%2===0?-2:2} 30 ${y+4})`}/> ))}
  </svg>
);

const RiverBackground = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
    <path d="M -10 53 Q 25 43 50 53 T 110 53" fill="none" stroke="#1e40af" strokeWidth="10" opacity="0.3" strokeLinecap="round"/>
    <path d="M -10 53 Q 25 43 50 53 T 110 53" fill="none" stroke="#3b82f6" strokeWidth="5" opacity="0.5" strokeLinecap="round"/>
    <path d="M -10 52 Q 25 42 50 52 T 110 52" fill="none" stroke="#93c5fd" strokeWidth="1.5" opacity="0.7" strokeLinecap="round" strokeDasharray="15 25" className="animate-river-flow"/>
  </svg>
);

const CaveBackground = () => (
  <div className="absolute inset-0 bg-[#2b221d] pointer-events-none z-0 overflow-hidden">
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#1a1512 2px, transparent 2px)', backgroundSize: '40px 40px' }} />
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 drop-shadow-2xl" preserveAspectRatio="none" viewBox="0 0 100 100">
      {/* Left Rugged Wall */}
      <path d="M 0 0 L 35 0 L 32 5 L 36 10 L 35 15 L 25 18 L 12 22 L 15 30 L 10 40 L 14 50 L 9 60 L 13 70 L 12 75 L 20 78 L 35 82 L 32 85 L 35 88 L 25 90 L 10 92 L 12 96 L 10 100 L 0 100 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      {/* Right Rugged Wall */}
      <path d="M 100 0 L 65 0 L 68 5 L 64 10 L 65 15 L 75 18 L 88 22 L 85 30 L 90 40 L 86 50 L 91 60 L 87 70 L 88 75 L 80 78 L 65 82 L 68 85 L 65 88 L 75 90 L 90 92 L 88 96 L 90 100 L 100 100 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      {/* Center Pillar Fork */}
      <path d="M 50 18 L 45 22 L 40 28 L 38 35 L 42 45 L 40 52 L 46 60 L 48 70 L 50 78 L 52 70 L 54 60 L 60 52 L 58 45 L 62 35 L 60 28 L 55 22 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
);

const UnderwaterBackground = () => (
  <>
    <div className="absolute inset-0 bg-gradient-to-b from-cyan-500 via-blue-700 to-blue-950 pointer-events-none z-0 overflow-hidden">
      <svg style={{ width: '100%', height: '100%', position: 'absolute' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="10,-10 30,110 0,110" fill="white" opacity="0.05" />
        <polygon points="50,-10 80,110 40,110" fill="white" opacity="0.05" />
        <polygon points="90,-10 110,110 90,110" fill="white" opacity="0.05" />
        {[...Array(15)].map((_, i) => ( <circle key={i} cx={10 + (i * 7) % 90} cy={100} r={0.5 + Math.random()} fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 4}s` }} /> ))}
      </svg>
    </div>
    <svg style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 10, filter: 'blur(2px) brightness(0.6)' }} preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M 0 65 Q 50 55 100 65 L 100 100 L 0 100 Z" fill="#2c425e" />
      <path d="M 10 100 Q 5 80 15 65 T 10 40" fill="none" stroke="#1c3041" strokeWidth="2" strokeLinecap="round" className="animate-sway-slow" />
      <path d="M 85 100 Q 80 80 90 65 T 85 40" fill="none" stroke="#1c3041" strokeWidth="2.5" strokeLinecap="round" className="animate-sway" />
      <path d="M 40 80 Q 45 70 40 65 M 40 80 Q 35 70 40 65 M 40 80 L 40 65" fill="none" stroke="#36294a" strokeWidth="3" strokeLinecap="round" />
    </svg>
    <svg style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 20, filter: 'blur(1px) brightness(0.85)' }} preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M 0 78 Q 50 70 100 78 L 100 100 L 0 100 Z" fill="#3a5168" />
      <path d="M 25 100 Q 30 85 25 75 T 30 50" fill="none" stroke="#1e4638" strokeWidth="3" strokeLinecap="round" className="animate-sway" />
      <path d="M 75 100 Q 70 85 75 75 T 70 50" fill="none" stroke="#1e4638" strokeWidth="3" strokeLinecap="round" className="animate-sway-slow" />
      <path d="M 60 85 Q 65 75 60 70 M 60 85 Q 55 75 60 70 M 60 85 L 60 70" fill="none" stroke="#68346e" strokeWidth="4" strokeLinecap="round" />
    </svg>
    <svg style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 30 }} preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M 0 90 Q 50 85 100 90 L 100 100 L 0 100 Z" fill="#b49365" />
      <path d="M 0 95 Q 50 90 100 95 L 100 100 L 0 100 Z" fill="#8f724b" />
      <path d="M 15 100 Q 20 85 15 75 T 20 50" fill="none" stroke="#15803d" strokeWidth="4" strokeLinecap="round" className="animate-sway" />
      <path d="M 20 100 Q 15 90 17 80 T 13 60" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" className="animate-sway-slow" />
      <path d="M 90 100 Q 85 90 88 80 T 82 60" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" className="animate-sway-slow" />
      <path d="M 35 95 Q 35 85 30 80 M 35 95 Q 35 85 40 80 M 35 95 L 35 75" fill="none" stroke="#db2777" strokeWidth="4" strokeLinecap="round" />
      <path d="M 80 95 Q 80 85 75 80 M 80 95 Q 80 85 85 80 M 80 95 L 80 75" fill="none" stroke="#a855f7" strokeWidth="5" strokeLinecap="round" />
    </svg>
  </>
);

const LEVEL_DICTIONARY = {
  river_crossing: {
    id: 'river_crossing', name: 'River Crossing',
    items: RIVER_CROSSING_ITEMS, entities: RIVER_CROSSING_ENTITIES,
    campPos: { x: 50, y: 92 }, 
    mechanics: { hasFish: true, gatekeeperId: 'troll', darknessType: 'horizontal' }, 
    specialEntityTemplate: 'dog',
    mapNodes: [
      { x: 12, y: 82, zone: 1 }, { x: 88, y: 82, zone: 1 }, { x: 25, y: 65, zone: 1 }, { x: 75, y: 65, zone: 1 }, 
      { x: 50, y: 52, zone: 1, isGatekeeper: true, gkIdx: 0, unlocksZones: [2] },
      { x: 15, y: 35, zone: 2 }, { x: 85, y: 32, zone: 2 }, { x: 50, y: 15, zone: 2, isGoal: true }
    ],
    sceneryNodes: [
      { x: 8, y: 22, e: '🌲', s: 'text-3xl' }, { x: 85, y: 12, e: '⛰️', s: 'text-5xl' },
      { x: 32, y: 28, e: '🌲', s: 'text-2xl' }, { x: 75, y: 35, e: '🌲', s: 'text-4xl' },
      { x: 15, y: 68, e: '🪨', s: 'text-2xl' }, { x: 48, y: 38, e: '⛰️', s: 'text-4xl' },
    ],
    BackgroundComponent: RiverBackground, GatekeeperPropComponent: BridgeSVG
  },
  underground: {
    id: 'underground', name: 'The Deep Chasm',
    items: UNDERGROUND_ITEMS, entities: UNDERGROUND_ENTITIES,
    campPos: { x: 50, y: 2 }, 
    mechanics: { hasPickaxe: true, hasDarkness: true, darknessType: 'radial', isVertical: true, screens: 4 }, 
    specialEntityTemplate: 'mole',
    passages: [],
    mapNodes: [
      { x: 40, y: 8, zone: 1, isPreset: 'mushroom' },
      { x: 60, y: 10, zone: 1 },
      { x: 50, y: 14, zone: 1 },
      { x: 28, y: 24, zone: 1, isGatekeeper: true, id: 'rock_left_1', emoji: '🪨', unlocksZones: [2] },
      { x: 72, y: 24, zone: 1, isGatekeeper: true, id: 'rock_right_1', emoji: '🪨', unlocksZones: [3] },
      
      { x: 25, y: 34, zone: 2 },
      { x: 25, y: 40, zone: 2 },
      { x: 28, y: 48, zone: 2, isGatekeeper: true, id: 'rock_left_2', emoji: '🪨', unlocksZones: [4] },
      
      { x: 75, y: 34, zone: 3 },
      { x: 75, y: 40, zone: 3 },
      { x: 72, y: 48, zone: 3, isGatekeeper: true, id: 'rock_right_2', emoji: '🪨', unlocksZones: [5] },
      
      { x: 25, y: 58, zone: 4 },
      { x: 25, y: 66, zone: 4, isPreset: 'mushroom' },
      { x: 28, y: 77, zone: 4, isGatekeeper: true, id: 'rock_left_3', emoji: '🪨', unlocksZones: [6] },
      
      { x: 75, y: 58, zone: 5 },
      { x: 75, y: 66, zone: 5 },
      { x: 72, y: 77, zone: 5, isGatekeeper: true, id: 'rock_right_3', emoji: '🪨', unlocksZones: [6] },
      
      { x: 40, y: 84, zone: 6, isPreset: 'mushroom' },
      { x: 60, y: 84, zone: 6 },
      { x: 50, y: 88, zone: 6, isGatekeeper: true, id: 'final_gate', emoji: '⛩️', unlocksZones: [7] },
      
      { x: 30, y: 95, zone: 7, isPreset: 'treasure' },
      { x: 50, y: 95, zone: 7, isPreset: 'treasure' },
      { x: 70, y: 95, zone: 7, isPreset: 'treasure' }
    ],
    sceneryNodes: [
      { x: 15, y: 8, e: '🪨', s: 'text-2xl opacity-40' },
      { x: 80, y: 12, e: '🌑', s: 'text-3xl opacity-30' },
      { x: 20, y: 35, e: '🪨', s: 'text-4xl opacity-50' },
      { x: 85, y: 30, e: '🌑', s: 'text-2xl opacity-40' },
      { x: 15, y: 60, e: '🪨', s: 'text-3xl opacity-40' },
      { x: 80, y: 65, e: '🪨', s: 'text-4xl opacity-30' },
      { x: 35, y: 80, e: '🌑', s: 'text-2xl opacity-50' },
      { x: 75, y: 92, e: '🪨', s: 'text-3xl opacity-40' },
    ],
    BackgroundComponent: CaveBackground, GatekeeperPropComponent: () => null
  },
  underwater: {
    id: 'underwater', name: 'Deep Blue',
    items: UNDERWATER_ITEMS, entities: [], 
    campPos: { x: 50, y: 15, depth: 3 }, 
    mechanics: { noPath: true, isFarming: true, hasSchoolsOfFish: true, heroBobs: true },
    mapNodes: [], sceneryNodes: [], passages: [],
    BackgroundComponent: UnderwaterBackground, GatekeeperPropComponent: () => null
  }
};

// --- LOGIC ---
function solvePuzzle(startItems, puzzleEntities, goalEntityId, level) {
  const queue = [{ inv: [...startItems].sort(), def: [], path: [], pickaxeCharges: level.mechanics.hasPickaxe ? 0 : null }];
  const visited = new Set();
  let iters = 0;

  while (queue.length > 0) {
    iters++;
    if (iters > 25000) return null;

    const curr = queue.shift();
    if (curr.def.includes(goalEntityId)) return curr.path;

    const stateKey = curr.inv.join(',') + '|' + curr.def.sort().join(',') + '|' + (curr.pickaxeCharges || 0);
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    const canHoldMore = Array.from(new Set(curr.inv)).length < 4;

    if (level.mechanics.hasFish && !curr.def.includes(`fish_node`) && canHoldMore) {
      queue.push({ inv: [...curr.inv, 'fish'].sort(), def: [...curr.def, 'fish_node'], path: [...curr.path, { isEnvironmentAction: true, itemId: 'fish' }], pickaxeCharges: curr.pickaxeCharges });
    }

    let simUnlockedZones = new Set([1]);
    puzzleEntities.forEach(e => {
        if (e.isGatekeeper && curr.def.includes(e.id) && e.unlocksZones) {
            e.unlocksZones.forEach(z => simUnlockedZones.add(z));
        }
    });

    for (const entity of puzzleEntities) {
      if (curr.def.includes(entity.id)) continue;
      
      if (!simUnlockedZones.has(entity.zone)) continue;
      
      if (entity.isGatekeeper && level.mechanics.hasPickaxe && entity.reqType === 'SPECIAL') {
        if (entity.reqGk && !curr.def.includes(entity.reqGk)) continue;
        if (curr.inv.includes('pickaxe') && curr.pickaxeCharges > 0) {
          let newInv = [...curr.inv]; let newCharges = curr.pickaxeCharges - 1;
          if (newCharges === 0) newInv.splice(newInv.indexOf('pickaxe'), 1);
          queue.push({ inv: newInv.sort(), def: [...curr.def, entity.id], path: [...curr.path, { entityId: entity.id, usedItems: ['pickaxe'], reqType: 'SPECIAL' }], pickaxeCharges: newCharges });
        } continue;
      }

      if (entity.reqType === 'AND') {
        let hasAll = true; let tempInv = [...curr.inv];
        for (const req of (entity.requires || [])) {
           const idx = tempInv.indexOf(req);
           if (idx > -1) tempInv.splice(idx, 1); else { hasAll = false; break; }
        }
        if (hasAll) {
          let newInv = tempInv;
          if (entity.reward && entity.reward !== 'pickaxe') newInv.push(entity.reward);
          let newCharges = curr.pickaxeCharges;
          if (entity.reward === 'pickaxe') { newInv.push('pickaxe'); newCharges = 10; }
          
          const isValid = Array.from(new Set(newInv)).length <= 4;
          if (isValid) queue.push({ inv: newInv.sort(), def: [...curr.def, entity.id], path: [...curr.path, { entityId: entity.id, usedItems: entity.requires, reqType: 'AND' }], pickaxeCharges: newCharges });
        }
      } else { 
        for (let i = 0; i < curr.inv.length; i++) {
          const itemId = curr.inv[i];
          if ((entity.requires || []).includes(itemId)) {
            const newInv = [...curr.inv]; newInv.splice(i, 1);
            if (entity.reward && entity.reward !== 'pickaxe') newInv.push(entity.reward);
            let newCharges = curr.pickaxeCharges;
            if (entity.reward === 'pickaxe') { newInv.push('pickaxe'); newCharges = 10; }
            
            const isValid = Array.from(new Set(newInv)).length <= 4;
            if (isValid) queue.push({ inv: newInv.sort(), def: [...curr.def, entity.id], path: [...curr.path, { entityId: entity.id, itemId: itemId, reqType: 'OR' }], pickaxeCharges: newCharges });
          }
        }
      }
    }
  } return null;
}

function generateLevelPuzzle(level, targetSteps, numDiggers) {
  if (level.mechanics.isFarming) {
      const specialItems = ['shell', 'starfish', 'trident', 'anchor'];
      const mermaids = specialItems.map((item, idx) => ({ id: `mermaid_${idx}`, emoji: '🧜‍♀️', requires: [item], reqType: 'AND', reward: 'pearl', isGatekeeper: false, y: 25 + idx * 15, depth: (idx % 3) + 1, isRepeatable: true, roamClass: idx % 2 === 0 ? 'animate-[swimRight_20s_linear_infinite]' : 'animate-[swimLeft_24s_linear_infinite]', filterClass: `hue-rotate-[${idx * 120}deg] saturate-200`, isRight: idx % 2 === 0 }));
      const crabs = [
          { id: 'crab_0', emoji: '🦀', requires: ['red_fish'], reqType: 'AND', reward: 'shell', isGatekeeper: false, x: 25, y: 64, depth: 1, isRepeatable: true },
          { id: 'crab_1', emoji: '🦀', requires: ['green_fish'], reqType: 'AND', reward: 'starfish', isGatekeeper: false, x: 75, y: 76, depth: 2, isRepeatable: true },
          { id: 'crab_2', emoji: '🦀', requires: ['red_fish', 'green_fish'], reqType: 'AND', reward: 'trident', isGatekeeper: false, x: 20, y: 88, depth: 3, isRepeatable: true },
          { id: 'crab_3', emoji: '🦀', requires: ['blue_fish'], reqType: 'AND', reward: 'anchor', isGatekeeper: false, x: 80, y: 90, depth: 3, isRepeatable: true }
      ];
      return { startItems: [], goalEntityId: 'octopus', solution: null, puzzleEntities: [ { id: 'octopus', emoji: '🐙', requires: Array(8).fill('pearl'), reqType: 'AND', isGatekeeper: false, x: 50, y: 92, depth: 3, isGoal: true }, ...mermaids, ...crabs ] };
  }

  let bestPuzzle = null; let maxSteps = 0; const startTime = Date.now(); 

  for (let attempt = 0; attempt < 5000; attempt++) {
    if (Date.now() - startTime > 1200) break; // Hard bail

    let activeGatekeepers = [];
    let presetEntities = [];

    if (level.mechanics.gatekeeperId) {
      const gkEnt = level.entities.find(e => e.id === level.mechanics.gatekeeperId);
      const gkNode = level.mapNodes.find(n => n.isGatekeeper);
      const reqs = [...gkEnt.allowedReqs].sort(() => Math.random() - 0.5).slice(0, 2);
      activeGatekeepers = [{ ...gkEnt, ...gkNode, requires: reqs, reqType: 'AND', reward: null, id: gkEnt.id }];
    } else {
      level.mapNodes.forEach((n, idx) => {
        if (n.isGatekeeper) {
          if (n.id === 'final_gate') activeGatekeepers.push({ ...n, name: 'Vault Gate', requires: ['key', 'key', 'key'], reqType: 'AND', reward: null });
          else activeGatekeepers.push({ ...n, name: 'Rock', requires: [], reqType: 'SPECIAL', id: n.id || `gk_${idx}` });
        } else if (n.isPreset === 'mushroom') {
          presetEntities.push({ id: `preset_mush_${n.x}_${n.y}`, emoji: '🍄', requires: [], reqType: 'AND', reward: 'mushroom', x: n.x, y: n.y, zone: n.zone, isGatekeeper: false, isPreset: true });
        } else if (n.isPreset === 'treasure') {
          presetEntities.push({ id: `preset_treas_${n.x}_${n.y}`, emoji: '💎', requires: [], reqType: 'AND', reward: null, x: n.x, y: n.y, zone: n.zone, isGatekeeper: false, isTreasure: true, isPreset: true });
        }
      });
    }

    const availableNodes = level.mapNodes.filter(n => !n.isGatekeeper && !n.isGoal && !n.isPreset);
    let goalTemplate = { id: 'final_gate' }; 
    if (!level.mechanics.isVertical) {
      goalTemplate = level.entities.filter(e => e.id !== level.mechanics.gatekeeperId && e.id !== level.specialEntityTemplate).sort(() => Math.random() - 0.5)[0];
      const goalNode = level.mapNodes.find(n => n.isGoal);
      if (goalNode) {
        const availableReqs = goalTemplate.allowedReqs.filter(req => req !== 'pickaxe');
        const reqs = [...availableReqs].sort(() => Math.random() - 0.5).slice(0, 2);
        activeGatekeepers.push({ ...goalTemplate, requires: reqs, reqType: 'AND', reward: null, x: goalNode.x, y: goalNode.y, zone: goalNode.zone, isGatekeeper: false, id: goalTemplate.id });
      }
    }
    
    const diggerTemplate = level.entities.find(e => e.id === level.specialEntityTemplate);
    const otherTemplates = level.entities.filter(e => e.id !== level.mechanics.gatekeeperId && e.id !== level.specialEntityTemplate);
    
    let selectedOthers = Array.from({length: numDiggers}).map((_, i) => ({...diggerTemplate, id: `${level.specialEntityTemplate}_${i}`}));
    let pool = [...otherTemplates].sort(() => Math.random() - 0.5);
    while (pool.length < availableNodes.length) { pool = [...pool, ...otherTemplates].sort(() => Math.random() - 0.5); }
    selectedOthers = [...selectedOthers, ...pool].slice(0, availableNodes.length).map((e, idx) => ({...e, id: `${e.id}_${idx}`})).sort(() => Math.random() - 0.5);
    
    let puzzleEntities = [...activeGatekeepers, ...presetEntities];
    
    const standardItems = level.items.filter(i => i.id !== 'fish' && i.id !== 'pickaxe' && i.id !== 'key');
    const startItems = [ standardItems[Math.floor(Math.random() * standardItems.length)].id, standardItems[Math.floor(Math.random() * standardItems.length)].id, standardItems[Math.floor(Math.random() * standardItems.length)].id ];
    
    selectedOthers.forEach((e, idx) => {
      const pos = availableNodes[idx]; 
      let reward = standardItems[Math.floor(Math.random() * standardItems.length)].id;
      const availableReqs = e.allowedReqs.filter(req => req !== reward && req !== 'pickaxe' && req !== 'key');
      const numReqs = Math.random() > 0.4 && availableReqs.length >= 2 ? 2 : 1; 
      const reqs = [...availableReqs].sort(() => Math.random() - 0.5).slice(0, numReqs);
      puzzleEntities.push({ ...e, requires: reqs, reqType: 'OR', reward, x: pos.x, y: pos.y, zone: pos.zone, isGatekeeper: false });
    });

    const firstStepEnt = puzzleEntities.find(e => e.zone === 1 && !e.isGatekeeper && !e.isPreset);
    if (firstStepEnt) {
       firstStepEnt.requires = [startItems[0]];
       firstStepEnt.reqType = 'OR';
       if (level.mechanics.hasPickaxe) firstStepEnt.reward = 'pickaxe'; 
    }

    if (level.mechanics.isVertical) {
      const nonGoalNodes = puzzleEntities.filter(e => !e.isGatekeeper && !e.isTreasure && !e.isPreset && e.reward !== 'pickaxe');
      const shuffled = [...nonGoalNodes].sort(() => Math.random() - 0.5);
      for(let i=0; i<3; i++) { if(shuffled[i]) shuffled[i].reward = 'key'; }
    } else if (level.mechanics.hasPickaxe) {
      const z1NonGoal = puzzleEntities.find(e => e.zone === 1 && !e.isGatekeeper && e.id !== goalTemplate.id && e.id !== firstStepEnt?.id);
      if (z1NonGoal) z1NonGoal.reward = 'pickaxe';
    }

    const targetGoalId = level.mechanics.isVertical ? 'final_gate' : goalTemplate.id;
    const solution = solvePuzzle(startItems, puzzleEntities, targetGoalId, level);
    if (solution) {
      if (solution.length >= targetSteps) return { startItems, puzzleEntities, goalEntityId: targetGoalId, solution };
      if (solution.length > maxSteps) { bestPuzzle = { startItems, puzzleEntities, goalEntityId: targetGoalId, solution }; maxSteps = solution.length; }
    }
  } return bestPuzzle;
}

// --- SUB-COMPONENT: ISOLATED GAME INSTANCE ---
function GameInstance({ level, targetSteps, numDiggers, onGenerateNew }) {
  const [puzzle, setPuzzle] = useState(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [inventory, setInventory] = useState([]); 
  const [pickaxeCharges, setPickaxeCharges] = useState(0);
  const [unlockedZones, setUnlockedZones] = useState([1]);
  const [defeated, setDefeated] = useState([]);
  const [selectedItemTypes, setSelectedItemTypes] = useState([]); 
  const [pathHistory, setPathHistory] = useState([{...level.campPos, zone: 1}]);
  const [historyStack, setHistoryStack] = useState([]); 
  const [isVictorious, setIsVictorious] = useState(false);
  const [showTrophy, setShowTrophy] = useState(false);
  const [showVictoryMsg, setShowVictoryMsg] = useState(false);
  const [isDemonstrating, setIsDemonstrating] = useState(false);
  const [isAnimatingLoot, setIsAnimatingLoot] = useState(false);
  const [alertEntityId, setAlertEntityId] = useState(null); 
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [flyingItem, setFlyingItem] = useState(null);
  const [tempPlayerPos, setTempPlayerPos] = useState(null);
  const [envItemState, setEnvItemState] = useState('active'); 
  const [envItemCaughtPos, setEnvItemCaughtPos] = useState({x: 50, y: 50});
  const [schoolsOfFish, setSchoolsOfFish] = useState([]);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState('main'); 
  const [menuSettings, setMenuSettings] = useState({ levelId: level.id, steps: targetSteps, diggers: numDiggers });

  const demoRef = useRef(false);
  const mapRef = useRef(null);
  const Background = level.BackgroundComponent;

  useEffect(() => { 
    setPuzzle(null); setGenerationFailed(false);
    const timer = setTimeout(() => {
      let newPuzzle = generateLevelPuzzle(level, targetSteps, numDiggers);
      if (!newPuzzle && !level.mechanics.isFarming) newPuzzle = generateLevelPuzzle(level, 3, numDiggers); 
      if (!newPuzzle) { setGenerationFailed(true); return; }
      setPuzzle(newPuzzle); setInventory(newPuzzle.startItems || []);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!level.mechanics.hasSchoolsOfFish || isDemonstrating || isVictorious) return;
    const fishTypes = ['red_fish', 'blue_fish', 'green_fish'];
    const spawnFish = () => {
      const id = Date.now() + Math.random(); const type = fishTypes[Math.floor(Math.random() * fishTypes.length)];
      const depth = Math.floor(Math.random() * 3) + 1; const yPos = 10 + depth * 10 + Math.random() * 40; 
      const isRight = Math.random() > 0.5;
      setSchoolsOfFish(prev => [...prev, { id, type, y: yPos, depth, isRight }]);
      setTimeout(() => { setSchoolsOfFish(prev => prev.filter(f => f.id !== id)); }, 10000); 
    };
    const intervalId = setInterval(spawnFish, 2500);
    return () => clearInterval(intervalId);
  }, [level.mechanics.hasSchoolsOfFish, isDemonstrating, isVictorious]);

  const saveHistory = () => { setHistoryStack(prev => [...prev, { inventory: [...inventory], defeated: [...defeated], pathHistory: [...pathHistory], envItemState, pickaxeCharges, unlockedZones: [...unlockedZones] }]); };

  const handleUndo = () => {
    if (historyStack.length === 0 || isDemonstrating || isAnimatingLoot) return;
    const prevState = historyStack[historyStack.length - 1];
    setInventory(prevState.inventory); setDefeated(prevState.defeated); setPathHistory(prevState.pathHistory);
    setEnvItemState(prevState.envItemState); setPickaxeCharges(prevState.pickaxeCharges);
    setUnlockedZones(prevState.unlockedZones);
    setHistoryStack(prev => prev.slice(0, -1)); setSelectedItemTypes([]); setSelectedEntityId(null);
    setFlyingItem(null); setTempPlayerPos(null); setIsVictorious(false); setShowTrophy(false); setShowVictoryMsg(false);
  };

  const resetGameState = () => {
    if (!puzzle) return;
    setInventory(puzzle.startItems || []); setPickaxeCharges(0); setUnlockedZones([1]);
    setDefeated([]); setSelectedItemTypes([]); setSelectedEntityId(null); setPathHistory([{...level.campPos, zone: 1}]);
    setHistoryStack([]); setIsVictorious(false); setShowTrophy(false); setShowVictoryMsg(false);
    setIsDemonstrating(false); setIsAnimatingLoot(false); setAlertEntityId(null); setFlyingItem(null);
    setTempPlayerPos(null); setEnvItemState('active'); setSchoolsOfFish([]);
  };

  const handleReplay = () => { demoRef.current = false; resetGameState(); setIsMenuOpen(false); };

  const handleShowSolution = async () => {
    if (!puzzle || !puzzle.solution || demoRef.current || isAnimatingLoot) return;
    setIsDemonstrating(true); demoRef.current = true; resetGameState(); setIsMenuOpen(false);

    let currentInv = [...(puzzle.startItems || [])]; let currentDefeated = []; let currentPath = [{...level.campPos, zone: 1}];
    let currentZoneSim = 1; let unlockedZonesSim = new Set([1]); let pCharges = 0;

    for (const step of puzzle.solution) {
      if (!demoRef.current) break; 
      if (step.isEnvironmentAction) {
        setEnvItemState('caught'); setEnvItemCaughtPos({x: 50, y: 53});
        await new Promise(r => setTimeout(r, 800));
        setEnvItemState('hidden'); currentInv.push(step.itemId); setInventory([...currentInv]);
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      const entity = puzzle.puzzleEntities.find(e => e.id === step.entityId);
      
      const leftZones = [2, 4];
      const rightZones = [3, 5];
      let waypoints = [];
      if ((leftZones.includes(currentZoneSim) && rightZones.includes(entity.zone)) ||
          (rightZones.includes(currentZoneSim) && leftZones.includes(entity.zone))) {
          if (Math.min(currentZoneSim, entity.zone) >= 4) waypoints.push({ x: 50, y: 80, depth: 3, zone: 6 });
          else waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
      } else if (currentZoneSim === 1 && (leftZones.includes(entity.zone) || rightZones.includes(entity.zone))) {
          waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
      } else if (entity.zone === 1 && (leftZones.includes(currentZoneSim) || rightZones.includes(currentZoneSim))) {
          waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
      } else if (currentZoneSim >= 6 && (leftZones.includes(entity.zone) || rightZones.includes(entity.zone))) {
          waypoints.push({ x: 50, y: 80, depth: 3, zone: 6 });
      } else if (entity.zone >= 6 && (leftZones.includes(currentZoneSim) || rightZones.includes(currentZoneSim))) {
          waypoints.push({ x: 50, y: 80, depth: 3, zone: 6 });
      }
      
      for (let wp of waypoints) {
          currentPath.push(wp); setPathHistory([...currentPath]); currentZoneSim = wp.zone;
          await new Promise(r => setTimeout(r, 400));
      }

      await new Promise(r => setTimeout(r, 600));
      if (step.reqType === 'SPECIAL') { setSelectedItemTypes(['pickaxe']);
      } else if (step.reqType === 'AND') { setSelectedItemTypes(Array.from(new Set(step.usedItems)));
      } else { setSelectedItemTypes([step.itemId]); }

      await new Promise(r => setTimeout(r, 600));
      currentPath.push({x: entity.x, y: entity.y, depth: entity.depth || 3, zone: entity.zone}); setPathHistory([...currentPath]);
      currentZoneSim = entity.zone;
      await new Promise(r => setTimeout(r, 800)); 

      if (step.reqType === 'SPECIAL') { pCharges -= 1; setPickaxeCharges(pCharges); if (pCharges === 0) currentInv.splice(currentInv.indexOf('pickaxe'), 1);
      } else if (step.reqType === 'AND') { step.usedItems.forEach(req => { const idx = currentInv.indexOf(req); if (idx > -1) currentInv.splice(idx, 1); });
      } else { currentInv.splice(currentInv.indexOf(step.itemId), 1); }
      
      setInventory([...currentInv]); setSelectedItemTypes([]); 
      
      if (entity.reward) {
        setFlyingItem({ emoji: level.items.find(i=>i.id===entity.reward).emoji, x: entity.x, y: entity.y });
        await new Promise(r => setTimeout(r, 800)); 
        setFlyingItem(null); currentInv.push(entity.reward);
        if (entity.reward === 'pickaxe') { pCharges = 10; setPickaxeCharges(10); }
        setInventory([...currentInv]);
      }
      
      currentDefeated.push(entity.id); setDefeated([...currentDefeated]); setSelectedEntityId(null);

      if (entity.isGatekeeper && entity.unlocksZones) {
         entity.unlocksZones.forEach(z => unlockedZonesSim.add(z));
         setUnlockedZones(Array.from(unlockedZonesSim));
      }
      if (!level.mechanics.isVertical && entity.id === puzzle.goalEntityId) triggerVictory();
    }
    setIsDemonstrating(false); demoRef.current = false;
  };

  const triggerVictory = () => { setIsVictorious(true); setTimeout(() => setShowTrophy(true), 800); setTimeout(() => setShowVictoryMsg(true), 1000); };

  const handleCatchRiverFish = (e) => {
    e.stopPropagation();
    const uniqueInvCount = Array.from(new Set(inventory)).length;
    if (envItemState !== 'active' || (uniqueInvCount >= 4 && !inventory.includes('fish')) || isDemonstrating || isAnimatingLoot) return;
    saveHistory();
    const parentRect = e.currentTarget.parentElement.getBoundingClientRect();
    setEnvItemCaughtPos({ x: ((e.clientX - parentRect.left) / parentRect.width) * 100, y: ((e.clientY - parentRect.top) / parentRect.height) * 100 });
    setEnvItemState('caught'); setTimeout(() => { setEnvItemState('hidden'); setInventory(prev => [...prev, 'fish']); }, 800);
  };

  const handleCatchSchoolFish = (e, fishObj) => {
    e.stopPropagation();
    const uniqueInvCount = Array.from(new Set(inventory)).length;
    if ((uniqueInvCount >= 4 && !inventory.includes(fishObj.type)) || isDemonstrating || isAnimatingLoot) return;
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    saveHistory(); setIsAnimatingLoot(true);
    setPathHistory(prev => [...prev, { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100, depth: fishObj.depth, zone: currentZone }]);
    setTimeout(() => {
      setSchoolsOfFish(currentFish => {
        if (currentFish.some(f => f.id === fishObj.id)) { setInventory(prev => [...prev, fishObj.type]); return currentFish.filter(f => f.id !== fishObj.id); }
        return currentFish;
      }); setIsAnimatingLoot(false);
    }, 700);
  };

  const handlePassageClick = (passage) => {
    if (isDemonstrating || isAnimatingLoot) return;
    setUnlockedZones(prev => [...new Set([...prev, passage.targetZone])]);
    const arrival = level.passages.find(p => p.zone === passage.targetZone && p.targetZone === passage.zone);
    if (arrival) setPathHistory(prev => [...prev, { x: arrival.x, y: arrival.y, depth: 3, zone: passage.targetZone }]);
  };

  const toggleInventoryType = (itemId) => {
    if (isDemonstrating || isAnimatingLoot) return;
    if (selectedItemTypes.includes(itemId)) setSelectedItemTypes(prev => prev.filter(i => i !== itemId));
    else setSelectedItemTypes(prev => [...prev, itemId]);
  };

  const handleInteract = (entity, e) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot) return;
    
    if (!unlockedZones.includes(entity.zone)) {
       setSelectedItemTypes([]); setSelectedEntityId(null); setIsAnimatingLoot(true); 
       const blockingRock = puzzle.puzzleEntities.find(ent => ent.isGatekeeper && ent.unlocksZones && ent.unlocksZones.includes(entity.zone) && !defeated.includes(ent.id));
       const targetAlert = blockingRock || entity;
       setTempPlayerPos({ x: targetAlert.x, y: targetAlert.y - (level.mechanics.isVertical ? 4 : 0), depth: 3 });
       setTimeout(() => { setAlertEntityId(targetAlert.id); setTimeout(() => { setAlertEntityId(null); setTempPlayerPos(null); setTimeout(() => setIsAnimatingLoot(false), 700); }, 600); }, 700); 
       return;
    }

    const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
    const targetZone = entity.zone;
    const targetX = entity.roamClass ? 50 : entity.x;

    let waypoints = [];
    const leftZones = [2, 4];
    const rightZones = [3, 5];
    
    if ((leftZones.includes(currentZone) && rightZones.includes(targetZone)) ||
        (rightZones.includes(currentZone) && leftZones.includes(targetZone))) {
        if (Math.min(currentZone, targetZone) >= 4) waypoints.push({ x: 50, y: 80, depth: 3, zone: 6 });
        else waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
    } else if (currentZone === 1 && (leftZones.includes(targetZone) || rightZones.includes(targetZone))) {
        waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
    } else if (targetZone === 1 && (leftZones.includes(currentZone) || rightZones.includes(currentZone))) {
        waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
    } else if (currentZone >= 6 && (leftZones.includes(targetZone) || rightZones.includes(targetZone))) {
        waypoints.push({ x: 50, y: 80, depth: 3, zone: 6 });
    } else if (targetZone >= 6 && (leftZones.includes(currentZone) || rightZones.includes(currentZone))) {
        waypoints.push({ x: 50, y: 80, depth: 3, zone: 6 });
    }

    setPathHistory(prev => {
        const lastPos = prev[prev.length - 1];
        if (lastPos.x === targetX && lastPos.y === entity.y) return prev;
        return [...prev, ...waypoints, { x: targetX, y: entity.y, depth: entity.depth || 3, zone: targetZone }];
    });

    if (defeated.includes(entity.id)) return;

    if (entity.isPreset && !entity.isGatekeeper) {
        setIsAnimatingLoot(true); saveHistory();
        setDefeated(prev => {
            const newDef = [...prev, entity.id];
            if (level.mechanics.isVertical && entity.isTreasure) {
                const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
                if (allTreasures.every(t => newDef.includes(t.id))) triggerVictory();
            }
            return newDef;
        });
        
        if (entity.reward) {
            setFlyingItem({ emoji: entity.emoji, x: targetX, y: entity.y, zIndex: 60 });
            setTimeout(() => {
                setInventory(prev => [...prev, entity.reward]);
                setFlyingItem(null); setIsAnimatingLoot(false);
            }, 800);
        } else { setIsAnimatingLoot(false); }
        return;
    }

    if (selectedItemTypes.length === 0 && entity.requires && entity.requires.length > 0) { 
        setSelectedEntityId(prev => prev === entity.id ? null : entity.id); 
        return; 
    }

    let canDefeat = false; let itemsToConsume = []; let spentPickaxeCharge = false;
    const availableItems = [...inventory];
    const takeItems = (reqArray) => {
        let tempAvail = [...availableItems]; let consumed = [];
        for (const req of reqArray) { const idx = tempAvail.indexOf(req); if (idx > -1) { tempAvail.splice(idx, 1); consumed.push(req); } else { return null; } }
        return consumed;
    };

    if (entity.isGatekeeper && level.mechanics.hasPickaxe && entity.reqType === 'SPECIAL') {
       if (entity.reqGk && !defeated.includes(entity.reqGk)) { setSelectedItemTypes([]); return; }
       if (selectedItemTypes.includes('pickaxe') && pickaxeCharges > 0) { canDefeat = true; spentPickaxeCharge = true; if (pickaxeCharges - 1 === 0) itemsToConsume.push('pickaxe'); }
    } else if (entity.reqType === 'AND') {
       if (entity.requires.length === 0 || Array.from(new Set(entity.requires || [])).every(t => selectedItemTypes.includes(t))) { 
           const consumed = takeItems(entity.requires || []); 
           if (consumed) { canDefeat = true; itemsToConsume = consumed; } 
       }
    } else { 
      for (const req of (entity.requires || [])) { if (selectedItemTypes.includes(req) && availableItems.includes(req)) { canDefeat = true; itemsToConsume.push(req); break; } }
    }

    if (canDefeat) {
      setIsAnimatingLoot(true); saveHistory();
      if (spentPickaxeCharge) setPickaxeCharges(prev => prev - 1);
      
      setInventory(prev => {
          let newInv = [...prev];
          itemsToConsume.forEach(itemToDel => { const idx = newInv.indexOf(itemToDel); if (idx > -1) newInv.splice(idx, 1); });
          return newInv;
      });

      setDefeated(prev => {
          const newDef = [...prev, entity.id];
          if (entity.isGatekeeper && entity.unlocksZones) {
              setUnlockedZones(uz => [...new Set([...uz, ...entity.unlocksZones])]);
          }
          return newDef;
      });
      
      setSelectedItemTypes([]); setSelectedEntityId(null);

      if (entity.reward) {
        setFlyingItem({ emoji: level.items.find(i => i.id === entity.reward).emoji, x: targetX, y: entity.y, zIndex: 60 });
        setTimeout(() => {
          setInventory(prev => [...prev, entity.reward]);
          if (entity.reward === 'pickaxe') setPickaxeCharges(10);
          setFlyingItem(null); setIsAnimatingLoot(false); 
          if (!level.mechanics.isVertical && entity.id === puzzle.goalEntityId) triggerVictory();
        }, 800);
      } else { setIsAnimatingLoot(false); if (!level.mechanics.isVertical && entity.id === puzzle.goalEntityId) triggerVictory(); }

    } else { setSelectedItemTypes([]); }
  };

  const renderMenu = () => {
    if (!isMenuOpen) return null;
    return (
      <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif">
        <div className="bg-stone-800 border-4 border-stone-600 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 text-stone-200">
          {menuView === 'main' ? (
            <>
              <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">Menu</h2>
              <button onClick={handleReplay} className="w-full bg-stone-600 py-4 rounded-xl font-bold text-xl hover:bg-stone-500 shadow-lg border-b-4 border-stone-800 active:border-b-0 active:translate-y-1">↺ Restart Level</button>
              {!level.mechanics.isFarming && ( <button onClick={handleShowSolution} disabled={isVictorious || isDemonstrating || isAnimatingLoot || !puzzle} className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-xl hover:bg-indigo-500 shadow-lg border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 disabled:opacity-50">💡 Show Solution</button> )}
              <button onClick={() => setMenuView('settings')} className="w-full bg-amber-600 py-4 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1">🗺️ Generate New Map</button>
              <button onClick={() => setIsMenuOpen(false)} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">Resume Game</button>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">Settings</h2>
              <div className="space-y-4">
                <label className="flex flex-col gap-2 font-bold text-lg pt-2">
                  <span>Level:</span> 
                  <select className="w-full bg-stone-900 border-2 border-stone-600 rounded-lg p-3 outline-none focus:border-amber-500 text-amber-400" value={menuSettings.levelId} onChange={(e) => setMenuSettings({...menuSettings, levelId: e.target.value})}>{Object.values(LEVEL_DICTIONARY).map(lvl => <option key={lvl.id} value={lvl.id}>{lvl.name}</option>)}</select>
                </label>
                {!LEVEL_DICTIONARY[menuSettings.levelId].mechanics.isFarming && ( <label className="flex flex-col gap-2 font-bold text-lg pt-2"><span className="flex justify-between"><span>Minimum Quest Chain:</span> <span className="text-amber-400">{menuSettings.steps}</span></span><input type="range" min="3" max="8" value={menuSettings.steps} onChange={(e) => setMenuSettings({...menuSettings, steps: parseInt(e.target.value)})} className="w-full accent-amber-500 h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer" /></label> )}
                <label className="flex flex-col gap-2 font-bold text-lg"><span className="flex justify-between"><span>Diggers (Memory Mode):</span> <span className="text-amber-400">{menuSettings.diggers}</span></span><input type="range" min="0" max="3" value={menuSettings.diggers} onChange={(e) => setMenuSettings({...menuSettings, diggers: parseInt(e.target.value)})} className="w-full accent-amber-500 h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer" /></label>
                <button onClick={() => onGenerateNew(menuSettings)} className="w-full bg-amber-600 py-4 mt-2 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1">🗺️ Generate Map</button>
              </div>
              <button onClick={() => setMenuView('main')} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">Back</button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (generationFailed) return (
     <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative p-4 text-center">
       <div className="text-red-500 text-3xl font-black mb-4">Generation Failed</div>
       <div className="text-stone-300 max-w-md">It was mathematically impossible to generate a realm with these exact settings.</div>
       <button onClick={() => { setMenuView('settings'); setIsMenuOpen(true); }} className="mt-8 bg-stone-700 p-4 rounded-xl text-white font-bold hover:bg-stone-600 transition-colors z-[100] relative">Open Settings</button>
       {renderMenu()}
     </div>
  );

  if (!puzzle) return <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative">
     <div className="absolute inset-0 bg-stone-900 opacity-80 z-40 backdrop-blur" />
     <div className="text-amber-500 text-3xl font-black z-50 animate-pulse tracking-widest uppercase shadow-black drop-shadow-lg border-y-2 border-amber-500 py-4 px-12">Generating Realm...</div>
  </div>;

  const playerPos = pathHistory[pathHistory.length - 1];
  const displayPlayerPos = tempPlayerPos || playerPos;
  const playerDepth = displayPlayerPos.depth || 3;
  const playerScale = playerDepth === 1 ? 'scale-50' : playerDepth === 2 ? 'scale-75' : 'scale-100';
  const playerFilter = playerDepth === 1 ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : playerDepth === 2 ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
  const playerZ = playerDepth * 10 + 5; 
  const uniqueInventoryItems = Array.from(new Set(inventory));

  const totalMapHeight = level.mechanics.isVertical ? `${level.mechanics.screens * 100}%` : '100%';

  let mapTranslateY = '0%';
  if (level.mechanics.isVertical) {
      const screenPct = 100 / level.mechanics.screens; // 25% for 4 screens
      const maxScrollPct = 100 - screenPct; // 75% max translation
      
      let targetScroll = displayPlayerPos.y - (screenPct / 2); 
      if (targetScroll < 0) targetScroll = 0; 
      if (targetScroll > maxScrollPct) targetScroll = maxScrollPct; 
      
      mapTranslateY = `-${targetScroll}%`;
  }

  const GatekeeperProp = level.GatekeeperPropComponent;

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-2 sm:p-4 font-serif select-none overflow-hidden relative">
      <div ref={mapRef} className="relative w-full max-w-4xl h-[70vh] sm:h-[75vh] bg-[#dcb27b] rounded-2xl shadow-[inset_0_0_80px_rgba(100,50,0,0.6),0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden border-8 border-amber-900/80 ring-4 ring-stone-950">
        
        <div className="absolute inset-x-0 top-0 transition-transform duration-1000 ease-in-out pointer-events-auto animate-map-appear" style={{ height: totalMapHeight, transform: `translateY(${mapTranslateY})` }}>
          <Background />
          
          {/* Old Fog of War used for non-radial levels */}
          {level.mechanics.hasDarkness && level.mechanics.darknessType === 'horizontal' && (
            <>
              <div className={`absolute inset-y-0 left-0 w-1/2 bg-black transition-all duration-1000 z-[90] pointer-events-none ${unlockedZones.includes(1) ? 'opacity-0' : 'opacity-100 pointer-events-auto'}`} />
              <div className={`absolute inset-y-0 right-0 w-1/2 bg-black transition-all duration-1000 z-[90] pointer-events-none ${unlockedZones.includes(2) ? 'opacity-0' : 'opacity-100 pointer-events-auto'}`} />
            </>
          )}

          {/* New Radial Illumination Layer for Underground */}
          {level.mechanics.hasDarkness && level.mechanics.darknessType === 'radial' && (
            <div
              className="absolute inset-0 pointer-events-none z-[85] transition-all duration-300 ease-linear animate-torch-flicker"
              style={{
                background: `radial-gradient(ellipse 40vw 50vh at ${displayPlayerPos.x}% ${displayPlayerPos.y}%, transparent 0%, transparent 15%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.95) 60%, #000 100%)`
              }}
            />
          )}

          {level.sceneryNodes?.map((sc, i) => ( <div key={`sc-${i}`} className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${sc.s} pointer-events-none`} style={{ left: `${sc.x}%`, top: `${sc.y}%`, zIndex: (sc.depth||3)*10 }}>{sc.e}</div> ))}

          {/* Render Fish Interactions */}
          {level.mechanics.hasFish && envItemState === 'active' && ( <div className="absolute cursor-pointer text-3xl animate-fish-swim hover:scale-125 transition-transform" style={{zIndex: 25}} onClick={handleCatchRiverFish}>🐟</div> )}
          {level.mechanics.hasFish && envItemState === 'caught' && ( <div className="absolute flex flex-col items-center animate-loot-fly pointer-events-none drop-shadow-xl" style={{ left: `${envItemCaughtPos.x}%`, top: `${envItemCaughtPos.y}%`, zIndex: 90 }}><span className="text-3xl">🐟</span><span className="text-xs font-bold text-white bg-blue-500/80 px-2 py-0.5 rounded-full mt-1">CAUGHT!</span></div> )}

          {schoolsOfFish.map(f => {
             const fScale = f.depth === 1 ? 'scale-50' : f.depth === 2 ? 'scale-75' : 'scale-100';
             const fFilter = f.depth === 1 ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : f.depth === 2 ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
             return (
               <div key={f.id} onClick={(e) => handleCatchSchoolFish(e, f)} className={`absolute cursor-pointer text-4xl transition-transform hover:brightness-150 ${f.isRight ? 'animate-[swimRight_10s_linear_forwards]' : 'animate-[swimLeft_10s_linear_forwards]'}`} style={{ top: `${f.y}%`, zIndex: f.depth * 10 + 5 }}>
                 <div className={`inline-block ${f.isRight ? 'scale-x-[-1]' : ''} ${fScale} ${fFilter}`}>{level.items.find(i => i.id === f.type)?.emoji}</div>
               </div>
             );
          })}

          {!level.mechanics.noPath && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md z-10" preserveAspectRatio="none">
              {pathHistory.map((pos, i) => { if (i === 0) return null; const prev = pathHistory[i - 1]; return <line key={i} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${pos.x}%`} y2={`${pos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" className="animate-[dash_1s_linear_forwards]" style={{ strokeDashoffset: 100 }} vectorEffect="non-scaling-stroke" />; })}
              {tempPlayerPos && <line x1={`${playerPos.x}%`} y1={`${playerPos.y}%`} x2={`${tempPlayerPos.x}%`} y2={`${tempPlayerPos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" opacity="0.5" vectorEffect="non-scaling-stroke" />}
            </svg>
          )}
          {!level.mechanics.noPath && ( <div className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${level.campPos.x}%`, top: `${level.campPos.y}%` }}><div className="text-4xl drop-shadow-lg filter sepia">⛺</div></div> )}

          {flyingItem && ( <div className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${flyingItem.x}%`, top: `${flyingItem.y}%`, zIndex: flyingItem.zIndex || 90 }}>{flyingItem.emoji}</div> )}

          {puzzle.puzzleEntities.map(ent => {
            const isDefeated = defeated.includes(ent.id); const isGoal = ent.id === puzzle.goalEntityId;
            const rewardItem = ent.reward ? level.items.find(i => i.id === ent.reward) : null;
            const isAlerting = alertEntityId === ent.id; const isSelected = selectedEntityId === ent.id;
            const depthScale = (ent.depth === 1) ? 'scale-50' : (ent.depth === 2) ? 'scale-75' : 'scale-100';
            const depthFilter = (ent.depth === 1) ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : (ent.depth === 2) ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
            const entZ = isSelected ? 50 : (ent.depth || 3) * 10 + 5;
            const groupedReqs = (ent.requires || []).reduce((acc, reqId) => { acc[reqId] = (acc[reqId] || 0) + 1; return acc; }, {});
            const entityStyle = ent.roamClass ? { top: `${ent.y}%`, zIndex: entZ } : { left: `${ent.x}%`, top: `${ent.y}%`, zIndex: entZ };
            
            const isDigger = Boolean(level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !level.mechanics.isFarming);
            const isRock = ent.isGatekeeper && level.mechanics.hasPickaxe && ent.id !== 'final_gate';
            
            const interactableHover = (isDefeated && !ent.isGatekeeper) || isRock ? 'cursor-default' : 'hover:scale-110 cursor-pointer';
            const wrapperClasses = `absolute flex flex-col items-center p-4 -m-4 transition-transform duration-300 ${ent.roamClass ? ent.roamClass : 'transform -translate-x-1/2 -translate-y-1/2'} ${interactableHover}`;

            const isNearLeft = !ent.roamClass && ent.x <= 20;
            const isNearRight = !ent.roamClass && ent.x >= 80;
            const isNearTop = ent.y <= 10;
            const tooltipAlign = isNearLeft ? "left-0" : isNearRight ? "right-0" : "left-1/2 -translate-x-1/2";
            const tooltipY = isNearTop ? "top-full mt-2" : "bottom-full mb-2";
            const arrowAlign = isNearLeft ? "left-4" : isNearRight ? "right-4" : "left-1/2 -translate-x-1/2";
            const arrowY = isNearTop ? "-top-[7px] border-t-2 border-l-2" : "-bottom-[7px] border-b-2 border-r-2";
            
            const pathStepsInOrPastZone = pathHistory.filter(p => p.zone === ent.zone).length;
            const isBuried = isDigger && unlockedZones.includes(ent.zone) && pathStepsInOrPastZone > 1;

            return (
              <div key={ent.id} onClick={(e) => handleInteract(ent, e)} className={wrapperClasses} style={entityStyle}>
                <div className={`relative ${depthScale} ${depthFilter}`}>
                    {!isDefeated && isSelected && !ent.isPreset && (
                      <div className={`absolute ${tooltipY} ${tooltipAlign} z-[100]`}>
                        <div className="relative bg-white border-2 border-stone-800 rounded-2xl px-3 py-1.5 flex items-center shadow-xl text-lg font-bold whitespace-nowrap animate-bounce gap-1">
                          {ent.id === 'final_gate' ? (
                            <>
                               <span className="emoji-shadow">🔑</span><span className="text-sm font-black text-amber-600 shadow-none ml-1">x3</span>
                            </>
                          ) : isRock ? (
                            <>
                               <span className="emoji-shadow">⛏️</span><span className="text-sm font-black text-amber-600 shadow-none ml-1">x1</span>
                            </>
                          ) : (
                            Object.entries(groupedReqs).map(([reqId, count], i, arr) => (
                              <React.Fragment key={reqId}>
                                <span className="flex items-center gap-1 emoji-shadow" title={level.items.find(item => item.id === reqId)?.name || reqId}>
                                  {count > 1 && <span className="text-sm font-black text-amber-600" style={{textShadow: 'none'}}>{count}x</span>}
                                  {level.items.find(item => item.id === reqId)?.emoji || '❓'}
                                </span>
                                {i < arr.length - 1 && <span className="text-sm mx-1 text-stone-500 font-black">{ent.reqType === 'AND' ? '&' : 'או'}</span>}
                              </React.Fragment>
                            ))
                          )}
                          <div className={`absolute ${arrowY} ${arrowAlign} w-3 h-3 bg-white border-stone-800 rotate-45`}></div>
                        </div>
                      </div>
                    )}
                    <div className="relative">
                      {ent.isGatekeeper && !isRock && GatekeeperProp && <GatekeeperProp />}
                      
                      <div className={`relative transition-all duration-700 ease-in-out ${(!isRock && ent.isGatekeeper && isDefeated) ? 'translate-x-12 translate-y-6 rotate-12 opacity-60 grayscale' : (!isRock && ent.isGatekeeper && isSelected) ? 'translate-x-8 translate-y-2 rotate-3' : (!isRock && isDefeated) ? 'opacity-50 grayscale' : ''}`}>
                        
                        {!isDefeated && rewardItem && !isGoal && !ent.isRepeatable && !ent.isPreset && (
                          isBuried ? (
                            <>
                              <div className={`absolute top-0 left-0 text-4xl drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${ent.x > 50 ? '-translate-x-12' : 'translate-x-12'} translate-y-2 scale-90 opacity-90 -z-20`}>🕳️</div>
                              <div className={`absolute top-0 left-0 text-4xl drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${isSelected ? `${ent.x > 50 ? '-translate-x-16' : 'translate-x-16'} -translate-y-4 rotate-12 scale-110 z-0 opacity-100` : `${ent.x > 50 ? '-translate-x-12' : 'translate-x-12'} translate-y-2 scale-0 opacity-0 -z-10`}`}>❓</div>
                            </>
                          ) : (
                            <div className={`absolute top-0 left-0 text-4xl drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${isSelected ? `${ent.x > 50 ? '-translate-x-10' : 'translate-x-10'} -translate-y-4 rotate-12 scale-110 z-0` : `${ent.x > 50 ? '-translate-x-8' : 'translate-x-8'} translate-y-0 rotate-0 scale-90 opacity-90 -z-10 animate-bob`}`}>{rewardItem.emoji}</div>
                          )
                        )}
                        
                        <div className={`drop-shadow-xl relative z-10 ${ent.isGatekeeper ? 'text-6xl' : 'text-4xl'} ${isGoal ? 'text-purple-900 scale-125' : ''}`}>
                           {isRock && !isDefeated ? (
                             <div className={`text-4xl flex gap-1 justify-center items-end group-hover:scale-110 transition-transform cursor-pointer ${isAlerting ? 'animate-troll-mad' : ''}`}>
                               <span className="scale-90 rotate-6">🪨</span>
                               <span className="scale-110 -translate-y-2 -rotate-6 z-10">🪨</span>
                               <span className="scale-95 rotate-12">🪨</span>
                             </div>
                           ) : isRock && isDefeated ? (
                             <div className="relative group text-3xl flex gap-1 translate-y-4 cursor-pointer z-50 animate-rock-shatter">
                               <span className="scale-75 -rotate-12">🪨</span>
                               <span className="scale-50 translate-y-2 rotate-45 z-10">🪨</span>
                               <span className="scale-75 rotate-12">🪨</span>
                             </div>
                           ) : (
                             <div className={`${ent.filterClass || ''} ${ent.isRight ? 'scale-x-[-1]' : ''}`}>{isAlerting ? '😡' : ent.emoji}</div>
                           )}
                        </div>
                      </div>
                    </div>
                    {ent.isGatekeeper && isAlerting && <div className="absolute -bottom-5 bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded border border-red-900 shadow-md scale-110 z-30">BLOCKED!</div>}
                    {isGoal && !isDefeated && !isAlerting && <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-purple-950 font-black tracking-widest text-lg drop-shadow-md z-30 bg-amber-100/80 px-2 rounded">יציאה</div>}
                </div>
              </div>
            );
          })}

          <div className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-in-out pointer-events-none flex items-center justify-center ${playerScale} ${playerFilter}`} style={{ left: `${displayPlayerPos.x}%`, top: `${displayPlayerPos.y}%`, zIndex: Math.max(playerZ, 130) }}>
            <div className={`text-white w-10 h-10 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.8)] text-2xl relative ${level.mechanics.noPath ? 'bg-cyan-600 border-2 border-cyan-200' : 'bg-blue-600 border-2 border-white'} ${level.mechanics.heroBobs ? 'animate-bob' : ''}`}>
              🤠
              {level.mechanics.darknessType === 'radial' && <div className="absolute -right-3 -bottom-2 text-xl z-50 drop-shadow-[0_0_10px_rgba(251,191,36,1)]">🕯️</div>}
            </div>
            {showTrophy && <div className="absolute -right-8 top-0 text-4xl animate-bounce drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" style={{animationDelay: '0.2s'}}>🏆</div>}
          </div>

        </div>

        {/* UI Overlay guaranteed on top */}
        <div className="absolute inset-0 opacity-10 z-[140] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#5c3a21 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <button onClick={(e) => { e.stopPropagation(); setMenuView('main'); setIsMenuOpen(true); }} className="absolute top-4 right-4 z-[150] bg-stone-800 text-stone-200 w-12 h-12 flex items-center justify-center rounded-full border-2 border-stone-600 shadow-lg hover:bg-stone-700 transition-colors"><span className="text-xl pt-0.5">⚙️</span></button>

        {showVictoryMsg && (
          <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
            {[...Array(30)].map((_, i) => ( <div key={i} className="absolute text-3xl animate-star-burst-infinite" style={{ left: `${10 + Math.random() * 80}%`, top: `${10 + Math.random() * 80}%`, '--tx': `${(Math.random() - 0.5) * 200}px`, '--ty': `${(Math.random() - 0.5) * 200}px`, animationDelay: `${Math.random() * 3}s` }}>{['⭐', '🌟', '✨'][Math.floor(Math.random() * 3)]}</div> ))}
            <div className="absolute top-1/2 left-1/2 z-50 pointer-events-none animate-fade-out-up"><div className="bg-amber-100 p-6 rounded-3xl border-8 border-amber-600 text-center shadow-[0_0_80px_rgba(251,191,36,0.6)] whitespace-nowrap"><h2 className="text-3xl sm:text-4xl text-amber-900 font-black uppercase tracking-wider">Quest Complete!</h2></div></div>
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl mt-4 bg-stone-800 p-4 rounded-2xl border-4 border-stone-700 shadow-2xl flex items-center justify-center gap-4 h-28 relative z-[150]">
        <button onClick={handleUndo} disabled={isDemonstrating || isAnimatingLoot || historyStack.length === 0} className="bg-rose-700 p-3 sm:p-4 rounded-xl text-xl sm:text-2xl hover:bg-rose-600 border-4 border-rose-600 hover:border-rose-500 transition-all shadow-lg text-white disabled:opacity-50">↩️</button>
        <div className="flex gap-2 sm:gap-4 bg-stone-900/50 p-2 sm:p-3 rounded-xl border-2 border-stone-900">
          {[0, 1, 2, 3].map((slotIdx) => {
            const itemId = uniqueInventoryItems[slotIdx]; const item = itemId ? level.items.find(x => x.id === itemId) : null;
            const count = itemId ? inventory.filter(i => i === itemId).length : 0; const isSelected = item && selectedItemTypes.includes(itemId);
            return (
              <button key={`slot-${slotIdx}`} onClick={() => item && toggleInventoryType(itemId)} disabled={!item} className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl relative flex flex-col items-center justify-center transition-all ${isSelected ? 'bg-amber-400 border-4 border-amber-200 scale-110 shadow-[0_0_20px_rgba(251,191,36,0.6)] z-10' : item ? 'bg-stone-600 border-4 border-stone-500 hover:bg-stone-500 cursor-pointer' : 'bg-stone-700/50 border-4 border-stone-700 border-dashed cursor-default'} ${isDemonstrating || isAnimatingLoot ? 'cursor-default' : ''}`}>
                <span className="text-2xl sm:text-4xl drop-shadow-md">{item ? item.emoji : ''}</span>
                {item?.id === 'pickaxe' && <div className="absolute -top-2 -right-2 bg-stone-800 text-amber-400 text-xs font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-stone-500 shadow-md">{pickaxeCharges}</div>}
                {count > 1 && item?.id !== 'pickaxe' && <div className="absolute -bottom-2 -right-2 bg-blue-700 text-white text-xs sm:text-sm font-black rounded-full px-2 py-0.5 border-2 border-blue-400 shadow-md">{count}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {renderMenu()}
    </div>
  );
}

// --- APP ENTRY POINT ---
export default function App() {
  const [activeSettings, setActiveSettings] = useState({ levelId: 'underground', steps: 5, diggers: 1 });
  const [gameKey, setGameKey] = useState(0);

  const applyAndGenerate = (newSettings) => {
    setActiveSettings(newSettings);
    setGameKey(k => k + 1); 
  };

  return (
    <>
      <GameInstance key={`${activeSettings.levelId}-${gameKey}`} level={LEVEL_DICTIONARY[activeSettings.levelId]} targetSteps={activeSettings.steps} numDiggers={activeSettings.diggers} onGenerateNew={applyAndGenerate} />
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash { to { stroke-dashoffset: 0; } }
        @keyframes fadeOutUp { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.8); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); } 25% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 75% { opacity: 1; transform: translate(-50%, -60%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -100%) scale(0.9); } }
        .animate-fade-out-up { animation: fadeOutUp 3s ease-in-out forwards; }
        
        /* New Rock Break Animation */
        @keyframes rockShatter { 0% { transform: scale(1); filter: brightness(1); } 20% { transform: scale(1.3) rotate(10deg); filter: brightness(1.5); } 100% { transform: scale(0.7) translateY(16px); filter: grayscale(100%); opacity: 0.5; } }
        .animate-rock-shatter { animation: rockShatter 0.6s ease-out forwards; }
        
        @keyframes torchFlicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.95; } }
        .animate-torch-flicker { animation: torchFlicker 3s ease-in-out infinite; }
        @keyframes madShake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-5deg); } 20% { transform: translate(-3px, 0px) rotate(5deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(5deg); } 50% { transform: translate(-1px, 2px) rotate(-5deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-5deg); } 80% { transform: translate(-1px, -1px) rotate(5deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-5deg); } }
        .animate-troll-mad { animation: madShake 0.4s cubic-bezier(.36,.07,.19,.97) both; filter: drop-shadow(0 0 15px rgba(220, 38, 38, 0.8)); }
        @keyframes dogDig { 0%, 100% { transform: rotate(0deg) translateY(0); } 10%, 30%, 50%, 70%, 90% { transform: rotate(-15deg) translateY(-3px); } 20%, 40%, 60%, 80% { transform: rotate(15deg) translateY(3px); } }
        .animate-dog-dig { animation: dogDig 0.7s ease-in-out; }
        @keyframes lootFly { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 30% { transform: translate(-50%, -150%) scale(1.5); opacity: 1; } 100% { transform: translate(-50%, 75vh) scale(0.5); opacity: 0; } }
        .animate-loot-fly { animation: lootFly 0.8s cubic-bezier(0.5, 0, 0.2, 1) forwards; }
        @keyframes mapAppear { 0% { opacity: 0; filter: blur(4px); } 100% { opacity: 1; filter: blur(0); } }
        .animate-map-appear { animation: mapAppear 0.5s ease-out forwards; }
        @keyframes riverFlow { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
        .animate-river-flow { animation: riverFlow 2s linear infinite; }
        @keyframes starBurstInfinite { 0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 1; } 50% { opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(1.5) rotate(180deg); opacity: 0; } }
        .animate-star-burst-infinite { animation: starBurstInfinite 2.5s cubic-bezier(0.25, 1, 0.5, 1) infinite; }
        @keyframes fishSwim { 0% { left: -10%; top: 53%; transform: translate(-50%, -50%) scaleX(-1); } 12% { left: 25%; top: 48%; transform: translate(-50%, -50%) scaleX(-1); } 22% { left: 50%; top: 53%; transform: translate(-50%, -50%) scaleX(-1); } 34% { left: 75%; top: 58%; transform: translate(-50%, -50%) scaleX(-1); } 45% { left: 110%; top: 53%; transform: translate(-50%, -50%) scaleX(-1); } 50% { left: 110%; top: 53%; transform: translate(-50%, -50%) scaleX(1); } 62% { left: 75%; top: 58%; transform: translate(-50%, -50%) scaleX(1); } 72% { left: 50%; top: 53%; transform: translate(-50%, -50%) scaleX(1); } 84% { left: 25%; top: 48%; transform: translate(-50%, -50%) scaleX(1); } 95% { left: -10%; top: 53%; transform: translate(-50%, -50%) scaleX(1); } 100% { left: -10%; top: 53%; transform: translate(-50%, -50%) scaleX(-1); } }
        .animate-fish-swim { animation: fishSwim 18s linear infinite; }
        @keyframes bubble { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 0.5; } 100% { transform: translateY(-100px); opacity: 0; } }
        .animate-bubble { animation: bubble 4s linear infinite; }
        @keyframes sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        .animate-sway { animation: sway 4s ease-in-out infinite; transform-origin: bottom; }
        @keyframes swaySlow { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        .animate-sway-slow { animation: swaySlow 6s ease-in-out infinite; transform-origin: bottom; }
        @keyframes swimRight { 0% { left: -20%; transform: translate(-50%, -50%); } 100% { left: 120%; transform: translate(-50%, -50%); } }
        @keyframes swimLeft { 0% { left: 120%; transform: translate(-50%, -50%); } 100% { left: -20%; transform: translate(-50%, -50%); } }
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-bob { animation: bob 3s ease-in-out infinite; }
        .emoji-shadow { text-shadow: 0px 0px 3px rgba(0,0,0,0.8), 0px 0px 8px rgba(0,0,0,0.4); }
      `}} />
    </>
  );
}
