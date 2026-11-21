// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import LEVEL_REGISTRY from '../src/levels/index.ts';
import STRINGS from '../src/strings.ts';
import GameInstance from '../src/components/GameInstance.tsx';
import OutOfAirModal from '../src/components/OutOfAirModal.tsx';
import AirIndicator from '../src/components/AirIndicator.tsx';
import FishingCatchOverlay from '../src/components/FishingCatchOverlay.tsx';
import { SunkenVaultSVG } from '../src/levels/underwater/components.tsx';
import { generateUnderwaterPuzzle } from '../src/levels/underwater/generator.ts';
import {
  HUMAN_TRINKET_IDS,
  evaluateFishingCatch,
  getUnderwaterAirCost,
  getUnderwaterMoveDurationMs,
  isFishItem,
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

describe('Underwater Level Mechanics, Overhaul & Solvability Suite', () => {
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

  describe('Procedural Generator, Strict Provenance & Air Solvability', () => {
    it('enforces 0 vents, strict item provenance, 3 circling mermaids, Sunken Vault & Witch Return Tribute across difficulties', () => {
      const underwater = LEVEL_REGISTRY.underwater;

      for (const targetSteps of [3, 5, 8]) {
        for (let s = 1; s <= 5; s++) {
          const puzzle = generateUnderwaterPuzzle(underwater, targetSteps, 1, `uw-overhaul-${targetSteps}-${s}`);
          expect(puzzle).not.toBeNull();
          expect(puzzle.startItems).toEqual([]);
          expect(puzzle.goalEntityId).toBe('sunken_vault');
          expect(puzzle.boatTradeMap).toBeDefined();
          expect(Array.isArray(puzzle.boatOfferedItems)).toBe(true);
          expect(puzzle.boatOfferedItems.length).toBeGreaterThanOrEqual(3);

          // Strict provenance: no vents, no fish rewards, no human trinket rewards from creatures
          const vents = puzzle.puzzleEntities.filter(e => e.isVent || e.isPreset === 'bubble_vent');
          expect(vents.length).toBe(0);

          puzzle.puzzleEntities.forEach(ent => {
            if (ent.reward) {
              expect(isFishItem(ent.reward)).toBe(false);
              expect(HUMAN_TRINKET_IDS.includes(ent.reward)).toBe(false);
            }
          });

          // Circling mermaids require only human trinkets and reward mermaid_voice
          const mermaids = puzzle.puzzleEntities.filter(e => e.id.startsWith('mermaid_'));
          expect(mermaids.length).toBe(3);
          mermaids.forEach(m => {
            expect(m.reward).toBe('mermaid_voice');
            expect(m.orbit).toBeDefined();
            m.requires.forEach(req => expect(HUMAN_TRINKET_IDS.includes(req)).toBe(true));
          });

          // Sea Witch requires 3x mermaid_voice + deep Return Tribute
          const witch = puzzle.puzzleEntities.find(e => e.id === 'sea_witch');
          expect(witch).toBeDefined();
          expect(witch.requires).toEqual(['mermaid_voice', 'mermaid_voice', 'mermaid_voice']);
          expect(Array.isArray(witch.returnRequires)).toBe(true);
          expect(witch.returnRequires.length).toBe(1);
          expect(isFishItem(witch.returnRequires[0])).toBe(false);
          expect(HUMAN_TRINKET_IDS.includes(witch.returnRequires[0])).toBe(false);

          // Sunken Vault requires 2 seals (easy/normal) or 3 seals (hard)
          const vault = puzzle.puzzleEntities.find(e => e.id === 'sunken_vault');
          expect(vault).toBeDefined();
          expect(vault.requires.length).toBe(targetSteps >= 7 ? 3 : 2);
          vault.requires.forEach(req => {
            expect(isFishItem(req)).toBe(false);
            expect(HUMAN_TRINKET_IDS.includes(req)).toBe(false);
          });

          // Solver path covers boats, mermaids, witch transform, sunken vault, witch return
          expect(puzzle.solution.some(step => step.isBoatTrade)).toBe(true);
          expect(puzzle.solution.some(step => step.entityId === 'sunken_vault')).toBe(true);
          expect(puzzle.solution.some(step => step.entityId === 'sea_witch' && step.isReturnTrip)).toBe(true);

          const airCheck = verifyUnderwaterAirSolvability(underwater, puzzle);
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
      expect(getUnderwaterAirCost(['mermaid_voice', 'mermaid_voice', 'mermaid_voice'])).toBe(1);
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
        ['comb', 'fish', 'blowfish', 'pearl'],
        'comb',
        { x: 5, y: 80 },
        1000
      );
      expect(multi.nextInventory).toEqual(['comb']);
      expect(multi.discardedFishCount).toBe(2);
      expect(multi.droppedFloatingItems).toEqual([
        { uid: 1001, id: 'pearl', x: 14, y: 68, isFloating: true }
      ]);
    });

    it('evaluates timing-ring fishing catch windows accurately across tiers', () => {
      expect(evaluateFishingCatch(0.5, 'fish')).toEqual({ caught: true, quality: 'perfect' });
      expect(evaluateFishingCatch(0.65, 'fish')).toEqual({ caught: true, quality: 'good' });
      expect(evaluateFishingCatch(0.95, 'fish')).toEqual({ caught: false, quality: 'miss' });

      // Blowfish has tighter window than regular fish
      expect(evaluateFishingCatch(0.68, 'fish').caught).toBe(true);
      expect(evaluateFishingCatch(0.68, 'blowfish').caught).toBe(false);
    });
  });

  describe('OutOfAirModal, AirIndicator, FishingCatchOverlay & SunkenVaultSVG', () => {
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

    it('renders SunkenVaultSVG with seal sockets shrouded when murky and visible when close', () => {
      const { rerender } = render(
        <SunkenVaultSVG reqEmojis={['⚪', '⭐']} isDefeated={false} isMurkyFar={true} />
      );
      expect(screen.getByTestId('sunken-vault')).toBeDefined();
      expect(screen.getAllByText('❓').length).toBe(2);

      rerender(
        <SunkenVaultSVG reqEmojis={['⚪', '⭐']} isDefeated={false} isMurkyFar={false} />
      );
      expect(screen.getByText('⚪')).toBeDefined();
      expect(screen.getByText('⭐')).toBeDefined();
    });

    it('resolves FishingCatchOverlay as caught when tapped inside golden target timing window', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const onResolve = vi.fn();
      render(
        <FishingCatchOverlay
          fishType="fish"
          fishEmoji="🐟"
          fishName="Fish"
          dict={STRINGS.en}
          lang="en"
          onResolve={onResolve}
        />
      );

      // FISHING_CATCH_CONFIG.fish.durationMs = 1800 -> center is 900ms
      await act(async () => {
        vi.advanceTimersByTime(900);
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('fishing-catch-button'));
      });

      expect(screen.getByText(`✓ ${STRINGS.en.fishingCaught}`)).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(onResolve).toHaveBeenCalledWith(true);
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

      await act(async () => {
        fireEvent.click(innerMap, { clientX: 200, clientY: 460 });
      });

      const appliedDurationMs = parseInt(heroContainer.style.transitionDuration || '0', 10);
      expect(appliedDurationMs).toBeGreaterThanOrEqual(1400);

      await act(async () => {
        vi.advanceTimersByTime(1600);
      });

      const airPill = screen.getByTitle('Swim back to boat');
      expect(airPill.querySelectorAll('.opacity-25').length).toBe(2);
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

      await act(async () => {
        fireEvent.click(innerMap, { clientX: 160, clientY: 480 });
      });

      await act(async () => {
        vi.advanceTimersByTime(650);
      });

      await act(async () => {
        vi.advanceTimersByTime(DROWNING_ALERT_DELAY_MS + 100);
      });

      expect(screen.getByTestId('out-of-air-modal')).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-item-comb'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-confirm'));
      });

      expect(screen.queryByTestId('out-of-air-modal')).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(DROWNING_RETURN_DELAY_MS + 50);
      });
      await act(async () => {
        vi.advanceTimersByTime(MAX_AIR * AIR_REFILL_INTERVAL_MS + 200);
      });

      expect(screen.getByText('1/4')).toBeDefined();
      const floatingPearl = screen.getByTestId('floating-item-pearl');
      expect(floatingPearl).toBeDefined();
      expect(screen.queryByTestId('floating-item-fish')).toBeNull();

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

    it('drowns naturally when diving past the Abyssal Trench rim untransformed and drops items safely above the abyss', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'abyss-drown-seed');
      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['comb', 'pearl'],
        air: MAX_AIR,
        isTransformed: false,
        pathHistory: [{ x: 50, y: 60, zone: 2 }]
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

      // Click directly into the Abyssal Trench (y = 85 > 72) without transformation
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 200, clientY: 850 });
      });

      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      expect(screen.getByTestId('abyss-drowning-banner')).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(DROWNING_ALERT_DELAY_MS + 100);
      });

      expect(screen.getByTestId('out-of-air-modal')).toBeDefined();

      // Keep 'comb'; 'pearl' should float at y=66 (above the abyss!) after ascent
      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-item-comb'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-confirm'));
      });
      await act(async () => {
        vi.advanceTimersByTime(DROWNING_RETURN_DELAY_MS + 50);
      });

      const floatingPearl = screen.getByTestId('floating-item-pearl');
      const wrapperTop = parseFloat(floatingPearl.parentElement.style.top || '0');
      expect(wrapperTop).toBeLessThanOrEqual(70);
    });

    it('flushes a fish at 0 air cost when clicking an Interactive Reef Kelp Habitat and catches it via timing ring', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'kelp-flush-seed');
      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: [],
        air: MAX_AIR,
        pathHistory: [{ x: 50, y: 14, zone: 1 }]
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

      const kelpBed = screen.getByTestId('kelp-habitat-kelp_deep');
      const airPill = screen.getByTitle('Swim back to boat');

      await act(async () => {
        fireEvent.click(kelpBed);
      });

      // Flushing kelp costs 0 air and spawns a blowfish '🐡'
      expect(airPill.querySelectorAll('.opacity-25').length).toBe(0);
      const pufferSprites = screen.getAllByText('🐡');
      expect(pufferSprites.length).toBeGreaterThanOrEqual(2); // kelp badge + spawned fish

      const heroContainer = screen.getByText('🤠').closest('[class*="transform"]');
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

      // Click the spawned swimming pufferfish (inside schoolsOfFish wrapper at zIndex 45)
      const swimmingPuffer = pufferSprites.find(el => !el.closest('[data-testid^="kelp-habitat"]'));
      expect(swimmingPuffer).toBeDefined();

      await act(async () => {
        fireEvent.click(swimmingPuffer, { clientX: 80, clientY: 530 });
      });

      // Swim duration 650ms -> FishingCatchOverlay opens
      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      expect(screen.getByTestId('fishing-catch-overlay')).toBeDefined();

      // Pufferfish durationMs = 1250 -> center at 625ms
      await act(async () => {
        vi.advanceTimersByTime(625);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('fishing-catch-button'));
      });
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.queryByTestId('fishing-catch-overlay')).toBeNull();
      expect(screen.getByText('1/4')).toBeDefined();
    });
  });
});
