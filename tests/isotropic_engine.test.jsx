// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { getProceduralObstacleSegments, getVisibilityPolygon, isPointInVisibilityPolygon, checkCollision } from '../src/logic/visibility.js';
import { checkPolygonCollision, findGlobalPath } from '../src/logic/pathfinding.js';
import { computeNavigationPath } from '../src/logic/navigation.js';
import { evaluateEntityTrade, validateEntitySpacing } from '../src/logic/rules.js';
import { solvePuzzle } from '../src/logic/solver.js';
import { createSavePayload, validateSaveState } from '../src/logic/saveState.js';
import { DEEP_CAVE_GENERATOR_VERSION, DEEP_CAVE_HERO_RADIUS } from '../src/constants.js';
import GameInstance from '../src/components/GameInstance.jsx';

describe('Phase 1: Isotropic Engine & Decoupled Cave Primitives', () => {
  it('builds procedural obstacle segments with horizontal and vertical collars and sight-passing chasms', () => {
    const geometry = {
      worldWidth: 100,
      worldHeight: 200,
      wallPolylines: [
        {
          points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 190 }, { x: 10, y: 190 }],
          closed: true,
          isPillar: false
        },
        {
          points: [{ x: 63, y: 10 }, { x: 69, y: 10 }, { x: 69, y: 108 }, { x: 63, y: 108 }],
          closed: true,
          isPillar: true
        },
        {
          points: [{ x: 63, y: 132 }, { x: 69, y: 132 }, { x: 69, y: 190 }, { x: 63, y: 190 }],
          closed: true,
          isPillar: true
        }
      ]
    };
    const entities = [
      {
        id: 'rock_1',
        x: 50,
        y: 70,
        isGatekeeper: true,
        gateType: 'rock',
        collarBounds: { orientation: 'horizontal', xLeft: 38, xRight: 62, yTop: 67, yBottom: 73 }
      },
      {
        id: 'chasm_1',
        x: 66,
        y: 120,
        isGatekeeper: true,
        gateType: 'chasm',
        collarBounds: { orientation: 'vertical', xLeft: 63, xRight: 69, yTop: 108, yBottom: 132 }
      }
    ];

    const segs = getProceduralObstacleSegments(entities, geometry, []);
    const rockSegs = segs.filter(s => s.rockId === 'rock_1');
    const chasmSegs = segs.filter(s => s.rockId === 'chasm_1');
    expect(rockSegs).toHaveLength(4);
    expect(rockSegs.every(s => s.blocksSight === true)).toBe(true);
    expect(chasmSegs).toHaveLength(4);
    expect(chasmSegs.every(s => s.blocksSight === false)).toBe(true);

    // Torchlight passes over chasm but is blocked by rock
    const polyFromTop = getVisibilityPolygon({ x: 50, y: 55 }, segs, 45, 1);
    expect(isPointInVisibilityPolygon({ x: 50, y: 80 }, polyFromTop)).toBe(false);

    const polyNearChasm = getVisibilityPolygon({ x: 50, y: 120 }, segs, 45, 1);
    expect(isPointInVisibilityPolygon({ x: 75, y: 120 }, polyNearChasm)).toBe(true);

    // Pathfinding still blocks walking across the chasm until cleared
    const blockedPath = findGlobalPath({ x: 50, y: 120 }, { x: 78, y: 120 }, segs, { width: 100, height: 200 }, [], 2.5, { radius: DEEP_CAVE_HERO_RADIUS });
    expect(blockedPath).toEqual([]);

    // Once chasm is defeated (bridged), pathfinding crosses cleanly
    const segsBridged = getProceduralObstacleSegments(entities, geometry, ['chasm_1']);
    const openPath = findGlobalPath({ x: 50, y: 120 }, { x: 78, y: 120 }, segsBridged, { width: 100, height: 200 }, [], 2.5, { radius: DEEP_CAVE_HERO_RADIUS });
    expect(openPath.length).toBeGreaterThan(0);
  });

  it('validates entity spacing and wall clearance against wallPolylines in isotropic space', () => {
    const wallPolylines = [
      {
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 120 }, { x: 0, y: 120 }],
        closed: true
      }
    ];
    const valid = validateEntitySpacing(
      [
        { id: 'e1', x: 25, y: 30, zone: 1 },
        { id: 'e2', x: 45, y: 30, zone: 2 }
      ],
      { minEntityDistance: 14, wallPolylines, minWallMargin: 6.5, checkAllPairs: true }
    );
    expect(valid.isValid).toBe(true);

    const tooClose = validateEntitySpacing(
      [
        { id: 'e1', x: 13, y: 30, zone: 1 }, // 3 units from x=10 wall (< 6.5)
        { id: 'e2', x: 20, y: 30, zone: 2 }  // 7 units from e1 (< 14)
      ],
      { minEntityDistance: 14, wallPolylines, minWallMargin: 6.5, checkAllPairs: true }
    );
    expect(tooClose.isValid).toBe(false);
    expect(tooClose.violations.some(v => v.type === 'WALL_CLEARANCE')).toBe(true);
    expect(tooClose.violations.some(v => v.type === 'ENTITY_DISTANCE')).toBe(true);
  });

  it('requires explicit item selection for chasms and guardians, while solver matches null selection', () => {
    const chasm = { id: 'chasm_1', isGatekeeper: true, gateType: 'chasm', requires: ['rope'], reqType: 'AND', reward: null, zone: 1, unlocksZones: [2] };
    const guardian = { id: 'guard_1', isGatekeeper: true, gateType: 'guardian', requires: ['crystal'], reqType: 'AND', reward: null, zone: 2, unlocksZones: [3] };
    const goal = { id: 'vault_rock', isGatekeeper: true, gateType: 'rock', requires: ['pickaxe'], reqType: 'AND', reward: null, zone: 3, unlocksZones: [4] };

    // Both chasm and guardian require explicit selection in the UI (no auto-use)
    expect(evaluateEntityTrade(['rope'], chasm, []).canDefeat).toBe(false);
    expect(evaluateEntityTrade(['rope'], chasm, ['rope']).canDefeat).toBe(true);
    expect(evaluateEntityTrade(['crystal'], guardian, []).canDefeat).toBe(false);
    expect(evaluateEntityTrade(['crystal'], guardian, ['crystal']).canDefeat).toBe(true);

    const mockLevel = { mechanics: { isVertical: true, hasPickaxe: true, hasTransformation: false } };
    const sol = solvePuzzle(['rope', 'crystal', 'pickaxe'], [chasm, guardian, goal], 'vault_rock', mockLevel);
    expect(sol).not.toBeNull();
    // chasm = 0 steps, guardian (barter) = 1 step, vault_rock (goal) = 1 step -> 2 steps total
    expect(sol.steps).toBe(2);
  });

  it('supports compact deep_cave autosaves and full debug snapshot exports', () => {
    const puzzle = {
      levelId: 'deep_cave',
      seed: 12345,
      settings: { preset: 'normal', targetSteps: 8 },
      generatorVersion: DEEP_CAVE_GENERATOR_VERSION,
      goalEntityId: 'vault_rock',
      startItems: ['crystal'],
      puzzleEntities: [{ id: 'vault_rock', x: 50, y: 180, zone: 1, isGatekeeper: true, requires: ['pickaxe'], reqType: 'AND' }],
      solution: [],
      geometry: { worldWidth: 100, worldHeight: 256, wallPolylines: [[{ x: 0, y: 0 }, { x: 100, y: 0 }]] }
    };

    const compactPayload = createSavePayload({
      levelId: 'deep_cave',
      targetSteps: 8,
      numDiggers: 1,
      puzzle,
      compact: true,
      pathHistory: [{ x: 50, y: 20, zone: 1 }]
    });
    expect(compactPayload.puzzle).toBeNull();
    expect(compactPayload.seed).toBe(12345);
    expect(compactPayload.generatorVersion).toBe(DEEP_CAVE_GENERATOR_VERSION);
    expect(validateSaveState(compactPayload, { deep_cave: { id: 'deep_cave', items: [] } }).valid).toBe(true);

    const stalePayload = { ...compactPayload, generatorVersion: DEEP_CAVE_GENERATOR_VERSION + 99 };
    const staleCheck = validateSaveState(stalePayload, { deep_cave: { id: 'deep_cave', items: [] } });
    expect(staleCheck.valid).toBe(false);
    expect(staleCheck.versionMismatch).toBe(true);

    const debugPayload = createSavePayload({
      levelId: 'deep_cave',
      targetSteps: 8,
      numDiggers: 1,
      puzzle,
      compact: false,
      pathHistory: [{ x: 50, y: 20, zone: 1 }]
    });
    expect(debugPayload.puzzle.geometry.worldHeight).toBe(256);
    expect(validateSaveState(debugPayload, { deep_cave: { id: 'deep_cave', items: [] } }).valid).toBe(true);
  });

  describe('GameInstance isotropic rendering & interaction', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
      cleanup();
      vi.useRealTimers();
    });

    it('renders isotropic level with puzzle-owned geometry, positions camp/entities in world units, and clears chasm with rope', async () => {
      const mockIsoLevel = {
        id: 'deep_cave',
        name: 'The Abyssal Descent',
        items: [
          { id: 'rope', name: 'Rope', emoji: '🪢' },
          { id: 'pickaxe', name: 'Pickaxe', emoji: '⛏️' }
        ],
        entities: [],
        mapNodes: [],
        sceneryNodes: [],
        campPos: { x: 50, y: 20 },
        mechanics: {
          isCaveType: true,
          useIsotropicCoords: true,
          hasPickaxe: true,
          hasDarkness: true,
          darknessType: 'radial',
          isVertical: true,
          screens: 1.5
        },
        BackgroundComponent: ({ geometry }) => <div data-testid="iso-bg" data-height={geometry?.worldHeight} />
      };

      const savedState = {
        levelId: 'deep_cave',
        targetSteps: 3,
        numDiggers: 0,
        inventory: ['rope'],
        unlockedZones: [1],
        defeated: [],
        pathHistory: [{ x: 50, y: 20, zone: 1 }],
        puzzle: {
          levelId: 'deep_cave',
          goalEntityId: 'vault_rock',
          startItems: ['rope'],
          solution: [],
          geometry: {
            worldWidth: 100,
            worldHeight: 256,
            campPos: { x: 50, y: 20 },
            wallPolylines: [
              { points: [{ x: 10, y: 5 }, { x: 90, y: 5 }, { x: 90, y: 250 }, { x: 10, y: 250 }], closed: true }
            ],
            obstaclePolygons: []
          },
          puzzleEntities: [
            {
              id: 'chasm_1',
              x: 50,
              y: 45,
              zone: 1,
              isGatekeeper: true,
              gateType: 'chasm',
              requires: ['rope'],
              reqType: 'AND',
              reward: null,
              unlocksZones: [2],
              collarBounds: { orientation: 'horizontal', xLeft: 38, xRight: 62, yTop: 42, yBottom: 48 }
            },
            {
              id: 'vault_rock',
              x: 50,
              y: 120,
              zone: 2,
              isGatekeeper: true,
              gateType: 'rock',
              requires: ['pickaxe'],
              reqType: 'AND',
              reward: null,
              unlocksZones: [3],
              collarBounds: { orientation: 'horizontal', xLeft: 38, xRight: 62, yTop: 117, yBottom: 123 }
            }
          ]
        }
      };

      const { getByTestId, container } = render(
        <GameInstance level={mockIsoLevel} targetSteps={3} numDiggers={0} savedState={savedState} lang="en" />
      );

      await act(async () => { vi.advanceTimersByTime(200); });

      expect(getByTestId('iso-bg').getAttribute('data-height')).toBe('256');
      // Camp positioned at (20 / 256) * 100 = 7.8125%
      const chasmEl = Array.from(container.querySelectorAll('div[class*="absolute"]')).find(
        el => el.style && el.style.left === '38%' && el.style.width === '24%'
      );
      expect(chasmEl).toBeDefined();
      expect(chasmEl.style.top).toContain('17.578'); // 45 / 256 * 100

      // Clicking chasm without selecting rope inspects its requirement rather than auto-consuming
      await act(async () => { fireEvent.click(chasmEl); });
      expect(chasmEl.querySelector('[data-sprite-id="rope"]')).toBeTruthy();

      // Select rope in inventory bar, then click chasm to walk up and bridge it
      const ropeSlot = Array.from(container.querySelectorAll('button')).find(
        b => Boolean(b.querySelector('[data-sprite-id="rope"]'))
      );
      expect(ropeSlot).toBeDefined();
      await act(async () => { fireEvent.click(ropeSlot); });
      await act(async () => { fireEvent.click(chasmEl); });
      await act(async () => { vi.advanceTimersByTime(1200); });
      expect(container.querySelector('button [data-sprite-id="rope"]')).toBeNull(); // Rope consumed from inventory
    });

    it('navigates column 4 (worldWidth > 100) without truncation and rejects targets inside solid polygons', () => {
      const wallPoly = [
        { x: 112, y: 5 },
        { x: 118, y: 5 },
        { x: 118, y: 65 },
        { x: 112, y: 65 }
      ];
      const geometry = {
        worldWidth: 133.33,
        worldHeight: 192,
        wallPolylines: [
          { points: [{ x: 5, y: 5 }, { x: 128, y: 5 }, { x: 128, y: 187 }, { x: 5, y: 187 }], closed: true },
          { points: wallPoly, closed: true, isPillar: true }
        ],
        obstaclePolygons: [wallPoly]
      };
      const segs = getProceduralObstacleSegments([], geometry, []);

      // Path in column 4 (x > 100) must route around the wall rather than failing at width=100
      const wps = computeNavigationPath({
        lastPos: { x: 102, y: 25, zone: 1 },
        targetX: 124,
        targetY: 25,
        targetZone: 1,
        isCaveType: true,
        useIsotropic: true,
        worldWidth: 133.33,
        worldHeight: 192,
        yScale: 1,
        obstacleSegments: segs,
        obstaclePolygons: geometry.obstaclePolygons
      });
      expect(wps.length).toBeGreaterThan(1);
      const full = [{ x: 102, y: 25 }, ...wps];
      for (let i = 0; i < full.length - 1; i++) {
        expect(checkCollision(full[i], full[i + 1], segs)).toBe(false);
        expect(checkPolygonCollision(full[i], full[i + 1], geometry.obstaclePolygons)).toBe(false);
      }

      // Target inside solid polygon must be rejected
      const blocked = findGlobalPath(
        { x: 102, y: 25 },
        { x: 115, y: 35 },
        segs,
        { width: 133.33, height: 192 },
        geometry.obstaclePolygons,
        2.5,
        { radius: DEEP_CAVE_HERO_RADIUS }
      );
      expect(blocked).toEqual([]);
    });

    it('steps hero waypoint-by-waypoint around a wall when clicking an entity lit on the opposite side', async () => {
      const dividerWall = [
        { x: 46, y: 5 },
        { x: 54, y: 5 },
        { x: 54, y: 70 },
        { x: 46, y: 70 }
      ];
      const mockIsoLevel = {
        id: 'deep_cave',
        name: 'The Abyssal Descent',
        items: [{ id: 'crystal', name: 'Crystal', emoji: '💎' }],
        entities: [],
        mapNodes: [],
        sceneryNodes: [],
        campPos: { x: 25, y: 20 },
        mechanics: {
          isCaveType: true,
          useIsotropicCoords: true,
          hasPickaxe: true,
          hasDarkness: true,
          darknessType: 'radial',
          isVertical: true,
          screens: 1.5
        },
        BackgroundComponent: () => <div data-testid="iso-bg" />
      };

      const savedState = {
        levelId: 'deep_cave',
        targetSteps: 3,
        numDiggers: 0,
        inventory: ['crystal'],
        unlockedZones: [1],
        defeated: [],
        litBraziers: ['brazier_east'],
        pathHistory: [{ x: 25, y: 20, zone: 1 }],
        puzzle: {
          levelId: 'deep_cave',
          goalEntityId: 'vault_rock',
          startItems: ['crystal'],
          solution: [],
          geometry: {
            worldWidth: 100,
            worldHeight: 192,
            campPos: { x: 25, y: 20 },
            torchRadius: 45,
            wallPolylines: [
              { points: [{ x: 5, y: 5 }, { x: 95, y: 5 }, { x: 95, y: 187 }, { x: 5, y: 187 }], closed: true },
              { points: dividerWall, closed: true, isPillar: true }
            ],
            obstaclePolygons: [dividerWall],
            braziers: [{ id: 'brazier_east', x: 75, y: 30, zone: 1, radius: 35 }]
          },
          puzzleEntities: [
            {
              id: 'east_trader',
              x: 75,
              y: 20,
              zone: 1,
              emoji: '🧙',
              requires: ['crystal'],
              reqType: 'AND',
              reward: null
            },
            {
              id: 'vault_rock',
              x: 50,
              y: 160,
              zone: 1,
              emoji: '👑',
              isGoal: true,
              isPreset: 'treasure',
              isTreasure: true,
              requires: [],
              reqType: 'AND',
              reward: null
            }
          ]
        }
      };

      const { getByTestId, getByText } = render(
        <GameInstance level={mockIsoLevel} targetSteps={3} numDiggers={0} savedState={savedState} lang="en" />
      );

      await act(async () => { vi.advanceTimersByTime(100); });

      const heroWrap = getByText('🤠').closest('div[style*="left:"]');
      expect(heroWrap.style.left).toBe('25%');

      // Click the trader visible on the opposite side of the divider wall (lit by brazier_east)
      await act(async () => {
        fireEvent.click(getByTestId('entity-east_trader'));
      });

      // Immediately after click, hero starts on the first intermediate waypoint (NOT jumping directly to x=75)
      const firstX = parseFloat(heroWrap.style.left);
      expect(firstX).toBeLessThan(60);

      // Advance through remaining waypoints to arrive around the wall
      for (let i = 0; i < 8; i++) {
        await act(async () => { vi.advanceTimersByTime(800); });
      }
      const arrivedX = parseFloat(heroWrap.style.left);
      const arrivedY = parseFloat(heroWrap.style.top);
      expect(arrivedX).toBeGreaterThan(60);
      expect(arrivedY).toBeLessThan(35);
    });
  });
});
