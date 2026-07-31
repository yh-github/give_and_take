import { describe, it, expect } from 'vitest';
import { findGlobalPath } from './src/logic/pathfinding.js';
import { computeWaypoints } from './src/logic/navigation.js';
import { generateLevelPuzzle } from './src/logic/generator.js';
import { isPointInVisibilityPolygon } from './src/logic/visibility.js';

describe('Pathfinding', () => {
    it('does not early return when there are only polygons but no segments', () => {
        const start = { x: 0, y: 0 };
        const end = { x: 30, y: 30 };
        const polygons = [[
            {x: 10, y: -10}, {x: 15, y: -10}, {x: 15, y: 25}, {x: 10, y: 25}
        ]];
        const path = findGlobalPath(start, end, [], {width: 100, height: 100}, polygons, 3);
        expect(path.length).toBeGreaterThan(1);
    });

    it('returns empty array when target is unreachable or path is too complex', () => {
        const start = { x: 0, y: 0 };
        const end = { x: 50, y: 50 };
        // Create an enclosing box around start
        const segments = [
            { a: { x: -5, y: -5 }, b: { x: 10, y: -5 } },
            { a: { x: 10, y: -5 }, b: { x: 10, y: 10 } },
            { a: { x: 10, y: 10 }, b: { x: -5, y: 10 } },
            { a: { x: -5, y: 10 }, b: { x: -5, y: -5 } }
        ];
        const path = findGlobalPath(start, end, segments, {width: 100, height: 100}, [], 3);
        expect(path).toEqual([]); // Should fail and return empty array
    });
});

describe('Visibility', () => {
    it('correctly identifies if a point is within a visibility polygon', () => {
        const poly = [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 10, y: 10},
            {x: 0, y: 10}
        ];
        expect(isPointInVisibilityPolygon({x: 5, y: 5}, poly)).toBe(true);
        expect(isPointInVisibilityPolygon({x: 15, y: 5}, poly)).toBe(false);
        expect(isPointInVisibilityPolygon({x: -1, y: 5}, poly)).toBe(false);
    });
});

describe('Navigation', () => {
    it('orders waypoints correctly when exiting a branch', () => {
        const waypoints = computeWaypoints(2, 6);
        expect(waypoints.length).toBe(2);
        expect(waypoints[0].x).toBe(33);
        expect(waypoints[1].x).toBe(50);
    });

    it('orders waypoints correctly when entering a branch', () => {
        const waypoints = computeWaypoints(6, 2);
        expect(waypoints.length).toBe(2);
        expect(waypoints[0].x).toBe(50);
        expect(waypoints[1].x).toBe(33);
    });
});

describe('Generator', () => {
    it('deletes unused entities that are not part of the solution', () => {
        const level = {
            id: 'test',
            mechanics: { hasPickaxe: false },
            mapNodes: [
                { id: 'goal', x: 0, y: 0, zone: 1, isGoal: true },
                { id: 'random_node', x: 10, y: 0, zone: 1 } // Not a gatekeeper, will become a random merchant
            ],
            entities: [
                { id: 'goal', allowedReqs: ['a'] },
                { id: 'merchant', allowedReqs: ['b'] }
            ],
            items: [{id: 'a'}, {id: 'b'}],
            specialEntityTemplate: 'merchant'
        };

        const puzzle = generateLevelPuzzle(level, 0, 1);
        
        // Ensure the unused merchant is NOT in the final puzzle
        // The solver can solve it immediately using 'goal' and doesn't need the merchant
        const unused = puzzle.puzzleEntities.find(e => e.id.startsWith('merchant_'));
        expect(unused).toBeUndefined();
    });
});
