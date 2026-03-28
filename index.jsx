import React, { useState, useEffect, useRef, Fragment, useMemo, useCallback } from 'react';

const MAX_UNIQUE_ITEMS = 4;
const MAX_AIR = 6;
const SOLVER_MAX_ITERS = 25000;
const SOLVER_TIME_LIMIT_MS = 1200;
const GENERATOR_MAX_ATTEMPTS = 5000;
const NAV_OFFSET = 3.5;

const STRINGS = {
  en: {
    menu: "Menu", restart: "↺ Restart Level", showSolution: "💡 Show Solution", generateMap: "🗺️ Generate New Map", resume: "Resume Game",
    settings: "Settings", level: "Level:", minQuestChain: "Minimum Quest Chain:", diggersMemory: "Diggers (Memory Mode):", genMap: "🗺️ Generate Map", back: "Back",
    genFailedTitle: "Generation Failed", genFailedDesc: "{dict.genFailedDesc}", openSettings: "Open Settings",
    generating: "Generating Realm...", floatingUp: "🫧 Floating Up! 🫧", dropItem: "⬇️ Drop Item", blocked: "BLOCKED!", exit: "Exit", questComplete: "Quest Complete!",
    entities: { troll: 'Troll', baker: 'Baker', spider: 'Spider', chest: 'Chest', wizard: 'Wizard', dragon: 'Dragon', dog: 'Hound', goblin: 'Goblin', mermaid: 'Mermaid', ghost: 'Ghost', knight: 'Knight', merchant: 'Merchant', fairy: 'Fairy', bear: 'Bear', miner: 'Miner', scorpion: 'Scorpion', bat: 'Vampire Bat', slime: 'Acid Slime', mole: 'Giant Mole', diver: 'Diver', crab: 'Crab', octopus: 'Octopus', seahorse: 'Seahorse', caveBoss: 'Cave Boss', vaultGate: 'Vault Gate', rock: 'Rock', current: 'Current' },
    items: { apple: 'Apple', bread: 'Bread', gold: 'Gold', gem: 'Gem', sword: 'Sword', bug_spray: 'Poison', key: 'Key', wand: 'Wand', hat: 'Hat', bone: 'Bone', shield: 'Shield', map: 'Map', lantern: 'Lantern', flute: 'Flute', flower: 'Flower', fish: 'Fish', crystal: 'Crystal', gold_nugget: 'Gold Nugget', mushroom: 'Mushroom', emerald: 'Emerald', relic: 'Relic', rope: 'Rope', pickaxe: 'Pickaxe', pearl: 'Pearl', shell: 'Shell', starfish: 'Starfish', trident: 'Trident', comb: 'Comb', mirror: 'Mirror', boot: 'Old Boot' },
    levels: { river_crossing: 'River Crossing', underground: 'The Deep Chasm', underwater: 'Deep Blue' },
    or: "or"
  },
  he: {
    menu: "תפריט", restart: "↺ התחל מחדש", showSolution: "💡 הצג פתרון", generateMap: "🗺️ צור מפה חדשה", resume: "חזור למשחק",
    settings: "הגדרות", level: "שלב:", minQuestChain: "שרשרת משימות מינימלית:", diggersMemory: "חופרים (מצב זיכרון):", genMap: "🗺️ צור מפה", back: "חזור",
    genFailedTitle: "היצירה נכשלה", genFailedDesc: "אי אפשר מתמטית ליצור עולם עם הגדרות אלו.", openSettings: "פתח הגדרות",
    generating: "יוצר עולם...", floatingUp: "🫧 צף למעלה! 🫧", dropItem: "⬇️ זרוק חפץ", blocked: "חסום!", exit: "יציאה", questComplete: "המסע הושלם!",
    entities: { troll: 'טרול', baker: 'אופה', spider: 'עכביש', chest: 'תיבה', wizard: 'קוסם', dragon: 'דרקון', dog: 'כלב ציד', goblin: 'גובלין', mermaid: 'בת ים', ghost: 'רוח רפאים', knight: 'אביר', merchant: 'סוחר', fairy: 'פיה', bear: 'דוב', miner: 'כורה', scorpion: 'עקרב', bat: 'עטלף ערפד', slime: 'רפש חומצי', mole: 'חפרפרת ענק', diver: 'צוללן', crab: 'סרטן', octopus: 'תמנון', seahorse: 'סוס ים', caveBoss: 'בוס מערה', vaultGate: 'שער כספת', rock: 'סלע', current: 'זרם' },
    items: { apple: 'תפוח', bread: 'לחם', gold: 'זהב', gem: 'יהלום', sword: 'חרב', bug_spray: 'רעל', key: 'מפתח', wand: 'שרביט', hat: 'כובע', bone: 'עצם', shield: 'מגן', map: 'מפה', lantern: 'פנס', flute: 'חליל', flower: 'פרח', fish: 'דג', crystal: 'קריסטל', gold_nugget: 'גוש זהב', mushroom: 'פטרייה', emerald: 'ברקת', relic: 'שריד', rope: 'חבל', pickaxe: 'מכוש', pearl: 'פנינה', shell: 'צדף', starfish: 'כוכב ים', trident: 'קלשון', comb: 'מסרק', mirror: 'מראה', boot: 'מגף ישן' },
    levels: { river_crossing: 'חציית הנהר', underground: 'התהום העמוקה', underwater: 'הכחול העמוק' },
    or: "או"
  }
};

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
  { id: 'bone', name: 'Bone', emoji: '🦴' }, { id: 'gem', name: 'Gem', emoji: '💎' }, 
  { id: 'pickaxe', name: 'Pickaxe', emoji: '⛏️' }
];

const UNDERWATER_ITEMS = [
  { id: 'pearl', name: 'Pearl', emoji: '⚪' }, { id: 'shell', name: 'Shell', emoji: '🐚' },
  { id: 'starfish', name: 'Starfish', emoji: '⭐' }, { id: 'trident', name: 'Trident', emoji: '🔱' },
  { id: 'comb', name: 'Comb', emoji: '🪮' }, { id: 'mirror', name: 'Mirror', emoji: '🪞' },
  { id: 'boot', name: 'Old Boot', emoji: '🥾' }
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
  { id: 'miner', name: 'Miner', emoji: '👷', allowedReqs: ['rope', 'mushroom', 'gold_nugget', 'crystal', 'gem', 'bone'] },
  { id: 'scorpion', name: 'Scorpion', emoji: '🦂', allowedReqs: ['bone', 'crystal', 'gold_nugget', 'emerald', 'gem', 'rope'] },
  { id: 'spider', name: 'Giant Spider', emoji: '🕷️', allowedReqs: ['rope', 'bone', 'emerald', 'relic', 'mushroom'] },
  { id: 'bat', name: 'Vampire Bat', emoji: '🦇', allowedReqs: ['relic', 'mushroom', 'bone', 'crystal', 'rope', 'gold_nugget'] },
  { id: 'slime', name: 'Acid Slime', emoji: '🦠', allowedReqs: ['crystal', 'bone', 'mushroom', 'gem', 'relic'] },
  { id: 'ghost', name: 'Miner Ghost', emoji: '👻', allowedReqs: ['gold_nugget', 'bone', 'emerald', 'rope', 'crystal'] },
  { id: 'mole', name: 'Giant Mole', emoji: '🐭', allowedReqs: ['mushroom', 'relic', 'crystal', 'gold_nugget', 'bone', 'emerald'] },
  { id: 'goblin', name: 'Cave Goblin', emoji: '👺', allowedReqs: ['gold_nugget', 'gem', 'mushroom', 'emerald', 'rope'] },
];

const UNDERWATER_ENTITIES = [
  { id: 'diver', name: 'Diver', emoji: '🤿', allowedReqs: ['comb', 'mirror', 'boot'] },
  { id: 'mermaid', name: 'Mermaid', emoji: '🧜‍♀️', allowedReqs: ['comb', 'mirror', 'boot', 'starfish'] },
  { id: 'crab', name: 'Crab', emoji: '🦀', allowedReqs: ['shell', 'pearl', 'boot'] },
  { id: 'octopus', name: 'Octopus', emoji: '🐙', allowedReqs: ['trident', 'pearl', 'starfish'] },
  { id: 'seahorse', name: 'Seahorse', emoji: '🎠', allowedReqs: ['shell', 'comb', 'pearl'] }
];

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
      <path d="M 0 0 L 35 0 L 32 5 L 36 10 L 35 15 L 25 18 L 12 22 L 15 30 L 10 40 L 14 50 L 9 60 L 13 70 L 12 75 L 20 78 L 35 82 L 32 85 L 35 88 L 25 90 L 10 92 L 12 96 L 10 100 L 0 100 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path d="M 100 0 L 65 0 L 68 5 L 64 10 L 65 15 L 75 18 L 88 22 L 85 30 L 90 40 L 86 50 L 91 60 L 87 70 L 88 75 L 80 78 L 65 82 L 68 85 L 65 88 L 75 90 L 90 92 L 88 96 L 90 100 L 100 100 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path d="M 50 18 L 45 22 L 40 28 L 38 35 L 42 45 L 40 52 L 46 60 L 48 70 L 50 78 L 52 70 L 54 60 L 60 52 L 58 45 L 62 35 L 60 28 L 55 22 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
);

