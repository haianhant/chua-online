const { chromium } = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function clickByText(page, text) {
  return page.evaluate((t) => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => (x.textContent || '').includes(t));
    if (b) { b.click(); return true; } return false;
  }, text);
}
async function hasCtxBell(page) {
  return page.evaluate(() => [...document.querySelectorAll('button')].some(b => (b.textContent || '').trim() === '🔔 Thỉnh chuông'));
}
async function clickCtxBell(page) {
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '🔔 Thỉnh chuông');
    if (b) { b.click(); return true; } return false;
  });
}
async function shot(page, name) {
  try { await page.screenshot({ path: '/home/hatch/workspace/chua-online/test-shots/' + name, timeout: 180000, animations: 'disabled' }); console.log('SHOT OK', name); }
  catch (e) { console.log('SHOT FAIL', name, String(e).slice(0, 120)); }
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.goto('http://localhost:3101/', { timeout: 120000 });
  console.log('goto');
  await sleep(8000);
  console.log('click Buoc vao chua:', await clickByText(page, 'Bước vào chùa'));
  await sleep(5000);
  console.log('click So do chua:', await clickByText(page, 'Sơ đồ chùa'));
  await sleep(5000);
  // Map zones need TWO clicks: first select the bell zone (this is
  // what makes its "Đến đây" button appear; initial zone is hall),
  // then click that "Đến đây" button.
  console.log('select bell zone:', await clickByText(page, '🔔 Gác chuông'));
  let denDay = false;
  for (let i = 0; i < 15 && !denDay; i++) {
    await sleep(2000);
    denDay = await clickByText(page, 'Đến đây');
    // clickByText clicks the FIRST "Đến đây" button; after selecting
    // bell, that button IS bell's (only selected zone shows one).
    if (denDay) break;
  }
  console.log('click map bell Den day:', denDay);
  await sleep(5000);
  console.log('map closed after Den day:', await page.evaluate(() => !document.body.innerText.includes('Sơ đồ Chùa Hải An')));
  const t0 = Date.now();
  let arrived = false;
  while (Date.now() - t0 < 1200000) {
    if (await hasCtxBell(page)) { arrived = true; break; }
    const el = Math.floor((Date.now() - t0) / 1000);
    if (el % 60 < 10) console.log('walking...', el, 's');
    await sleep(10000);
  }
  console.log('ARRIVED bell:', arrived, 'after', Math.floor((Date.now() - t0) / 1000), 's');
  await shot(page, 'bell-arrive.png');
  if (arrived) {
    console.log('click Thinh chuong (ctx button):', await clickCtxBell(page));
    await sleep(2000);
    await shot(page, 'bell-ring.png');
    console.log('flame pill after ring:', await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, span, div')].map(e => (e.textContent || '').trim()).filter(s => s === '🔥 1' || s === '🔥 0');
      return els.slice(0, 3);
    }));
    console.log('bell indicator visible:', await page.evaluate(() => document.body.innerText.includes('Đang thỉnh chuông')));
  }
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
