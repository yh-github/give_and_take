const puppeteer = require('puppeteer');
const { createServer } = require('vite');
const path = require('path');

const outDir = '/home/yoavh/.gemini/antigravity/brain/d71a9ec7-fce3-45a6-a57e-f8569918e2bf';

async function capture() {
  const server = await createServer({
    configFile: path.resolve(__dirname, '../vite.config.js'),
    root: path.resolve(__dirname, '..'),
    server: { port: 5176, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  const baseUrl = 'http://127.0.0.1:5176';

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 900, deviceScaleFactor: 2 });

    // 1. Underground Cave Level
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('⚙️')), { timeout: 8000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(outDir, 'refactored_underground.png') });

    // 2. Settings Menu Modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gear = btns.find(b => b.textContent.includes('⚙️'));
      if (gear) gear.click();
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(outDir, 'refactored_menu.png') });

    // 3. Switch to Underwater Level
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const genBtn = btns.find(b => b.textContent.includes('צור מפה') || b.textContent.includes('Generate'));
      if (genBtn) genBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => {
      const select = document.querySelector('select');
      if (select) {
        select.value = 'underwater';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('צור מפה') || b.textContent.includes('Generate Map'));
      if (submitBtn) submitBtn.click();
    });
    await page.waitForFunction(() => document.body.textContent.includes('🫧'), { timeout: 8000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(outDir, 'refactored_underwater.png') });

    console.log('Screenshots captured successfully!');
  } finally {
    await browser.close();
    await server.close();
  }
}

capture().catch(console.error);
