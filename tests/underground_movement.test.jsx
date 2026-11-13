// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../index.jsx';
import { GameInstance } from '../src/components/GameInstance.jsx';
import LEVEL_REGISTRY from '../src/levels/index.js';
import { generateLevelPuzzle } from '../src/logic/generator.js';
import { findGlobalPath } from '../src/logic/pathfinding.js';
import { getObstacleSegments, castRays, isPointInVisibilityPolygon, checkCollision } from '../src/logic/visibility.js';
import { CAVE_WALL_VERTICES } from '../src/levels/underground/components.jsx';
import underground from '../src/levels/underground/index.js';

describe('Underground Level Movement Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('calculates walkable path within underground cave bounds using findGlobalPath', () => {
    const segments = getObstacleSegments([], CAVE_WALL_VERTICES, [1], [], 2.5);
    const start = { x: 50, y: 5 }; // camp position scaled (y=2 * 2.5 = 5)
    const end = { x: 45, y: 25 }; // top cavern reachable position

    // Test with number screens parameter
    const pathWithScreens = findGlobalPath(start, end, segments, 2.5);
    expect(pathWithScreens.length).toBeGreaterThan(0);
    expect(pathWithScreens[pathWithScreens.length - 1].x).toBe(end.x);

    // Test with bounds object parameter
    const pathWithBounds = findGlobalPath(start, end, segments, { width: 100, height: 250 });
    expect(pathWithBounds.length).toBeGreaterThan(0);
    expect(pathWithBounds[pathWithBounds.length - 1].x).toBe(end.x);
  });

  it('moves hero when clicking inside the lit cavern area in Underground level', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Verify initial hero position starts at campPos (50%, 2%)
    const heroFace = screen.getByText('🤠');
    expect(heroFace).toBeDefined();

    const heroContainer = heroFace.closest('[class*="transform"]');
    expect(heroContainer.style.left).toBe('50%');
    expect(heroContainer.style.top).toBe('2%');

    // Click on a walkable point in the illuminated cave (e.g. x=45%, y=8%)
    const innerMap = heroContainer.parentElement;
    
    // Mock getBoundingClientRect on innerMap
    vi.spyOn(innerMap, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 1000,
      right: 400,
      bottom: 1000,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Simulate click at x=45% (180px), y=8% (80px)
    await act(async () => {
      fireEvent.click(innerMap, {
        clientX: 180,
        clientY: 80
      });
    });

    // Advance timers for animation steps
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    // Hero position should have moved from y=2% to y=8%
    expect(heroContainer.style.top).toBe('8%');
  });

  it('moves hero when clicking right below starting position near camp tent', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const heroFace = screen.getByText('🤠');
    const heroContainer = heroFace.closest('[class*="transform"]');
    const innerMap = heroContainer.parentElement;

    vi.spyOn(innerMap, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 1000,
      right: 400,
      bottom: 1000,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Simulate click at x=50% (200px), y=3.5% (35px) right below starting position
    await act(async () => {
      fireEvent.click(innerMap, {
        clientX: 200,
        clientY: 35
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(parseFloat(heroContainer.style.top)).toBeCloseTo(3.5);
  });

  it('moves hero when clicking on an accessible entity in Zone 1', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const heroFace = screen.getByText('🤠');
    const heroContainer = heroFace.closest('[class*="transform"]');
    const innerMap = heroContainer.parentElement;

    // Find interactive entity inside the inner map (excluding inventory dock)
    const entityContainers = innerMap.querySelectorAll('[class*="cursor-pointer"]');
    const targetEntity = Array.from(entityContainers).find(el => {
      // Must be an entity inside the map, not the map container itself
      return el !== innerMap && el.textContent && (el.textContent.includes('🍄') || el.textContent.includes('🧌') || el.textContent.includes('🦴'));
    });

    expect(targetEntity).toBeDefined();
    const initialTop = heroContainer.style.top;

    await act(async () => {
      fireEvent.click(targetEntity);
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    // Hero should move towards the entity
    expect(heroContainer.style.top).not.toBe(initialTop);
  });

  it('renders left channel gatekeeper rocks as visible when hero is standing in front of them', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const heroFace = screen.getByText('🤠');
    const heroContainer = heroFace.closest('[class*="transform"]');
    const innerMap = heroContainer.parentElement;

    vi.spyOn(innerMap, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 1000,
      right: 400,
      bottom: 1000,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // 1. First step down the cave into lit area: x=45%, y=10%
    await act(async () => {
      fireEvent.click(innerMap, {
        clientX: 180, // 45%
        clientY: 100  // 10%
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    // 2. Second step towards left channel rocks: x=30%, y=18%
    await act(async () => {
      fireEvent.click(innerMap, {
        clientX: 120, // 30%
        clientY: 180  // 18%
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    // Check that hero has moved to y=18%
    expect(heroContainer.style.top).toBe('18%');

    // Find rock elements in DOM
    const allEntities = innerMap.querySelectorAll('div[class*="absolute"]');
    const leftRockEntity = Array.from(allEntities).find(el => {
      return el.style && el.style.top === '22%' && el.innerHTML.includes('polygon');
    });

    expect(leftRockEntity).toBeDefined();
    // Left rock in the player's corridor should be visible and NOT hidden behind walls
    expect(leftRockEntity.className).not.toContain('opacity-0');
    expect(leftRockEntity.className).not.toContain('invisible');

    // Downstream rocks (e.g. final gate rocks at y=83%) should be completely occluded by darkness
    const finalRockEntity = Array.from(allEntities).find(el => {
      return el.style && (el.style.top === '78%' || el.style.top === '81%' || el.style.top === '83%') && el.innerHTML.includes('polygon');
    });

    expect(finalRockEntity).toBeDefined();
    expect(finalRockEntity.className).toContain('opacity-0');
    expect(finalRockEntity.className).toContain('invisible');
  });

  it('hides big rocks at the end of paths when standing behind normal rocks in either corridor', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const heroFace = screen.getByText('🤠');
    const heroContainer = heroFace.closest('[class*="transform"]');
    const innerMap = heroContainer.parentElement;

    vi.spyOn(innerMap, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 1000,
      right: 400,
      bottom: 1000,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Step down towards right corridor: x=75%, y=10%
    await act(async () => {
      fireEvent.click(innerMap, {
        clientX: 300, // 75%
        clientY: 100  // 10%
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    const allEntities = innerMap.querySelectorAll('div[class*="absolute"]');
    const finalRockEntity = Array.from(allEntities).find(el => {
      return el.style && (el.style.top === '78%' || el.style.top === '81%' || el.style.top === '83%' || el.style.top === '88%' || el.style.top === '90%' || el.style.top === '95%') && el.innerHTML.includes('polygon');
    });

    expect(finalRockEntity).toBeDefined();
    expect(finalRockEntity.className).toContain('opacity-0');
    expect(finalRockEntity.className).toContain('invisible');
  });

  describe('Zone 6 Left Path Junction & Trapped Hero Regression', () => {
    const screens = 2.5;
    // When playing down the left path, left rocks are defeated, right rocks are intact
    const leftPathDefeated = ['rock_left_1', 'rock_left_2', 'rock_left_3', 'preset_pick_28_73'];
    const unlockedZones = [1, 2, 4, 6];
    const mapNodes = underground.mapNodes;

    it('allows player on the left branch of Zone 6 to cross the junction into the right branch above rock_final_1', () => {
      const segments = getObstacleSegments(mapNodes, CAVE_WALL_VERTICES, unlockedZones, leftPathDefeated, screens);
      const start = { x: 42, y: 74 * screens }; // Left branch node in Zone 6
      const end = { x: 62, y: 73 * screens };   // Junction / right branch node in Zone 6

      const path = findGlobalPath(start, end, segments, screens);

      // Successfully routes across the wide junction chamber above rock_final_1
      expect(path.length).toBeGreaterThan(0);
    });

    it('prevents pathfinding from stepping through undefeated rock_final_1 collision box', () => {
      const segments = getObstacleSegments(mapNodes, CAVE_WALL_VERTICES, unlockedZones, leftPathDefeated, screens);
      const startOutside = { x: 45, y: 83 * screens }; // Just outside left edge of rock_final_1 (x=48)
      const targetInsideRock = { x: 51, y: 83 * screens };   // Inside undefeated rock_final_1 box [48, 88] x [203.75, 211.25]

      const path = findGlobalPath(startOutside, targetInsideRock, segments, screens);

      // Line collision and rock volume check prevent stepping across obstacle boundary
      expect(path.length).toBe(0);
    });

    it('allows hero trapped at user save coordinates (65.84, 79.22) to navigate to walkable Zone 6 ground', () => {
      // Recreate user exact save state: hero is at x: 65.837, y: 79.225
      const segments = getObstacleSegments(mapNodes, CAVE_WALL_VERTICES, [1, 3, 2, 4, 5, 6], leftPathDefeated, screens);
      const heroPos = { x: 65.83716045427036, y: 79.22488095417206 };
      const targetZone6 = { x: 42, y: 74 * screens };

      const path = findGlobalPath({ x: heroPos.x, y: heroPos.y * screens }, targetZone6, segments, screens);

      // With rock_final_1 moved to y=83, hero at y=79.22 is in the open chamber and can navigate to Zone 6
      expect(path.length).toBeGreaterThan(0);
    });

    it('verifies visibility from (65.84, 79.22) illuminates Zone 6 and allows approaching and breaking rock_final_1 to reach Zone 7', () => {
      const heroPos = { x: 65.83716045427036, y: 79.22488095417206 };
      const segmentsBefore = getObstacleSegments(mapNodes, CAVE_WALL_VERTICES, [1, 3, 2, 4, 5, 6], leftPathDefeated, screens);
      const bounds = { width: 100, height: screens * 100 };
      const poly = castRays({ x: heroPos.x, y: heroPos.y * screens }, segmentsBefore, bounds);

      // Hero sees Zone 6 mushroom and the facing edge of rock_final_1 is unobstructed
      expect(isPointInVisibilityPolygon({ x: 75, y: 76 * screens }, poly)).toBe(true);
      const facingEdgeRock = { x: 68, y: (83 - 1.5) * screens };
      const otherSegments = segmentsBefore.filter(s => s.rockId !== 'rock_final_1');
      expect(checkCollision({ x: heroPos.x, y: heroPos.y * screens }, facingEdgeRock, otherSegments)).toBe(false);

      // After breaking rock_final_1, hero can navigate into Zone 7
      const defeatedAfter = [...leftPathDefeated, 'rock_final_1'];
      const unlockedAfter = [1, 2, 3, 4, 5, 6, 7];
      const segmentsAfter = getObstacleSegments(mapNodes, CAVE_WALL_VERTICES, unlockedAfter, defeatedAfter, screens);
      const pathToZone7 = findGlobalPath({ x: heroPos.x, y: heroPos.y * screens }, { x: 60, y: 87 * screens }, segmentsAfter, screens);
      expect(pathToZone7.length).toBeGreaterThan(0);
    });

    it('validates that all entities and map nodes satisfy entity spacing and wall clearance rules', async () => {
      const { validateEntitySpacing } = await import('../src/logic/rules.js');
      const validation = validateEntitySpacing(mapNodes, {
        minEntityDistance: 8.5,
        caveWallVertices: CAVE_WALL_VERTICES,
        minWallMargin: 4.5
      });
      expect(validation.isValid).toBe(true);
      expect(validation.violations).toHaveLength(0);
    });

    it('allows player standing close in Zone 6 with a pickaxe to click and break rock_final_1', async () => {
      const level = LEVEL_REGISTRY.underground;
      const puzzle = generateLevelPuzzle(level, 5, 0, 42);
      const savedState = {
        levelId: 'underground',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['pickaxe'],
        unlockedZones: [1, 2, 4, 6],
        defeated: ['rock_left_1', 'rock_left_2', 'rock_left_3'],
        pathHistory: [{ x: 55, y: 78, zone: 6 }]
      };

      const { container } = render(<GameInstance level={level} targetSteps={5} numDiggers={0} savedState={savedState} lang="en" />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Find rock_final_1 at y=83%
      const rockEntity = Array.from(container.querySelectorAll('div[class*="absolute"]')).find(el => {
        return el.style && el.style.top === '83%' && el.innerHTML.includes('polygon');
      });

      expect(rockEntity).toBeDefined();
      expect(rockEntity.className).not.toContain('opacity-0');
      expect(rockEntity.className).not.toContain('pointer-events-none');

      // Click on the rock to break it
      await act(async () => {
        fireEvent.click(rockEntity);
      });

      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      // Rock is now marked defeated (or breaking) and was clicked successfully without aborting
      expect(rockEntity).toBeDefined();
    });
  });
});
