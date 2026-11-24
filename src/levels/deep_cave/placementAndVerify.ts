import {
  DEEP_CAVE_CORRIDOR_MIN_WIDTH,
  DEEP_CAVE_HERO_RADIUS,
  DEEP_CAVE_MIN_ENTITY_DIST,
  DEEP_CAVE_MIN_WALL_MARGIN,
  DEEP_CAVE_SLOT_COLS,
  DEEP_CAVE_SLOT_HEIGHT
} from '../../constants.ts';
import { distToSegment } from '../../logic/geometry.ts';
import { checkBatchReachability, findGlobalPath, isPointInPolygon } from '../../logic/pathfinding.ts';
import { shuffle } from '../../logic/rng.ts';
import type { RNG } from '../../logic/rng.ts';
import { validateEntitySpacing } from '../../logic/rules.ts';
import { assessPuzzleDifficulty, solvePuzzle } from '../../logic/solver.ts';
import {
  checkCollision,
  getProceduralObstacleSegments,
  getVisibilityPolygon
} from '../../logic/visibility.ts';
import { getSlotCenter, getWorldDimensions } from './slotGrid.ts';
import type {
  DeepCaveSettings,
  LevelDefinition,
  MissionEntitySpec,
  OrientedBox,
  PlacedEntitiesResult,
  Point2D,
  ProceduralGeometry,
  PuzzleEntity,
  RasterizedSlotGrid,
  SpaceBlueprint,
  VerifyGeneratedLevelResult
} from '../../types/index.ts';

/**
 * Stage 5: Places gatekeepers on exact doorway collars / encounter anchors,
 * and positions traders, presets, diggers, and vault treasure via seeded rejection
 * sampling respecting `D_min >= 14.0`, `M_min >= 6.5`, and doorway exclusion.
 */
