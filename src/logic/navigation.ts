import { DEEP_CAVE_HERO_RADIUS } from '../constants.ts';
import type {
  CaveWallVertices,
  CollarBounds,
  LevelDefinition,
  ObstacleSegment,
  PathfindingOptions,
  PathHistoryPoint,
  Point2D,
  Waypoint
} from '../types/index.ts';
import { getCorridorBounds } from './geometry.ts';
import { findGlobalPath } from './pathfinding.ts';
import { isInShipwreckAirPocket } from '../levels/shipwreck/geometry.ts';

/**
 * Count unique values in an array.
 */
export const uniqueCount = <T>(arr: readonly T[]): number => new Set(arr).size;

/**
 * Compute waypoints for navigation between zones in the underground level.
 * Ensures the player moves through valid junction points when crossing
 * between left/right branches of the mine.
 */
export const computeWaypoints = (
  fromZone: number,
  toZone: number,
  startPos: Point2D | null = null,
  _endPos: Point2D | null = null
): Waypoint[] => {
  const waypoints: Waypoint[] = [];
  const leftZones = [2, 4];
  const rightZones = [3, 5];

  const leftX = 33;
  const rightX = 72;
  const topCrossingY = 10;    // Above pillar (visual range: y=20–76)
  const bottomCrossingY = 74; // Below pillar, but above rock_final_1

  const useTopY = (startPos && startPos.y > topCrossingY && startPos.y <= 20)
    ? startPos.y
    : topCrossingY;

  // Add corridor-centering waypoints to prevent clipping wall corners BEFORE crossing
  if (leftZones.includes(fromZone) && !leftZones.includes(toZone)) {
    waypoints.push({
      x: leftX,
      y: Math.max(fromZone, toZone) >= 6 ? bottomCrossingY : useTopY,
      depth: 3,
      zone: fromZone
    });
  } else if (rightZones.includes(fromZone) && !rightZones.includes(toZone)) {
    waypoints.push({
      x: rightX,
      y: Math.max(fromZone, toZone) >= 6 ? bottomCrossingY : useTopY,
      depth: 3,
      zone: fromZone
    });
  }

  // 1. Crossing between branches
  if (
    (leftZones.includes(fromZone) && rightZones.includes(toZone)) ||
    (rightZones.includes(fromZone) && leftZones.includes(toZone))
  ) {
    if (Math.max(fromZone, toZone) >= 6) {
      waypoints.push({ x: 50, y: bottomCrossingY, depth: 3, zone: 6 });
    } else {
      waypoints.push({ x: 50, y: useTopY, depth: 3, zone: 1 });
    }
  }
  // 2. Entering branches from top
  else if (fromZone === 1 && (leftZones.includes(toZone) || rightZones.includes(toZone))) {
    waypoints.push({ x: 50, y: useTopY, depth: 3, zone: 1 });
  }
  // 3. Exiting branches to top
  else if (toZone === 1 && (leftZones.includes(fromZone) || rightZones.includes(fromZone))) {
    waypoints.push({ x: 50, y: useTopY, depth: 3, zone: 1 });
  }
  // 4. Entering branches from bottom
  else if (fromZone >= 6 && (leftZones.includes(toZone) || rightZones.includes(toZone))) {
    waypoints.push({ x: 50, y: bottomCrossingY, depth: 3, zone: 6 });
  }
  // 5. Exiting branches to bottom
  else if (toZone >= 6 && (leftZones.includes(fromZone) || rightZones.includes(fromZone))) {
    waypoints.push({ x: 50, y: bottomCrossingY, depth: 3, zone: 6 });
  }

  // Add corridor-centering waypoints AFTER crossing
  if (leftZones.includes(toZone) && !leftZones.includes(fromZone)) {
    waypoints.push({
      x: leftX,
      y: Math.max(fromZone, toZone) >= 6 ? bottomCrossingY : useTopY,
      depth: 3,
      zone: toZone
    });
  } else if (rightZones.includes(toZone) && !rightZones.includes(fromZone)) {
    waypoints.push({
      x: rightX,
      y: Math.max(fromZone, toZone) >= 6 ? bottomCrossingY : useTopY,
      depth: 3,
      zone: toZone
    });
  }

  return waypoints;
};

