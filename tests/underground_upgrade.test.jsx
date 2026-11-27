// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import LEVEL_REGISTRY from '../src/levels/index.js';
import STRINGS from '../src/strings.js';
import { UNDERGROUND_PRESETS } from '../src/levels/cave_shared/presets.js';
import { generateUndergroundPuzzle } from '../src/levels/underground/generator.js';
import {
  getUndergroundObstaclePolygons,
  CAVE_WALL_VERTICES,
  UNDERGROUND_BRAZIERS,
  UNDERGROUND_LANDMARKS
} from '../src/levels/underground/components.jsx';
import { findGlobalPath } from '../src/logic/pathfinding.js';
import { getObstacleSegments, computeVisibleEntitiesSet } from '../src/logic/visibility.js';
import { GameInstance } from '../src/components/GameInstance.jsx';

describe('Underground Cave Phase 2 Overhaul Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('generates distinct pure-pickaxe upper-mine puzzles (0 chasms, 0 trolls, 0 braziers, multi-phase Giant Vault Boulder, Ore Veins, ⛏️ x2 Master Miners)', () => {
    const level = LEVEL_REGISTRY.underground;
    const easy = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.easy, null, 'ug-preset-1');
    const normal = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.normal, null, 'ug-preset-1');
    const hard = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.hard, null, 'ug-preset-1');
    const expert = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.expert, null, 'ug-preset-1');

    // Distinct upper-mine landmarks & braziers check
    expect(UNDERGROUND_BRAZIERS).toEqual([]);
    expect(UNDERGROUND_LANDMARKS.some(l => l.kind === 'mushroom_grove')).toBe(false);
    expect(UNDERGROUND_LANDMARKS.some(l => l.kind === 'ruined_arch')).toBe(false);
    expect(UNDERGROUND_LANDMARKS.some(l => l.kind === 'mine_timbers')).toBe(true);
    expect(UNDERGROUND_LANDMARKS.some(l => l.kind === 'abyss_exit_sanctum')).toBe(true);

    for (const [name, preset, p, expectedVaultPhases] of [
      ['easy', UNDERGROUND_PRESETS.easy, easy, 1],
      ['normal', UNDERGROUND_PRESETS.normal, normal, 2],
      ['hard', UNDERGROUND_PRESETS.hard, hard, 3],
      ['expert', UNDERGROUND_PRESETS.expert, expert, 3]
    ]) {
      expect(p, `preset ${name} should generate a puzzle`).not.toBeNull();
      expect(p.steps, `preset ${name} steps`).toBeGreaterThanOrEqual(preset.targetSteps);
      expect(p.steps, `preset ${name} steps`).toBeLessThanOrEqual(preset.targetSteps + 1);
      expect(p.goalEntityId).toBe('vault_rock');
      expect(p.geometry.braziers).toEqual([]);

      // Pure pickaxe: zero chasms and zero trolls anywhere
      expect(p.puzzleEntities.some(e => e.isGatekeeper && e.gateType === 'chasm')).toBe(false);
      expect(p.puzzleEntities.some(e => e.isGatekeeper && e.gateType === 'guardian')).toBe(false);
      expect(p.puzzleEntities.some(e => String(e.id).startsWith('troll'))).toBe(false);

      // Multi-phase Giant Vault Boulder scaling
      const vault = p.puzzleEntities.find(e => e.id === 'vault_rock');
      expect(vault.gateType).toBe('rock');
      expect(vault.requires).toEqual(['pickaxe']);
      expect(vault.maxPhases).toBe(expectedVaultPhases);

      // Grounded non-mushroom freebies in crates/mounds only
      const bareNonMushPresets = p.puzzleEntities.filter(
        e => e.isPreset && !e.isExit && e.reward !== 'mushroom' && !e.containerType
      );
      expect(bareNonMushPresets).toEqual([]);

      // Zone 9 ends with deep_cave_exit instead of dead-end treasure
      const exitEnt = p.puzzleEntities.find(e => e.id === 'deep_cave_exit');
      expect(exitEnt).toBeDefined();
      expect(exitEnt.isExit).toBe(true);
      expect(exitEnt.zone).toBe(9);
      expect(p.puzzleEntities.some(e => e.isTreasure && e.zone === 9)).toBe(false);
    }

    // Normal, Hard, Expert: both wings, Ore Vein, ⛏️ x2 Master Miner, peekable rocks
    for (const p of [normal, hard, expert]) {
      expect(p.diagnostics.visitsBothWings).toBe(true);
      expect(p.puzzleEntities.some(e => e.containerType === 'ore_vein' && e.requires.includes('pickaxe'))).toBe(true);
      expect(p.puzzleEntities.some(e => e.reward === 'pickaxe' && (e.rewardCount || 1) >= 2)).toBe(true);
      expect(p.puzzleEntities.some(e => e.isGatekeeper && e.peekable)).toBe(true);
      expect(p.difficulty.multiReqGateCount).toBeGreaterThanOrEqual(1);
    }

    expect(hard.difficulty.score).toBeGreaterThan(easy.difficulty.score);
    expect(expert.steps).toBeGreaterThan(normal.steps);

    // Max knob targetSteps = 12 should also generate reliably
    const max12 = generateUndergroundPuzzle(level, 12, 3, 'ug-max-12');
    expect(max12).not.toBeNull();
    expect(max12.steps).toBeGreaterThanOrEqual(12);
  });

  it('varies loop-wins vs shortcut-wins side passage modes across seeds', () => {
    const level = LEVEL_REGISTRY.underground;
    const modes = new Set();
    for (let i = 0; i < 12; i++) {
      const p = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.hard, null, `ug-route-${i}`);
      expect(p).not.toBeNull();
      modes.add(p.diagnostics.routeMode);
    }
    expect(modes.has('loop_wins')).toBe(true);
    expect(modes.has('shortcut_wins')).toBe(true);
  });

  it('opens sight through peekable rocks and cracked Phase-1 boulders while keeping movement blocked', () => {
    const mockNodes = [
      { id: 'rock_left_1', x: 36, y: 22, zone: 1, isGatekeeper: true, gateType: 'rock', maxPhases: 2, unlocksZones: [2] },
      { id: 'rock_right_1', x: 76, y: 23, zone: 1, isGatekeeper: true, gateType: 'rock', peekable: true, maxPhases: 1, unlocksZones: [3] }
    ];

    const segsIntact = getObstacleSegments(mockNodes, CAVE_WALL_VERTICES, [1], [], 2.5);
    const leftSegsIntact = segsIntact.filter(s => s.rockId === 'rock_left_1');
    const rightSegsIntact = segsIntact.filter(s => s.rockId === 'rock_right_1');
    expect(leftSegsIntact.every(s => s.blocksSight === true)).toBe(true);
    expect(rightSegsIntact.every(s => s.blocksSight === false)).toBe(true);

    // After hitting rock_left_1 once (#p1), sight opens while movement box stays solid
    const segsCracked = getObstacleSegments(mockNodes, CAVE_WALL_VERTICES, [1], ['rock_left_1#p1'], 2.5);
    const leftSegsCracked = segsCracked.filter(s => s.rockId === 'rock_left_1');
    expect(leftSegsCracked.length).toBe(4);
    expect(leftSegsCracked.every(s => s.isRock === true && s.blocksSight === false)).toBe(true);

    // Pathfinding still blocks walking through cracked-but-unbroken rock_left_1
    const polys = getUndergroundObstaclePolygons(2.5);
    const pathAcrossCracked = findGlobalPath(
      { x: 36, y: 18 * 2.5 },
      { x: 36, y: 27 * 2.5 },
      segsCracked,
      { width: 100, height: 250 },
      polys,
      2.5
    );
    expect(pathAcrossCracked).toEqual([]);
  });

  it('scales vertical distance by yScale in computeVisibleEntitiesSet', () => {
    const farVerticalEntity = {
      id: 'far_vert',
      x: 50,
      y: 30,
      zone: 1,
      requires: [],
      reqType: 'AND',
      reward: 'gem'
    };
    const visible = computeVisibleEntitiesSet({
      puzzleEntities: [farVerticalEntity],
      playerPos: { x: 50, y: 2 },
      obstacleSegments: [],
      torchRadius: 50,
      yScale: 2.5,
      levelId: 'underground',
      hasPickaxe: true
    });
    expect(visible.has('far_vert')).toBe(false);
  });

  it('renders 0 braziers, supports 2-phase Giant Vault Boulder hits, and transitions to deep_cave via next-level button', async () => {
    const level = LEVEL_REGISTRY.underground;
    const puzzle = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.normal, null, 'ug-ui-exit');
    const onGenerateNew = vi.fn();

    // Start in Zone 8 with 2 pickaxes in front of 2-phase vault_rock
    const savedState = {
      levelId: 'underground',
      targetSteps: puzzle.settings.targetSteps,
      numDiggers: puzzle.settings.numDiggers,
      settings: puzzle.settings,
      puzzle,
      inventory: ['pickaxe', 'pickaxe'],
      unlockedZones: [1, 2, 4, 6, 7, 8],
      defeated: ['rock_left_1', 'rock_left_2', 'rock_left_3', 'rock_final_1', 'rock_final_2'],
      pathHistory: [{ x: 68, y: 93, zone: 8 }]
    };

    const { container } = render(
      <GameInstance
        level={level}
        targetSteps={puzzle.settings.targetSteps}
        numDiggers={puzzle.settings.numDiggers}
        deepCaveSettings={puzzle.settings}
        onGenerateNew={onGenerateNew}
        savedState={savedState}
        lang="en"
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Upper mine renders zero braziers and shows AbyssalExitSVG
    expect(container.querySelectorAll('[data-testid^="brazier-"]')).toHaveLength(0);
    expect(screen.getByTestId('abyssal-exit')).toBeDefined();

    // Hit 1 on 2-phase Giant Vault Boulder: consumes 1 pickaxe, leaves 1 phase remaining
    const vaultEntity = screen.getByTestId('entity-vault_rock');
    const pickBtn1 = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('⛏️'));
    expect(pickBtn1).toBeDefined();
    await act(async () => {
      fireEvent.click(pickBtn1);
    });
    await act(async () => {
      fireEvent.click(vaultEntity);
      vi.advanceTimersByTime(900);
    });

    expect(vaultEntity.querySelector('[data-phases-remaining="1"]')).not.toBeNull();
    expect(screen.queryByText(STRINGS.en.questComplete)).toBeNull();

    // Hit 2 on Giant Vault Boulder: shatters vault_rock and unlocks Zone 9
    const pickBtn2 = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('⛏️'));
    expect(pickBtn2).toBeDefined();
    await act(async () => {
      fireEvent.click(pickBtn2);
    });
    await act(async () => {
      fireEvent.click(vaultEntity);
      vi.advanceTimersByTime(1200);
    });

    // Click deep_cave_exit to win and descend to deep_cave
    const exitEntity = screen.getByTestId('entity-deep_cave_exit');
    await act(async () => {
      fireEvent.click(exitEntity);
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(STRINGS.en.questComplete)).toBeDefined();
    const nextBtn = screen.getByTestId('next-level-btn');
    expect(nextBtn.textContent).toContain(STRINGS.en.descendDeeper);

    await act(async () => {
      fireEvent.click(nextBtn);
    });

    expect(onGenerateNew).toHaveBeenCalledTimes(1);
    expect(onGenerateNew.mock.calls[0][0].levelId).toBe('deep_cave');
  });
});
