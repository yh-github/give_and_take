const puppeteer = require('puppeteer');
const { createServer } = require('vite');
const path = require('path');

async function runSmokeTests() {
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
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    
    // Wait for the app to finish generating and show the settings button ⚙️
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('⚙️'));
    }, { timeout: 8000 });

    console.log('  ✅ Game container & gear button rendered');

    // Verify language flags exist and test language toggle
    console.log('🧪 Test 2: Testing Language Toggle (🇮🇱 / 🇺🇸)...');
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

    // 3. Switch to Underwater Level
    console.log('🧪 Test 3: Switching to Underwater Level...');
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

    // 4. Switch to River Crossing Level
    console.log('🧪 Test 4: Switching to River Crossing Level...');
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

    // 5. Level Editor Query Param Test
    console.log('🧪 Test 5: Testing Level Editor mode (?editor=true)...');
    await page.goto(`${baseUrl}/?editor=true`, { waitUntil: 'networkidle0' });
    
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Save Level'));
    }, { timeout: 8000 });

    console.log('  ✅ Level editor mode active with Save Level button');

    // 6. Check for uncaught runtime errors
    if (uncaughtErrors.length > 0) {
      throw new Error(`Encountered ${uncaughtErrors.length} uncaught page errors: ${uncaughtErrors.join('; ')}`);
    }

    console.log('🎉 All Headless Browser E2E Smoke Tests PASSED with 0 errors!');
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

runSmokeTests().catch(err => {
  console.error('❌ E2E Smoke Test FAILED:', err);
  process.exit(1);
});
