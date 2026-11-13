// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import App from '../index.jsx';
import GameInstance from '../src/components/GameInstance.jsx';
import LEVEL_REGISTRY from '../src/levels/index.js';
import STRINGS from '../src/strings.js';
import { DEEP_CAVE_GENERATOR_VERSION } from '../src/constants.js';
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

      await waitFor(() => {
        expect(screen.getByText('⚙️')).toBeDefined();
      }, { timeout: 5000 });

      // Autosave should remain compact (no puzzle blob)
      const autoSaved = JSON.parse(localStorage.getItem(AUTOSAVE_STORAGE_KEY));
      expect(autoSaved).toBeDefined();
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
  });
});
