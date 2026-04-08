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
 * @returns {Array<{x: number, y: number, depth: number, zone: number}>}
 */
export const computeWaypoints = (fromZone, toZone) => {
  let waypoints = [];
  const leftZones = [2, 4];
  const rightZones = [3, 5];
  const bottomZones = [6, 7, 8, 9];

  const leftX = 33;
  const rightX = 72;
  const topCrossingY = 10;    // Above pillar (visual range: y=20–76)
  const bottomCrossingY = 80; // Below pillar

  // 1. Crossing between branches
  if ((leftZones.includes(fromZone) && rightZones.includes(toZone)) ||
      (rightZones.includes(fromZone) && leftZones.includes(toZone))) {
      // Choose crossing based on depth
      if (Math.max(fromZone, toZone) >= 6) {
          waypoints.push({ x: 50, y: bottomCrossingY, depth: 3, zone: 6 });
      } else {
          waypoints.push({ x: 50, y: topCrossingY, depth: 3, zone: 1 });
      }
  } 
  // 2. Entering branches from top
  else if (fromZone === 1 && (leftZones.includes(toZone) || rightZones.includes(toZone))) {
      waypoints.push({ x: 50, y: topCrossingY, depth: 3, zone: 1 });
  } 
  // 3. Exiting branches to top
  else if (toZone === 1 && (leftZones.includes(fromZone) || rightZones.includes(fromZone))) {
      waypoints.push({ x: 50, y: topCrossingY, depth: 3, zone: 1 });
  } 
  // 4. Entering branches from bottom
  else if (fromZone >= 6 && (leftZones.includes(toZone) || rightZones.includes(toZone))) {
      waypoints.push({ x: 50, y: bottomCrossingY, depth: 3, zone: 6 });
  } 
  // 5. Exiting branches to bottom
  else if (toZone >= 6 && (leftZones.includes(fromZone) || rightZones.includes(fromZone))) {
      waypoints.push({ x: 50, y: bottomCrossingY, depth: 3, zone: 6 });
  }

  // Add corridor-centering waypoints to prevent clipping wall corners
  if (leftZones.includes(toZone) || (toZone >= 6 && leftZones.includes(fromZone))) {
      waypoints.push({ x: leftX, y: waypoints.length > 0 ? waypoints[waypoints.length-1].y : 20, depth: 3, zone: toZone });
  } else if (rightZones.includes(toZone) || (toZone >= 6 && rightZones.includes(fromZone))) {
      waypoints.push({ x: rightX, y: waypoints.length > 0 ? waypoints[waypoints.length-1].y : 20, depth: 3, zone: toZone });
  }

  return waypoints;
};
