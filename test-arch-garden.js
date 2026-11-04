// Architecture-pass retest v4: verify the wedge fallback in
// Player.tsx on the exact failing leg: hall altar -> garden.
// v3 froze at (7.33,-6.46) for 40 min (wedged between the hall
// front wall and a door post). Flow: enter -> map hall (arrival
// = 'Quỳ lễ') -> map garden (arrival = live map marker near
// (420,164)) -> overview shots. Re-issues the garden route only
// if the marker stalls twice. Exit 0 only if garden + PAGEERRORS 0.
const { chromium } = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
const path = require('path');

let pageErrors = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickByText(page, needle, label, timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await page.evaluate((n) => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes(n));
      if (!b) return false;
      b.click();
      return true;
    }, needle);
    if (ok) { console.log(`click ${label}: true`); return true; }
    await sleep(5000);
  }
  console.log(`click ${label}: FALSE`);
  return false;
}
async function poll(page, fn, timeoutMs, label, intervalMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await page.evaluate(fn)) { console.log(`${label}: true after ${Math.round((Date.now() - start) / 1000)}s`); return true; } } catch (e) { /* busy */ }
    await sleep(intervalMs);
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
async function drag(page, dx, dy = 0) {
  try {
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const r = c ? c.getBoundingClientRect() : { x: 0, y: 0, width: 1280, height: 800 };
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(box.x + (dx * i) / 10, box.y + (dy * i) / 10, { steps: 1 });
      await sleep(50);
    }
    await page.mouse.up();
    await sleep(5000);
  } catch (e) { console.log('drag fail:', e.message.slice(0, 120)); }
}
async function openMap(page) { return clickByText(page, 'Sơ đồ chùa', 'So do chua'); }
async function closeMap(page) { await page.keyboard.press('Escape').catch(() => {}); await sleep(5000); }
async function readMarker(page) {
  return page.evaluate(() => {
    const t = [...document.querySelectorAll('text')].find((x) => (x.textContent || '').includes('Bạn đang ở đây'));
    if (!t) return null;
    return { x: parseFloat(t.getAttribute('x')), y: parseFloat(t.getAttribute('y')) };
  });
}
async function waitForMarker(page, tx, ty, label, initialWaitMs, checkMs, maxChecks) {
  await sleep(initialWaitMs);
  let last = null, stalls = 0;
  for (let i = 0; i < maxChecks; i++) {
    await openMap(page);
    await sleep(5000);
    const m = await readMarker(page);
    console.log(`${label} marker check ${i}:`, JSON.stringify(m));
    await closeMap(page);
    if (m && Math.abs(m.x - tx) < 35 && Math.abs(m.y - ty) < 35) return { ok: true, stalled: false };
    if (m && last && Math.abs(m.x - last.x) < 5 && Math.abs(m.y - last.y) < 5) stalls++;
    else stalls = 0;
    last = m;
    if (stalls >= 2) return { ok: false, stalled: true };
    await sleep(checkMs);
  }
  return { ok: false, stalled: false };
}
async function selectZoneGo(page, zoneText) {
  await openMap(page);
  await sleep(5000);
  await clickByText(page, zoneText, `select ${zoneText}`);
  await sleep(5000);
  await clickByText(page, 'Đến đây', `${zoneText} Den day`);
  await poll(page, () => !document.body.innerText.includes('Sơ đồ Chùa Hải An'), 120000, 'map closed');
}
async function clickMapHall(page) {
  await openMap(page);
  await sleep(5000);
  const ok = await page.evaluate(() => {
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
  console.log('click map hall Den day:', ok);
  await poll(page, () => !document.body.innerText.includes('Sơ đồ Chùa Hải An'), 120000, 'map closed');
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => { pageErrors++; console.log('PAGEERROR:', String(e).slice(0, 300)); });
  await page.goto('http://localhost:3101/', { timeout: 120000 });
  await sleep(15000);
  await clickByText(page, 'Bước vào chùa', 'Buoc vao chua');
  await sleep(10000);

  await clickMapHall(page);
  const hallArrived = await poll(page, () => [...document.querySelectorAll('button')].some((b) => (b.innerText || '').includes('Quỳ lễ')), 1800000, 'hall altar arrival (Quy le)');

  let gardenArrived = false;
  if (hallArrived) {
    await selectZoneGo(page, 'Vườn sau');
    let g = await waitForMarker(page, 420, 164, 'garden', 500000, 400000, 5);
    if (!g.ok && g.stalled) {
      console.log('garden stalled, re-issuing route ONCE');
      await selectZoneGo(page, 'Vườn sau');
      g = await waitForMarker(page, 420, 164, 'garden-retry', 400000, 400000, 4);
    }
    gardenArrived = g.ok;
    console.log('gardenArrived:', gardenArrived);
    await shot(page, 'arch4-garden-overview.png');
    await drag(page, -200);
    await shot(page, 'arch4-garden-overview2.png');
  } else {
    console.log('SKIP garden leg: hall did not arrive');
  }

  console.log('PAGEERRORS:', pageErrors);
  console.log('RESULT hall=', hallArrived, 'garden=', gardenArrived);
  await browser.close();
  process.exit(hallArrived && gardenArrived && pageErrors === 0 ? 0 : 1);
})().catch((e) => { console.error('TEST CRASH:', e.message.slice(0, 500)); process.exit(2); });
