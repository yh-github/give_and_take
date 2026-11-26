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
import { SeaWitchSVG } from '../src/levels/sea_shared/components.tsx';
import { generateUnderwaterPuzzle } from '../src/levels/underwater/generator.ts';
import {
  HUMAN_TRINKET_IDS,
  canDirectGrabFish,
  createSpookedFishState,
  evaluateFishingCatch,
  findInterceptedFish,
  getAquaticHeroFace,
  getHeldLanternfishLightCount,
  getSchoolFishPosition,
  getSurfaceSwimDurationMs,
  getUnderwaterAirCost,
  getUnderwaterInspectRadius,
  getUnderwaterMoveDurationMs,
  isEntityMurkyFar,
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
  SURFACE_SWIM_HEAVY_CAP_MS,
  SURFACE_SWIM_MAX_MS,
  SURFACE_SWIM_MIN_MS,
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

      // Blowfish has tighter window than regular fish, and Merman form widens the catch window
      expect(evaluateFishingCatch(0.68, 'fish').caught).toBe(true);
      expect(evaluateFishingCatch(0.68, 'blowfish').caught).toBe(false);
      expect(evaluateFishingCatch(0.68, 'blowfish', true).caught).toBe(true);
    });

    it('expands murky visibility with 1-3 held Lanternfish and wild passing Lanternfish, and treats Sea Witch & Captain Chest as murky when distant', () => {
      const underwaterLevel = LEVEL_REGISTRY.underwater;
      const shipwreckLevel = LEVEL_REGISTRY.shipwreck;
      const heroPos = { x: 50, y: 20 };

      expect(getHeldLanternfishLightCount([])).toBe(0);
      expect(getHeldLanternfishLightCount(['blowfish'])).toBe(1);
      expect(getHeldLanternfishLightCount(['blowfish', 'blowfish', 'blowfish', 'blowfish'])).toBe(3);
      expect(getUnderwaterInspectRadius([])).toBe(22);
      expect(getUnderwaterInspectRadius(['blowfish', 'blowfish'])).toBe(46);
      expect(getUnderwaterInspectRadius(['blowfish', 'blowfish', 'blowfish', 'blowfish'])).toBe(58);

      // Sea Witch & Captain's Chest are murky when distant and unlit
      expect(isEntityMurkyFar(underwaterLevel, { id: 'sea_witch' }, { x: 50, y: 63 }, heroPos)).toBe(true);
      expect(isEntityMurkyFar(shipwreckLevel, { id: 'captains_chest' }, { x: 81, y: 23 }, { x: 11, y: 69 })).toBe(true);

      // Carrying 2 Lanternfish illuminates the Sea Witch at distance 43 (<= 46)
      expect(
        isEntityMurkyFar(underwaterLevel, { id: 'sea_witch' }, { x: 50, y: 63 }, heroPos, {
          inventory: ['blowfish', 'blowfish']
        })
      ).toBe(false);

      // A wild passing Lanternfish illuminates a nearby seabed entity even when the hero is far away
      expect(
        isEntityMurkyFar(underwaterLevel, { id: 'octopus_1' }, { x: 68, y: 82 }, heroPos, {
          inventory: [],
          wildLightSources: [{ x: 60, y: 80 }]
        })
      ).toBe(false);
    });

    it('makes catching fish easier when transformed into a Merman', () => {
      const deepFish = {
        id: 99,
        type: 'blowfish',
        y: 80,
        isRight: true,
        speed: 10,
        spawnTime: 1000,
        startX: 10,
        endX: 110,
        isSpooked: false,
        spookCount: 0
      };
      const posAt6s = getSchoolFishPosition(deepFish, 6000);
      expect(posAt6s.y).toBeGreaterThan(75); // Deep Lanternfish stays in deep waters

      const heroAtMediumDist = { x: posAt6s.x - 11, y: posAt6s.y };
      expect(canDirectGrabFish(deepFish, heroAtMediumDist, 6000, false)).toBe(false);
      expect(canDirectGrabFish(deepFish, heroAtMediumDist, 6000, true)).toBe(true);

      const interceptClick = { x: posAt6s.x + 9.0, y: posAt6s.y };
      expect(findInterceptedFish([deepFish], interceptClick, 6000, false)).toBeNull();
      expect(findInterceptedFish([deepFish], interceptClick, 6000, true)?.id).toBe(99);

      const trailingClick = { x: posAt6s.x - 15, y: posAt6s.y };
      expect(shouldSpookFishFromPoint(deepFish, trailingClick, 6000, false)).toBe(true);
      expect(shouldSpookFishFromPoint(deepFish, trailingClick, 6000, true)).toBe(false);
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

    it('renders SunkenVaultSVG locked without permanent requirement pills and reveals Crown when defeated', () => {
      const { rerender } = render(
        <SunkenVaultSVG reqEmojis={['⚪', '⭐']} isDefeated={false} isMurkyFar={true} />
      );
      expect(screen.getByTestId('sunken-vault')).toBeDefined();
      expect(screen.getByText('🔒')).toBeDefined();
      expect(screen.queryByText('⚪')).toBeNull();
      expect(screen.queryByText('⭐')).toBeNull();

      rerender(
        <SunkenVaultSVG reqEmojis={['⚪', '⭐']} isDefeated={true} isMurkyFar={false} />
      );
      expect(screen.getByText('👑')).toBeDefined();
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

    it('renders SeaWitchSVG floating in water with glow and sparkles (no cauldron or arch) and cast fx', () => {
      const { rerender } = render(
        <SeaWitchSVG isTransformed={false} isCastingMagic={false} />
      );
      const witchRoot = screen.getByTestId('sea-witch-grotto');
      expect(witchRoot).toBeDefined();
      expect(screen.getByTestId('sea-witch-sparkles')).toBeDefined();
      const auraSvg = witchRoot.querySelector('svg[aria-hidden="true"]');
      expect(auraSvg).not.toBeNull();
      expect(auraSvg.querySelector('path')).toBeNull();
      expect(auraSvg.querySelector('ellipse')).toBeNull();
      expect(screen.queryByTestId('witch-cast-fx')).toBeNull();

      rerender(<SeaWitchSVG isTransformed={false} isCastingMagic={true} />);
      expect(screen.getByTestId('witch-cast-fx')).toBeDefined();
    });

    it('shows face exhaling emoji while refilling air after drowning and scales surface swim duration smoothly', () => {
      expect(
        getAquaticHeroFace({
          isDrowning: true,
          isRefillingAir: true,
          isTransformed: false,
          isInventoryFullAlert: false,
          isSubmerged: false
        })
      ).toBe('😵');

      expect(
        getAquaticHeroFace({
          isDrowning: false,
          isRefillingAir: true,
          isTransformed: false,
          isInventoryFullAlert: false,
          isSubmerged: false
        })
      ).toBe('😮‍💨');

      expect(
        getAquaticHeroFace({
          isDrowning: false,
          isRefillingAir: false,
          isTransformed: false,
          isInventoryFullAlert: false,
          isSubmerged: false
        })
      ).toBe('🤠');

      const underwater = LEVEL_REGISTRY.underwater;
      const shallowMs = getSurfaceSwimDurationMs(underwater, { x: 50, y: 24 }, { x: 50, y: 14 }, [], false);
      const deepMs = getSurfaceSwimDurationMs(underwater, { x: 50, y: 63 }, { x: 50, y: 14 }, [], false);
      const heavyDeepMs = getSurfaceSwimDurationMs(
        underwater,
        { x: 50, y: 63 },
        { x: 50, y: 14 },
        ['fish', 'comb', 'pearl', 'shell'],
        false,
        true
      );

      expect(shallowMs).toBeGreaterThanOrEqual(SURFACE_SWIM_MIN_MS);
      expect(deepMs).toBeGreaterThan(shallowMs);
      expect(deepMs).toBeLessThanOrEqual(SURFACE_SWIM_MAX_MS);
      expect(heavyDeepMs).toBeLessThanOrEqual(SURFACE_SWIM_HEAVY_CAP_MS);
      expect(heavyDeepMs).toBeGreaterThanOrEqual(deepMs);
    });
  });

});
