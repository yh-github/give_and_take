// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../index.jsx';
import STRINGS from '../src/strings.js';
import LEVEL_REGISTRY from '../src/levels/index.js';
import InventoryBar from '../src/components/InventoryBar.jsx';
import GameEntity from '../src/components/GameEntity.jsx';
import { SpriteIcon, SvgEmbeddedSprite } from '../src/components/sprites/SpriteIcon.tsx';

describe('GUI Component & Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders App without crashing and shows initial generating/loaded state', async () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Advance past puzzle generation timer (150ms)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Language buttons should be visible
    expect(screen.getByText('🇮🇱')).toBeDefined();
    expect(screen.getByText('🇺🇸')).toBeDefined();
    // Gear settings button should be visible
    expect(screen.getByText('⚙️')).toBeDefined();
  });

  it('toggles language between Hebrew and English and updates dictionary', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const enBtn = screen.getByText('🇺🇸');
    const heBtn = screen.getByText('🇮🇱');

    // Switch to English
    await act(async () => {
      fireEvent.click(enBtn);
    });

    // Open menu
    const gearBtn = screen.getByText('⚙️');
    await act(async () => {
      fireEvent.click(gearBtn);
    });

    expect(screen.getByText(STRINGS.en.menu)).toBeDefined();
    expect(screen.getByText(STRINGS.en.restart)).toBeDefined();

    // Switch to Hebrew
    await act(async () => {
      fireEvent.click(heBtn);
    });

    expect(screen.getByText(STRINGS.he.menu)).toBeDefined();
    expect(screen.getByText(STRINGS.he.restart)).toBeDefined();
  });

  it('opens settings and allows changing level configurations', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Open menu
    const gearBtn = screen.getByText('⚙️');
    await act(async () => {
      fireEvent.click(gearBtn);
    });

    // Click "Generate Map" / Settings
    const genMapMenuBtn = screen.getByText(STRINGS.he.generateMap);
    await act(async () => {
      fireEvent.click(genMapMenuBtn);
    });

    // Settings screen should be open
    expect(screen.getByText(STRINGS.he.settings)).toBeDefined();
    expect(screen.getByText(STRINGS.he.minQuestChain)).toBeDefined();
    expect(screen.getByText(STRINGS.he.diggersMemory)).toBeDefined();

    // Back button returns to main menu
    const backBtn = screen.getByText(STRINGS.he.back);
    await act(async () => {
      fireEvent.click(backBtn);
    });
    expect(screen.getByText(STRINGS.he.menu)).toBeDefined();
  });

  it('renders lighting modal for underground level', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Underground level has the eye button 👁️
    const eyeBtn = screen.getByTitle('Lighting Settings');
    expect(eyeBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(eyeBtn);
    });

    // Lighting menu view should be visible
    expect(screen.getByText(STRINGS.he.lighting)).toBeDefined();
    expect(screen.getByText(STRINGS.he.specialVision)).toBeDefined();
    expect(screen.getByText(STRINGS.he.radius)).toBeDefined();
    expect(screen.getByText(STRINGS.he.blur)).toBeDefined();
  });

  it('renders inventory slots and undo button properly', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Undo button
    const undoBtn = screen.getByText('↩️');
    expect(undoBtn).toBeDefined();
    // Initially undo is disabled since history stack is empty
    expect(undoBtn.closest('button').disabled).toBe(true);

    // 4 inventory slot buttons exist
    const slotButtons = document.querySelectorAll('button[class*="rounded-[2.5cqw]"]');
    expect(slotButtons.length).toBe(4);
  });

  it('renders visual backpack capacity pill and full alert banner', () => {
    const level = LEVEL_REGISTRY.underground;
    const { rerender } = render(
      <InventoryBar
        inventory={['crystal', 'emerald']}
        selectedItemTypes={[]}
        toggleInventoryType={() => {}}
        handleUndo={() => {}}
        isDemonstrating={false}
        isAnimatingLoot={false}
        isRefillingAir={false}
        historyStack={[]}
        level={level}
        dict={STRINGS.en}
        isInventoryFullAlert={false}
      />
    );

    // Shows 2/4 capacity
    expect(screen.getByText('2/4')).toBeDefined();
    expect(screen.getByText('🎒')).toBeDefined();

    // Rerender with 4 unique items (Full) and isInventoryFullAlert=true
    rerender(
      <InventoryBar
        inventory={['crystal', 'emerald', 'relic', 'rope']}
        selectedItemTypes={[]}
        toggleInventoryType={() => {}}
        handleUndo={() => {}}
        isDemonstrating={false}
        isAnimatingLoot={false}
        isRefillingAir={false}
        historyStack={[]}
        level={level}
        dict={STRINGS.en}
        isInventoryFullAlert={true}
      />
    );

    // Shows 4/4 capacity
    expect(screen.getByText('4/4')).toBeDefined();
    // Shows alert banner with tent drop tip
    expect(screen.getByText(STRINGS.en.inventoryFullTip)).toBeDefined();
  });

  it('renders boat drop icon and boat tip banner on underwater level when inventory is full', () => {
    const underwaterLevel = LEVEL_REGISTRY.underwater;
    render(
      <InventoryBar
        inventory={['pearl', 'shell', 'comb', 'mirror']}
        selectedItemTypes={[]}
        toggleInventoryType={() => {}}
        handleUndo={() => {}}
        isDemonstrating={false}
        isAnimatingLoot={false}
        isRefillingAir={false}
        historyStack={[]}
        level={underwaterLevel}
        dict={STRINGS.en}
        isInventoryFullAlert={true}
      />
    );

    expect(screen.getByText('⛵')).toBeDefined();
    expect(screen.getByText(STRINGS.en.inventoryFullTipBoat)).toBeDefined();
  });

  it('hides floating reward orbs on mermaids and shrouds distant clam pearls with ? until hero swims close', () => {
    const underwaterLevel = LEVEL_REGISTRY.underwater;
    const mermaidEnt = {
      id: 'mermaid_1',
      emoji: '🧜‍♀️',
      requires: ['comb'],
      reqType: 'OR',
      reward: 'mermaid_voice',
      orbit: { rx: 22, ry: 9, duration: 7.5 },
      x: 30,
      y: 31,
      zone: 1,
      isGatekeeper: false
    };
    const clamEnt = {
      id: 'giant_clam_0',
      emoji: '🐚',
      requires: ['sea_kelp'],
      reqType: 'OR',
      reward: 'pearl',
      x: 22,
      y: 93,
      zone: 3,
      isGatekeeper: false
    };
    const dummyPuzzle = {
      goalEntityId: 'sunken_vault',
      puzzleEntities: [mermaidEnt, clamEnt]
    };

    const { rerender } = render(
      <>
        <GameEntity
          ent={mermaidEnt}
          puzzle={dummyPuzzle}
          level={underwaterLevel}
          defeated={[]}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId={null}
          animatingEntities={[]}
          buriedEntities={[]}
          inkFogEntities={new Set()}
          unlockedZones={[1, 2, 3]}
          visibleEntitiesSet={new Set(['mermaid_1', 'giant_clam_0'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 50, y: 14 }}
          breakingRockIds={[]}
          isTransformed={false}
          hasDeepTreasure={false}
          getCustomEntityMovement={() => ({ x: 30, y: 31, visualOffset: '' })}
          handleInteract={() => {}}
          dict={STRINGS.en}
        />
        <GameEntity
          ent={clamEnt}
          puzzle={dummyPuzzle}
          level={underwaterLevel}
          defeated={[]}
          alertEntityId={null}
          alertReason={null}
          selectedEntityId={null}
          animatingEntities={[]}
          buriedEntities={[]}
          inkFogEntities={new Set()}
          unlockedZones={[1, 2, 3]}
          visibleEntitiesSet={new Set(['mermaid_1', 'giant_clam_0'])}
          wallSegments={[]}
          displayPlayerPos={{ x: 50, y: 65 }} // Far from (22, 93)
          breakingRockIds={[]}
          isTransformed={true}
          hasDeepTreasure={false}
          getCustomEntityMovement={() => null}
          handleInteract={() => {}}
          dict={STRINGS.en}
        />
      </>
    );

    // Mermaid never renders a floating reward orb ('🎵') outside her sprite; distant clam shows '❓' instead of '⚪'
    expect(screen.queryByText('🎵')).toBeNull();
    expect(screen.getByTestId('mermaid-orbit-mermaid_1')).toBeDefined();
    expect(screen.getByText('❓')).toBeDefined();
    expect(screen.queryByText('⚪')).toBeNull();

    // Move hero close to clam (<= 22)
    rerender(
      <GameEntity
        ent={clamEnt}
        puzzle={dummyPuzzle}
        level={underwaterLevel}
        defeated={[]}
        alertEntityId={null}
        alertReason={null}
        selectedEntityId={null}
        animatingEntities={[]}
        buriedEntities={[]}
        inkFogEntities={new Set()}
        unlockedZones={[1, 2, 3]}
        visibleEntitiesSet={new Set(['mermaid_1', 'giant_clam_0'])}
        wallSegments={[]}
        displayPlayerPos={{ x: 25, y: 90 }} // Distance ~4.2 (<= 22)
        breakingRockIds={[]}
        isTransformed={true}
        hasDeepTreasure={false}
        getCustomEntityMovement={() => null}
        handleInteract={() => {}}
        dict={STRINGS.en}
      />
    );

    // Nearby clam reveals pearl '⚪' inside its shell
    expect(screen.getByText('⚪')).toBeDefined();
  });

  it('SpriteIcon renders registered SVG sprites, quality image assets via spriteSrc, and emoji fallbacks', () => {
    const { container } = render(
      <div>
        <SpriteIcon id="rope" emoji="🪢" alt="Rope" testId="sprite-rope" />
        <SpriteIcon id="blowfish" emoji="🐡" alt="Lanternfish" testId="sprite-fish" />
        <SpriteIcon id="sea_witch" emoji="😈" alt="Sea Witch" testId="sprite-witch" />
        <SpriteIcon
          id="custom_goblin"
          spriteSrc="/sprites/goblin.webp"
          emoji="👺"
          alt="Custom Goblin"
          testId="sprite-img"
        />
        <SpriteIcon id="unregistered_item" emoji="💎" testId="sprite-fallback" />
        <svg viewBox="0 0 100 100">
          <SvgEmbeddedSprite id="rope" emoji="🪢" x={50} y={50} size={24} />
          <SvgEmbeddedSprite id="img_item" spriteSrc="/sprites/gem.png" emoji="💎" x={20} y={20} size={20} />
          <SvgEmbeddedSprite id="plain_item" emoji="⭐" x={80} y={80} size={20} />
        </svg>
      </div>
    );

    const ropeImg = screen.getByTestId('sprite-rope').querySelector('img');
    expect(ropeImg).toBeTruthy();
    expect(ropeImg.getAttribute('src')).toBe('./sprites/rope.png');

    expect(screen.getByTestId('sprite-fish').querySelector('svg')).toBeTruthy();

    const witchImg = screen.getByTestId('sprite-witch').querySelector('img');
    expect(witchImg).toBeTruthy();
    expect(witchImg.getAttribute('src')).toBe('./sprites/sea_witch.png');

    const imgEl = screen.getByTestId('sprite-img').querySelector('img');
    expect(imgEl).toBeTruthy();
    expect(imgEl.getAttribute('src')).toBe('/sprites/goblin.webp');

    expect(screen.getByTestId('sprite-fallback').textContent).toBe('💎');
    expect(container.querySelector('svg image[href="./sprites/rope.png"]')).toBeTruthy();
    expect(container.querySelector('svg image[href="/sprites/gem.png"]')).toBeTruthy();
    expect(container.querySelector('svg text').textContent).toBe('⭐');
  });
});
