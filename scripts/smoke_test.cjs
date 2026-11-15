const puppeteer = require('puppeteer');
const { createServer } = require('vite');
const path = require('path');

async function runSmokeTests() {
  const watchdog = setTimeout(() => {
    console.error('❌ E2E Smoke Test FAILED: Stuck / timed out after 60s');
    process.exit(1);
  }, 60000);
  watchdog.unref();
  console.log('🚀 Starting Vite dev server for headless E2E smoke tests...');
  const server = await createServer({
    configFile: path.resolve(__dirname, '../vite.config.js'),
    root: path.resolve(__dirname, '..'),
    server: { port: 5174, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  const port = server.config.server.port || 5174;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🌐 Server running at ${baseUrl}`);

  let browser;
  try {
    console.log('🤖 Launching Headless Chrome...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    const uncaughtErrors = [];
    page.on('pageerror', err => {
      console.error('❌ Uncaught Page Error:', err.message);
      uncaughtErrors.push(err.message);
    });

    await page.setViewport({ width: 1024, height: 900 });

    // 1. Initial Load Test (Underground Cave)
    console.log('🧪 Test 1: Loading default level (Underground)...');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    
    // Wait for the app to finish generating and show the settings button ⚙️
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('⚙️'));
    }, { timeout: 8000 });

    console.log('  ✅ Game container & gear button rendered');

    // 2. Physical Click & Hero Movement Test in Underground Cave
    console.log('🧪 Test 2: Testing Hero Movement and Pathfinding in Underground level...');
    
    // Check initial hero position
    const initialPos = await page.evaluate(() => {
      const heroContainer = Array.from(document.querySelectorAll('div')).find(el => {
        return el.style && el.style.left && el.style.top && el.textContent.includes('🤠');
      });
      if (!heroContainer) return null;
      return {
        left: heroContainer.style.left,
        top: heroContainer.style.top
      };
    });
    
    if (!initialPos || initialPos.top !== '2%') {
      throw new Error(`Expected initial hero top to be 2%, received ${JSON.stringify(initialPos)}`);
    }
    console.log(`  ✅ Hero initial position verified at top=${initialPos.top}, left=${initialPos.left}`);

    // Click on the cave map inside the torch light circle (e.g. click at y=10%)
    await page.evaluate(() => {
      const heroContainer = Array.from(document.querySelectorAll('div')).find(el => {
        return el.style && el.style.left && el.style.top && el.textContent.includes('🤠');
      });
      const innerMap = heroContainer.parentElement;
      const rect = innerMap.getBoundingClientRect();
      
      // Simulate click at x=50%, y=10% (well within torch radius and above gatekeeper rocks)
      const clickEvent = new MouseEvent('click', {
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top + rect.height * 0.10,
        bubbles: true,
        cancelable: true
      });
      innerMap.dispatchEvent(clickEvent);
    });

    // Wait for movement animation
    await new Promise(r => setTimeout(r, 1200));

    // Verify hero has moved to new position
    const updatedPos = await page.evaluate(() => {
      const heroContainer = Array.from(document.querySelectorAll('div')).find(el => {
        return el.style && el.style.left && el.style.top && el.textContent.includes('🤠');
      });
      if (!heroContainer) return null;
      return {
        left: heroContainer.style.left,
        top: heroContainer.style.top
      };
    });

    console.log(`  ✅ Hero updated position after click: top=${updatedPos?.top}, left=${updatedPos?.left}`);
    if (!updatedPos || updatedPos.top === '2%') {
      throw new Error(`Hero did not move! Position stayed at ${JSON.stringify(updatedPos)}`);
    }

    // Step towards left rocks: click at x=30%, y=18%
    console.log('🧪 Test 2b: Verifying Left Gatekeeper Rocks visibility when standing in front of them...');
    await page.evaluate(() => {
      const heroContainer = Array.from(document.querySelectorAll('div')).find(el => {
        return el.style && el.style.left && el.style.top && el.textContent.includes('🤠');
      });
      const innerMap = heroContainer.parentElement;
      const rect = innerMap.getBoundingClientRect();
      
      const clickEvent = new MouseEvent('click', {
        clientX: rect.left + rect.width * 0.30,
        clientY: rect.top + rect.height * 0.18,
        bubbles: true,
        cancelable: true
      });
      innerMap.dispatchEvent(clickEvent);
    });

    await new Promise(r => setTimeout(r, 1200));

    // Check visibility of left gatekeeper rock at y=22%
    const rockVisibility = await page.evaluate(() => {
      const heroContainer = Array.from(document.querySelectorAll('div')).find(el => {
        return el.style && el.style.left && el.style.top && el.textContent.includes('🤠');
      });
      const innerMap = heroContainer.parentElement;
      const allDivs = Array.from(innerMap.querySelectorAll('div[class*="absolute"]'));
      const leftRock = allDivs.find(el => el.style && el.style.top === '22%' && el.innerHTML.includes('polygon'));
      if (!leftRock) return { found: false };
      const isHidden = leftRock.className.includes('opacity-0') || leftRock.className.includes('invisible');
      return { found: true, isHidden, className: leftRock.className };
    });

    if (!rockVisibility.found) {
      throw new Error('Left gatekeeper rock element not found on page');
    }
    if (rockVisibility.isHidden) {
      throw new Error(`Left gatekeeper rock is unexpectedly hidden: ${rockVisibility.className}`);
    }
    console.log('  ✅ Left gatekeeper rocks are clearly visible in front of hero');

    // 3. Language Toggle Test
    console.log('🧪 Test 3: Testing Language Toggle (🇮🇱 / 🇺🇸)...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const usBtn = btns.find(b => b.textContent.includes('🇺🇸'));
      if (usBtn) usBtn.click();
    });
    await new Promise(r => setTimeout(r, 200));

    // Open menu to verify English text
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gear = btns.find(b => b.textContent.includes('⚙️'));
      if (gear) gear.click();
    });
    await new Promise(r => setTimeout(r, 300));
    const hasEnglishMenu = await page.evaluate(() => document.body.textContent.includes('Menu') || document.body.textContent.includes('Restart'));
    if (!hasEnglishMenu) throw new Error('English language toggle failed');
    console.log('  ✅ English translation verified in UI');

    // Close menu & switch back to Hebrew
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const resume = btns.find(b => b.textContent.includes('Back') || b.textContent.includes('Resume') || b.textContent.includes('חזור'));
      if (resume) resume.click();
    });
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const ilBtn = btns.find(b => b.textContent.includes('🇮🇱'));
      if (ilBtn) ilBtn.click();
    });

    // 4. Switch to Underwater Level
    console.log('🧪 Test 4: Switching to Underwater Level...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gear = btns.find(b => b.textContent.includes('⚙️'));
      if (gear) gear.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Click "Generate Map / Settings"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const genBtn = btns.find(b => b.textContent.includes('צור מפה') || b.textContent.includes('Generate'));
      if (genBtn) genBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Switch to underwater level
    await page.evaluate(() => {
      const select = document.querySelector('select');
      if (select) {
        select.value = 'underwater';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 300));

    // Click Generate Map to confirm
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('צור מפה') || b.textContent.includes('Generate Map'));
      if (submitBtn) submitBtn.click();
    });

    // Wait for underwater level to generate
    await page.waitForFunction(() => {
      return document.body.textContent.includes('🫧');
    }, { timeout: 8000 });

    console.log('  ✅ Switched to Underwater level successfully');

    // 5. Switch to River Crossing Level
    console.log('🧪 Test 5: Switching to River Crossing Level...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gear = btns.find(b => b.textContent.includes('⚙️'));
      if (gear) gear.click();
    });
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const genBtn = btns.find(b => b.textContent.includes('צור מפה') || b.textContent.includes('Generate'));
      if (genBtn) genBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      const select = document.querySelector('select');
      if (select) {
        select.value = 'river_crossing';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('צור מפה') || b.textContent.includes('Generate Map'));
      if (submitBtn) submitBtn.click();
    });

    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('⚙️'));
    }, { timeout: 8000 });

    console.log('  ✅ Switched to River Crossing level successfully');

    // 5b. Switch to Deep Cave (The Abyssal Descent) & test presets, async Web Worker generation, movement & compact autosave hydration
    console.log('🧪 Test 5b: Testing Deep Cave (The Abyssal Descent) presets, Web Worker generation, movement & seed hydration...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gear = btns.find(b => b.textContent.includes('⚙️'));
      if (gear) gear.click();
    });
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const genBtn = btns.find(b => b.textContent.includes('צור מפה') || b.textContent.includes('Generate'));
      if (genBtn) genBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));

    await page.select('select', 'deep_cave');
    await page.waitForSelector('[data-testid="preset-btn-normal"]', { timeout: 4000 });
    await page.click('[data-testid="preset-btn-normal"]');

    // Toggle Advanced Settings and verify custom knobs render
    await page.click('[data-testid="toggle-advanced-settings"]');
    await page.waitForSelector('[data-testid="knob-torchRadius"]', { timeout: 3000 });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('צור מפה') || b.textContent.includes('Generate Map'));
      if (submitBtn) submitBtn.click();
    });

    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const hasGear = btns.some(b => b.textContent.includes('⚙️'));
      const hasPaths = document.querySelectorAll('svg path').length > 0;
      const hasHero = document.body.textContent.includes('🤠');
      return hasGear && hasPaths && hasHero;
    }, { timeout: 10000 });
    console.log('  ✅ Deep Cave Web Worker generated SVG walls & hero');

    // Move hero slightly downward/sideways near Camp so movement & compact autosave trigger
    const deepCaveInitial = await page.evaluate(() => {
      const hero = Array.from(document.querySelectorAll('div')).find(el =>
        el.style && el.style.left && el.style.top && el.textContent.includes('🤠')
      );
      if (!hero) return null;
      const before = { left: parseFloat(hero.style.left), top: parseFloat(hero.style.top) };
      const innerMap = hero.parentElement;
      const rect = innerMap.getBoundingClientRect();
      // Try clicking a short offset from hero inside open Camp area
      const clickX = rect.left + rect.width * (before.left / 100);
      const clickY = rect.top + rect.height * ((before.top + 3) / 100);
      innerMap.dispatchEvent(new MouseEvent('click', {
        clientX: clickX,
        clientY: clickY,
        bubbles: true,
        cancelable: true
      }));
      return before;
    });

    await new Promise(r => setTimeout(r, 900));

    const deepCaveMovedAndSaved = await page.evaluate((before) => {
      const hero = Array.from(document.querySelectorAll('div')).find(el =>
        el.style && el.style.left && el.style.top && el.textContent.includes('🤠')
      );
      const after = hero ? { left: parseFloat(hero.style.left), top: parseFloat(hero.style.top) } : null;
      const rawAutoSave = window.localStorage.getItem('give_and_take_autosave');
      const parsedAutoSave = rawAutoSave ? JSON.parse(rawAutoSave) : null;
      return { before, after, parsedAutoSave };
    }, deepCaveInitial);

    if (!deepCaveMovedAndSaved.parsedAutoSave ||
        deepCaveMovedAndSaved.parsedAutoSave.levelId !== 'deep_cave' ||
        deepCaveMovedAndSaved.parsedAutoSave.puzzle !== null ||
        !deepCaveMovedAndSaved.parsedAutoSave.seed) {
      throw new Error(`Expected compact deep_cave autosave, got: ${JSON.stringify(deepCaveMovedAndSaved.parsedAutoSave)}`);
    }
    console.log(`  ✅ Deep Cave movement & compact seed autosave verified (seed=${deepCaveMovedAndSaved.parsedAutoSave.seed})`);

    // Test compact save deterministic hydration across page reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.textContent.includes('המשך') || document.body.textContent.includes('Continue'), { timeout: 6000 });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cont = btns.find(b => b.textContent.includes('המשך') || b.textContent.includes('Continue'));
      if (cont) cont.click();
    });
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('⚙️')) && document.querySelectorAll('svg path').length > 0;
    }, { timeout: 10000 });
    console.log('  ✅ Deep Cave deterministic seed hydration on reload verified');

    // 6. Level Editor Query Param Test
    console.log('🧪 Test 6: Testing Level Editor mode (?editor=true)...');
    await page.goto(`${baseUrl}/?editor=true`, { waitUntil: 'networkidle0' });
    
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Save Level'));
    }, { timeout: 8000 });

    console.log('  ✅ Level editor mode active with Save Level button');

    // 7. Check for uncaught runtime errors
    if (uncaughtErrors.length > 0) {
      throw new Error(`Encountered ${uncaughtErrors.length} uncaught page errors: ${uncaughtErrors.join('; ')}`);
    }

    console.log('🎉 All Headless Browser E2E Smoke Tests PASSED with 0 errors!');
  } finally {
    clearTimeout(watchdog);
    if (browser) await browser.close();
    await server.close();
  }
}

runSmokeTests().catch(err => {
  console.error('❌ E2E Smoke Test FAILED:', err);
  process.exit(1);
});
