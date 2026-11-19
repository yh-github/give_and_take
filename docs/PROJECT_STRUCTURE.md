# Project Structure: Give and Take

Welcome to the **Give and Take** project. This document provides a high-level overview of the codebase, its organization, and the purpose of key files.

## 📁 Root Directory

The root contains the project's TypeScript/Vite configuration and high-level React entry points.

- [index.html](file:///home/yoavh/code/antigravity/give_and_take/index.html): The HTML shell for the application (mounts `/main.tsx`).
- [index.tsx](file:///home/yoavh/code/antigravity/give_and_take/index.tsx): The top-level React shell managing level selection, resume autosave prompts, language/difficulty settings, and mounting [`GameInstance`](file:///home/yoavh/code/antigravity/give_and_take/src/components/GameInstance.tsx) inside an [`ErrorBoundary`](file:///home/yoavh/code/antigravity/give_and_take/src/components/ErrorBoundary.tsx).
- [main.tsx](file:///home/yoavh/code/antigravity/give_and_take/main.tsx): React initialization and mounting point.
- [index.css](file:///home/yoavh/code/antigravity/give_and_take/index.css): Global Tailwind and CSS styles.
- [tsconfig.json](file:///home/yoavh/code/antigravity/give_and_take/tsconfig.json): Strict TypeScript compiler configuration (`strict: true`, `noEmit: true`, bundler resolution).
- [tailwind.config.js](file:///home/yoavh/code/antigravity/give_and_take/tailwind.config.js): Tailwind CSS configuration.
- [vite.config.js](file:///home/yoavh/code/antigravity/give_and_take/vite.config.js): Vite build and Vitest test configuration.

## 📂 `src/` - Application Source

All source files under `src/` are written in TypeScript (`.ts` / `.tsx`).

- [animations.css](file:///home/yoavh/code/antigravity/give_and_take/src/animations.css): Core CSS keyframe animations for characters and environmental effects.
- [constants.ts](file:///home/yoavh/code/antigravity/give_and_take/src/constants.ts): Global gameplay constants (maximum inventory capacity, air limits, animation timings, reserved/start item sets).
- [strings.ts](file:///home/yoavh/code/antigravity/give_and_take/src/strings.ts): Strongly typed internationalization (i18n) dictionaries for English (`en`) and Hebrew (`he`).
- [vite-env.d.ts](file:///home/yoavh/code/antigravity/give_and_take/src/vite-env.d.ts): Vite client ambient type references (CSS module imports and client globals).

### 📐 `src/types/` - Shared Domain Types

Focused domain type modules re-exported through [index.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/index.ts) (and [game.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/game.ts)):

- [geometry.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/geometry.ts): 2D coordinates, obstacle segments, collar/corridor bounds, procedural boulder meshes, and pathfinding options.
- [entities.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/entities.ts): Items, entity templates, map nodes, abstract/placed puzzle entities, trade evaluation, and spacing diagnostics.
- [level.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/level.ts): `LevelDefinition`, `LevelMechanics`, `DeepCaveSettings`, `PuzzleData`, solver types, and `LevelRegistry`.
- [deepCave.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/deepCave.ts): Procedural dungeon slots, doorway collars, contour loops, encounter modules, blueprint/mission-graph contracts, and Web Worker payloads.
- [save.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/save.ts): Save/autosave payloads, lighting settings, serialized history snapshots, and import/export validation results.
- [i18n.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/i18n.ts): Language codes and translation dictionary interfaces.
- [ui.ts](file:///home/yoavh/code/antigravity/give_and_take/src/types/ui.ts): Shared React component prop types and UI effect/animation state models.

### 🧩 `src/components/`

Modular TypeScript React UI and gameplay components:

- [GameInstance.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/GameInstance.tsx): Active level session controller managing game state, pathfinding orchestration, entity interactions, timers, and undo history.
- [WorldViewport.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/WorldViewport.tsx): Renders the scrollable world canvas, camp, roaming entities, visibility mask, and puzzle entities.
- [GameEntity.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/GameEntity.tsx): Renders individual puzzle entities, trade requirement speech bubbles, digger/clam memory states, and gatekeepers.
- [Hero.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/Hero.tsx): Renders the player avatar, status indicators, and movement transitions.
- [InventoryBar.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/InventoryBar.tsx): Renders the 4-slot bottom inventory bar with item counts, selection state, and undo button.
- [TopBar.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/TopBar.tsx), [AirIndicator.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/AirIndicator.tsx) & [GameMenu.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/GameMenu.tsx): Top status controls, underwater air meter, and pause/configuration/lighting/import-export modals.
- [EffectsOverlay.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/EffectsOverlay.tsx), [DebugRays.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/DebugRays.tsx) & [LevelEditorOverlay.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/LevelEditorOverlay.tsx): Visual effects, raycast debug visualization, and interactive map node editor.
- [ErrorBoundary.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/ErrorBoundary.tsx): React error boundary to catch and display runtime errors gracefully.

### 📍 `src/levels/` - Level Plugin Architecture

This project uses a modular level system. Each level lives in its own subdirectory and is registered in [src/levels/index.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/index.ts) (`LEVEL_REGISTRY`).

Standard level directories (`river_crossing`, `underground`, `underwater`) contain:
- `index.ts`: The `LevelDefinition` configuration object (ID, names, mechanics flags, and links to components).
- `data.ts`: Definitions for items, entities (traders, obstacles), and map nodes (plus `mapNodes.json` for `underground`, and `CaveVisibility.tsx` for dynamic SVG darkness masking).
- `components.tsx`: Custom SVG-based visual components specific to that level's theme.
- `generator.ts` *(optional)*: Custom level generator override when a level uses specialized quest topology (e.g., `underwater`).

#### 🕳️ `src/levels/deep_cave/` - Procedural Isotropic Cavern Pipeline

`deep_cave` extends the standard layout with a staged procedural generator and background Web Worker:
- [index.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/index.ts), [data.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/data.ts), [presets.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/presets.ts), [components.tsx](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/components.tsx): Level definition, difficulty presets/knobs, and contextual cliff/boulder/chasm SVGs.
- [slotGrid.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/slotGrid.ts) & [contouring.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/contouring.ts): Slot-grid carving, encounter stamping, rasterization, and marching-squares wall contour extraction.
- [spaceBlueprint.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/spaceBlueprint.ts) -> [missionGraph.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/missionGraph.ts) -> [placementAndVerify.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/placementAndVerify.ts) -> [generator.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/generator.ts): Stage-by-stage procedural space carving, reverse-walk quest graph synthesis, entity placement & verification, and top-level orchestrator.
- `encounters/`: Self-contained set-piece encounter modules ([schema.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/encounters/schema.ts), [index.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/encounters/index.ts), `guardian_lair.ts`, `mushroom_grotto.ts`, `rope_chasm_bridge.ts`).
- [seedBank.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/seedBank.ts), [worker.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/worker.ts) & [workerClient.ts](file:///home/yoavh/code/antigravity/give_and_take/src/levels/deep_cave/workerClient.ts): Curated preset seeds and async Web Worker generation with timeout cancellation.

### 🧠 `src/logic/` - Core Game Systems

- [rules.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/rules.ts): Single source of truth for inventory slot capacity (`canFitInInventory`), trade requirement evaluation (`evaluateEntityTrade`), and zone unlocking (`computeUnlockedZones`).
- [rng.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/rng.ts): Seeded deterministic PRNG (`createRNG`), unbiased Fisher-Yates `shuffle`, and drought-free `createShuffleBag`.
- [generator.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/generator.ts): Procedural level generator. Creates logical quest chains and verifies solvability against the BFS solver.
- [solver.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/solver.ts): Breadth-First Search (BFS) state-space solver. Verifies that every generated level is beatable and powers the "Show Solution" feature.
- [navigation.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/navigation.ts) & [pathfinding.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/pathfinding.ts): Zone waypoint calculation, high-level navigation orchestration (`computeNavigationPath`), and 2D A* grid pathfinding with corner-clearance string-pulling.
- [visibility.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/visibility.ts) & [geometry.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/geometry.ts): 2D raycasting visibility polygon calculation, visible-entity evaluation (`computeVisibleEntitiesSet`), obstacle segment generation, and procedural 3D boulder geometry.
- [saveState.ts](file:///home/yoavh/code/antigravity/give_and_take/src/logic/saveState.ts): Versioned autosave persistence, save payload creation/validation, and JSON import/export helpers.

## 📖 `docs/` - Documentation & Backlogs

- [backlog_underwater.md](file:///home/yoavh/code/antigravity/give_and_take/docs/backlog_underwater.md): Notes and planned features for the project.
- [PROJECT_STRUCTURE.md](file:///home/yoavh/code/antigravity/give_and_take/docs/PROJECT_STRUCTURE.md): (This file) Documentation of the codebase.

---

> [!TIP]
> To add a new level:
> 1. Create a `src/levels/new_level/` directory with `data.ts` and `components.tsx`.
> 2. Define the typed `LevelDefinition` object in `src/levels/new_level/index.ts`.
> 3. Register it in `src/levels/index.ts`.
