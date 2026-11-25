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
import {
  BoatSVG,
  BoatWakeEffect,
  RaftCampSVG,
  SunkenVaultSVG
} from '../src/levels/underwater/components.tsx';
import { generateUnderwaterPuzzle } from '../src/levels/underwater/generator.ts';
import {
  HUMAN_TRINKET_IDS,
  canDirectGrabFish,
  createSpookedFishState,
  evaluateFishingCatch,
  findInterceptedFish,
  getSchoolFishPosition,
  getUnderwaterAirCost,
  getUnderwaterMoveDurationMs,
  isFishItem,
  resolveOutOfAirDrop,
  shouldSpookFishFromPoint,
  verifyUnderwaterAirSolvability
} from '../src/logic/underwater.ts';
import { createSavePayload } from '../src/logic/saveState.ts';
import {
  ACTION_ANIM_MS,
  AIR_REFILL_INTERVAL_MS,
  BOAT_SPAWN_INTERVAL_MS,
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
        for (let s = 1; s <= 2; s++) {
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

    it('tracks live school fish coordinates, spooks distant fish with vertical dodges, and intercepts led ambush clicks', () => {
      const baseFish = {
        id: 42,
        type: 'blowfish',
        y: 50,
        isRight: true,
        speed: 10,
        spawnTime: 1000,
        startX: 10,
        endX: 110,
        isSpooked: false,
        spookCount: 0
      };

      const basePos = getSchoolFishPosition(baseFish, 6000);
      expect(basePos.x).toBe(60);
      expect(basePos.y).toBeCloseTo(55, 5);

      const spooked = createSpookedFishState(baseFish, 6000);
      expect(spooked.isSpooked).toBe(true);
      expect(spooked.spookCount).toBe(1);
      expect(spooked.startX).toBe(60);
      expect(spooked.speed).toBeLessThan(4);
      expect(spooked.dodgeFromY).toBeCloseTo(55, 2);
      expect(spooked.y).not.toBe(50);

      // Lead ahead of baseFish at t = 6000 (fish is at x = 60, y = 55) -> matches within arrival window
      expect(findInterceptedFish([baseFish], { x: 62, y: 50 }, 6000)?.id).toBe(42);
      expect(findInterceptedFish([baseFish], { x: 88, y: 50 }, 6000)).toBeNull();

      // Chasing from behind (x = 50 while fish is at x = 60 going right) spooks; leading ahead (x = 68) does not
      expect(shouldSpookFishFromPoint(baseFish, { x: 50, y: 50 }, 6000)).toBe(true);
      expect(shouldSpookFishFromPoint(baseFish, { x: 68, y: 50 }, 6000)).toBe(false);
      // Already-spooked fish is not re-spooked endlessly on plain movement
      expect(shouldSpookFishFromPoint(spooked, { x: 55, y: spooked.y }, 6100)).toBe(false);

      // Goldfish dart pattern pauses during the first 50% of each cycle (constant x)
      const dartFish = {
        id: 43,
        type: 'gold_fish',
        y: 40,
        isRight: true,
        speed: 9.6, // 4 cycles of 2400ms
        spawnTime: 0,
        startX: 0,
        endX: 100,
        isSpooked: false,
        spookCount: 0
      };
      expect(getSchoolFishPosition(dartFish, 240).x).toBe(0);
      expect(getSchoolFishPosition(dartFish, 960).x).toBe(0);
      expect(getSchoolFishPosition(dartFish, 2400).x).toBeCloseTo(25, 5);

      // Close-range direct grab gating
      expect(canDirectGrabFish(baseFish, { x: 55, y: 52 }, 6000)).toBe(true);
      expect(canDirectGrabFish(baseFish, { x: 20, y: 52 }, 6000)).toBe(false);
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

    it('drains abyssal pressure air naturally on the seabed without instakilling, and drops items safely above the abyss on 0 air', async () => {
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

      // Click directly into the Abyssal Trench (y = 85 > 72) with 10 air -> arrives ALIVE with 6/10 air (4 abyssal air cost)
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 200, clientY: 850 });
      });
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      expect(screen.queryByTestId('out-of-air-modal')).toBeNull();
      expect(screen.getByTestId('air-count-badge').textContent).toBe('6/10');
      expect(screen.getByTestId('abyss-air-badge').textContent).toContain('-4');

      // Second & third moves inside the abyss naturally deplete remaining air (6 -> 2 -> 0)
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 220, clientY: 880 });
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByTestId('air-count-badge').textContent).toBe('2/10');

      await act(async () => {
        fireEvent.click(innerMap, { clientX: 200, clientY: 910 });
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
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

      // Slow dramatic float ascent stays upside-down & camera-locked mid-ascent with vignette + banner
      expect(screen.getByTestId('drowned-hero').style.transform).toContain('rotate(180deg)');
      expect(screen.getByTestId('drowning-vignette')).toBeDefined();
      expect(screen.getByTestId('drowning-ascent-banner')).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(1500); // Halfway through 3000ms DROWNING_RETURN_DELAY_MS
      });
      // Still ascending mid-water (y > 20), camera has NOT snapped to top (0%) yet
      expect(screen.getByTestId('drowning-ascent-banner')).toBeDefined();
      const midHeroTop = parseFloat(screen.getByTestId('drowned-hero').style.top || '0');
      expect(midHeroTop).toBeGreaterThan(22);

      await act(async () => {
        vi.advanceTimersByTime(DROWNING_RETURN_DELAY_MS);
      });

      const floatingPearl = screen.getByTestId('floating-item-pearl');
      const wrapperTop = parseFloat(floatingPearl.parentElement.style.top || '0');
      expect(wrapperTop).toBeLessThanOrEqual(70);
    });

    it('renders tent raft camp, waterless boat SVGs with separate BoatWakeEffect on far/near isometric lanes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { container } = render(
        <div>
          <RaftCampSVG />
          <div className="hull-only">
            <BoatSVG />
          </div>
          <BoatWakeEffect isRight={true} lane="near" />
        </div>
      );
      expect(screen.getByTestId('player-raft-camp')).toBeDefined();
      expect(screen.getByTestId('boat-wake-effect')).toBeDefined();
      // BoatSVG has no baked-in water squiggle path
      const hullPaths = container.querySelectorAll('.hull-only svg path');
      hullPaths.forEach(p => {
        expect(p.getAttribute('d')).not.toContain('T 64 78');
      });

      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'isometric-boats-seed');
      render(
        <GameInstance
          level={underwater}
          targetSteps={5}
          numDiggers={0}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={createSavePayload({
            levelId: 'underwater',
            targetSteps: 5,
            numDiggers: 0,
            puzzle,
            pathHistory: [{ x: 50, y: 14, zone: 1 }]
          })}
          lang="en"
          setLang={() => {}}
        />
      );

      expect(screen.getByTestId('isometric-sea-surface')).toBeDefined();

      // Advance past initial boat spawns (400ms -> far/near alternating every BOAT_SPAWN_INTERVAL_MS)
      await act(async () => {
        vi.advanceTimersByTime(500 + BOAT_SPAWN_INTERVAL_MS);
      });
      expect(screen.getByTestId('roaming-boat-near')).toBeDefined();
      expect(screen.getByTestId('roaming-boat-far')).toBeDefined();
    });

    it('spooks distant fish on direct click in chase mode, catches on lead interception, and preserves timing_ring option', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
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
      expect(pufferSprites.length).toBeGreaterThanOrEqual(2);

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

      // Direct click on distant flushed blowfish at (11, 52) from hero at (50, 14) -> spooks it & costs air!
      const swimmingPuffers = pufferSprites.filter(el => !el.closest('[data-testid^="kelp-habitat"]'));
      const flushedPuffer = swimmingPuffers[swimmingPuffers.length - 1];
      expect(flushedPuffer).toBeDefined();

      await act(async () => {
        fireEvent.click(flushedPuffer, { clientX: 44, clientY: 520 });
      });

      const spookedWrapper = screen.getAllByTestId('school-fish-blowfish').find(el => el.dataset.spooked === 'true');
      expect(spookedWrapper).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      // Missed distant grab still costs 1 air
      expect(airPill.querySelectorAll('.opacity-25').length).toBe(1);
      expect(screen.queryByTestId('fishing-catch-overlay')).toBeNull();
      expect(screen.queryByText('1/4')).toBeNull();

      // Now swim ahead of a newly flushed kelp fish, wait for it to approach, and grab it up close
      const shallowKelp = screen.getByTestId('kelp-habitat-kelp_shallow');
      await act(async () => {
        fireEvent.click(shallowKelp); // spawns '🐟' at (11, 26), speed 12 -> ~8.67 u/s going right
      });
      // Swim hero via plain map click safely ahead to (36%, 26%) -> plain move does NOT catch
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 144, clientY: 260 });
      });
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      expect(screen.queryByText('1/4')).toBeNull();

      // Wait another 1600ms (2500ms after flush) -> fish reaches x ≈ 32.7, within directGrabDist (12) of hero at 36
      await act(async () => {
        vi.advanceTimersByTime(1600);
      });
      const shallowFishSprite = screen
        .getAllByTestId('school-fish-fish')
        .find(el => parseFloat(el.style.top) < 28);
      expect(shallowFishSprite).toBeDefined();

      await act(async () => {
        fireEvent.click(shallowFishSprite, { clientX: 132, clientY: 260 });
      });
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.getByText('1/4')).toBeDefined();

      // Verify optional fishingMode="timing_ring" still works cleanly when configured
      cleanup();
      render(
        <GameInstance
          level={underwater}
          targetSteps={5}
          numDiggers={0}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          fishingMode="timing_ring"
          lang="en"
          setLang={() => {}}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('kelp-habitat-kelp_deep'));
      });
      const timingPuffer = screen.getAllByText('🐡').find(el => !el.closest('[data-testid^="kelp-habitat"]'));
      await act(async () => {
        fireEvent.click(timingPuffer, { clientX: 80, clientY: 530 });
      });
      await act(async () => {
        vi.advanceTimersByTime(700);
      });
      expect(screen.getByTestId('fishing-catch-overlay')).toBeDefined();
    });

    it('does not catch a fish by accident when plain-moving directly onto its live path', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'no-accidental-catch-seed');
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

      // Flush shallow kelp fish at (11, 26) moving right at ~8.67 u/s
      await act(async () => {
        fireEvent.click(screen.getByTestId('kelp-habitat-kelp_shallow'));
      });

      // Plain-move directly onto (18%, 26%) where the fish arrives at ~800ms
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 72, clientY: 260 });
      });
      await act(async () => {
        vi.advanceTimersByTime(900);
      });

      // Hero never catches a fish via plain movement, and landing right on top of it spooks it
      expect(screen.queryByText('1/4')).toBeNull();
      const shallowFishSprite = screen
        .getAllByTestId('school-fish-fish')
        .find(el => parseFloat(el.style.top) < 28);
      expect(shallowFishSprite).toBeDefined();
      expect(shallowFishSprite.dataset.spooked).toBe('true');
    });

    it('requires feeding the Dolphin a fish per ride with no item returned in exchange', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'dolphin-fish-feed-seed');
      const dolphinEnt = puzzle.puzzleEntities.find(e => e.id === 'dolphin_1');
      expect(dolphinEnt.requires).toEqual(['fish', 'gold_fish', 'blowfish']);
      expect(dolphinEnt.reward).toBeNull();
      expect(dolphinEnt.isRepeatable).toBe(true);

      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['fish'],
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

      const dolphinSprite = screen.getByTestId('dolphin-sprite');
      expect(dolphinSprite.textContent).not.toContain('💦');

      // Clicking dolphin without selecting fish does NOT start a ride
      await act(async () => {
        fireEvent.click(dolphinSprite);
      });
      expect(screen.getByText('1/4')).toBeDefined();

      // Select fish and click dolphin -> consumes fish, rides down, returns 0 items
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /🐟/ }));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('dolphin-sprite'));
      });

      expect(screen.queryByText('1/4')).toBeNull();
      expect(screen.getByText('0/4')).toBeDefined();

      // Complete dolphin dive (1500ms) -> hero arrives at y=58, still 0 items
      await act(async () => {
        vi.advanceTimersByTime(1700);
      });
      expect(screen.getByText('0/4')).toBeDefined();

      // Clicking dolphin at y=58 without another fish will NOT give a free ride up
      await act(async () => {
        fireEvent.click(screen.getByTestId('dolphin-sprite'));
      });
      await act(async () => {
        vi.advanceTimersByTime(1600);
      });
      const heroYAfterNoFishTap = parseFloat(screen.getByText('🤿').closest('[class*="transform"]').style.top || '0');
      expect(heroYAfterNoFishTap).toBeGreaterThan(45);
    });

    it('renders foreground water overlay, triggers surface splash, refills air to 10 on mermaid trade, and exposes unified Sea presets/knobs', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 1, 'mermaid-air-refill-seed');
      const mermaid = puzzle.puzzleEntities.find(e => e.id === 'mermaid_1');
      const reqItemId = mermaid.requires[0];
      const reqEmoji = underwater.items.find(i => i.id === reqItemId).emoji;

      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 1,
        puzzle,
        inventory: [reqItemId],
        air: 2,
        pathHistory: [{ x: 50, y: 14, zone: 1 }]
      });

      render(
        <GameInstance
          level={underwater}
          targetSteps={5}
          numDiggers={1}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          lang="en"
          setLang={() => {}}
        />
      );

      expect(screen.getByTestId('underwater-water-overlay')).toBeDefined();
      expect(screen.getByTestId('air-count-badge').textContent).toBe('2/10');

      // Trade with mermaid_1 (crosses surface waterline -> splash, and refills air to 10/10!)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(reqEmoji) }));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('entity-mermaid_1'));
      });
      expect(screen.getByTestId('water-splash-burst')).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(ACTION_ANIM_MS + 200);
      });
      expect(screen.getByTestId('air-count-badge').textContent).toBe('10/10');

      // Open Settings -> verify 4 Sea presets, Custom badge, and Advanced Settings knobs
      await act(async () => {
        fireEvent.click(screen.getByText('⚙️'));
      });
      await act(async () => {
        fireEvent.click(screen.getByText(STRINGS.en.generateMap));
      });
      expect(screen.getByTestId('sea-preset-easy')).toBeDefined();
      expect(screen.getByTestId('sea-preset-normal')).toBeDefined();
      expect(screen.getByTestId('sea-preset-hard')).toBeDefined();
      expect(screen.getByTestId('sea-preset-expert')).toBeDefined();
      expect(screen.getByTestId('sea-custom-badge')).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-sea-advanced-settings'));
      });
      expect(screen.getByTestId('sea-knob-targetSteps')).toBeDefined();
      expect(screen.getByTestId('sea-knob-numDiggers')).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByTestId('sea-preset-hard'));
      });
      expect(screen.queryByTestId('sea-custom-badge')).toBeNull();
    });
  });
});
