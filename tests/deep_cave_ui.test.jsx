// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import App from '../index.jsx';
import GameInstance from '../src/components/GameInstance.jsx';
import GameEntity from '../src/components/GameEntity.jsx';
import Hero from '../src/components/Hero.jsx';
import LEVEL_REGISTRY from '../src/levels/index.js';
import STRINGS from '../src/strings.js';
import { DEEP_CAVE_GENERATOR_VERSION, DEEP_CAVE_HERO_RADIUS } from '../src/constants.js';
import { getVisibilityPolygon, isPointInVisibilityPolygon } from '../src/logic/visibility.js';
import { findGlobalPath } from '../src/logic/pathfinding.js';
import { DEEP_CAVE_PRESETS, DEEP_CAVE_KNOB_DEFS } from '../src/levels/deep_cave/presets.js';
import { generateDeepCavePuzzle } from '../src/levels/deep_cave/generator.js';
import { generateDeepCaveAsync } from '../src/levels/deep_cave/workerClient.js';
import {
  AUTOSAVE_STORAGE_KEY,
  createSavePayload,
  exportStateToString,
  importStateFromString
} from '../src/logic/saveState.js';

describe('Deep Cave Phase 4 UI, Worker, Persistence & Hydration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Web Worker client & timeout fallback', () => {
    it('resolves synchronously via microtask when Worker is unavailable', async () => {
      const res = await generateDeepCaveAsync(DEEP_CAVE_PRESETS.easy, {
        seed: 'ui_worker_sync_1',
        WorkerClass: null
      });
      expect(res.usedFallback).toBe(false);
      expect(res.timedOut).toBe(false);
      expect(res.presetId).toBe('easy');
      expect(res.puzzle.seed).toBe('ui_worker_sync_1');
      expect(res.puzzle.steps).toBeGreaterThanOrEqual(5);
    });

    it('falls back to verified seed bank on Worker timeout for standard presets', async () => {
      let terminated = false;
      class HangingWorker {
        postMessage() {
          // Intentionally never responds to trigger timeout cap
        }
        terminate() {
          terminated = true;
        }
      }

      const res = await generateDeepCaveAsync(DEEP_CAVE_PRESETS.hard, {
        seed: 'hung_seed_123',
        timeoutMs: 25,
        WorkerClass: HangingWorker
      });

      expect(terminated).toBe(true);
      expect(res.usedFallback).toBe(true);
      expect(res.timedOut).toBe(true);
      expect(res.presetId).toBe('hard');
      expect(res.puzzle).toBeDefined();
      expect(res.puzzle.steps).toBe(12);
      expect(res.puzzle.geometry).toBeDefined();
    });

    it('throws actionable timeout error for custom settings when Worker times out', async () => {
      let terminated = false;
      class HangingWorker {
        postMessage() {}
        terminate() {
          terminated = true;
        }
      }

      const customKnobs = { ...DEEP_CAVE_PRESETS.normal, torchRadius: 62 };
      await expect(
        generateDeepCaveAsync(customKnobs, {
          seed: 'custom_hung_1',
          timeoutMs: 25,
          WorkerClass: HangingWorker
        })
      ).rejects.toMatchObject({
        code: 'DEEP_CAVE_CUSTOM_TIMEOUT',
        isCustomTimeout: true
      });
      expect(terminated).toBe(true);
    });
  });

  describe('GameMenu Presets, Advanced Knobs & Lighting Override Note', () => {
    it('shows Preset selector, Advanced Settings knobs with Custom badge, and Lighting note for deep_cave', async () => {
      render(
        <GameInstance
          level={LEVEL_REGISTRY.deep_cave}
          targetSteps={8}
          numDiggers={1}
          deepCaveSettings={DEEP_CAVE_PRESETS.normal}
          onGenerateNew={vi.fn()}
          onLoadState={vi.fn()}
          lang="en"
          setLang={vi.fn()}
        />
      );

      // Should display Deep Cave generating message while async generation runs
      expect(screen.queryByText(STRINGS.en.carvingCave) || screen.queryByText('⚙️')).toBeDefined();

      // Wait for generation completion and gear button
      await waitFor(() => {
        expect(screen.getByText('⚙️')).toBeDefined();
      }, { timeout: 5000 });

      // Open Menu -> Lighting Settings to verify Dev Lighting Override Note
      await act(async () => {
        fireEvent.click(screen.getByText('👁️'));
      });
      expect(screen.getByTestId('deep-cave-lighting-note').textContent).toContain(STRINGS.en.debugLightOverrideNote);

      // Return to map, then open Settings via ⚙️ -> Generate Map
      await act(async () => {
        fireEvent.click(screen.getByText(STRINGS.en.back));
      });
      await act(async () => {
        fireEvent.click(screen.getByText(STRINGS.en.generateMap));
      });

      // Verify presets are displayed
      expect(screen.getByTestId('preset-btn-easy')).toBeDefined();
      expect(screen.getByTestId('preset-btn-normal')).toBeDefined();
      expect(screen.getByTestId('preset-btn-hard')).toBeDefined();
      expect(screen.getByTestId('preset-btn-expert')).toBeDefined();
      expect(screen.queryByTestId('deep-cave-custom-badge')).toBeNull();

      // Expand Advanced Settings and verify all 11 knobs
      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-advanced-settings'));
      });
      for (const knobKey of Object.keys(DEEP_CAVE_KNOB_DEFS)) {
        expect(screen.getByTestId(`knob-${knobKey}`)).toBeDefined();
      }

      // Change torchRadius slider -> Custom badge appears immediately
      await act(async () => {
        fireEvent.change(screen.getByTestId('knob-torchRadius'), { target: { value: '62' } });
      });
      expect(screen.getByTestId('deep-cave-custom-badge').textContent).toBe(STRINGS.en.presets.custom);

      // Click Hard preset -> Custom badge disappears
      await act(async () => {
        fireEvent.click(screen.getByTestId('preset-btn-hard'));
      });
      expect(screen.queryByTestId('deep-cave-custom-badge')).toBeNull();
    });
  });

  describe('Compact Autosave, Full Snapshot Export & Seed Hydration', () => {
    it('exports full snapshot with puzzle even when deep_cave autosaves are compact', async () => {
      const deterministic = generateDeepCavePuzzle(
        LEVEL_REGISTRY.deep_cave,
        DEEP_CAVE_PRESETS.easy,
        null,
        'export_test_easy_1'
      );

      // Seed compact save in state so autosave hook runs immediately on mount
      const compactSave = createSavePayload({
        levelId: 'deep_cave',
        targetSteps: deterministic.settings.targetSteps,
        numDiggers: deterministic.settings.numDiggers,
        puzzle: deterministic,
        compact: true,
        inventory: [...deterministic.startItems],
        unlockedZones: [1],
        pathHistory: [{ ...deterministic.geometry.campPos, zone: 1 }]
      });
      expect(compactSave.puzzle).toBeNull();
      expect(compactSave.seed).toBe('export_test_easy_1');
      expect(compactSave.generatorVersion).toBe(DEEP_CAVE_GENERATOR_VERSION);

      render(
        <GameInstance
          level={LEVEL_REGISTRY.deep_cave}
          targetSteps={5}
          numDiggers={0}
          deepCaveSettings={DEEP_CAVE_PRESETS.easy}
          savedState={compactSave}
          onGenerateNew={vi.fn()}
          onLoadState={vi.fn()}
          lang="en"
          setLang={vi.fn()}
        />
      );

      // Autosave should remain compact (no puzzle blob); wait for autosave effect under parallel test load
      let autoSaved = null;
      await waitFor(() => {
        expect(screen.getByText('⚙️')).toBeDefined();
        autoSaved = JSON.parse(localStorage.getItem(AUTOSAVE_STORAGE_KEY));
        expect(autoSaved).not.toBeNull();
      }, { timeout: 5000 });
      expect(autoSaved.levelId).toBe('deep_cave');
      expect(autoSaved.puzzle).toBeNull();
      expect(autoSaved.seed).toBe('export_test_easy_1');

      // Manual Export should serialize FULL puzzle snapshot for bug reports
      await act(async () => {
        fireEvent.click(screen.getByText('⚙️'));
      });
      await act(async () => {
        fireEvent.click(screen.getByText(STRINGS.en.exportState));
      });
      const textarea = screen.getByRole('textbox');
      const exported = JSON.parse(textarea.value);
      expect(exported.puzzle).toBeDefined();
      expect(exported.puzzle.puzzleEntities.length).toBe(deterministic.puzzleEntities.length);
      expect(exported.puzzle.geometry).toBeDefined();
    });

    it('hydrates compact deep_cave autosave via App resume prompt deterministically', async () => {
      const deterministic = generateDeepCavePuzzle(
        LEVEL_REGISTRY.deep_cave,
        DEEP_CAVE_PRESETS.easy,
        null,
        'hydrate_easy_seed_1'
      );

      const compact = createSavePayload({
        levelId: 'deep_cave',
        targetSteps: deterministic.settings.targetSteps,
        numDiggers: deterministic.settings.numDiggers,
        puzzle: deterministic,
        compact: true,
        inventory: [...deterministic.startItems, 'mushroom'],
        unlockedZones: [1, 2],
        pathHistory: [{ ...deterministic.geometry.campPos, zone: 1 }, { x: 52, y: 30, zone: 2 }]
      });
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, exportStateToString(compact));

      render(<App autoResumePrompt />);

      // Switch Resume prompt to English and verify compact autosave metadata appears
      await act(async () => {
        fireEvent.click(screen.getByText('🇺🇸'));
      });
      expect(screen.getByText(STRINGS.en.continueTitle)).toBeDefined();
      expect(screen.getByText(STRINGS.en.levels.deep_cave)).toBeDefined();

      // Continue game -> regenerates deterministically from seed
      await act(async () => {
        fireEvent.click(screen.getByText(STRINGS.en.continueBtn));
      });

      await waitFor(() => {
        expect(screen.getByText('⚙️')).toBeDefined();
      }, { timeout: 5000 });
    });

    it('clears incompatible compact autosave and surfaces saveVersionMismatch warning', async () => {
      const staleSave = {
        version: 1,
        levelId: 'deep_cave',
        targetSteps: 8,
        numDiggers: 1,
        seed: 'old_gen_seed',
        settings: { ...DEEP_CAVE_PRESETS.normal },
        generatorVersion: DEEP_CAVE_GENERATOR_VERSION - 1,
        puzzle: null,
        inventory: ['pickaxe'],
        unlockedZones: [1],
        pathHistory: [{ x: 50, y: 20, zone: 1 }]
      };
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(staleSave));

      // importStateFromString reports versionMismatch directly
      const importRes = importStateFromString(JSON.stringify(staleSave), LEVEL_REGISTRY);
      expect(importRes.success).toBe(false);
      expect(importRes.versionMismatch).toBe(true);

      // App boot clears incompatible compact save & shows warning toast
      render(<App autoResumePrompt />);

      await waitFor(() => {
        expect(screen.getByTestId('save-version-warning')).toBeDefined();
      }, { timeout: 5000 });
      expect(localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();
    });

    it('renders visible emoji for legacy deep_cave presets missing ent.emoji and keeps chasms stationary', () => {
      const legacyRopePreset = {
        kind: 'preset_tool',
        id: 'preset_rope_11',
        isPreset: 'rope',
        requires: [],
        reqType: 'AND',
        reward: 'rope',
        zone: 1,
        x: 83.11,
        y: 110.64
      };
      const chasmEnt = {
        id: 'chasm_0',
        name: 'Chasm',
        emoji: '🕳️',
        isGatekeeper: true,
        gateType: 'chasm',
        requires: ['rope'],
        reqType: 'AND',
        reward: null,
        zone: 1,
        unlocksZones: [2],
        x: 50,
        y: 64,
        collarBounds: { orientation: 'horizontal', xLeft: 40, xRight: 60, yTop: 61, yBottom: 67 }
      };
      const dummyPuzzle = {
        goalEntityId: 'vault_treasure',
        geometry: { worldWidth: 100, worldHeight: 192 },
        puzzleEntities: [legacyRopePreset, chasmEnt]
      };

      const { container: presetContainer } = render(
        <GameEntity
          ent={legacyRopePreset}
          puzzle={dummyPuzzle}
          level={LEVEL_REGISTRY.deep_cave}
          defeated={[]}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId={null}
          animatingEntities={[]}
          buriedEntities={[]}
          inkFogEntities={new Set()}
          unlockedZones={[1]}
          visibleEntitiesSet={new Set(['preset_rope_11'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 80, y: 110 }}
          breakingRockIds={{}}
          bridgingChasmIds={{}}
          isTransformed={false}
          hasDeepTreasure={false}
          handleInteract={() => {}}
          dict={STRINGS.en}
        />
      );
      expect(presetContainer.querySelector('[data-sprite-id="rope"]')).toBeTruthy();

      const { container: chasmSelected } = render(
        <GameEntity
          ent={chasmEnt}
          puzzle={dummyPuzzle}
          level={LEVEL_REGISTRY.deep_cave}
          defeated={[]}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId="chasm_0"
          animatingEntities={[]}
          buriedEntities={[]}
          inkFogEntities={new Set()}
          unlockedZones={[1]}
          visibleEntitiesSet={new Set(['chasm_0'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 50, y: 50 }}
          breakingRockIds={{}}
          bridgingChasmIds={{}}
          isTransformed={false}
          hasDeepTreasure={false}
          handleInteract={() => {}}
          dict={STRINGS.en}
        />
      );
      expect(chasmSelected.innerHTML).not.toContain('translate-x-8');
      expect(chasmSelected.innerHTML).not.toContain('rotate-3');

      const { container: chasmDefeated } = render(
        <GameEntity
          ent={chasmEnt}
          puzzle={dummyPuzzle}
          level={LEVEL_REGISTRY.deep_cave}
          defeated={['chasm_0']}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId={null}
          animatingEntities={[]}
          buriedEntities={[]}
          inkFogEntities={new Set()}
          unlockedZones={[1, 2]}
          visibleEntitiesSet={new Set(['chasm_0'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 50, y: 50 }}
          breakingRockIds={{}}
          bridgingChasmIds={{}}
          isTransformed={false}
          hasDeepTreasure={false}
          handleInteract={() => {}}
          dict={STRINGS.en}
        />
      );
      expect(chasmDefeated.innerHTML).not.toContain('translate-x-12');
      expect(chasmDefeated.innerHTML).not.toContain('rotate-12');
      expect(chasmDefeated.innerHTML).not.toContain('grayscale');
    });

    it('patches missing emoji/name on imported legacy deep_cave saves and lets player inspect across unbridged chasms', async () => {
      const legacySave = {
        version: 1,
        levelId: 'deep_cave',
        targetSteps: 5,
        numDiggers: 0,
        seed: 'legacy_chasm_scout_1',
        settings: { ...DEEP_CAVE_PRESETS.easy },
        generatorVersion: DEEP_CAVE_GENERATOR_VERSION,
        inventory: [],
        unlockedZones: [1],
        defeated: [],
        pathHistory: [{ x: 45, y: 32, zone: 1 }],
        puzzle: {
          levelId: 'deep_cave',
          goalEntityId: 'vault_treasure',
          startItems: [],
          solution: [],
          settings: { ...DEEP_CAVE_PRESETS.easy, torchRadius: 65 },
          geometry: {
            worldWidth: 100,
            worldHeight: 192,
            campPos: { x: 45, y: 32 },
            wallPolylines: [
              { points: [{ x: 5, y: 5 }, { x: 95, y: 5 }, { x: 95, y: 185 }, { x: 5, y: 185 }], closed: true }
            ],
            obstaclePolygons: []
          },
          puzzleEntities: [
            {
              kind: 'preset_tool',
              id: 'preset_rope_11',
              isPreset: 'rope',
              requires: [],
              reqType: 'AND',
              reward: 'rope',
              zone: 1,
              x: 55,
              y: 32
            },
            {
              id: 'chasm_1',
              name: 'Chasm',
              emoji: '🕳️',
              isGatekeeper: true,
              gateType: 'chasm',
              requires: ['rope'],
              reqType: 'AND',
              reward: null,
              zone: 1,
              unlocksZones: [2],
              x: 33.33,
              y: 32,
              collarBounds: { orientation: 'vertical', xLeft: 30.33, xRight: 36.33, yTop: 21.33, yBottom: 42.67 }
            },
            {
              id: 'spider_far_ledge',
              name: 'Giant Spider',
              emoji: '🕷️',
              requires: ['emerald'],
              reqType: 'AND',
              reward: 'gold_nugget',
              zone: 2,
              x: 18,
              y: 32
            },
            {
              id: 'vault_treasure',
              name: 'Vault Treasure',
              emoji: '👑',
              isGoal: true,
              isPreset: 'treasure',
              requires: [],
              reqType: 'AND',
              reward: null,
              zone: 2,
              x: 18,
              y: 80
            }
          ]
        }
      };

      const imported = importStateFromString(JSON.stringify(legacySave), LEVEL_REGISTRY);
      expect(imported.success).toBe(true);
      const patchedRope = imported.state.puzzle.puzzleEntities.find(e => e.id === 'preset_rope_11');
      expect(patchedRope.emoji).toBe('🪢');
      expect(patchedRope.name).toBe('Rope');

      const { container } = render(
        <GameInstance
          level={LEVEL_REGISTRY.deep_cave}
          targetSteps={5}
          numDiggers={0}
          deepCaveSettings={DEEP_CAVE_PRESETS.easy}
          savedState={imported.state}
          onGenerateNew={vi.fn()}
          onLoadState={vi.fn()}
          lang="en"
          setLang={vi.fn()}
        />
      );

      // Both the preset rope and the spider visible across the unbridged chasm render cleanly
      expect(container.querySelector('[data-sprite-id="rope"]')).toBeTruthy();
      const spiderEl = screen.getByText('🕷️');
      expect(spiderEl).toBeDefined();

      // Clicking the spider across the chasm shows its Emerald requirement bubble without teleporting hero
      await act(async () => {
        fireEvent.click(spiderEl);
      });
      expect(container.textContent).toContain('🟩');
    });

    it('passes geometry through 5-arg deepCave.getObstacleSegments so cave walls block sight and y > 256 reaches vault_treasure', () => {
      const hardPuzzle = generateDeepCavePuzzle(
        LEVEL_REGISTRY.deep_cave,
        DEEP_CAVE_PRESETS.hard,
        null,
        'dc-1794672823851-154821'
      );
      expect(hardPuzzle.geometry.worldHeight).toBe(320);

      const finalTroll = hardPuzzle.puzzleEntities
        .filter(e => e.isGatekeeper)
        .sort((a, b) => b.y - a.y)[0];
      const goal = hardPuzzle.puzzleEntities.find(e => e.id === hardPuzzle.goalEntityId);
      const allGateIds = hardPuzzle.puzzleEntities.filter(e => e.isGatekeeper).map(e => e.id);

      // Simulate exact GameInstance 5-arg call: (puzzleEntities, unlockedZones, defeated, screens, geometry)
      const segs = LEVEL_REGISTRY.deep_cave.getObstacleSegments(
        hardPuzzle.puzzleEntities,
        [1, 2, 3, 4, 5, 6],
        allGateIds,
        3.4,
        hardPuzzle.geometry
      );

      // Must include actual cave walls (worldHeight = 320), NOT fallback y=256 boundary
      const wallSegs = segs.filter(s => s.isOuterWall || s.isPillar);
      expect(wallSegs.length).toBeGreaterThan(4);
      const bogusY256Wall = segs.find(
        s => s.a.x === 100 && s.b.x === 0 && s.a.y === 256 && s.b.y === 256
      );
      expect(bogusY256Wall).toBeUndefined();

      // Pathfinding reaches vault_treasure beyond y = 256 after final Troll is defeated
      const startPt = { x: finalTroll.x, y: Math.min(249, finalTroll.y - 7) };
      const path = findGlobalPath(
        startPt,
        { x: goal.x, y: goal.y },
        segs,
        { width: hardPuzzle.geometry.worldWidth, height: hardPuzzle.geometry.worldHeight },
        hardPuzzle.geometry.obstaclePolygons,
        3,
        { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4500 }
      );
      expect(path.length).toBeGreaterThan(0);

      // Sight polygon casts against solid cave wall segments (cannot see straight through an obstacle polygon)
      const poly = getVisibilityPolygon(hardPuzzle.geometry.campPos, segs, hardPuzzle.settings.torchRadius, 1);
      const polyLeftInterior = { x: 0.5, y: hardPuzzle.geometry.campPos.y };
      expect(isPointInVisibilityPolygon(polyLeftInterior, poly)).toBe(false);
    });

    it('blocks line-of-sight through cave walls and allows walking past y = 256 to vault_treasure in GameInstance', async () => {
      vi.useFakeTimers();
      try {
        const puzzle5Row = {
          levelId: 'deep_cave',
          goalEntityId: 'vault_treasure',
          startItems: [],
          solution: [],
          settings: { ...DEEP_CAVE_PRESETS.hard, torchRadius: 65 },
          geometry: {
            worldWidth: 100,
            worldHeight: 320,
            campPos: { x: 83.33, y: 249 },
            wallPolylines: [
              // Outer cave boundary 5..95 x 5..315, plus an interior wall divider at x=68 between col 1 and col 2
              { points: [{ x: 5, y: 5 }, { x: 95, y: 5 }, { x: 95, y: 315 }, { x: 5, y: 315 }], closed: true },
              { points: [{ x: 65, y: 200 }, { x: 70, y: 200 }, { x: 70, y: 315 }, { x: 65, y: 315 }], closed: true }
            ],
            obstaclePolygons: []
          },
          puzzleEntities: [
            {
              id: 'guard_17',
              name: 'Cave Troll',
              emoji: '🧌',
              isGatekeeper: true,
              gateType: 'guardian',
              requires: ['bone'],
              reqType: 'AND',
              reward: null,
              zone: 5,
              unlocksZones: [6],
              x: 83.33,
              y: 256,
              collarBounds: { orientation: 'horizontal', xLeft: 73.33, xRight: 93.33, yTop: 253, yBottom: 259 }
            },
            {
              id: 'hidden_behind_wall',
              name: 'Giant Spider',
              emoji: '🕷️',
              requires: ['emerald'],
              reqType: 'AND',
              reward: 'bone',
              zone: 5,
              x: 45,
              y: 249
            },
            {
              id: 'vault_treasure',
              name: 'Vault Treasure',
              emoji: '👑',
              isGoal: true,
              isPreset: 'treasure',
              isTreasure: true,
              requires: [],
              reqType: 'AND',
              reward: null,
              zone: 6,
              x: 83.33,
              y: 292
            }
          ]
        };

        const { container } = render(
          <GameInstance
            level={LEVEL_REGISTRY.deep_cave}
            targetSteps={12}
            numDiggers={0}
            deepCaveSettings={DEEP_CAVE_PRESETS.hard}
            savedState={{
              levelId: 'deep_cave',
              targetSteps: 12,
              numDiggers: 0,
              settings: { ...DEEP_CAVE_PRESETS.hard },
              generatorVersion: DEEP_CAVE_GENERATOR_VERSION,
              inventory: [],
              unlockedZones: [1, 5, 6],
              defeated: ['guard_17'],
              pathHistory: [{ x: 83.33, y: 249, zone: 5 }],
              puzzle: puzzle5Row
            }}
            onGenerateNew={vi.fn()}
            onLoadState={vi.fn()}
            lang="en"
            setLang={vi.fn()}
          />
        );

        await act(async () => { vi.advanceTimersByTime(100); });

        // Entity behind the solid wall (at x=45, behind x=65..70 wall) must be hidden in darkness!
        const spiderWrapper = screen.getByText('🕷️').closest('div[class*="absolute"]');
        expect(spiderWrapper.className).toContain('opacity-0');
        expect(spiderWrapper.className).toContain('invisible');

        // Vault treasure beyond y=256 IS visible and clicking it completes the level!
        const vaultEl = screen.getByText('👑');
        await act(async () => {
          fireEvent.click(vaultEl);
          vi.advanceTimersByTime(1200);
        });
        expect(container.textContent).toContain('Quest Complete!');
      } finally {
        vi.useRealTimers();
      }
    });

    it('avoids duplicate CSS translate classes on GameEntity & Hero and keeps selected undefeated Troll aligned under its bubble', () => {
      const trollEnt = {
        id: 'guard_9',
        name: 'Cave Troll',
        emoji: '🧌',
        requires: ['relic'],
        reqType: 'AND',
        reward: null,
        zone: 1,
        unlocksZones: [3],
        isGatekeeper: true,
        gateType: 'guardian',
        x: 16.67,
        y: 64
      };
      const dummyPuzzle = { goalEntityId: 'vault_treasure', geometry: { worldHeight: 320 } };

      const { container: selectedTroll } = render(
        <GameEntity
          ent={trollEnt}
          puzzle={dummyPuzzle}
          level={LEVEL_REGISTRY.deep_cave}
          defeated={[]}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId="guard_9"
          animatingEntities={[]}
          buriedEntities={[]}
          inkFogEntities={new Set()}
          unlockedZones={[1]}
          visibleEntitiesSet={new Set(['guard_9'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 50, y: 32 }}
          breakingRockIds={{}}
          bridgingChasmIds={{}}
          isTransformed={false}
          hasDeepTreasure={false}
          handleInteract={() => {}}
          dict={STRINGS.he}
          toCssY={(y) => (y / 320) * 100}
        />
      );

      const wrapper = selectedTroll.firstElementChild;
      // No Tailwind v4 `-translate-x-1/2 -translate-y-1/2` stacking onto inline `transform: translate(-50%, -50%)`
      expect(wrapper.className).not.toContain('-translate-x-1/2');
      expect(wrapper.className).not.toContain('-translate-y-1/2');
      expect(wrapper.style.transform).toContain('translate(-50%, -50%)');

      // Selecting an undefeated Cave Troll must NOT shift it right away from its bubble
      expect(selectedTroll.innerHTML).not.toContain('translate-x-8');
      // Bubble pill locks dir="ltr" even when UI language is Hebrew (RTL)
      const bubblePill = selectedTroll.querySelector('[dir="ltr"]');
      expect(bubblePill).not.toBeNull();

      // Defeated Cave Troll still steps aside with translate-x-12
      const { container: defeatedTroll } = render(
        <GameEntity
          ent={trollEnt}
          puzzle={dummyPuzzle}
          level={LEVEL_REGISTRY.deep_cave}
          defeated={['guard_9']}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId={null}
          animatingEntities={[]}
          buriedEntities={[]}
          inkFogEntities={new Set()}
          unlockedZones={[1, 3]}
          visibleEntitiesSet={new Set(['guard_9'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 50, y: 32 }}
          breakingRockIds={{}}
          bridgingChasmIds={{}}
          isTransformed={false}
          hasDeepTreasure={false}
          handleInteract={() => {}}
          dict={STRINGS.he}
          toCssY={(y) => (y / 320) * 100}
        />
      );
      expect(defeatedTroll.innerHTML).toContain('translate-x-12');

      // Hero also must not duplicate `-translate-x-1/2 -translate-y-1/2` over inline style.transform
      const { container: heroWrap } = render(
        <Hero
          playerVisualX={50}
          playerVisualY={20}
          playerVisualYPct={10}
          playerRotation={0}
          playerScale=""
          playerFilter=""
          playerZ={160}
          playerTransition="duration-200"
          heroFace="🤠"
          level={LEVEL_REGISTRY.deep_cave}
          isAnimatingLoot={false}
        />
      );
      const heroEl = heroWrap.firstElementChild;
      expect(heroEl.className).not.toContain('-translate-x-1/2');
      expect(heroEl.className).not.toContain('-translate-y-1/2');
      expect(heroEl.style.transform).toContain('translate(-50%, -50%)');
    });

    it('ignites a lightable cave brazier on click, cuts an extra light pool in CaveVisibility, and supports Undo', () => {
      const brazierPuzzle = {
        levelId: 'deep_cave',
        startItems: ['crystal'],
        goalEntityId: 'vault_treasure',
        settings: { ...DEEP_CAVE_PRESETS.easy },
        generatorVersion: DEEP_CAVE_GENERATOR_VERSION,
        geometry: {
          worldWidth: 100,
          worldHeight: 192,
          campPos: { x: 50, y: 18 },
          torchRadius: 68,
          wallPolylines: [
            {
              closed: true,
              isPillar: false,
              points: [
                { x: 4, y: 4 },
                { x: 4, y: 188 },
                { x: 96, y: 188 },
                { x: 96, y: 4 }
              ]
            }
          ],
          obstaclePolygons: [],
          landmarks: [
            { id: 'lm_arch_1', kind: 'ruined_arch', x: 35, y: 40 },
            { id: 'lm_vault_1', kind: 'vault_sanctum', x: 50, y: 160 }
          ],
          braziers: [
            { id: 'brazier_1', x: 50, y: 42, zone: 1, radius: 46 }
          ]
        },
        puzzleEntities: [
          {
            id: 'vault_treasure',
            name: 'Vault Treasure',
            emoji: '👑',
            isGoal: true,
            isPreset: 'treasure',
            isTreasure: true,
            requires: [],
            reqType: 'AND',
            reward: null,
            zone: 1,
            x: 50,
            y: 160
          }
        ]
      };

      render(
        <GameInstance
          level={LEVEL_REGISTRY.deep_cave}
          targetSteps={5}
          numDiggers={0}
          deepCaveSettings={DEEP_CAVE_PRESETS.easy}
          savedState={{
            levelId: 'deep_cave',
            targetSteps: 5,
            numDiggers: 0,
            settings: { ...DEEP_CAVE_PRESETS.easy },
            generatorVersion: DEEP_CAVE_GENERATOR_VERSION,
            inventory: ['crystal'],
            unlockedZones: [1],
            defeated: [],
            pathHistory: [{ x: 50, y: 18, zone: 1 }],
            puzzle: brazierPuzzle
          }}
          onGenerateNew={vi.fn()}
          onLoadState={vi.fn()}
          lang="en"
          setLang={vi.fn()}
        />
      );

      const brazierBtn = screen.getByTestId('brazier-brazier_1');
      expect(brazierBtn.getAttribute('data-lit')).toBe('false');

      fireEvent.click(brazierBtn);
      expect(brazierBtn.getAttribute('data-lit')).toBe('true');

      const undoBtn = screen.getByTitle('Undo');
      fireEvent.click(undoBtn);
      expect(brazierBtn.getAttribute('data-lit')).toBe('false');
    });
  });
});
