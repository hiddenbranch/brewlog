/* The whole app in a real browser at phone size: first open, the example batch, a recipe from a style, a guided brew day with the clock
   run forward, gravity readings, the shop, pasting a recipe in, share links, the batch card, backup and restore, the back button, dates
   late in the evening, and registration in each of its modes. It serves this folder itself, so nothing else needs to be running.

     npm install playwright && npx playwright install chromium      (once)
     node test-walk.mjs                       every check, no pictures
     node test-walk.mjs --shots shots         the same, and a screenshot of each screen into ./shots
     node test-walk.mjs https://hiddenbranch.github.io/brewlog/     against the live site instead of this folder

   smoke.js covers the same screens in jsdom in a few seconds; this one is the slow, honest version. */
import { chromium } from 'playwright';
import fs from 'node:fs'; import http from 'node:http'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2), shotAt = args.indexOf('--shots'), out = shotAt >= 0 ? path.resolve(args[shotAt + 1] || 'shots') : null;
const given = args.find((x, i) => /^https?:/.test(x) && i !== shotAt + 1);
if (out) fs.mkdirSync(out, { recursive: true });
const tmp = out || fs.mkdtempSync(path.join(os.tmpdir(), 'brewlog-walk-'));     // downloads the checks read back land here
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
async function serve() {     // this folder, on any free port
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(dir, p); if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, body) => { if (err) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); return 'http://127.0.0.1:' + server.address().port + '/';
}
const base = given || await serve();
const browser = await chromium.launch();
const fails = [], errs = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log('  FAIL: ' + what); } };
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', locale: 'en-US' };
async function open(opts = {}) {
  const ctx = await browser.newContext(Object.assign({}, phone, opts.ctx || {}));
  if (opts.clipboard) await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e.stack || e))); page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  if (opts.clock) await page.clock.install({ time: new Date(opts.clock) });
  if (opts.register) await page.route('**/register.js*', r => r.fulfill({ contentType: 'text/javascript', body: 'window.BREWLOG_REGISTER = ' + JSON.stringify(opts.register) + ';' }));
  const posts = []; await page.route('https://docs.google.com/**', r => { posts.push({ url: r.request().url(), body: r.request().postData() }); r.fulfill({ status: 200, body: 'ok' }); });
  await page.goto(opts.url || base); await page.waitForFunction(() => !document.querySelector('#view noscript') && document.querySelector('#view h2, #view h3'));
  const p = { page, ctx, posts };
  p.text = () => page.locator('#view').innerText();
  p.shot = async (name, full) => { await page.waitForTimeout(250); if (out) await page.screenshot({ path: `${out}/${name}.png`, fullPage: !!full }); };
  p.tab = async t => { await page.click(`nav.tabs button[data-tab="${t}"]`); await page.waitForTimeout(250); };
  p.btn = async (name, exact = true) => { await page.locator('#view').getByRole('button', { name, exact }).first().click(); await page.waitForTimeout(300); };
  p.field = label => page.locator('#view label.field', { has: page.locator(`> span:text-is("${label}")`) }).locator('input, select, textarea').first();
  p.has = async t => (await p.text()).includes(t);
  return p;
}
const section = n => console.log('\n== ' + n);

// ---------- A. first open ----------
section('first open');
let a = await open({ clock: '2026-11-10T16:00:00-06:00' });
check(await a.has('Welcome to Brew Log'), 'welcome shows on an empty app');
check(!(await a.page.locator('#installBtn').isVisible()), 'the Install button is hidden when the browser cannot install');
check(await a.page.locator('#view .chip').count() === 4, 'four system chips: ' + await a.page.locator('#view .chip').count());
await a.shot('01-welcome', true);
await a.btn('Brew in a bag');
check(!(await a.has('What do you brew on?')), 'system picker goes once a system is chosen');
await a.page.click('#gearBtn'); await a.page.waitForTimeout(250);
check(await a.field('System name').inputValue() === 'Brew in a bag', 'profile named after the system');
check(await a.page.locator('#view input[type=checkbox]').first().isChecked(), 'no-sparge ticked for brew in a bag');
check(!(await a.has('null')), 'Settings no longer prints "null"');
check(await a.field('Mash ratio (qt per lb)').isDisabled(), 'mash ratio greyed out when there is no sparge');
await a.shot('02-settings', true);

