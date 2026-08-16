// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../index.jsx';
import STRINGS from '../src/strings.js';

describe('GUI Component & Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders App without crashing and shows initial generating/loaded state', async () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Advance past puzzle generation timer (150ms)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Language buttons should be visible
    expect(screen.getByText('🇮🇱')).toBeDefined();
    expect(screen.getByText('🇺🇸')).toBeDefined();
    // Gear settings button should be visible
    expect(screen.getByText('⚙️')).toBeDefined();
  });

  it('toggles language between Hebrew and English and updates dictionary', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const enBtn = screen.getByText('🇺🇸');
    const heBtn = screen.getByText('🇮🇱');

    // Switch to English
    await act(async () => {
      fireEvent.click(enBtn);
    });

    // Open menu
    const gearBtn = screen.getByText('⚙️');
    await act(async () => {
      fireEvent.click(gearBtn);
    });

    expect(screen.getByText(STRINGS.en.menu)).toBeDefined();
    expect(screen.getByText(STRINGS.en.restart)).toBeDefined();

    // Switch to Hebrew
    await act(async () => {
      fireEvent.click(heBtn);
    });

    expect(screen.getByText(STRINGS.he.menu)).toBeDefined();
    expect(screen.getByText(STRINGS.he.restart)).toBeDefined();
  });

  it('opens settings and allows changing level configurations', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Open menu
    const gearBtn = screen.getByText('⚙️');
    await act(async () => {
      fireEvent.click(gearBtn);
    });

    // Click "Generate Map" / Settings
    const genMapMenuBtn = screen.getByText(STRINGS.he.generateMap);
    await act(async () => {
      fireEvent.click(genMapMenuBtn);
    });

    // Settings screen should be open
    expect(screen.getByText(STRINGS.he.settings)).toBeDefined();
    expect(screen.getByText(STRINGS.he.minQuestChain)).toBeDefined();
    expect(screen.getByText(STRINGS.he.diggersMemory)).toBeDefined();

    // Back button returns to main menu
    const backBtn = screen.getByText(STRINGS.he.back);
    await act(async () => {
      fireEvent.click(backBtn);
    });
    expect(screen.getByText(STRINGS.he.menu)).toBeDefined();
  });

  it('renders lighting modal for underground level', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Underground level has the eye button 👁️
    const eyeBtn = screen.getByTitle('Lighting Settings');
    expect(eyeBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(eyeBtn);
    });

    // Lighting menu view should be visible
    expect(screen.getByText(STRINGS.he.lighting)).toBeDefined();
    expect(screen.getByText(STRINGS.he.specialVision)).toBeDefined();
    expect(screen.getByText(STRINGS.he.radius)).toBeDefined();
    expect(screen.getByText(STRINGS.he.blur)).toBeDefined();
  });

  it('renders inventory slots and undo button properly', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Undo button
    const undoBtn = screen.getByText('↩️');
    expect(undoBtn).toBeDefined();
    // Initially undo is disabled since history stack is empty
    expect(undoBtn.closest('button').disabled).toBe(true);

    // 4 inventory slot buttons exist
    const slotButtons = document.querySelectorAll('button[class*="rounded-[2.5cqw]"]');
    expect(slotButtons.length).toBe(4);
  });
});
