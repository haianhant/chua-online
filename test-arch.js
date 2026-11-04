// Architecture-pass retest v2 (Playwright, :3101, software rendering).
// Fixes the v1 test-design flaws:
// - v1 matched ANY 'Ngồi tại đây' button: the tea route passes
//   within 1.4m of the corridor chair (13.5,-2), so v1 sat the
//   player there instead of the tea seat. v2 confirms arrivals
//   with the map's live 'Bạn đang ở đây' marker (text x/y carry
//   the exact player position) before touching any seat button.
// - v1 re-issued the garden route on every check, resetting the
//   walk each time. v2 never re-issues unless the marker stalls
//   twice in a row (then exactly once).
// - v1 tried to stand after a fixed 20s; v2 polls for the
//   'Đứng dậy' button (sit walk + blend at VM speed) and for its
//   disappearance after standing, before moving on.
// Flow: tea (marker) -> sit -> sit + table-front shots -> stand
// -> hall (Quy le) -> statue east/west shots -> garden (marker)
// -> overview shots. Exit 0 only if all arrivals + sit + stand
// + PAGEERRORS 0.
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
// Poll the live map marker until it is near (tx,ty) [svg coords].
// initialWaitMs first (the walk itself), then checks every
// checkMs. Never re-issues the route; returns {ok, stalled}.
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

  // --- Tea leg: marker porch target (18.5,-19.5) -> text (425,129) ---
  await selectZoneGo(page, 'Nhà trà');
  const tea = await waitForMarker(page, 425, 129, 'tea porch', 500000, 300000, 5);
  const teaArrived = tea.ok;
  console.log('teaArrived:', teaArrived);
  let sitOk = false, standOk = false;
  if (teaArrived) {
    await clickByText(page, 'Ngồi tại đây', 'sit tea seat');
    sitOk = await poll(page, () => [...document.querySelectorAll('button')].some((b) => (b.innerText || '').includes('Đứng dậy')), 300000, 'seated (Dung day appears)');
    if (sitOk) {
      await sleep(10000);
      await shot(page, 'arch2-tea-sit.png');
      await drag(page, 600);
      await shot(page, 'arch2-tea-tablefront.png');
      await drag(page, -600);
      await clickByText(page, 'Đứng dậy', 'stand up');
      standOk = await poll(page, () => ![...document.querySelectorAll('button')].some((b) => (b.innerText || '').includes('Đứng dậy')), 180000, 'stood (Dung day gone)');
    }
    await shot(page, 'arch2-tea-porch.png');
    await drag(page, 300);
    await shot(page, 'arch2-tea-porch2.png');
    await drag(page, -300);
  }

  // --- Hall leg (only after standing, so the walk can start) ---
  let hallArrived = false;
  if (standOk) {
    await clickMapHall(page);
    hallArrived = await poll(page, () => [...document.querySelectorAll('button')].some((b) => (b.innerText || '').includes('Quỳ lễ')), 1800000, 'hall altar arrival (Quy le)');
    if (hallArrived) {
      await sleep(5000);
      await shot(page, 'arch2-statue-centre.png');
      await drag(page, 200);
      await shot(page, 'arch2-statue-east.png');
      await drag(page, -400);
      await shot(page, 'arch2-statue-west.png');
      await drag(page, 200);
    }
  } else {
    console.log('SKIP hall leg: stand did not confirm');
  }

  // --- Garden leg: marker garden target (18,-16) -> text (420,164) ---
  let gardenArrived = false;
  if (hallArrived || standOk) {
    await selectZoneGo(page, 'Vườn sau');
    let g = await waitForMarker(page, 420, 164, 'garden', 500000, 400000, 5);
    if (!g.ok && g.stalled) {
      console.log('garden stalled, re-issuing route ONCE');
      await selectZoneGo(page, 'Vườn sau');
      g = await waitForMarker(page, 420, 164, 'garden-retry', 400000, 400000, 4);
    }
    gardenArrived = g.ok;
    console.log('gardenArrived:', gardenArrived);
    await shot(page, 'arch2-garden-overview.png');
    await drag(page, -200);
    await shot(page, 'arch2-garden-overview2.png');
  } else {
    console.log('SKIP garden leg: stand did not confirm');
  }

  console.log('PAGEERRORS:', pageErrors);
  console.log('RESULT tea=', teaArrived, 'sit=', sitOk, 'stand=', standOk, 'hall=', hallArrived, 'garden=', gardenArrived);
  await browser.close();
  process.exit(teaArrived && sitOk && standOk && hallArrived && gardenArrived && pageErrors === 0 ? 0 : 1);
})().catch((e) => { console.error('TEST CRASH:', e.message.slice(0, 500)); process.exit(2); });