const UnderwaterBackground = () => (
  <>
    {/* Sky Layer */}
    <div className="absolute top-0 left-0 w-full h-[20%] bg-gradient-to-b from-sky-400 to-sky-100 pointer-events-none z-0">
        <div className="absolute top-4 left-10 w-16 h-16 bg-yellow-200 rounded-full blur-[4px] opacity-90 z-0"></div>
    </div>
    
    {/* Surface Horizon */}
    <svg style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 5 }} preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d="M 0 20 Q 25 18 50 20 T 100 20 L 100 100 L 0 100 Z" fill="none" stroke="#38bdf8" strokeWidth="1" className="animate-river-flow" opacity="0.6" />
        <path d="M 0 20.5 Q 25 22 50 20.5 T 100 20.5 L 100 100 L 0 100 Z" fill="none" stroke="#bae6fd" strokeWidth="0.5" className="animate-sway" opacity="0.8" />
    </svg>

    {/* Sea Gradient */}
    <div className="absolute top-[20%] left-0 w-full h-[80%] bg-gradient-to-b from-cyan-400 via-blue-600 to-blue-950 pointer-events-none z-0 overflow-hidden border-t-2 border-cyan-300">
      <svg style={{ width: '100%', height: '100%', position: 'absolute' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="10,-10 30,110 0,110" fill="white" opacity="0.05" />
        <polygon points="50,-10 80,110 40,110" fill="white" opacity="0.05" />
        <polygon points="90,-10 110,110 90,110" fill="white" opacity="0.05" />
        {/* Precomputed bubbles to avoid randomizing on every render */}
        <circle cx="10" cy="100" r="1.2" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "1s", animationDuration: "5s" }} />
        <circle cx="17" cy="100" r="0.8" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "2s", animationDuration: "4s" }} />
        <circle cx="24" cy="100" r="1.5" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "0.5s", animationDuration: "6s" }} />
        <circle cx="31" cy="100" r="0.9" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "3s", animationDuration: "3s" }} />
        <circle cx="38" cy="100" r="1.1" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "1.5s", animationDuration: "5.5s" }} />
        <circle cx="45" cy="100" r="0.7" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "4s", animationDuration: "4.5s" }} />
        <circle cx="52" cy="100" r="1.3" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "0.2s", animationDuration: "6.2s" }} />
        <circle cx="59" cy="100" r="1.0" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "2.5s", animationDuration: "3.8s" }} />
        <circle cx="66" cy="100" r="1.4" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "1.2s", animationDuration: "5.1s" }} />
        <circle cx="73" cy="100" r="0.6" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "3.5s", animationDuration: "4.2s" }} />
        <circle cx="80" cy="100" r="1.2" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "0.8s", animationDuration: "5.8s" }} />
        <circle cx="87" cy="100" r="0.9" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "2.8s", animationDuration: "3.5s" }} />
        <circle cx="94" cy="100" r="1.1" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "1.7s", animationDuration: "4.9s" }} />
        <circle cx="20" cy="100" r="1.3" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "4.2s", animationDuration: "6.5s" }} />
        <circle cx="85" cy="100" r="0.8" fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: "0.3s", animationDuration: "3.2s" }} />
      </svg>
    </div>

    {/* Foreground Scenery */}
    <svg style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 10, filter: 'blur(2px) brightness(0.6)' }} preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M 0 65 Q 50 55 100 65 L 100 100 L 0 100 Z" fill="#2c425e" />
      <path d="M 10 100 Q 5 80 15 65 T 10 40" fill="none" stroke="#1c3041" strokeWidth="2" strokeLinecap="round" className="animate-sway-slow" />
      <path d="M 85 100 Q 80 80 90 65 T 85 40" fill="none" stroke="#1c3041" strokeWidth="2.5" strokeLinecap="round" className="animate-sway" />
    </svg>
    <svg style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 20, filter: 'blur(1px) brightness(0.85)' }} preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M 0 78 Q 50 70 100 78 L 100 100 L 0 100 Z" fill="#3a5168" />
      <path d="M 25 100 Q 30 85 25 75 T 30 50" fill="none" stroke="#1e4638" strokeWidth="3" strokeLinecap="round" className="animate-sway" />
      <path d="M 75 100 Q 70 85 75 75 T 70 50" fill="none" stroke="#1e4638" strokeWidth="3" strokeLinecap="round" className="animate-sway-slow" />
    </svg>
    <svg style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 30 }} preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M 0 90 Q 50 85 100 90 L 100 100 L 0 100 Z" fill="#b49365" />
      <path d="M 15 100 Q 20 85 15 75 T 20 50" fill="none" stroke="#15803d" strokeWidth="4" strokeLinecap="round" className="animate-sway" />
      <path d="M 90 100 Q 85 90 88 80 T 82 60" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" className="animate-sway-slow" />
    </svg>
  </>
);

const CaveEntranceProp = () => (
  <div className="relative flex justify-center items-end pointer-events-none w-56 h-48 sm:w-64 sm:h-56 drop-shadow-2xl -translate-y-6 sm:-translate-y-8">
    <svg viewBox="0 0 200 150" className="absolute bottom-0 w-full h-full">
      <path d="M10,150 L60,40 L100,60 L140,20 L190,150 Z" fill="#4b5563"/>
      <path d="M-10,150 L50,70 L90,90 L130,50 L210,150 Z" fill="#374151"/>
      <path d="M30,150 C30,80 60,30 100,30 C140,30 170,80 170,150 Z" fill="#1f2937"/>
      <path d="M60,150 C60,80 90,50 100,50 C110,50 140,80 140,150 Z" fill="#030712"/>
    </svg>
    <div className="absolute bottom-2 left-4 sm:left-6 text-3xl sm:text-4xl drop-shadow-lg -rotate-12">🪨</div>
    <div className="absolute bottom-0 right-2 sm:right-4 text-4xl sm:text-5xl drop-shadow-lg rotate-12 scale-110">🪨</div>
    <div className="absolute bottom-10 sm:bottom-14 left-0 text-2xl sm:text-3xl drop-shadow-md rotate-45 brightness-75">🪨</div>
  </div>
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
      { x: 15, y: 35, zone: 2 }, { x: 85, y: 32, zone: 2 }, { x: 50, y: 22, zone: 2, isGoal: true } 
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
    mechanics: { hasPickaxe: true, hasDarkness: true, darknessType: 'radial', hasFog: true, isVertical: true, screens: 2.2 }, 
    specialEntityTemplate: 'mole',
    mapNodes: [
      { x: 40, y: 6, zone: 1, isPreset: 'mushroom' }, { x: 60, y: 8, zone: 1 }, { x: 50, y: 12, zone: 1 },
      { x: 28, y: 20, zone: 1, isGatekeeper: true, id: 'rock_left_1', emoji: '🪨', unlocksZones: [2] },
      { x: 72, y: 20, zone: 1, isGatekeeper: true, id: 'rock_right_1', emoji: '🪨', unlocksZones: [3] },
      { x: 25, y: 30, zone: 2 }, { x: 25, y: 36, zone: 2 },
      { x: 28, y: 44, zone: 2, isGatekeeper: true, id: 'rock_left_2', emoji: '🪨', unlocksZones: [4] },
      { x: 75, y: 30, zone: 3 }, { x: 75, y: 36, zone: 3 },
      { x: 72, y: 44, zone: 3, isGatekeeper: true, id: 'rock_right_2', emoji: '🪨', unlocksZones: [5] },
      { x: 25, y: 54, zone: 4 }, { x: 25, y: 60, zone: 4, isPreset: 'mushroom' },
      { x: 28, y: 70, zone: 4, isGatekeeper: true, id: 'rock_left_3', emoji: '🪨', unlocksZones: [6] },
      { x: 75, y: 54, zone: 5 }, { x: 75, y: 60, zone: 5 },
      { x: 72, y: 70, zone: 5, isGatekeeper: true, id: 'rock_right_3', emoji: '🪨', unlocksZones: [6] },
      { x: 40, y: 78, zone: 6, isPreset: 'mushroom' }, { x: 60, y: 78, zone: 6 },
      { x: 30, y: 86, zone: 6, isGatekeeper: true, id: 'rock_final_1', emoji: '🪨', unlocksZones: [7] },
      { x: 50, y: 86, zone: 6, isGatekeeper: true, id: 'vault_rock', emoji: '🪨', unlocksZones: [8] },
      { x: 70, y: 86, zone: 6, isGatekeeper: true, id: 'rock_final_3', emoji: '🪨', unlocksZones: [9] },
      { x: 30, y: 93, zone: 7, isPreset: 'treasure' }, { x: 50, y: 93, zone: 8, isPreset: 'treasure' }, { x: 70, y: 93, zone: 9, isPreset: 'treasure' }
    ],
    sceneryNodes: [
      { x: 12, y: 20, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 }, { x: 20, y: 20, e: '🪨', s: 'text-5xl brightness-50', z: 90 },
      { x: 80, y: 20, e: '🪨', s: 'text-5xl brightness-[0.4]', z: 90 }, { x: 88, y: 20, e: '🪨', s: 'text-6xl brightness-50', z: 90 },
      { x: 12, y: 44, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 }, { x: 20, y: 44, e: '🪨', s: 'text-5xl brightness-50', z: 90 },
      { x: 80, y: 44, e: '🪨', s: 'text-5xl brightness-[0.4]', z: 90 }, { x: 88, y: 44, e: '🪨', s: 'text-6xl brightness-50', z: 90 },
      { x: 12, y: 70, e: '🪨', s: 'text-6xl brightness-[0.4]', z: 90 }, { x: 20, y: 70, e: '🪨', s: 'text-5xl brightness-50', z: 90 },
      { x: 80, y: 70, e: '🪨', s: 'text-5xl brightness-[0.4]', z: 90 }, { x: 88, y: 70, e: '🪨', s: 'text-6xl brightness-50', z: 90 },
    ],
    BackgroundComponent: CaveBackground, GatekeeperPropComponent: () => null
  },
  underwater: {
    id: 'underwater', name: 'Deep Blue',
    items: UNDERWATER_ITEMS, entities: UNDERWATER_ENTITIES,
    campPos: { x: 50, y: 16, depth: 3 }, 
    mechanics: { hasFish: true, hasSchoolsOfFish: true, hasAir: true, heroBobs: true, isVertical: true, screens: 2.2 },
    specialEntityTemplate: 'diver',
    mapNodes: [
      { x: 25, y: 30, zone: 1 }, { x: 75, y: 30, zone: 1 }, { x: 50, y: 35, zone: 1 },
      { x: 28, y: 45, zone: 1, isGatekeeper: true, id: 'current_1', emoji: '🌀', unlocksZones: [2] },
      { x: 72, y: 45, zone: 1, isGatekeeper: true, id: 'current_2', emoji: '🌀', unlocksZones: [3] },
      { x: 25, y: 55, zone: 2 }, { x: 25, y: 65, zone: 2 },
      { x: 75, y: 55, zone: 3 }, { x: 75, y: 65, zone: 3 },
      { x: 28, y: 78, zone: 2, isGatekeeper: true, id: 'current_3', emoji: '🌀', unlocksZones: [4] },
      { x: 72, y: 78, zone: 3, isGatekeeper: true, id: 'current_4', emoji: '🌀', unlocksZones: [4] },
      { x: 30, y: 92, zone: 4 }, { x: 70, y: 92, zone: 4 }, { x: 50, y: 92, zone: 4, isGoal: true }
    ],
    sceneryNodes: [
      { x: 15, y: 30, e: '🪸', s: 'text-4xl', z: 20 }, { x: 85, y: 35, e: '🪸', s: 'text-5xl', z: 20 },
      { x: 20, y: 60, e: '🌿', s: 'text-5xl', z: 20 }, { x: 80, y: 65, e: '🌿', s: 'text-4xl', z: 20 },
    ],
    BackgroundComponent: UnderwaterBackground, GatekeeperPropComponent: () => null
  }
};

