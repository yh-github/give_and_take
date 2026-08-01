const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const outDir = '/home/yoavh/.gemini/antigravity/brain/5f2c4fd4-1ba0-4465-a93e-5e811bc53752';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950, deviceScaleFactor: 2 });

  console.log('=== Step 1: Inspect Level Editor at all scroll positions ===');
  await page.goto('http://localhost:5173/?editor=true', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Top (Scroll Y = 0%)
  await page.screenshot({ path: path.join(outDir, 'editor_zone1_top.png') });

  // Scroll to Zone 2/3 (Middle: y ~ 45%)
  await page.evaluate(() => {
    const mapDiv = document.querySelector('div.shadow-\\[inset_0_0_80px_rgba\\(100\\,50\\,0\\,0\\.6\\)\\,0_10px_30px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]') || document.querySelector('div[style*="containerType"]');
    if (mapDiv) {
      for (let i = 0; i < 6; i++) {
        mapDiv.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, bubbles: true }));
      }
    }
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, 'editor_zone2_middle.png') });

  // Scroll to Zone 4/5 (Lower Middle: y ~ 65%)
  await page.evaluate(() => {
    const mapDiv = document.querySelector('div.shadow-\\[inset_0_0_80px_rgba\\(100\\,50\\,0\\,0\\.6\\)\\,0_10px_30px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]') || document.querySelector('div[style*="containerType"]');
    if (mapDiv) {
      for (let i = 0; i < 6; i++) {
        mapDiv.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, bubbles: true }));
      }
    }
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, 'editor_zone3_lower.png') });

  // Scroll to Zone 6/7/8 (Bottom Vault: y ~ 85%)
  await page.evaluate(() => {
    const mapDiv = document.querySelector('div.shadow-\\[inset_0_0_80px_rgba\\(100\\,50\\,0\\,0\\.6\\)\\,0_10px_30px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]') || document.querySelector('div[style*="containerType"]');
    if (mapDiv) {
      for (let i = 0; i < 8; i++) {
        mapDiv.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, bubbles: true }));
      }
    }
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, 'editor_zone4_bottom.png') });

  console.log('=== Step 2: Measure DOM bounding boxes of all rock barricades ===');
  const rockMeasurements = await page.evaluate(() => {
    // Find all editor nodes with rock component or emoji 🪨 or gatekeeper
    const mapNodes = Array.from(document.querySelectorAll('div')).filter(el => {
      const style = el.getAttribute('style') || '';
      return style.includes('left:') && style.includes('top:') && (el.innerHTML.includes('rockGrad') || el.innerText.includes('32.3') || el.innerText.includes('66.5') || el.innerText.includes('rock'));
    });

    return mapNodes.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        text: el.innerText ? el.innerText.split('\n')[0] : '',
        style: el.getAttribute('style'),
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      };
    });
  });

  console.log('Rock measurements count:', rockMeasurements.length);

  await browser.close();
  console.log('Finished capture script.');
})();
