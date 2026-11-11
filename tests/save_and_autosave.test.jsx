// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../index.jsx';
import LEVEL_REGISTRY from '../src/levels/index.js';
import STRINGS from '../src/strings.js';
import { generateLevelPuzzle } from '../src/logic/generator.js';
import {
  createSavePayload,
  validateSaveState,
  saveToAutoSave,
  getAutoSave,
  clearAutoSave,
  exportStateToString,
  importStateFromString,
  AUTOSAVE_STORAGE_KEY
} from '../src/logic/saveState.js';

describe('Save & Auto-Save System', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('saveState logic unit tests', () => {
    it('creates a valid save payload and validates it successfully', () => {
      const level = LEVEL_REGISTRY.underground;
      const puzzle = generateLevelPuzzle(level, 5, 0);
      expect(puzzle).toBeDefined();

      const payload = createSavePayload({
        levelId: 'underground',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['pickaxe', 'mushroom'],
        unlockedZones: [1, 2],
        defeated: ['preset_pick_42_16'],
        pathHistory: [{ x: 50, y: 14, zone: 1 }]
      });

      expect(payload.version).toBe(1);
      expect(payload.levelId).toBe('underground');
      expect(payload.inventory).toEqual(['pickaxe', 'mushroom']);
      expect(payload.unlockedZones).toEqual([1, 2]);

      const validation = validateSaveState(payload, LEVEL_REGISTRY);
      expect(validation.valid).toBe(true);
    });

    it('rejects invalid or corrupted save payloads', () => {
      expect(validateSaveState(null).valid).toBe(false);
      expect(validateSaveState({}).valid).toBe(false);
      expect(validateSaveState({ levelId: 'invalid_realm', puzzle: {} }, LEVEL_REGISTRY).valid).toBe(false);
      expect(validateSaveState({ levelId: 'underground', puzzle: { puzzleEntities: [] } }).valid).toBe(false);
    });

    it('saves to and reads from localStorage via autosave functions', () => {
      const level = LEVEL_REGISTRY.underground;
      const puzzle = generateLevelPuzzle(level, 5, 0);
      const payload = createSavePayload({
        levelId: 'underground',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['gem'],
        pathHistory: [{ x: 50, y: 2, zone: 1 }]
      });

      const savedOk = saveToAutoSave(payload);
      expect(savedOk).toBe(true);

      const loaded = getAutoSave(LEVEL_REGISTRY);
      expect(loaded).toBeDefined();
      expect(loaded.inventory).toEqual(['gem']);

      clearAutoSave();
      expect(getAutoSave(LEVEL_REGISTRY)).toBeNull();
    });

    it('exports to and imports from JSON string correctly', () => {
      const level = LEVEL_REGISTRY.underground;
      const puzzle = generateLevelPuzzle(level, 5, 0);
      const payload = createSavePayload({
        levelId: 'underground',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['rope', 'relic'],
        pathHistory: [{ x: 50, y: 2, zone: 1 }]
      });

      const exportedStr = exportStateToString(payload);
      expect(typeof exportedStr).toBe('string');
      expect(exportedStr).toContain('"levelId": "underground"');

      const importRes = importStateFromString(exportedStr, LEVEL_REGISTRY);
      expect(importRes.success).toBe(true);
      expect(importRes.state.inventory).toEqual(['rope', 'relic']);

      const badImport = importStateFromString('invalid json {{{', LEVEL_REGISTRY);
      expect(badImport.success).toBe(false);
      expect(badImport.error).toBeDefined();
    });
  });

  describe('GameMenu Export & Import UI tests', () => {
    it('allows opening export view, copying state, and returning to menu', async () => {
      render(<App autoResumePrompt={false} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Open settings menu
      const gearBtn = screen.getByText('⚙️');
      await act(async () => {
        fireEvent.click(gearBtn);
      });

      // Click Export Game State
      const exportBtn = screen.getByText(STRINGS.he.exportState);
      await act(async () => {
        fireEvent.click(exportBtn);
      });

      // Export view should show textarea with valid JSON
      const textarea = document.querySelector('textarea');
      expect(textarea).toBeDefined();
      expect(textarea.value).toContain('"levelId": "underground"');

      // Click copy button
      const copyBtn = screen.getByText(STRINGS.he.copyToClipboard);
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      // Back button returns to main menu
      const backBtn = screen.getByText(STRINGS.he.back);
      await act(async () => {
        fireEvent.click(backBtn);
      });

      expect(screen.getByText(STRINGS.he.exportState)).toBeDefined();
    });

    it('handles import state with valid and invalid JSON', async () => {
      render(<App autoResumePrompt={false} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      const gearBtn = screen.getByText('⚙️');
      await act(async () => {
        fireEvent.click(gearBtn);
      });

      const importBtn = screen.getByText(STRINGS.he.importState);
      await act(async () => {
        fireEvent.click(importBtn);
      });

      const textarea = document.querySelector('textarea');
      const loadBtn = screen.getByText(STRINGS.he.loadState);

      // Attempt loading invalid JSON
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'not valid json' } });
        fireEvent.click(loadBtn);
      });

      expect(screen.getByText(/⚠️/)).toBeDefined();

      // Now create valid JSON and import
      const level = LEVEL_REGISTRY.underground;
      const puzzle = generateLevelPuzzle(level, 5, 0);
      const validPayload = createSavePayload({
        levelId: 'underground',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['bone', 'pickaxe'],
        pathHistory: [{ x: 50, y: 10, zone: 1 }]
      });

      await act(async () => {
        fireEvent.change(textarea, { target: { value: JSON.stringify(validPayload) } });
        fireEvent.click(loadBtn);
        vi.advanceTimersByTime(500);
      });

      // Menu closes upon successful import
      expect(screen.queryByText(STRINGS.he.importTitle)).toBeNull();
    });
  });

  describe('Auto-save & Resume Prompt tests', () => {
    it('prompts the user to continue when an auto-save exists upon re-entering the game', async () => {
      const level = LEVEL_REGISTRY.underground;
      const puzzle = generateLevelPuzzle(level, 5, 0);
      const payload = createSavePayload({
        levelId: 'underground',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['crystal', 'emerald'],
        unlockedZones: [1, 2],
        defeated: ['rock_left_1'],
        pathHistory: [{ x: 36, y: 22, zone: 1 }]
      });

      saveToAutoSave(payload);

      render(<App autoResumePrompt={true} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Resume prompt should appear
      expect(screen.getByText(STRINGS.he.continueTitle)).toBeDefined();
      expect(screen.getByText(STRINGS.he.continueBtn)).toBeDefined();
      expect(screen.getByText(STRINGS.he.newGameBtn)).toBeDefined();

      // Click Continue Game
      const continueBtn = screen.getByText(STRINGS.he.continueBtn);
      await act(async () => {
        fireEvent.click(continueBtn);
        vi.advanceTimersByTime(500);
      });

      // Modal is dismissed and game resumes
      expect(screen.queryByText(STRINGS.he.continueTitle)).toBeNull();
    });

    it('clears autosave and starts new game when user declines resume prompt', async () => {
      const level = LEVEL_REGISTRY.underground;
      const puzzle = generateLevelPuzzle(level, 5, 0);
      const payload = createSavePayload({
        levelId: 'underground',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['relic'],
        pathHistory: [{ x: 50, y: 2, zone: 1 }]
      });

      saveToAutoSave(payload);

      render(<App autoResumePrompt={true} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByText(STRINGS.he.continueTitle)).toBeDefined();

      // Click Start New Game
      const newGameBtn = screen.getByText(STRINGS.he.newGameBtn);
      await act(async () => {
        fireEvent.click(newGameBtn);
        vi.advanceTimersByTime(500);
      });

      expect(screen.queryByText(STRINGS.he.continueTitle)).toBeNull();
      expect(localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();
    });
  });
});
