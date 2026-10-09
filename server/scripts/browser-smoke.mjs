import { createRequire } from 'node:module';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sou-smoke-'));
process.env.SOU_DATA_DIR = path.join(tmp, 'data');
process.env.SOU_UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.PORT = '0';
process.env.NODE_ENV = 'test';

const app = require('../server.js');
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
];

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    for (const exe of CHROME_CANDIDATES) {
      if (fs.existsSync(exe)) return chromium.launch({ executablePath: exe, headless: true });
    }
    throw e;
  }
}

const results = [];
function check(name, cond, extra) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${cond ? '' : ' :: ' + (extra || '')}`);
}

function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (/\.(svg|png|jpe?g|webp|ico|heic)(\?|$)/i.test(u)) return;
    if (u.startsWith('data:')) return;
    errors.push('requestfailed: ' + u + ' ' + ((r.failure() && r.failure().errorText) || ''));
  });
  return errors;
}

async function login(page, email, password) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.click('#acctBox');
  await page.waitForSelector('#loginEmail', { state: 'visible', timeout: 10000 });
  await page.fill('#loginEmail', email);
  await page.fill('#loginPass', password);
  await page.click('#loginForm button[type="submit"]');
  await page.waitForFunction(() => document.getElementById('acctModal').hidden === true, null, { timeout: 20000 });
}

const browser = await launchBrowser();

/* ---------------- Storefront + checkout ---------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = watch(page);

  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article.prd[data-id]', { timeout: 20000 });
  const prodCount = await page.locator('article.prd[data-id]').count();
  check('storefront: homepage lists products', prodCount > 5, 'count=' + prodCount);

  const pid = await page.locator('article.prd[data-id]').first().getAttribute('data-id');
  await page.evaluate((id) => { location.hash = '#/p/' + id; }, pid);
  await page.waitForFunction(() => {
    const el = document.getElementById('pdpName');
    return el && el.textContent.trim().length > 0;
  }, null, { timeout: 20000 });
  const pdpName = (await page.textContent('#pdpName')).trim();
  check('storefront: product page renders', pdpName.length > 0, 'name=' + pdpName);

  await page.click('#pdpAdd');
  await page.waitForFunction(() => Number((document.getElementById('cartCount') || {}).textContent || 0) > 0, null, { timeout: 10000 });
  const badge = await page.textContent('#cartCount');
  check('storefront: add to cart updates badge', Number(badge) > 0, 'badge=' + badge);

  await login(page, 'customer@demo.ug', 'customer123');
  check('customer: sign-in closes modal', true);

  await page.goto(base + '/#/checkout', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#coName', { state: 'visible', timeout: 10000 });
  await page.evaluate(() => {
    const s = document.getElementById('coRegion');
    const opt = [...s.options].find((o) => o.value);
    if (opt) { s.value = opt.value; s.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.fill('#coName', 'Smoke Shopper');
  await page.fill('#coPhone', '0771234567');
  await page.fill('#coEmail', 'smoke.shopper@demo.ug');
  await page.fill('#coTown', 'Kampala');
  await page.fill('#coAddr', 'Plot 5 Smoke Street');
  await page.click('#coPlace');
  await page.waitForFunction(() => {
    const p = document.getElementById('successPage');
    const n = document.getElementById('orderNo');
    return p && !p.hidden && n && n.textContent.trim().length > 0;
  }, null, { timeout: 20000 });
  const orderNo = (await page.textContent('#orderNo')).trim();
  check('checkout: server order placed', orderNo.length > 0, 'orderNo=' + orderNo);

  await page.evaluate(() => { location.hash = '#/orders'; });
  await page.waitForFunction((no) => {
    const list = document.getElementById('ordersList');
    return list && list.textContent.includes(no);
  }, orderNo, { timeout: 20000 }).catch(() => {});
  const ordersTxt = await page.textContent('#ordersList');
  check('checkout: order appears in My Orders', ordersTxt.includes(orderNo), 'orderNo=' + orderNo);

  check('storefront flow: no console/page/network errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ---------------- Rider portal ---------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = watch(page);

  await login(page, 'rider@demo.ug', 'rider123');
  await page.evaluate(() => { location.hash = '#/driver'; });
  await page.waitForFunction(() => {
    const b = document.getElementById('driverBody');
    return b && /Open pickups/.test(b.textContent);
  }, null, { timeout: 20000 });
  const dash = await page.textContent('#driverBody');
  check('rider: dashboard renders jobs', /Open pickups/.test(dash));
  check('rider: dashboard shows rider status', /approved/.test(dash), dash.slice(0, 120));
  check('rider: stats render', /Earnings/.test(dash) && /Rating/.test(dash));

  check('rider flow: no console/page/network errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ---------------- Admin delivery tab ---------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = watch(page);

  await login(page, 'admin@shoponline.ug', 'admin123');
  await page.waitForSelector('#adminTop .ptabs button[data-adm="delivery"]', { timeout: 20000 });
  await page.click('#adminTop .ptabs button[data-adm="delivery"]');
  await page.waitForFunction(() => {
    const p = document.getElementById('adminPanel');
    return p && /Riders/.test(p.textContent) && /Deliveries/.test(p.textContent) && !/Loading admin/.test(p.textContent);
  }, null, { timeout: 20000 });
  const panel = await page.textContent('#adminPanel');
  const rows = await page.locator('#adminPanel table.tbl tbody tr').count();
  check('admin: delivery tab renders riders + deliveries', /Riders/.test(panel) && /Deliveries/.test(panel));
  check('admin: delivery table has rows', rows > 0, 'rows=' + rows);
  check('admin: dispatch controls present', /Choose rider/.test(panel) || /Assign/.test(panel) || /Cancel/.test(panel));

  await page.click('#admDelRef');
  await page.waitForFunction(() => {
    const p = document.getElementById('adminPanel');
    return p && /Deliveries/.test(p.textContent);
  }, null, { timeout: 20000 });
  check('admin: refresh re-renders delivery tab', true);

  check('admin flow: no console/page/network errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
await new Promise((r) => server.close(r));

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED: ' + failed.map((f) => f.name).join('; '));
  process.exitCode = 1;
}
