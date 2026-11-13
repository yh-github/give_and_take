/**
 * Count unique values in an array.
 * @param {Array} arr
 * @returns {number}
 */
export const uniqueCount = (arr) => new Set(arr).size;

/**
 * Compute waypoints for navigation between zones in the underground level.
 * Ensures the player moves through valid junction points when crossing
 * between left/right branches of the mine.
 * 
 * @param {number} fromZone
 * @param {number} toZone
 * @param {Object} [startPos] {x, y}
 * @param {Object} [endPos] {x, y}
 * @returns {Array<{x: number, y: number, depth: number, zone: number}>}
 */
export const computeWaypoints = (fromZone, toZone, startPos = null, endPos = null) => {
  let waypoints = [];
  const leftZones = [2, 4];
  const rightZones = [3, 5];

  const leftX = 33;
  const rightX = 72;
  const topCrossingY = 10;    // Above pillar (visual range: y=20–76)
  const bottomCrossingY = 74; // Below pillar, but above rock_final_1

  const useTopY = (startPos && startPos.y > topCrossingY && startPos.y <= 20) ? startPos.y : topCrossingY;

  // Add corridor-centering waypoints to prevent clipping wall corners BEFORE crossing
  if (leftZones.includes(fromZone) && !leftZones.includes(toZone)) {
      waypoints.push({ x: leftX, y: Math.max(fromZone, toZone) >= 6 ? bottomCrossingY : useTopY, depth: 3, zone: fromZone });
  } else if (rightZones.includes(fromZone) && !rightZones.includes(toZone)) {
      waypoints.push({ x: rightX, y: Math.max(fromZone, toZone) >= 6 ? bottomCrossingY : useTopY, depth: 3, zone: fromZone });
  }

  // 1. Crossing between branches
  if ((leftZones.includes(fromZone) && rightZones.includes(toZone)) ||
      (rightZones.includes(fromZone) && leftZones.includes(toZone))) {
      // Choose crossing based on depth
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
      waypoints.push({ x: leftX, y: Math.max(fromZone, toZone) >= 6 ? bottomCrossingY : useTopY, depth: 3, zone: toZone });
  } else if (rightZones.includes(toZone) && !rightZones.includes(fromZone)) {
      waypoints.push({ x: rightX, y: Math.max(fromZone, toZone) >= 6 ? bottomCrossingY : useTopY, depth: 3, zone: toZone });
  }

  return waypoints;
};

/**
 * Infers which zone a clicked (x, y) coordinate belongs to for vertical/cave levels.
 *
 * @param {Object} level
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} [currentZone=1]
 * @returns {number}
 */
export const inferTargetZone = (level, targetX, targetY, currentZone = 1) => {
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
  return currentZone;
};


