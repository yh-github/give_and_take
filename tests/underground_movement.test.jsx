// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../index.jsx';
import { findGlobalPath } from '../src/logic/pathfinding.js';
import { getObstacleSegments } from '../src/logic/visibility.js';
import { CAVE_WALL_VERTICES } from '../src/levels/underground/components.jsx';

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

    if (targetEntity) {
      const initialTop = heroContainer.style.top;

      await act(async () => {
        fireEvent.click(targetEntity);
      });

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Hero should move towards the entity
      expect(heroContainer.style.top).not.toBe(initialTop);
    }
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
  });
});
