// Request C sweep test (Playwright, :3101, software rendering).
// Flow: enter -> map to Sân đa -> nudge to broom -> start sweep ->
// pause/resume check -> full sweep to final dialog.
// Leaf counts come from window.__sweepLeaves (Grounds test hook).
const { chromium } = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

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
async function counts(page) {
  try {
    return await page.evaluate(() => {
      const ls = window.__sweepLeaves || [];
      const c = { total: ls.length, ground: 0, sliding: 0, piled: 0, collecting: 0, collected: 0 };
      for (const l of ls) c[l.state] = (c[l.state] || 0) + 1;
      return c;
    });
  } catch { return null; }
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
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
  await page.goto('http://localhost:3101/', { timeout: 120000 });
  await page.waitForTimeout(15000);
  await clickByText(page, 'Bước vào chùa', 'Buoc vao chua');
  await page.waitForTimeout(10000);
  console.log('initial leaves:', await counts(page));
  await clickByText(page, 'Sơ đồ chùa', 'So do chua');
  await page.waitForTimeout(5000);
  await clickByText(page, '🌳 Sân đa', 'select banyan zone');
  await page.waitForTimeout(5000);
  await clickByText(page, 'Đến đây', 'map banyan Den day');
  // Map walk to banyan (~19m, VM ~0.06 m/s) — wait up to 600s for map close + time to arrive.
  await poll(page, () => !document.body.innerText.includes('Sơ đồ Chùa Hải An'), 120000, 'map closed');
  console.log('waiting for banyan arrival (fixed 420s)…');
  await page.waitForTimeout(420000);
  // Nudge west+south toward the broom (A + S) so the broom button triggers (<2.0m).
  try {
    await page.keyboard.down('a');
    await page.keyboard.down('s');
    await page.waitForTimeout(15000);
    await page.keyboard.up('a');
    await page.keyboard.up('s');
    console.log('nudge done');
  } catch (e) { console.log('nudge fail:', e.message.slice(0, 120)); }
  const broomOk = await poll(page, () => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some((b) => (b.innerText || '').trim().startsWith('🧹 Quét lá') || (b.innerText || '').trim() === '🧹 Quét lá');
  }, 180000, 'broom ctx button');
  if (!broomOk) {
    console.log('leaves at broom fail:', await counts(page));
    await shot(page, 'sweep-fail-broom.png');
    await browser.close();
    return;
  }
  await clickByText(page, 'Quét lá', 'ctx Quet la');
  // Sweep bar appears on preparing (after auto-walk to sweep spot, ~1-2m).
  const barOk = await poll(page, () => document.body.innerText.includes('Đang quét lá dưới gốc đa'), 300000, 'sweep bar');
  console.log('leaves at sweep start:', await counts(page));
  await shot(page, 'sweep-start.png');
  if (!barOk) { await browser.close(); return; }
  // Wait until sweeping phase text, then pause check.
  await poll(page, () => document.body.innerText.includes('Đang quét — từng nhát'), 600000, 'sweeping phase');
  await page.waitForTimeout(60000);
  const beforePause = await counts(page);
  console.log('before pause:', beforePause);
  await clickByText(page, 'Tạm dừng', 'pause');
  await page.waitForTimeout(5000);
  const paused1 = await counts(page);
  console.log('paused (t0):', paused1);
  await page.waitForTimeout(120000);
  const paused2 = await counts(page);
  console.log('paused (t+120s, must equal t0):', paused2);
  console.log('PAUSE FROZEN:', JSON.stringify(paused1) === JSON.stringify(paused2));
  await clickByText(page, 'Tiếp tục', 'resume');
  await page.waitForTimeout(60000);
  console.log('after resume (+60s):', await counts(page));
  await shot(page, 'sweep-mid.png');
  // Full sweep to final dialog (timeline 13s at VM speed ~12 min + margin).
  const done = await poll(page, () => document.body.innerText.includes('Một khoảng sân sạch, một phút giây an yên.'), 1500000, 'final dialog');
  const fin = await counts(page);
  console.log('final leaves:', fin);
  await shot(page, 'sweep-end.png');
  const clean = done && fin && fin.collected === fin.total && fin.ground === 0 && fin.piled === 0;
  console.log(clean ? 'SWEEP TEST PASS (yard fully clean)' : `SWEEP TEST FAIL: dialog=${done} final=${JSON.stringify(fin)}`);
  await browser.close();
})().catch((e) => { console.error('TEST ERROR:', e); process.exit(1); });
