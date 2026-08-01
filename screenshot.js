import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1000 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  // Wait for the app to render
  await page.waitForSelector('.absolute');
  
  // Wait a bit for animations
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
  console.log("Screenshot saved to screenshot.png");
})();