// ---------- B. the example batch ----------
section('example batch');
await a.tab('batches'); await a.btn('Look at a finished batch first', false);
check(await a.has('Example: Citra pale ale'), 'example batch opens');
check(await a.page.locator('#view svg[role=img]').count() === 1, 'fermentation chart drawn');
let t = await a.text();
check(/OG\s*\n?\s*1\.052/.test(t.replace(/\n+/g, '\n')) || t.includes('1.052'), 'measured OG shown'); check(/ABV[\s\S]{0,40}5\.6\d%/.test(t), 'ABV from measured gravities: ' + (t.match(/ABV[\s\S]{0,30}/) || [''])[0].replace(/\n/g, ' '));
check(t.includes('Mash efficiency'), 'efficiency achieved shown'); check(/final, 80\.\d% attenuation/.test(t), 'a packaged batch shows its final gravity and attenuation'); check(/171 calories per 12 oz/.test(t), 'calories for a 5.6% pale ale: ' + (t.match(/\d+ calories/) || [''])[0]);
check(t.includes('Brew day, as it happened'), 'brew day actuals table');
await a.shot('03-example-batch', true);
await a.page.goBack(); await a.page.waitForTimeout(400);
check(await a.has('Batches') && await a.has('example'), 'browser back returns to the batch list, with the example badged');
check(!(await a.has('so far')), 'the example does not count in the year\'s stats');
await a.shot('04-batch-list');

// ---------- C. a recipe becomes a batch ----------
section('recipe to batch');
await a.tab('ref'); await a.btn('Styles and recipes', false);
await a.page.locator('#view .rec', { hasText: 'American IPA' }).first().getByRole('button', { name: 'Open' }).click(); await a.page.waitForTimeout(300);
check(a.page.url().includes('#ref/recipe%3AAmerican%20IPA'), 'the recipe has its own address: ' + a.page.url());
await a.shot('05-recipe', true);
await a.btn(/^Brew this/, false);
check(await a.has('American IPA') && await a.has('Planned'), 'batch created from the recipe');
check(/log a gravity reading before you pitch/.test(await a.text()), 'OG line says how to record it');
await a.shot('06-planned-batch', true);

// ---------- D. brew day, no sparge, alarms ----------
section('brew day');
await a.btn('Brew day');
t = await a.text();
check(t.includes('all of it, no sparge'), 'sheet: strike water is all the water'); check(!t.includes('Sparge water'), 'sheet: no sparge line'); check(t.includes('Bag or basket lifted and drained'), 'sheet: drain step instead of sparge');
await a.shot('07-brewday-sheet', true);
await a.btn(/^Go:/, false);
check((await a.text()).includes('all the water, no sparge'), 'guided: strike step knows there is no sparge');
await a.btn('Water is at temperature');
check(await a.has('Mash in'), 'guided: on to the mash');
await a.btn(/^Start 60-minute timer/, false);
await a.page.clock.runFor(2000);
check(/5[789]:\d\d/.test(await a.page.locator('.timer').innerText()), 'mash timer counting down: ' + await a.page.locator('.timer').innerText());
await a.tab('calc'); await a.page.clock.runFor(2000);
check(await a.page.locator('#timerPill').isVisible(), 'timer shows in the header on another tab'); check(/next in/.test(await a.page.locator('#timerPill').innerText()), 'pill shows the countdown: ' + await a.page.locator('#timerPill').innerText());
await a.shot('08-timer-pill');
await a.page.clock.runFor(30 * 60 * 1000);
check(await a.page.locator('#timerPill.ring').count() === 1, 'pill flashes when the halfway alarm is due');
await a.page.click('#timerPill'); await a.page.waitForTimeout(300); await a.page.clock.runFor(1500);
check(await a.page.locator('.step.ringing').count() === 1, 'the due alarm is marked on the guided screen');
await a.shot('09-alarm-ringing');
await a.page.locator('.step.ringing').getByRole('button', { name: 'Done' }).click(); await a.page.waitForTimeout(300); await a.page.clock.runFor(1500);
check(await a.page.locator('.step.ringing').count() === 0, 'ticking the alarm stops it');
await a.tab('brewday');
check(await a.has('Mash in') && !(await a.has('Steps')), 'the Brew day tab lands back on the guided brew day while one is running');
await a.page.reload(); await a.page.waitForFunction(() => !document.querySelector('#view noscript') && document.querySelector('#view h2')); await a.page.clock.runFor(1500);
check(/2\d:\d\d/.test(await a.page.locator('.timer').innerText()), 'after a reload the timer is where it should be: ' + await a.page.locator('.timer').innerText());