/**
 * Infers which zone a clicked (x, y) coordinate belongs to for vertical/cave levels.
 */
export const inferTargetZone = (
  level: Pick<LevelDefinition, 'id' | 'mechanics'> | null | undefined,
  targetX: number,
  targetY: number,
  currentZone = 1
): number => {
  if (level?.mechanics?.useIsotropicCoords) {
    return currentZone;
  }
  if (level?.mechanics?.isCaveType) {
    if (targetY < 20) return 1;
    if (targetY < 45) return targetX < 50 ? 2 : 3;
    if (targetY < 68) return targetX < 50 ? 4 : 5;
    if (targetY < 83) return 6;
    if (targetY < 90) return 7;
    if (targetY < 95) return 8;
    return 9;
  }
  if (level?.id === 'underwater') {
    if (targetY < 46) return 1;
    if (targetY < 75) return 2;
    return 3;
  }
  if (level?.id === 'shipwreck') {
    if (isInShipwreckAirPocket(targetX, targetY)) return 5;
    if (targetX >= 66 && targetY > 33 && targetY <= 64) return 4;
    if (targetX >= 52 && targetX < 66 && targetY <= 74) return 3;
    if (targetX >= 28 && targetX < 54 && targetY <= 80) return 2;
    return 1;
  }
  return currentZone;
};

export interface ComputeNavigationPathParams {
  lastPos: PathHistoryPoint | undefined;
  targetX: number;
  targetY: number;
  targetZone: number;
  targetDepth?: number;
  isInteract?: boolean;
  occluderType?: string | null;
  collarBounds?: CollarBounds | null;
  isCaveType: boolean;
  useIsotropic: boolean;
  worldHeight: number;
  yScale: number;
  obstacleSegments: readonly ObstacleSegment[];
  obstaclePolygons: ReadonlyArray<readonly Point2D[]>;
  caveWallVertices?: CaveWallVertices | null;
}

const mapPathToWaypoints = (
  rawPath: readonly Point2D[],
  yScale: number,
  depth: number,
  zone: number
): Waypoint[] =>
  rawPath.map((p) => ({
    x: p.x,
    y: p.y / yScale,
    depth,
    zone
  }));

/**
 * Computes a walkable waypoint sequence from `lastPos` to `(targetX, targetY)`,
 * handling cave A* pathfinding, obstacle collar approach standoffs, and open-level hops.
 */
