// Fast lazy-load timing check: side GLBs must NOT fetch on the welcome
// screen, and MUST start fetching after entering. Guanyin stays eager.
const { chromium } = require('/home/hatch/workspace/mobile-test/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const glb = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('.glb')) glb.push(u.split('/').pop());
  });
  await page.goto('http://localhost:3101/', { timeout: 120000 });
  // Welcome screen: wait for the enter button, then 8s more for eager loads.
  for (let i = 0; i < 24; i++) {
    const ok = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('Bước vào chùa')));
    if (ok) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  await new Promise((r) => setTimeout(r, 8000));
  console.log('BEFORE enter, glb requests:', JSON.stringify(glb));
  const beforeSide = glb.filter((x) => x.includes('preview'));
  console.log('BEFORE enter, side previews fetched:', beforeSide.length, '(must be 0)');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('Bước vào chùa'));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 15000));
  console.log('AFTER enter, glb requests:', JSON.stringify(glb));
  const afterSide = glb.filter((x) => x.includes('preview'));
  console.log('AFTER enter, side previews fetched:', afterSide.length, '(must be 2)');
  const flame = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('🔥')));
  console.log('Flame pill visible after enter:', flame);
  await browser.close();
  const pass = beforeSide.length === 0 && afterSide.length === 2;
  console.log(pass ? 'LAZY LOAD PASS' : 'LAZY LOAD FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