export function placeEntitiesInSlots(
  specs: readonly MissionEntitySpec[],
  blueprint: SpaceBlueprint,
  geometry: RasterizedSlotGrid,
  rng: RNG
): PlacedEntitiesResult | null {
  const { slots, campCol, vaultCol } = blueprint;
  const cols = blueprint.cols ?? slots[0]?.length ?? DEEP_CAVE_SLOT_COLS;
  const dims = getWorldDimensions(blueprint.rows, cols);
  const wallSegments = getProceduralObstacleSegments([], geometry, []);

  const campCenter = getSlotCenter(campCol, 0, dims);
  const campPos: Point2D = { x: campCenter.x, y: Math.max(15, campCenter.y - 16) };

  const placed: PuzzleEntity[] = [];

  const wallClearanceThreshold = DEEP_CAVE_MIN_WALL_MARGIN + 0.1;
  const minDistToSegments = (pt: Point2D, earlyExitBelow = 0): number => {
    let minD = Infinity;
    for (const seg of wallSegments) {
      if (earlyExitBelow > 0) {
        const ax = seg.a.x;
        const bx = seg.b.x;
        if (
          (ax < pt.x - earlyExitBelow && bx < pt.x - earlyExitBelow) ||
          (ax > pt.x + earlyExitBelow && bx > pt.x + earlyExitBelow)
        ) {
          continue;
        }
        const ay = seg.a.y;
        const by = seg.b.y;
        if (
          (ay < pt.y - earlyExitBelow && by < pt.y - earlyExitBelow) ||
          (ay > pt.y + earlyExitBelow && by > pt.y + earlyExitBelow)
        ) {
          continue;
        }
      }
      const d = distToSegment(pt, seg.a, seg.b);
      if (earlyExitBelow > 0 && d < earlyExitBelow) return d;
      if (d < minD) minD = d;
    }
    return minD;
  };

  const isInsideCollar = (pt: Point2D): boolean => {
    for (const box of geometry.collarLockBoxes || []) {
      if (
        pt.x >= box.xLeft - 2.5 &&
        pt.x <= box.xRight + 2.5 &&
        pt.y >= box.yTop - 2.5 &&
        pt.y <= box.yBottom + 2.5
      ) {
        return true;
      }
    }
    return false;
  };

  const isValidFreePos = (pt: Point2D, checkExisting: readonly PuzzleEntity[] = placed): boolean => {
    if (geometry.obstaclePolygons?.some(poly => isPointInPolygon(pt, poly))) return false;
    if (minDistToSegments(pt, wallClearanceThreshold) < wallClearanceThreshold) return false;
    if (isInsideCollar(pt)) return false;
    if (Math.hypot(pt.x - campPos.x, pt.y - campPos.y) < DEEP_CAVE_MIN_ENTITY_DIST) return false;

    for (const other of checkExisting) {
      if (Math.hypot(pt.x - other.x, pt.y - other.y) < DEEP_CAVE_MIN_ENTITY_DIST + 0.1) {
        return false;
      }
    }
    return true;
  };

  // Pass 1: Place deterministic doorway & encounter-anchored entities first
  const freeEntities: MissionEntitySpec[] = [];
  for (const spec of specs) {
    if (spec.kind === 'doorway_gate' && spec.edgeKey) {
      const dw = geometry.doorways[spec.edgeKey];
      if (!dw) return null;
      placed.push({
        ...spec,
        x: dw.x,
        y: dw.y,
        collarBounds: { ...dw.collarBounds }
      });
    } else if (spec.kind?.startsWith('encounter_') && spec.encounter && spec.anchorType) {
      const ep = spec.encounter;
      const anchorData = geometry.encounterAnchors.find(
        a => a.encounterId === ep.encounter.id && a.originCol === ep.originCol && a.originRow === ep.originRow
      );
      const bucket = spec.anchorType === 'E' && anchorData?.E
        ? [...anchorData.E].sort((a, b) => a.x - b.x)
        : anchorData?.[spec.anchorType];
      const anchor = bucket?.[spec.anchorIndex || 0];
      if (!anchor) return null;
      const ent: PuzzleEntity = {
        ...spec,
        x: anchor.x,
        y: anchor.y
      };
      if (spec.isGatekeeper && anchor.bounds) {
        ent.collarBounds = { ...anchor.bounds };
      }
      placed.push(ent);
    } else {
      freeEntities.push(spec);
    }
  }

  // Pass 2: Place goal treasure inside Vault slot center first so traders stay separated
  const vaultSpecIdx = freeEntities.findIndex(e => e.isGoal);
  if (vaultSpecIdx > -1) {
    const vaultSpec = freeEntities.splice(vaultSpecIdx, 1)[0];
    const vc = getSlotCenter(vaultCol, blueprint.rows - 1, dims);
    const candidates: Point2D[] = [
      { x: vc.x, y: vc.y + 4 },
      { x: vc.x, y: vc.y },
      { x: vc.x - 4, y: vc.y + 4 },
      { x: vc.x + 4, y: vc.y + 4 }
    ];
    let placedVault = false;
    for (const cand of candidates) {
      if (isValidFreePos(cand)) {
        placed.push({ ...vaultSpec, x: cand.x, y: cand.y });
        placedVault = true;
        break;
      }
    }
    if (!placedVault) return null;
  }

  // Pass 3: Place traders, presets, and decoys inside slots belonging to their zone
  const zoneSlots = new Map<number, Array<{ col: number; row: number }>>();
  for (let r = 0; r < blueprint.rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = slots[r][c];
      if (!s.active || s.encounterId || s.role === 'vault' || s.zone == null) continue;
      let list = zoneSlots.get(s.zone);
      if (!list) {
        list = [];
        zoneSlots.set(s.zone, list);
      }
      list.push({ col: c, row: r });
    }
  }

  const slotOccupancy = new Map<string, number>();
  const slotPresetOccupancy = new Map<string, number>();

  for (const spec of freeEntities) {
    const targetSlots = zoneSlots.get(spec.zone) || [];
    const shuffledSlots = targetSlots.length > 0 ? shuffle(targetSlots, rng) : [];
    if (shuffledSlots.length === 0) return null;

    // Locate any already-placed direct suppliers (giving spec.requires) or direct consumers (wanting spec.reward)
    const coupledPositions: Point2D[] = [];
    for (const ent of placed) {
      const sharesReq = Boolean(ent.reward && spec.requires?.includes(ent.reward));
      const sharesConsume = Boolean(spec.reward && ent.requires?.includes(spec.reward));
      if (sharesReq || sharesConsume) {
        coupledPositions.push({ x: ent.x, y: ent.y });
      }
    }

    // Spread entities evenly across slots; avoid piling presets together, keep diggers/presets out of camp,
    // and maximize separation from direct suppliers/consumers when multiple slots exist in a zone.
    const searchSlots = [...shuffledSlots].sort((a, b) => {
      const ka = `${a.col},${a.row}`;
      const kb = `${b.col},${b.row}`;
      if (spec.isPreset) {
        const pa = slotPresetOccupancy.get(ka) || 0;
        const pb = slotPresetOccupancy.get(kb) || 0;
        if (pa !== pb) return pa - pb;
      }
      if (spec.isPreset || spec.isDigger) {
        const aCamp = a.col === campCol && a.row === 0 ? 1 : 0;
        const bCamp = b.col === campCol && b.row === 0 ? 1 : 0;
        if (aCamp !== bCamp) return aCamp - bCamp;
      }
      const occDiff = (slotOccupancy.get(ka) || 0) - (slotOccupancy.get(kb) || 0);
      if (occDiff !== 0) return occDiff;
      if (coupledPositions.length > 0) {
        const ca = getSlotCenter(a.col, a.row, dims);
        const cb = getSlotCenter(b.col, b.row, dims);
        const minDistA = Math.min(...coupledPositions.map(p => Math.hypot(ca.x - p.x, ca.y - p.y)));
        const minDistB = Math.min(...coupledPositions.map(p => Math.hypot(cb.x - p.x, cb.y - p.y)));
        if (Math.abs(minDistB - minDistA) > 4) return minDistB - minDistA;
      }
      return 0;
    });

    let pos: Point2D | null = null;
    let chosenSlotKey: string | null = null;
    for (const sl of searchSlots) {
      const center = getSlotCenter(sl.col, sl.row, dims);
      const slotW = dims.worldWidth / cols;
      const slotH = dims.worldHeight / blueprint.rows;

      const offsets: Array<[number, number]> = [
        [0, -14.5],
        [0, 14.5],
        [0, 0],
        [-6.5, -14],
        [6.5, 14],
        [-6.5, 14],
        [6.5, -14],
        [-7, 0],
        [7, 0],
        [0, -18.5],
        [0, 18.5]
      ];
      for (let oy = -21; oy <= 21; oy += 3) {
        for (let ox = -9; ox <= 9; ox += 3) {
          offsets.push([ox, oy]);
        }
      }

      for (let idx = 0; idx < offsets.length; idx++) {
        const [ox, oy] = offsets[idx];
        const jx = idx < 11 ? (rng() - 0.5) * 0.6 : 0;
        const jy = idx < 11 ? (rng() - 0.5) * 0.5 : 0;
        const cand: Point2D = {
          x: Math.round((center.x + ox + jx) * 100) / 100,
          y: Math.round((center.y + oy + jy) * 100) / 100
        };
        if (cand.x < center.x - slotW / 2 + 7 || cand.x > center.x + slotW / 2 - 7) continue;
        if (cand.y < center.y - slotH / 2 + 8 || cand.y > center.y + slotH / 2 - 8) continue;
        if (isValidFreePos(cand)) {
          pos = cand;
          chosenSlotKey = `${sl.col},${sl.row}`;
          break;
        }
      }
      if (pos) break;
    }

    if (!pos) return null;
    if (chosenSlotKey) {
      slotOccupancy.set(chosenSlotKey, (slotOccupancy.get(chosenSlotKey) || 0) + 1);
      if (spec.isPreset) {
        slotPresetOccupancy.set(chosenSlotKey, (slotPresetOccupancy.get(chosenSlotKey) || 0) + 1);
      }
    }
    placed.push({ ...spec, x: pos.x, y: pos.y });
  }

  return { placed, campPos };
}

