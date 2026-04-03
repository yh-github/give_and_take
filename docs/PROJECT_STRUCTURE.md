# Project Structure: Give and Take

Welcome to the **Give and Take** project. This document provides a high-level overview of the codebase, its organization, and the purpose of key files.

## 📁 Root Directory

The root contains the project's configuration and high-level React entry points.

- [index.html](file:///home/yoavh/code/antigravity/give_and_take/index.html): The HTML shell for the application.
- [index.jsx](file:///home/yoavh/code/antigravity/give_and_take/index.jsx): The **core monolithic component**. It handles the entire game state, main UI loops, user interactions (trading, navigation, animations), and high-level level management.
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

Shared UI components used across the game.
- [ErrorBoundary.jsx](file:///home/yoavh/code/antigravity/give_and_take/src/components/ErrorBoundary.jsx): A standard React error boundary to catch and display runtime errors gracefully.

### 📍 `src/levels/` - Level Plugin Architecture

This project uses a modular level system. Each level is defined in its own subdirectory and registered in the central `index.js`.

- [index.js](file:///home/yoavh/code/antigravity/give_and_take/src/levels/index.js): The central registry. Levels must be imported and added here to appear in the game menu.

Each level directory (e.g., `river_crossing`, `underwater`) typically contains:
- `index.js`: The level configuration object (ID, names, mechanics settings, and links to components).
- `data.js`: Definitions for items, entities (traders, obstacles), and map nodes.
- `components.jsx`: Custom SVG-based visual components specific to that level's theme.

### 🧠 `src/logic/` - Core Game Systems

- [generator.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/generator.js): Procedural level generator. It creates logical quest chains and ensures the map is balanced based on difficulty.
- [solver.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/solver.js): A Breadth-First Search (BFS) solver. It verifies that every generated level is beatable and powers the "Show Solution" feature.
- [navigation.js](file:///home/yoavh/code/antigravity/give_and_take/src/logic/navigation.js): Pathfinding and waypoint logic for moving the hero across the map's zones and nodes.

## 📖 `docs/` - Documentation & Backlogs

- [backlog_underwater.md](file:///home/yoavh/code/antigravity/give_and_take/docs/backlog_underwater.md): Notes and planned features for the project.
- [PROJECT_STRUCTURE.md](file:///home/yoavh/code/antigravity/give_and_take/docs/PROJECT_STRUCTURE.md): (This file) Documentation of the codebase.

---

> [!TIP]
> To add a new level:
> 1. Create a `src/levels/new_level/` directory with `data.js` and `components.jsx`.
> 2. Define the level object in `src/levels/new_level/index.js`.
> 3. Register it in `src/levels/index.js`.