export const computeNavigationPath = ({
  lastPos,
  targetX,
  targetY,
  targetZone,
  targetDepth = 3,
  isInteract = false,
  occluderType = null,
  collarBounds = null,
  isCaveType,
  useIsotropic,
  worldHeight,
  yScale,
  obstacleSegments,
  obstaclePolygons,
  caveWallVertices
}: ComputeNavigationPathParams): Waypoint[] => {
  const depth = targetDepth || 3;

  if (isCaveType && lastPos) {
    const isCompact2DWorld = !useIsotropic && worldHeight <= 120;
    const res = useIsotropic ? 2.5 : (isCompact2DWorld ? 1.5 : 3);
    const pathOpts: PathfindingOptions = useIsotropic
      ? { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 25000, cornerClearance: 1.5 }
      : isCompact2DWorld
        ? { radius: 1.4, maxIters: 20000, cornerClearance: 0.9 }
        : {};
    const pathBounds = { width: 100, height: worldHeight };
    let finalTargetX = targetX;
    let finalTargetY = targetY;

    if (occluderType === 'rock' || occluderType === 'chasm' || occluderType === 'guardian') {
      let isAlreadyInRange = false;

      if (collarBounds) {
        if (collarBounds.orientation === 'vertical') {
          finalTargetY = Math.max(collarBounds.yTop + 3, Math.min(collarBounds.yBottom - 3, lastPos.y));
          const isLeft = lastPos.x <= targetX;
          finalTargetX = isLeft ? collarBounds.xLeft - 4.0 : collarBounds.xRight + 4.0;
          const yDist = Math.max(0, Math.max(collarBounds.yTop - lastPos.y, lastPos.y - collarBounds.yBottom));
          isAlreadyInRange = yDist <= 2 && Math.abs(lastPos.x - targetX) <= 7.0;
        } else {
          finalTargetX = Math.max(collarBounds.xLeft + 3, Math.min(collarBounds.xRight - 3, lastPos.x));
          const isAbove = lastPos.y <= targetY;
          finalTargetY = isAbove ? collarBounds.yTop - 4.0 : collarBounds.yBottom + 4.0;
          const xDist = Math.max(0, Math.max(collarBounds.xLeft - lastPos.x, lastPos.x - collarBounds.xRight));
          isAlreadyInRange = xDist <= 2 && Math.abs(lastPos.y - targetY) <= 7.0;
        }
      } else {
        const bounds = getCorridorBounds(targetY, caveWallVertices ?? undefined, targetX >= 50);
        finalTargetX = Math.max(bounds.xLeft + 3, Math.min(bounds.xRight - 3, lastPos.x));
        const isAbove = lastPos.y <= targetY;
        finalTargetY = isAbove ? targetY - 1.5 - 1.2 : targetY + 1.5 + 1.2;

        const xDist = Math.max(0, Math.max(bounds.xLeft - lastPos.x, lastPos.x - bounds.xRight));
        const yDist = Math.abs(lastPos.y - targetY);
        isAlreadyInRange = xDist <= 2 && yDist <= 3.8;
      }

      const rawPath = findGlobalPath(
        { x: lastPos.x, y: lastPos.y * yScale },
        { x: finalTargetX, y: finalTargetY * yScale },
        obstacleSegments,
        pathBounds,
        obstaclePolygons,
        res,
        pathOpts
      );

      if (rawPath.length > 0) {
        return mapPathToWaypoints(rawPath, yScale, depth, targetZone);
      }
      if (isAlreadyInRange) {
        return [{ x: lastPos.x, y: lastPos.y, depth, zone: targetZone }];
      }
      return [];
    }

    if (isInteract) {
      const stopOffset = useIsotropic ? DEEP_CAVE_HERO_RADIUS + 1.5 : 3.5;
      const dx = finalTargetX - lastPos.x;
      const dy = finalTargetY - lastPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > stopOffset) {
        finalTargetX = finalTargetX - (dx / dist) * stopOffset;
        finalTargetY = finalTargetY - (dy / dist) * stopOffset;
      } else if (dist > 0) {
        finalTargetX = lastPos.x;
        finalTargetY = lastPos.y;
      }
    }

    const rawPath = findGlobalPath(
      { x: lastPos.x, y: lastPos.y * yScale },
      { x: finalTargetX, y: finalTargetY * yScale },
      obstacleSegments,
      pathBounds,
      obstaclePolygons,
      res,
      pathOpts
    );

    return mapPathToWaypoints(rawPath, yScale, depth, targetZone);
  }

  const waypoints = computeWaypoints(lastPos?.zone || 1, targetZone);
  const path = waypoints.map((wp) => ({ x: wp.x, y: wp.y, depth, zone: wp.zone }));

  let finalX = targetX;
  let finalY = targetY;

  if (isInteract) {
    const prevPoint = path.length > 0 ? path[path.length - 1] : lastPos;
    if (prevPoint) {
      const dx = finalX - prevPoint.x;
      const dy = finalY - prevPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        finalX = finalX - (dx / dist) * 3.5;
        finalY = finalY - (dy / dist) * 3.5;
      }
    }
  }

  return [{ x: finalX, y: finalY, depth, zone: targetZone }];
};