// --- LOGIC ---
const uniqueCount = (arr) => new Set(arr).size;

function solvePuzzle(startItems, puzzleEntities, goalEntityId, level) {
  const queue = [{ inv: [...startItems].sort(), def: [], path: [], steps: 0 }];
  const visited = new Set();
  let iters = 0;

  while (queue.length > 0) {
    iters++;
    if (iters > SOLVER_MAX_ITERS) return null;

    const curr = queue.shift();
    if (curr.def.includes(goalEntityId)) return curr;

    const stateKey = curr.inv.join(',') + '|' + [...curr.def].sort().join(',');
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    const canHoldMore = uniqueCount(curr.inv) < MAX_UNIQUE_ITEMS;

    if (level.mechanics.hasFish && !curr.def.includes(`fish_node`) && canHoldMore) {
      queue.push({ inv: [...curr.inv, 'fish'].sort(), def: [...curr.def, 'fish_node'], path: [...curr.path, { isEnvironmentAction: true, itemId: 'fish' }], steps: curr.steps });
    }

    let simUnlockedZones = new Set([1]);
    puzzleEntities.forEach(e => {
        if (e.isGatekeeper && curr.def.includes(e.id) && e.unlocksZones) {
            e.unlocksZones.forEach(z => simUnlockedZones.add(z));
        }
    });

    let forcedMoves = [];

    for (const entity of puzzleEntities) {
      if (curr.def.includes(entity.id)) continue;
      
      const isReverseAccess = entity.isGatekeeper && entity.unlocksZones && entity.unlocksZones.some(z => simUnlockedZones.has(z));
      if (!simUnlockedZones.has(entity.zone) && !isReverseAccess) continue;
      
      if (entity.isPreset && entity.reqType === 'AND' && (!entity.requires || entity.requires.length === 0)) {
         let newInv = [...curr.inv];
         if (entity.reward) newInv.push(entity.reward);
         if (uniqueCount(newInv) <= MAX_UNIQUE_ITEMS) {
            forcedMoves.push({ inv: newInv.sort(), def: [...curr.def, entity.id], path: [...curr.path, { entityId: entity.id, usedItems: [], reqType: 'AND' }], steps: curr.steps });
         }
         continue;
      }

      if (entity.reqType === 'AND') {
        let hasAll = true; let tempInv = [...curr.inv];
        for (const req of (entity.requires || [])) {
           const idx = tempInv.indexOf(req);
           if (idx > -1) tempInv.splice(idx, 1); else { hasAll = false; break; }
        }
        if (hasAll) {
          let newInv = tempInv;
          if (entity.reward) newInv.push(entity.reward);
          
          if (uniqueCount(newInv) <= MAX_UNIQUE_ITEMS) {
            queue.push({ inv: newInv.sort(), def: [...curr.def, entity.id], path: [...curr.path, { entityId: entity.id, usedItems: entity.requires, reqType: 'AND' }], steps: curr.steps + 1 });
          }
        }
      } else { 
        const uniqueInv = Array.from(new Set(curr.inv));
        for (let i = 0; i < uniqueInv.length; i++) {
          const itemId = uniqueInv[i];
          if ((entity.requires || []).includes(itemId)) {
            const newInv = [...curr.inv]; 
            newInv.splice(newInv.indexOf(itemId), 1);
            if (entity.reward) newInv.push(entity.reward);
            
            if (uniqueCount(newInv) <= MAX_UNIQUE_ITEMS) {
              queue.push({ inv: newInv.sort(), def: [...curr.def, entity.id], path: [...curr.path, { entityId: entity.id, itemId: itemId, reqType: 'OR' }], steps: curr.steps + 1 });
            }
          }
        }
      }
    }
    
    // Take free presets to reduce search explosion
    if (forcedMoves.length > 0) {
        queue.unshift(...forcedMoves);
    }
  } return null;
}

function generateLevelPuzzle(level, targetSteps, numDiggers) {
  let bestPuzzle = null; let maxSteps = 0; const startTime = Date.now(); 

  for (let attempt = 0; attempt < GENERATOR_MAX_ATTEMPTS; attempt++) {
    if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS) break;

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
          if (level.mechanics.hasPickaxe) activeGatekeepers.push({ ...n, name: 'Rock', requires: ['pickaxe'], reqType: 'AND', id: n.id || `gk_${idx}` });
          else activeGatekeepers.push({ ...n, name: 'Current', requires: ['starfish'], reqType: 'AND', reward: null, id: n.id || `gk_${idx}` });
        } else if (n.isPreset === 'mushroom') {
          presetEntities.push({ id: `preset_mush_${n.x}_${n.y}`, emoji: '🍄', requires: [], reqType: 'AND', reward: 'mushroom', x: n.x, y: n.y, zone: n.zone, isGatekeeper: false, isPreset: true });
        } else if (n.isPreset === 'treasure') {
          presetEntities.push({ id: `preset_treas_${n.x}_${n.y}`, emoji: '💎', requires: [], reqType: 'AND', reward: null, x: n.x, y: n.y, zone: n.zone, isGatekeeper: false, isTreasure: true, isPreset: true });
        }
      });
    }

    const availableNodes = level.mapNodes.filter(n => !n.isGatekeeper && !n.isGoal && !n.isPreset);
    let goalTemplate = { id: 'vault_rock' }; 
    if (!level.mechanics.isVertical || !level.mechanics.hasPickaxe) {
      if (level.id === 'river_crossing') {
         const baseTroll = level.entities.find(e => e.id === 'troll');
         goalTemplate = { ...baseTroll, id: 'cave_troll_exit', name: 'Cave Boss' };
      } else {
         goalTemplate = level.entities.filter(e => e.id !== level.mechanics.gatekeeperId && e.id !== level.specialEntityTemplate).sort(() => Math.random() - 0.5)[0];
      }
      
      const goalNode = level.mapNodes.find(n => n.isGoal);
      if (goalNode) {
        const availableReqs = goalTemplate.allowedReqs.filter(req => req !== 'pickaxe');
        // Force 2 items for the Cave Boss Troll in River Crossing, else standard logic
        const numReqs = level.id === 'river_crossing' ? 2 : (Math.random() > 0.5 && availableReqs.length >= 2 ? 2 : 1);
        const reqs = [...availableReqs].sort(() => Math.random() - 0.5).slice(0, numReqs);
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

    if (level.mechanics.isVertical && level.mechanics.hasPickaxe) {
      const nonGoalNodes = puzzleEntities.filter(e => !e.isGatekeeper && !e.isTreasure && !e.isPreset && e.reward !== 'pickaxe');
      const shuffled = [...nonGoalNodes].sort(() => Math.random() - 0.5);
      for(let i=0; i<4; i++) { if(shuffled[i]) shuffled[i].reward = 'pickaxe'; }
    } else if (level.mechanics.hasPickaxe) {
      const z1NonGoal = puzzleEntities.find(e => e.zone === 1 && !e.isGatekeeper && e.id !== goalTemplate.id && e.id !== firstStepEnt?.id);
      if (z1NonGoal) z1NonGoal.reward = 'pickaxe';
    }

    const targetGoalId = (level.mechanics.isVertical && level.mechanics.hasPickaxe) ? 'vault_rock' : goalTemplate.id;
    const currentState = solvePuzzle(startItems, puzzleEntities, targetGoalId, level);
    if (currentState) {
      const solutionPath = currentState.path;
      const solutionSteps = currentState.steps;
      if (solutionSteps >= targetSteps) return { startItems, puzzleEntities, goalEntityId: targetGoalId, solution: solutionPath, steps: solutionSteps };
      if (solutionSteps > maxSteps) { bestPuzzle = { startItems, puzzleEntities, goalEntityId: targetGoalId, solution: solutionPath, steps: solutionSteps }; maxSteps = solutionSteps; }
    }
  } return bestPuzzle;
}