/**
 * Stage 6: Verification Suite (Solvability, A* Navigability, Collar Sealing,
 * Spacing/Clearance, Torch Visibility Reachability).
 */
export function verifyGeneratedLevel(
  startItems: readonly string[],
  entities: readonly PuzzleEntity[],
  goalEntityId: string,
  geometry: ProceduralGeometry & { torchRadius?: number; obstaclePolygons?: Point2D[][] },
  settings: DeepCaveSettings,
  levelStub: Pick<LevelDefinition, 'mechanics'>
): VerifyGeneratedLevelResult {
  const { campPos, worldWidth = 100, worldHeight = 256, torchRadius = settings.torchRadius } = geometry;
  if (!campPos) {
    return { valid: false, reason: 'MISSING_CAMP_POS' };
  }

  // 1. Solver verification + strict step window check
  const solution = solvePuzzle(startItems, entities, goalEntityId, levelStub, { maxStates: 6000 });
  if (!solution || solution.steps < settings.targetSteps || solution.steps > settings.targetSteps + 1) {
    return { valid: false, reason: 'SOLVER_FAILED' };
  }

  // 2. Spatial separation & wall margin check (isotropic D_min = 14.0, M_min = 6.5)
  const spacingCheck = validateEntitySpacing(entities, {
    minEntityDistance: DEEP_CAVE_MIN_ENTITY_DIST,
    wallPolylines: geometry.wallPolylines,
    minWallMargin: DEEP_CAVE_MIN_WALL_MARGIN,
    checkAllPairs: true
  });
  if (!spacingCheck.isValid) {
    return { valid: false, reason: 'SPACING_FAILED', violations: spacingCheck.violations };
  }

  // 3. Zero-Gap Collar Sealing Verification for every gatekeeper
  const wallOnlySegments = getProceduralObstacleSegments([], geometry, []);
  for (const gk of entities) {
    if (!gk.isGatekeeper) continue;
    const cb = gk.collarBounds as OrientedBox | undefined;
    if (!cb) return { valid: false, reason: 'MISSING_COLLAR_BOUNDS' };

    const isVert = cb.orientation === 'vertical';
    if (!isVert) {
      if (cb.xRight - cb.xLeft < DEEP_CAVE_CORRIDOR_MIN_WIDTH - 1e-3) {
        return { valid: false, reason: 'COLLAR_TOO_NARROW' };
      }
      const touchesLeft = wallOnlySegments.some(s =>
        Math.abs(s.a.x - cb.xLeft) < 0.15 && Math.abs(s.b.x - cb.xLeft) < 0.15 &&
        Math.min(s.a.y, s.b.y) <= gk.y + 0.5 && Math.max(s.a.y, s.b.y) >= gk.y - 0.5
      );
      const touchesRight = wallOnlySegments.some(s =>
        Math.abs(s.a.x - cb.xRight) < 0.15 && Math.abs(s.b.x - cb.xRight) < 0.15 &&
        Math.min(s.a.y, s.b.y) <= gk.y + 0.5 && Math.max(s.a.y, s.b.y) >= gk.y - 0.5
      );
      if (!touchesLeft || !touchesRight) return { valid: false, reason: 'COLLAR_NOT_FLUSH' };
    } else {
      if (cb.yBottom - cb.yTop < DEEP_CAVE_CORRIDOR_MIN_WIDTH - 1e-3) {
        return { valid: false, reason: 'COLLAR_TOO_NARROW' };
      }
      const touchesTop = wallOnlySegments.some(s =>
        Math.abs(s.a.y - cb.yTop) < 0.15 && Math.abs(s.b.y - cb.yTop) < 0.15 &&
        Math.min(s.a.x, s.b.x) <= gk.x + 0.5 && Math.max(s.a.x, s.b.x) >= gk.x - 0.5
      );
      const touchesBottom = wallOnlySegments.some(s =>
        Math.abs(s.a.y - cb.yBottom) < 0.15 && Math.abs(s.b.y - cb.yBottom) < 0.15 &&
        Math.min(s.a.x, s.b.x) <= gk.x + 0.5 && Math.max(s.a.x, s.b.x) >= gk.x - 0.5
      );
      if (!touchesTop || !touchesBottom) return { valid: false, reason: 'COLLAR_NOT_FLUSH' };
    }
  }

  // 4. A* / BFS Corridor Navigability across all unlocked chambers (at r_hero = 3.0)
  const reachList = checkBatchReachability(
    campPos,
    entities.map(ent => ({ x: ent.x, y: ent.y })),
    wallOnlySegments,
    { width: worldWidth, height: worldHeight },
    geometry.obstaclePolygons,
    3,
    { radius: DEEP_CAVE_HERO_RADIUS }
  );
  for (let i = 0; i < entities.length; i++) {
    if (!reachList[i]) {
      return { valid: false, reason: 'PATHFINDING_UNREACHABLE', entityId: entities[i].id };
    }
  }
  const goalEnt = entities.find(e => e.id === goalEntityId);
  if (goalEnt) {
    const vaultPath = findGlobalPath(
      campPos,
      { x: goalEnt.x, y: goalEnt.y },
      wallOnlySegments,
      { width: worldWidth, height: worldHeight },
      geometry.obstaclePolygons,
      3,
      { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4500 }
    );
    if (!vaultPath || vaultPath.length === 0) {
      return { valid: false, reason: 'PATHFINDING_UNREACHABLE', entityId: goalEnt.id };
    }
  }

  // 5. Torch Visibility Reachability from hero standing positions
  const radius = torchRadius || settings.torchRadius;
  for (const ent of entities) {
    if (ent.isGatekeeper) {
      const isVert = (ent.collarBounds as OrientedBox | undefined)?.orientation === 'vertical';
      const offsets: Point2D[] = isVert
        ? [{ x: -9, y: 0 }, { x: 9, y: 0 }]
        : [{ x: 0, y: -9 }, { x: 0, y: 9 }];
      const visibleFromApproach = offsets.some(off => {
        const vantage: Point2D = { x: ent.x + off.x, y: ent.y + off.y };
        if (geometry.obstaclePolygons?.some(p => isPointInPolygon(vantage, p))) return false;
        const facePt: Point2D = { x: ent.x + off.x * 0.35, y: ent.y + off.y * 0.35 };
        if (Math.hypot(facePt.x - vantage.x, facePt.y - vantage.y) > radius * 0.95) return false;
        return !checkCollision(vantage, facePt, wallOnlySegments);
      });
      if (!visibleFromApproach) {
        return { valid: false, reason: 'GATEKEEPER_VISIBILITY_FAILED', entityId: ent.id };
      }
    } else {
      const poly = getVisibilityPolygon({ x: ent.x, y: ent.y }, wallOnlySegments, radius, 1);
      if (!poly || poly.length < 6) {
        return { valid: false, reason: 'ENTITY_VISIBILITY_FAILED', entityId: ent.id };
      }
    }
  }

  const difficulty = assessPuzzleDifficulty(startItems, entities, goalEntityId, levelStub, {
    solution,
    campPos,
    rowHeight: DEEP_CAVE_SLOT_HEIGHT
  });

  return { valid: true, solution, difficulty };
}
