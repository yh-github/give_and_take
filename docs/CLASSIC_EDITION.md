# Classic Edition (River Crossing)

This repository preserves a frozen snapshot of the **Classic River Crossing** game — with the original emoji graphics and the dotted movement path line — so future visual/gameplay updates to the main game never alter or break it.

## How It Is Preserved

1. **Frozen Static Build (`public/classic/`)**:
   - Built as a standalone, self-contained bundle under [`public/classic/`](../public/classic/index.html) locked to the `river_crossing` realm with original emojis (`SPRITE_REGISTRY` cleared) and the dotted path trail intact.
   - Accessible from the main game via **Menu → Classic Edition (River Crossing)** (`./classic/`).
   - **Protected from routine updates:** Do not overwrite `public/classic/` during normal main-game feature work or sprite migrations.
2. **Git Tag (`classic-v1`)**:
   - Tagged in git at the exact commit before modern sprite/gameplay changes began (`git checkout classic-v1`), ensuring the original source code is permanently recoverable.

---

## Personal Note

<!-- Add your note here about why this Classic version is personally important to you. -->
