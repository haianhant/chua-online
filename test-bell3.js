const { chromium } = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function clickByText(page, text) {
  return page.evaluate((t) => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => (x.textContent || '').includes(t));
    if (b) { b.click(); return true; } return false;
  }, text);
}
// ctxAction button only: exact text "🔔 Thỉnh chuông", never the map list label.
async function hasCtxBell(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('button')].some(b => (b.textContent || '').trim() === '🔔 Thỉnh chuông');
  });
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
  // Map: find the LIST title "🔔 Gác chuông" (the SVG map text is
  // plain "Gác chuông" without emoji, so it cannot match), walk up
  // to its card, click that card's "Đến đây" button. Never walk up
  // to the modal root (it contains every zone + the SVG).
  const mapOk = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('*')].filter(el =>
      el.tagName !== 'TEXT' && el.children.length === 0 &&
      (el.textContent || '').trim() === '🔔 Gác chuông');
    for (const title of titles) {
      let card = title;
      for (let i = 0; i < 5 && card; i++) {
        card = card.parentElement;
        if (!card) break;
        const btn = [...card.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Đến đây');
        if (btn) { btn.click(); return true; }
      }
    }
    return false;
  });
  console.log('click map bell Den day:', mapOk);
  const t0 = Date.now();
  let arrived = false;
  while (Date.now() - t0 < 1200000) {
    if (await hasCtxBell(page)) { arrived = true; break; }
    const el = Math.floor((Date.now() - t0) / 1000);
    if (el % 60 === 0) console.log('walking...', el, 's');
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
