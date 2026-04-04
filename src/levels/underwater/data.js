// === Underwater: Items ===
export const items = [
  { id: 'pearl', name: 'Pearl', emoji: '⚪' }, { id: 'shell', name: 'Shell', emoji: '🐚' },
  { id: 'starfish', name: 'Starfish', emoji: '⭐' }, { id: 'trident', name: 'Trident', emoji: '🔱' },
  { id: 'comb', name: 'Dinglehopper', emoji: '🍴' }, { id: 'mirror', name: 'Looking Glass', emoji: '🪞' },
  { id: 'boot', name: 'Old Boot', emoji: '🥾' }, { id: 'locket', name: 'Golden Locket', emoji: '📿' },
  { id: 'fish', name: 'Fish', emoji: '🐟' }, { id: 'gold_fish', name: 'Goldfish', emoji: '🐠' },
  { id: 'crown', name: 'Glowing Crown', emoji: '👑' }, { id: 'gem', name: 'Gem', emoji: '💎' },
  { id: 'crystal', name: 'Crystal', emoji: '🔮' }
];

// === Underwater: Entity Templates ===
export const entities = [
  { id: 'mermaid_teal', name: 'Teal Mermaid', emoji: '🧜‍♀️', color: '#2dd4bf', allowedReqs: ['comb', 'mirror', 'boot', 'starfish', 'locket'], roamClass: 'elevator' },
  { id: 'mermaid_red', name: 'Red Mermaid', emoji: '🧜‍♀️', color: '#fb7185', allowedReqs: ['comb', 'mirror', 'boot', 'starfish', 'locket'], roamClass: 'elevator' },
  { id: 'mermaid_purple', name: 'Purple Mermaid', emoji: '🧜‍♀️', color: '#a855f7', allowedReqs: ['comb', 'mirror', 'boot', 'starfish', 'locket'], roamClass: 'elevator' },
  { id: 'mermaid_green', name: 'Green Mermaid', emoji: '🧜‍♀️', color: '#4ade80', allowedReqs: ['comb', 'mirror', 'boot', 'starfish', 'locket'], roamClass: 'elevator' },
  { id: 'octopus', name: 'Octopus', emoji: '🐙', allowedReqs: ['trident', 'pearl', 'starfish', 'locket'] },
  { id: 'crab', name: 'Crab', emoji: '🦀', allowedReqs: ['shell', 'pearl', 'boot', 'comb'] },
  { id: 'dolphin', name: 'Dolphin', emoji: '🐬', allowedReqs: ['fish', 'gold_fish'], roamClass: 'elevator' },
  { id: 'clam', name: 'Giant Clam', emoji: '🐚', allowedReqs: ['pearl', 'shell', 'starfish', 'comb', 'mirror'] },
  { id: 'sea_witch', name: 'Sea Witch', emoji: '😈', allowedReqs: ['pearl', 'locket', 'trident'] }
];

// === Underwater: Map Layout ===
export const mapNodes = [
  /* Zone 1: Surface & Near Surface -> Dolphins + free fish + Vents */
  { x: 40, y: 24, zone: 1 }, { x: 60, y: 24, zone: 1 }, { x: 50, y: 34, zone: 1 },
  { x: 35, y: 42, zone: 1, isPreset: 'bubble_vent', isVent: true },
  { x: 65, y: 42, zone: 1, isPreset: 'bubble_vent', isVent: true },
  /* Zone 2: Deep Sea -> Mermaids (trade items) and Sea Witch (transformation) */
  { x: 40, y: 52, zone: 2 }, { x: 60, y: 52, zone: 2 }, { x: 50, y: 60, zone: 2 },
  { x: 50, y: 70, zone: 2, id: 'sea_witch', isGatekeeper: true },
  /* Zone 3: The Trench / Seabed -> 3 Clams (items hidden inside) + Crabs */
  { x: 50, y: 80, zone: 3 },
  { x: 35, y: 86, zone: 3 }, { x: 65, y: 86, zone: 3 },
  { x: 25, y: 92, zone: 3 }, { x: 50, y: 92, zone: 3 }, { x: 75, y: 92, zone: 3 }
];

// === Underwater: Scenery ===
export const sceneryNodes = [
  { x: 10, y: 22, e: '🪸', s: 'text-4xl', z: 20 }, { x: 88, y: 28, e: '🪸', s: 'text-5xl', z: 20 },
  { x: 6, y: 48, e: '🪸', s: 'text-5xl', z: 20 }, { x: 92, y: 54, e: '🪸', s: 'text-4xl', z: 20 },
  { x: 12, y: 66, e: '🪸', s: 'text-3xl', z: 20 }, { x: 88, y: 70, e: '🪸', s: 'text-3xl', z: 20 },
  { x: 4, y: 55, e: '🌱', s: 'text-3xl', z: 20 }, { x: 94, y: 62, e: '🌱', s: 'text-3xl', z: 20 },
  { x: 25, y: 88, e: '🚢', s: 'text-6xl brightness-50', z: 10 }, // Shipwreck!
];
