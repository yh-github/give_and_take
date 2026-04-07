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

  if ((leftZones.includes(fromZone) && rightZones.includes(toZone)) ||
      (rightZones.includes(fromZone) && leftZones.includes(toZone))) {
      if (Math.max(fromZone, toZone) >= 6) waypoints.push({ x: 50, y: 76, depth: 3, zone: 6 });
      else waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
  } else if (fromZone === 1 && (leftZones.includes(toZone) || rightZones.includes(toZone))) {
      waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
  } else if (toZone === 1 && (leftZones.includes(fromZone) || rightZones.includes(fromZone))) {
      waypoints.push({ x: 50, y: 18, depth: 3, zone: 1 });
  } else if (fromZone >= 6 && (leftZones.includes(toZone) || rightZones.includes(toZone))) {
      waypoints.push({ x: 50, y: 76, depth: 3, zone: 6 });
  } else if (toZone >= 6 && (leftZones.includes(fromZone) || rightZones.includes(fromZone))) {
      waypoints.push({ x: 50, y: 76, depth: 3, zone: 6 });
  }
  return waypoints;
};
