/**
 * Custom puzzle generator for the Underwater level.
 * Unlike the shared generator, this creates a hand-crafted puzzle layout
 * with fixed entity roles (dolphins as transport, mermaids as traders,
 * clams as item containers, Sea Witch as transformation gate).
 *
 * @param {Object} level - The underwater level definition
 * @returns {Object} Generated puzzle
 */
export function generateUnderwaterPuzzle(level) {
  const startItems = [];
  let puzzleEntities = [];

  const z1Nodes = level.mapNodes.filter(n => n.zone === 1 && !n.isGatekeeper && !n.isPreset);
  const z2Nodes = level.mapNodes.filter(n => n.zone === 2 && !n.isGatekeeper && !n.isPreset && n.id !== 'sea_witch');
  const z3Nodes = level.mapNodes.filter(n => n.zone === 3 && !n.isGatekeeper && !n.isPreset);

  // Dolphins are transport-only elevators: trade a fish to hitch a ride (no item reward)
  const dolphinTpl = level.entities.find(e => e.id === 'dolphin');
  if (z1Nodes.length >= 1) {
      puzzleEntities.push({ ...dolphinTpl, id: 'dolphin_1', emoji: '🐬', requires: ['fish', 'gold_fish'], reqType: 'OR', reward: null, x: z1Nodes[0].x, y: z1Nodes[0].y, zone: z1Nodes[0].zone, isGatekeeper: false });
  }

  const mermaidTpl = level.entities.find(e => e.id.startsWith('mermaid'));
  const mermaidEmojis = ['🧜‍♀️', '🧜🏻‍♀️', '🧜🏼‍♀️', '🧜🏽‍♀️', '🧜🏾‍♀️'];
  
  if (z2Nodes.length >= 3) {
      puzzleEntities.push({ ...mermaidTpl, id: 'mermaid_1', emoji: mermaidEmojis[1], requires: ['mirror'], reqType: 'OR', reward: 'starfish', x: z2Nodes[0].x, y: z2Nodes[0].y, zone: z2Nodes[0].zone, isGatekeeper: false });
      puzzleEntities.push({ ...mermaidTpl, id: 'mermaid_2', emoji: mermaidEmojis[3], requires: ['boot'], reqType: 'OR', reward: 'pearl', x: z2Nodes[1].x, y: z2Nodes[1].y, zone: z2Nodes[1].zone, isGatekeeper: false });
      puzzleEntities.push({ ...mermaidTpl, id: 'mermaid_3', emoji: mermaidEmojis[4], requires: ['comb'], reqType: 'OR', reward: 'trident', x: z2Nodes[2].x, y: z2Nodes[2].y, zone: z2Nodes[2].zone, isGatekeeper: false });
  }

  const witchEnt = level.entities.find(e => e.id === 'sea_witch');
  const witchNode = level.mapNodes.find(n => n.id === 'sea_witch');
  if (witchEnt && witchNode) {
      puzzleEntities.push({ ...witchEnt, ...witchNode, emoji: '😈', requires: ['locket', 'pearl'], reqType: 'AND', reward: null, id: 'sea_witch', isGatekeeper: false });
  }

  const clamTpl = level.entities.find(e => e.id === 'clam');
  const crabTpl = level.entities.find(e => e.id === 'crab');
  
  if (z3Nodes.length >= 6) {
      puzzleEntities.push({ ...clamTpl, id: 'clam_1', requires: ['starfish'], reqType: 'OR', reward: 'shell', x: z3Nodes[0].x, y: z3Nodes[0].y, zone: z3Nodes[0].zone, isGatekeeper: false });
      puzzleEntities.push({ ...crabTpl, id: 'crab_1', emoji: '🦀', requires: ['shell'], reqType: 'OR', reward: 'gem', x: z3Nodes[1].x, y: z3Nodes[1].y, zone: z3Nodes[1].zone, isGatekeeper: false });
      puzzleEntities.push({ ...crabTpl, id: 'crab_3', emoji: '🦀', requires: ['fish'], reqType: 'OR', reward: 'gold_fish', x: z3Nodes[2].x, y: z3Nodes[2].y, zone: z3Nodes[2].zone, isGatekeeper: false });
      puzzleEntities.push({ ...clamTpl, id: 'clam_2', requires: ['gem', 'crystal'], reqType: 'AND', reward: 'pearl', x: z3Nodes[3].x, y: z3Nodes[3].y, zone: z3Nodes[3].zone, isGatekeeper: false });
      puzzleEntities.push({ ...clamTpl, id: 'clam_3', requires: ['pearl'], reqType: 'OR', reward: 'crown', x: z3Nodes[4].x, y: z3Nodes[4].y, zone: z3Nodes[4].zone, isGatekeeper: false, isGoal: true });
      puzzleEntities.push({ ...crabTpl, id: 'crab_2', emoji: '🦀', requires: ['trident'], reqType: 'OR', reward: 'crystal', x: z3Nodes[5].x, y: z3Nodes[5].y, zone: z3Nodes[5].zone, isGatekeeper: false });
  }

  return { startItems, puzzleEntities, goalEntityId: 'clam_3', solution: [], steps: 10 };
}
