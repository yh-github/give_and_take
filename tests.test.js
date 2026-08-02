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
    it('preserves red-herring entities on available map nodes', () => {
        const level = {
            id: 'test',
            mechanics: { hasPickaxe: false },
            mapNodes: [
                { id: 'goal', x: 0, y: 0, zone: 1, isGoal: true },
                { id: 'random_node', x: 10, y: 0, zone: 1 } // Not a gatekeeper, becomes a merchant
            ],
            entities: [
                { id: 'goal', allowedReqs: ['a'] },
                { id: 'merchant', allowedReqs: ['b'] }
            ],
            items: [{id: 'a'}, {id: 'b'}],
            specialEntityTemplate: 'merchant'
        };

        const puzzle = generateLevelPuzzle(level, 0, 1);
        
        // Ensure the merchant (even if not strictly needed by shortest path) is preserved as a red herring / trade option
        const unused = puzzle.puzzleEntities.find(e => e.id.startsWith('merchant_'));
        expect(unused).toBeDefined();
    });
});

describe('Underground Level', () => {
    it('dynamically generates obstacle segments based on node coordinates', async () => {
        const underground = (await import('./src/levels/underground/index.js')).default;
        
        const puzzleEntities = [
            { id: 'test_rock', isGatekeeper: true, x: 68, y: 67.3 }
        ];
        
        const segments = underground.getObstacleSegments(puzzleEntities, [], [], 2.5);
        
        // Find the segments for the rock (should be exactly 4 segments making a rectangle)
        // Min X = 68 - 20 = 48
        // Max X = 68 + 20 = 88
        const rockSegs = segments.filter(s => 
            (s.a.x === 48 || s.a.x === 88)
        );
        
        expect(rockSegs.length).toBeGreaterThanOrEqual(4);
    });
});
