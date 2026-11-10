/* A headless walk through every screen in jsdom: fast, no browser needed. It catches a screen that throws, a "NaN" or a "null"
   on the page, and the main flows end to end. test-walk.mjs does the same job in a real browser, with timers, files and history.
   node smoke.js   (needs: npm install jsdom fake-indexeddb) */
const { JSDOM } = require('jsdom'); const fs = require('fs');
const SCRIPTS = ['recipes.js', 'beerxml.js', 'data.js', 'tags.js', 'register.js', 'shop.js', 'core.js', 'recipetext.js', 'app.js'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0; const check = (ok, what) => { if (!ok) { failed++; console.log('  FAIL: ' + what); } };

/* One fresh phone. opts: { url, register (a BREWLOG_REGISTER object), catalog (true to serve the repo's catalog.json) } */
async function boot(opts = {}) {
  const fidb = require('fake-indexeddb'); const idb = new fidb.IDBFactory();
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: opts.url || 'https://brew.test/brewlog/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; w.indexedDB = idb; w.IDBKeyRange = fidb.IDBKeyRange; w.scrollTo = () => {}; w.confirm = () => true;
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  const posts = [], saved = [];
  w.fetch = async (url, init) => { if (init && init.method === 'POST') { posts.push({ url: String(url), body: String(init.body) }); return { ok: false, type: 'opaque' }; }
    if (/catalog\.json/.test(url) && opts.catalog) return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync('catalog.json', 'utf8')) }; return { ok: false, status: 404, json: async () => ({}) }; };
  w.HTMLAnchorElement.prototype.click = function () { if (this.download) saved.push(this.download); };   // downloads: note the name, go nowhere
  const errors = []; w.addEventListener('error', e => errors.push(e.message)); w.addEventListener('unhandledrejection', e => errors.push('rejected: ' + (e.reason && e.reason.message)));
  for (const f of SCRIPTS) { if (f === 'register.js' && opts.register) w.eval('window.BREWLOG_REGISTER = ' + JSON.stringify(opts.register) + ';'); else if (f === 'register.js' && opts.register === null) continue; else w.eval(fs.readFileSync(f, 'utf8')); }
  await sleep(120);
  const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  const p = { w, $, $$, posts, saved, errors, text: () => $('#view').textContent, sheet: () => $('.sheet') };
  p.tab = async t => { $(`#tabs button[data-tab="${t}"]`).click(); await sleep(60); };
  p.click = async (label, root) => { const els = [...(root || $('#view')).querySelectorAll('button, a')], b = els.find(x => x.textContent.trim() === label) || els.find(x => x.textContent.trim().startsWith(label)); if (!b) throw new Error('no button "' + label + '" on: ' + p.text().slice(0, 80)); b.click(); await sleep(90); };
  p.set = (label, val, root) => { const f = [...(root || $('#view')).querySelectorAll('label.field')].find(l => l.querySelector('span') && l.querySelector('span').textContent.trim() === label); if (!f) throw new Error('no field "' + label + '"');
    const i = f.querySelector('input,select,textarea'); i.value = val; i.dispatchEvent(new w.Event('input', { bubbles: true })); i.dispatchEvent(new w.Event('change', { bubbles: true })); return i; };
  p.clean = where => { const t = p.text(); check(!/NaN|undefined|\bnull\b|\[object/.test(t), `${where}: nothing unfinished on the page: ` + (t.match(/.{0,30}(NaN|undefined|\bnull\b|\[object).{0,30}/) || [''])[0]); };
  return p;
}

(async () => {
  // ---------- a fresh phone ----------
  let a = await boot({ catalog: true });
  check(a.text().includes('Welcome to Brew Log') && a.text().includes('What do you brew on?'), 'welcome on first open'); a.clean('welcome');
  await a.click('Cooler mash tun and a kettle'); check(!a.text().includes('What do you brew on?'), 'picking a system puts the picker away');

  // ---------- a batch typed in by hand, the numbers following ----------
  await a.click('Start from a blank batch'); a.clean('empty new batch'); check(a.text().includes('Add the grain and hops below'), 'an empty batch says what to do, with no made-up numbers');
  a.set('Name', 'Test IPA'); a.set('Style', 'American IPA'); a.set('Fermentable', '2-row pale malt'); a.set('lb', '12'); await sleep(40);
  let ro = a.$('#view .readout').textContent; check(/1\.05\d/.test(ro) && ro.includes('style 1.056'), 'OG estimated against the style: ' + ro.slice(0, 90));
  a.set('Hop', 'Citra'); await sleep(30); check(a.$$('#view label.field').find(l => l.textContent.startsWith('Alpha %')).querySelector('input').value === '12.0', 'alpha filled in from the hop table');
  a.set('oz', '2'); a.set('Minutes', '60'); a.set('Yeast', 'US-05 / WLP001 / Wyeast 1056'); a.set('Mash time (min)', '75'); a.$('#view textarea').value = 'First line\nsecond line'; await sleep(40);
  ro = a.$('#view .readout').textContent; check(/IBU \(SMPH\)/.test(ro) && /Tinseth would say/.test(ro) && /Expected FG and ABV/.test(ro), 'IBU by SMPH with Tinseth beside it'); a.clean('batch form');
  await a.click('Create batch'); check(a.text().includes('Test IPA') && a.text().includes('Planned') && a.text().includes('second line'), 'batch saved, notes and all');
  check(/#batches\/view/.test(a.w.location.hash), 'the batch has its own address: ' + a.w.location.hash); a.clean('batch view');

  // ---------- brew day ----------
  await a.click('Brew day'); let t = a.text(); check(t.includes('Strike water') && t.includes('Sparge water') && t.includes('1.5 qt per lb'), 'brew day numbers from the equipment profile'); check(t.includes('2 oz Citra'), 'the hop is a step'); a.clean('brew day sheet');
  await a.click('Start boil timer'); await a.click('Go: guided brew day'); check(a.text().includes('Heat strike water') && a.text().includes('Step 1 of'), 'guided brew day starts at the water');
  await a.click('Water is at temperature'); check(a.text().includes('Mash in') && a.text().includes('Hold 75 minutes'), 'the mash length typed on the recipe is the one that is timed'); a.clean('guided brew day');
  await a.tab('brewday'); check(a.text().includes('Mash in'), 'the Brew day tab comes back to a guided day in progress');

  // ---------- gravity: the OG, then the ferment ----------
  await a.tab('batches'); await a.click('Open'); await a.click('Log gravity');
  check(a.$('#view input[type=checkbox]').checked, 'the first reading is offered as the OG'); a.set('Specific gravity', '1.060'); await a.click('Save');
  t = a.text(); check(t.includes('1.060') && t.includes('Mash efficiency'), 'OG and efficiency from the reading');
  for (const [d, sg] of [['2026-11-13', '1.030'], ['2026-11-17', '1.012'], ['2026-11-20', '1.012']]) { await a.click('Log gravity'); check(!a.$('#view input[type=checkbox]').checked, 'later readings are not the OG'); a.set('Date', d); a.set('Specific gravity', sg); a.set('Fermenter temp (F), optional', '67'); await a.click('Save'); }
  t = a.text(); check(t.includes('ready to package') && a.$('#view svg[role=img]'), 'stable gravity and a chart'); check(/ABV199 calories per 12 oz6\.51%/.test(t.replace(/\s+/g, ' ').replace(/ABV /, 'ABV')), 'ABV and calories from what was measured: ' + (t.match(/ABV.{0,40}/) || [''])[0]); a.clean('fermenting batch');
  await a.click('Log packaging'); a.clean('packaging form'); await a.click('Save'); check(a.text().includes('Packaged') && a.text().includes('final,'), 'packaging moves the batch on and fixes the FG');
  await a.click('Log tasting'); a.set('Aroma', 'grapefruit'); a.set('Would you brew it again? What changes?', 'More dry hops.'); await a.click('Save');
  await a.click('Brew it again'); check(a.$$('#view label.field').find(l => l.textContent.startsWith('Name')).querySelector('input').value === 'Test IPA #2' && a.$('#view textarea').value.includes('More dry hops.'), 'a rebrew carries the last tasting forward');
  await a.click('Cancel'); await a.tab('batches'); t = a.text(); check(/so far: 1 batch/.test(t) && /6\.\d+%/.test(t), 'the list shows the year and the ABV: ' + (t.match(/.{0,20}so far.{0,60}/) || [''])[0]);

  // ---------- every calculator, every reference screen ----------
  await a.tab('calc'); const calcs = a.$$('#view .list button').length; check(calcs === 13, 'thirteen calculators: ' + calcs); check(!a.text().includes('..'), 'no doubled full stops');
  for (let i = 0; i < calcs; i++) { await a.tab('calc'); const b = a.$$('#view .list button')[i], name = b.querySelector('b').textContent; b.click(); await sleep(60); check(a.$('#view .readout'), name + ' shows a result'); a.clean(name); }
  await a.tab('ref'); const refs = a.$$('#view .list button').length; check(refs === 9, 'nine reference screens: ' + refs);
  for (let i = 0; i < refs; i++) { await a.tab('ref'); const b = a.$$('#view .list button')[i], name = b.querySelector('b').textContent; b.click(); await sleep(70); check(a.text().length > 200, name + ' has content'); a.clean(name); }
  await a.tab('ref'); await a.click('Styles and recipes'); const cards = a.$$('#view .rec').length; check(cards === 75, 'seventy-five style recipes: ' + cards);
  for (const name of ['American IPA', 'Irish dry stout', 'German pilsner', 'Sumerian sikaru (reconstruction)']) { a.w.location.hash = '#ref/' + encodeURIComponent('recipe:' + name); a.w.dispatchEvent(new a.w.PopStateEvent('popstate', { state: null })); await sleep(70); if (a.text().includes('Brew this')) a.clean('recipe ' + name); }

  // ---------- the shop: a list, a cart, a price per pint ----------
  await a.tab('shop'); await sleep(80); t = a.text(); check(t.includes('2-row pale malt') && t.includes('Citra'), 'shopping list from the batch');
  const cart = a.$$('#view a.btn').find(x => x.textContent.includes('Add all to cart')); check(cart && /\/cart\/\d+:\d+/.test(cart.href) && /ref=brewlog/.test(cart.href), 'one-tap cart from the real catalog');
  check(/About .{2,6} a pint/.test(t), 'cost per pint'); check(/an American IPA recipe kit/.test(t), '"an American IPA"'); a.clean('shop');
  a.$('#view select').value = 'Irish dry stout'; a.$('#view select').dispatchEvent(new a.w.Event('change')); await sleep(90); check(a.text().includes('The base Irish dry stout recipe') && /#shop\/style/.test(a.w.location.hash), 'shop straight from a style, with its own address'); a.clean('shop from a style');

  // ---------- stock ----------
  await a.tab('stock'); await a.click('Add by hand'); a.set('Name', 'Maris Otter'); a.set('Amount', '55'); await a.click('Save'); check(a.text().includes('55 lb  Maris Otter'), 'stock item saved'); await a.click('What can I brew?'); a.clean('what can I brew');

  // ---------- settings: nothing printed that should not be, and a backup ----------
  a.$('#gearBtn').click(); await sleep(80); a.clean('settings'); check(a.text().includes('No backup made yet') && !a.text().includes('Registration'), 'settings: backup offered, no registration section when it is off');
  await a.click('Back up everything'); check(a.saved.some(n => /^brew-log-backup-\d{4}-\d\d-\d\d\.json$/.test(n)), 'backup file offered: ' + a.saved); await sleep(60); check(a.text().includes('Last backup'), 'and remembered');
  await a.click('Export the log as .csv'); check(a.saved.some(n => /\.csv$/.test(n)), 'csv export');

  // ---------- bring a recipe in ----------
  await a.tab('batches'); await a.click('Bring a recipe in'); a.$('#view textarea').value = 'Citra Pale Ale (5 gal)\n10 lbs 2-row\n1 lb Crystal 40\n0.5 oz Magnum (12% AA) @ 60 min\n2 oz Citra dry hop 5 days\nUS-05\nOG 1.054';
  await a.click('Read the recipe'); t = a.text(); check(t.includes('What it read') && t.includes('Crystal / Caramel 40L') && t.includes('the recipe says 1.054'), 'pasted recipe read'); a.clean('import');
  await a.click('Looks right'); check(a.text().includes('Check the recipe') && a.text().includes('The recipe as written'), 'and handed to the form to check'); await a.click('Create batch'); check(a.text().includes('Citra Pale Ale'), 'imported recipe saved');

  // ---------- a recipe in a link ----------
  const code = a.w.RecipeText.encodeShare({ name: 'Shared <b>Bitter</b>', style: 'Best bitter', batchGal: 5, boilGal: 6.5, boilMin: 60, efficiency: 72, mashF: 152, yeast: 'Nottingham', fermentables: [{ name: 'Maris Otter', lb: 8 }], hops: [{ name: 'Fuggle', oz: 1.5, alpha: 4.5, minutes: 60, type: 'pellet' }], dryHops: [], salts: [], notes: 'Serve it cool, not cold.' });
  let s = await boot({ url: 'https://brew.test/brewlog/#r=' + code, catalog: true });
  t = s.text(); check(t.includes('A recipe someone sent you') && t.includes('Shared <b>Bitter</b>') && !s.$('#view b b'), 'the link opens the recipe, and markup in a name is shown as text, never run'); s.clean('shared recipe');
  await s.click('Shop for it'); await sleep(80); check(s.text().includes('Shopping for Shared'), 'shop from a shared recipe'); s.$('#tabs button[data-tab="ref"]').click(); await sleep(40);
  s.w.location.hash = '#r=' + code; s.w.dispatchEvent(new s.w.PopStateEvent('popstate', { state: null })); await sleep(80); await s.click('Save to my batches'); check(s.text().includes('Planned') && s.text().includes('Serve it cool'), 'and it can be saved');
  s = await boot({ url: 'https://brew.test/brewlog/#r=AAAA' }); check(s.text().includes('Welcome to Brew Log'), 'a broken link falls back to the welcome screen');

  // ---------- a first reading logged without saying it was the OG (every reading from 1.8 is like this) ----------
  const u = await boot(); await u.click('Start from a blank batch'); u.set('Name', 'Old habits'); u.set('Fermentable', '2-row pale malt'); u.set('lb', '10'); await u.click('Create batch');
  await u.click('Log gravity'); u.$('#view input[type=checkbox]').checked = false; u.set('Specific gravity', '1.049'); await u.click('Save');
  check(/Was 1\.049 on .* your original gravity\?/.test(u.text()) && /1\.0\d\d est/.test(u.text()), 'an unflagged first reading is offered as the OG, not assumed');
  await u.click('Yes, use it as the OG'); check(u.text().includes('the recipe estimated') && !/your original gravity\?/.test(u.text()) && u.text().includes('Mash efficiency'), 'and one tap makes it the OG'); u.clean('batch after the OG is set');

  // ---------- registration ----------
  const form = 'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&entry.111=EMAIL&entry.222=NAME&entry.333=SYSTEM';
  let g = await boot({ register: { signup: form, when: 'save' } });
  check(!g.sheet(), 'when: save asks nothing on arrival'); await g.click('Look at a finished batch first'); check(g.text().includes('Example: Citra pale ale') && !g.sheet(), 'the example needs no registration'); g.clean('example batch');
  await g.tab('batches'); await g.click('New batch'); g.set('Name', 'Mine'); await g.click('Create batch'); check(g.sheet() && g.sheet().textContent.includes('Register to keep your batches'), 'saving a batch asks');
  await g.click('Not now', g.sheet()); await g.tab('batches'); check(!g.text().includes('Mine'), '"Not now" saves nothing');
  await g.click('New batch'); g.set('Name', 'Mine'); await g.click('Create batch'); await g.click('Register and continue', g.sheet()); check(g.sheet() && g.sheet().textContent.includes('does not look right'), 'no email, no registration');
  g.sheet().querySelector('input[type=text]').value = 'Phil'; g.sheet().querySelector('input[type=email]').value = 'phil@example.com'; g.sheet().querySelector('select').value = 'biab'; await g.click('Register and continue', g.sheet()); await sleep(80);
  check(!g.sheet() && g.text().includes('Mine') && g.text().includes('Planned'), 'registering completes the save'); check(g.posts.length === 1 && g.posts[0].url.endsWith('/formResponse'), 'one sign-up posted to the form');
  const q = new URLSearchParams((g.posts[0] || {}).body); check(q.get('entry.111') === 'phil@example.com' && q.get('entry.222') === 'Phil' && q.get('entry.333') === 'Brew in a bag' && [...q.keys()].length === 3, 'email, name and system and nothing else: ' + (g.posts[0] || {}).body);
  g.$('#gearBtn').click(); await sleep(80); check(g.text().includes('Registered as phil@example.com') && g.text().includes('mailing list'), 'settings says what was sent'); check(g.$$('#view label.field').find(l => l.textContent.startsWith('System name')).querySelector('input').value === 'Brew in a bag', 'the system picked set the profile up');
  g = await boot({ register: { signup: form, when: 'open' } }); check(g.sheet() && !/Not now/.test(g.sheet().textContent), 'when: open is a wall with no way round');
  g = await boot({ register: { signup: form, when: 'off' } }); await g.click('Start from a blank batch'); g.set('Name', 'Off'); await g.click('Create batch'); check(!g.sheet() && g.text().includes('Off'), 'when: off asks nothing');
  g = await boot({ register: { signup: 'https://forms.gle/short', when: 'open' }, url: 'https://brew.test/brewlog/?register' }); check(!g.sheet() && g.text().includes('That is the short link'), 'an unusable link is explained and registration stays off');
  g = await boot({ register: null }); await g.click('Start from a blank batch'); g.set('Name', 'None'); await g.click('Create batch'); check(!g.sheet() && g.text().includes('None'), 'with no register.js the app is as it always was');
  g = await boot({ url: 'https://brew.test/brewlog/?tags' }); check(g.text().includes('Tag check'), 'the ?tags page still works');

  const errs = [a, s, u, g].flatMap(x => x.errors); if (errs.length) { failed++; console.log('PAGE ERRORS:\n' + [...new Set(errs)].join('\n')); }
  console.log(failed ? `SMOKE FAILED: ${failed}` : 'smoke passed'); process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SMOKE FAIL', e); process.exit(1); });
