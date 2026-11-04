// Request E Lumbini test (Playwright, :3101, software rendering).
// Flow: enter -> map to Lumbini -> arrival at ritual spot ->
// pavilion + roof shots -> ctx buttons -> start ritual -> pour ->
// STOP mid-pour (ladle must return, no stuck state) -> restart ->
// full ritual to the blessing dialog -> map dot check.
// Bath phase comes from window.__lumbini (Lumbini test hook).
// NOTE: VM software rendering runs ~0.35 fps with dt clamped to
// 0.05s, so the 24s ritual timeline takes ~20+ min wall-clock;
// timeouts below are generous on purpose. Logic is identical at
// full fps on a real device.
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
async function bathPhase(page) {
  try { return await page.evaluate(() => (window.__lumbini || {}).phase || 'unknown'); } catch { return 'unknown'; }
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
  // Route A: spawn -> pond -> bell -> yard -> ritual spot (~35m).
  const arrived = await poll(page, () => (window.__lumbini || {}).phase === 'pray', 1200000, 'bath arrival (phase pray)');
  console.log('bath phase after arrival poll:', await bathPhase(page));
  await shot(page, 'e-arrival.png');
  // Drag-look-up: roof check (follow camera pitches down, so a
  // roof ~1m above the camera is out of frame in walk shots).
  try {
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const r = c ? c.getBoundingClientRect() : { x: 0, y: 0, width: 1280, height: 800 };
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x, box.y - 300, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(5000);
  } catch (e) { console.log('drag-up fail:', e.message.slice(0, 120)); }
  await shot(page, 'e-roof-up.png');
  // Wait for pour phase, then STOP mid-pour.
  const pouring = await poll(page, () => (window.__lumbini || {}).phase === 'pour', 600000, 'bath pour phase');
  if (pouring) await shot(page, 'e-mid-pour.png');
  await clickByText(page, 'Dừng lại', 'stop bath');
  await page.waitForTimeout(10000);
  const stopped = await poll(page, () => (window.__lumbini || {}).phase === 'idle', 120000, 'bath stopped to idle');
  const barGone = await page.evaluate(() => !document.body.innerText.includes('Đang tắm Phật — lễ đài Lâm Tỳ Ni'));
  console.log('bar gone after stop:', barGone);
  // Ctx buttons must reappear at the spot (within 2.5m of basin).
  const ctxOk = await poll(page, () => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some((b) => (b.innerText || '').trim().startsWith('🪷 Tắm Phật'));
  }, 120000, 'bath ctx button after stop');
  // Restart from the spot (immediate start) -> full ritual.
  if (ctxOk) await clickByText(page, '🪷 Tắm Phật', 'restart bath');
  const done = await poll(page, () => (window.__lumbini || {}).phase === 'done', 1500000, 'bath done phase');
  const blessing = await page.evaluate(() => document.body.innerText.includes('Nguyện thân tâm thanh tịnh, nuôi dưỡng điều lành.'));
  console.log('blessing dialog exact text:', blessing);
  if (done) await shot(page, 'e-blessing.png');
  // Close blessing, then open the map and check the Lumbini dot.
  await clickByText(page, 'Đóng', 'close blessing');
  await page.waitForTimeout(5000);
  await clickByText(page, 'Sơ đồ chùa', 'So do chua 2');
  await page.waitForTimeout(5000);
  const dotOk = await page.evaluate(() => {
    const circles = Array.from(document.querySelectorAll('svg circle'));
    return circles.some((c) => c.getAttribute('cx') === '70' && c.getAttribute('cy') === '140');
  });
  console.log('map Lumbini dot (70,140):', dotOk);
  await shot(page, 'e-map.png');
  console.log('PAGEERRORS:', pageErrors);
  console.log('RESULT arrived=', arrived, 'pouring=', pouring, 'stopped=', stopped, 'barGone=', barGone, 'ctxOk=', ctxOk, 'done=', done, 'blessing=', blessing, 'dotOk=', dotOk);
  await browser.close();
  process.exit(arrived && pouring && stopped && barGone && ctxOk && done && blessing && dotOk && pageErrors === 0 ? 0 : 1);
})().catch((e) => { console.error('TEST CRASH:', e.message.slice(0, 500)); process.exit(2); });
