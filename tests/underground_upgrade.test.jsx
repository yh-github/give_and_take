// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import LEVEL_REGISTRY from '../src/levels/index.js';
import STRINGS from '../src/strings.js';
import { UNDERGROUND_PRESETS } from '../src/levels/cave_shared/presets.js';
import { generateUndergroundPuzzle } from '../src/levels/underground/generator.js';
import { getUndergroundObstaclePolygons, CAVE_WALL_VERTICES } from '../src/levels/underground/components.jsx';
import { findGlobalPath } from '../src/logic/pathfinding.js';
import { getObstacleSegments, computeVisibleEntitiesSet } from '../src/logic/visibility.js';
import { GameInstance } from '../src/components/GameInstance.jsx';

describe('Underground Cave Upgrade & Unification Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('scales difficulty presets (easy -> expert), forces non-linear both-wing play on normal+, and ends at deep_cave_exit', () => {
    const level = LEVEL_REGISTRY.underground;
    const easy = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.easy, null, 'ug-preset-1');
    const normal = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.normal, null, 'ug-preset-1');
    const hard = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.hard, null, 'ug-preset-1');
    const expert = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.expert, null, 'ug-preset-1');

    for (const [name, preset, p] of [
      ['easy', UNDERGROUND_PRESETS.easy, easy],
      ['normal', UNDERGROUND_PRESETS.normal, normal],
      ['hard', UNDERGROUND_PRESETS.hard, hard],
      ['expert', UNDERGROUND_PRESETS.expert, expert]
    ]) {
      expect(p, `preset ${name} should generate a puzzle`).not.toBeNull();
      expect(p.steps, `preset ${name} steps`).toBeGreaterThanOrEqual(preset.targetSteps);
      expect(p.steps, `preset ${name} steps`).toBeLessThanOrEqual(preset.targetSteps + 1);
      expect(p.goalEntityId).toBe('vault_rock');

      // Zone 9 should end with deep_cave_exit instead of dead-end treasure
      const exitEnt = p.puzzleEntities.find(e => e.id === 'deep_cave_exit');
      expect(exitEnt).toBeDefined();
      expect(exitEnt.isExit).toBe(true);
      expect(exitEnt.zone).toBe(9);
      expect(p.puzzleEntities.some(e => e.isTreasure && e.zone === 9)).toBe(false);
    }

    // Normal, Hard, Expert must visit both Left (2,4) & Right (3,5) wings, include Chasms, multi-req Guardians & higher score
    for (const p of [normal, hard, expert]) {
      expect(p.diagnostics.visitsBothWings).toBe(true);
      expect(p.puzzleEntities.some(e => e.isGatekeeper && e.gateType === 'chasm')).toBe(true);
      expect(p.difficulty.multiReqGateCount).toBeGreaterThanOrEqual(1);
    }

    expect(hard.difficulty.score).toBeGreaterThan(easy.difficulty.score);
    expect(expert.steps).toBeGreaterThan(normal.steps);
    expect(expert.puzzleEntities.find(e => e.id === 'vault_rock').requires.length).toBeGreaterThanOrEqual(2);
  });

  it('provides solid obstaclePolygons blocking clicks inside cave walls and central pillar', () => {
    const polys = getUndergroundObstaclePolygons(2.5);
    expect(polys).toHaveLength(3);

    const segments = getObstacleSegments([], CAVE_WALL_VERTICES, [1], [], 2.5);
    const start = { x: 50, y: 5 };
    // Inside central pillar (x=50, y_unscaled=40 => y_scaled=100)
    expect(findGlobalPath(start, { x: 50, y: 100 }, segments, { width: 100, height: 250 }, polys, 2.5)).toEqual([]);
    // Inside left wall (x=5, y_unscaled=40 => y_scaled=100)
    expect(findGlobalPath(start, { x: 5, y: 100 }, segments, { width: 100, height: 250 }, polys, 2.5)).toEqual([]);
  });

  it('scales vertical distance by yScale in computeVisibleEntitiesSet', () => {
    const farVerticalEntity = {
      id: 'far_vert',
      x: 50,
      y: 30, // dy from y=2 is 28; scaled by 2.5 => 70 > torchRadius=50
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

  it('renders braziers and AbyssalExitSVG, and transitions to deep_cave via next-level button on victory', async () => {
    const level = LEVEL_REGISTRY.underground;
    const puzzle = generateUndergroundPuzzle(level, UNDERGROUND_PRESETS.normal, null, 'ug-ui-exit');
    const onGenerateNew = vi.fn();

    const savedState = {
      levelId: 'underground',
      targetSteps: puzzle.settings.targetSteps,
      numDiggers: puzzle.settings.numDiggers,
      settings: puzzle.settings,
      puzzle,
      inventory: [],
      unlockedZones: [1, 6, 7, 8, 9],
      defeated: ['rock_left_1', 'rock_left_2', 'rock_left_3', 'rock_final_1', 'rock_final_2', 'vault_rock'],
      pathHistory: [{ x: 68, y: 94, zone: 8 }]
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

    // Braziers & Abyssal Exit SVG should be rendered
    expect(container.querySelector('[data-testid="brazier-brazier_left"]')).toBeDefined();
    const exitSvg = screen.getByTestId('abyssal-exit');
    expect(exitSvg).toBeDefined();

    // Click the exit entity to complete the level
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
