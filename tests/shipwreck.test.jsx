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
  SHIPWRECK_SCREENS,
  SHIPWRECK_WALL_POLYLINES,
  getShipwreckObstacleSegments
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
      const basePuzzle = generateUnderwaterPuzzle(underwater, 5, 1, 'clam-click-close-seed');

      // Ensure predictable test clams (one clam_0 and one giant_clam_1) with distinct rewards
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
        numDiggers: 1,
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
      const bounds = { width: 100, height: SHIPWRECK_SCREENS * 100 };
      const startPt = { x: shipwreck.campPos.x, y: shipwreck.campPos.y * SHIPWRECK_SCREENS };

      const mermanSegs = getShipwreckObstacleSegments([], [1], [], SHIPWRECK_SCREENS, null, true);
      const humanSegs = getShipwreckObstacleSegments([], [1], [], SHIPWRECK_SCREENS, null, false);

      // Every Zone 1..4 mapNode is reachable by Merman
      for (const node of shipwreck.mapNodes) {
        const endPt = { x: node.x, y: node.y * SHIPWRECK_SCREENS };
        if (node.requiresHuman) {
          expect(findGlobalPath(startPt, endPt, mermanSegs, bounds, [], 3, {})).toEqual([]);
          expect(findGlobalPath(startPt, endPt, humanSegs, bounds, [], 3, {}).length).toBeGreaterThan(0);
        } else {
          expect(findGlobalPath(startPt, endPt, mermanSegs, bounds, [], 3, {}).length).toBeGreaterThan(0);
        }
      }

      // Hull walls prevent walking straight out through starboard solid wall
      const outsideLeft = { x: 10, y: 49 * SHIPWRECK_SCREENS };
      const insidePort = { x: 34, y: 49 * SHIPWRECK_SCREENS };
      const detourPath = findGlobalPath(outsideLeft, insidePort, mermanSegs, bounds, [], 3, {});
      expect(detourPath.length).toBeGreaterThan(1);
      // Detour must descend through the hull breach (y >= 65 * 3) before going up into Deck 3
      expect(detourPath.some(p => p.y >= 62 * SHIPWRECK_SCREENS)).toBe(true);
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

      const easy = generateShipwreckPuzzle(shipwreck, 3, 1, 'sw-scale');
      const mid = generateShipwreckPuzzle(shipwreck, 5, 1, 'sw-scale');
      const hard = generateShipwreckPuzzle(shipwreck, 8, 1, 'sw-scale');

      expect(easy.steps).toBeGreaterThanOrEqual(4);
      expect(mid.steps).toBeGreaterThanOrEqual(5);
      expect(hard.steps).toBeGreaterThanOrEqual(8);

      const easyWitch = easy.puzzleEntities.find(e => e.id === 'sea_witch');
      const hardWitch = hard.puzzleEntities.find(e => e.id === 'sea_witch');
      expect(easyWitch.requires.length).toBe(2);
      expect(hardWitch.requires.length).toBe(3);

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
    it('starts as Merman with AirIndicator hidden, blocks Air Pocket until Witch transformation, then lets Human win with 16 air', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const shipwreck = LEVEL_REGISTRY.shipwreck;
      const basePuzzle = generateShipwreckPuzzle(shipwreck, 4, 1, 'sw-ui-win');
      const witchEnt = basePuzzle.puzzleEntities.find(e => e.id === 'sea_witch');
      const reqItems = [...(witchEnt.requires || [])];

      const savedState = createSavePayload({
        levelId: 'shipwreck',
        targetSteps: 4,
        numDiggers: 1,
        puzzle: basePuzzle,
        inventory: reqItems,
        isTransformed: true,
        air: 16,
        pathHistory: [{ x: 36, y: 91, zone: 1 }]
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

      // Starts transformed as Merman, AirIndicator hidden
      expect(screen.getByTestId('shipwreck-background')).toBeDefined();
      expect(screen.getByText('🧜‍♂️')).toBeDefined();
      expect(screen.queryByTestId('air-indicator')).toBeNull();

      // Clicking Captain's Treasure while Merman is blocked!
      const chestEl = screen.getByTestId('captains-treasure');
      await act(async () => {
        fireEvent.click(chestEl);
      });
      expect(screen.getByTestId('air-pocket-blocked-banner')).toBeDefined();
      expect(screen.queryByText(STRINGS.en.questComplete)).toBeNull();

      // Select Witch's required items and pay the Sea Witch
      for (const itemId of Array.from(new Set(reqItems))) {
        const emoji = shipwreck.items.find(i => i.id === itemId).emoji;
        await act(async () => {
          fireEvent.click(screen.getAllByText(emoji).map(el => el.closest('button')).find(Boolean));
        });
      }
      await act(async () => {
        fireEvent.click(screen.getByText('😈'));
      });
      await act(async () => {
        vi.advanceTimersByTime(ACTION_ANIM_MS + 1600);
      });

      // Transformed to Human with 16/16 AirIndicator
      expect(screen.getByTestId('air-indicator')).toBeDefined();
      expect(screen.getByTestId('air-count-badge').textContent).toBe('16/16');
      expect(screen.getByText('🤿')).toBeDefined();

      // Now Human swims into the top Air Pocket to claim Captain's Treasure and win!
      await act(async () => {
        fireEvent.click(screen.getByTestId('captains-treasure'));
      });
      await act(async () => {
        vi.advanceTimersByTime(ACTION_ANIM_MS + 100);
      });
      expect(screen.getByText(STRINGS.en.questComplete)).toBeDefined();
    });

    it('opens OutOfAirModal with Sea Witch return button when Human runs out of air, drops floating items in wreck, and refills to 16', async () => {
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
        pathHistory: [{ x: 40, y: 69, zone: 2 }]
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

      expect(screen.getByTestId('air-count-badge').textContent).toBe('1/16');
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

      // Move within Deck 2 (y = 69 -> y = 68, x = 60 -> valid open room spot)
      await act(async () => {
        fireEvent.click(innerMap, { clientX: 240, clientY: 612 });
      });
      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      await act(async () => {
        vi.advanceTimersByTime(DROWNING_ALERT_DELAY_MS + 100);
      });

      expect(screen.getByTestId('out-of-air-modal')).toBeDefined();
      expect(screen.getByTestId('out-of-air-confirm').textContent).toBe(STRINGS.en.outOfAirWitchBtn);

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
        vi.advanceTimersByTime(16 * AIR_REFILL_INTERVAL_MS + 200);
      });

      expect(screen.getByTestId('air-count-badge').textContent).toBe('16/16');
      expect(screen.getByTestId('floating-item-trident')).toBeDefined();
      expect(AIR_POCKET_Y).toBe(25);
    });
  });
});
