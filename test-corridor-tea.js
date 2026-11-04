// D test: map auto-walk spawn -> tea (through the NEW corridor +
// garden path), interval screenshots during the walk (to catch the
// corridor interior), then tea-seat sit/stand on the new platform.
// VM walk is ~0.06 m/s, route ~44m, so the walk alone is ~750s.
const pw = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const OUT = '/home/hatch/workspace/chua-online/test-shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickByText(page, text, timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await page.evaluate((txt) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find((el) => (el.innerText || '').trim().includes(txt));
      if (!b) return false;
      b.click();
      return true;
    }, text);
    if (ok) return true;
    await sleep(10000);
  }
  return false;
}
async function pollText(page, text, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await page.evaluate((txt) => document.body.innerText.includes(txt), text);
    if (ok) return true;
    await sleep(10000);
  }
  return false;
}
async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(OUT, name), timeout: 180000, animations: 'disabled' });
    console.log('SHOT OK', name);
  } catch (e) { console.log('SHOT FAIL', name, String(e).slice(0, 120)); }
}
(async () => {
  const browser = await pw.chromium.launch({
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3101/', { timeout: 120000 });
  await sleep(15000);
  console.log('click Buoc vao chua:', await clickByText(page, 'Bước vào chùa', 120000));
  await sleep(10000);
  console.log('click So do chua:', await clickByText(page, 'Sơ đồ chùa', 120000));
  console.log('click select tea zone:', await clickByText(page, 'Nhà trà', 120000));
  console.log('click map tea Den day:', await clickByText(page, 'Đến đây', 120000));
  // Map closed?
  let mapClosed = false;
  for (let i = 0; i < 30; i++) {
    const open = await page.evaluate(() => document.body.innerText.includes('Sơ đồ Chùa Hải An'));
    if (!open) { mapClosed = true; break; }
    await sleep(10000);
  }
  console.log('map closed:', mapClosed);
  // Interval shots during the walk (corridor is roughly mid-route).
  for (let i = 1; i <= 12; i++) {
    await sleep(60000);
    await shot(page, `d-walk-${String(i).padStart(2, '0')}.png`);
  }
  await shot(page, 'd-tea-arrival.png');
  // Tea seat: poll for a sit button, sit, then stand.
  const sitBtn = await clickByText(page, 'Ngồi', 180000);
  console.log('click sit (Ngồi):', sitBtn);
  await sleep(15000);
  await shot(page, 'd-tea-seated.png');
  const standBtn = await clickByText(page, 'Đứng dậy', 120000);
  console.log('click stand (Đứng dậy):', standBtn);
  await sleep(10000);
  await shot(page, 'd-tea-stood.png');
  console.log('PAGEERRORS:', errors.length, errors.slice(0, 3));
  console.log('D TEST DONE');
  await browser.close();
})().catch((e) => { console.error('D TEST ERROR', e); process.exit(1); });
