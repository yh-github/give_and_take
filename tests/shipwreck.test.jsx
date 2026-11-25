// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import LEVEL_REGISTRY from '../src/levels/index.ts';
import GameInstance from '../src/components/GameInstance.tsx';
import GameEntity from '../src/components/GameEntity.tsx';
import { GiantClamSVG } from '../src/levels/underwater/components.tsx';
import { generateUnderwaterPuzzle } from '../src/levels/underwater/generator.ts';
import { generateShipwreckPuzzle } from '../src/levels/shipwreck/generator.ts';
import {
  AIR_POCKET_Y,
  SHIPWRECK_SCREENS_X,
  SHIPWRECK_SCREENS_Y,
  SHIPWRECK_WALL_POLYLINES,
  getShipwreckObstacleSegments,
  isInShipwreckAirPocket
} from '../src/levels/shipwreck/geometry.ts';
import { findGlobalPath } from '../src/logic/pathfinding.ts';
import { isValidEntityTrade, validateEntitySpacing } from '../src/logic/rules.ts';
import { createSavePayload } from '../src/logic/saveState.ts';
import STRINGS from '../src/strings.ts';
import {
  ACTION_ANIM_MS,
  AIR_REFILL_INTERVAL_MS,
  DIGGER_BURY_ANIM_MS,
  DIGGER_BURY_DELAY_MS,
  DROWNING_ALERT_DELAY_MS,
  DROWNING_RETURN_DELAY_MS
} from '../src/constants.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('Giant Clams Click-to-Close & Ship Wreck Level', () => {
  describe('Giant Clams Click-to-Close Behavior', () => {
    it('renders GiantClamSVG open with reward when not buried, shut when buried, and open when defeated', () => {
      const { rerender } = render(
        <GiantClamSVG isDefeated={false} isBuried={false} rewardEmoji="⚪" />
      );
      expect(screen.getByText('⚪')).toBeDefined();

      rerender(<GiantClamSVG isDefeated={false} isBuried={true} rewardEmoji={null} />);
      expect(screen.queryByText('⚪')).toBeNull();

      rerender(<GiantClamSVG isDefeated={true} isBuried={true} rewardEmoji={null} />);
      expect(screen.queryByText('⚪')).toBeNull();
    });

    it('keeps Giant Clams open over time (no timer), closes any clam on inspect-click, and reopens on Undo & trade', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const underwater = LEVEL_REGISTRY.underwater;
      const basePuzzle = generateUnderwaterPuzzle(underwater, 5, 2, 'clam-click-close-seed');

      // Ensure predictable test clams (clam_0 and clam_1) with distinct rewards
      let clamSeen = 0;
      const patchedEntities = basePuzzle.puzzleEntities.map((ent) => {
        if (ent.id.startsWith('clam') || ent.id.startsWith('giant_clam')) {
          clamSeen += 1;
          if (clamSeen === 1) {
            return { ...ent, id: 'clam_0', requires: ['sea_kelp'], reqType: 'OR', reward: 'pearl', x: 36, y: 90, zone: 3 };
          }
          if (clamSeen === 2) {
            return { ...ent, id: 'giant_clam_1', requires: ['starfish'], reqType: 'OR', reward: 'trident', x: 22, y: 93, zone: 3 };
          }
          return { ...ent, reward: 'shell', x: 78, y: 93, zone: 3 };
        }
        return ent;
      });
      const testPuzzle = { ...basePuzzle, puzzleEntities: patchedEntities };

      const savedState = createSavePayload({
        levelId: 'underwater',
        targetSteps: 5,
        numDiggers: 2,
        puzzle: testPuzzle,
        inventory: ['sea_kelp'],
        isTransformed: true,
        pathHistory: [
          { x: 50, y: 63, zone: 2 },
          { x: 38, y: 88, zone: 3 }
        ]
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

      const findClamReward = (emoji) =>
        screen.queryAllByText(emoji).find(el => el.closest('svg')?.getAttribute('viewBox') === '0 0 110 105') || null;

      // Advance timers well past old DIGGER_BURY_DELAY_MS + DIGGER_BURY_ANIM_MS: clams must stay OPEN!
      await act(async () => {
        vi.advanceTimersByTime(DIGGER_BURY_DELAY_MS + DIGGER_BURY_ANIM_MS + 1000);
      });
      expect(findClamReward('⚪')).not.toBeNull();
      expect(findClamReward('🔱')).not.toBeNull();

      // Click close clam (clam_0) to inspect what it wants -> snaps shut immediately!
      const pearlSprite = findClamReward('⚪');
      await act(async () => {
        fireEvent.click(pearlSprite.closest('svg'));
      });
      expect(findClamReward('⚪')).toBeNull();
      // Tooltip shows want item (Glowing Kelp) and hidden reward (?)
      const clamTooltip = screen.getAllByText('❓').find(el => el.closest('.bg-white')).closest('.bg-white');
      expect(clamTooltip).toBeDefined();

      // Click second non-memory clam (giant_clam_1) -> ALSO snaps shut immediately!
      const tridentSprite = findClamReward('🔱');
      await act(async () => {
        fireEvent.click(tridentSprite.closest('svg'));
      });
      expect(findClamReward('🔱')).toBeNull();

      // Click Undo -> second clam reopens cleanly
      await act(async () => {
        fireEvent.click(screen.getByTitle('Undo'));
      });
      expect(findClamReward('🔱')).not.toBeNull();

      // Trade sea_kelp with closed clam_0 -> consumes kelp, awards pearl
      await act(async () => {
        const kelpBtn = screen.getAllByText('🌿').map(el => el.closest('button')).find(Boolean);
        fireEvent.click(kelpBtn);
      });
      // Re-click closed clam_0 while Glowing Kelp is selected -> trades kelp for pearl
      await act(async () => {
        fireEvent.click(screen.getByTestId('entity-clam_0'));
      });
      await act(async () => {
        vi.advanceTimersByTime(ACTION_ANIM_MS + 200);
      });
      expect(screen.getAllByText('⚪').some(el => Boolean(el.closest('button')))).toBe(true);
    });

    it('hides reward in GameEntity tooltip when a clam is in buriedEntities', () => {
      const shipwreck = LEVEL_REGISTRY.shipwreck;
      const clamEnt = {
        id: 'clam_0',
        name: 'Giant Clam',
        emoji: '🐚',
        requires: ['sea_kelp'],
        reqType: 'OR',
        reward: 'pearl',
        x: 40,
        y: 69,
        zone: 2
      };
      const dummyPuzzle = {
        startItems: [],
        goalEntityId: 'captains_chest',
        solution: [],
        puzzleEntities: [clamEnt]
      };

      const { rerender } = render(
        <GameEntity
          ent={clamEnt}
          puzzle={dummyPuzzle}
          level={shipwreck}
          defeated={[]}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId="clam_0"
          animatingEntities={[]}
          buriedEntities={[]}
          inkFogEntities={new Set()}
          unlockedZones={[1]}
          visibleEntitiesSet={new Set(['clam_0'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 40, y: 72 }}
          breakingRockIds={{}}
          isTransformed={true}
          hasDeepTreasure={false}
          handleInteract={() => {}}
          dict={STRINGS.en}
        />
      );
      expect(screen.getAllByText('⚪').length).toBe(2); // 1 inside shell + 1 in tooltip

      rerender(
        <GameEntity
          ent={clamEnt}
          puzzle={dummyPuzzle}
          level={shipwreck}
          defeated={[]}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId="clam_0"
          animatingEntities={[]}
          buriedEntities={['clam_0']}
          inkFogEntities={new Set()}
          unlockedZones={[1]}
          visibleEntitiesSet={new Set(['clam_0'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 40, y: 72 }}
          breakingRockIds={{}}
          isTransformed={true}
          hasDeepTreasure={false}
          handleInteract={() => {}}
          dict={STRINGS.en}
        />
      );
      expect(screen.queryByText('⚪')).toBeNull();
      expect(screen.getByText('❓')).toBeDefined();
    });
  });

  describe('Ship Wreck Geometry & A* Pathfinding', () => {
    it('maintains wall clearance and pairwise spacing for campPos and all mapNodes', () => {
      const shipwreck = LEVEL_REGISTRY.shipwreck;
      const allPoints = [
        { id: 'camp', x: shipwreck.campPos.x, y: shipwreck.campPos.y, zone: 1 },
        ...shipwreck.mapNodes.map((n, i) => ({ ...n, id: n.id || `node_${i}` }))
      ];
      const spacing = validateEntitySpacing(allPoints, {
        minEntityDistance: 8,
        wallPolylines: SHIPWRECK_WALL_POLYLINES,
        minWallMargin: 4.5,
        checkAllPairs: true
      });
      expect(spacing.violations).toEqual([]);
    });

    it('lets Merman reach every flooded room via breach & hatches, blocks Air Pocket, and lets Human reach Captain Chest', () => {
      const shipwreck = LEVEL_REGISTRY.shipwreck;
      const bounds = { width: 100, height: 100 };
      const startPt = { x: shipwreck.campPos.x, y: shipwreck.campPos.y };
      const navOpts = { radius: 1.4, maxIters: 20000, cornerClearance: 0.9 };

      expect(isInShipwreckAirPocket(81, 23)).toBe(true);
      expect(isInShipwreckAirPocket(17, 81)).toBe(false);
      expect(isInShipwreckAirPocket(10, 20)).toBe(false);

      const mermanSegs = getShipwreckObstacleSegments([], [1], [], SHIPWRECK_SCREENS_Y, null, true);
      const humanSegs = getShipwreckObstacleSegments([], [1], [], SHIPWRECK_SCREENS_Y, null, false);

      // Every Zone 1..4 mapNode is reachable by Merman; requiresHuman nodes only by Human
      for (const node of shipwreck.mapNodes) {
        const endPt = { x: node.x, y: node.y };
        if (node.requiresHuman) {
          expect(findGlobalPath(startPt, endPt, mermanSegs, bounds, [], 1.5, navOpts)).toEqual([]);
          expect(findGlobalPath(startPt, endPt, humanSegs, bounds, [], 1.5, navOpts).length).toBeGreaterThan(0);
        } else {
          expect(findGlobalPath(startPt, endPt, mermanSegs, bounds, [], 1.5, navOpts).length).toBeGreaterThan(0);
        }
      }

      // Hull walls prevent walking straight through the upper roof of the crashed galleon
      const outsideLeft = { x: 18, y: 40 };
      const insideStern = { x: 46, y: 56 };
      const detourPath = findGlobalPath(outsideLeft, insideStern, mermanSegs, bounds, [], 1.5, navOpts);
      expect(detourPath.length).toBeGreaterThan(1);
      // Detour must descend through the stern hull breach (y >= 62) before entering the hold
      expect(detourPath.some(p => p.y >= 62)).toBe(true);
    });
  });

  describe('Ship Wreck Procedural Generator & Solver', () => {
    it('generates deterministic, solvable puzzles scaling from 2 to 3 Sea Witch treasures across steps 3..8', () => {
      const shipwreck = LEVEL_REGISTRY.shipwreck;
      const p1 = generateShipwreckPuzzle(shipwreck, 5, 1, 'sw-fixed-seed');
      const p2 = generateShipwreckPuzzle(shipwreck, 5, 1, 'sw-fixed-seed');
      const pDiff = generateShipwreckPuzzle(shipwreck, 5, 1, 'sw-other-seed');

      expect(p1).toBeDefined();
      expect(p1.goalEntityId).toBe('captains_chest');
      expect(p1.solution).toEqual(p2.solution);
      expect(JSON.stringify(p1.solution)).not.toEqual(JSON.stringify(pDiff.solution));

      const easy = generateShipwreckPuzzle(shipwreck, 4, 0, 'sw-scale');
      const mid = generateShipwreckPuzzle(shipwreck, 6, 1, 'sw-scale');
      const hard = generateShipwreckPuzzle(shipwreck, 8, 3, 'sw-scale');

      expect(easy.steps).toBeGreaterThanOrEqual(4);
      expect(mid.steps).toBeGreaterThanOrEqual(6);
      expect(hard.steps).toBeGreaterThanOrEqual(8);

      const easyWitch = easy.puzzleEntities.find(e => e.id === 'sea_witch');
      const hardWitch = hard.puzzleEntities.find(e => e.id === 'sea_witch');
      expect(easyWitch.requires.length).toBe(2);
      expect(hardWitch.requires.length).toBe(3);

      // Sea Witch must only require genuine treasures (never 'shell' or raw sea clutter)
      for (const req of [...easyWitch.requires, ...hardWitch.requires]) {
        expect(['pearl', 'chalice', 'trident', 'abyssal_pearl', 'gem', 'compass']).toContain(req);
      }

      // Captain's Chest requires key/gear lock items, scaling up on high difficulty
      const easyChest = easy.puzzleEntities.find(e => e.id === 'captains_chest');
      const hardChest = hard.puzzleEntities.find(e => e.id === 'captains_chest');
      expect(easyChest.requires).toEqual(['anchor_key']);
      expect(hardChest.requires).toEqual(['anchor_key', 'compass']);

      // High difficulty spawns more misdirection clams/creatures than Easy
      const easyClams = easy.puzzleEntities.filter(e => e.id.startsWith('clam'));
      const hardClams = hard.puzzleEntities.filter(e => e.id.startsWith('clam'));
      expect(hardClams.length).toBeGreaterThan(easyClams.length);

      // Solution must transform via sea_witch before opening captains_chest
      const witchIdx = hard.solution.findIndex(s => s.entityId === 'sea_witch');
      const chestIdx = hard.solution.findIndex(s => s.entityId === 'captains_chest');
      expect(witchIdx).toBeGreaterThan(-1);
      expect(chestIdx).toBeGreaterThan(witchIdx);

      for (const ent of hard.puzzleEntities) {
        expect(isValidEntityTrade(ent)).toBe(true);
      }
    });
  });

  describe('Ship Wreck Gameplay UI Integration', () => {
    it('starts as Merman with AirIndicator hidden, blocks Air Pocket until Witch transformation, then lets Human win with 10 air', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const shipwreck = LEVEL_REGISTRY.shipwreck;
      const basePuzzle = generateShipwreckPuzzle(shipwreck, 4, 0, 'sw-ui-win');
      const witchEnt = basePuzzle.puzzleEntities.find(e => e.id === 'sea_witch');
      const chestEnt = basePuzzle.puzzleEntities.find(e => e.id === 'captains_chest');
      const reqItems = [...(witchEnt.requires || [])];
      const chestReqs = [...(chestEnt.requires || [])];

      const savedState = createSavePayload({
        levelId: 'shipwreck',
        targetSteps: 4,
        numDiggers: 0,
        puzzle: basePuzzle,
        inventory: [...reqItems, ...chestReqs],
        isTransformed: true,
        air: 10,
        pathHistory: [{ x: 17, y: 81, zone: 1 }]
      });

      render(
        <GameInstance
          level={shipwreck}
          targetSteps={4}
          numDiggers={1}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          lang="en"
          setLang={() => {}}
        />
      );

      // Starts transformed as Merman with underwater overlay & meniscus visible, AirIndicator hidden
      expect(screen.getByTestId('shipwreck-background')).toBeDefined();
      expect(screen.getByTestId('shipwreck-water-overlay')).toBeDefined();
      expect(screen.getByTestId('air-pocket-meniscus')).toBeDefined();
      expect(screen.getByText('🧜‍♂️')).toBeDefined();
      expect(screen.queryByTestId('air-indicator')).toBeNull();

      // Clicking Captain's Treasure while Merman triggers bounce splash & is blocked!
      const chestEl = screen.getByTestId('captains-treasure');
      await act(async () => {
        fireEvent.click(chestEl);
      });
      expect(screen.getByTestId('air-pocket-blocked-banner')).toBeDefined();
      expect(screen.getByTestId('water-splash-burst')).toBeDefined();
      expect(screen.queryByText(STRINGS.en.questComplete)).toBeNull();

      // Select Witch's required items and pay the Sea Witch
      for (const itemId of Array.from(new Set(reqItems))) {
        const emoji = shipwreck.items.find(i => i.id === itemId).emoji;
        await act(async () => {
          fireEvent.click(screen.getAllByText(emoji).map(el => el.closest('button')).find(Boolean));
        });
      }
      await act(async () => {
        fireEvent.click(screen.getByTestId('sea-witch-grotto'));
      });
      await act(async () => {
        vi.advanceTimersByTime(ACTION_ANIM_MS + 1600);
      });

      // Transformed to Human with 10/10 AirIndicator
      expect(screen.getByTestId('air-indicator')).toBeDefined();
      expect(screen.getByTestId('air-count-badge').textContent).toBe('10/10');
      expect(screen.getByText('🤿')).toBeDefined();

      // Select chest lock key(s), then Human swims across the waterline into the dry bow Air Pocket to claim Captain's Treasure and win!
      for (const itemId of Array.from(new Set(chestReqs))) {
        const emoji = shipwreck.items.find(i => i.id === itemId).emoji;
        await act(async () => {
          fireEvent.click(screen.getAllByText(emoji).map(el => el.closest('button')).find(Boolean));
        });
      }
      await act(async () => {
        fireEvent.click(screen.getByTestId('captains-treasure'));
      });
      expect(screen.getByTestId('water-splash-burst')).toBeDefined();
      await act(async () => {
        vi.advanceTimersByTime(ACTION_ANIM_MS + 100);
      });
      expect(screen.getByText('🤠')).toBeDefined();
      expect(screen.getByText(STRINGS.en.questComplete)).toBeDefined();
    });

    it('opens OutOfAirModal to float up into the Air Pocket when Human runs out of air inside ship, drops floating items, and refills to 10', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const shipwreck = LEVEL_REGISTRY.shipwreck;
      const basePuzzle = generateShipwreckPuzzle(shipwreck, 5, 1, 'sw-out-of-air');

      const savedState = createSavePayload({
        levelId: 'shipwreck',
        targetSteps: 5,
        numDiggers: 1,
        puzzle: basePuzzle,
        inventory: ['pearl', 'trident'],
        isTransformed: false,
        air: 1,
        pathHistory: [{ x: 37, y: 69, zone: 2 }]
      });

      render(
        <GameInstance
          level={shipwreck}
          targetSteps={5}
          numDiggers={1}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          lang="en"
          setLang={() => {}}
        />
      );

      expect(screen.getByTestId('air-count-badge').textContent).toBe('1/10');
      const heroContainer = screen.getByText('🤿').closest('[class*="transform"]');
      const innerMap = heroContainer.parentElement;

      vi.spyOn(innerMap, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 400,
        height: 900,
        right: 400,
        bottom: 900,
        x: 0,
        y: 0,
        toJSON: () => {}
      });

      // Move within flooded hold (x = 37 -> x = 50, y = 69)
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 200, clientY: 621 });
      });
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      await act(async () => {
        vi.advanceTimersByTime(DROWNING_ALERT_DELAY_MS + 100);
      });

      expect(screen.getByTestId('out-of-air-modal')).toBeDefined();
      expect(screen.getByTestId('out-of-air-confirm').textContent).toBe(STRINGS.en.outOfAirAirPocketBtn);

      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-item-pearl'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-confirm'));
      });

      await act(async () => {
        vi.advanceTimersByTime(DROWNING_RETURN_DELAY_MS + 100);
      });
      await act(async () => {
        vi.advanceTimersByTime(10 * AIR_REFILL_INTERVAL_MS + 200);
      });

      // Hero floated up into the dry Air Pocket (🤠) with 10/10 air and dropped trident floating inside wreck
      expect(screen.getByTestId('air-count-badge').textContent).toBe('10/10');
      expect(screen.getByText('🤠')).toBeDefined();
      expect(screen.getByTestId('floating-item-trident')).toBeDefined();
      expect(AIR_POCKET_Y).toBe(33);
      expect(SHIPWRECK_SCREENS_X).toBe(2.2);
      expect(SHIPWRECK_SCREENS_Y).toBe(1.25);
    });

    it('shows Lost-at-Sea restart popup and resets level when Human runs out of air outside the ship, and enforces 4/4 heavy penalty & floating anchor drops', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const shipwreck = LEVEL_REGISTRY.shipwreck;
      const basePuzzle = generateShipwreckPuzzle(shipwreck, 5, 1, 'sw-outside-drown');

      const savedState = createSavePayload({
        levelId: 'shipwreck',
        targetSteps: 5,
        numDiggers: 1,
        puzzle: basePuzzle,
        inventory: ['pearl', 'trident', 'shell', 'gem'],
        isTransformed: false,
        air: 2,
        pathHistory: [{ x: 17, y: 81, zone: 1 }]
      });

      render(
        <GameInstance
          level={shipwreck}
          targetSteps={5}
          numDiggers={1}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          lang="en"
          setLang={() => {}}
        />
      );

      // Unified heavy diving penalty active in shipwreck (4/4 bag)
      expect(screen.getByTestId('heavy-air-badge')).toBeDefined();
      expect(screen.getByTestId('hero-heavy-badge')).toBeDefined();

      const heroContainer = screen.getByText('🤿').closest('[class*="transform"]');
      const innerMap = heroContainer.parentElement;
      vi.spyOn(innerMap, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 400,
        height: 900,
        right: 400,
        bottom: 900,
        x: 0,
        y: 0,
        toJSON: () => {}
      });

      // Move outside hull on 2 air with 4/4 heavy bag -> costs 2 air -> 0 air outside ship!
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 60, clientY: 585 }); // (15, 65) outside hull
      });
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });
      await act(async () => {
        vi.advanceTimersByTime(DROWNING_ALERT_DELAY_MS + 100);
      });

      expect(screen.getByTestId('out-of-air-restart-modal')).toBeDefined();
      await act(async () => {
        fireEvent.click(screen.getByTestId('out-of-air-restart-btn'));
      });

      // Level restarts back to initial Merman state at camp with empty inventory
      expect(screen.queryByTestId('out-of-air-restart-modal')).toBeNull();
      expect(screen.getByText('🧜‍♂️')).toBeDefined();
      expect(screen.getByText('0/4')).toBeDefined();

      // Separately verify manual drop at shipwreck seabed anchor renders inside cyan floating bubble
      cleanup();
      render(
        <GameInstance
          level={shipwreck}
          targetSteps={5}
          numDiggers={1}
          onGenerateNew={() => {}}
          onLoadState={() => {}}
          savedState={savedState}
          lang="en"
          setLang={() => {}}
        />
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /💎/ }));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('shipwreck-anchor-camp'));
      });
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByTestId('floating-item-gem')).toBeDefined();
    });
  });
});
