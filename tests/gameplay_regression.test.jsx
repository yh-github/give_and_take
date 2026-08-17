// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../index.jsx';
import STRINGS from '../src/strings.js';

describe('Gameplay Actions & State Regression Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders camp icon and inventory dock for underground level', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Camp element should exist (⛺ for underground)
    const camp = screen.getByText('⛺');
    expect(camp).toBeDefined();

    // 4 inventory slots should exist
    const slots = document.querySelectorAll('button[class*="rounded-[2.5cqw]"]');
    expect(slots.length).toBe(4);
  });

  it('allows dropping a selected item at the camp and picking it back up', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const slots = document.querySelectorAll('button[class*="rounded-[2.5cqw]"]');
    const filledSlot = Array.from(slots).find(s => s.textContent.trim() !== '');

    if (filledSlot) {
      const itemEmoji = [...filledSlot.textContent.trim()][0];

      // 1. Select the item
      await act(async () => {
        fireEvent.click(filledSlot);
      });
      expect(filledSlot.className).toContain('bg-amber-400');

      // 2. Click the camp to drop the selected item
      const camp = screen.getByText('⛺');
      const campButton = camp.parentElement.parentElement;
      await act(async () => {
        fireEvent.click(campButton);
      });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // The dropped item should now be rendered near the camp
      const droppedItems = screen.getAllByText(itemEmoji);
      expect(droppedItems.length).toBeGreaterThan(0);

      // 3. Click the dropped camp item to pick it back up
      const campDroppedItem = droppedItems[0];
      await act(async () => {
        fireEvent.click(campDroppedItem.closest('div'));
      });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Item should be back in inventory slot
      const slotsAfter = document.querySelectorAll('button[class*="rounded-[2.5cqw]"]');
      const hasItem = Array.from(slotsAfter).some(s => s.textContent.includes(itemEmoji));
      expect(hasItem).toBe(true);
    }
  });

  it('restores previous game state when clicking Undo button', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText('↩️').closest('button').disabled).toBe(true);

    const slots = document.querySelectorAll('button[class*="rounded-[2.5cqw]"]');
    const filledSlot = Array.from(slots).find(s => s.textContent.trim() !== '');

    if (filledSlot) {
      // Select item
      await act(async () => {
        fireEvent.click(filledSlot);
      });

      // Click camp button
      const camp = screen.getByText('⛺');
      const campButton = camp.parentElement.parentElement;
      await act(async () => {
        fireEvent.click(campButton);
      });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Undo button should now be enabled
      const undoBtnActive = screen.getByText('↩️').closest('button');
      expect(undoBtnActive.disabled).toBe(false);

      // Click Undo
      await act(async () => {
        fireEvent.click(undoBtnActive);
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Undo button should now be disabled again
      expect(screen.getByText('↩️').closest('button').disabled).toBe(true);
    }
  });

  it('triggers replay and restarts game state cleanly from menu', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Open menu
    const gearBtn = screen.getByText('⚙️');
    await act(async () => {
      fireEvent.click(gearBtn);
    });

    // Click Restart
    const restartBtn = screen.getByText(STRINGS.he.restart);
    await act(async () => {
      fireEvent.click(restartBtn);
      vi.advanceTimersByTime(200);
    });

    // Menu should close
    expect(screen.queryByText(STRINGS.he.settings)).toBeNull();
  });
});