// ---------- E. gravity: OG, readings, chart ----------
section('gravity');
await a.tab('batches'); await a.page.locator('#view .rec', { hasText: 'American IPA' }).getByRole('button', { name: 'Open', exact: true }).click(); await a.page.waitForTimeout(300);
await a.btn('Log gravity');
check(await a.page.locator('#view input[type=checkbox]').isChecked(), 'first reading of a new batch is offered as the OG');
await a.field('Specific gravity').fill('1.062'); await a.btn('Save');
t = await a.text(); check(/1\.062/.test(t) && t.includes('the recipe estimated'), 'OG recorded on the batch'); check(t.includes('Mash efficiency'), 'efficiency worked out from the measured OG');
for (const [d, sg, f] of [['2026-11-13', '1.030', '67'], ['2026-11-17', '1.012', '68'], ['2026-11-20', '1.012', '68']]) {
  await a.btn('Log gravity'); check(!(await a.page.locator('#view input[type=checkbox]').isChecked()), 'later readings are not the OG');
  await a.field('Date').fill(d); await a.field('Specific gravity').fill(sg); await a.field('Fermenter temp (F), optional').fill(f); await a.btn('Save');
}
t = await a.text();
check(t.includes('stable 3 days: ready to package'), 'two matching readings three days apart: ready'); check(/ABV[\s\S]{0,40}6\.[4-9]\d?%/.test(t), 'ABV from the readings: ' + (t.match(/ABV[\s\S]{0,24}/) || [''])[0].replace(/\n/g, ' '));
check(await a.page.locator('#view svg[role=img]').count() === 1, 'chart appears with the readings'); check(t.includes('day 10'), 'chart runs on days, not on the order of the readings');
await a.shot('10-fermenting', true);
await a.tab('batches'); check(/American IPA[\s\S]{0,120}6\.\d+%/.test(await a.text()), 'ABV shows on the batch list');

// ---------- F. the shop: cart and cost ----------
section('shop');
await a.tab('shop'); await a.page.waitForTimeout(600);
t = await a.text();
const cart = a.page.locator('#view a.btn', { hasText: 'Add all to cart' });
check(await cart.count() === 1, 'one-tap cart button present'); if (await cart.count()) check(/\/cart\/\d+:\d+/.test(await cart.getAttribute('href')), 'cart link carries the items');
check(/About (\$\d+\.\d\d|\d+¢) a pint/.test(t), 'cost per pint: ' + (t.match(/About[^\n]{0,80}/) || ['none'])[0]);
check(/Most shops sell an American IPA recipe kit/.test(t), '"an American IPA", not "a American IPA"');
await a.shot('11-shop', true);

// ---------- G. bring a recipe in ----------
section('import');
await a.tab('batches'); await a.btn('Bring a recipe in');
await a.page.locator('#view textarea').fill('Citra Pale Ale (5 gal)\n\n10 lbs 2-row\n1 lb Crystal 40\n8 oz Carapils\n1 lb Weyermann Carared\n\n0.5 oz Magnum (12% AA) @ 60 min\n1 oz Citra @ 10 min\n1 oz Citra at flameout\n2 oz Citra dry hop 5 days\n\nUS-05\nMash at 152F for 60 min\nOG 1.054  FG 1.011  IBU 38');
await a.btn('Read the recipe');
t = await a.text();
check(t.includes('What it read') && t.includes('2-row pale malt') && t.includes('Crystal / Caramel 40L'), 'ingredients recognised'); check(t.includes('Not in the app\'s lists: Weyermann Carared'), 'the unknown malt is flagged, not dropped');
check(t.includes('the recipe says 1.054'), 'the recipe\'s own OG shown beside ours');
await a.shot('12-import', true);
await a.btn('Looks right: make it a batch');
check(await a.has('Check the recipe'), 'lands on the batch form to check'); check(await a.field('Name').inputValue() === 'Citra Pale Ale', 'name carried in'); check(await a.field('Batch size (gal)').inputValue() === '5', 'batch size carried in');
check(await a.has('The recipe as written'), 'form shows what the recipe claimed');
await a.shot('13-import-form', true);
await a.btn('Create batch');
check(await a.has('Citra Pale Ale') && await a.has('Planned'), 'imported recipe saved as a batch');

