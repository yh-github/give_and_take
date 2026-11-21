// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import LEVEL_REGISTRY from '../src/levels/index.ts';
import STRINGS from '../src/strings.ts';
import GameInstance from '../src/components/GameInstance.tsx';
import OutOfAirModal from '../src/components/OutOfAirModal.tsx';
import AirIndicator from '../src/components/AirIndicator.tsx';
import { generateUnderwaterPuzzle } from '../src/levels/underwater/generator.ts';
import {
  getUnderwaterAirCost,
  getUnderwaterMoveDurationMs,
  resolveOutOfAirDrop,
  verifyUnderwaterAirSolvability
} from '../src/logic/underwater.ts';
import { createSavePayload } from '../src/logic/saveState.ts';
import {
  ACTION_ANIM_MS,
  AIR_REFILL_INTERVAL_MS,
  DROWNING_ALERT_DELAY_MS,
  DROWNING_RETURN_DELAY_MS,
  MAX_AIR,
  UNDERWATER_FULL_BAG_SPEED_MULTIPLIER
} from '../src/constants.ts';

describe('Underwater Level Mechanics & Solvability Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Generator & Worst-Case Air Solvability', () => {
    it('starts with 0 items, includes 3 boat trade items, and remains air-solvable on full bag across seeds & difficulties', () => {
      const underwater = LEVEL_REGISTRY.underwater;

      for (const targetSteps of [3, 5, 8]) {
        for (let s = 1; s <= 5; s++) {
          const puzzle = generateUnderwaterPuzzle(underwater, targetSteps, 1, `uw-mech-${targetSteps}-${s}`);
          expect(puzzle).not.toBeNull();
          expect(puzzle.startItems).toEqual([]);
          expect(Array.isArray(puzzle.boatOfferedItems)).toBe(true);
          expect(puzzle.boatOfferedItems.length).toBe(3);
          expect(puzzle.solution.some(step => step.isBoatTrade)).toBe(true);

          const airCheck = verifyUnderwaterAirSolvability(underwater, puzzle);
          expect(airCheck.maxMovesBetweenRefills).toBe(4);
          expect(airCheck.unreachableEntities).toEqual([]);
          expect(airCheck.solvable).toBe(true);
        }
      }
    });
  });

  describe('Pure Underwater Helpers (src/logic/underwater.ts)', () => {
    it('charges 2 air only when carrying 4 unique items and scales movement duration', () => {
      expect(getUnderwaterAirCost([])).toBe(1);
      expect(getUnderwaterAirCost(['fish', 'pearl', 'comb'])).toBe(1);
      expect(getUnderwaterAirCost(['pearl', 'pearl', 'pearl', 'pearl'])).toBe(1);
      expect(getUnderwaterAirCost(['pearl', 'shell', 'comb', 'mirror'])).toBe(2);

      expect(getUnderwaterMoveDurationMs(500, false)).toBe(500);
      expect(getUnderwaterMoveDurationMs(500, true)).toBe(
        Math.round(500 * UNDERWATER_FULL_BAG_SPEED_MULTIPLIER)
      );
    });

    it('keeps 0-1 items unchanged and drops extra non-fish floating while removing dropped fish', () => {
      expect(resolveOutOfAirDrop([], null, { x: 50, y: 40 }, 100)).toEqual({
        nextInventory: [],
        droppedFloatingItems: [],
        discardedFishCount: 0
      });

      expect(resolveOutOfAirDrop(['pearl'], null, { x: 50, y: 40 }, 100)).toEqual({
        nextInventory: ['pearl'],
        droppedFloatingItems: [],
        discardedFishCount: 0
      });

      const multi = resolveOutOfAirDrop(
        ['comb', 'fish', 'gold_fish', 'pearl'],
        'comb',
        { x: 5, y: 80 },
        1000
      );
      expect(multi.nextInventory).toEqual(['comb']);
      expect(multi.discardedFishCount).toBe(2);
      expect(multi.droppedFloatingItems).toEqual([
        { uid: 1001, id: 'pearl', x: 14, y: 68, isFloating: true }
      ]);

      const dupes = resolveOutOfAirDrop(['pearl', 'pearl', 'fish'], 'pearl', { x: 50, y: 45 }, 2000);
      expect(dupes.nextInventory).toEqual(['pearl']);
      expect(dupes.discardedFishCount).toBe(1);
      expect(dupes.droppedFloatingItems.map(i => i.id)).toEqual(['pearl']);
    });
  });

  describe('OutOfAirModal & AirIndicator Components', () => {
    it('requires selecting 1 item when holding multiple items and shows fish/float status', () => {
      const onConfirmKeep = vi.fn();
      render(
        <OutOfAirModal
          items={['comb', 'fish', 'pearl']}
          level={LEVEL_REGISTRY.underwater}
          dict={STRINGS.en}
          lang="en"
          onConfirmKeep={onConfirmKeep}
        />
      );

      const confirmBtn = screen.getByTestId('out-of-air-confirm');
      expect(confirmBtn.disabled).toBe(true);

      fireEvent.click(screen.getByTestId('out-of-air-item-comb'));
      expect(confirmBtn.disabled).toBe(false);
      expect(screen.getByText(`✓ ${STRINGS.en.outOfAirKeepBadge}`)).toBeDefined();
      expect(screen.getByText(`💨 ${STRINGS.en.outOfAirFishGone}`)).toBeDefined();
      expect(screen.getByText(`🫧 ${STRINGS.en.outOfAirDropFloat}`)).toBeDefined();

      fireEvent.click(confirmBtn);
      expect(onConfirmKeep).toHaveBeenCalledWith('comb');
    });

    it('allows immediate confirmation in OutOfAirModal when holding 0 or 1 item (with RTL support)', () => {
      const onConfirmSingle = vi.fn();
      const { rerender } = render(
        <OutOfAirModal
          items={['pearl']}
          level={LEVEL_REGISTRY.underwater}
          dict={STRINGS.he}
          lang="he"
          onConfirmKeep={onConfirmSingle}
        />
      );
      expect(screen.getByTestId('out-of-air-modal').getAttribute('dir')).toBe('rtl');
      const confirmBtn = screen.getByTestId('out-of-air-confirm');
      expect(confirmBtn.disabled).toBe(false);
      fireEvent.click(confirmBtn);
      expect(onConfirmSingle).toHaveBeenCalledWith('pearl');

      const onConfirmEmpty = vi.fn();
      rerender(
        <OutOfAirModal
          items={[]}
          level={LEVEL_REGISTRY.underwater}
          dict={STRINGS.en}
          lang="en"
          onConfirmKeep={onConfirmEmpty}
        />
      );
      expect(screen.getByText(STRINGS.en.outOfAirEmpty)).toBeDefined();
      fireEvent.click(screen.getByTestId('out-of-air-confirm'));
      expect(onConfirmEmpty).toHaveBeenCalledWith(null);
    });

    it('renders heavy backpack badge on AirIndicator only when heavy and not transformed', () => {
      const { rerender } = render(
        <AirIndicator
          air={6}
          level={LEVEL_REGISTRY.underwater}
          isTransformed={false}
          isHeavy={true}
          onSwimToSurface={() => {}}
        />
      );
      expect(screen.getByTestId('heavy-air-badge')).toBeDefined();

      rerender(
        <AirIndicator
          air={6}
          level={LEVEL_REGISTRY.underwater}
          isTransformed={false}
          isHeavy={false}
          onSwimToSurface={() => {}}
        />
      );
      expect(screen.queryByTestId('heavy-air-badge')).toBeNull();
    });
  });

  describe('GameInstance Underwater Integration', () => {
    it('charges 2 air per move and slows Hero movement duration when backpack is full (4/4)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'heavy-swim-seed');
      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['pearl', 'shell', 'comb', 'mirror'],
        air: MAX_AIR,
        pathHistory: [{ x: 50, y: 26, zone: 1 }]
      });

      render(
        <GameInstance
          level={underwater}
          targetSteps={5}
          numDiggers={0}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          lang="en"
          setLang={() => {}}
        />
      );

      expect(screen.getByTestId('heavy-air-badge')).toBeDefined();
      expect(screen.getByTestId('hero-heavy-badge')).toBeDefined();

      const heroFace = screen.getByText('🤿');
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

      // Swim down from y=26 to y=46 (base dist=20 -> 700ms * 2.1 = 1470ms)
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 200, clientY: 460 });
      });

      const appliedDurationMs = parseInt(heroContainer.style.transitionDuration || '0', 10);
      expect(appliedDurationMs).toBeGreaterThanOrEqual(1400);

      await act(async () => {
        vi.advanceTimersByTime(1600);
      });

      // MAX_AIR (8) - 2 = 6 active bubbles -> 2 dimmed bubbles
      const airPill = screen.getByTitle('Swim back to boat');
      const dimmedBubbles = airPill.querySelectorAll('.opacity-25');
      expect(dimmedBubbles.length).toBe(2);
    });

    it('opens Out-of-Air modal on 0 air, drops non-fish as floating items, deletes fish, and lets hero recover floating items', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'out-of-air-seed');
      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['comb', 'fish', 'pearl'],
        air: 1,
        pathHistory: [{ x: 50, y: 36, zone: 1 }]
      });

      render(
        <GameInstance
          level={underwater}
          targetSteps={5}
          numDiggers={0}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          lang="en"
          setLang={() => {}}
        />
      );

      const heroContainer = screen.getByText('🤿').closest('[class*="transform"]');
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

      // Swim to (40, 48): dist ~15.6 -> 547ms walk, then DROWNING_ALERT_DELAY_MS (500ms)
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 160, clientY: 480 });
      });

      await act(async () => {
        vi.advanceTimersByTime(650);
      });

      await act(async () => {
        vi.advanceTimersByTime(DROWNING_ALERT_DELAY_MS + 100);
      });

      // Modal appears with all 3 items
      expect(screen.getByTestId('out-of-air-modal')).toBeDefined();
      expect(screen.getByTestId('out-of-air-item-comb')).toBeDefined();
      expect(screen.getByTestId('out-of-air-item-fish')).toBeDefined();
      expect(screen.getByTestId('out-of-air-item-pearl')).toBeDefined();

      // Choose to keep 'comb' and confirm ascent
      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-item-comb'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-confirm'));
      });

      expect(screen.queryByTestId('out-of-air-modal')).toBeNull();

      // Finish ascent (triggers setIsRefillingAir(true)), then complete air refill
      await act(async () => {
        vi.advanceTimersByTime(DROWNING_RETURN_DELAY_MS + 50);
      });
      await act(async () => {
        vi.advanceTimersByTime(MAX_AIR * AIR_REFILL_INTERVAL_MS + 200);
      });

      expect(screen.getByText('1/4')).toBeDefined();
      const airPillBeforePickup = screen.getByTitle('Swim back to boat');
      expect(airPillBeforePickup.querySelectorAll('.opacity-25').length).toBe(0);

      // Non-fish pearl floats in the water; dropped fish is deleted (not floating)
      const floatingPearl = screen.getByTestId('floating-item-pearl');
      expect(floatingPearl).toBeDefined();
      expect(screen.queryByTestId('floating-item-fish')).toBeNull();

      // Click floating pearl to swim down and retrieve it (should spend 1 air instead of refilling)
      await act(async () => {
        fireEvent.click(floatingPearl);
      });
      await act(async () => {
        vi.advanceTimersByTime(ACTION_ANIM_MS + 200);
      });

      expect(screen.queryByTestId('floating-item-pearl')).toBeNull();
      expect(screen.getByText('2/4')).toBeDefined();
      const airPill = screen.getByTitle('Swim back to boat');
      expect(airPill.querySelectorAll('.opacity-25').length).toBe(1);
    });

    it('keeps bubble vents visible and reusable after refilling air', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'vent-reuse-seed');
      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: [],
        air: 2,
        pathHistory: [{ x: 30, y: 40, zone: 1 }]
      });

      render(
        <GameInstance
          level={underwater}
          targetSteps={5}
          numDiggers={0}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          lang="en"
          setLang={() => {}}
        />
      );

      const airPill = screen.getByTitle('Swim back to boat');
      expect(airPill.querySelectorAll('.opacity-25').length).toBe(6);

      const vents = screen.getAllByText('+🫧');
      expect(vents.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        fireEvent.click(vents[0]);
      });
      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      // Refilled to MAX_AIR and vent remains visible
      expect(airPill.querySelectorAll('.opacity-25').length).toBe(0);
      expect(screen.getAllByText('+🫧').length).toBe(vents.length);
    });
  });
});