const computeWaypoints = (fromZone, toZone) => {
  let waypoints = [];
  const leftZones = [2, 4];
  const rightZones = [3, 5];

  if ((leftZones.includes(fromZone) && rightZones.includes(toZone)) ||
      (rightZones.includes(fromZone) && leftZones.includes(toZone))) {
      if (Math.min(fromZone, toZone) >= 4) waypoints.push({ x: 50, y: 74, depth: 3, zone: 6 });
      else waypoints.push({ x: 50, y: 22, depth: 3, zone: 1 });
  } else if (fromZone === 1 && (leftZones.includes(toZone) || rightZones.includes(toZone))) {
      waypoints.push({ x: 50, y: 22, depth: 3, zone: 1 });
  } else if (toZone === 1 && (leftZones.includes(fromZone) || rightZones.includes(fromZone))) {
      waypoints.push({ x: 50, y: 22, depth: 3, zone: 1 });
  } else if (fromZone >= 6 && (leftZones.includes(toZone) || rightZones.includes(toZone))) {
      waypoints.push({ x: 50, y: 74, depth: 3, zone: 6 });
  } else if (toZone >= 6 && (leftZones.includes(fromZone) || rightZones.includes(fromZone))) {
      waypoints.push({ x: 50, y: 74, depth: 3, zone: 6 });
  }
  return waypoints;
};

