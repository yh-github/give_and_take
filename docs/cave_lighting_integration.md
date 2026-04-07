# Integration Plan: Raycasted Cave Lighting

This plan outlines the steps to integrate the high-fidelity raycasting visibility system into "The Cave" (Underground) level of **Give and Take**. This replaces the current "glass pane" style darkness with dynamic, obstacle-aware light propagation.

## User Review Required

> [!IMPORTANT]
> **Hook Order & Order of Execution**: The `useMemo` for the visibility polygon calculation must be placed at the top of the `GameInstance` component (before early returns) to avoid React Hook violations.
> **Performance**: The raycaster runs on every frame where the player moves. We use `useMemo` to ensure it only recalculates when necessary.

## Proposed Changes

---

### Core Logic

#### [MODIFY] [visibility.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/visibility.js)
The visibility engine is already implemented. It provides:
- `getVisibilityPolygon`: The main API for calculating points.
- `getObstacleSegments`: Logic to convert map nodes and cave walls into line segments.
- `castRays`: The core intersection engine.

---

### UI Components

#### [MODIFY] [CaveVisibility.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/levels/underground/CaveVisibility.jsx)
This component renders the SVG-based darkness layer.
- **Masking**: Uses an SVG mask to create a "hole" in the darkness where the torch light is.
- **Blur**: Applies a `feGaussianBlur` to soften the shadow edges.
- **Gradients**: Can be enhanced with a `radialGradient` to create a "torch falloff" effect.

---

### Main Application Integration

#### [MODIFY] [index.jsx](file:///home/yoavh/code/antigravity/give_and_take/index.jsx)

Integration requires adding the following to the `GameInstance` component:

1. **Imports**:
   ```javascript
   import CaveVisibility from './src/levels/underground/CaveVisibility.jsx';
   import { getVisibilityPolygon } from './src/logic/visibility.js';
   import { CAVE_WALL_VERTICES } from './src/levels/underground/components.jsx';
   ```

2. **State/Memo (Top of Component)**:
   ```javascript
   const polyPoints = useMemo(() => {
     if (!puzzle || !level.mechanics.hasDarkness || level.mechanics.darknessType !== 'radial' || !displayPlayerPos) return null;
     return getVisibilityPolygon(displayPlayerPos, puzzle.nodes, CAVE_WALL_VERTICES, unlockedZones, defeated, 28, level.mechanics.screens || 1);
   }, [displayPlayerPos.x, displayPlayerPos.y, puzzle?.nodes, unlockedZones, defeated, level.mechanics.hasDarkness, level.mechanics.darknessType]);
   ```

3. **Rendering (Underground Background Layer)**:
   Add the `CaveVisibility` component immediately after the `Background` layer in the JSX return.

---

## Verification Plan

### Automated Tests
- **POC Validation**: Use `src/POC_Visibility.jsx` to verify raycasting logic in isolation (already verified in POC).
- **Node.js Check**: Run `node -c` on logic files to ensure no syntax errors.

### Manual Verification
- **Visual Check**: Run the game and enter "The Cave". Confirm that rocks and walls block the light.
- **Motion Check**: Confirm that moving the hero updates the light cone in real-time.
- **Inversion Check**: Ensure "Spread Light" mode is active (torch illuminates the darkness).

## Open Questions

> [!NOTE]
> **Secondary Lights?** Should we support static lights (e.g., campfires) using the same system? The engine supports multiple origins but the current UI only renders one.
> **Smoothness vs. Performance**: Currently using 3 rays per vertex. Increasing this adds fidelity but may impact low-end devices.