// ---------- H. a blank new batch ----------
section('new batch form');
await a.tab('batches'); await a.btn('New batch');
t = await a.text(); check(!t.includes('null') && !t.includes('1.000'), 'empty batch shows no "1.000 / null%"'); check(t.includes('Add the grain and hops below'), 'empty batch says what to do');
await a.shot('14-new-batch');

// ---------- I. share a recipe, and open it as somebody else ----------
section('share');
await a.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await a.tab('batches'); await a.page.locator('#view .rec', { hasText: /Citra Pale Ale/ }).first().getByRole('button', { name: 'Open', exact: true }).click(); await a.page.waitForTimeout(300);
await a.btn('Share recipe');
const clip = await a.page.evaluate(() => navigator.clipboard.readText()), link = (clip.match(/https?:\S+#r=\S+/) || [''])[0];
check(/10 lb 2-row pale malt/.test(clip) && link.length > 60, 'share text and link copied: ' + link.length + ' chars');
let s = await open({ url: link });
t = await s.text(); check(t.includes('A recipe someone sent you') && t.includes('Citra Pale Ale') && t.includes('Weyermann Carared'), 'the link opens the recipe in a fresh browser');
await s.shot('15-shared', true);
await s.btn('Shop for it'); await s.page.waitForTimeout(600);
check(await s.has('Shopping for Citra Pale Ale') && await s.page.locator('#view a.btn', { hasText: 'Add all to cart' }).count() === 1, 'a shared recipe can go straight to a cart, with no batch and no registration');
await s.page.goBack(); await s.page.waitForTimeout(400); await s.btn('Save to my batches');
check(await s.has('Planned') && await s.has('Citra Pale Ale'), 'the recipient saves it as their own batch');
await s.ctx.close();

// ---------- J. batch card, rebrew ----------
section('card and rebrew');
const dl1 = a.page.waitForEvent('download'); await a.btn('Batch card'); const card = await dl1; await card.saveAs(`${tmp}/batch-card.png`);
check(fs.statSync(`${tmp}/batch-card.png`).size > 20000, 'batch card picture made');
await a.tab('batches'); await a.page.locator('#view .rec', { hasText: 'Example' }).getByRole('button', { name: 'Open', exact: true }).click(); await a.page.waitForTimeout(300);
await a.btn('Brew it again');
check(await a.field('Name').inputValue() === 'Citra pale ale #2', 'rebrew is named #2: ' + await a.field('Name').inputValue()); check((await a.field('Notes').inputValue()).includes('More whirlpool hops next time'), 'the last tasting\'s advice is carried into the notes');
await a.btn('Create batch'); check(await a.has('Citra pale ale #2') && await a.has('Planned'), 'rebrew saved as a planned batch');

// ---------- K. backup and restore ----------
section('backup');
await a.page.click('#gearBtn'); await a.page.waitForTimeout(250);
const dl2 = a.page.waitForEvent('download'); await a.btn('Back up everything'); const bk = await dl2; const bkPath = `${tmp}/${bk.suggestedFilename()}`; await bk.saveAs(bkPath);
const data = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
check(data.app === 'brewlog' && data.batches.length === 4 && data.entries.length > 10, `backup holds everything: ${data.batches.length} batches, ${data.entries.length} entries`);
check(!data.kv.some(r => r.key === 'catalogCache'), 'the shop catalog is left out of the backup');
let r = await open();
await r.page.click('#gearBtn'); await r.page.waitForTimeout(250);
const fc = r.page.waitForEvent('filechooser'); await r.btn('Restore from a backup'); await (await fc).setFiles(bkPath); await r.page.waitForTimeout(400);
check(await r.has('It holds 4 batches'), 'restore screen describes the backup'); await r.shot('16-restore');
await r.btn('Restore'); await r.page.waitForTimeout(500);
t = await r.text(); check(t.includes('American IPA') && t.includes('Citra Pale Ale') && t.includes('Citra pale ale #2'), 'batches restored on a clean phone');
await r.page.locator('#view .rec', { hasText: 'American IPA' }).getByRole('button', { name: 'Open', exact: true }).click(); await r.page.waitForTimeout(300);
check(await r.has('stable 3 days') && await r.page.locator('#view svg[role=img]').count() === 1, 'the restored batch has its readings and chart');
await r.ctx.close();

// ---------- L. the back button, and a deep link ----------
section('navigation');
await a.tab('calc'); await a.btn('Priming sugar', false); check(a.page.url().endsWith('#calc/prime'), 'a calculator has its own address');
await a.page.goBack(); await a.page.waitForTimeout(300); check(await a.has('Calculators'), 'back goes to the calculator list');
check(!/\.\./.test((await a.text()).replace(/\u2026/g, '')), 'no doubled full stops in the calculator list');
let d = await open({ url: base + '#calc/keg' }); check(await d.has('Keg carbonation'), 'a link straight to a calculator opens it'); await d.ctx.close();
d = await open({ url: base + '#ref/recipe%3AIrish%20dry%20stout' }); check(await d.has('Irish dry stout') && await d.has('Brew this'), 'a link straight to a recipe opens it'); await d.ctx.close();
d = await open({ url: base + '#r=garbage' }); check(await d.has('Welcome to Brew Log'), 'a damaged recipe link falls back to the welcome screen'); await d.ctx.close();

// ---------- M. evening in Texas ----------
section('dates');
let e = await open({ clock: '2026-11-10T20:30:00-06:00' });
await e.btn('Start from a blank batch', false);
check(await e.field('Brew date').inputValue() === '2026-11-10', 'at 8:30pm Central the brew date is still today: ' + await e.field('Brew date').inputValue());
await e.ctx.close();

// ---------- N. registration ----------
section('registration');
const form = 'https://docs.google.com/forms/d/e/1FAIpQLSdTESTtestTESTtest/viewform?usp=pp_url&entry.111=EMAIL&entry.222=NAME&entry.333=SYSTEM';
let g = await open({ register: { signup: form, when: 'save' } });
check(await g.has('Welcome to Brew Log') && await g.page.locator('.sheet').count() === 0, 'when: save, nothing is asked on arrival');
await g.tab('calc'); check(await g.has('Calculators'), 'calculators are open without registering');
await g.tab('shop'); await g.page.locator('#view select').first().selectOption({ index: 3 }); await g.page.waitForTimeout(600);
check(await g.page.locator('#view a.btn', { hasText: 'Add all to cart' }).count() === 1, 'the shop and its cart are open without registering');
await g.tab('ref'); await g.btn('Styles and recipes', false); await g.page.locator('#view .rec').first().getByRole('button', { name: 'Open' }).click(); await g.page.waitForTimeout(300);
await g.btn(/^Brew this/, false);
check(await g.page.locator('.sheet').count() === 1 && (await g.page.locator('.sheet').innerText()).includes('Register to keep your batches'), 'saving a batch asks for registration');
if (out) await g.page.screenshot({ path: `${out}/17-register.png` });
await g.page.locator('.sheet').getByRole('button', { name: /Not now/ }).click(); await g.page.waitForTimeout(300);
await g.tab('batches'); check(await g.has('Welcome to Brew Log'), '"Not now" saves nothing and lets them carry on looking');
await g.btn('Look at a finished batch first', false); check(await g.has('Example: Citra pale ale') && await g.page.locator('.sheet').count() === 0, 'the example batch needs no registration');
await g.tab('ref'); await g.btn('Styles and recipes', false); await g.page.locator('#view .rec').first().getByRole('button', { name: 'Open' }).click(); await g.page.waitForTimeout(300); await g.btn(/^Brew this/, false);
await g.page.locator('.sheet').getByRole('button', { name: 'Register and continue' }).click(); await g.page.waitForTimeout(200);
check((await g.page.locator('.sheet').innerText()).includes('does not look right'), 'an empty email is refused');
await g.page.locator('.sheet input[type=text]').fill('Phil'); await g.page.locator('.sheet input[type=email]').fill('phil@example.com'); await g.page.locator('.sheet select').selectOption('aio120');
await g.page.locator('.sheet').getByRole('button', { name: 'Register and continue' }).click(); await g.page.waitForTimeout(700);
check(await g.page.locator('.sheet').count() === 0 && await g.has('Planned'), 'registering finishes the save that was interrupted');
check(g.posts.length === 1, 'one sign-up posted: ' + g.posts.length);
if (g.posts.length) { const q = new URLSearchParams(g.posts[0].body); check(g.posts[0].url.endsWith('/formResponse'), 'posted to the form\'s response address'); check(q.get('entry.111') === 'phil@example.com' && q.get('entry.222') === 'Phil' && q.get('entry.333') === 'All-in-one on a 120V socket', 'email, name and system under the form\'s own field numbers: ' + g.posts[0].body); check(!/batch|recipe|IPA/i.test(g.posts[0].body), 'nothing about their brewing is sent'); }
await g.page.click('#gearBtn'); await g.page.waitForTimeout(250); t = await g.text();
check(t.includes('Registered as phil@example.com'), 'Settings shows the registration'); check(await g.field('System name').inputValue() === 'All-in-one on a 120V socket', 'the system they picked set up the equipment profile');
await g.tab('batches'); await g.btn('New batch'); await g.field('Name').fill('Second'); await g.btn('Create batch'); check(await g.page.locator('.sheet').count() === 0 && g.posts.length === 1, 'registered once: never asked again');
await g.ctx.close();
// the check page
g = await open({ register: { signup: form, when: 'save' }, url: base + '?register' });
t = await g.text(); check(t.includes('Registration check') && t.includes('Google Form') && t.includes('email as entry.111'), 'the ?register page explains what the link does');
await g.btn('Send a test sign-up'); await g.page.waitForTimeout(500); check(g.posts.length === 1 && /Sent as test-/.test(await g.text()), 'a test sign-up can be sent from the check page');
await g.shot('18-register-check', true); await g.ctx.close();
// a bad link switches registration off rather than breaking the app
g = await open({ register: { signup: 'https://forms.gle/abc123', when: 'open' }, url: base + '?register' });
check((await g.text()).includes('That is the short link'), 'a short link is explained, not silently accepted'); check(await g.page.locator('.sheet').count() === 0, 'and registration stays off'); await g.ctx.close();
// when: open is a wall
g = await open({ register: { signup: form, when: 'open' } });
check(await g.page.locator('.sheet').count() === 1 && (await g.page.locator('.sheet').innerText()).includes('Welcome to Brew Log'), 'when: open asks before anything else');
check(await g.page.locator('.sheet').getByRole('button', { name: /Not now/ }).count() === 0, 'and offers no way round');
await g.page.mouse.click(10, 10); await g.page.waitForTimeout(200); check(await g.page.locator('.sheet').count() === 1, 'tapping outside does not dismiss it');
await g.page.locator('.sheet input[type=email]').fill('wall@example.com'); await g.page.locator('.sheet').getByRole('button', { name: 'Register and continue' }).click(); await g.page.waitForTimeout(600);
check(await g.page.locator('.sheet').count() === 0 && g.posts.length === 1, 'registering lets them in'); await g.ctx.close();
// no register.js at all: the app is as it was
g = await open(); await g.page.route('**/register.js*', r2 => r2.abort()); await g.page.reload(); await g.page.waitForFunction(() => !document.querySelector('#view noscript') && document.querySelector('#view h2'));
await g.btn('Start from a blank batch', false); await g.field('Name').fill('No config'); await g.btn('Create batch'); check(await g.has('No config') && await g.page.locator('.sheet').count() === 0, 'with register.js missing, saving just works'); await g.ctx.close();

await a.ctx.close(); await browser.close();
console.log('\n' + (errs.length ? 'PAGE ERRORS:\n' + [...new Set(errs)].join('\n') : 'no page errors'));
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fails.length || errs.length ? 1 : 0);