// --- SUB-COMPONENT: ISOLATED GAME INSTANCE ---
function GameInstance({ level, targetSteps, numDiggers, onGenerateNew, lang, setLang }) {
  const [puzzle, setPuzzle] = useState(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [inventory, setInventory] = useState([]); 
  const [unlockedZones, setUnlockedZones] = useState([1]);
  const [defeated, setDefeated] = useState([]);
  const [selectedItemTypes, setSelectedItemTypes] = useState([]); 
  const [pathHistory, setPathHistory] = useState([{...level.campPos, zone: 1}]);
  const [historyStack, setHistoryStack] = useState([]); 
  const [air, setAir] = useState(MAX_AIR);

  // Localization
  const dict = STRINGS[lang] || STRINGS.en;

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
  const [campItems, setCampItems] = useState([]);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState('main'); 
  const [menuSettings, setMenuSettings] = useState({ levelId: level.id, steps: targetSteps, diggers: numDiggers });
  
  const [animatingEntities, setAnimatingEntities] = useState([]);
  const [buriedEntities, setBuriedEntities] = useState([]);

  // Refs for closure fixes
  const airRef = useRef(air); airRef.current = air;
  const isDemoRef = useRef(isDemonstrating); isDemoRef.current = isDemonstrating;
  const isVicRef = useRef(isVictorious); isVicRef.current = isVictorious;
  const stateRefs = useRef({});
  stateRefs.current = { inventory, defeated, pathHistory, envItemState, unlockedZones, campItems, buriedEntities, air };

  const demoRef = useRef(false);
  const mapRef = useRef(null);
  const Background = level.BackgroundComponent;

  useEffect(() => { 
    setPuzzle(null); setGenerationFailed(false);
    const timer = setTimeout(() => {
      let newPuzzle = generateLevelPuzzle(level, targetSteps, numDiggers);
      if (!newPuzzle) newPuzzle = generateLevelPuzzle(level, 3, numDiggers); 
      if (!newPuzzle) { setGenerationFailed(true); return; }
      setPuzzle(newPuzzle); setInventory(newPuzzle.startItems || []);
    }, 150);
    return () => clearTimeout(timer);
  }, [level, targetSteps, numDiggers]);

  useEffect(() => {
    if (!level.mechanics.hasSchoolsOfFish) return;
    const fishTypes = ['fish']; 
    let timeoutIds = [];
    const spawnFish = () => {
      if (isDemoRef.current || isVicRef.current) return;
      const id = Date.now() + Math.random(); const type = fishTypes[Math.floor(Math.random() * fishTypes.length)];
      const depth = Math.floor(Math.random() * 3) + 1; const yPos = 30 + depth * 10 + Math.random() * 30; 
      const isRight = Math.random() > 0.5;
      setSchoolsOfFish(prev => [...prev, { id, type, y: yPos, depth, isRight }]);
      const tId = setTimeout(() => { setSchoolsOfFish(prev => prev.filter(f => f.id !== id)); }, 10000); 
      timeoutIds.push(tId);
    };
    const intervalId = setInterval(spawnFish, 2500);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.mechanics.hasSchoolsOfFish]);

  useEffect(() => {
    if (!puzzle || isDemonstrating || isAnimatingLoot) return;
    const diggersToBury = puzzle.puzzleEntities.filter(ent => {
        const isDigger = level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !ent.isGoal;
        return isDigger && unlockedZones.includes(ent.zone) && pathHistory.length > 1 && !buriedEntities.includes(ent.id) && !animatingEntities.includes(ent.id) && !defeated.includes(ent.id);
    });

    if (diggersToBury.length > 0) {
        const ids = diggersToBury.map(d => d.id);
        setAnimatingEntities(prev => [...prev, ...ids]);
        setTimeout(() => {
            setAnimatingEntities(prev => prev.filter(id => !ids.includes(id)));
            setBuriedEntities(prev => [...new Set([...prev, ...ids])]);
        }, 700);
    }
  }, [pathHistory, unlockedZones, puzzle, isDemonstrating, isAnimatingLoot, buriedEntities, animatingEntities, defeated, level]);

  const saveHistory = useCallback(() => { 
    setHistoryStack(prev => [...prev, { 
       inventory: [...stateRefs.current.inventory], 
       defeated: [...stateRefs.current.defeated], 
       pathHistory: [...stateRefs.current.pathHistory], 
       envItemState: stateRefs.current.envItemState, 
       unlockedZones: [...stateRefs.current.unlockedZones], 
       campItems: [...stateRefs.current.campItems], 
       buriedEntities: [...stateRefs.current.buriedEntities], 
       air: stateRefs.current.air 
    }]); 
  }, []);

  const handleUndo = () => {
    if (historyStack.length === 0 || isDemonstrating || isAnimatingLoot) return;
    const prevState = historyStack[historyStack.length - 1];
    setInventory(prevState.inventory); setDefeated(prevState.defeated); setPathHistory(prevState.pathHistory);
    setEnvItemState(prevState.envItemState);
    setUnlockedZones(prevState.unlockedZones); setCampItems(prevState.campItems || []);
    setBuriedEntities(prevState.buriedEntities || []); setAir(prevState.air ?? 6);
    setHistoryStack(prev => prev.slice(0, -1)); setSelectedItemTypes([]); setSelectedEntityId(null);
    setFlyingItem(null); setTempPlayerPos(null); setIsVictorious(false); setShowTrophy(false); setShowVictoryMsg(false); setAnimatingEntities([]);
  };

  const INITIAL_STATE = { unlockedZones: [1], air: MAX_AIR, defeated: [], selectedItemTypes: [], selectedEntityId: null, historyStack: [], isVictorious: false, showTrophy: false, showVictoryMsg: false, isDemonstrating: false, isAnimatingLoot: false, alertEntityId: null, flyingItem: null, tempPlayerPos: null, envItemState: 'active', schoolsOfFish: [], animatingEntities: [], campItems: [], buriedEntities: [] };
  const resetGameState = () => {
    if (!puzzle) return;
    setInventory(puzzle.startItems || []); setPathHistory([{...level.campPos, zone: 1}]);
    Object.entries(INITIAL_STATE).forEach(([k, v]) => {
      if (k === 'unlockedZones') setUnlockedZones(v); else if (k === 'air') setAir(v); else if (k === 'defeated') setDefeated(v); else if (k === 'selectedItemTypes') setSelectedItemTypes(v); else if (k === 'selectedEntityId') setSelectedEntityId(v); else if (k === 'historyStack') setHistoryStack(v); else if (k === 'isVictorious') setIsVictorious(v); else if (k === 'showTrophy') setShowTrophy(v); else if (k === 'showVictoryMsg') setShowVictoryMsg(v); else if (k === 'isDemonstrating') setIsDemonstrating(v); else if (k === 'isAnimatingLoot') setIsAnimatingLoot(v); else if (k === 'alertEntityId') setAlertEntityId(v); else if (k === 'flyingItem') setFlyingItem(v); else if (k === 'tempPlayerPos') setTempPlayerPos(v); else if (k === 'envItemState') setEnvItemState(v); else if (k === 'schoolsOfFish') setSchoolsOfFish(v); else if (k === 'animatingEntities') setAnimatingEntities(v); else if (k === 'campItems') setCampItems(v); else if (k === 'buriedEntities') setBuriedEntities(v);
    });
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
      let waypoints = computeWaypoints(currentZoneSim, entity.zone);
      
      for (let wp of waypoints) {
          currentPath.push(wp); setPathHistory([...currentPath]); currentZoneSim = wp.zone;
          await new Promise(r => setTimeout(r, 400));
      }

      await new Promise(r => setTimeout(r, 600));
      if (step.reqType === 'AND') { setSelectedItemTypes(Array.from(new Set(step.usedItems)));
      } else { setSelectedItemTypes([step.itemId]); }

      await new Promise(r => setTimeout(r, 600));
      
      const lastSimPos = currentPath[currentPath.length - 1];
      const prevPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : lastSimPos;
      let targetX = entity.roamClass ? 50 : entity.x;
      let targetY = entity.y;
      
      if (!entity.roamClass) {
          const dx = targetX - prevPoint.x;
          const dy = targetY - prevPoint.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0) {
              targetX = targetX - (dx/dist) * 3.5;
              targetY = targetY - (dy/dist) * 3.5;
          }
      }
      
      currentPath.push({x: targetX, y: targetY, depth: entity.depth || 3, zone: entity.zone}); setPathHistory([...currentPath]);
      currentZoneSim = entity.zone;
      await new Promise(r => setTimeout(r, 800)); 

      if (step.reqType === 'AND') { step.usedItems.forEach(req => { const idx = currentInv.indexOf(req); if (idx > -1) currentInv.splice(idx, 1); });
      } else { currentInv.splice(currentInv.indexOf(step.itemId), 1); }
      
      setInventory([...currentInv]); setSelectedItemTypes([]); 
      
      if (entity.reward) {
        const entityX = entity.roamClass ? 50 : entity.x;
        setFlyingItem({ emoji: level.items.find(i=>i.id===entity.reward)?.emoji, x: entityX, y: entity.y });
        await new Promise(r => setTimeout(r, 800)); 
        setFlyingItem(null); currentInv.push(entity.reward);
        setInventory([...currentInv]);
      }
      
      currentDefeated.push(entity.id); setDefeated([...currentDefeated]); setSelectedEntityId(null);

      if (entity.isGatekeeper && entity.unlocksZones) {
         entity.unlocksZones.forEach(z => unlockedZonesSim.add(z));
         unlockedZonesSim.add(entity.zone);
         setUnlockedZones(Array.from(unlockedZonesSim));
      }
      if (!level.mechanics.isVertical && entity.id === puzzle.goalEntityId) triggerVictory();
    }
    setIsDemonstrating(false); demoRef.current = false;
  };

  const triggerVictory = () => { setIsVictorious(true); setTimeout(() => setShowTrophy(true), 800); setTimeout(() => setShowVictoryMsg(true), 1000); };

  const navigateTo = useCallback((targetX, targetY, targetZone, targetDepth, isEntity = false) => {
      const currentZone = stateRefs.current.pathHistory[stateRefs.current.pathHistory.length - 1].zone || 1;
      let waypoints = computeWaypoints(currentZone, targetZone);
      const lastPos = stateRefs.current.pathHistory[stateRefs.current.pathHistory.length - 1];
      const prevPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : lastPos;
      let finalX = targetX; let finalY = targetY;
      if (isEntity) {
          const dx = finalX - prevPoint.x; const dy = finalY - prevPoint.y; const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0) { finalX = finalX - (dx/dist) * NAV_OFFSET; finalY = finalY - (dy/dist) * NAV_OFFSET; }
      }
      return [...waypoints, { x: finalX, y: finalY, depth: targetDepth || 3, zone: targetZone }];
  }, []);

  const handlePostActionAir = useCallback((finalY) => {
    if (!level.mechanics.hasAir) return;
    if (finalY <= 20) {
        setAir(MAX_AIR);
    } else if (airRef.current <= 1) {
        setAir(0);
        setTimeout(() => {
            setAlertEntityId('out_of_air');
            setIsAnimatingLoot(true);
            const returnPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
            setPathHistory(prev => [...prev, ...returnPath]);
            setTimeout(() => { setAir(MAX_AIR); setAlertEntityId(null); setIsAnimatingLoot(false); }, 3000); 
        }, 800);
    } else setAir(a => a - 1);
  }, [level.mechanics.hasAir, level.campPos, navigateTo]);

  const handleCatchRiverFish = (e) => {
    e.stopPropagation();
    const uniqueInvCount = Array.from(new Set(inventory)).length;
    if (envItemState !== 'active' || (uniqueInvCount >= 4 && !inventory.includes('fish')) || isDemonstrating || isAnimatingLoot) return;
    saveHistory();
    const parentRect = e.currentTarget.parentElement.getBoundingClientRect();
    setEnvItemCaughtPos({ x: ((e.clientX - parentRect.left) / parentRect.width) * 100, y: ((e.clientY - parentRect.top) / parentRect.height) * 100 });
    setEnvItemState('caught'); setTimeout(() => { setEnvItemState('hidden'); setInventory(prev => [...prev, 'fish']); handlePostActionAir(53); }, 800);
  };

  const handleCatchSchoolFish = (e, fishObj) => {
    e.stopPropagation();
    const uniqueInvCount = Array.from(new Set(inventory)).length;
    if ((uniqueInvCount >= 4 && !inventory.includes(fishObj.type)) || isDemonstrating || isAnimatingLoot) return;
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    saveHistory(); setIsAnimatingLoot(true);
    const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
    setPathHistory(prev => [...prev, { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100, depth: fishObj.depth, zone: currentZone }]);
    setTimeout(() => {
      setSchoolsOfFish(currentFish => {
        if (currentFish.some(f => f.id === fishObj.id)) { setInventory(prev => [...prev, fishObj.type]); return currentFish.filter(f => f.id !== fishObj.id); }
        return currentFish;
      }); 
      setIsAnimatingLoot(false);
      handlePostActionAir(fishObj.y);
    }, 700);
  };

  const handleCampClick = (e) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot) return;

    const itemToDrop = selectedItemTypes[0];
    if (!itemToDrop && !level.mechanics.hasAir) return; // Allow clicking with empty hand strictly for air refill

    saveHistory();
    setIsAnimatingLoot(true);

    const newPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];
    
    setPathHistory(prev => {
        if (lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
        return [...prev, ...newPath];
    });

    setTimeout(() => {
        if (itemToDrop) {
            setInventory(prev => {
                const newInv = [...prev];
                const idx = newInv.indexOf(itemToDrop);
                if (idx > -1) newInv.splice(idx, 1);
                return newInv;
            });
            const offsetX = level.campPos.x + (Math.random() * 14 - 7);
            const offsetY = level.campPos.y + (Math.random() * 8 - 4);
            setCampItems(prev => [...prev, { id: itemToDrop, x: offsetX, y: offsetY, uid: Date.now() + Math.random() }]);
            setSelectedItemTypes([]);
        }
        setIsAnimatingLoot(false);
        if (level.mechanics.hasAir) setAir(MAX_AIR);
    }, 800);
  };

  const handleCampItemClick = (e, campItem) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot) return;

    if (!inventory.includes(campItem.id) && Array.from(new Set(inventory)).length >= 4) {
        setAlertEntityId(campItem.uid);
        setTimeout(() => setAlertEntityId(null), 600);
        return;
    }

    saveHistory();
    setIsAnimatingLoot(true);

    const newPath = navigateTo(campItem.x, campItem.y, 1, level.campPos.depth || 3, false);
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];
    
    setPathHistory(prev => {
        if (lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
        return [...prev, ...newPath];
    });

    setTimeout(() => {
        setCampItems(prev => prev.filter(i => i.uid !== campItem.uid));
        setInventory(prev => [...prev, campItem.id]);
        setIsAnimatingLoot(false);
        if (level.mechanics.hasAir) setAir(MAX_AIR);
    }, 800);
  };

  const toggleInventoryType = (itemId) => {
    if (isDemonstrating || isAnimatingLoot) return;
    if (selectedItemTypes.includes(itemId)) setSelectedItemTypes(prev => prev.filter(i => i !== itemId));
    else setSelectedItemTypes(prev => [...prev, itemId]);
  };

  const handleInteract = (entity, e) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot) return;
    
    const isReverseAccess = entity.isGatekeeper && entity.unlocksZones && entity.unlocksZones.some(z => unlockedZones.includes(z));
    
    if (!unlockedZones.includes(entity.zone) && !isReverseAccess) {
       setSelectedItemTypes([]); setSelectedEntityId(null); setIsAnimatingLoot(true); 
       
       const targetAlert = puzzle.puzzleEntities.filter(ent => 
            ent.isGatekeeper && !defeated.includes(ent.id) && 
            (ent.unlocksZones?.includes(entity.zone) || (ent.zone === entity.zone && ent.unlocksZones?.some(z => unlockedZones.includes(z))))
       ).sort((a, b) => Math.abs(a.y - pathHistory[pathHistory.length-1].y) - Math.abs(b.y - pathHistory[pathHistory.length-1].y))[0] || entity;
       
       const prevPoint = pathHistory[pathHistory.length - 1];
       let alertX = targetAlert.roamClass ? 50 : targetAlert.x;
       let alertY = targetAlert.y;
       
       if (!targetAlert.roamClass) {
           const dx = alertX - prevPoint.x;
           const dy = alertY - prevPoint.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           if (dist > 0) {
               alertX = alertX - (dx/dist) * 3.5;
               alertY = alertY - (dy/dist) * 3.5;
           }
       }
       
       setTempPlayerPos({ x: alertX, y: alertY, depth: 3 });
       setTimeout(() => { setAlertEntityId(targetAlert.id); setTimeout(() => { setAlertEntityId(null); setTempPlayerPos(null); setTimeout(() => setIsAnimatingLoot(false), 700); }, 600); }, 700); 
       return;
    }

    const newPath = navigateTo(entity.roamClass ? 50 : entity.x, entity.y, entity.zone, entity.depth || 3, !entity.roamClass);
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];
    
    setPathHistory(prev => {
        if (lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
        return [...prev, ...newPath];
    });

    if (defeated.includes(entity.id)) { handlePostActionAir(entity.y); return; }

    if (entity.isPreset && !entity.isGatekeeper) {
        if (entity.reward && !inventory.includes(entity.reward) && Array.from(new Set(inventory)).length >= 4) {
            setAlertEntityId(entity.id);
            setTimeout(() => setAlertEntityId(null), 600);
            return;
        }

        setIsAnimatingLoot(true); saveHistory();
        setAnimatingEntities(prev => [...prev, entity.id]);
        setDefeated(prev => {
            const newDef = [...prev, entity.id];
            if (level.mechanics.isVertical && entity.isTreasure) {
                const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
                if (allTreasures.every(t => newDef.includes(t.id))) triggerVictory();
            }
            return newDef;
        });
        
        if (entity.reward) {
            const entityX = entity.roamClass ? 50 : entity.x;
            setFlyingItem({ emoji: entity.emoji, x: entityX, y: entity.y, zIndex: 60 });
            setTimeout(() => {
                setInventory(prev => [...prev, entity.reward]);
                setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
                handlePostActionAir(entity.y);
            }, 800);
        } else { 
            setIsAnimatingLoot(false); 
            setTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), 800); 
            handlePostActionAir(entity.y);
        }
        return;
    }

    if (selectedItemTypes.length === 0 && entity.requires && entity.requires.length > 0) { 
        setSelectedEntityId(prev => prev === entity.id ? null : entity.id); 
        handlePostActionAir(entity.y);
        return; 
    }

    let canDefeat = false; let itemsToConsume = [];
    const availableItems = [...inventory];
    const takeItems = (reqArray) => {
        let tempAvail = [...availableItems]; let consumed = [];
        for (const req of reqArray) { const idx = tempAvail.indexOf(req); if (idx > -1) { tempAvail.splice(idx, 1); consumed.push(req); } else { return null; } }
        return consumed;
    };

    if (entity.reqType === 'AND') {
       if (entity.requires.length === 0 || Array.from(new Set(entity.requires || [])).every(t => selectedItemTypes.includes(t))) { 
           const consumed = takeItems(entity.requires || []); 
           if (consumed) { canDefeat = true; itemsToConsume = consumed; } 
       }
    } else { 
      for (const req of (entity.requires || [])) { if (selectedItemTypes.includes(req) && availableItems.includes(req)) { canDefeat = true; itemsToConsume.push(req); break; } }
    }

    if (canDefeat) {
      let futureInv = [...inventory];
      itemsToConsume.forEach(itemToDel => { const idx = futureInv.indexOf(itemToDel); if (idx > -1) futureInv.splice(idx, 1); });
      
      if (entity.reward && !futureInv.includes(entity.reward) && Array.from(new Set(futureInv)).length >= 4) {
          setAlertEntityId(entity.id);
          setTimeout(() => setAlertEntityId(null), 600);
          return;
      }

      setIsAnimatingLoot(true); saveHistory();
      setAnimatingEntities(prev => [...prev, entity.id]);
      
      setInventory(prev => {
          let newInv = [...prev];
          itemsToConsume.forEach(itemToDel => { const idx = newInv.indexOf(itemToDel); if (idx > -1) newInv.splice(idx, 1); });
          return newInv;
      });

      setDefeated(prev => {
          const newDef = [...prev, entity.id];
          if (entity.isGatekeeper && entity.unlocksZones) {
              setUnlockedZones(uz => [...new Set([...uz, ...(entity.unlocksZones || []), entity.zone])]);
          }
          return newDef;
      });
      
      setSelectedItemTypes([]); setSelectedEntityId(null);

      if (entity.reward) {
        const entityX = entity.roamClass ? 50 : entity.x;
        setFlyingItem({ emoji: level.items.find(i => i.id === entity.reward)?.emoji, x: entityX, y: entity.y, zIndex: 60 });
        setTimeout(() => {
          setInventory(prev => [...prev, entity.reward]);
          setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          handlePostActionAir(entity.y);
          if (!level.mechanics.isVertical && entity.id === puzzle.goalEntityId) triggerVictory();
        }, 800);
      } else { 
          setIsAnimatingLoot(false); 
          setTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), 800); 
          handlePostActionAir(entity.y);
          if (!level.mechanics.isVertical && entity.id === puzzle.goalEntityId) triggerVictory(); 
      }

    } else { 
        setSelectedItemTypes([]); 
        handlePostActionAir(entity.y);
    }
  };

  const renderMenu = () => {
    if (!isMenuOpen) return null;
    return (
      <div className="absolute inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="bg-stone-800 border-4 border-stone-600 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 text-stone-200">
          {menuView === 'main' ? (
            <>
              <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.menu}</h2>
              <button onClick={handleReplay} className="w-full bg-stone-600 py-4 rounded-xl font-bold text-xl hover:bg-stone-500 shadow-lg border-b-4 border-stone-800 active:border-b-0 active:translate-y-1">{dict.restart}</button>
              <button onClick={handleShowSolution} disabled={isVictorious || isDemonstrating || isAnimatingLoot || !puzzle} className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-xl hover:bg-indigo-500 shadow-lg border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 disabled:opacity-50">{dict.showSolution}</button>
              <button onClick={() => setMenuView('settings')} className="w-full bg-amber-600 py-4 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1">{dict.generateMap}</button>
              <button onClick={() => setIsMenuOpen(false)} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.resume}</button>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.settings}</h2>
              <div className="space-y-4">
                <label className="flex flex-col gap-2 font-bold text-lg pt-2">
                  <span>{dict.level}</span> 
                  <select className="w-full bg-stone-900 border-2 border-stone-600 rounded-lg p-3 outline-none focus:border-amber-500 text-amber-400" value={menuSettings.levelId} onChange={(e) => setMenuSettings({...menuSettings, levelId: e.target.value})}>{Object.values(LEVEL_DICTIONARY).map(lvl => <option key={lvl.id} value={lvl.id}>{dict.levels[lvl.id] || lvl.name}</option>)}</select>
                </label>
                <label className="flex flex-col gap-2 font-bold text-lg pt-2"><span className="flex justify-between"><span>{dict.minQuestChain}</span> <span className="text-amber-400">{menuSettings.steps}</span></span><input type="range" min="3" max="8" value={menuSettings.steps} onChange={(e) => setMenuSettings({...menuSettings, steps: parseInt(e.target.value)})} className="w-full accent-amber-500 h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer" /></label>
                <label className="flex flex-col gap-2 font-bold text-lg"><span className="flex justify-between"><span>{dict.diggersMemory}</span> <span className="text-amber-400">{menuSettings.diggers}</span></span><input type="range" min="0" max="3" value={menuSettings.diggers} onChange={(e) => setMenuSettings({...menuSettings, diggers: parseInt(e.target.value)})} className="w-full accent-amber-500 h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer" /></label>
                <button onClick={() => onGenerateNew(menuSettings)} className="w-full bg-amber-600 py-4 mt-2 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1">{dict.genMap}</button>
              </div>
              <button onClick={() => setMenuView('main')} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.back}</button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (generationFailed) return (
     <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative p-4 text-center">
       <div className="text-red-500 text-3xl font-black mb-4">{dict.genFailedTitle}</div>
       <div className="text-stone-300 max-w-md">{dict.genFailedDesc}</div>
       <button onClick={() => { setMenuView('settings'); setIsMenuOpen(true); }} className="mt-8 bg-stone-700 p-4 rounded-xl text-white font-bold hover:bg-stone-600 transition-colors z-[100] relative">{dict.openSettings}</button>
       {renderMenu()}
     </div>
  );

  if (!puzzle) return <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative">
     <div className="absolute inset-0 bg-stone-900 opacity-80 z-40 backdrop-blur" />
     <div className="text-amber-500 text-3xl font-black z-50 animate-pulse tracking-widest uppercase shadow-black drop-shadow-lg border-y-2 border-amber-500 py-4 px-12">{dict.generating}</div>
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
      const screenPct = 100 / level.mechanics.screens; 
      const maxScrollPct = 100 - screenPct; 
      let targetScroll = displayPlayerPos.y - (screenPct / 2); 
      if (targetScroll < 0) targetScroll = 0; 
      if (targetScroll > maxScrollPct) targetScroll = maxScrollPct; 
      mapTranslateY = `-${targetScroll}%`;
  }

  const GatekeeperProp = level.GatekeeperPropComponent;
  const isDrowning = alertEntityId === 'out_of_air';
  const heroFace = isDrowning ? '😵' : '🤠';
  const playerTransition = isDrowning ? 'duration-[3000ms] ease-linear' : 'duration-700 ease-in-out';

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-2 sm:p-4 font-serif select-none overflow-hidden relative">
      <div ref={mapRef} className="relative w-full max-w-4xl h-[70vh] sm:h-[75vh] bg-[#dcb27b] rounded-2xl shadow-[inset_0_0_80px_rgba(100,50,0,0.6),0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden border-8 border-amber-900/80 ring-4 ring-stone-950">
        
        {/* Air Gauge Overlay */}
        {level.mechanics.hasAir && (
           <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-1 z-[150] bg-blue-900/60 p-2 sm:p-3 rounded-full border-2 border-blue-400 backdrop-blur-md shadow-lg">
             {[...Array(MAX_AIR)].map((_, i) => (
                <div key={i} className={`text-xl sm:text-2xl transition-all duration-300 ${i < air ? 'opacity-100 scale-100' : 'opacity-30 scale-75 drop-shadow-none grayscale'}`}>🫧</div>
             ))}
           </div>
        )}

        {/* Floating Up Message */}
        {isDrowning && (
           <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500/90 backdrop-blur-sm text-white font-black text-2xl sm:text-4xl px-8 py-6 rounded-3xl border-4 border-white shadow-[0_0_40px_rgba(59,130,246,0.8)] z-[200] animate-[floatUp_2s_ease-in-out_infinite] whitespace-nowrap">
              🫧 Floating Up! 🫧
           </div>
        )}

        <div className="absolute inset-x-0 top-0 transition-transform duration-1000 ease-in-out pointer-events-auto animate-map-appear" style={{ height: totalMapHeight, transform: `translateY(${mapTranslateY})` }}>
          <Background />
          
          {level.mechanics.hasDarkness && level.mechanics.darknessType === 'horizontal' && (
            <>
              <div className={`absolute inset-y-0 left-0 w-1/2 bg-black transition-all duration-1000 z-[90] pointer-events-none ${unlockedZones.includes(1) ? 'opacity-0' : 'opacity-100 pointer-events-auto'}`} />
              <div className={`absolute inset-y-0 right-0 w-1/2 bg-black transition-all duration-1000 z-[90] pointer-events-none ${unlockedZones.includes(2) ? 'opacity-0' : 'opacity-100 pointer-events-auto'}`} />
            </>
          )}

          {level.mechanics.hasFog && (
            <div className="absolute inset-0 pointer-events-none z-[84]">
              <div className={`absolute left-0 w-[50%] bg-[#110c08] transition-opacity duration-1000 ${unlockedZones.includes(2) ? 'opacity-0' : 'opacity-100'}`} style={{ top: '21%', height: '22%' }} />
              <div className={`absolute right-0 w-[50%] bg-[#110c08] transition-opacity duration-1000 ${unlockedZones.includes(3) ? 'opacity-0' : 'opacity-100'}`} style={{ top: '21%', height: '22%' }} />
              <div className={`absolute left-0 w-[50%] bg-[#110c08] transition-opacity duration-1000 ${unlockedZones.includes(4) ? 'opacity-0' : 'opacity-100'}`} style={{ top: '45%', height: '24%' }} />
              <div className={`absolute right-0 w-[50%] bg-[#110c08] transition-opacity duration-1000 ${unlockedZones.includes(5) ? 'opacity-0' : 'opacity-100'}`} style={{ top: '45%', height: '24%' }} />
              <div className={`absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000 ${unlockedZones.includes(6) ? 'opacity-0' : 'opacity-100'}`} style={{ top: '72%', height: '11%' }} />
              <div className={`absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000 ${unlockedZones.includes(7) ? 'opacity-0' : 'opacity-100'}`} style={{ top: '86%', height: '14%' }} />
            </div>
          )}

          {level.mechanics.hasDarkness && level.mechanics.darknessType === 'radial' && (
            <div className="absolute inset-0 pointer-events-none z-[85] transition-all duration-300 ease-linear animate-torch-flicker" style={{ background: `radial-gradient(ellipse 80vw 100vh at ${displayPlayerPos.x}% ${displayPlayerPos.y}%, transparent 0%, transparent 30%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 80%, #000 100%)` }} />
          )}

          {level.sceneryNodes?.map((sc, i) => ( <div key={`sc-${i}`} className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${sc.s} pointer-events-none`} style={{ left: `${sc.x}%`, top: `${sc.y}%`, zIndex: sc.z || (sc.depth||3)*10 }}>{sc.e}</div> ))}

          {level.mechanics.hasFish && envItemState === 'active' && ( <div className="absolute cursor-pointer text-3xl animate-fish-swim hover:scale-125 transition-transform" style={{zIndex: 25}} onClick={handleCatchRiverFish}>🐟</div> )}
          {level.mechanics.hasFish && envItemState === 'caught' && ( <div className="absolute flex flex-col items-center animate-loot-fly pointer-events-none drop-shadow-xl" style={{ left: `${envItemCaughtPos.x}%`, top: `${envItemCaughtPos.y}%`, zIndex: 90 }}><span className="text-3xl">🐟</span></div> )}

          {schoolsOfFish.map(f => {
             const fScale = f.depth === 1 ? 'scale-50' : f.depth === 2 ? 'scale-75' : 'scale-100';
             const fFilter = f.depth === 1 ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : f.depth === 2 ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
             return (
               <div key={f.id} onClick={(e) => handleCatchSchoolFish(e, f)} className={`absolute cursor-pointer text-4xl transition-transform hover:brightness-150 ${f.isRight ? 'animate-[swimRight_10s_linear_forwards]' : 'animate-[swimLeft_10s_linear_forwards]'}`} style={{ top: `${f.y}%`, zIndex: f.depth * 10 + 5 }}>
                 <div className={`inline-block ${f.isRight ? 'scale-x-[-1]' : ''} ${fScale} ${fFilter}`}>{level.items.find(i => i.id === f.type)?.emoji || '🐟'}</div>
               </div>
             );
          })}

          <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md z-10" preserveAspectRatio="none">
            {pathHistory.map((pos, i) => { if (i === 0) return null; const prev = pathHistory[i - 1]; return <line key={i} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${pos.x}%`} y2={`${pos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" className="animate-[dash_1s_linear_forwards]" style={{ strokeDashoffset: 100 }} vectorEffect="non-scaling-stroke" />; })}
            {tempPlayerPos && <line x1={`${playerPos.x}%`} y1={`${playerPos.y}%`} x2={`${tempPlayerPos.x}%`} y2={`${tempPlayerPos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" opacity="0.5" vectorEffect="non-scaling-stroke" />}
          </svg>

          {campItems.map(item => {
            const itemData = level.items.find(i => i.id === item.id);
            if (!itemData) return null;
            const isAlerting = alertEntityId === item.uid;
            return (
                <div key={item.uid} onClick={(e) => handleCampItemClick(e, item)} className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-[15] cursor-pointer hover:scale-125 transition-transform ${isAlerting ? 'animate-troll-mad' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>
                    <div className="text-3xl drop-shadow-md">{isAlerting ? '🚫' : itemData.emoji}</div>
                </div>
            );
          })}

          <div onClick={handleCampClick} className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-[10] transition-all duration-300 ${selectedItemTypes.length > 0 ? 'cursor-pointer hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : (!selectedItemTypes.length && level.mechanics.hasAir ? 'cursor-pointer hover:scale-110' : '')}`} style={{ left: `${level.campPos.x}%`, top: `${level.campPos.y}%` }}>
            <div className="relative">
                <div className="text-5xl drop-shadow-lg filter sepia">{level.mechanics.hasAir ? '⛵' : '⛺'}</div>
                {selectedItemTypes.length > 0 && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white text-stone-900 text-xs font-black px-2 py-1 rounded-xl shadow-xl animate-bounce whitespace-nowrap border-2 border-stone-800">
                        ⬇️ Drop Item
                    </div>
                )}
            </div>
          </div> 

          {flyingItem && ( <div className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${flyingItem.x}%`, top: `${flyingItem.y}%`, zIndex: flyingItem.zIndex || 90 }}>{flyingItem.emoji}</div> )}

          {level.id === 'river_crossing' && puzzle?.puzzleEntities.some(e => e.id === puzzle.goalEntityId) && (
            <div className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20" style={{ left: '50%', top: '22%' }}>
                <CaveEntranceProp />
            </div>
          )}

          {puzzle.puzzleEntities.map(ent => {
            const isDefeated = defeated.includes(ent.id);
            if (ent.isPreset && isDefeated) return null;

            const isGoal = ent.id === puzzle.goalEntityId;
            const rewardItem = ent.reward ? level.items.find(i => i.id === ent.reward) : null;
            const isAlerting = alertEntityId === ent.id;
            const isSelected = selectedEntityId === ent.id;
            const depthScale = (ent.depth === 1) ? 'scale-50' : (ent.depth === 2) ? 'scale-75' : 'scale-100';
            const depthFilter = (ent.depth === 1) ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : (ent.depth === 2) ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
            const isAnimating = animatingEntities.includes(ent.id);
            
            const entZ = isSelected ? 150 : (ent.isGatekeeper ? 95 : (ent.depth || 3) * 10 + 5);
            
            const groupedReqs = (ent.requires || []).reduce((acc, reqId) => { acc[reqId] = (acc[reqId] || 0) + 1; return acc; }, {});
            const entityStyle = ent.roamClass ? { top: `${ent.y}%`, zIndex: entZ } : { left: `${ent.x}%`, top: `${ent.y}%`, zIndex: entZ };
            
            const isDigger = Boolean(level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !ent.isGoal);
            const isRock = ent.isGatekeeper && level.mechanics.hasPickaxe && ent.id !== 'final_gate';
            const isCurrent = ent.isGatekeeper && level.mechanics.hasAir;
            
            const inFog = level.mechanics.hasFog && !unlockedZones.includes(ent.zone) && !(ent.isGatekeeper && ent.unlocksZones && ent.unlocksZones.some(z => unlockedZones.includes(z)));

            const interactableHover = inFog ? 'pointer-events-none cursor-default' : (isDefeated && !ent.isGatekeeper) || (isRock && isDefeated) || (isCurrent && isDefeated) ? 'cursor-default' : 'hover:scale-110 cursor-pointer';
            const wrapperClasses = `absolute flex flex-col items-center p-4 -m-4 transition-all duration-300 ${ent.roamClass ? ent.roamClass : 'transform -translate-x-1/2 -translate-y-1/2'} ${interactableHover}`;

            const isNearLeft = !ent.roamClass && ent.x <= 20;
            const isNearRight = !ent.roamClass && ent.x >= 80;
            const isNearTop = ent.y <= 25; 
            const tooltipAlign = isNearLeft ? "left-0" : isNearRight ? "right-0" : "left-1/2 -translate-x-1/2";
            const tooltipY = isNearTop ? "top-full mt-2" : "bottom-full mb-2";
            const arrowAlign = isNearLeft ? "left-4" : isNearRight ? "right-4" : "left-1/2 -translate-x-1/2";
            const arrowY = isNearTop ? "-top-[7px] border-t-2 border-l-2" : "-bottom-[7px] border-b-2 border-r-2";
            
            const isBuried = isDigger && buriedEntities.includes(ent.id);

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
                              <Fragment key={reqId}>
                                <span className="flex items-center gap-1 emoji-shadow" title={dict.items[reqId] || reqId}>
                                  {count > 1 && <span className="text-sm font-black text-amber-600" style={{textShadow: 'none'}}>{count}x</span>}
                                  {level.items.find(item => item.id === reqId)?.emoji || '❓'}
                                </span>
                                {i < arr.length - 1 && <span className="text-sm mx-1 text-stone-500 font-black">{ent.reqType === 'AND' ? '&' : dict.or}</span>}
                              </Fragment>
                            ))
                          )}
                          <div className={`absolute ${arrowY} ${arrowAlign} w-3 h-3 bg-white border-stone-800 rotate-45`}></div>
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      {ent.isGatekeeper && !isRock && !isCurrent && GatekeeperProp && <GatekeeperProp />}
                      
                      <div className={`relative transition-all duration-700 ease-in-out ${(!isRock && !isCurrent && ent.isGatekeeper && isDefeated) ? 'translate-x-12 translate-y-6 rotate-12 opacity-60 grayscale' : (!isRock && !isCurrent && ent.isGatekeeper && isSelected) ? 'translate-x-8 translate-y-2 rotate-3' : (!isRock && !isCurrent && isDefeated) ? 'opacity-50 grayscale' : ''}`}>
                        
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
                        
                        <div className={`drop-shadow-xl relative z-10 ${ent.isGatekeeper || isGoal ? 'text-6xl' : 'text-4xl'}`}>
                           {isRock && !isDefeated ? (
                             <div className={`text-4xl flex gap-1 justify-center items-end group-hover:scale-110 transition-transform cursor-pointer ${isAlerting ? 'animate-troll-mad' : ''}`}>
                               <span className="scale-90 rotate-6">🪨</span><span className="scale-110 -translate-y-2 -rotate-6 z-10">🪨</span><span className="scale-95 rotate-12">🪨</span>
                             </div>
                           ) : isRock && isDefeated ? (
                             <div className="relative group text-3xl flex gap-1 translate-y-4 cursor-pointer z-50 animate-rock-shatter">
                               <span className="scale-75 -rotate-12">🪨</span><span className="scale-50 translate-y-2 rotate-45 z-10">🪨</span><span className="scale-75 rotate-12">🪨</span>
                             </div>
                           ) : isCurrent && isDefeated ? (
                             <div className="text-4xl opacity-0 scale-0 transition-all duration-500">🌀</div>
                           ) : isCurrent && !isDefeated ? (
                             <div className={`text-5xl animate-spin-slow ${isAlerting ? 'animate-troll-mad text-red-500' : 'text-cyan-400'}`}>🌀</div>
                           ) : (
                             <div className={`${ent.filterClass || ''} ${ent.isRight ? 'scale-x-[-1]' : ''} ${isAnimating ? 'animate-dog-dig' : ''}`}>
                               {isAlerting && !ent.isPreset ? '😡' : isAlerting ? '🚫' : ent.emoji}
                             </div>
                           )}
                        </div>
                      </div>
                    </div>
                    {ent.isGatekeeper && isAlerting && <div className="absolute -bottom-5 bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded border border-red-900 shadow-md scale-110 z-30">{dict.blocked}</div>}
                    {isGoal && !isDefeated && !isAlerting && <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-purple-950 font-black tracking-widest text-lg drop-shadow-md z-30 bg-amber-100/80 px-2 rounded">{dict.exit}</div>}
                </div>
              </div>
            );
          })}

          <div className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${playerTransition} pointer-events-none flex items-center justify-center ${playerScale} ${playerFilter}`} style={{ left: `${displayPlayerPos.x}%`, top: `${displayPlayerPos.y}%`, zIndex: Math.max(playerZ, 130) }}>
            <div className={`text-white w-10 h-10 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.8)] text-2xl relative ${level.mechanics.hasAir ? 'bg-cyan-600 border-2 border-cyan-200' : 'bg-blue-600 border-2 border-white'} ${level.mechanics.heroBobs && !isDrowning ? 'animate-bob' : ''}`}>
              {heroFace}
              {level.mechanics.darknessType === 'radial' && <div className="absolute -right-3 -bottom-2 text-xl z-50 drop-shadow-[0_0_10px_rgba(251,191,36,1)]">🕯️</div>}
            </div>
            {showTrophy && <div className="absolute -right-8 top-0 text-4xl animate-bounce drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" style={{animationDelay: '0.2s'}}>🏆</div>}
          </div>

        </div>

        <div className="absolute inset-0 opacity-10 z-[140] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#5c3a21 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="absolute top-4 left-4 z-[150] flex gap-2">
           <button onClick={(e) => { e.stopPropagation(); setLang('he'); }} className={`w-10 h-10 rounded-full border-2 ${lang === 'he' ? 'border-amber-400 scale-110 shadow-lg' : 'border-stone-600 opacity-50'} flex items-center justify-center bg-stone-800`}>🇮🇱</button>
           <button onClick={(e) => { e.stopPropagation(); setLang('en'); }} className={`w-10 h-10 rounded-full border-2 ${lang === 'en' ? 'border-amber-400 scale-110 shadow-lg' : 'border-stone-600 opacity-50'} flex items-center justify-center bg-stone-800`}>🇺🇸</button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setMenuView('main'); setIsMenuOpen(true); }} className="absolute top-4 right-4 z-[150] bg-stone-800 text-stone-200 w-12 h-12 flex items-center justify-center rounded-full border-2 border-stone-600 shadow-lg hover:bg-stone-700 transition-colors"><span className="text-xl pt-0.5">⚙️</span></button>

        {showVictoryMsg && (
          <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
            {[...Array(30)].map((_, i) => ( <div key={i} className="absolute text-3xl animate-star-burst-infinite" style={{ left: `${10 + Math.random() * 80}%`, top: `${10 + Math.random() * 80}%`, '--tx': `${(Math.random() - 0.5) * 200}px`, '--ty': `${(Math.random() - 0.5) * 200}px`, animationDelay: `${Math.random() * 3}s` }}>{['⭐', '🌟', '✨'][Math.floor(Math.random() * 3)]}</div> ))}
            <div className="absolute top-1/2 left-1/2 z-50 pointer-events-none animate-fade-out-up"><div className="bg-amber-100 p-6 rounded-3xl border-8 border-amber-600 text-center shadow-[0_0_80px_rgba(251,191,36,0.6)] whitespace-nowrap"><h2 className="text-3xl sm:text-4xl text-amber-900 font-black uppercase tracking-wider">{dict.questComplete}</h2></div></div>
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
                <span className="text-2xl sm:text-4xl drop-shadow-md emoji-shadow">{item ? item.emoji : ''}</span>
                {count > 1 && <div className="absolute -bottom-2 -right-2 bg-blue-700 text-white text-xs sm:text-sm font-black rounded-full px-2 py-0.5 border-2 border-blue-400 shadow-md">{count}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {renderMenu()}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { if (this.state.hasError) return <div className="text-white text-center p-10 font-bold text-2xl">Something went wrong rendering the game.</div>; return this.props.children; }
}

const App = () => {
  const [activeSettings, setActiveSettings] = useState({ levelId: 'underwater', steps: 5, diggers: 1 });
  const [gameKey, setGameKey] = useState(0);
  const [lang, setLang] = useState('he');

  const applyAndGenerate = (newSettings) => {
    setActiveSettings(newSettings);
    setGameKey(k => k + 1); 
  };

  return (
    <>
      <ErrorBoundary>
        <GameInstance key={`${activeSettings.levelId}-${gameKey}`} level={LEVEL_DICTIONARY[activeSettings.levelId]} targetSteps={activeSettings.steps} numDiggers={activeSettings.diggers} onGenerateNew={applyAndGenerate} lang={lang} setLang={setLang} />
      </ErrorBoundary>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash { to { stroke-dashoffset: 0; } }
        @keyframes fadeOutUp { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.8); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); } 25% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 75% { opacity: 1; transform: translate(-50%, -60%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -100%) scale(0.9); } }
        .animate-fade-out-up { animation: fadeOutUp 3s ease-in-out forwards; }
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
        @keyframes spinSlow { 100% { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spinSlow 4s linear infinite; }
        @keyframes floatUp { 0%, 100% { transform: translate(-50%, -50%); } 50% { transform: translate(-50%, -60%); } }
        .emoji-shadow { text-shadow: 0px 0px 3px rgba(0,0,0,0.8), 0px 0px 8px rgba(0,0,0,0.4); }
      `}} />
    </>
  );
};

export default App;
