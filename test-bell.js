const { chromium } = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function clickByText(page, text) {
  return page.evaluate((t) => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => (x.textContent || '').includes(t));
    if (b) { b.click(); return true; } return false;
  }, text);
}
async function hasText(page, text) {
  return page.evaluate((t) => document.body.innerText.includes(t), text);
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
  // Click the map "Đến đây" whose card mentions Gác chuông
  const mapOk = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    for (const b of btns) {
      if ((b.textContent || '').includes('Đến đây')) {
        const card = b.closest('div');
        const txt = card ? card.innerText : '';
        if (txt.includes('Gác chuông')) { b.click(); return true; }
      }
    }
    return false;
  });
  console.log('click map bell Den day:', mapOk);
  const t0 = Date.now();
  let arrived = false;
  while (Date.now() - t0 < 1200000) {
    if (await hasText(page, 'Thỉnh chuông')) { arrived = true; break; }
    const el = Math.floor((Date.now() - t0) / 1000);
    if (el % 60 === 0) console.log('walking...', el, 's');
    await sleep(10000);
  }
  console.log('ARRIVED bell:', arrived, 'after', Math.floor((Date.now() - t0) / 1000), 's');
  await shot(page, 'bell-arrive.png');
  if (arrived) {
    console.log('click Thinh chuong:', await clickByText(page, 'Thỉnh chuông'));
    await sleep(2000);
    await shot(page, 'bell-ring.png');
    console.log('flame pill after ring:', await page.evaluate(() => {
      const pills = [...document.querySelectorAll('button, span, div')].map(e => e.textContent || '').filter(s => s.includes('🔥'));
      return pills.slice(0, 3);
    }));
    console.log('bell indicator visible:', await hasText(page, 'Đang thỉnh chuông'));
  }
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
