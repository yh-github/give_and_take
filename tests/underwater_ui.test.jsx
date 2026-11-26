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
  getHeldLanternfishLightCount,
  getSchoolFishPosition,
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
  UNDERWATER_FULL_BAG_SPEED_MULTIPLIER
} from '../src/constants.ts';

describe('Underwater GameInstance UI Integration', () => {
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

    it('charges normal 1 air on the seabed without abyssal pressure and drops items safely above the abyss on 0 air', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const puzzle = generateUnderwaterPuzzle(underwater, 5, 0, 'abyss-drown-seed');
      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 0,
        puzzle,
        inventory: ['comb', 'pearl'],
        air: 3,
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

      // Click directly onto the seabed (y = 85 > 72) with 3 air -> normal 1 air cost leaves 2/10 and no abyssal badge
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 200, clientY: 850 });
      });
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      expect(screen.queryByTestId('out-of-air-modal')).toBeNull();
      expect(screen.getByTestId('air-count-badge').textContent).toBe('2/10');
      expect(screen.queryByTestId('abyss-air-badge')).toBeNull();

      // Second & third moves on the seabed naturally deplete remaining air (2 -> 1 -> 0)
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 220, clientY: 880 });
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByTestId('air-count-badge').textContent).toBe('1/10');

      await act(async () => {
        fireEvent.click(innerMap, { clientX: 200, clientY: 910 });
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByTestId('drowning-vignette')).toBeDefined();

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

      // Flushing kelp costs 0 air and spawns a special Lanternfish (id: 'blowfish')
      expect(airPill.querySelectorAll('.opacity-25').length).toBe(0);
      const pufferSprites = document.querySelectorAll('[data-sprite-id="blowfish"]');
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

      // Direct click on distant flushed deep fish at (11, 52) from hero at (50, 14) -> spooks it & costs air!
      const swimmingPuffers = screen.getAllByTestId('school-fish-blowfish');
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
      const timingPuffer = screen.getAllByTestId('school-fish-blowfish')[0];
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
