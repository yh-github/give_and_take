// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../index.jsx';
import LEVEL_REGISTRY from '../src/levels/index.js';
import STRINGS from '../src/strings.js';
import { generateLevelPuzzle } from '../src/logic/generator.js';

describe('Gameplay Integration & Mechanics Tests', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('generates solvable puzzles for all registered levels across step counts', () => {
    const levelIds = Object.keys(LEVEL_REGISTRY);
    expect(levelIds).toContain('river_crossing');
    expect(levelIds).toContain('underground');
    expect(levelIds).toContain('underwater');

    for (const id of levelIds) {
      const level = LEVEL_REGISTRY[id];
      // Test generating puzzles with 3, 5 steps
      for (const steps of [3, 5]) {
        const puzzle = generateLevelPuzzle(level, steps, 1);
        expect(puzzle).toBeDefined();
        expect(puzzle.puzzleEntities.length).toBeGreaterThan(0);
        expect(puzzle.goalEntityId).toBeDefined();
        if (id !== 'underwater') {
          expect(puzzle.solution).toBeDefined();
          expect(puzzle.solution.length).toBeGreaterThan(0);
        }
      }
    }
  });

  describe('Component interactions with timer simulation', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it('switches between levels and mounts appropriate level scenery & background', async () => {
      render(<App />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Open menu
      const gearBtn = screen.getByText('⚙️');
      await act(async () => {
        fireEvent.click(gearBtn);
      });

      // Go to settings using exact string
      const genMapBtn = screen.getByText(STRINGS.he.generateMap);
      await act(async () => {
        fireEvent.click(genMapBtn);
      });

      // Select River Crossing
      const select = screen.getByRole('combobox');
      await act(async () => {
        fireEvent.change(select, { target: { value: 'river_crossing' } });
      });

      const submitGen = screen.getByText(STRINGS.he.genMap);
      await act(async () => {
        fireEvent.click(submitGen);
        vi.advanceTimersByTime(500);
      });

      // River crossing should not have the lighting settings eye icon
      expect(screen.queryByTitle('Lighting Settings')).toBeNull();
    });

    it('handles item selection in inventory dock', async () => {
      render(<App />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Find any rendered inventory slot item button that has an emoji
      const slotButtons = document.querySelectorAll('button[class*="rounded-[2.5cqw]"]');
      const activeSlot = Array.from(slotButtons).find(btn => btn.textContent.trim() !== '');

      if (activeSlot) {
        // Clicking slot toggles selection state
        await act(async () => {
          fireEvent.click(activeSlot);
        });
        expect(activeSlot.className).toContain('bg-amber-400');

        // Clicking again deselects
        await act(async () => {
          fireEvent.click(activeSlot);
        });
        expect(activeSlot.className).not.toContain('bg-amber-400');
      }
    });
  });
});
