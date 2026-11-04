// Close-up verification for side statues after pedestal fix (2026-11-03).
// Walks to the hall altar via the map, then drags the camera east/west
// to frame each side altar, saving full-page screenshots for cropping.
// Run: node test-statues-closeup.js  (uses local server on :3101)
const { chromium } = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/home/hatch/workspace/chua-online/test-shots';
fs.mkdirSync(OUT, { recursive: true });

async function clickByText(page, text, timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await page.evaluate((t) => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find((x) => (x.textContent || '').includes(t));
      if (b) { b.click(); return true; }
      return false;
    }, text);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}
async function existsByText(page, text) {
  return page.evaluate((t) => [...document.querySelectorAll('button')].some((x) => (x.textContent || '').includes(t)), text);
}
async function clickMapHall(page) {
  // In the map dialog, click the "Đến đây" whose card mentions Chính điện.
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((x) => (x.textContent || '').trim() === 'Đến đây');
    for (const b of btns) {
      let el = b;
      for (let i = 0; i < 5 && el; i++) {
        if ((el.textContent || '').includes('Chính điện')) { b.click(); return true; }
        el = el.parentElement;
      }
    }
    return false;
  });
}
async function drag(page, dx) {
  const cx = 640, cy = 400;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (dx * i) / steps, cy);
    await new Promise((r) => setTimeout(r, 50));
  }
  await page.mouse.up();
}
async function shot(page, name) {
  try {
    await page.screenshot({ path: `${OUT}/${name}`, timeout: 180000, animations: 'disabled' });
    console.log('SHOT OK', name);
  } catch (e) {
    console.log('SHOT FAIL', name, String(e).slice(0, 200));
  }
}

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
  console.log('goto');
  await page.goto('http://localhost:3101/', { timeout: 120000 });
  console.log('click Buoc vao chua:', await clickByText(page, 'Bước vào chùa'));
  console.log('click So do chua:', await clickByText(page, 'Sơ đồ chùa'));
  await new Promise((r) => setTimeout(r, 5000));
  console.log('click map hall Den day:', await clickMapHall(page));
  // Poll for altar arrival (Quỳ lễ button only renders near the altar zone).
  const t0 = Date.now();
  let arrived = false;
  while (Date.now() - t0 < 1200000) {
    if (await existsByText(page, 'Quỳ lễ')) { arrived = true; break; }
    const el = Math.round((Date.now() - t0) / 1000);
    if (el % 60 === 0) console.log('walking...', el, 's');
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.log('ARRIVED altar:', arrived, 'after', Math.round((Date.now() - t0) / 1000), 's');
  await new Promise((r) => setTimeout(r, 5000));
  await shot(page, 'statue2-centre.png');
  await drag(page, 200);
  await new Promise((r) => setTimeout(r, 10000));
  await shot(page, 'statue2-east.png');
  await drag(page, -400);
  await new Promise((r) => setTimeout(r, 10000));
  await shot(page, 'statue2-west.png');
  await browser.close();
  console.log('DONE');
  process.exit(arrived ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
