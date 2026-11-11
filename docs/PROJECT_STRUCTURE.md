# Project Structure: Give and Take

Welcome to the **Give and Take** project. This document provides a high-level overview of the codebase, its organization, and the purpose of key files.

## 📁 Root Directory

The root contains the project's configuration and high-level React entry points.

- [index.html](file:///home/yoavh/code/antigravity/give_and_take/index.html): The HTML shell for the application.
- [index.jsx](file:///home/yoavh/code/antigravity/give_and_take/index.jsx): The top-level React shell managing level selection, language/difficulty settings, and mounting [`GameInstance`](file:///home/yoavh/code/antigravity/give_and_take/src/components/GameInstance.jsx) inside an [`ErrorBoundary`](file:///home/yoavh/code/antigravity/give_and_take/src/components/ErrorBoundary.jsx).
- [main.jsx](file:///home/yoavh/code/antigravity/give_and_take/main.jsx): React initialization and mounting point.
- [index.css](file:///home/yoavh/code/antigravity/give_and_take/index.css): Global Tailwind and CSS styles.
- [tailwind.config.js](file:///home/yoavh/code/antigravity/give_and_take/tailwind.config.js): Tailwind CSS configurations.
- [vite.config.js](file:///home/yoavh/code/antigravity/give_and_take/vite.config.js): Vite build tool configuration.

## 📂 `src/` - Application Source

The logic and assets are modularized within the `src/` directory.

- [animations.css](file:///home/yoavh/code/antigravity/give_and_take/src/animations.css): Contains the core CSS keyframe animations for characters and environmental effects.
- [constants.js](file:///home/yoavh/code/antigravity/give_and_take/src/constants.js): Global gameplay constants (e.g., maximum inventory size, fuel/air limits, animation timings).
- [strings.js](file:///home/yoavh/code/antigravity/give_and_take/src/strings.js): Internationalization (i18n) support for English and Hebrew.

### 🧩 `src/components/`

Modular UI and gameplay components.
- [GameInstance.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/GameInstance.jsx): Active level session controller managing game state, pathfinding orchestration, entity interactions, timers, and undo history.
- [WorldViewport.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/WorldViewport.jsx): Renders the scrollable world canvas, camp, roaming entities, and puzzle entities.
- [GameEntity.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/GameEntity.jsx): Renders individual puzzle entities, trade requirement speech bubbles, digger/clam memory states, and gatekeepers.
- [Hero.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/Hero.jsx): Renders the player avatar, status indicators, and movement transitions.
- [InventoryBar.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/InventoryBar.jsx): Renders the 4-slot bottom inventory bar with item counts, selection state, and undo button.
- [TopBar.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/TopBar.jsx), [AirIndicator.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/AirIndicator.jsx) & [GameMenu.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/GameMenu.jsx): Top status controls, underwater air meter, and pause/configuration/lighting modals.
- [EffectsOverlay.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/EffectsOverlay.jsx), [DebugRays.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/DebugRays.jsx) & [LevelEditorOverlay.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/LevelEditorOverlay.jsx): Visual effects, raycast debug visualization, and interactive map node editor.
- [ErrorBoundary.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/ErrorBoundary.jsx): A standard React error boundary to catch and display runtime errors gracefully.

### 📍 `src/levels/` - Level Plugin Architecture

This project uses a modular level system. Each level is defined in its own subdirectory and registered in the central `index.js`.

- [index.js](file:///home/yoavh/code/antigravity/give_and_take/src/levels/index.js): The central registry (`LEVEL_REGISTRY`). Levels must be imported and added here to appear in the game menu.

Each level directory (`river_crossing`, `underground`, `underwater`) typically contains:
- `index.js`: The level configuration object (ID, names, mechanics settings, and links to components).
- `data.js`: Definitions for items, entities (traders, obstacles), and map nodes.
- `components.jsx`: Custom SVG-based visual components specific to that level's theme.
- `generator.js` *(optional)*: Custom level generator override when a level uses specialized quest topology (e.g., `underwater`).

### 🧠 `src/logic/` - Core Game Systems

- [rules.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/rules.js): Single source of truth for inventory slot capacity (`canFitInInventory`), trade requirement evaluation (`evaluateEntityTrade`), and zone unlocking (`computeUnlockedZones`).
- [rng.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/rng.js): Seeded deterministic PRNG (`createRNG`), unbiased Fisher-Yates `shuffle`, and drought-free `createShuffleBag`.
- [generator.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/generator.js): Procedural level generator. Creates logical quest chains and verifies solvability against the BFS solver.
- [solver.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/solver.js): Breadth-First Search (BFS) state-space solver. Verifies that every generated level is beatable and powers the "Show Solution" feature.
- [navigation.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/navigation.js) & [pathfinding.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/pathfinding.js): Waypoint navigation and 2D A* grid pathfinding with corner-clearance string-pulling.
- [visibility.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/visibility.js) & [geometry.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/geometry.js): 2D raycasting visibility polygon calculation, obstacle segment generation, and procedural 3D boulder geometry.

## 📖 `docs/` - Documentation & Backlogs

- [backlog_underwater.md](file:///home/yoavh/code/antigravity/give_and_take/docs/backlog_underwater.md): Notes and planned features for the project.
- [PROJECT_STRUCTURE.md](file:///home/yoavh/code/antigravity/give_and_take/docs/PROJECT_STRUCTURE.md): (This file) Documentation of the codebase.

---

> [!TIP]
> To add a new level:
> 1. Create a `src/levels/new_level/` directory with `data.js` and `components.jsx`.
> 2. Define the level object in `src/levels/new_level/index.js`.
> 3. Register it in `src/levels/index.js`.
