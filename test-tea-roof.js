// D retest (roof fix only): map to tea, then drag-look UP so the
// tea roof (above the follow camera's normal downward view) comes
// into frame, then sit/stand. Route already passed in the first D
// test; this run proves the roof is now over the tea house.
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
  let mapClosed = false;
  for (let i = 0; i < 30; i++) {
    const open = await page.evaluate(() => document.body.innerText.includes('Sơ đồ Chùa Hải An'));
    if (!open) { mapClosed = true; break; }
    await sleep(10000);
  }
  console.log('map closed:', mapClosed);
  // Walk ~900s (route ~44m at VM speed), then tea shots.
  await sleep(900000);
  await shot(page, 'd2-tea-arrival.png');
  // Drag-look UP: drag mouse upward to tilt the camera up toward the roof.
  try {
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(640, 100, { steps: 20 });
    await page.mouse.up();
    await sleep(5000);
  } catch (e) { console.log('drag failed', String(e).slice(0, 120)); }
  await shot(page, 'd2-tea-roof-up.png');
  const sitBtn = await clickByText(page, 'Ngồi', 180000);
  console.log('click sit (Ngồi):', sitBtn);
  await sleep(15000);
  await shot(page, 'd2-tea-seated.png');
  const standBtn = await clickByText(page, 'Đứng dậy', 120000);
  console.log('click stand (Đứng dậy):', standBtn);
  console.log('PAGEERRORS:', errors.length, errors.slice(0, 3));
  console.log('D RETEST DONE');
  await browser.close();
})().catch((e) => { console.error('D RETEST ERROR', e); process.exit(1); });
