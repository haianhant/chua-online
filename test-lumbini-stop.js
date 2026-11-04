// Request E stop test (Playwright, :3101, software rendering).
// Corrects the test-lumbini.js design flaw: the MAP route does NOT
// auto-start the ritual (only the "Tắm Phật" button does), so
// arrival is detected by the ctx button, not by bath phase.
// Flow: enter -> map to Lumbini -> ctx button appears (arrival)
// -> click Tắm Phật -> pour phase -> follow + side shots ->
// STOP mid-pour -> idle + bar gone + ctx reappears.
const { chromium } = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
const path = require('path');

let pageErrors = 0;
async function clickByText(page, needle, label) {
  const ok = await page.evaluate((n) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => (x.innerText || '').includes(n));
    if (!b) return false;
    b.click();
    return true;
  }, needle);
  console.log(`click ${label}: ${ok}`);
  return ok;
}
async function poll(page, fn, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await page.evaluate(fn);
      if (v) { console.log(`${label}: true after ${Math.round((Date.now() - start) / 1000)}s`); return true; }
    } catch (e) { /* page busy */ }
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.log(`${label}: FALSE after ${Math.round(timeoutMs / 1000)}s`);
  return false;
}
async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(__dirname, 'test-shots', name), timeout: 180000, animations: 'disabled' });
    console.log(`SHOT OK ${name}`);
  } catch (e) { console.log(`SHOT FAIL ${name}: ${e.message.slice(0, 120)}`); }
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => { pageErrors++; console.log('PAGEERROR:', String(e).slice(0, 300)); });
  await page.goto('http://localhost:3101/', { timeout: 120000 });
  await page.waitForTimeout(15000);
  await clickByText(page, 'Bước vào chùa', 'Buoc vao chua');
  await page.waitForTimeout(10000);
  await clickByText(page, 'Sơ đồ chùa', 'So do chua');
  await page.waitForTimeout(5000);
  await clickByText(page, 'Vườn Lâm Tỳ Ni', 'select lumbini zone');
  await page.waitForTimeout(5000);
  await clickByText(page, 'Đến đây', 'map lumbini Den day');
  await poll(page, () => !document.body.innerText.includes('Sơ đồ Chùa Hải An'), 120000, 'map closed');
  // Arrival signal = ctx button (within 2.5m of the basin).
  const ctxOk = await poll(page, () => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some((b) => (b.innerText || '').trim().startsWith('🪷 Tắm Phật'));
  }, 1800000, 'bath ctx button (arrival)');
  if (ctxOk) await clickByText(page, '🪷 Tắm Phật', 'start bath');
  const pouring = await poll(page, () => (window.__lumbini || {}).phase === 'pour', 600000, 'bath pour phase');
  if (pouring) {
    await shot(page, 'e-mid-pour.png');
    // Side view: orbit the camera so the ladle/stream/statue are
    // not hidden behind the avatar (follow camera looks from south).
    try {
      const box = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        const r = c ? c.getBoundingClientRect() : { x: 0, y: 0, width: 1280, height: 800 };
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      await page.mouse.move(box.x + 300, box.y, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(5000);
    } catch (e) { console.log('orbit fail:', e.message.slice(0, 120)); }
    await shot(page, 'e-mid-pour-side.png');
  }
  await clickByText(page, 'Dừng lại', 'stop bath');
  await page.waitForTimeout(10000);
  const stopped = await poll(page, () => (window.__lumbini || {}).phase === 'idle', 120000, 'bath stopped to idle');
  const barGone = await page.evaluate(() => !document.body.innerText.includes('Đang tắm Phật — lễ đài Lâm Tỳ Ni'));
  console.log('bar gone after stop:', barGone);
  const ctxBack = await poll(page, () => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some((b) => (b.innerText || '').trim().startsWith('🪷 Tắm Phật'));
  }, 120000, 'bath ctx button after stop');
  console.log('PAGEERRORS:', pageErrors);
  console.log('RESULT ctxOk=', ctxOk, 'pouring=', pouring, 'stopped=', stopped, 'barGone=', barGone, 'ctxBack=', ctxBack);
  await browser.close();
  process.exit(ctxOk && pouring && stopped && barGone && ctxBack && pageErrors === 0 ? 0 : 1);
})().catch((e) => { console.error('TEST CRASH:', e.message.slice(0, 500)); process.exit(2); });
