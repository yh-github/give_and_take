import { DEEP_CAVE_SLOT_COLS } from '../../constants.ts';
import { distToSegment } from '../../logic/geometry.ts';
import { isPointInPolygon } from '../../logic/pathfinding.ts';
import { shuffle } from '../../logic/rng.ts';
import type { RNG } from '../../logic/rng.ts';
import { getProceduralObstacleSegments } from '../../logic/visibility.ts';
import { getSlotCenter, getWorldDimensions } from './slotGrid.ts';
import type {
  CaveBrazier,
  CaveLandmark,
  CaveLandmarkKind,
  DeepCaveSettings,
  Point2D,
  PuzzleEntity,
  RasterizedSlotGrid,
  SpaceBlueprint
} from '../../types/index.ts';

interface WallSegmentCheck {
  a: Point2D;
  b: Point2D;
}

function minWallDist(pt: Point2D, segments: readonly WallSegmentCheck[]): number {
  let minD = Infinity;
  for (const s of segments) {
    const d = distToSegment(pt, s.a, s.b);
    if (d < minD) minD = d;
  }
  return minD;
}

function isInsideDoorwayOrCollar(pt: Point2D, geometry: RasterizedSlotGrid, pad = 2.0): boolean {
  for (const box of geometry.collarLockBoxes || []) {
    if (
      pt.x >= box.xLeft - pad &&
      pt.x <= box.xRight + pad &&
      pt.y >= box.yTop - pad &&
      pt.y <= box.yBottom + pad
    ) {
      return true;
    }
  }
  for (const dw of Object.values(geometry.doorways || {})) {
    const cb = dw.collarBounds;
    if (
      pt.x >= cb.xLeft - pad &&
      pt.x <= cb.xRight + pad &&
      pt.y >= cb.yTop - pad &&
      pt.y <= cb.yBottom + pad
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Generates deterministic subterranean visual landmarks and interactive
 * lightable braziers positioned safely inside open cavern chambers.
 */
export function buildCaveFeatures(
  blueprint: SpaceBlueprint,
  geometry: RasterizedSlotGrid,
  placedEntities: readonly PuzzleEntity[],
  campPos: Point2D,
  settings: DeepCaveSettings,
  rng: RNG
): { landmarks: CaveLandmark[]; braziers: CaveBrazier[] } {
  const cols = blueprint.cols ?? blueprint.slots[0]?.length ?? DEEP_CAVE_SLOT_COLS;
  const dims = getWorldDimensions(blueprint.rows, cols);
  const wallSegments = getProceduralObstacleSegments([], geometry, []);

  const isOpenFloorPoint = (pt: Point2D, wallMargin: number, collarPad = 2.0): boolean => {
    if (pt.x < wallMargin || pt.x > dims.worldWidth - wallMargin) return false;
    if (pt.y < wallMargin || pt.y > dims.worldHeight - wallMargin) return false;
    if (geometry.obstaclePolygons?.some(poly => isPointInPolygon(pt, poly))) return false;
    if (minWallDist(pt, wallSegments) < wallMargin) return false;
    if (isInsideDoorwayOrCollar(pt, geometry, collarPad)) return false;
    return true;
  };

  const landmarks: CaveLandmark[] = [];
  let lmSeq = 1;

  // 1. Vault Sanctum runes centered under the Vault chamber
  const vaultCenter = getSlotCenter(blueprint.vaultCol, blueprint.rows - 1, dims);
  landmarks.push({
    id: `lm_vault_${lmSeq++}`,
    kind: 'vault_sanctum',
    x: Math.round(vaultCenter.x * 100) / 100,
    y: Math.round((vaultCenter.y + 4) * 100) / 100,
    scale: 1,
    seed: Math.floor(rng() * 10000)
  });

  // 2. Mushroom Grotto fungal floor & bioluminescent spore clusters
  for (const ep of blueprint.encounterPlacements) {
    if (ep.encounter.id === 'mushroom_grotto') {
      const pocketCenter = getSlotCenter(ep.originCol + 1, ep.originRow, dims);
      landmarks.push({
        id: `lm_mush_pocket_${lmSeq++}`,
        kind: 'mushroom_grove',
        x: Math.round(pocketCenter.x * 100) / 100,
        y: Math.round(pocketCenter.y * 100) / 100,
        scale: 1.1,
        seed: Math.floor(rng() * 10000)
      });
      const vestCenter = getSlotCenter(ep.originCol, ep.originRow, dims);
      const vestSpot = { x: vestCenter.x - 4.5, y: vestCenter.y - 8 };
      if (isOpenFloorPoint(vestSpot, 4.5, 1.5)) {
        landmarks.push({
          id: `lm_mush_vest_${lmSeq++}`,
          kind: 'mushroom_grove',
          x: Math.round(vestSpot.x * 100) / 100,
          y: Math.round(vestSpot.y * 100) / 100,
          scale: 0.65,
          seed: Math.floor(rng() * 10000)
        });
      }
    } else if (ep.encounter.id === 'rope_chasm_bridge') {
      const cacheCenter = getSlotCenter(ep.originCol + 1, ep.originRow, dims);
      landmarks.push({
        id: `lm_chasm_cache_${lmSeq++}`,
        kind: 'ruined_arch',
        x: Math.round(cacheCenter.x * 100) / 100,
        y: Math.round((cacheCenter.y + 6) * 100) / 100,
        scale: 0.85,
        seed: Math.floor(rng() * 10000)
      });
    } else if (ep.encounter.id === 'guardian_lair') {
      const lairCenter = getSlotCenter(ep.originCol, ep.originRow, dims);
      landmarks.push({
        id: `lm_lair_${lmSeq++}`,
        kind: 'ruined_arch',
        x: Math.round(lairCenter.x * 100) / 100,
        y: Math.round((lairCenter.y - 6) * 100) / 100,
        scale: 0.9,
        seed: Math.floor(rng() * 10000)
      });
    }
  }

  // 3. Thematic landmarks in regular chambers (Crystal Veins, Glow Pools, Mine Rails, Ruined Arches)
  const roomThemes: CaveLandmarkKind[] = ['crystal_vein', 'glow_pool', 'mine_rails', 'ruined_arch'];
  const activeRegularSlots: Array<{ col: number; row: number; role: string; zone: number }> = [];
  for (let r = 0; r < blueprint.rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const sl = blueprint.slots[r][c];
      if (!sl.active || sl.encounterId || sl.role === 'vault' || sl.zone == null) continue;
      activeRegularSlots.push({ col: c, row: r, role: sl.role, zone: sl.zone });
    }
  }

  const shuffledSlots = shuffle(activeRegularSlots, rng);
  let themeIdx = Math.floor(rng() * roomThemes.length);
  const landmarkOffsets: Array<[number, number]> = [
    [-5.5, -10],
    [5.5, 10],
    [-6, 10],
    [6, -10],
    [0, 0]
  ];

  const targetLandmarkCount = Math.min(shuffledSlots.length, Math.max(3, Math.ceil(shuffledSlots.length * 0.55)));
  for (const sl of shuffledSlots) {
    if (landmarks.length >= targetLandmarkCount + 3) break;
    const center = getSlotCenter(sl.col, sl.row, dims);
    let pickedKind: CaveLandmarkKind;
    if (sl.role === 'spur') {
      pickedKind = rng() < 0.55 ? 'glow_pool' : 'crystal_vein';
    } else if (sl.role === 'branch' || sl.role === 'loop') {
      pickedKind = rng() < 0.5 ? 'mine_rails' : 'crystal_vein';
    } else {
      pickedKind = roomThemes[themeIdx % roomThemes.length];
      themeIdx++;
    }

    const offsetCandidates = shuffle(landmarkOffsets, rng);
    for (const [ox, oy] of offsetCandidates) {
      const pt = {
        x: Math.round((center.x + ox) * 100) / 100,
        y: Math.round((center.y + oy) * 100) / 100
      };
      if (!isOpenFloorPoint(pt, 5.2, 1.5)) continue;
      if (Math.hypot(pt.x - campPos.x, pt.y - campPos.y) < 12) continue;
      if (landmarks.some(l => Math.hypot(l.x - pt.x, l.y - pt.y) < 18)) continue;
      landmarks.push({
        id: `lm_${pickedKind}_${lmSeq++}`,
        kind: pickedKind,
        x: pt.x,
        y: pt.y,
        scale: 0.88 + (rng() * 0.24),
        rotation: Math.round((rng() - 0.5) * 28),
        seed: Math.floor(rng() * 10000)
      });
      break;
    }
  }

  // 4. Interactive Lightable Braziers at key navigation hubs & deep branches
  const desiredBraziers = settings.rows >= 5 ? 4 : (settings.rows >= 4 ? 3 : 2);
  const braziers: CaveBrazier[] = [];
  const brazierSlots = [...activeRegularSlots].sort((a, b) => {
    // Prefer middle/deep non-camp forks/loops/branches so braziers serve as helpful navigation beacons
    const aNonCamp = a.row === 0 && a.col === blueprint.campCol ? 1 : 0;
    const bNonCamp = b.row === 0 && b.col === blueprint.campCol ? 1 : 0;
    if (aNonCamp !== bNonCamp) return aNonCamp - bNonCamp;
    const aHub = (a.role === 'branch' || a.role === 'loop') ? 0 : 1;
    const bHub = (b.role === 'branch' || b.role === 'loop') ? 0 : 1;
    if (aHub !== bHub) return aHub - bHub;
    return a.row - b.row;
  });

  const brazierOffsets: Array<[number, number]> = [
    [0, 0],
    [-4.5, -6],
    [4.5, 6],
    [-4.5, 6],
    [4.5, -6],
    [0, -11],
    [0, 11],
    [-6, 0],
    [6, 0]
  ];

  const tryPlaceBrazierInSlots = (minBrazierDist: number, minEntityDist: number) => {
    for (const sl of brazierSlots) {
      if (braziers.length >= desiredBraziers) break;
      // Spread braziers across different rows when possible
      if (braziers.some(br => Math.abs(br.y - getSlotCenter(sl.col, sl.row, dims).y) < 28) && minBrazierDist >= 26) {
        continue;
      }
      const center = getSlotCenter(sl.col, sl.row, dims);
      for (const [ox, oy] of brazierOffsets) {
        const pt = {
          x: Math.round((center.x + ox) * 100) / 100,
          y: Math.round((center.y + oy) * 100) / 100
        };
        if (!isOpenFloorPoint(pt, 6.2, 2.2)) continue;
        if (Math.hypot(pt.x - campPos.x, pt.y - campPos.y) < 14) continue;
        if (placedEntities.some(e => Math.hypot(e.x - pt.x, e.y - pt.y) < minEntityDist)) continue;
        if (braziers.some(b => Math.hypot(b.x - pt.x, b.y - pt.y) < minBrazierDist)) continue;
        braziers.push({
          id: `brazier_${braziers.length + 1}`,
          x: pt.x,
          y: pt.y,
          zone: sl.zone,
          radius: Math.max(40, Math.min(54, Math.round(settings.torchRadius * 0.9)))
        });
        break;
      }
    }
  };

  tryPlaceBrazierInSlots(30, 10.5);
  if (braziers.length < Math.min(2, activeRegularSlots.length)) {
    tryPlaceBrazierInSlots(18, 9.0);
  }

  return { landmarks, braziers };
}
