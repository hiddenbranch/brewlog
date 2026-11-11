/* Brew Log - app UI. Depends on core.js (BrewCore), data.js (BrewData), shop.js (BrewShop). */
(function () {
  'use strict';
  const B = window.BrewCore, D = window.BrewData, SH = window.BrewShop, RC = window.BrewRecipes, RT = window.RecipeText;
  B.setHopRef(D.HOPS);
  const OCR_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
  const APP_VERSION = '1.9.1';
  const BOOK = { title: 'Homebrewer\'s Brew Log Book', url: '', blurb: 'The paper companion: brew day sheets, fermentation charts and recipe pages, with a beginner\'s guide and something to read while the kettle boils.' };
  const CDN = { jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' };
  const STATUSES = ['Planned', 'Brewing', 'Fermenting', 'Conditioning', 'Packaged', 'Drinking', 'Finished'];
  const EQUIP_DEFAULT = { name: 'My system', batchGal: 5.5, boilGal: 7, boilMin: 60, efficiency: 72, qtPerLb: 1.25, tunLossF: 2, grainTempF: 65, noSparge: false, boilOffGalHr: 1.2, trubGal: 0.5, absorbGalLb: 0.125, wcf: 1.04, hydroCalF: 60, elevationFt: 0, chillMin: 10, wortPh: 5.5, clarity: 1.0, krausen: 1.0, ageWeeks: 3 };
  const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');
  async function equip() { return Object.assign({}, EQUIP_DEFAULT, await S.get('equip', {})); }

  const $ = (s, r) => (r || document).querySelector(s);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === false || v === null || v === undefined) continue; else if (k === 'value') el.value = v; else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  let toastTimer;
  function toast(m) { let t = $('.toast'); if (!t) { t = h('div', { class: 'toast' }); document.body.append(t); } t.textContent = m; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2200); }
  function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load failed')); document.head.append(s); }); }
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };

  // ---------- storage ----------
  const DB = {
    db: null,
    open() { if (this.db) return Promise.resolve(this.db); return new Promise((res, rej) => { const r = indexedDB.open('brewlog', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('batches', { keyPath: 'id', autoIncrement: true }); const e = d.createObjectStore('entries', { keyPath: 'id', autoIncrement: true }); e.createIndex('batchId', 'batchId'); d.createObjectStore('stock', { keyPath: 'id', autoIncrement: true }); d.createObjectStore('kv', { keyPath: 'key' }); };
      r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error); }); },
    tx(store, mode, fn) { return this.open().then(d => new Promise((res, rej) => { const t = d.transaction(store, mode); const q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); })); },
    put(s, o) { return this.tx(s, 'readwrite', st => st.put(o)); }, del(s, i) { return this.tx(s, 'readwrite', st => st.delete(i)); },
    get(s, i) { return this.tx(s, 'readonly', st => st.get(i)); }, all(s) { return this.tx(s, 'readonly', st => st.getAll()); },
    byBatch(s, i) { return this.tx(s, 'readonly', st => st.index('batchId').getAll(i)); },
    async clearAll() { for (const s of ['batches', 'entries', 'stock', 'kv']) await this.tx(s, 'readwrite', st => st.clear()); }
  };
  const S = { cache: {} };
  S.get = async (k, d) => { if (k in S.cache) return S.cache[k]; const r = await DB.get('kv', k); S.cache[k] = r ? r.value : d; return S.cache[k]; };
  S.set = async (k, v) => { S.cache[k] = v; await DB.put('kv', { key: k, value: v }); };

  const TAG_CHECK = /[?&]tags(=|&|$)/.test(location.search);   // brewlog/?tags opens Settings with the tag check at the top
  const REG_CHECK = /[?&]register(=|&|$)/.test(location.search);   // brewlog/?register opens Settings with the registration check
  const state = { tab: TAG_CHECK || REG_CHECK ? 'settings' : 'batches', sub: null, batchId: null, shared: null, sharedCode: '', draft: null, importText: '' };
  const view = $('#view');
  // DOM append does not flatten arrays, so anything built with .map() must go through this
  const add = (...kids) => { kids.flat(Infinity).forEach(k => { if (k !== null && k !== undefined && k !== false) view.append(k.nodeType ? k : document.createTextNode(String(k))); }); };
  /* Every screen has an address after the #, so the phone's own back button goes back a screen instead of closing the app,
     a reload stays where it was, and a calculator or a recipe can be sent to someone as a link. A shared recipe keeps its
     whole self in the address: #r=<the recipe>. */
  const TABS = ['batches', 'brewday', 'calc', 'ref', 'shop', 'stock', 'settings'];
  const routeOf = (tab, sub) => tab === 'ref' && sub === 'shared' && state.sharedCode ? 'r=' + state.sharedCode : tab + (sub ? '/' + encodeURIComponent(sub) : '');
  function readRoute() {
    const hash = location.hash.replace(/^#/, ''); if (!hash) return null;
    if (hash.startsWith('r=')) { const code = hash.slice(2), b = RT.decodeShare(code); if (!b) { setTimeout(() => toast('That recipe link is damaged or cut short'), 400); return null; } state.shared = b; state.sharedCode = code; return { tab: 'ref', sub: 'shared' }; }
    const i = hash.indexOf('/'), tab = i < 0 ? hash : hash.slice(0, i); if (!TABS.includes(tab)) return null;
    let sub = null; if (i >= 0) { try { sub = decodeURIComponent(hash.slice(i + 1)) || null; } catch (e) { sub = null; } }
    return { tab, sub };
  }
  function go(tab, sub, opts) {
    const from = routeOf(state.tab, state.sub); state.tab = tab; state.sub = sub || null; const to = routeOf(tab, state.sub);
    try { if ((opts && opts.replace) || to === from) history.replaceState({ r: to, prev: (history.state || {}).prev }, '', '#' + to);
      else { history.replaceState(Object.assign({}, history.state, { y: window.scrollY }), ''); history.pushState({ r: to, prev: from }, '', '#' + to); } } catch (e) { /* no history here (a file opened from disk): the app still works */ }
    render(); window.scrollTo(0, 0);
  }
  // an on-screen back button really goes back when the screen it names is the one we came from, so a long list is where you left it
  function goBack(tab, sub) { const want = routeOf(tab, sub || null); try { if (history.state && history.state.prev === want && history.length > 1) return history.back(); } catch (e) { /* fall through */ } go(tab, sub); }
  window.addEventListener('popstate', async e => { closeSheets(); const r = readRoute() || { tab: 'batches', sub: null }; state.tab = r.tab; state.sub = r.sub; await render(); window.scrollTo(0, (e.state && e.state.y) || 0); });
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.tab); });
  $('#gearBtn').addEventListener('click', () => go('settings'));
  const homeBtn = $('#homeBtn'); if (homeBtn) homeBtn.addEventListener('click', e => { e.preventDefault(); go('batches'); });
  async function render() {
    EQ = await equip(); IBU_MODEL = await S.get('ibuModel', 'smph'); RECIPE_GAL = num(await S.get('recipeGal', 0)) || EQ.batchGal || 5;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
    clearInterval(timer); goView = null;
    const token = ++renderToken; view.innerHTML = '';
    await ({ batches: renderBatches, brewday: renderBrewday, calc: renderCalc, ref: renderRef, shop: renderShop, stock: renderStock, settings: renderSettings }[state.tab])();
    if (token !== renderToken) return;
    const chip = $('#jobChip'); const b = state.batchId ? await DB.get('batches', state.batchId) : null;
    chip.hidden = !b; if (b) chip.textContent = b.name || ('batch ' + b.id);
  }
  let renderToken = 0;
  const today = B.today;
  const field = (label, input, hint) => h('label', { class: 'field' }, h('span', null, label), input, hint ? h('span', { class: 'muted small' }, hint) : null);
  const sel = (opts, cur) => h('select', null, opts.map(o => h('option', { value: typeof o === 'object' ? o.v : o, selected: (typeof o === 'object' ? o.v : o) === cur ? true : false }, typeof o === 'object' ? o.t : o)));
  const inp = (v, type, extra) => h('input', Object.assign({ type: type || 'text', value: v === undefined || v === null ? '' : v, inputmode: type === 'number' ? 'decimal' : undefined, step: type === 'number' ? 'any' : undefined }, extra || {}));
  async function batchList() { const b = await DB.all('batches'); return b.sort((x, y) => (y.brewDate || '').localeCompare(x.brewDate || '') || y.id - x.id); }
  async function currentBatch(list) { if (state.batchId && list.find(b => b.id === state.batchId)) return list.find(b => b.id === state.batchId); const last = await S.get('lastBatch', null); const b = list.find(x => x.id === last) || list[0] || null; if (b) state.batchId = b.id; return b; }

  // ---------- batches ----------
  let EQ = EQUIP_DEFAULT;
  const BLANK = () => ({ name: '', style: '', brewDate: today(), batchGal: EQ.batchGal, boilGal: EQ.boilGal, boilMin: EQ.boilMin, efficiency: EQ.efficiency, og: '', fg: '', fermentables: [{ name: '', lb: '' }], hops: [{ name: '', oz: '', alpha: '', minutes: '', type: 'pellet' }], yeast: '', mashF: 152, fermF: '', wpTempF: 175, wpMin: 20, salts: [], dryHops: [], extras: [], notes: '', status: 'Planned', ibuModel: IBU_MODEL });
  async function renderBatches() {
    const list = await batchList();
    if (state.sub === 'new') { const draft = state.draft; state.draft = null; return batchForm(null, draft); }
    if (state.sub && state.sub.startsWith('edit:')) return batchForm(await DB.get('batches', Number(state.sub.split(':')[1])));
    if (state.sub && state.sub.startsWith('view:')) return batchView(await DB.get('batches', Number(state.sub.split(':')[1])));
    if (state.sub && state.sub.startsWith('log:')) { const [, id, type] = state.sub.split(':'), lb = await DB.get('batches', Number(id)); return lb && ENTRY_TITLES[type] ? entryForm(lb, type) : go('batches', null, { replace: true }); }
    if (state.sub === 'import') return renderImport();
    const xmlIn = h('input', { type: 'file', accept: '.xml,.beerxml,text/xml,application/xml', hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; e.target.value = '';
      try { const recipes = window.BeerXML.importRecipes(await f.text(), { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }, B.matchVocab);
        if (!(await needReg('save'))) return;
        let lastId = null; for (const r of recipes) { r.status = 'Planned'; lastId = await DB.put('batches', r); } keepStorage();
        toast(`${recipes.length} recipe${recipes.length === 1 ? '' : 's'} imported`); state.batchId = lastId; go('batches', 'edit:' + lastId); }
      catch (err) { toast(err.message); } } });
    if (!list.length) return view.append(xmlIn, welcome(() => xmlIn.click()));
    view.append(h('h2', null, 'Batches'), xmlIn, h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('batches', 'new') }, 'New batch'), h('button', { class: 'btn secondary', onclick: () => go('ref', 'styles') }, 'Pick a recipe'), h('button', { class: 'btn secondary', onclick: () => go('batches', 'import') }, 'Bring a recipe in')));
    const card = await statsCard(list); if (card) view.append(card);
    for (const b of list) {
      const est = recipeStats(b), fi = fermentInfo(b), og = num(b.og) || est.og, fg = num(b.fg) || num(b.lastSg), abv = og && fg && fg < og ? B.abv(og, fg) : null;
      view.append(h('div', { class: 'rec' }, h('span', { class: 'swatch', style: `background:${B.srmHex(est.srm || 0)}` }),
        h('button', { class: 't rowbtn', 'aria-label': 'Open ' + (b.name || 'batch'), onclick: () => go('batches', 'view:' + b.id) }, h('b', null, b.name || 'untitled', b.sample ? h('span', { class: 'badge', style: 'margin-left:8px' }, 'example') : null),
          h('div', { class: 'meta' }, [b.style && b.style !== b.name ? b.style : null, B.niceDate(b.brewDate), og ? 'OG ' + og.toFixed(3) : null, batchIbu(b, est).v ? batchIbu(b, est).v + ' IBU' : null, abv ? abv + '%' : null].filter(Boolean).join(' \u00B7 ')),
          h('div', { class: 'meta' }, b.status, fi.pitched && b.status === 'Fermenting' ? ` \u00B7 day ${fi.day} of ${fi.plan.text}` : '', fi.due.length ? h('span', { class: 'badge ' + (fi.overdue.length ? 'overdue' : 'due'), style: 'margin-left:8px' }, 'dry hop due') : null)),
        h('button', { class: 'act', onclick: () => go('batches', 'view:' + b.id) }, 'Open')));
    }
    const hint = await installHint(true); if (hint) view.append(hint);
  }

  // ---------- first open ----------
  /* A pint the color of the beer. The same shape is drawn on the batch card image. */
  function glass(srm, size) {
    const c = B.srmHex(srm === undefined || srm === null ? 6 : srm), w = size || 40;
    return h('span', { class: 'glass', 'aria-hidden': 'true', html: `<svg viewBox="0 0 64 80" width="${w}" height="${Math.round(w * 1.25)}"><path d="M13 18h38l-4.200 53.500a5 5 0 0 1-5 4.500H22.200a5 5 0 0 1-5-4.500z" fill="${c}"/><path d="M19.500 27l2.400 37" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round" fill="none"/><g fill="#FFF8EC"><rect x="10" y="13" width="44" height="10" rx="5"/><circle cx="19" cy="13" r="6.500"/><circle cx="29" cy="10" r="7.500"/><circle cx="40" cy="11" r="7"/><circle cx="48" cy="14" r="5.500"/></g></svg>` });
  }
  const isStandalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  /* How to put the app on the home screen. Installed, it opens full screen and offline, and the browser stops treating the brews as
     website data it may clear. compact: the one-line version shown under the batch list until it is dismissed. */
  async function installHint(compact) {
    if (isStandalone()) return null;
    if (compact && await S.get('installHintOff', false)) return null;
    const how = deferredPrompt ? h('button', { class: 'btn' + (compact ? ' secondary' : ''), onclick: installApp }, 'Install Brew Log')
      : h('p', { class: 'small', style: 'margin:6px 0 0' }, isIos() ? 'On an iPhone or iPad: tap the Share button (the square with the arrow), then "Add to Home Screen".' : 'In your browser\'s menu choose "Install" or "Add to Home Screen". On a Mac in Safari: File, then "Add to Dock".');
    return h('div', { class: 'note' }, h('b', { style: 'color:var(--text)' }, 'Put it on your home screen'),
      h('div', null, 'It then opens like any other app and works with no signal in the garage. ', isIos() ? 'It matters on an iPhone: Safari can clear a website\'s saved data after a few weeks unused, and it never does that to an installed app.' : 'Your brews are kept with the app instead of with the browser\'s website data.'),
      how, compact ? h('div', { class: 'btns', style: 'margin:8px 0 0' }, h('button', { class: 'btn secondary sm', onclick: async () => { await S.set('installHintOff', true); render(); } }, 'Not now')) : null);
  }
  function welcome(pickXml) {
    const count = RC.RECIPES.filter(r => r.group !== 'Historic').length;
    const row = (t, sub, fn) => h('li', null, h('button', { onclick: fn }, h('span', { class: 't' }, h('b', null, t), h('span', null, sub)), h('span', { class: 'k' }, '\u203A')));
    const box = h('div', null, h('div', { class: 'hero' }, h('img', { src: 'icons/icon-192.png?v=2', width: 72, height: 72, alt: '', style: 'border-radius:16px;flex:none' }), h('div', null, h('h2', { style: 'margin:0 0 6px' }, 'Welcome to Brew Log'),
      h('p', { class: 'muted', style: 'margin:0' }, 'Your recipes, your brew day and your fermentation readings in one place. Free, works with no signal, and your brews stay on this phone.'))),
      h('h3', null, 'Start here'),
      h('ul', { class: 'list' },
        row('Pick a recipe', `${count} styles, each one sized to your system, with a shopping list that fills the cart for you`, () => go('ref', 'styles')),
        row('Bring your own recipe', 'Paste it from anywhere, photograph it, or import BeerXML from Brewfather or BeerSmith', () => go('batches', 'import')),
        row('Start from a blank batch', 'Type the grain, hops and yeast and watch the numbers follow', () => go('batches', 'new')),
        row('Look at a finished batch first', 'An example brew with its whole log, so you can see what you end up with', loadSample)));
    systemPicker().then(el => { if (el) box.append(el); return installHint(false); }).then(el => { if (el) box.append(el); });
    return box;
  }
  // "What do you brew on?": one tap puts typical numbers for that kind of system into the equipment profile
  // S.get remembers the default it was first asked with, so "has the profile been saved?" is asked of the profile itself
  const hasEquip = async () => Object.keys((await S.get('equip', {})) || {}).length > 0;
  async function systemPicker() {
    if (await hasEquip()) return null;
    return h('div', null, h('h3', null, 'What do you brew on?'), h('p', { class: 'muted small' }, 'One tap sets the water volumes and boil-off for that kind of system, so the first brew day sheet makes sense. Fine-tune any number later under Settings.'),
      h('div', { class: 'chips' }, D.SYSTEMS.map(sys => h('button', { class: 'chip', style: 'font-family:inherit', title: sys.eg, onclick: async () => { await S.set('equip', Object.assign({}, EQUIP_DEFAULT, sys.eq, { name: sys.name })); toast(`Set up for ${sys.name.toLowerCase()}`); render(); } }, sys.name))));
  }
  /* The example batch: a pale ale brewed three and a half weeks ago, logged the way a real one would be. */
  async function loadSample() {
    const day = n => B.addDays(today(), n - 24), t0 = Date.now() - 24 * 86400000;
    const b = Object.assign(BLANK(), { name: 'Example: Citra pale ale', style: 'American pale ale', sample: true, brewDate: day(0), pitchDate: day(0), status: 'Drinking', og: 1.052, fg: 1.01, lastSg: 1.01, mashF: 152, fermF: 66, yeast: 'US-05 / WLP001 / Wyeast 1056',
      fermentables: [{ name: '2-row pale malt', lb: 9.5 }, { name: 'Munich malt', lb: 1 }, { name: 'Crystal / Caramel 40L', lb: 0.5 }],
      hops: [{ name: 'Magnum', oz: 0.5, alpha: 13.5, minutes: 60, type: 'pellet' }, { name: 'Citra', oz: 1, alpha: 12, minutes: 10, type: 'pellet' }, { name: 'Citra', oz: 1, alpha: 12, minutes: 0, type: 'pellet', whirlpool: true }],
      dryHops: [{ name: 'Citra', oz: 2, alpha: 12, type: 'pellet', day: 7, days: 4, added: day(7) }], salts: [{ salt: 'Gypsum (CaSO4)', grams: 4 }, { salt: 'Calcium chloride (CaCl2)', grams: 2 }],
      actuals: { strikeF: 163, mashInF: 152, mashTotal: 62, boilTotal: 60, chilledToF: 68, pitchF: 66 }, process: ['Whirlfloc or Irish moss', 'Recirculated the mash'],
      notes: 'Soft water with gypsum and a little calcium chloride. A clean, bright pale ale: the hops do the talking.' });
    const id = await DB.put('batches', b);
    const e = (n, type, o) => DB.put('entries', Object.assign({ batchId: id, type, date: day(n), created: t0 + n * 86400000 }, o));
    await e(0, 'step', { text: 'Mash in at 9:10 AM: 152F' }); await e(0, 'step', { text: 'Flameout at 11:42 AM: 60 min' }); await e(0, 'gravity', { sg: 1.052, raw: 1.052, instrument: 'sg', og: true, note: 'OG, 5.5 gal' }); await e(0, 'step', { text: 'Pitched at 12:30 PM: 66F' });
    for (const [n, sg, f] of [[2, 1.038, 67], [4, 1.021, 68], [7, 1.012, 68], [10, 1.01, 67], [13, 1.01, 66]]) await e(n, 'gravity', { sg, raw: sg, instrument: 'sg', fermTempF: f });
    await e(7, 'dryhop', { hop: 'Citra', oz: 2, form: 'pellet', text: '2 oz Citra (pellet (t-90))' });
    await e(14, 'package', { method: 'Keg', volumes: 2.5, tempF: 38, gal: 5, psi: 12, text: 'Keg, 2.5 vol, 12 psi at 38F' });
    await e(24, 'tasting', { score: '4', text: 'appearance: gold, slight haze, white head; aroma: grapefruit and lime; flavor: bright citrus, soft bitterness; mouthfeel: medium-light (4/5)', note: 'Yes. More whirlpool hops next time, and mash a degree lower.' });
    state.batchId = id; await S.set('lastBatch', id); toast('An example batch: remove it whenever you like'); go('batches', 'view:' + id);
  }
  /* The year so far, and whether the equipment profile still tells the truth about mash efficiency. */
  async function statsCard(list) {
    const rows = list.map(b => { const est = recipeStats(b), og = num(b.og) || est.og, fg = num(b.fg) || num(b.lastSg);
      return { brewDate: b.brewDate, batchGal: num(b.batchGal), sample: !!b.sample, brewed: !['Planned', 'Brewing'].includes(b.status) || !!b.pitchDate, abv: og && fg && fg < og ? B.abv(og, fg) : null, eff: num(b.og) ? batchEfficiency(b) : null }; });
    const st = B.brewStats(rows); if (!st.batches) return null;
    const bits = [`${st.batchesYear} batch${st.batchesYear === 1 ? '' : 'es'}`, st.gallonsYear ? `${st.gallonsYear} gal` : null, st.avgAbv ? `average ${st.avgAbv}%` : null, st.avgEff ? `mash efficiency ${st.avgEff}%` : null].filter(Boolean);
    const box = h('div', { class: 'statline' }, h('b', null, st.batchesYear ? `${st.year} so far: ` : `${st.batches} brewed: `), st.batchesYear ? bits.join(' \u00B7 ') : bits.slice(1).join(' \u00B7 ') || 'nothing yet this year');
    if (st.gallonsYear >= 100 && await S.get('region', 'US') === 'US') box.append(h('div', { class: 'muted small' }, `That is ${st.gallonsYear} of the 200 gallons a household with two adults may brew in a year under US federal law (100 for one).`));
    const off = await S.get('effNag', null);
    if (st.effCount >= 3 && st.avgEff && Math.abs(st.avgEff - num(EQ.efficiency)) >= 3 && off !== st.avgEff) box.append(h('div', { class: 'note', style: 'margin:10px 0 0' },
      h('b', { style: 'color:var(--text)' }, `Your last ${st.effCount} measured brews averaged ${st.avgEff}% mash efficiency. `), `Your equipment profile says ${EQ.efficiency}%, so recipes are being sized ${st.avgEff < num(EQ.efficiency) ? 'a little light and your gravities come in low' : 'a little heavy and your gravities come in high'}.`,
      h('div', { class: 'btns', style: 'margin:8px 0 0' }, h('button', { class: 'btn sm', onclick: async () => { await S.set('equip', Object.assign({}, await S.get('equip', {}), { efficiency: st.avgEff })); toast(`Profile set to ${st.avgEff}%`); render(); } }, `Use ${st.avgEff}%`),
        h('button', { class: 'btn secondary sm', onclick: async () => { await S.set('effNag', st.avgEff); render(); } }, 'Leave it'))));
    const real = list.filter(b => !b.sample).length, last = await S.get('lastBackup', 0), nag = await S.get('backupNag', 0);
    if (real >= 2 && Date.now() - last > 30 * 86400000 && Date.now() - nag > 30 * 86400000) box.append(h('div', { class: 'note', style: 'margin:10px 0 0' }, h('b', { style: 'color:var(--text)' }, last ? 'It has been over a month since your last backup. ' : 'Your brews live only on this phone. '), 'A backup is one file you can keep anywhere and restore on a new phone.',
      h('div', { class: 'btns', style: 'margin:8px 0 0' }, h('button', { class: 'btn sm', onclick: backupNow }, 'Back up now'), h('button', { class: 'btn secondary sm', onclick: async () => { await S.set('backupNag', Date.now()); render(); } }, 'Later'))));
    return box;
  }
  const batchEfficiency = b => B.efficiency((b.fermentables || []).filter(f => !f.late).map(f => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return { lb: ref && ref.extract ? 0 : num(f.lb), ppg: ref ? ref.ppg : 0 }; }), num(b.batchGal), B.fromPoints(Math.max(0, B.points(num(b.og)) - sugarPoints(b))));
  // gravity points that came from extract and sugar, which need no mash and so say nothing about its efficiency
  const sugarPoints = b => { const gal = num(b.batchGal); if (!gal) return 0; return (b.fermentables || []).reduce((sum, f) => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return sum + (ref && ref.extract ? num(f.lb) * ref.ppg / gal : 0); }, 0); };
  // ask the browser not to clear the brews when the phone runs short of space
  function keepStorage() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* not available */ } }
  // Which IBU figure leads. SMPH predicts the finished beer; Tinseth is the number most homebrew recipes quote. Both are always shown.
  let IBU_MODEL = 'smph';
  const MODEL_NAME = { smph: 'SMPH', tinseth: 'Tinseth' };
  const recipeHops = (r, model) => { if ((model || IBU_MODEL) !== 'tinseth' || !r.tinseth) return r.hops; const t = r.tinseth, rest = r.hops.filter(hp => !hp.sized);
    return (t.bitter && t.oz > 0 ? [{ name: t.bitter.name, oz: t.oz, alpha: t.bitter.alpha, minutes: t.bitter.minutes, form: 'pellet', use: 'Boil', sized: true }] : []).concat(rest); };
  const recipeIbu = (r, model) => (model || IBU_MODEL) === 'tinseth' && r.tinseth ? { v: r.tinseth.ibu, label: 'Tinseth', other: `SMPH says ${r.tinseth.ibuSmph} in the finished beer` } : { v: r.ibu, label: 'SMPH', other: r.ibuTinseth !== undefined ? `Tinseth would say ${r.ibuTinseth}` : '' };
  const batchIbu = (b, est) => (b.ibuModel || IBU_MODEL) === 'tinseth' ? { v: est.ibuTinseth, label: 'Tinseth', other: `SMPH says ${est.ibu} in the finished beer` } : { v: est.ibu, label: 'SMPH', other: est.ibuTinseth ? `Tinseth would say ${est.ibuTinseth}` : '' };
  function modelToggle(current, onpick) {
    return h('div', { class: 'chips', role: 'group', 'aria-label': 'Hop the recipes by' }, ['smph', 'tinseth'].map(m => h('button', { class: 'chip' + (current === m ? ' on' : ''), style: 'font-family:inherit', 'aria-pressed': current === m ? 'true' : 'false', onclick: () => { if (current !== m) onpick(m); } }, m === 'smph' ? 'Hopped by SMPH' : 'Hopped by Tinseth')));
  }
  const MODEL_BLURB = 'SMPH predicts the IBUs a lab would measure in the finished beer and runs about a third below Tinseth, the figure most homebrew recipes quote. Switch and the bittering addition is re-sized to suit; the late hops stay as they are. Tinseth sizing is the recipe as the homebrew world would write it; SMPH sizing uses more bittering hops so the finished beer measures in range.';
  // The size the built-in recipes are shown, shopped and brewed at: the brewer's own batch size unless they pick another
  let RECIPE_GAL = 5;
  function recipeToBatch(r, gallons) {
    const gal = num(gallons) || RECIPE_GAL || r.gallons, rHops = recipeHops(r);
    const ferm = r.fermentables.map(f => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return { name: f.name, lb: f.lb, pct: f.pct, extract: !!(ref && ref.extract) }; });
    const sc = B.scaleAmounts(ferm, rHops, r.gallons, gal, r.efficiency, EQ.efficiency);
    const b = BLANK(); b.name = r.name; b.style = r.name; b.batchGal = gal; b.boilGal = B.round.r2(gal + Math.max(0.5, num(EQ.boilGal) - num(EQ.batchGal))); b.boilMin = r.boilMin; b.efficiency = EQ.efficiency; b.mashF = r.mashF;
    b.fermentables = sc.fermentables.map(f => ({ name: f.name, lb: f.lb, pct: f.pct })); b.ibuModel = IBU_MODEL;
    b.hops = sc.hops.filter(hp => hp.use !== 'Dry hop').map(hp => ({ name: hp.name, oz: hp.oz, alpha: hp.alpha, minutes: hp.minutes, type: 'pellet', whirlpool: hp.use === 'Whirlpool', sized: hp.sized, use: hp.use }));
    b.dryHops = sc.hops.filter(hp => hp.use === 'Dry hop').map(hp => ({ name: hp.name, oz: hp.oz, alpha: hp.alpha, type: 'pellet', day: '', days: hp.dryDays || 4 })); b.extras = [];
    b.fermF = r.fermF; b.wpTempF = 175; b.wpMin = 20; b.yeast = r.yeast; b.notes = `${r.water}. ${r.notes}`;
    return b;
  }
  // chips plus a box: 2.5, 5, the brewer's own size, 10, 15, or anything typed
  function sizePicker(onpick) {
    const sizes = [...new Set([2.5, 5, num(EQ.batchGal) || 5.5, 10, 15])].sort((x, y) => x - y);
    const box = inp(RECIPE_GAL, 'number', { 'aria-label': 'Batch size in gallons', style: 'width:88px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:999px;padding:8px 12px;font:inherit;font-size:16px;min-height:40px' });
    const set = async g => { if (!(g > 0) || g > 200) return; RECIPE_GAL = g; await S.set('recipeGal', g); onpick(g); };
    box.addEventListener('change', () => set(num(box.value)));
    return h('div', { class: 'chips', style: 'align-items:center' }, h('span', { class: 'muted small', style: 'margin-right:4px' }, 'Batch size'), sizes.map(g => h('button', { class: 'chip' + (RECIPE_GAL === g ? ' on' : ''), style: 'font-family:inherit', onclick: () => set(g) }, `${g} gal`)), box);
  }
  const packsFor = (b, est) => B.yeastPacks(num(b.batchGal) || 5, num(b.og) || (est || recipeStats(b)).og || 1.05, (yeastOf(b) || {}).type);
  const yeastOf = b => D.YEAST.find(y => y.name === (b && b.yeast)) || null;
  const hopTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function recipeStats(b) {
    const gal = num(b.batchGal) || 5.5, boilGal = num(b.boilGal) || gal * 1.2;
    const ferms = (b.fermentables || []).map(f => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return { lb: num(f.lb), ppg: ref ? ref.ppg : num(f.ppg), lovibond: ref ? ref.lovibond : num(f.lovibond), extract: ref ? ref.extract : false }; });
    const og = B.ogFromGrain(ferms, gal, num(b.efficiency) / 100 || 0.72);
    const boilG = B.ogFromGrain(ferms, boilGal, num(b.efficiency) / 100 || 0.72);
    const kettle = (b.hops || []).map(hp => ({ oz: num(hp.oz), alpha: num(hp.alpha), minutes: num(hp.minutes), type: hp.type, whirlpool: hp.whirlpool }));
    const y = yeastOf(b);
    const smph = B.ibuSmph(kettle, { gallons: gal, og: og || 1.05, boilMin: num(b.boilMin) || EQ.boilMin, wpTempF: num(b.wpTempF) || 175, wpMin: num(b.wpMin) || 20, chillMin: EQ.chillMin, boilTempF: 212 - (num(EQ.elevationFt) / 500),
      pH: EQ.wortPh, clarity: EQ.clarity, krausen: EQ.krausen, ageWeeks: EQ.ageWeeks, floc: y ? y.floc : '',
      dryHops: B.dryHopsOf(b).map(d => { const ref = D.HOPS.find(x => x.name === d.name); return { oz: num(d.oz), alpha: num(d.alpha) || (ref ? (ref.alphaLow + ref.alphaHigh) / 2 : 8), type: d.type }; }) });
    const srm = B.srm(ferms, gal);
    // the headline figure is kettle bitterness, which is what a style range means; what dry hops add to a lab reading is shown beside it
    return { og, ibu: Math.round(smph.kettle), ibuDry: Math.round(smph.dry), ibuTinseth: B.ibuTinseth(kettle, gal, boilG || 1.05), smph, srm, boilG };
  }
  async function deleteBatch(b) {
    if (!confirm(`Delete "${b.name || 'this batch'}" and its whole log? This cannot be undone.`)) return false;
    for (const e of await DB.byBatch('entries', b.id)) await DB.del('entries', e.id);
    for (const k of ['go:', 'steps:', 'timerStart:', 'cart:']) await S.set(k + b.id, null);
    await DB.del('batches', b.id); if (state.batchId === b.id) state.batchId = null; toast('Batch deleted'); return true;
  }
  // when the beer went into the fermenter, and what that means for the calendar
  function fermentInfo(b) {
    const est = recipeStats(b), plan = B.fermentPlan(yeastOf(b), num(b.og) || est.og || 1.05);
    const pitched = b.pitchDate || (['Fermenting', 'Conditioning'].includes(b.status) ? b.brewDate : null);
    const sched = B.dryHopSchedule(B.dryHopsOf(b), plan, pitched).map((h, i) => Object.assign(h, { added: (B.dryHopsOf(b)[i] || {}).added || null }));
    const day = pitched ? B.daysBetween(pitched, today()) : null;
    const due = pitched && b.status === 'Fermenting' ? sched.filter(h => !h.added && day >= h.fromDay) : [];
    return { plan, pitched, sched, day, due, overdue: due.filter(h => day > h.toDay) };
  }
  function downloadText(text, name, type) {
    const file = new File([text], name, { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.append(a); a.click(); a.remove();
  }
  function batchForm(b, draft) {
    const r = b || draft || BLANK();
    const f = {};
    const mk = (k, label, type, extra, hint) => { f[k] = inp(r[k], type, extra); return field(label, f[k], hint); };
    const styleList = h('datalist', { id: 'styles' }, RC.RECIPES.map(s => h('option', { value: s.name })));
    f.style = inp(r.style, 'text', { list: 'styles' });
    const stats = h('div', { class: 'readout' });
    const rows = { fermentables: h('div'), hops: h('div'), dry: h('div'), salts: h('div') };
    function collect() {
      const out = Object.assign({}, r);
      for (const k in f) out[k] = f[k].value;
      out.fermentables = [...rows.fermentables.children].map(el => Object.assign({ name: $('.fname', el).value, lb: $('.flb', el).value }, el._late ? { late: true } : {})).filter(x => x.name || x.lb);
      out.hops = [...rows.hops.children].map(el => ({ name: $('.hname', el).value, oz: $('.hoz', el).value, alpha: $('.halpha', el).value, minutes: $('.hmin', el).value, type: $('.htype', el).value, whirlpool: $('.hwp', el).checked })).filter(x => x.name || x.oz);
      out.salts = [...rows.salts.children].map(el => ({ salt: $('.sname', el).value, grams: $('.sg', el).value })).filter(x => x.grams);
      out.dryHops = [...rows.dry.children].map(el => Object.assign({}, el._keep || {}, { name: $('.dname', el).value, oz: $('.doz', el).value, alpha: $('.dalpha', el).value, type: $('.dtype', el).value, day: $('.dday', el).value, days: $('.ddays', el).value })).filter(x => x.name || x.oz);
      out.extras = (out.extras || []).filter(e => !/^dry hop:/i.test(String(e || '')));   // dry hops live in their own list now
      return out;
    }
    function refresh() {
      const cur = collect(); const est = recipeStats(cur); stats.innerHTML = '';
      yeastHint.textContent = B.pitchAdvice(D.YEAST.find(y => y.name === cur.yeast) || null, num(cur.fermF));
      if (!cur.fermentables.some(x => num(x.lb) > 0) && !cur.hops.some(x => num(x.oz) > 0)) { stats.append(h('div', { class: 'line' }, h('span', { class: 'l' }, 'Recipe numbers', h('span', { class: 'n' }, 'Add the grain and hops below. Gravity, bitterness, color and strength fill in as you type, each checked against the style.')), h('span', { class: 'v' }, '-'))); return; }
      const styleRec = RC.RECIPES.find(r => r.name === cur.style); const style = styleRec ? { ogLow: styleRec.ranges.og[0], ogHigh: styleRec.ranges.og[1], ibuLow: styleRec.ranges.ibu[0], ibuHigh: styleRec.ranges.ibu[1], srmLow: styleRec.ranges.srm[0], srmHigh: styleRec.ranges.srm[1] } : D.STYLES.find(s => s.name === cur.style);
      const line = (l, v, inRange, n) => stats.append(h('div', { class: 'line ' + (inRange === true ? 'ok' : inRange === false ? 'bad' : '') }, h('span', { class: 'l' }, l, n ? h('span', { class: 'n' }, n) : null), h('span', { class: 'v' }, v)));
      const within = (v, lo, hi) => style && v ? (v >= lo && v <= hi) : null;
      line('Estimated OG', est.og > 1 ? est.og.toFixed(3) : '-', est.og > 1 ? within(est.og, style && style.ogLow, style && style.ogHigh) : null, style ? `style ${style.ogLow.toFixed(3)} to ${style.ogHigh.toFixed(3)}` : null);
      if (draft && draft._said) line('The recipe as written', draft._said, null, 'what it claims; the figures here are these ingredients on your system');
      const bi = batchIbu(cur, est);
      line(`IBU (${bi.label})`, bi.v || '-', within(bi.v, style && style.ibuLow, style && style.ibuHigh), [style ? `style ${style.ibuLow} to ${style.ibuHigh}` : null, bi.other].filter(Boolean).join(' \u00B7 ') || null);
      if (est.smph.dissolved < 0.97) line('Alpha acids that dissolve', Math.round(est.smph.dissolved * 100) + '%', false, 'wort holds about 200 ppm freely and never more than 580: past that, more hops add little bitterness');
      if (est.ibuDry > 0) line('Dry hops add', '+' + est.ibuDry, null, 'on a lab IBU test; it tastes less bitter than kettle IBUs');
      line('Color (SRM)', est.srm || '-', within(est.srm, style && style.srmLow, style && style.srmHigh), style ? `style ${style.srmLow} to ${style.srmHigh}` : null);
      if (est.og > 1) { const yeastRef = D.YEAST.find(y => y.name === cur.yeast); const att = yeastRef ? (yeastRef.attLow + yeastRef.attHigh) / 2 : 75;
        const fgEst = B.fromPoints(B.points(est.og) * (1 - att / 100));
        line('Expected FG and ABV', `${fgEst.toFixed(3)}  /  ${B.abv(est.og, fgEst)}%`, null, yeastRef ? `${yeastRef.name.split('/')[0].trim()} attenuates ${yeastRef.attLow} to ${yeastRef.attHigh}%` : 'assuming 75% attenuation');
        const fp = B.fermentPlan(yeastRef || null, est.og); line('In the fermenter', fp.text.split(',')[0], null, (yeastRef ? `pitch and ferment at ${yeastRef.tempLow} to ${yeastRef.tempHigh}F` : 'pick a yeast from the list for its range') + (fp.lagerWeeks ? `, then ${fp.lagerWeeks[0]} to ${fp.lagerWeeks[1]} weeks cold` : '')); }
      const salts = B.waterAdditions({}, collect().salts.map(s => ({ salt: s.salt, grams: num(s.grams) })), num(cur.batchGal) + 1.5);
      if (collect().salts.length) line('Sulfate : chloride', salts.ratio === null ? '-' : salts.ratio, null, B.ratioVerdict(salts.ratio));
    }
    function fermRow(v) {
      const name = inp(v.name, 'text', { class: 'fname', list: 'ferms' }), lb = inp(v.lb, 'number', { class: 'flb' });
      const row = h('div', { class: 'row', style: 'grid-template-columns:1fr 90px 44px;align-items:end' }, field('Fermentable', name), field('lb', lb), h('button', { class: 'btn secondary', style: 'min-height:48px;padding:0 12px', onclick: () => { row.remove(); refresh(); } }, '\u00D7'));
      [name, lb].forEach(i => i.addEventListener('input', refresh)); row._late = !!v.late;
      return row;
    }
    function hopRow(v) {
      const name = inp(v.name, 'text', { class: 'hname', list: 'hops' }), oz = inp(v.oz, 'number', { class: 'hoz' }), alpha = inp(v.alpha, 'number', { class: 'halpha' }), min = inp(v.minutes, 'number', { class: 'hmin' });
      const type = sel(Object.keys(B.HOP_FORMS).map(k => ({ v: k, t: B.HOP_FORMS[k].label })), v.type || 'pellet'); type.classList.add('htype');
      const formHint = h('p', { class: 'muted small', style: 'margin:-6px 0 10px' }, B.hopForm(v.type).hint);
      const wp = h('input', { type: 'checkbox', class: 'hwp', style: 'width:24px;height:24px;min-height:24px;flex:none;padding:0' }); if (v.whirlpool) wp.checked = true;
      name.addEventListener('change', () => { const ref = D.HOPS.find(x => x.name === name.value); if (ref && !alpha.value) { alpha.value = ((ref.alphaLow + ref.alphaHigh) / 2 * (type.value === 'cryo' ? 2 : 1)).toFixed(1); refresh(); } });
      type.addEventListener('change', () => { formHint.textContent = B.hopForm(type.value).hint; if (type.value === 'extract' && (!alpha.value || num(alpha.value) < 30)) alpha.value = 60; });
      const row = h('div', null, h('div', { class: 'row', style: 'grid-template-columns:1fr 70px 44px;align-items:end' }, field('Hop', name), field('oz', oz), h('button', { class: 'btn secondary', style: 'min-height:48px;padding:0 12px', onclick: () => { row.remove(); refresh(); } }, '\u00D7')),
        h('div', { class: 'row3' }, field('Alpha %', alpha), field('Minutes', min), field('Form', type)),
        formHint,
        h('label', { class: 'field', style: 'display:flex;align-items:center;gap:10px' }, wp, h('span', { style: 'margin:0' }, 'Whirlpool or hop stand: goes in after flameout, at the stand temperature below')));
      [oz, alpha, min].forEach(i => i.addEventListener('input', refresh)); type.addEventListener('change', refresh); wp.addEventListener('change', refresh);
      return row;
    }
    function dryRow(v) {
      const name = inp(v.name, 'text', { class: 'dname', list: 'hops' }), oz = inp(v.oz, 'number', { class: 'doz' }), alpha = inp(v.alpha, 'number', { class: 'dalpha' });
      const type = sel(['pellet', 'leaf', 'cryo', 'wet'].map(k => ({ v: k, t: B.HOP_FORMS[k].label })), v.type || 'pellet'); type.classList.add('dtype');
      const day = inp(v.day, 'number', { class: 'dday', placeholder: 'auto' }), days = inp(v.days || 4, 'number', { class: 'ddays' });
      name.addEventListener('change', () => { const ref = D.HOPS.find(x => x.name === name.value); if (ref && !alpha.value) { alpha.value = ((ref.alphaLow + ref.alphaHigh) / 2 * (type.value === 'cryo' ? 2 : 1)).toFixed(1); refresh(); } });
      const row = h('div', null, h('div', { class: 'row', style: 'grid-template-columns:1fr 70px 44px;align-items:end' }, field('Dry hop', name), field('oz', oz), h('button', { class: 'btn secondary', style: 'min-height:48px;padding:0 12px', onclick: () => { row.remove(); refresh(); } }, '\u00D7')),
        h('div', { class: 'row', style: 'grid-template-columns:1fr 1fr 1fr 1fr' }, field('Alpha %', alpha), field('Form', type), field('Add on day', day), field('Days in', days)));
      row._keep = { added: v.added, extra: v.extra };
      [oz, alpha].forEach(i => i.addEventListener('input', refresh)); type.addEventListener('change', refresh);
      return row;
    }
    function saltRow(v) {
      const name = sel(Object.keys(B.SALTS), v.salt || Object.keys(B.SALTS)[0]); name.classList.add('sname');
      const g = inp(v.grams, 'number', { class: 'sg' });
      const row = h('div', { class: 'row', style: 'grid-template-columns:1fr 90px 44px;align-items:end' }, field('Salt', name), field('grams', g), h('button', { class: 'btn secondary', style: 'min-height:48px;padding:0 12px', onclick: () => { row.remove(); refresh(); } }, '\u00D7'));
      g.addEventListener('input', refresh); name.addEventListener('change', refresh);
      return row;
    }
    (r.fermentables || []).forEach(v => rows.fermentables.append(fermRow(v)));
    (r.hops || []).forEach(v => rows.hops.append(hopRow(v)));
    (r.salts || []).forEach(v => rows.salts.append(saltRow(v)));
    B.dryHopsOf(r).forEach(v => rows.dry.append(dryRow(v)));
    const yeastHint = h('p', { class: 'muted small', style: 'margin:-6px 0 12px' });
    const yeastList = h('datalist', { id: 'yeasts' }, D.YEAST.map(y => h('option', { value: y.name })));
    f.yeast = inp(r.yeast, 'text', { list: 'yeasts' }); f.yeast.addEventListener('input', () => refresh()); f.yeast.addEventListener('change', () => refresh());
    const status = sel(STATUSES, r.status || 'Planned');
    f.ibuModel = sel([{ v: 'smph', t: 'SMPH: the finished beer, as a lab would measure it' }, { v: 'tinseth', t: 'Tinseth: the usual homebrew figure' }], r.ibuModel || IBU_MODEL); f.ibuModel.addEventListener('change', () => refresh());
    f.notes = h('textarea', { rows: 3 }); f.notes.value = r.notes || '';
    add(h('button', { class: 'back', onclick: () => b ? goBack('batches', 'view:' + b.id) : goBack('batches') }, b ? '\u2039 ' + (b.name || 'Batch') : '\u2039 Batches'), h('h2', null, b ? 'Edit batch' : draft ? 'Check the recipe' : 'New batch'),
      draft ? h('p', { class: 'muted small' }, 'Nothing is saved until you press Create batch. Change anything that looks wrong: names come from the app\'s ingredient lists, so pick the closest if one was not recognized.') : null, styleList, yeastList,
      h('datalist', { id: 'ferms' }, D.FERMENTABLES.map(x => h('option', { value: x.name }))), h('datalist', { id: 'hops' }, D.HOPS.map(x => h('option', { value: x.name }))),
      mk('name', 'Name'), field('Style', f.style), h('div', { class: 'row' }, mk('brewDate', 'Brew date', 'date'), field('Status', status)),
      h('div', { class: 'row' }, mk('batchGal', 'Batch size (gal)', 'number'), mk('boilGal', 'Pre-boil volume (gal)', 'number')),
      (() => { const to = inp('', 'number', { placeholder: 'e.g. 10', 'aria-label': 'Scale the recipe to this many gallons' });
        return h('div', { class: 'row', style: 'grid-template-columns:1fr auto;align-items:end' }, field('Scale the whole recipe to (gal)', to, 'Changing the batch size above only changes the math. This multiplies every ingredient to suit.'),
          h('button', { class: 'btn secondary', style: 'margin-bottom:14px', onclick: () => { const g = num(to.value), from = num(f.batchGal.value); if (!(g > 0) || !(from > 0)) return toast('Enter the new size'); const k = g / from;
            for (const el of rows.fermentables.children) { const i = $('.flb', el); if (num(i.value)) i.value = B.roundLb(num(i.value) * k); }
            for (const el of rows.hops.children) { const i = $('.hoz', el); if (num(i.value)) i.value = B.roundOz(num(i.value) * k); }
            for (const el of rows.dry.children) { const i = $('.doz', el); if (num(i.value)) i.value = B.roundOz(num(i.value) * k); }
            for (const el of rows.salts.children) { const i = $('.sg', el); if (num(i.value)) i.value = Math.round(num(i.value) * k * 10) / 10; }
            f.boilGal.value = B.round.r2(g + Math.max(0.5, num(f.boilGal.value) - from)); f.batchGal.value = g; to.value = ''; refresh(); toast(`Scaled from ${from} to ${g} gal`); } }, 'Scale')); })(),
      h('div', { class: 'row' }, mk('boilMin', 'Boil (min)', 'number'), mk('efficiency', 'Mash efficiency %', 'number')),
      h('div', { class: 'row' }, mk('mashF', 'Mash temp (F)', 'number'), mk('mashMin', 'Mash time (min)', 'number', { placeholder: '60' })),
      stats,
      h('h3', null, 'Fermentables'), rows.fermentables, h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => { rows.fermentables.append(fermRow({})); } }, 'Add fermentable')),
      h('h3', null, 'Hops'), field('IBU figure to lead with, and to check against the style', f.ibuModel, 'The other one is always shown beside it'), rows.hops, h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => { rows.hops.append(hopRow({})); } }, 'Add hop')),
      h('div', { class: 'row' }, mk('wpTempF', 'Whirlpool temp (F)', 'number', { placeholder: '175' }), mk('wpMin', 'Whirlpool minutes', 'number', { placeholder: '20' })),
      h('p', { class: 'muted small', style: 'margin:-6px 0 4px' }, 'Only used by hops marked as whirlpool. Hotter and longer means more bitterness from them.'),
      h('h3', null, 'Dry hops'), rows.dry, h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => { rows.dry.append(dryRow({})); } }, 'Add dry hop')),
      h('p', { class: 'muted small', style: 'margin:-4px 0 4px' }, 'Leave "Add on day" blank and the app picks the window from the yeast: after the ferment has slowed, a few days before packaging. Put 2 for a hazy IPA charge during active fermentation.'),
      h('h3', null, 'Yeast'), h('div', { class: 'row', style: 'grid-template-columns:1fr 130px' }, field('Yeast', f.yeast), mk('fermF', 'Pitch at (F)', 'number', { placeholder: 'auto' })), yeastHint,
      h('h3', null, 'Water salts (optional)'), rows.salts, h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => { rows.salts.append(saltRow({})); } }, 'Add salt')),
      b ? h('h3', null, 'Measured, once it is brewed') : null,
      b ? h('div', { class: 'row' }, mk('og', 'Original gravity', 'number', { placeholder: 'e.g. 1.052' }), mk('fg', 'Final gravity', 'number', { placeholder: 'e.g. 1.011' })) : null,
      b ? h('p', { class: 'muted small', style: 'margin:-6px 0 12px' }, 'Logging a gravity reading fills these in for you. Correct them here if one went in wrong.') : null,
      field('Notes', f.notes),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { const out = collect(); out.status = status.value; delete out._said; if (!out.name) return toast('Give the batch a name');
        if (!b && !(await needReg('save'))) return;
        const id = await DB.put('batches', out); state.batchId = out.id || id; await S.set('lastBatch', state.batchId); keepStorage(); toast(b ? 'Saved' : 'Batch created');
        if (b) goBack('batches', 'view:' + state.batchId); else go('batches', 'view:' + state.batchId, { replace: true }); } }, b ? 'Save' : 'Create batch'),
        b ? h('button', { class: 'btn danger', onclick: async () => { if (await deleteBatch(b)) go('batches'); } }, 'Delete') : h('button', { class: 'btn secondary', onclick: () => goBack('batches') }, 'Cancel')));
    ['batchGal', 'boilGal', 'boilMin', 'efficiency', 'wpTempF', 'wpMin', 'fermF'].forEach(k => f[k] && f[k].addEventListener('input', refresh));
    for (const el of view.querySelectorAll('.btn.secondary')) if (/^Add (fermentable|hop|dry hop|salt)$/.test(el.textContent)) el.addEventListener('click', () => { const rowsEl = el.parentElement.previousElementSibling, last = rowsEl && rowsEl.lastElementChild, first = last && last.querySelector('input'); if (first) first.focus(); });
    f.style.addEventListener('input', refresh);
    refresh();
  }
  /* "brewed Nov 10" once it has been; "brew day Nov 10" while it is still a plan. */
  const brewedLine = b => { const d = B.niceDate(b.brewDate); return d ? (b.status === 'Planned' && !b.pitchDate ? 'brew day ' : 'brewed ') + d : null; };
  const isPreboil = e => e.kind === 'preboil' || /^pre-?boil/i.test(e.note || '');
  const isOg = e => e.og === true || e.kind === 'og' || /^OG\b/.test(e.note || '');
  // keep the batch's own record of where the gravity stands in step with its log
  async function syncGravity(b) {
    const rs = (await DB.byBatch('entries', b.id)).filter(e => e.type === 'gravity' && !isPreboil(e) && !isOg(e)).sort((x, y) => (x.date || '').localeCompare(y.date || '') || x.id - y.id);
    b.lastSg = rs.length ? num(rs[rs.length - 1].sg) : ''; await DB.put('batches', b);
  }
  const expectedFg = (b, est) => { const y = yeastOf(b), og = num(b.og) || est.og; return og > 1 ? B.fromPoints(B.points(og) * (1 - (y && y.attHigh ? (y.attLow + y.attHigh) / 2 : 75) / 100)) : null; };
  async function batchView(b) {
    if (!b) return go('batches', null, { replace: true });
    state.batchId = b.id; await S.set('lastBatch', b.id);
    const entries = (await DB.byBatch('entries', b.id)).sort((x, y) => (x.date || '').localeCompare(y.date || '') || x.id - y.id);
    const est = recipeStats(b);
    const readings = entries.filter(e => e.type === 'gravity' && !isPreboil(e));   // a pre-boil reading belongs to brew day, not to the fermentation
    const ferm = B.fermentationStatus(readings.filter(e => !isOg(e)).map(g => ({ date: g.date, sg: num(g.sg) })), num(b.og) || est.og || 1.05);
    const open = type => go('batches', `log:${b.id}:${type}`);
    view.append(h('button', { class: 'back', onclick: () => goBack('batches') }, '\u2039 Batches'),
      h('div', { class: 'hero', style: 'align-items:center;margin-bottom:6px' }, glass(est.srm || 4, 34), h('div', null, h('h2', { style: 'margin:0' }, b.name || 'untitled'), h('p', { class: 'muted', style: 'margin:2px 0 0' }, [b.style && b.style !== b.name ? b.style : null, brewedLine(b), `${b.batchGal} gal`].filter(Boolean).join(' \u00B7 ')))),
      h('div', { class: 'chips scroll', role: 'group', 'aria-label': 'Status' }, STATUSES.map(st => h('button', { class: 'chip' + (b.status === st ? ' on' : ''), style: 'font-family:inherit', 'aria-pressed': String(b.status === st), onclick: async () => { if (b.status === st) return; b.status = st; if (st === 'Fermenting' && !b.pitchDate) b.pitchDate = today(); await DB.put('batches', b); toast(st); render(); } }, st))));
    { const on = view.querySelector('.chips.scroll .chip.on'); if (on) { const box = on.parentNode, r = on.getBoundingClientRect(), br = box.getBoundingClientRect(); box.scrollLeft += r.left - br.left - (br.width - r.width) / 2; } }   // the status it is at, in view: seven chips do not fit a phone
    if (b.sample) view.append(h('div', { class: 'note' }, 'This is an example, so you can see what a brewed and logged batch looks like. ', h('button', { class: 'act', style: 'background:none;border:0;color:var(--amber);font:inherit;padding:0;cursor:pointer;text-decoration:underline', onclick: async () => { for (const e of entries) await DB.del('entries', e.id); await DB.del('batches', b.id); state.batchId = null; toast('Example removed'); go('batches'); } }, 'Remove the example')));
    const readout = h('div', { class: 'readout' });
    const line = (l, v, n, tone) => readout.append(h('div', { class: 'line ' + (tone || '') }, h('span', { class: 'l' }, l, n ? h('span', { class: 'n' }, n) : null), h('span', { class: 'v' }, v)));
    const og = num(b.og) || est.og, fg = num(b.fg) || (ferm.sg || 0), fgEst = expectedFg(b, est);
    line('OG', num(b.og) ? num(b.og).toFixed(3) : (est.og > 1 ? est.og.toFixed(3) + ' est' : '-'), num(b.og) && est.og > 1 ? `the recipe estimated ${est.og.toFixed(3)}` : 'log a gravity reading before you pitch and it goes here');
    const packed = ['Packaged', 'Drinking', 'Finished'].includes(b.status);
    line('FG', fg ? Number(fg).toFixed(3) : '-', ferm.state !== 'no readings' ? `${packed ? 'final' : ferm.ready ? `stable ${ferm.stableFor} days: ready to package` : ferm.state}, ${ferm.attenuation}% attenuation` : fgEst ? `expect about ${fgEst.toFixed(3)}` : null, ferm.ready && !packed ? 'ok' : '');
    if (og > 1 && fg && fg < og) line('ABV', B.abv(og, fg) + '%', `${B.calories(og, fg)} calories per 12 oz`);
    const bi = batchIbu(b, est);
    line('IBU / SRM', `${bi.v || '-'} / ${est.srm || '-'}`, [og > 1 && bi.v ? `BU:GU ${B.bitternessRatio(bi.v, og)}` : null, bi.label, bi.other, est.ibuDry ? `dry hops +${est.ibuDry} on a lab test` : null].filter(Boolean).join(' \u00B7 '));
    if (num(b.og)) { const eff = batchEfficiency(b); if (eff) line('Mash efficiency', eff + '%', `planned ${b.efficiency}%`); }
    view.append(readout);
    // A first reading logged before the app asked which one was the OG (anything from 1.8), or with the box left unchecked: offer it, never guess.
    const fresh = readings.filter(e => !isOg(e)), cand = !num(b.og) && fresh.length ? fresh[0] : null;
    if (cand && num(cand.sg) > 1.02 && fresh.every(e => num(e.sg) <= num(cand.sg)) && (!b.brewDate || Math.abs(B.daysBetween(b.brewDate, cand.date)) <= 1))
      view.append(h('div', { class: 'note' }, `Was ${num(cand.sg).toFixed(3)} on ${B.niceDate(cand.date)} your original gravity? `, h('button', { class: 'btn sm', style: 'margin:6px 0 0', onclick: async () => { cand.og = true; await DB.put('entries', cand); b.og = num(cand.sg); await syncGravity(b); toast('OG set'); render(); } }, 'Yes, use it as the OG')));
    // what actually happened on brew day, against the plan
    const act = b.actuals || {}, actKeys = Object.keys(B.ACTUAL_LABELS).filter(k => act[k] !== undefined && act[k] !== '');
    if (actKeys.length) { const target = { mashInF: b.mashF ? `target ${b.mashF}F` : null, boilTotal: b.boilMin ? `planned ${b.boilMin} min` : null, pitchF: yeastOf(b) ? `range ${yeastOf(b).tempLow} to ${yeastOf(b).tempHigh}F` : null };
      view.append(h('h3', null, 'Brew day, as it happened'), h('div', { class: 'tablewrap' }, h('table', { class: 'ref', style: 'min-width:0' }, h('tbody', null, actKeys.map(k => h('tr', null, h('th', { style: 'width:42%' }, B.ACTUAL_LABELS[k]), h('td', { class: 'mono' }, B.fmtActual(k, act[k])), h('td', { class: 'muted small' }, target[k] || ''))))))); }
    if ((b.process || []).length) view.append(h('p', { class: 'muted small' }, 'Process: ' + b.process.join(' \u00B7 ')));
    // how long it sits, and when the dry hops go in
    const fi = fermentInfo(b), done = ['Packaged', 'Drinking', 'Finished'].includes(b.status);
    if (!done) {
      const box = h('div', { class: 'note' }, h('b', { style: 'color:var(--text)' }, `In the fermenter: ${fi.plan.text}`),
        h('div', null, fi.pitched ? `Pitched ${B.niceDate(fi.pitched)}: day ${fi.day}. First gravity check about ${B.niceDate(B.addDays(fi.pitched, fi.plan.checkDay))}, earliest packaging about ${B.niceDate(B.addDays(fi.pitched, fi.plan.low))}.` : 'Counted from the day you pitch. '),
        h('div', null, fi.plan.note, ' An estimate: gravity decides, not the calendar.'));
      for (const hp of fi.sched) box.append(h('div', { style: 'margin-top:6px' }, hp.added ? h('span', { class: 'badge ok' }, 'added ' + B.niceDate(hp.added)) : fi.due.includes(hp) ? h('span', { class: 'badge ' + (fi.overdue.includes(hp) ? 'overdue' : 'due') }, fi.overdue.includes(hp) ? 'overdue' : 'due now') : h('span', { class: 'badge' }, 'dry hop'),
        `${hp.oz ? hp.oz + ' oz ' : ''}${hp.name}: ${hp.fromDate ? `${B.niceDate(hp.fromDate)} to ${B.niceDate(hp.toDate)}` : `day ${hp.fromDay} to ${hp.toDay}`}, ${hp.days} days in`));
      view.append(box);
    }
    // the one thing most likely wanted next, then everything else in two quiet rows
    const brewing = ['Planned', 'Brewing'].includes(b.status);
    view.append(brewing ? h('button', { class: 'btn block', style: 'min-height:54px;font-size:17px', onclick: async () => { b.onBrewday = true; await DB.put('batches', b); state.batchId = b.id; go('brewday'); } }, 'Brew day')
      : done ? h('button', { class: 'btn block', style: 'min-height:54px;font-size:17px', onclick: () => open('tasting') }, 'Log tasting')
        : h('button', { class: 'btn block', style: 'min-height:54px;font-size:17px', onclick: () => open('gravity') }, 'Log gravity'));
    const sm = (label, fn) => h('button', { class: 'btn secondary sm', onclick: fn }, label);
    view.append(h('div', { class: 'btns tight' }, h('span', { class: 'muted small lead' }, 'Log'),
        brewing || done ? sm('Log gravity', () => open('gravity')) : null, sm('Log dry hop', () => open('dryhop')), sm('Log packaging', () => open('package')), done ? null : sm('Log tasting', () => open('tasting')), sm('Log note', () => open('note')),
        fi.pitched && !done ? sm('Reminders to calendar', () => { downloadText(B.icsFor(b.name || 'Batch', fi.pitched, fi.plan, fi.sched.filter(x => !x.added)), `${(b.name || 'batch').replace(/[^\w-]/g, '_')}-reminders.ics`, 'text/calendar'); toast('Open the file to add the reminders to your calendar'); }) : null),
      h('div', { class: 'btns tight' }, h('span', { class: 'muted small lead' }, 'Recipe'),
        brewing ? null : sm('Brew day', async () => { b.onBrewday = true; await DB.put('batches', b); state.batchId = b.id; go('brewday'); }),
        sm('Edit recipe', () => go('batches', 'edit:' + b.id)), sm('Shopping list', () => { state.batchId = b.id; go('shop'); }), sm('Brew it again', () => rebrew(b, entries)),
        sm('Share recipe', () => shareRecipe(b, est)), sm('Batch card', () => batchCard(b, est, og, fg)),
        sm('Export BeerXML', async () => { const xml = window.BeerXML.exportRecipe(b, { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }); const file = new File([xml], `${(b.name || 'recipe').replace(/[^\w-]/g, '_')}.xml`, { type: 'application/xml' });
          if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { try { await navigator.share({ title: b.name, files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
          const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove(); toast('BeerXML saved; import it in Brewfather, BeerSmith or Brewer\'s Friend'); })));
    if (readings.length > 1) view.append(gravityChart(readings, og, fgEst, ferm, packed));
    if (b.notes) view.append(h('h3', null, 'Notes'), h('p', { style: 'white-space:pre-wrap' }, b.notes));
    view.append(h('h3', null, 'Log'));
    if (!entries.length) view.append(h('div', { class: 'empty' }, 'Nothing logged yet. Brew day steps, gravity readings, dry hops, packaging and tasting notes all collect here.'));
    const LBL = { gravity: 'Gravity', step: 'Brew day', note: 'Note', package: 'Packaging', tasting: 'Tasting', dryhop: 'Dry hop', sugar: 'Late addition' };
    for (const e of entries.slice().reverse()) view.append(h('div', { class: 'rec' }, h('div', { class: 't' }, h('b', null, `${B.niceDate(e.date)}  ${LBL[e.type] || 'Note'}`),
      h('div', { class: 'meta' }, e.type === 'gravity' ? `${Number(e.sg).toFixed(3)}${e.instrument === 'brix' ? ' (from ' + e.raw + ' Brix)' : e.tempF ? ' at ' + e.tempF + 'F' : ''}${e.fermTempF ? ' \u00B7 fermenter ' + e.fermTempF + 'F' : ''}${e.note ? ' \u00B7 ' + e.note : ''}` : [e.text, e.note].filter(Boolean).join(' \u00B7 '))),
      h('button', { class: 'act', onclick: async () => { if (!confirm('Delete this entry?')) return; await DB.del('entries', e.id);
        if (e.type === 'gravity') { if (isOg(e) && num(b.og) === num(e.sg)) b.og = ''; await syncGravity(b); } render(); } }, 'Delete')));
    view.querySelectorAll('.rec > .act').forEach(el => { if (el.textContent === 'Delete') el.classList.add('quiet'); });
    view.append(h('div', { class: 'btns', style: 'margin-top:28px' }, h('button', { class: 'btn danger', onclick: async () => { if (await deleteBatch(b)) go('batches'); } }, 'Delete this batch')));
  }
  /* Gravity against time. Days run along the bottom (not just the order the readings came in), the dashed line is where the
     yeast is expected to finish, and fermenter temperatures ride along the top when they were logged. */
  function gravityChart(readings, og, fgEst, ferm, packed) {
    const pts = readings.map(g => ({ d: g.date, sg: num(g.sg), t: num(g.fermTempF) })).filter(p => p.sg > 0);
    const span = B.daysBetween(pts[0].d, pts[pts.length - 1].d), byDay = span > 0;
    const hi = Math.max(og || 0, ...pts.map(p => p.sg)) + 0.002, lo = Math.min(fgEst || 9, ...pts.map(p => p.sg)) - 0.003;
    const W = 320, H = 170, L = 40, R = 8, T = 12, Bm = 22;
    const x = (p, i) => L + (byDay ? B.daysBetween(pts[0].d, p.d) / span : i / Math.max(1, pts.length - 1)) * (W - L - R);
    const y = sg => T + (hi - sg) / Math.max(0.001, hi - lo) * (H - T - Bm);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p, i).toFixed(1)},${y(p.sg).toFixed(1)}`).join(' ');
    const ticks = [hi - 0.002, (hi + lo) / 2, lo + 0.003].map(v => Math.round(v * 1000) / 1000);
    const temps = pts.filter(p => p.t > 0), tLo = Math.min(...temps.map(p => p.t)), tHi = Math.max(...temps.map(p => p.t));
    const ty = t => T + 4 + (tHi === tLo ? 0.5 : (tHi - t) / (tHi - tLo)) * 22;
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gravity readings over time" style="width:100%;height:auto;background:var(--panel);border:1px solid var(--line);border-radius:6px">
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 5}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="ui-monospace,Menlo,monospace">${v.toFixed(3)}</text>`).join('')}
      ${fgEst && fgEst > lo && fgEst < hi ? `<line x1="${L}" x2="${W - R}" y1="${y(fgEst).toFixed(1)}" y2="${y(fgEst).toFixed(1)}" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - R - 3}" y="${(y(fgEst) - 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--ok)">expected ${fgEst.toFixed(3)}</text>` : ''}
      ${temps.length > 1 ? `<path d="${temps.map((p, i) => `${i ? 'L' : 'M'}${x(p, pts.indexOf(p)).toFixed(1)},${ty(p.t).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="2 3"/>` : ''}
      <path d="${path}" fill="none" stroke="var(--amber)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p, i) => `<circle cx="${x(p, i).toFixed(1)}" cy="${y(p.sg).toFixed(1)}" r="3.5" fill="var(--amber)" stroke="var(--panel)" stroke-width="1.5"/>`).join('')}
      <text x="${L}" y="${H - 6}" font-size="10" fill="var(--muted)">${B.niceDate(pts[0].d)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="10" fill="var(--muted)">${byDay ? 'day ' + span : B.niceDate(pts[pts.length - 1].d)}</text>
    </svg>`;
    const last = pts[pts.length - 1];
    return h('div', null, h('h3', null, 'Fermentation'), h('div', { html: svg }),
      h('p', { class: 'muted small', style: 'margin-top:6px' }, `${pts.length} readings${byDay ? ` over ${span} day${span === 1 ? '' : 's'}` : ''}: ${pts[0].sg.toFixed(3)} down to ${last.sg.toFixed(3)}.`,
        temps.length > 1 ? ` Fermenter ${tLo === tHi ? tLo : tLo + ' to ' + tHi}F (dotted).` : '', packed ? '' : ferm && ferm.ready ? ' The gravity has stopped moving: it is ready to package.' : ferm && ferm.state === 'stable' ? ' Same reading twice: check once more in a day or two before you package.' : ''));
  }
  // a planned copy of a brewed batch, carrying forward what the last tasting said to change
  function rebrew(b, entries) {
    const nb = JSON.parse(JSON.stringify(b)); for (const k of ['id', 'og', 'fg', 'lastSg', 'actuals', 'process', 'pitchDate', 'onBrewday', 'waterNote', 'sample']) delete nb[k];
    nb.name = B.nextBrewName((b.name || 'Batch').replace(/^Example:\s*/, '')); nb.status = 'Planned'; nb.brewDate = today();
    nb.fermentables = (b.fermentables || []).filter(f => !f.late); nb.dryHops = B.dryHopsOf(b).map(d => { const c = Object.assign({}, d); delete c.added; delete c.extra; return c; });
    const last = entries.filter(e => e.type === 'tasting' && e.note).pop();
    nb.notes = [`Rebrew of ${b.name || 'a batch'}, brewed ${B.niceDate(b.brewDate)}.`, last ? `Last time you said: ${last.note}` : '', b.notes || ''].filter(Boolean).join('\n').slice(0, 1500);
    state.draft = nb; go('batches', 'new');
  }
  /* The recipe as a link: everything is packed into the address itself, so there is nothing to upload and nothing to host. Whoever
     opens it sees the recipe in their own copy of the app, can save it, and can fill a cart from it. */
  async function shareRecipe(b, est) {
    const url = APP_URL + '#r=' + RT.encodeShare(b), og = num(b.og) || est.og, fgEst = expectedFg(b, est);
    const text = RT.asText(b, { og: og > 1 ? og.toFixed(3) : '', ibu: batchIbu(b, est).v, abv: og > 1 && fgEst ? B.abv(og, fgEst) : '' });
    if (navigator.share) { try { await navigator.share({ title: b.name || 'Recipe', text: text + '\n\nOpen it in Brew Log:', url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text + '\n\nOpen it in Brew Log: ' + url); toast('Recipe and link copied'); }
    catch (e) { const box = h('textarea', { rows: 8, readonly: true, style: 'width:100%;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:var(--radius);padding:10px;font:inherit;font-size:14px' }); box.value = text + '\n\nOpen it in Brew Log: ' + url;
      sheet(close => [h('h2', null, 'Share this recipe'), h('p', { class: 'muted small' }, 'Copy this and send it. The link opens the recipe in Brew Log.'), box, h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: close }, 'Done'))]); box.focus(); box.select(); }
  }
  /* A picture of the batch to post or print: the beer in its own color, its name and its numbers. Drawn on a canvas, so it
     needs no network and nothing is uploaded. */
  async function batchCard(b, est, og, fg) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); if (!c) return toast('This browser cannot draw the card');
    const font = (wt, px) => `${wt} ${px}px -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`, beer = B.srmHex(est.srm || 6);
    c.fillStyle = '#2A1B10'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#F2A03D'; c.fillRect(0, 0, W, 14);
    // the glass
    const gx = W / 2, gy = 150, gw = 330, gh = 470;
    c.fillStyle = beer; c.beginPath(); c.moveTo(gx - gw / 2, gy + 60); c.lineTo(gx + gw / 2, gy + 60); c.lineTo(gx + gw / 2 - 38, gy + gh - 30); c.quadraticCurveTo(gx + gw / 2 - 40, gy + gh, gx + gw / 2 - 72, gy + gh); c.lineTo(gx - gw / 2 + 72, gy + gh); c.quadraticCurveTo(gx - gw / 2 + 40, gy + gh, gx - gw / 2 + 38, gy + gh - 30); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 22; c.lineCap = 'round'; c.beginPath(); c.moveTo(gx - gw / 2 + 62, gy + 120); c.lineTo(gx - gw / 2 + 84, gy + gh - 110); c.stroke();
    c.fillStyle = '#FFF8EC'; for (const [dx, dy, r] of [[-125, 34, 58], [-45, 8, 68], [50, 14, 64], [128, 38, 52]]) { c.beginPath(); c.arc(gx + dx, gy + dy, r, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.roundRect ? c.roundRect(gx - gw / 2 - 26, gy + 20, gw + 52, 84, 42) : c.rect(gx - gw / 2 - 26, gy + 20, gw + 52, 84); c.fill();
    // name, wrapped to two lines at most
    c.fillStyle = '#FBF4EA'; c.textAlign = 'center'; let size = 84; const name = (b.name || 'Untitled').replace(/^Example:\s*/, '');
    const wrap = px => { c.font = font(700, px); const words = name.split(/\s+/), out = ['']; for (const wd of words) { const t = out[out.length - 1] ? out[out.length - 1] + ' ' + wd : wd; if (c.measureText(t).width > W - 160 && out[out.length - 1]) out.push(wd); else out[out.length - 1] = t; } return out; };
    let lines = wrap(size); while ((lines.length > 2 || lines.some(l => c.measureText(l).width > W - 120)) && size > 44) { size -= 6; lines = wrap(size); }
    lines.slice(0, 2).forEach((l, i) => c.fillText(l, W / 2, 730 + i * (size + 12)));
    const ty = 730 + (Math.min(2, lines.length) - 1) * (size + 12);
    c.fillStyle = '#C9B79F'; c.font = font(400, 40); c.fillText([b.style && b.style !== b.name ? b.style : '', brewedLine(b)].filter(Boolean).join('  \u00B7  '), W / 2, ty + 70);
    // the numbers
    const measured = og > 1 && fg && fg < og, bi = batchIbu(b, est), fgEst = expectedFg(b, est);
    const cells = [[measured ? B.abv(og, fg).toFixed(1) + '%' : (og > 1 && fgEst ? '~' + B.abv(og, fgEst).toFixed(1) + '%' : '-'), 'ABV'], [bi.v ? String(bi.v) : '-', 'IBU'], [og > 1 ? og.toFixed(3) : '-', 'OG'], [measured ? Number(fg).toFixed(3) : (fgEst ? '~' + fgEst.toFixed(3) : '-'), 'FG']];
    const cw = (W - 160) / 4, cy = ty + 150;
    c.fillStyle = '#F2A03D'; c.beginPath(); c.roundRect ? c.roundRect(80, cy, W - 160, 190, 18) : c.rect(80, cy, W - 160, 190); c.fill();
    cells.forEach(([v, l], i) => { c.fillStyle = '#1B1407'; c.font = font(700, 62); c.fillText(v, 80 + cw * i + cw / 2, cy + 92); c.font = font(600, 30); c.fillText(l, 80 + cw * i + cw / 2, cy + 146); });
    const hops = [...new Set((b.hops || []).concat(B.dryHopsOf(b)).map(x => x.name).filter(Boolean))].slice(0, 4).join(', '), y = yeastOf(b);
    c.fillStyle = '#C9B79F'; c.font = font(400, 34); const facts = [hops ? 'Hops: ' + hops : '', b.yeast ? 'Yeast: ' + (y ? y.name.split('/')[0].trim() : b.yeast) : ''].filter(Boolean); facts.forEach((t, i) => c.fillText(t.length > 56 ? t.slice(0, 55) + '\u2026' : t, W / 2, cy + 256 + i * 48));
    c.fillStyle = '#F2A03D'; c.font = font(700, 34); c.fillText('BREW LOG', W / 2, H - 78); c.fillStyle = '#C9B79F'; c.font = font(400, 28); c.fillText(APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, H - 38);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png')); if (!blob) return toast('Could not make the picture');
    const file = new File([blob], `${(b.name || 'batch').replace(/[^\w-]+/g, '_')}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { try { await navigator.share({ files: [file], title: b.name || 'Batch' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove(); toast('Picture saved');
  }
  const ENTRY_TITLES = { gravity: 'Gravity reading', note: 'Note', package: 'Packaging', tasting: 'Tasting notes', dryhop: 'Dry hop added' };
  async function entryForm(b, type) {
    view.innerHTML = '';
    const date = inp(today(), 'date'), note = inp('', 'text');
    const leave = () => goBack('batches', 'view:' + b.id);
    view.append(h('button', { class: 'back', onclick: leave }, '\u2039 ' + (b.name || 'batch')), h('h2', null, ENTRY_TITLES[type]), field('Date', date));
    let collect;
    if (type === 'gravity') {
      const mode = sel([{ v: 'sg', t: 'Hydrometer (SG)' }, { v: 'brix', t: 'Refractometer (Brix)' }], 'sg');
      // separate inputs per instrument: one element cannot live in two rows
      const sg = inp('', 'number', { placeholder: 'e.g. 1.012' }), temp = inp('', 'number'), fermTemp = inp('', 'number'), obrix = inp('', 'number'), cbrix = inp('', 'number', { placeholder: 'e.g. 6.5' });
      const corrected = h('p', { class: 'muted small' });
      const sgRow = h('div', { class: 'row' }, field('Specific gravity', sg), field('Sample temp (F)', temp));
      const brixRow = h('div', { class: 'row' }, field('Original Brix (at pitch)', obrix), field('Current Brix', cbrix));
      const wrap = h('div', null, sgRow);
      const update = () => {
        if (mode.value === 'sg') { const v = num(sg.value), t = num(temp.value); corrected.textContent = v && t ? `Corrected for temperature: ${B.hydrometerCorrect(v, t, EQ.hydroCalF).toFixed(3)} (hydrometer calibrated at ${EQ.hydroCalF}F)` : ''; }
        else { const ob = num(obrix.value), cb = num(cbrix.value); if (!cb) { corrected.textContent = ''; return; } const val = ob ? B.refractoFg(ob, cb, EQ.wcf) : B.brixToSgUnfermented(cb, EQ.wcf); corrected.textContent = `${ob ? 'Corrected for alcohol' : 'Unfermented wort gravity'}: ${val.toFixed(3)} (correction factor ${EQ.wcf})`; }
      };
      mode.addEventListener('change', () => { wrap.innerHTML = ''; wrap.append(mode.value === 'sg' ? sgRow : brixRow); update(); });
      [sg, temp, obrix, cbrix].forEach(i => i.addEventListener('input', update));
      // the reading taken before pitching is the batch's original gravity: say so and ABV and efficiency are worked out from it
      const prior = (await DB.byBatch('entries', b.id)).filter(e => e.type === 'gravity' && !isPreboil(e)).length;
      const ogBox = h('input', { type: 'checkbox', style: 'width:24px;height:24px;min-height:24px;flex:none;padding:0' }); ogBox.checked = !num(b.og) && !prior && ['Planned', 'Brewing', 'Fermenting'].includes(b.status);
      view.append(field('Instrument', mode), wrap, corrected,
        h('label', { class: 'field', style: 'display:flex;align-items:center;gap:10px' }, ogBox, h('span', { style: 'margin:0;color:var(--text)' }, 'This is the original gravity (OG), taken before pitching', num(b.og) ? h('span', { class: 'muted small', style: 'display:block' }, `The batch already has an OG of ${num(b.og).toFixed(3)}; check this to replace it.`) : null)),
        field('Fermenter temp (F), optional', fermTemp), field('Note', note));
      collect = () => {
        const rec = { instrument: mode.value, note: note.value.trim() }; if (num(fermTemp.value)) rec.fermTempF = num(fermTemp.value);
        if (ogBox.checked) { rec.og = true; rec.note = rec.note ? 'OG, ' + rec.note : 'OG'; }
        if (mode.value === 'sg') { const v = num(sg.value); if (!v) { toast('Enter the reading'); return null; } rec.raw = v; rec.sg = num(temp.value) ? B.hydrometerCorrect(v, num(temp.value), EQ.hydroCalF) : v; rec.tempF = temp.value; }
        else { const v = num(cbrix.value); if (!v) { toast('Enter the reading'); return null; } const ob = num(obrix.value); rec.raw = v; rec.sg = ob ? B.refractoFg(ob, v, EQ.wcf) : B.brixToSgUnfermented(v, EQ.wcf); if (ob) rec.obrix = ob; }
        return rec; };
    } else if (type === 'dryhop') {
      const planned = B.dryHopsOf(b).filter(d => !d.added), first = planned[0] || {};
      const name = inp(first.name || '', 'text', { list: 'dhops' }), oz = inp(first.oz || '', 'number'), form = sel(['pellet', 'leaf', 'cryo', 'wet'].map(k => ({ v: k, t: B.HOP_FORMS[k].label })), first.type || 'pellet');
      view.append(h('datalist', { id: 'dhops' }, D.HOPS.map(x => h('option', { value: x.name }))));
      if (planned.length) view.append(h('div', { class: 'chips' }, planned.map(d => h('button', { class: 'chip', style: 'font-family:inherit', onclick: () => { name.value = d.name; oz.value = d.oz; form.value = d.type || 'pellet'; } }, `${d.oz ? d.oz + ' oz ' : ''}${d.name}`))));
      view.append(field('Hop', name, planned.length ? 'Tap one from the recipe above, or type anything: extra hops for fun are logged and counted too' : 'Not in the recipe? Log it anyway and it is added to the batch'), h('div', { class: 'row' }, field('Amount (oz)', oz), field('Form', form)), field('Note', note));
      collect = () => { if (!name.value.trim()) { toast('Which hop?'); return null; }
        return { hop: name.value.trim(), oz: oz.value, form: form.value, note: note.value.trim(), text: `${oz.value ? oz.value + ' oz ' : ''}${name.value.trim()} (${B.hopForm(form.value).label.toLowerCase()})` }; };
    } else if (type === 'package') {
      const carb = D.carbFor(b.style);
      const carbSel = sel([{ v: '', t: 'Carbonate by style\u2026' }].concat(D.CARBONATION.map(c => ({ v: c.name, t: `${c.name}: ${c.low} to ${c.high}` }))), carb ? carb.name : '');
      const method = sel(['Bottles', 'Keg', 'Cans', 'Cask'], 'Bottles'), vols = inp(carb ? carb.mid : 2.4, 'number'), temp = inp(68, 'number'), gal = inp(b.batchGal, 'number'), sugar = sel(Object.keys(B.SUGARS), Object.keys(B.SUGARS)[0]), psi = inp('', 'number');
      const calc = h('p', { class: 'muted small' });
      const update = () => { psi.placeholder = method.value === 'Keg' ? String(B.kegPsi(num(temp.value) || 38, num(vols.value) || 2.4)) : ''; if (method.value === 'Keg') { const p = B.kegPsi(num(temp.value) || 38, num(vols.value) || 2.4); calc.textContent = `Set the regulator to about ${p} psi at ${temp.value || 38}F for ${vols.value || 2.4} volumes`; } else { const p = B.primingSugar(num(gal.value) || 5, num(temp.value) || 68, num(vols.value) || 2.4, sugar.value); calc.textContent = `${p.grams} g (${p.oz} oz) of ${sugar.value} for ${vols.value || 2.4} volumes, residual ${B.residualCo2(num(temp.value) || 68)}`; } };
      const carbNote = h('span', { class: 'muted small' });
      const carbText = () => { const c = D.CARBONATION.find(x => x.name === carbSel.value); carbNote.textContent = c ? `${c.low} to ${c.high} volumes${c.note ? '. ' + c.note : ''}${num(vols.value) > 3 ? '. Over 3.0: heavy bottles only' : ''}` : (num(vols.value) > 3 ? 'Over 3.0 volumes: heavy bottles only' : ''); };
      carbSel.addEventListener('change', () => { const c = D.CARBONATION.find(x => x.name === carbSel.value); if (c) vols.value = c.mid; carbText(); update(); });
      method.addEventListener('change', () => { temp.value = method.value === 'Keg' ? 38 : 68; update(); });
      vols.addEventListener('input', carbText); carbText();
      [method, vols, temp, gal, sugar].forEach(i => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', update));
      view.append(field('Carbonation for the style', carbSel, carb ? `picked from the batch style, ${b.style}` : null), carbNote, field('Method', method), h('div', { class: 'row' }, field('Target CO2 (volumes)', vols), field('Beer temp (F)', temp, 'kegs: serving temp; bottles: warmest since fermentation')), h('div', { class: 'row' }, field('Volume packaged (gal)', gal), field('Priming sugar', sugar)), calc, field('Regulator set to (psi), if kegged', psi), field('Note', note));
      update();
      collect = () => ({ method: method.value, volumes: num(vols.value), tempF: num(temp.value), gal: num(gal.value), sugar: method.value === 'Keg' ? '' : sugar.value, grams: method.value === 'Keg' ? 0 : B.primingSugar(num(gal.value) || 5, num(temp.value) || 68, num(vols.value) || 2.4, sugar.value).grams, psi: num(psi.value), note: note.value.trim(), text: `${method.value}, ${vols.value} vol${method.value === 'Keg' ? `, ${psi.value || B.kegPsi(num(temp.value) || 38, num(vols.value) || 2.4)} psi at ${temp.value}F` : `, ${B.primingSugar(num(gal.value) || 5, num(temp.value) || 68, num(vols.value) || 2.4, sugar.value).grams} g ${sugar.value}`}` });
    } else if (type === 'tasting') {
      const f = {}; const mk = k => { f[k] = inp('', 'text'); return field(k[0].toUpperCase() + k.slice(1), f[k]); };
      const score = sel(['', '1', '2', '3', '4', '5'], '');
      view.append(mk('appearance'), mk('aroma'), mk('flavor'), mk('mouthfeel'), field('Score out of 5', score), field('Would you brew it again? What changes?', note));
      collect = () => { const parts = Object.keys(f).map(k => f[k].value.trim() ? `${k}: ${f[k].value.trim()}` : null).filter(Boolean); if (!parts.length && !note.value.trim()) { toast('Write something'); return null; } return { score: score.value, text: parts.join('; ') + (score.value ? ` (${score.value}/5)` : ''), note: note.value.trim() }; };
    } else {
      const text = h('textarea'); view.append(field('Note', text));
      collect = () => { if (!text.value.trim()) { toast('Write something'); return null; } return { text: text.value.trim() }; };
    }
    view.append(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => {
      const data = collect(); if (!data) return;
      const rec = Object.assign({ batchId: b.id, type, date: date.value || today(), created: Date.now() }, data);
      await DB.put('entries', rec);
      if (type === 'dryhop') { const list = B.dryHopsOf(b).map(d => Object.assign({}, d)); const hit = list.find(d => !d.added && d.name.toLowerCase() === data.hop.toLowerCase());
        if (hit) { hit.added = rec.date; if (data.oz) hit.oz = data.oz; hit.type = data.form; } else { const ref = D.HOPS.find(x => x.name === data.hop); list.push({ name: data.hop, oz: data.oz, type: data.form, alpha: ref ? ((ref.alphaLow + ref.alphaHigh) / 2).toFixed(1) : '', days: 4, day: '', added: rec.date, extra: true }); }
        b.dryHops = list; b.extras = (b.extras || []).filter(e => !/^dry hop:/i.test(String(e || ''))); await DB.put('batches', b); }
      if (type === 'gravity') { if (rec.og) b.og = rec.sg; await syncGravity(b); }
      if (type === 'package') { if (!num(b.fg) && num(b.lastSg)) b.fg = num(b.lastSg); if (['Planned', 'Brewing', 'Fermenting', 'Conditioning'].includes(b.status)) b.status = 'Packaged'; await DB.put('batches', b); }
      if (type === 'tasting' && ['Packaged'].includes(b.status)) { b.status = 'Drinking'; await DB.put('batches', b); }
      toast(rec.og ? 'Logged as the OG' : 'Logged'); leave(); } }, 'Save'),
      h('button', { class: 'btn secondary', onclick: leave }, 'Cancel')));
  }

  // ---------- brew day ----------
  let timer = null;
  /* One clock for the whole app. The guided brew day and the quick sheet keep their timers as start times in storage; this loop is
     the only thing that rings, and it runs whatever screen is showing, so a hop addition still sounds while you are in a calculator.
     A due addition keeps ringing every 20 seconds until it is checked off or three minutes have passed. */
  let goLive = null, goView = null, sheetLive = null, audioCtx = null;
  const rang = {};
  /* Phones only let a page make sound after a tap, and only on an audio context that was started by one: so the context is made
     (and a silent blip played) on the tap that starts a timer, and kept for the alarms that come later. */
  function unlockAudio() { try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; if (!audioCtx) audioCtx = new AC(); if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(); g.gain.value = 0.0001; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.05); } catch (e) { /* no audio */ } }
  function alarmTick() {
    const pill = $('#timerPill'), now = Date.now(); let label = '', ringingNow = false;
    const g = goLive, step = g && g.plan[g.st.i], started = step && step.kind === 'timer' ? g.st.timers[step.id] : null;
    if (started) {
      const el = Math.floor((now - started) / 1000), left = step.minutes * 60 - el, fresh = []; let again = false;
      for (const a of step.alarms || []) { const k = step.id + ':' + a.at, due = started + a.at * 60000; if (now < due) continue;
        if (!g.st.fired[k]) { g.st.fired[k] = now - due > 120000 ? due : now; fresh.push(a); rang[k] = now; }          // long overdue (the app was closed): ring once, do not nag
        else if (!g.st.ticked[k] && now - g.st.fired[k] < 180000) { ringingNow = true; if (now - (rang[k] || 0) >= 20000) { rang[k] = now; again = true; } } }
      if (fresh.length) { S.set(g.key, g.st); beep(3); notify(step.title, fresh[fresh.length - 1].label); ringingNow = true; } else if (again) beep(2);
      const upcoming = (step.alarms || []).find(a => a.at * 60 > el);
      label = `${left < 0 ? '+' : ''}${fmtMS(left)}${upcoming ? ' \u00B7 next in ' + fmtMS(upcoming.at * 60 - el) : ''}`;
      if (goView) goView(el, left, upcoming);
    }
    const sl = sheetLive;
    if (sl && sl.start) { const s2 = Math.floor((now - sl.start) / 1000);
      for (const a of sl.additions) { const k = 'sheet:' + sl.id + ':' + a.at + ':' + a.label; if (s2 >= a.at * 60 && !rang[k]) { rang[k] = now; if (s2 - a.at * 60 < 120) { beep(3); notify('Boil', a.label); ringingNow = true; } } }
      if (!label && s2 < (sl.boilLen + 30) * 60) { const next = sl.additions.find(a => a.at * 60 > s2); label = `${fmtMS(s2)}${next ? ' \u00B7 next in ' + fmtMS(next.at * 60 - s2) : ''}`; } }
    if (pill) { const onScreen = state.tab === 'brewday'; pill.hidden = !label || onScreen; pill.textContent = label; pill.classList.toggle('ring', ringingNow); }
  }
  setInterval(alarmTick, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ((goLive && goLive.plan[goLive.st.i] && goLive.st.timers[goLive.plan[goLive.st.i].id]) || (sheetLive && sheetLive.start))) keepAwake(); });
  // after a reload in the middle of a brew day, pick the clocks up where they were
  async function resumeBrewday() {
    const id = await S.get('goActive', null); if (!id) return;
    const b = await DB.get('batches', id), st = b ? await S.get('go:' + id, null) : null; if (!b || !st) return;
    EQ = await equip(); const est = recipeStats(b); goLive = { b, st, key: 'go:' + id, plan: B.brewPlan(b, EQ, grainLbOf(b), est.boilG, yeastOf(b)) };
  }
  const onBrewday = x => x.onBrewday === true || (x.onBrewday !== false && (['Planned', 'Brewing'].includes(x.status) || (x.status === 'Fermenting' && (x.pitchDate || x.brewDate) === today())));
  const grainLbOf = b => (b.fermentables || []).reduce((s, f) => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return s + ((ref && ref.extract) || f.late ? 0 : num(f.lb)); }, 0);
  // small inputs for the numbers a step records; read() returns only what was typed, parsed
  function stepInputs(fields, saved) {
    const els = {}; const wrap = h('div', { class: 'ins' });
    for (const f of fields) { els[f.k] = inp(saved && saved[f.k] !== undefined ? (f.kind === 'duration' ? B.fmtDuration(saved[f.k]) : saved[f.k]) : '', f.kind === 'duration' ? 'text' : 'number', { placeholder: f.ph === undefined || f.ph === null ? '' : String(f.ph), 'aria-label': f.l }); wrap.append(h('label', null, h('span', null, f.l), els[f.k])); }
    return { el: fields.length ? wrap : null, read() { const out = {}; for (const f of fields) { const raw = els[f.k].value.trim(); if (!raw) continue; const v = f.kind === 'duration' ? B.parseDuration(raw) : num(raw); if (v !== null && v !== 0) out[f.k] = v; else if (f.kind === 'duration') { toast('Time as minutes (75) or hours and minutes (14:20)'); return null; } } return out; } };
  }
  async function saveActuals(b, vals) { if (!vals || !Object.keys(vals).length) return; b.actuals = Object.assign({}, b.actuals || {}, vals); await DB.put('batches', b); }
  async function markPitched(b, pitchF) {
    b.status = 'Fermenting'; b.pitchDate = today(); await DB.put('batches', b);
    const y = yeastOf(b); if (y && pitchF && (pitchF > y.tempHigh || pitchF < y.tempLow)) toast(`${pitchF}F is outside ${y.tempLow} to ${y.tempHigh}F for this yeast`);
  }
  // quick process notes: tap to log, tap again to take it back. The brewer's own buttons are kept in settings.
  async function processPanel(b, rerender) {
    const mine = await S.get('procChips', []), all = D.PROCESS_CHIPS.concat(mine.filter(m => !D.PROCESS_CHIPS.includes(m)));
    const on = new Set(b.process || []);
    const chips = h('div', { class: 'chips' }, all.map(name => h('button', { class: 'chip' + (on.has(name) ? ' on' : ''), style: 'font-family:inherit', onclick: async () => {
      if (on.has(name)) { b.process = (b.process || []).filter(x => x !== name); for (const e of await DB.byBatch('entries', b.id)) if (e.proc === name) await DB.del('entries', e.id); }
      else { b.process = (b.process || []).concat([name]); await DB.put('entries', { batchId: b.id, type: 'note', proc: name, date: today(), text: `Process: ${name} at ${hopTime()}`, created: Date.now() }); }
      await DB.put('batches', b); rerender(); } }, name)));
    const text = inp('', 'text', { placeholder: 'e.g. tap water would not chill below 84F' });
    const add = async asButton => { const v = text.value.trim(); if (!v) return toast('Write the note first');
      if (asButton) { await S.set('procChips', mine.concat(mine.includes(v) ? [] : [v])); b.process = (b.process || []).concat([v]); await DB.put('batches', b); }
      await DB.put('entries', { batchId: b.id, type: 'note', proc: asButton ? v : undefined, date: today(), text: `${asButton ? 'Process: ' : ''}${v}${asButton ? ' at ' + hopTime() : ''}`, created: Date.now() }); toast('Logged'); rerender(); };
    return h('div', null, h('h3', null, 'Process notes'), h('p', { class: 'muted small' }, 'Tap what you did and it goes in the log with the time. Tap again to take it back.'), chips,
      field('Anything else', text), h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => add(false) }, 'Log the note'), h('button', { class: 'btn secondary', onclick: () => add(true) }, 'Log it and keep it as a button')));
  }
  // gravity came in low: how much sugar, or how much longer to boil
  function lowGravityPanel(b, est, rerender) {
    const sugars = D.FERMENTABLES.filter(f => f.extract && f.ppg > 0 && !/lactose|dates/i.test(f.name)).map(f => f.name);
    const sg = inp('', 'number', { placeholder: 'e.g. 1.048' }), vol = inp(b.batchGal || EQ.batchGal, 'number'), target = inp(num(b.og) ? '' : (est.og ? est.og.toFixed(3) : ''), 'number', { placeholder: '1.056' });
    const sugar = sel(sugars, sugars.includes('Agave nectar') ? 'Agave nectar' : sugars[0]), lb = inp('', 'number');
    const outp = h('p', { class: 'small' }, 'Enter the gravity you have and the one you wanted.');
    const upd = () => { const c = num(sg.value), t = num(target.value), v = num(vol.value), ref = D.FERMENTABLES.find(f => f.name === sugar.value);
      if (!(c > 1) || !(t > 1) || !v) { outp.textContent = 'Enter the gravity you have and the one you wanted.'; return; }
      if (c >= t) { outp.textContent = 'You are at or above the target. Nothing to add.'; lb.value = ''; return; }
      const need = B.sugarToReach(c, v, t, ref.ppg), mins = B.extraBoilMinutes(c, v, t, EQ.boilOffGalHr);
      lb.value = need; outp.textContent = `${Math.round((t - c) * 1000)} points short. Add ${need} lb (${Math.round(need * 16)} oz) of ${sugar.value}, or boil about ${mins} more minutes and finish with ${B.round.r2(v * B.points(c) / B.points(t))} gal. Sugar thins the body a little; a longer boil costs volume.`; };
    [sg, vol, target].forEach(i => i.addEventListener('input', upd)); sugar.addEventListener('change', upd);
    return h('details', { class: 'plat' }, h('summary', null, 'Gravity low? Sugar or a longer boil'), h('div', { class: 'body' },
      h('div', { class: 'row3' }, field('Gravity now', sg), field('Volume (gal)', vol), field('Target OG', target)), field('Add', sugar), outp,
      h('div', { class: 'row', style: 'align-items:end' }, field('Amount added (lb)', lb), h('button', { class: 'btn secondary', style: 'margin-bottom:14px', onclick: async () => { const amt = num(lb.value); if (!amt) return toast('How much went in?');
        b.fermentables = (b.fermentables || []).concat([{ name: sugar.value, lb: amt, late: true }]); await DB.put('batches', b);
        await DB.put('entries', { batchId: b.id, type: 'sugar', date: today(), text: `${amt} lb ${sugar.value} added at ${hopTime()}${num(sg.value) ? ` (gravity was ${num(sg.value).toFixed(3)}${num(target.value) ? ', target ' + num(target.value).toFixed(3) : ''})` : ''}`, created: Date.now() });
        toast('Added to the recipe and logged'); rerender(); } }, 'Add to the recipe and log it'))));
  }
  function fermentBlock(b) {
    const fi = fermentInfo(b), y = yeastOf(b);
    const box = h('div', { class: 'note' }, h('b', { style: 'color:var(--text)' }, `Then it sits: ${fi.plan.text}`),
      h('div', null, fi.pitched ? `Pitched ${fi.pitched}. First gravity check about ${B.addDays(fi.pitched, fi.plan.checkDay)}; earliest packaging about ${B.addDays(fi.pitched, fi.plan.low)}.` : `First gravity check around day ${fi.plan.checkDay}. ${fi.plan.note}`),
      y ? h('div', null, `Keep it at ${y.tempLow} to ${y.tempHigh}F.`) : null);
    for (const hp of fi.sched) box.append(h('div', { style: 'margin-top:6px' }, hp.added ? h('span', { class: 'badge ok' }, 'added') : h('span', { class: 'badge' + (fi.due.includes(hp) ? ' due' : '') }, 'dry hop'), `${hp.oz ? hp.oz + ' oz ' : ''}${hp.name}: ${hp.fromDate ? `${hp.fromDate} to ${hp.toDate}` : `day ${hp.fromDay} to ${hp.toDay}`}, ${hp.days} days in`));
    const btns = h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => entryForm(b, 'dryhop') }, 'Log a dry hop'),
      fi.pitched ? h('button', { class: 'btn secondary', onclick: () => { downloadText(B.icsFor(b.name || 'Batch', fi.pitched, fi.plan, fi.sched.filter(x => !x.added)), `${(b.name || 'batch').replace(/[^\w-]/g, '_')}-reminders.ics`, 'text/calendar'); toast('Open the file to add the reminders to your calendar'); } }, 'Reminders to calendar') : null);
    return h('div', null, box, btns, h('p', { class: 'muted small' }, fi.pitched ? 'A web app cannot ring an alarm next week, so the reminders go to your phone calendar: the dry hop window, the first gravity check and the earliest packaging day, each with a 9 am alert. The app also flags a due dry hop on the Batches screen.' : 'Once you check off "Yeast pitched" the dates fill in and you can send the reminders to your calendar.'));
  }
  async function renderBrewday() {
    const list = await batchList();
    const shown = list.filter(onBrewday);
    const b = shown.find(x => x.id === state.batchId) || shown[0] || null; if (b) state.batchId = b.id;
    const goState = b ? await S.get('go:' + b.id, null) : null;
    // a guided brew day in progress is where the Brew day tab lands; the sheet is one tap back from it
    if (b && (state.sub === 'go' || (state.sub !== 'sheet' && goState && goState.i > 0))) return renderGo(b);
    view.append(h('h2', null, 'Brew day'));
    const others = list.filter(x => !shown.includes(x));
    const addSel = others.length ? sel([{ v: '', t: 'Add a batch to brew day\u2026' }].concat(others.map(x => ({ v: String(x.id), t: `${x.name || 'batch ' + x.id} (${x.status})` }))), '') : null;
    if (addSel) addSel.addEventListener('change', async () => { const x = others.find(o => String(o.id) === addSel.value); if (!x) return; x.onBrewday = true; await DB.put('batches', x); state.batchId = x.id; await S.set('lastBatch', x.id); render(); });
    if (!b) return add(h('div', { class: 'empty' }, list.length ? 'Nothing is on the brew day list. Planned batches appear here by themselves; add any other below.' : 'Create a batch first; the brew day list is built from its recipe.'), addSel ? field('Batches', addSel) : null, h('button', { class: 'btn block', onclick: () => go('batches', 'new') }, 'New batch'));
    // one chip per batch on the list: tap to switch, the cross takes it off the list (the batch itself is untouched)
    view.append(h('div', { class: 'chips' }, shown.map(x => h('span', { class: 'chip' + (x.id === b.id ? ' on' : ''), style: 'font-family:inherit;display:inline-flex;align-items:center;gap:8px;padding-right:6px' },
      h('button', { style: 'background:none;border:0;color:inherit;font:inherit;padding:0;cursor:pointer', onclick: async () => { state.batchId = x.id; await S.set('lastBatch', x.id); render(); } }, x.name || 'batch'),
      h('button', { 'aria-label': `Take ${x.name || 'batch'} off brew day`, title: 'Take off brew day', style: 'background:none;border:0;color:inherit;font:inherit;font-size:18px;line-height:1;padding:2px 6px;cursor:pointer;opacity:.75', onclick: async () => { x.onBrewday = false; await DB.put('batches', x); if (state.batchId === x.id) state.batchId = null; toast(`${x.name || 'Batch'} taken off brew day. It is still under Batches.`); render(); } }, '\u00D7')))));
    if (addSel) view.append(field('', addSel));
    view.append(h('button', { class: 'btn block', style: 'font-size:18px;min-height:56px', onclick: () => go('brewday', 'go') }, goState ? `Continue guided brew day (step ${goState.i + 1})` : 'Go: guided brew day, start to finish'),
      h('p', { class: 'muted small' }, 'One step at a time from strike water to pitching, with timers, hop alarms and gravity checks built from this recipe and your equipment profile.'));
    const done = (await S.get('steps:' + b.id, {})) || {};
    const est = recipeStats(b), y = yeastOf(b);
    // numbers you want in your hand on brew day
    const grainLb = grainLbOf(b), T = B.brewTargets(b, EQ, grainLb, y);
    const readout = h('div', { class: 'readout' });
    const line = (l, v, n) => readout.append(h('div', { class: 'line' }, h('span', { class: 'l' }, l, n ? h('span', { class: 'n' }, n) : null), h('span', { class: 'v' }, v)));
    if (grainLb) {
      line('Strike water', `${T.strikeGal} gal`, T.noSparge ? `all of it, no sparge: ${T.qtPerLb} qt per lb over ${B.round.r2(grainLb)} lb (${EQ.name})` : `${T.qtPerLb} qt per lb over ${B.round.r2(grainLb)} lb (${EQ.name})`);
      line('Strike temp', `${T.strikeF} F`, `grain at ${T.grainF}F, ${EQ.tunLossF}F for the tun`);
      if (!T.noSparge) line('Sparge water', `${T.spargeGal} gal`, `${EQ.absorbGalLb} gal per lb absorbed`);
      line('Expected in fermenter', `${B.postBoilToPackage(B.boilOff(num(b.boilGal) || EQ.boilGal, EQ.boilOffGalHr, num(b.boilMin) || EQ.boilMin), EQ.trubGal)} gal`, `${EQ.boilOffGalHr} gal/hr boil-off, ${EQ.trubGal} gal trub`);
    }
    line('Pre-boil target', `${b.boilGal || '-'} gal`, est.boilG ? `about ${est.boilG.toFixed(3)}` : null);
    if (y) line('Pitch at', `${y.tempLow} to ${y.tempHigh} F`, y.name.split('/')[0].trim());
    line('Then it sits', B.fermentPlan(y, num(b.og) || est.og || 1.05).text.split(',')[0], y && y.type === 'Lager' ? 'plus four to six weeks cold' : 'gravity decides, not the calendar');
    view.append(readout);
    // timer
    const tdisp = h('div', { class: 'timer' }, '00:00');
    let start = await S.get('timerStart:' + b.id, null);
    const nextEl = h('p', { class: 'muted small', style: 'text-align:center;margin-top:-4px' });
    const boilLen = num(b.boilMin) || EQ.boilMin;
    const additions = (b.hops || []).filter(hp => hp.name && hp.minutes !== '' && !hp.whirlpool).map(hp => ({ label: `${hp.oz} oz ${hp.name}`, at: boilLen - num(hp.minutes) })).sort((x, y2) => x.at - y2.at);
    const live = () => { sheetLive = { id: b.id, start, additions, boilLen }; if (start) keepAwake(); };
    function tick() {
      if (!start) { tdisp.textContent = '00:00'; nextEl.textContent = additions.length ? `First addition at +${additions[0].at} min` : ''; return; }
      const s = Math.floor((Date.now() - start) / 1000); const m = s / 60;
      tdisp.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      const next = additions.find(a2 => a2.at * 60 > s);
      if (next) { const left = next.at * 60 - s; nextEl.textContent = `Next: ${next.label} in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 60 && !tdisp._warned) { tdisp._warned = next.label; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ } } if (left > 60) tdisp._warned = null; }
      else if (m >= boilLen) nextEl.textContent = `Boil done: flameout. Still boiling? The total is counted when you check off Flameout.`;
      else nextEl.textContent = `All hops in; flameout in ${Math.floor(boilLen - m)} min`;
    }
    clearInterval(timer); timer = setInterval(tick, 1000); tick(); live();
    view.append(tdisp, nextEl, h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: async () => { unlockAudio(); start = Date.now(); await S.set('timerStart:' + b.id, start); live(); tick(); toast('Boil timer started: each addition will ring'); } }, 'Start boil timer'),
      h('button', { class: 'btn secondary', onclick: async () => { start = null; await S.set('timerStart:' + b.id, null); live(); tick(); } }, 'Reset')));
    view.append(h('h3', null, 'Steps'), h('p', { class: 'muted small' }, 'Type the number, then Done. Blanks are fine: only what you enter is recorded.'));
    const { steps } = B.brewSteps(b, EQ, grainLb, y);
    const rec = k => (done[k] && typeof done[k] === 'object') ? done[k] : (done[k] ? { t: done[k] } : null);
    for (const st of steps) {
      const d = rec(st.id), ins = d ? null : stepInputs(st.fields || []);
      const auto = st.id === 'mashout' && rec('mashin') && rec('mashin').ts ? 'Left blank, the time since "Mash in" is used.' : st.id === 'flameout' && (start || (rec('boil') && rec('boil').ts)) ? 'Left blank, the time since the boil started is used.' : st.id === 'pitch' ? B.pitchAdvice(y, d && d.vals ? d.vals.pitchF : null) : null;
      const row = h('div', { class: 'step' + (d ? ' done' : '') },
        h('span', { class: 'tm' }, st.at !== null && st.at !== undefined ? `+${st.at}m` : ''),
        h('div', { class: 't' }, h('span', { class: 'ttl' }, st.t), d ? h('div', { class: 'meta muted small' }, [d.t, d.vals ? B.actualsText(st.fields || [], d.vals) : ''].filter(Boolean).join(' \u00B7 ')) : null, ins && ins.el, auto ? h('div', { class: 'meta muted small' }, auto) : null),
        h('button', { class: 'act', onclick: async () => {
          if (d) { delete done[st.id]; if (d.vals) { for (const k in d.vals) if (b.actuals) delete b.actuals[k]; await DB.put('batches', b); } await S.set('steps:' + b.id, done); return render(); }
          const vals = ins.read(); if (vals === null) return;
          const now = Date.now();
          if (st.id === 'mashout' && vals.mashTotal === undefined && rec('mashin') && rec('mashin').ts) vals.mashTotal = Math.max(1, Math.round((now - rec('mashin').ts) / 60000));
          if (st.id === 'flameout' && vals.boilTotal === undefined) { const t0 = start || (rec('boil') && rec('boil').ts); if (t0) vals.boilTotal = Math.max(1, Math.round((now - t0) / 60000)); }
          if (st.id === 'boil' && !start) { unlockAudio(); start = now; await S.set('timerStart:' + b.id, start); live(); }
          done[st.id] = { t: hopTime(), ts: now, vals };
          await S.set('steps:' + b.id, done); await saveActuals(b, vals);
          const said = B.actualsText(st.fields || [], vals);
          await DB.put('entries', { batchId: b.id, type: 'step', date: today(), text: `${st.t} at ${done[st.id].t}${said ? ': ' + said : ''}`, created: now });
          if (st.id === 'pitch') await markPitched(b, vals.pitchF); else if (b.status === 'Planned') { b.status = 'Brewing'; await DB.put('batches', b); }
          render();
        } }, d ? 'Undo' : 'Done'));
      view.append(row);
    }
    view.append(lowGravityPanel(b, est, render));
    view.append(await processPanel(b, render));
    view.append(h('h3', null, 'After brew day'), fermentBlock(b));
    view.append(h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => entryForm(b, 'gravity') }, 'Log a gravity reading'), h('button', { class: 'btn secondary', onclick: () => go('batches', 'view:' + b.id) }, 'Open batch')));
  }


  // ---------- stock ----------
  const VOCAB = { Fermentable: () => D.FERMENTABLES.map(f => f.name), Hop: () => D.HOPS.map(h => h.name), Yeast: () => D.YEAST.map(y => y.name), Other: () => [] };
  const UNIT = { Fermentable: 'lb', Hop: 'oz', Yeast: 'packs', Other: '' };
  function fileToCanvas(file, maxDim) {
    return new Promise((res, rej) => { const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => { const sc = Math.min(1, maxDim / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); res(cv); };
      img.onerror = () => rej(new Error('Could not read that image')); img.src = url; });
  }
  let ocrWorker = null;
  async function ocr(cv, onProgress) {
    await loadScript(OCR_CDN);
    if (!ocrWorker) ocrWorker = await window.Tesseract.createWorker('eng', 1, { logger: m => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); } });
    const { data } = await ocrWorker.recognize(cv);
    return data.text || '';
  }
  async function renderStock() {
    const inv = await DB.all('stock');
    if (state.sub === 'suggest') return suggestScreen(inv);
    if (state.sub === 'new') { const pre = state.stockPrefill; state.stockPrefill = null; return stockForm(null, pre); }
    if (state.sub && state.sub.startsWith('edit:')) { const it = inv.find(i => i.id === Number(state.sub.slice(5))); return it ? stockForm(it) : go('stock', null, { replace: true }); }
    view.append(h('h2', null, 'Stock'));
    const photoIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: e => { if (e.target.files[0]) labelFlow(e.target.files[0]); e.target.value = ''; } });
    view.append(photoIn,
      h('div', { class: 'btns' },
        h('button', { class: 'btn', onclick: () => photoIn.click() }, 'Photograph a label'),
        h('button', { class: 'btn secondary', onclick: () => go('stock', 'new') }, 'Add by hand'),
        h('button', { class: 'btn secondary', onclick: () => go('stock', 'suggest') }, 'What can I brew?')));
    view.append(h('p', { class: 'muted small' }, 'Photograph one bag or pack at a time, filling the frame with the label. The app reads the text and matches it against the ingredient tables, then asks you to confirm. A photo of a whole shelf will not work; the text is too small and too many labels overlap.'));
    if (!inv.length) return view.append(h('div', { class: 'empty' }, 'Nothing in stock yet.'));
    for (const kind of B.INV_KINDS) {
      const items = inv.filter(i => i.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
      if (!items.length) continue;
      const total = B.totalOf(inv, kind);
      add(h('h3', null, `${kind}s`, h('span', { class: 'muted small' }, `  ${total} ${UNIT[kind]}`)));
      for (const it of items) {
        const ref = kind === 'Hop' ? D.HOPS.find(x => x.name === it.name) : kind === 'Fermentable' ? D.FERMENTABLES.find(x => x.name === it.name) : kind === 'Yeast' ? D.YEAST.find(x => x.name === it.name) : null;
        view.append(h('div', { class: 'rec' },
          kind === 'Fermentable' && ref ? h('span', { class: 'swatch', style: 'background:' + B.srmHex(ref.lovibond) }) : null,
          h('div', { class: 't' }, h('b', null, `${it.amount || ''} ${it.unit || UNIT[kind]}  ${it.name}`),
            h('div', { class: 'meta' }, [ref && ref.genre ? ref.genre : null, ref && ref.alphaLow ? `${ref.alphaLow} to ${ref.alphaHigh}% alpha` : null, ref && ref.ppg ? `${ref.ppg} ppg, ${ref.lovibond} L` : null, ref && ref.attLow ? `${ref.attLow} to ${ref.attHigh}%, ${ref.tempLow} to ${ref.tempHigh} F` : null, it.note].filter(Boolean).join(' \u00B7 '))),
          h('button', { class: 'act', onclick: () => go('stock', 'edit:' + it.id) }, 'Edit')));
      }
    }
  }
  function stockForm(item, prefill) {
    view.innerHTML = '';
    const r = item || Object.assign({ kind: 'Fermentable', name: '', amount: '', unit: '', note: '' }, prefill || {});
    const kind = sel(B.INV_KINDS, r.kind);
    const name = inp(r.name, 'text', { list: 'vocab' });
    const amount = inp(r.amount, 'number'), unit = inp(r.unit || UNIT[r.kind], 'text'), note = inp(r.note, 'text');
    const dl = h('datalist', { id: 'vocab' });
    const fillVocab = () => { dl.innerHTML = ''; VOCAB[kind.value]().forEach(v => dl.append(h('option', { value: v }))); unit.value = unit.value || UNIT[kind.value]; };
    kind.addEventListener('change', fillVocab); fillVocab();
    view.append(h('button', { class: 'back', onclick: () => goBack('stock') }, '\u2039 Stock'), h('h2', null, item ? 'Edit stock' : 'Add to stock'), dl,
      field('Kind', kind), field('Name', name), h('div', { class: 'row' }, field('Amount', amount), field('Unit', unit)), field('Note', note),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { r.kind = kind.value; r.name = name.value.trim(); r.amount = amount.value; r.unit = unit.value.trim(); r.note = note.value.trim(); if (!r.name) return toast('Name it'); await DB.put('stock', r); toast('Saved'); goBack('stock'); } }, 'Save'),
        item ? h('button', { class: 'btn danger', onclick: async () => { await DB.del('stock', item.id); goBack('stock'); } }, 'Remove') : null,
        h('button', { class: 'btn secondary', onclick: () => goBack('stock') }, 'Cancel')));
  }
  async function labelFlow(file) {
    view.innerHTML = '';
    const cv = await fileToCanvas(file, 1500).catch(e => { toast(e.message); return null; }); if (!cv) return render();
    const bar = h('div', { class: 'progress' }, h('i')); const status = h('p', { class: 'muted small' }, 'Reading the label\u2026');
    view.append(h('h2', null, 'Label'), h('img', { class: 'preview', src: cv.toDataURL('image/jpeg', 0.6) }), status, bar);
    let text = '';
    try { text = await ocr(cv, p => { bar.firstChild.style.width = Math.round(p * 100) + '%'; }); } catch (e) { status.textContent = 'The reader could not load (offline?). Add it by hand instead.'; }
    bar.remove();
    if (!text.trim()) { status.textContent = 'No text found on that photo. Try filling the frame with the label, straight on, without glare.'; view.append(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('stock', 'new') }, 'Add by hand'), h('button', { class: 'btn secondary', onclick: () => go('stock') }, 'Back'))); return; }
    const candidates = [];
    for (const kind of ['Hop', 'Fermentable', 'Yeast']) B.matchVocab(text, VOCAB[kind](), 3).forEach(m => candidates.push({ kind, name: m.name, score: m.score }));
    candidates.sort((a, b) => b.score - a.score);
    status.textContent = candidates.length ? 'Tap the match, or add it by hand.' : 'Text read, but nothing matched the ingredient tables. Add it by hand.';
    for (const c of candidates.slice(0, 6)) view.append(h('div', { class: 'rec' }, h('div', { class: 't' }, h('b', null, c.name), h('div', { class: 'meta' }, `${c.kind} \u00B7 confidence ${c.score}`)), h('button', { class: 'act', onclick: () => { state.stockPrefill = { kind: c.kind, name: c.name, unit: UNIT[c.kind] }; go('stock', 'new'); } }, 'Use')));
    view.append(h('details', { class: 'plat' }, h('summary', null, 'What the reader saw'), h('div', { class: 'body' }, h('pre', { class: 'pkg' }, text))),
      h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => go('stock', 'new') }, 'Add by hand'), h('button', { class: 'btn secondary', onclick: () => go('stock') }, 'Back')));
  }
  async function suggestScreen(inv) {
    view.append(h('button', { class: 'back', onclick: () => goBack('stock') }, '\u2039 Stock'), h('h2', null, 'What can I brew?'));
    if (!inv.length) return view.append(h('div', { class: 'empty' }, 'Add some stock first and this ranks every style against what is on the shelf.'));
    const galIn = inp(5.5, 'number');
    const out = h('div');
    const draw = () => { out.innerHTML = '';
      const sug = B.suggestBrews(inv, D.STYLES, D.FERMENTABLES, D.YEAST, num(galIn.value) || 5.5);
      const can = sug.filter(s => s.canBrew), near = sug.filter(s => !s.canBrew).slice(0, 8);
      if (can.length) { out.append(h('h3', null, `Ready to brew (${can.length})`));
        for (const s of can) out.append(h('div', { class: 'rec' }, h('span', { class: 'swatch', style: 'background:' + B.srmHex((s.style.srmLow + s.style.srmHigh) / 2) }),
          h('div', { class: 't' }, h('b', null, s.style.name), h('div', { class: 'meta' }, `${s.style.abvLow} to ${s.style.abvHigh}% \u00B7 ${s.style.ibuLow} to ${s.style.ibuHigh} IBU \u00B7 ${s.style.note}`)),
          h('button', { class: 'act', onclick: async () => { if (!(await needReg('save'))) return; const b = BLANK(); b.name = s.style.name; b.style = s.style.name; b.batchGal = num(galIn.value) || 5.5;
            b.fermentables = inv.filter(i => i.kind === 'Fermentable').map(i => ({ name: i.name, lb: '' }));
            b.hops = inv.filter(i => i.kind === 'Hop').slice(0, 3).map(i => ({ name: i.name, oz: '', alpha: '', minutes: '', type: 'pellet' }));
            const y = inv.find(i => i.kind === 'Yeast'); if (y) b.yeast = y.name;
            const id = await DB.put('batches', b); state.batchId = id; await S.set('lastBatch', id); toast('Batch started from your stock'); go('batches', 'edit:' + id); } }, 'Start'))); }
      else out.append(h('div', { class: 'empty' }, 'Nothing is fully covered yet. The closest are below with what is missing.'));
      out.append(h('h3', null, 'Closest otherwise'));
      for (const s of near) out.append(h('div', { class: 'rec' }, h('div', { class: 't' }, h('b', null, `${s.style.name}  `, h('span', { class: 'muted small' }, s.score + '%')), h('div', { class: 'meta' }, 'Needs ' + s.missing.join(', ')))));
    };
    galIn.addEventListener('input', draw);
    view.append(field('Batch size (gal)', galIn), out,
      h('p', { class: 'muted small' }, 'A rough check against each style\'s published ranges: enough base malt for the gravity, enough alpha acid for the bitterness, a dark malt where the style needs one, and a suitable yeast. It does not design the recipe, it tells you what the shelf will carry.'));
    draw();
  }


  // ---------- guided brew day ("Go") ----------
  let wakeLock = null;
  function beep(times) {
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!audioCtx) audioCtx = new AC(); const ctx = audioCtx; if (ctx.state === 'suspended') ctx.resume(); const n = times || 3;
      for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); const t = ctx.currentTime + i * 0.35; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.start(t); o.stop(t + 0.3); } } catch (e) { /* no audio */ }
    try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { /* no vibration */ }
  }
  // Android only shows a notification that comes from the service worker; everything else takes the plain kind
  async function notify(title, body) {
    try { if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const reg = navigator.serviceWorker && navigator.serviceWorker.getRegistration ? await navigator.serviceWorker.getRegistration() : null;
      if (reg && reg.showNotification) await reg.showNotification(title, { body, tag: 'brewday', renotify: true, icon: 'icons/icon-192.png?v=2' }); else new Notification(title, { body, tag: 'brewday' }); } catch (e) { /* not available */ }
  }
  async function keepAwake() { try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* denied */ } }
  const fmtMS = s => `${String(Math.floor(Math.abs(s) / 60)).padStart(2, '0')}:${String(Math.abs(s) % 60).padStart(2, '0')}`;
  async function renderGo(b) {
    goView = null;
    const est = recipeStats(b);
    const grainLb = grainLbOf(b), y = yeastOf(b);
    const plan = B.brewPlan(b, EQ, grainLb, est.boilG, y);
    const key = 'go:' + b.id;
    const st = (await S.get(key, null)) || { i: 0, timers: {}, fired: {}, ticked: {}, startedAt: Date.now() };
    const save = () => S.set(key, st);
    if (st.i >= plan.length) {
      goLive = null; await S.set('goActive', null);
      view.innerHTML = ''; view.append(h('button', { class: 'back', onclick: () => go('brewday', 'sheet') }, '\u2039 Brew day'), h('h2', null, 'Brew day complete'),
        h('p', null, `${b.name || 'The batch'} is in the fermenter. Gravity readings from the Batches screen from here on; the fermentation state updates itself.`),
        h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('batches', 'view:' + b.id) }, 'Open the batch'), h('button', { class: 'btn secondary', onclick: async () => { await S.set(key, null); go('brewday', 'sheet'); } }, 'Clear this brew day')));
      return;
    }
    goLive = { b, st, key, plan }; if ((await S.get('goActive', null)) !== b.id) await S.set('goActive', b.id);
    keepAwake();
    const step = plan[st.i]; const next = plan[st.i + 1];
    view.innerHTML = '';
    view.append(h('button', { class: 'back', onclick: () => go('brewday', 'sheet') }, '\u2039 Brew day sheet'),
      h('div', { class: 'progress', style: 'margin:0 0 10px' }, h('i', { style: `width:${Math.round(st.i / plan.length * 100)}%` })),
      h('p', { class: 'muted small' }, `Step ${st.i + 1} of ${plan.length} \u00B7 ${b.name || 'batch'}`),
      h('h2', null, step.title));
    add(h('ul', { style: 'padding-left:18px;margin:0 0 12px' }, step.detail.map(d => h('li', { style: 'margin:0 0 6px' }, d))));
    const tdisp = h('div', { class: 'timer' }, '');
    const nextEl = h('p', { class: 'muted small', style: 'text-align:center;margin-top:-4px' });
    const alarmList = h('div');
    if (step.kind === 'timer') {
      const started = st.timers[step.id];
      const draw = (el, left, upcoming) => {
        tdisp.textContent = (left < 0 ? '+' : '') + fmtMS(left); tdisp.style.color = left < 0 ? 'var(--warn)' : '';
        nextEl.textContent = upcoming ? `Next: ${upcoming.label} in ${fmtMS(upcoming.at * 60 - el)}` : (left > 0 ? 'No more additions; timer runs to the end' : 'Time is up');
        alarmList.querySelectorAll('[data-alarm]').forEach(row => { const k = row.dataset.alarm, due = !!st.fired[k] && !st.ticked[k]; row.classList.toggle('done', !!st.ticked[k]); row.classList.toggle('ringing', due); row.querySelector('.tm').textContent = st.fired[k] ? 'now' : `+${row.dataset.at}m`; });
      };
      view.append(tdisp, nextEl);
      if (!started) { tdisp.textContent = fmtMS(step.minutes * 60); nextEl.textContent = 'Not started';
        view.append(h('div', { class: 'btns' }, h('button', { class: 'btn block', onclick: async () => { unlockAudio(); st.timers[step.id] = Date.now(); await save(); await DB.put('entries', { batchId: b.id, type: 'step', date: today(), text: `${step.title} started ${hopTime()}`, created: Date.now() }); if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { /* ignore */ } } renderGo(b); } }, `Start ${step.minutes >= 100 ? B.fmtDuration(step.minutes) : step.minutes + '-minute'} timer`)),
          h('p', { class: 'muted small', style: 'text-align:center' }, 'Each addition rings, and keeps ringing until you check it off. Keep the phone\'s sound on and this app open; the screen stays awake by itself.')); }
      for (const a of step.alarms || []) { const k = step.id + ':' + a.at;
        alarmList.append(h('div', { class: 'step' + (st.ticked[k] ? ' done' : ''), 'data-alarm': k, 'data-at': a.at }, h('span', { class: 'tm' }, `+${a.at}m`), h('span', { class: 't' }, a.label),
          h('button', { class: 'act', onclick: async () => { st.ticked[k] = !st.ticked[k]; await save(); if (st.ticked[k]) await DB.put('entries', { batchId: b.id, type: 'step', date: today(), text: `${a.label} at ${hopTime()}`, created: Date.now() }); renderGo(b); } }, st.ticked[k] ? 'Undo' : 'Done'))); }
      view.append(alarmList);
      if (started) { goView = draw; const el = Math.floor((Date.now() - started) / 1000); draw(el, step.minutes * 60 - el, (step.alarms || []).find(a => a.at * 60 > el)); }
    }
    if (step.kind === 'input') {
      const sg = inp('', 'number', { placeholder: 'e.g. 1.052' }), temp = inp('', 'number', { placeholder: 'sample temp F' }), vol = inp('', 'number', { placeholder: 'gal' });
      const corr = h('p', { class: 'muted small' });
      const upd = () => { const v = num(sg.value), t = num(temp.value); if (!v) { corr.textContent = ''; return; } const c = t ? B.hydrometerCorrect(v, t, EQ.hydroCalF) : v; let msg = `Corrected: ${c.toFixed(3)}`;
        if (step.id === 'preboil' && est.boilG) { const d = Math.round((c - est.boilG) * 1000); msg += d === 0 ? ', on target' : d > 0 ? `, ${d} points high: add ${B.waterToHitGravity(c, num(vol.value) || num(b.boilGal) || EQ.boilGal, est.boilG)} gal water` : `, ${Math.abs(d)} points low: boil longer or accept a lighter beer`; }
        if (step.id === 'og' && (b.og || est.og)) { const target = num(b.og) || est.og; const d = Math.round((c - target) * 1000); msg += d === 0 ? ', on target' : `, ${Math.abs(d)} points ${d > 0 ? 'high' : 'low'} vs ${target.toFixed(3)}`; }
        corr.textContent = msg; };
      [sg, temp, vol].forEach(i => i.addEventListener('input', upd));
      view.append(h('div', { class: 'row3' }, field('Gravity', sg), field('Sample temp (F)', temp), field('Volume (gal)', vol)), corr);
      view.append(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { const v = num(sg.value); if (v) { const c = num(temp.value) ? B.hydrometerCorrect(v, num(temp.value), EQ.hydroCalF) : v; await DB.put('entries', { batchId: b.id, type: 'gravity', date: today(), sg: c, raw: v, tempF: temp.value, instrument: 'sg', kind: step.id === 'og' ? 'og' : 'preboil', og: step.id === 'og', note: `${step.id === 'og' ? 'OG' : 'Pre-boil'}${vol.value ? ', ' + vol.value + ' gal' : ''}`, created: Date.now() }); if (step.id === 'og') { b.og = c; await DB.put('batches', b); } } st.i++; await save(); renderGo(b); } }, sg.value ? 'Log and continue' : 'Continue'),
        h('button', { class: 'btn secondary', onclick: async () => { st.i++; await save(); renderGo(b); } }, 'Skip')));
    } else {
      const ins = stepInputs(step.fields || [], b.actuals);
      if (ins.el) view.append(h('div', { class: 'step', style: 'border:0;padding:4px 0 0' }, h('div', { class: 't' }, ins.el)),
        h('p', { class: 'muted small' }, step.id === 'mashout' ? 'Leave the total blank and the time since the mash timer started is used; type 14:20 if it sat overnight.' : step.id === 'boil' ? 'Leave the total blank and the time since the boil timer started is used, however long you let it run.' : 'Blanks are fine: only what you enter is recorded.'));
      if (step.id === 'pitch') { const adv = h('p', { class: 'muted small' }, B.pitchAdvice(y)); const pf = ins.el && ins.el.querySelector('input'); if (pf) pf.addEventListener('input', () => { adv.textContent = B.pitchAdvice(y, num(pf.value)); }); view.append(adv); }
      if (step.id === 'ferment') view.append(fermentBlock(b));
      if (step.sugar) view.append(lowGravityPanel(b, est, () => renderGo(b)));
      view.append(h('div', { class: 'btns' },
        h('button', { class: 'btn', onclick: async () => { const vals = ins.read(); if (vals === null) return; const now = Date.now();
          if (step.id === 'mashout' && vals.mashTotal === undefined && st.timers.mashin) vals.mashTotal = Math.max(1, Math.round((now - st.timers.mashin) / 60000));
          if (step.id === 'boil' && vals.boilTotal === undefined && st.timers.boil) vals.boilTotal = Math.max(1, Math.round((now - st.timers.boil) / 60000));
          await saveActuals(b, vals); const said = B.actualsText(step.fields || [], vals);
          await DB.put('entries', { batchId: b.id, type: 'step', date: today(), text: `${step.done} at ${hopTime()}${said ? ': ' + said : ''}`, created: now });
          if (step.id === 'pitch') await markPitched(b, vals.pitchF); else if (b.status === 'Planned') { b.status = 'Brewing'; await DB.put('batches', b); }
          st.i++; await save(); renderGo(b); } }, step.done),
        step.optional ? h('button', { class: 'btn secondary', onclick: async () => { st.i++; await save(); renderGo(b); } }, 'Skip') : null,
        st.i > 0 ? h('button', { class: 'btn secondary', onclick: async () => { st.i--; await save(); renderGo(b); } }, 'Back') : null));
    }
    if (step.kind === 'input' && step.sugar) view.append(lowGravityPanel(b, est, () => renderGo(b)));
    if (next) view.append(h('div', { class: 'note' }, h('b', null, 'Next: '), next.title, next.kind === 'timer' ? ` (${next.minutes} min)` : ''));
    view.append(h('details', { class: 'plat' }, h('summary', null, `Process notes${(b.process || []).length ? ' (' + b.process.length + ')' : ''}`), h('div', { class: 'body' }, await processPanel(b, () => renderGo(b)))));
    view.append(h('p', { class: 'muted small' }, 'Timers keep running if the phone locks or the app closes; reopen and the countdown is where it should be. Every step and addition is timestamped into the batch log.'));
  }

  // ---------- calculators ----------
  const CALCS = [
    { id: 'abv', title: 'ABV and attenuation', about: 'Alcohol from the drop between original and final gravity, and how much of the sugar the yeast ate.',  fields: [{ k: 'og', l: 'OG', v: 1.050 }, { k: 'fg', l: 'FG', v: 1.010 }],
      out: v => [{ l: 'ABV', v: B.abv(v.og, v.fg) + '%', n: `simple formula ${B.abv(v.og, v.fg, 'simple')}%` }, { l: 'Apparent attenuation', v: B.attenuationApparent(v.og, v.fg) + '%', n: `real ${B.attenuationReal(v.og, v.fg)}%` }, { l: 'Calories', v: B.calories(v.og, v.fg) + ' per 12 oz' }] },
    { id: 'hydro', title: 'Hydrometer temperature correction', about: 'A hydrometer is only right at its calibration temperature. Warm samples read low: this puts the points back.',  fields: [{ k: 'r', l: 'Reading', v: 1.050 }, { k: 't', l: 'Sample temp (F)', v: 80 }, { k: 'c', l: 'Calibrated at (F)', v: 60 }],
      out: v => [{ l: 'Corrected gravity', v: B.hydrometerCorrect(v.r, v.t, v.c).toFixed(4), n: v.t > v.c ? 'warm sample reads low' : 'cold sample reads high' }] },
    { id: 'refract', title: 'Refractometer', about: 'Brix to gravity. Once there is alcohol in the sample a refractometer reads wrong, so give it the original Brix too and it corrects for that.',  fields: [{ k: 'ob', l: 'Original Brix', v: 12 }, { k: 'fb', l: 'Current Brix', v: 6.5 }, { k: 'wcf', l: 'Wort correction factor', v: 1.04 }],
      out: v => { const og = B.brixToSgUnfermented(v.ob, v.wcf), fg = B.refractoFg(v.ob, v.fb, v.wcf); return [{ l: 'OG', v: og.toFixed(3) }, { l: 'Current gravity', v: fg.toFixed(3), n: 'corrected for alcohol (Novotn\u00FD)' }, { l: 'ABV so far', v: B.abv(og, fg) + '%' }]; } },
    { id: 'strike', title: 'Strike and infusion', about: 'How hot the water must be so that, once the cool grain is stirred in, the mash lands on your target.',  fields: [{ k: 'lb', l: 'Grain (lb)', v: 11 }, { k: 'r', l: 'Ratio (qt per lb)', v: 1.25 }, { k: 'gt', l: 'Grain temp (F)', v: 65 }, { k: 'mt', l: 'Target mash (F)', v: 152 }, { k: 'loss', l: 'Tun loss (F)', v: 2 }],
      out: v => [{ l: 'Strike temp', v: B.strikeTemp(v.r, v.gt, v.mt, v.loss) + ' F' }, { l: 'Strike volume', v: B.strikeWaterVolume(v.lb, v.r) + ' gal', n: `${B.round.r1(v.lb * v.r)} quarts` }, { l: 'Grain absorbs', v: B.grainAbsorption(v.lb) + ' gal' }, { l: 'Mash thickness', v: B.mashThickness(v.lb * v.r, v.lb) + ' qt/lb' }] },
    { id: 'infusion', title: 'Infusion step', about: 'For a mash tun you cannot heat, such as a picnic cooler. A step mash rests at two or more temperatures; with no burner under the mash, the way to climb from one rest to the next is to stir in boiling water. This tells you how much. On a BrewZilla, Grainfather or any heated, recirculating system you do not need it: set the next temperature on the controller and let it ramp.',
      examples: [{ t: 'Mash out in a cooler', n: 'Any beer: 152F up to 168F to stop conversion and loosen the sparge', v: { cur: 152, tgt: 168, lb: 11, qt: 13.75, wf: 212 } },
        { t: 'Hefeweizen: clove rest', n: 'Start thick at 113F for 15 minutes to free ferulic acid (the clove note), then up to 152F', v: { cur: 113, tgt: 152, lb: 10, qt: 10, wf: 212 } },
        { t: 'German pilsner: Hochkurz', n: '145F for a fermentable wort, then 160F for body and foam', v: { cur: 145, tgt: 160, lb: 10, qt: 12.5, wf: 212 } },
        { t: 'Oat or rye heavy: glucan rest', n: '104F to break down the gums that cause a stuck mash, then up to 150F', v: { cur: 104, tgt: 150, lb: 12, qt: 12, wf: 212 } }], fields: [{ k: 'cur', l: 'Current mash (F)', v: 152 }, { k: 'tgt', l: 'Target (F)', v: 168 }, { k: 'lb', l: 'Grain (lb)', v: 11 }, { k: 'qt', l: 'Mash water (qt)', v: 13.75 }, { k: 'wf', l: 'Infusion water (F)', v: 212 }],
      out: v => { const q = B.infusionVolume(v.cur, v.tgt, v.lb, v.qt, v.wf); if (q === null) return [{ l: 'Add', v: '-', n: 'the infusion water must be hotter than the target', tone: 'bad' }];
        return [{ l: 'Add', v: q + ' qt', n: `${B.round.r2(q / 4)} gal of ${v.wf}F water` }, { l: 'Mash after the addition', v: B.mashThickness(v.qt + q, v.lb) + ' qt/lb', n: B.mashThickness(v.qt + q, v.lb) > 3 ? 'very thin: start the first rest thicker, about 1 qt/lb' : 'start thick so there is room for the additions' }]; } },
    { id: 'volume', title: 'Volume and gravity', about: 'Sugar is conserved: dilute it and gravity falls, boil it and gravity rises. Use it when the pre-boil reading is off.',  fields: [{ k: 'sg', l: 'Gravity now', v: 1.060 }, { k: 'vol', l: 'Volume now (gal)', v: 5 }, { k: 'target', l: 'Target gravity', v: 1.050 }, { k: 'boil', l: 'Boil-off rate (gal/hr)', v: 1.2 }, { k: 'min', l: 'Boil time (min)', v: 60 }],
      out: v => [{ l: 'Water to add', v: B.waterToHitGravity(v.sg, v.vol, v.target) + ' gal', n: 'to dilute down to the target' }, { l: 'After the boil', v: `${B.boilOff(v.vol, v.boil, v.min)} gal at ${B.gravityAtVolume(v.sg, v.vol, B.boilOff(v.vol, v.boil, v.min)).toFixed(3)}` }, { l: 'Into the fermenter', v: B.postBoilToPackage(B.boilOff(v.vol, v.boil, v.min), 0.5) + ' gal', n: '4% cooling shrinkage, half a gallon of trub' }] },
    { id: 'ibu', title: 'IBU for one addition', about: 'Bitterness in the finished beer from one hop addition, by the SMPH model. It follows the temperature after flameout, so a 0 minute addition is not zero, and it stops rewarding you past the point where the wort can dissolve no more alpha acid: try 20 oz and watch it flatten.',
      fields: [{ k: 'oz', l: 'Hops (oz)', v: 1 }, { k: 'aa', l: 'Alpha acid %', v: 12 }, { k: 'form', l: 'Form', type: 'select', v: 'pellet', options: Object.keys(B.HOP_FORMS).map(k => ({ v: k, t: B.HOP_FORMS[k].label })) }, { k: 'min', l: 'Boil minutes (0 for flameout)', v: 60 }, { k: 'gal', l: 'Batch, post-boil (gal)', v: 5.5 }, { k: 'og', l: 'Original gravity', v: 1.055 }],
      credit: true,
      out: (v, raw) => { const hop = [{ oz: v.oz, alpha: v.aa, minutes: v.min, type: raw.form }], o = { gallons: v.gal, og: v.og, boilMin: Math.max(60, v.min), chillMin: EQ.chillMin, pH: EQ.wortPh, clarity: EQ.clarity, krausen: EQ.krausen, ageWeeks: EQ.ageWeeks, boilTempF: 212 - num(EQ.elevationFt) / 500 };
        const r = B.ibuSmph(hop, o), malt = r.parts.malt, p = r.parts;
        return [{ l: 'IBU', v: Math.max(0, Math.round(r.kettle - malt)), n: `plus ${malt} that any beer of this gravity reads from malt alone` },
          { l: 'Made of', v: `${p.iaa} + ${B.round.r1(p.oaa + p.oba + p.pp)}`, n: 'iso-alpha acids + auxiliary bittering compounds (oxidized hop acids, polyphenols)' },
          { l: 'Alpha acids that dissolve', v: Math.round(r.dissolved * 100) + '%', n: r.dissolved < 0.97 ? `${r.peakAA} ppm in solution; the wort holds 200 freely and never more than 580` : 'under the solubility limit: all of it', tone: r.dissolved < 0.7 ? 'bad' : '' },
          { l: 'Utilization', v: (r.utilization * 100).toFixed(1) + '%', n: 'alpha acid added that ends up as iso-alpha acid in the glass' },
          { l: 'Tinseth, for comparison', v: B.ibuTinseth(hop, v.gal, v.og), n: 'the usual homebrew formula; it predicts wort, not finished beer, and has no ceiling' }]; } },
    { id: 'prime', title: 'Priming sugar', about: 'Sugar for bottle conditioning. Pick the style and the target fills itself; change it if you like it livelier or flatter.',
      fields: [{ k: 'style', l: 'Carbonate by style', type: 'select', v: '', options: () => [{ v: '', t: 'Choose a style\u2026' }].concat(D.CARBONATION.map(c => ({ v: c.name, t: `${c.name}: ${c.low} to ${c.high}` }))), set: (choice, vals) => { const c = D.CARBONATION.find(x => x.name === choice); if (c) vals.vol = c.mid; } }, { k: 'vol', l: 'Target CO2 volumes', v: 2.4 }, { k: 'gal', l: 'Beer (gal)', v: 5 }, { k: 'temp', l: 'Highest temp since fermentation (F)', v: 68 }],
      out: (v, raw) => Object.keys(B.SUGARS).map(s => { const p = B.primingSugar(v.gal, v.temp, v.vol, s); return { l: s, v: `${p.grams} g`, n: `${p.oz} oz` }; }).concat([{ l: 'Residual CO2 in the beer', v: B.residualCo2(v.temp) + ' volumes', n: 'use the warmest it has been since fermentation ended' }]).concat(carbLines(raw.style, v.vol)) },
    { id: 'keg', title: 'Keg carbonation', about: 'Regulator pressure for a carbonation level at your keezer temperature. Pick the style, or type the volumes, and the pressure follows. Type a pressure instead and it tells you the volumes you will get.',
      fields: [{ k: 'style', l: 'Carbonate by style', type: 'select', v: '', options: () => [{ v: '', t: 'Choose a style\u2026' }].concat(D.CARBONATION.map(c => ({ v: c.name, t: `${c.name}: ${c.low} to ${c.high}` }))), set: (choice, vals) => { const c = D.CARBONATION.find(x => x.name === choice); if (c) vals.vol = c.mid; } },
        { k: 'temp', l: 'Beer temperature in the keg (F)', v: 38 }, { k: 'vol', l: 'CO2 volumes', v: 2.4 }, { k: 'psi', l: 'Regulator pressure (psi)', v: B.kegPsi(38, 2.4) }],
      // the two numbers are one fact seen from both ends: whichever the brewer touches, the other is recalculated
      link: (changed, vals) => { const t = num(vals.temp) || 38; if (changed === 'psi') vals.vol = B.volumesAtPsi(t, num(vals.psi)); else vals.psi = Math.max(0, B.kegPsi(t, num(vals.vol) || 0)); },
      out: (v, raw) => [{ l: 'Set the regulator to', v: v.psi + ' psi', n: `${B.psiToBar(v.psi)} bar at ${v.temp}F; about a week to equilibrate, or 30 psi for 24 hours then down to this` }, { l: 'Which gives', v: v.vol + ' volumes' }].concat(carbLines(raw.style, v.vol, v.temp)) },
    { id: 'yeast', title: 'Pitch rate and starter', about: 'How many cells the wort needs, how many an aging pack still has, and whether a starter closes the gap.',  fields: [{ k: 'gal', l: 'Batch (gal)', v: 5.5 }, { k: 'og', l: 'OG', v: 1.055 }, { k: 'rate', l: 'Rate (M cells/ml/degP)', v: 0.75 }, { k: 'cells', l: 'Cells in the pack (billion)', v: 100 }, { k: 'months', l: 'Pack age (months)', v: 2 }, { k: 'starter', l: 'Starter size (L)', v: 2 }],
      out: v => { const need = B.cellsNeeded(v.gal, v.og, v.rate); const viable = B.yeastViability(v.cells, v.months); const grown = B.starterGrowth(viable, v.starter);
        return [{ l: 'Cells needed', v: need + ' billion', n: '0.75 ale, 1.5 lager' }, { l: 'Viable in the pack', v: viable + ' billion', n: `${v.months} months old` }, { l: `After a ${v.starter} L starter`, v: grown + ' billion', n: `${B.starterDme(v.starter)} g DME`, tone: grown >= need ? 'ok' : 'bad' }, { l: 'Verdict', v: grown >= need ? 'enough' : 'short: bigger starter or another pack', tone: grown >= need ? 'ok' : 'bad' }]; } },
    { id: 'waterbuild', title: 'Water: what to add', about: 'Start from your water, pick the profile you want, and it works out how much RO to cut it with and how many grams of each salt to add.', custom: true },
    { id: 'water', title: 'Water salts, by hand', about: 'Type the grams yourself and see what they do, starting from RO. For working out what to add, use "Water: what to add".', fields: [{ k: 'gal', l: 'Total water (gal)', v: 7 }, { k: 'gyp', l: 'Gypsum (g)', v: 4 }, { k: 'cacl', l: 'Calcium chloride (g)', v: 2 }, { k: 'eps', l: 'Epsom (g)', v: 0 }, { k: 'salt', l: 'Table salt (g)', v: 0 }, { k: 'soda', l: 'Baking soda (g)', v: 0 }],
      out: v => { const w = B.waterAdditions({}, [{ salt: 'Gypsum (CaSO4)', grams: v.gyp }, { salt: 'Calcium chloride (CaCl2)', grams: v.cacl }, { salt: 'Epsom salt (MgSO4)', grams: v.eps }, { salt: 'Table salt (NaCl)', grams: v.salt }, { salt: 'Baking soda (NaHCO3)', grams: v.soda }], v.gal);
        return [{ l: 'Calcium', v: w.Ca + ' ppm', n: 'aim 50 to 150' }, { l: 'Sulfate', v: w.SO4 + ' ppm' }, { l: 'Chloride', v: w.Cl + ' ppm' }, { l: 'Sodium / magnesium', v: `${w.Na} / ${w.Mg} ppm` }, { l: 'Sulfate : chloride', v: w.ratio === null ? '-' : w.ratio, n: B.ratioVerdict(w.ratio) }]; } },
    { id: 'convert', title: 'Conversions', about: 'Gravity, temperature, volume and weight between the units brewers meet.',  fields: [{ k: 'sg', l: 'Specific gravity', v: 1.048 }, { k: 'p', l: 'Plato', v: 12 }, { k: 'f', l: 'Fahrenheit', v: 152 }, { k: 'gal', l: 'Gallons', v: 5.5 }, { k: 'lb', l: 'Pounds', v: 11 }],
      out: v => [{ l: `${v.sg} SG`, v: B.sgToPlato(v.sg) + ' \u00B0P' }, { l: `${v.p} \u00B0P`, v: B.platoToSg(v.p).toFixed(4) + ' SG' }, { l: `${v.f} F`, v: B.fToC(v.f) + ' C' }, { l: `${v.gal} gal`, v: B.galToL(v.gal) + ' L' }, { l: `${v.lb} lb`, v: B.lbToKg(v.lb) + ' kg' }] }
  ];
  // where the chosen figure sits in the style's range, and the bottle warning
  function carbLines(styleName, vol, tempF) {
    const c = D.CARBONATION.find(x => x.name === styleName), out = [];
    if (c) out.push({ l: 'Style range', v: `${c.low} to ${c.high}`, n: (vol < c.low ? 'your target is below it' : vol > c.high ? 'your target is above it' : 'your target is inside it') + (c.note ? '. ' + c.note : ''), tone: vol >= c.low && vol <= c.high ? 'ok' : '' });
    if (vol > 3 && !tempF) out.push({ l: 'Bottles', v: 'heavy only', n: 'standard longnecks are not safe much above 3.0 volumes: use Belgian, German wheat or champagne bottles', tone: 'bad' });
    return out;
  }
  const calcVals = {};
  const firstSentence = t => { const i = t.indexOf('. '); return i < 0 ? t : t.slice(0, i + 1); };
  async function renderCalc() {
    if (!state.sub) return view.append(h('h2', null, 'Calculators'), h('ul', { class: 'list' }, CALCS.map(c => h('li', null, h('button', { onclick: () => go('calc', c.id) }, h('span', { class: 't' }, h('b', null, c.title), c.about ? h('span', null, firstSentence(c.about)) : null), h('span', { class: 'k' }, '\u203A'))))));
    const c = CALCS.find(x => x.id === state.sub); if (!c) return go('calc');
    if (c.custom) return renderWaterBuild(c);
    const vals = calcVals[c.id] || (calcVals[c.id] = Object.fromEntries(c.fields.map(f => [f.k, f.v])));
    const readout = h('div', { class: 'readout' });
    const update = () => { readout.innerHTML = ''; const v = {}; for (const f of c.fields) v[f.k] = f.type === 'select' ? vals[f.k] : num(vals[f.k]);
      let res; try { res = c.out(v, vals); } catch (e) { res = [{ l: 'Check the inputs', v: '-', tone: 'bad' }]; }
      for (const r of res) readout.append(h('div', { class: 'line ' + (r.tone || '') }, h('span', { class: 'l' }, r.l, r.n ? h('span', { class: 'n' }, r.n) : null), h('span', { class: 'v' }, r.v))); };
    const inputs = h('div'); let els = {};
    // after a linked change, refresh the other boxes without touching the one being typed in
    const sync = except => { for (const k in els) if (k !== except && els[k].value !== String(vals[k])) els[k].value = vals[k]; };
    const drawInputs = () => { inputs.innerHTML = ''; els = {}; for (const f of c.fields) {
      if (f.type === 'select') { const s = sel(typeof f.options === 'function' ? f.options() : f.options, vals[f.k]); s.addEventListener('change', () => { vals[f.k] = s.value; if (f.set) f.set(s.value, vals); if (c.link) c.link(f.k, vals); if (f.set || c.link) sync(f.k); update(); }); inputs.append(field(f.l, s)); }
      else { els[f.k] = inp(vals[f.k], 'number', { oninput: e => { vals[f.k] = e.target.value; if (c.link) { c.link(f.k, vals); sync(f.k); } update(); } }); inputs.append(field(f.l, els[f.k])); } } };
    view.append(h('button', { class: 'back', onclick: () => goBack('calc') }, '\u2039 Calculators'), h('h2', null, c.title), c.about ? h('p', { class: 'muted' }, c.about) : null, readout);
    if (c.examples) view.append(h('h3', null, 'Worked examples'), h('ul', { class: 'list' }, c.examples.map(ex => h('li', null, h('button', { onclick: () => { Object.assign(vals, ex.v); drawInputs(); update(); window.scrollTo(0, 0); } }, h('span', { class: 't' }, h('b', null, ex.t), h('span', null, ex.n)), h('span', { class: 'k' }, 'use'))))), h('h3', null, 'Your numbers'));
    view.append(inputs);
    if (c.credit) view.append(h('p', { class: 'muted small' }, B.SMPH_CREDIT), h('p', { class: 'muted small' }, 'A model, not a measurement: alpha acid on the pack varies 10 to 15% and a volume off by 10% moves the answer by 10%. The conditions it assumes (wort pH, chill time, krausen loss, age of the beer) are under Settings.'));
    drawInputs(); update();
  }
  const fmtTsp = t => { const q = Math.round(t * 4); if (q < 1) return 'a pinch'; const whole = Math.floor(q / 4), frac = ['', '1/4', '1/2', '3/4'][q % 4]; return `${[whole || '', frac].filter(Boolean).join(' ')} tsp`; };
  // Water: from the brewer's water to a target profile
  async function renderWaterBuild(c) {
    const saved = await S.get('myWater', null);
    const list = await batchList(); const cur = state.batchId ? list.find(x => x.id === state.batchId) : null;
    const st = calcVals.waterbuild || (calcVals.waterbuild = { source: saved ? 'mine' : D.WATER_SOURCES[3].name, ions: saved ? Object.assign({}, saved) : null, target: D.WATER_PROFILES[1].name, gal: '', dilute: true, hard: '', alk: '', units: 'ppm' });
    if (!st.ions) { const p = D.WATER_SOURCES.find(w => w.name === st.source) || D.WATER_SOURCES[0]; st.ions = Object.fromEntries(B.IONS.map(i => [i, p[i]])); }
    if (!st.gal) { const g = cur ? grainLbOf(cur) : 0; st.gal = cur && g ? B.round.r1(B.brewTargets(cur, EQ, g, yeastOf(cur)).totalWaterGal) : B.round.r1(EQ.boilGal + 1.5); }
    const out = h('div');
    const srcSel = sel((saved ? [{ v: 'mine', t: 'My water (saved)' }] : []).concat(D.WATER_SOURCES.map(w => ({ v: w.name, t: w.name }))).concat([{ v: 'custom', t: 'From my water report or test kit' }]), st.source);
    const ionInputs = Object.fromEntries(B.IONS.map(i => [i, inp(st.ions[i], 'number')]));
    const srcNote = h('p', { class: 'muted small', style: 'margin:-6px 0 12px' });
    const setIons = p => { for (const i of B.IONS) { st.ions[i] = num(p[i]); ionInputs[i].value = st.ions[i]; } };
    const noteFor = () => { const p = D.WATER_SOURCES.find(w => w.name === st.source); srcNote.textContent = st.source === 'mine' ? 'The numbers you saved. Edit them below and save again if your report changes.' : st.source === 'custom' ? 'Type the six ions from your report, or use the two-number estimate below.' : `${p.note}. Typical of the type, not of your tap: good enough to decide how much to dilute, not to chase the last few ppm.`; };
    srcSel.addEventListener('change', () => { st.source = srcSel.value; if (st.source === 'mine' && saved) setIons(saved); else { const p = D.WATER_SOURCES.find(w => w.name === st.source); if (p) setIons(p); } noteFor(); draw(); });
    for (const i of B.IONS) ionInputs[i].addEventListener('input', () => { st.ions[i] = num(ionInputs[i].value); if (st.source !== 'mine') { st.source = 'custom'; srcSel.value = 'custom'; noteFor(); } draw(); });
    const tgtSel = sel(D.WATER_PROFILES.map(w => ({ v: w.name, t: `${w.name}: ${w.note}` })), st.target); tgtSel.addEventListener('change', () => { st.target = tgtSel.value; draw(); });
    const galIn = inp(st.gal, 'number'); galIn.addEventListener('input', () => { st.gal = galIn.value; draw(); });
    const dil = h('input', { type: 'checkbox', style: 'width:24px;height:24px;min-height:24px;flex:none;padding:0' }); dil.checked = st.dilute; dil.addEventListener('change', () => { st.dilute = dil.checked; draw(); });
    const hardIn = inp(st.hard, 'number'), alkIn = inp(st.alk, 'number'), unitSel = sel([{ v: 'ppm', t: 'ppm as CaCO3 (mg/L)' }, { v: 'gpg', t: 'grains per gallon' }, { v: 'dH', t: 'German degrees (dH, dGH, dKH)' }], st.units);
    const kitBtn = h('button', { class: 'btn secondary', onclick: () => { const hd = B.asCaCO3(hardIn.value, unitSel.value), ak = B.asCaCO3(alkIn.value, unitSel.value); if (!hd && !ak) return toast('Enter hardness and alkalinity'); const w = B.waterFromKit(hd, ak); st.hard = hardIn.value; st.alk = alkIn.value; st.units = unitSel.value;
      setIons(Object.assign({}, st.ions, { Ca: w.Ca, Mg: w.Mg, HCO3: w.HCO3 })); st.source = 'custom'; srcSel.value = 'custom'; noteFor(); draw(); toast('Calcium, magnesium and bicarbonate estimated'); } }, 'Estimate from these two');
    function draw() {
      out.innerHTML = ''; const target = D.WATER_PROFILES.find(w => w.name === st.target); const r = B.waterSolve(st.ions, target, num(st.gal), { dilute: st.dilute });
      if (!r) return out.append(h('div', { class: 'empty' }, 'Enter the total water.'));
      const ro = h('div', { class: 'readout' }); const line = (l, v, n, tone) => ro.append(h('div', { class: 'line ' + (tone || '') }, h('span', { class: 'l' }, l, n ? h('span', { class: 'n' }, n) : null), h('span', { class: 'v' }, v)));
      if (r.dilution > 0) line('RO or distilled', `${r.roGal} gal`, r.dilution >= 1 ? 'all of it: build from a blank slate' : `${Math.round(r.dilution * 100)}% of the water, with ${r.tapGal} gal of yours`);
      else line('Your water', `${r.tapGal} gal`, 'no dilution needed');
      if (!r.additions.length) line('Salts', 'none', 'already as close as salts can get it');
      for (const ad of r.additions) line(ad.salt.replace(/\s*\(.*\)/, ''), `${ad.grams} g`, `about ${fmtTsp(ad.tsp)}; weigh it if you can`);
      line('Sulfate : chloride', r.result.ratio === null ? '-' : r.result.ratio, B.ratioVerdict(r.result.ratio));
      line('Residual alkalinity', r.ra, B.raVerdict(r.ra));
      out.append(ro);
      out.append(h('div', { class: 'tablewrap' }, h('table', { class: 'ref', style: 'min-width:0' }, h('thead', null, h('tr', null, ['', 'Yours', 'Result', 'Target', 'Off by'].map(x => h('th', null, x)))),
        h('tbody', null, B.IONS.map(i => h('tr', null, h('th', null, i), h('td', { class: 'mono' }, Math.round(st.ions[i])), h('td', { class: 'mono' }, r.result[i]), h('td', { class: 'mono' }, r.target[i]), h('td', { class: 'mono', style: Math.abs(r.result[i] - r.target[i]) > Math.max(20, r.target[i] * 0.25) ? 'color:var(--warn)' : '' }, (r.result[i] - r.target[i] > 0 ? '+' : '') + (r.result[i] - r.target[i]))))))));
      if (r.excessAlk > 40) out.append(h('div', { class: 'note' }, h('b', { style: 'color:var(--text)' }, `Still ${r.excessAlk} ppm too alkaline. `), st.dilute ? 'Salts cannot take bicarbonate out. ' : 'Without RO, salts cannot take bicarbonate out. ', `Acid can: about ${B.lacticForAlkalinity(r.excessAlk, num(st.gal))} mL of 88% lactic acid across the ${st.gal} gal, or 2 to 3% acidulated malt in the grist. That figure is approximate: add two thirds, check the mash pH if you have a meter, and stop at 5.2 to 5.5.`));
      if (r.rms > 25) out.append(h('p', { class: 'muted small' }, 'This target cannot be reached closely from your water. Sodium, chloride and sulfate only come out by dilution.' + (st.dilute ? '' : ' Allow RO dilution above and it will get much nearer.')));
      const btns = h('div', { class: 'btns' });
      if (cur) btns.append(h('button', { class: 'btn', onclick: async () => { cur.salts = r.additions.map(x => ({ salt: x.salt, grams: x.grams })); cur.waterNote = `${st.target}: ${r.dilution > 0 ? r.roGal + ' gal RO + ' + r.tapGal + ' gal tap' : 'tap water'}`; await DB.put('batches', cur); toast(`Salts saved to ${cur.name || 'the batch'}`); } }, `Use these in ${cur.name || 'the current batch'}`));
      btns.append(h('button', { class: 'btn secondary', onclick: async () => { await S.set('myWater', Object.assign({}, st.ions)); st.source = 'mine'; toast('Saved as your water'); go('calc', 'waterbuild'); } }, 'Save these as my water'));
      out.append(btns);
    }
    view.append(h('button', { class: 'back', onclick: () => goBack('calc') }, '\u2039 Calculators'), h('h2', null, c.title), h('p', { class: 'muted' }, c.about),
      h('h3', null, '1. Your water'), field('Start from', srcSel), srcNote,
      h('div', { class: 'row3' }, field('Calcium', ionInputs.Ca), field('Magnesium', ionInputs.Mg), field('Sodium', ionInputs.Na)), h('div', { class: 'row3' }, field('Chloride', ionInputs.Cl), field('Sulfate', ionInputs.SO4), field('Bicarbonate', ionInputs.HCO3)),
      h('details', { class: 'plat' }, h('summary', null, 'Only have hardness and alkalinity?'), h('div', { class: 'body' }, h('p', { class: 'small' }, 'From a thin report, or a pool or aquarium test kit (GH and KH). Those two numbers decide most of what matters: how much to dilute and whether you need acid. Calcium and magnesium are split 70 to 30, which is typical; chloride, sulfate and sodium stay as they are above.'),
        h('div', { class: 'row' }, field('Total hardness', hardIn), field('Total alkalinity', alkIn)), field('Units', unitSel, 'Reports say "as CaCO3". If yours lists bicarbonate itself, type it straight into the box above instead.'), h('div', { class: 'btns' }, kitBtn))),
      h('details', { class: 'plat' }, h('summary', null, 'Where to find your water numbers'), h('div', { class: 'body' }, h('ul', null, D.WATER_REPORT_HELP.map(x => h('li', { class: 'small' }, x))))),
      h('h3', null, '2. The water you want'), field('Target profile', tgtSel), h('div', { class: 'row', style: 'align-items:end' }, field('Total brewing water (gal)', galIn, cur ? `strike plus sparge for ${cur.name || 'the current batch'}` : 'strike plus sparge'), h('label', { class: 'field', style: 'display:flex;align-items:center;gap:10px;min-height:48px' }, dil, h('span', { style: 'margin:0' }, 'Allow dilution with RO or distilled'))),
      h('h3', null, '3. What to add'), out,
      h('p', { class: 'muted small' }, 'Salts go in the strike water. Figures are for the whole volume; chalk is left out because it barely dissolves. Matching a famous city to the last ppm is not the point: get calcium above 50, set the sulfate to chloride balance for the beer, and keep the alkalinity right for its color.'));
    noteFor(); draw();
  }

  // ---------- reference ----------
  async function renderRef() {
    const sub = state.sub;
    const back = h('button', { class: 'back', onclick: () => goBack('ref') }, '\u2039 Reference');
    if (sub === 'shared') return renderShared();
    if (sub === 'hops') {
      const q = inp('', 'search', { placeholder: `search ${D.HOPS.length} hops` });
      const genre = sel(['All genres'].concat(D.HOP_GENRES), 'All genres');
      const use = sel([{ v: 'All', t: 'Any use' }, { v: 'B', t: 'Bittering' }, { v: 'A', t: 'Aroma' }, { v: 'D', t: 'Dual' }], 'All');
      const out = h('div');
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        const list = D.HOPS.filter(x => (!t || x.name.toLowerCase().includes(t) || x.flavor.toLowerCase().includes(t) || x.genre.toLowerCase().includes(t))
          && (genre.value === 'All genres' || x.genre === genre.value) && (use.value === 'All' || x.use === use.value));
        if (!list.length) return out.append(h('div', { class: 'empty' }, 'No hop matches that.'));
        const groups = genre.value === 'All genres' ? D.HOP_GENRES : [genre.value];
        for (const g of groups) {
          const inG = list.filter(x => x.genre === g); if (!inG.length) continue;
          out.append(h('h3', null, g, h('span', { class: 'muted small' }, `  ${inG.length}`)));
          out.append(h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('thead', null, h('tr', null, ['Hop', 'Alpha %', 'Use', 'Flavor', 'Substitutes'].map(x => h('th', null, x)))),
            h('tbody', null, inG.map(x => h('tr', null, h('td', null, x.name), h('td', { class: 'mono' }, `${x.alphaLow} to ${x.alphaHigh}`), h('td', null, { B: 'Bittering', A: 'Aroma', D: 'Dual' }[x.use]), h('td', null, x.flavor), h('td', null, x.subs)))))));
        } };
      [q, genre, use].forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', draw));
      view.append(back, h('h2', null, 'Hops'), field('Search', q), h('div', { class: 'row' }, field('Genre', genre), field('Use', use)), out); draw(); return;
    }
    if (sub === 'styles' || (sub && sub.startsWith('recipe:'))) {
      if (sub.startsWith('recipe:')) {
        const r = RC.RECIPES.find(x => x.name === sub.slice(7)); if (!r) return go('ref', 'styles', { replace: true });
        view.append(h('button', { class: 'back', onclick: () => goBack('ref', r.group === 'Historic' ? 'world' : 'styles') }, r.group === 'Historic' ? '\u2039 Beers of the world' : '\u2039 Styles'),
          h('h2', null, h('span', { class: 'swatch', style: 'background:' + B.srmHex(r.srm) }), r.name),
          h('p', { class: 'muted' }, `${r.region} \u00B7 ${r.group} \u00B7 ${RECIPE_GAL} gal, ${r.boilMin} min boil, ${EQ.efficiency}% efficiency`));
        view.append(modelToggle(IBU_MODEL, async m => { IBU_MODEL = m; await S.set('ibuModel', m); render(); }), sizePicker(() => render()));
        const sized = recipeToBatch(r, RECIPE_GAL);
        const ri = recipeIbu(r), rHops = sized.hops.map(hp => Object.assign({}, hp)).concat(sized.dryHops.map(d => Object.assign({ use: 'Dry hop', minutes: 0, dryDays: d.days }, d)));
        const ro = h('div', { class: 'readout' });
        [['OG / FG', `${r.og.toFixed(3)} / ${r.fg.toFixed(3)}`, `style ${r.ranges.og[0].toFixed(3)} to ${r.ranges.og[1].toFixed(3)}`], [`IBU (${ri.label})`, String(ri.v), `style ${r.ranges.ibu[0]} to ${r.ranges.ibu[1]} \u00B7 ${ri.other}${r.ibuDry ? '; dry hops read +' + r.ibuDry + ' on a lab test' : ''}`], ['Color', `${r.srm} SRM`, `style ${r.ranges.srm[0]} to ${r.ranges.srm[1]}`], ['ABV', `${r.abv}%`, `style ${r.ranges.abv[0]} to ${r.ranges.abv[1]}`]]
          .forEach(([l, v, n]) => ro.append(h('div', { class: 'line' }, h('span', { class: 'l' }, l, h('span', { class: 'n' }, n)), h('span', { class: 'v' }, v))));
        view.append(ro);
        view.append(h('h3', null, 'Fermentables'), h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('tbody', null, sized.fermentables.map(f => h('tr', null, h('td', { class: 'mono', style: 'width:22%' }, `${f.lb} lb`), h('td', null, f.name), h('td', { class: 'mono' }, `${f.pct}%`)))))));
        if (rHops.length) view.append(h('h3', null, 'Hops'), h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('tbody', null, rHops.map(hp => h('tr', null, h('td', { class: 'mono', style: 'width:22%' + (hp.sized ? ';color:var(--amber);font-weight:700' : '') }, `${hp.oz} oz`), h('td', null, `${hp.name} (${hp.alpha}%)`, hp.sized ? h('span', { class: 'muted small' }, `  sized by ${ri.label}`) : null), h('td', { class: 'mono' }, hp.use === 'Dry hop' ? `dry hop, ${hp.dryDays} days` : hp.use === 'Whirlpool' ? 'whirlpool' : `${hp.minutes} min`)))))));
        else view.append(h('p', { class: 'muted small' }, 'No hops: see the notes for what bitters it.'));
        view.append(h('h3', null, 'Yeast and process'),
          h('p', null, h('b', null, r.yeast), ` \u00B7 pitch and ferment at ${r.fermF}F (strain range ${r.yeastRange[0]} to ${r.yeastRange[1]}F)`),
          h('p', null, h('b', null, 'Mash '), `${r.mashF}F for 60 minutes. `, h('b', null, 'Water: '), r.water),
          h('p', null, r.notes),
          h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => {
            if (!(await needReg('save'))) return;
            const b = recipeToBatch(r, RECIPE_GAL); b.fermentables.forEach(f => delete f.pct); b.hops.forEach(hp => { delete hp.sized; delete hp.use; });
            const id = await DB.put('batches', b); state.batchId = id; await S.set('lastBatch', id); keepStorage(); toast('Batch created from the recipe'); go('batches', 'view:' + id); } }, `Brew this at ${RECIPE_GAL} gal`),
            h('button', { class: 'btn secondary', onclick: () => go('shop', 'style:' + r.name) }, 'Shop for it'),
            h('button', { class: 'btn secondary', onclick: async () => { const b = recipeToBatch(r, RECIPE_GAL); b.fermentables.forEach(f => delete f.pct); b.hops.forEach(hp => { delete hp.sized; delete hp.use; }); shareRecipe(b, recipeStats(b)); } }, 'Share it')),
          h('p', { class: 'muted small' }, `A generic, sensible version of the style, checked against the style ranges. Written for 5 gallons at 72% efficiency and shown here scaled to ${RECIPE_GAL} gallons at the ${EQ.efficiency}% mash efficiency in your equipment profile: grain follows both, hops and sugars follow the volume. Bigger batches take longer to chill, and hops keep bittering until the wort is below 140F: if yours does, raise "Minutes to chill below 140F" in Settings and every IBU figure follows.`),
          h('p', { class: 'muted small' }, MODEL_BLURB),
          (() => { const c = D.carbFor(r.name); return c ? h('p', { class: 'muted small' }, `Carbonation: ${c.low} to ${c.high} volumes.${c.note ? ' ' + c.note + '.' : ''}`) : null; })());
        return;
      }
      const MODERN = RC.RECIPES.filter(r => r.group !== 'Historic'); const MREG = [...new Set(MODERN.map(r => r.region))];
      const q = inp('', 'search', { placeholder: `search ${MODERN.length} styles` });
      const region = sel(['All regions'].concat(MREG), 'All regions');
      const strength = sel([{ v: 'all', t: 'Any strength' }, { v: 'low', t: 'Under 4.5%' }, { v: 'mid', t: '4.5 to 6.5%' }, { v: 'high', t: 'Over 6.5%' }], 'all');
      const out = h('div');
      const toggleBox = h('div');
      const drawToggle = () => { toggleBox.innerHTML = ''; toggleBox.append(modelToggle(IBU_MODEL, async m => { IBU_MODEL = m; await S.set('ibuModel', m); drawToggle(); draw(); })); };
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        const list = MODERN.filter(r => (!t || r.name.toLowerCase().includes(t) || r.group.toLowerCase().includes(t) || r.region.toLowerCase().includes(t))
          && (region.value === 'All regions' || r.region === region.value)
          && (strength.value === 'all' || (strength.value === 'low' && r.abv < 4.5) || (strength.value === 'mid' && r.abv >= 4.5 && r.abv <= 6.5) || (strength.value === 'high' && r.abv > 6.5)));
        if (!list.length) return out.append(h('div', { class: 'empty' }, 'No recipe matches that.'));
        const regions = region.value === 'All regions' ? MREG : [region.value];
        for (const rg of regions) { const inR = list.filter(r => r.region === rg); if (!inR.length) continue;
          out.append(h('h3', null, rg, h('span', { class: 'muted small' }, `  ${inR.length}`)));
          for (const r of inR) out.append(h('div', { class: 'rec' }, h('span', { class: 'swatch', style: 'background:' + B.srmHex(r.srm) }),
            h('div', { class: 't' }, h('b', null, r.name), h('div', { class: 'meta' }, `${r.og.toFixed(3)} \u00B7 ${recipeIbu(r).v} IBU \u00B7 ${r.srm} SRM \u00B7 ${r.abv}% \u00B7 ${r.yeast.split('/')[0].trim()}`)),
            h('button', { class: 'act', onclick: () => go('ref', 'recipe:' + r.name) }, 'Open'))); } };
      [q, region, strength].forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', draw));
      drawToggle();
      view.append(back, h('h2', null, 'Styles and recipes'), field('Search', q), h('div', { class: 'row' }, field('Region', region), field('Strength', strength)), toggleBox, h('p', { class: 'muted small', style: 'margin-top:-6px' }, 'Changes the bittering hops in every recipe, and which IBU figure is shown.'), out,
        h('p', { class: 'muted small' }, 'Each style shows its published ranges and a generic 5-gallon recipe sized to the middle of them by the same math as the calculators. Starting points, not award winners. Historical beers are under Beers of the world.'));
      draw(); return;
    }
    if (sub === 'world') {
      const q = inp('', 'search', { placeholder: `search ${D.WORLD.length} beers` });
      const era = sel(['All eras'].concat(D.WORLD_ERAS), 'All eras');
      const strength = sel([{ v: 'all', t: 'Any strength' }, { v: 'low', t: 'Under 4%' }, { v: 'mid', t: '4 to 7%' }, { v: 'high', t: 'Over 7%' }], 'all');
      const bitter = sel([{ v: 'all', t: 'Any bitterness' }, { v: 'low', t: 'Under 15 IBU' }, { v: 'mid', t: '15 to 40 IBU' }, { v: 'high', t: 'Over 40 IBU' }], 'all');
      const sort = sel([{ v: 'year', t: 'Oldest first' }, { v: 'abv', t: 'Strongest first' }, { v: 'name', t: 'A to Z' }], 'year');
      const fate = sel([{ v: 'all', t: 'Any' }].concat(D.WORLD_FATES.map(x => ({ v: x, t: x }))), 'all');
      const out = h('div');
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        let list = D.WORLD.filter(w => (!t || w.name.toLowerCase().includes(t) || w.region.toLowerCase().includes(t) || w.note.toLowerCase().includes(t) || w.key.toLowerCase().includes(t) || (w.modern || '').toLowerCase().includes(t) || (w.today || '').toLowerCase().includes(t))
          && (era.value === 'All eras' || w.era === era.value) && (fate.value === 'all' || w.fate === fate.value)
          && (strength.value === 'all' || (strength.value === 'low' && w.abvHigh < 4) || (strength.value === 'mid' && w.abvLow >= 3 && w.abvLow <= 7) || (strength.value === 'high' && w.abvHigh > 7))
          && (bitter.value === 'all' || (bitter.value === 'low' && w.ibuHigh < 15) || (bitter.value === 'mid' && w.ibuHigh >= 15 && w.ibuLow <= 40) || (bitter.value === 'high' && w.ibuHigh > 40)));
        list = list.sort(sort.value === 'year' ? (a, b) => a.year - b.year : sort.value === 'abv' ? (a, b) => b.abvHigh - a.abvHigh : (a, b) => a.name.localeCompare(b.name));
        if (!list.length) return out.append(h('div', { class: 'empty' }, 'Nothing matches those filters.'));
        for (const w of list) {
          const when = w.year < 0 ? `about ${Math.abs(w.year)} BC` : `about ${w.year} AD`;
          const fateClass = { 'Still brewed': 'ok', Revived: 'due', Evolved: '', Lost: 'overdue' }[w.fate] || '';
          out.append(h('details', { class: 'plat' }, h('summary', null, h('span', { style: 'flex:1' }, w.name, h('span', { class: 'muted small', style: 'display:block;font-weight:400' }, `${when} \u00B7 ${w.region}`)), h('span', { class: 'badge ' + fateClass, style: 'margin:0 10px 0 8px' }, w.fate)),
            h('div', { class: 'body' },
              h('p', { class: 'muted small' }, `${w.era} \u00B7 ${w.abvLow} to ${w.abvHigh}% \u00B7 ${w.ibuLow} to ${w.ibuHigh} IBU as you would brew it now`),
              h('h4', null, 'Then'), h('p', null, w.note),
              h('p', null, h('b', null, 'What made it: '), w.key),
              h('h4', null, 'Now'), h('p', null, h('b', null, `${w.fate}. `), w.today),
              h('p', null, h('b', null, 'Closest modern beer: '), w.modern, w.recipe ? h('span', null, ' ', h('button', { class: 'act', style: 'background:none;border:0;color:var(--amber);font:inherit;padding:0;cursor:pointer;text-decoration:underline', onclick: () => go('ref', 'recipe:' + w.recipe) }, `Open the ${w.recipe} recipe`)) : null),
              (() => { const stem = w.name.toLowerCase().split(' (')[0].slice(0, 8); const rec = RC.RECIPES.find(r => r.name.toLowerCase().startsWith(stem)); if (!rec) return h('p', { class: 'muted small' }, 'No reconstruction: the original method does not translate to a home kettle.');
                if (w.recipe === rec.name) return null;   // the modern recipe above is the same one
                return h('div', null, h('h4', { style: 'margin:10px 0 4px;font-size:13px' }, `Brew the old one: ${rec.og.toFixed(3)} \u00B7 ${recipeIbu(rec).v} IBU \u00B7 ${rec.abv}%`),
                  h('p', { class: 'small', style: 'margin:0 0 4px' }, rec.fermentables.map(f => `${f.lb} lb ${f.name}`).join(', ')),
                  recipeHops(rec).length ? h('p', { class: 'small', style: 'margin:0 0 4px' }, recipeHops(rec).map(hp => `${hp.oz} oz ${hp.name} ${hp.use === 'Dry hop' ? 'dry' : hp.use === 'Whirlpool' ? 'whirlpool' : hp.minutes + ' min'}`).join(', ')) : null,
                  h('p', { class: 'small', style: 'margin:0 0 6px' }, `${rec.yeast}, mash ${rec.mashF}F, ferment ${rec.fermF}F`),
                  h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => go('ref', 'recipe:' + rec.name) }, 'Full reconstruction and Brew this'))); })())));
        } };
      [q, era, strength, bitter, sort, fate].forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', draw));
      view.append(back, h('h2', null, 'Beers of the world: origins'),
        h('p', { class: 'muted' }, 'Where beer came from. These are the ancestors: old beers, most of them older than hops, thermometers or written recipes. Each one shows what it was then, what became of it, and the beer on a shelf today that descends from it. For modern styles, go to Styles and recipes.'),
        field('Search', q),
        h('div', { class: 'row' }, field('Era', era), field('What became of it', fate)), field('Sort', sort),
        h('div', { class: 'row' }, field('Strength', strength), field('Bitterness', bitter)), out,
        h('p', { class: 'muted small' }, 'Still brewed: never stopped. Revived: died out and was brought back. Evolved: the name or the idea lives on in a changed modern beer. Lost: known only from reconstruction.'),
        h('p', { class: 'muted small' }, 'Nobody recorded gravities or bitterness at the time, so the recipes here are modern reconstructions: what you would aim at to brew something in that spirit today. Breweries named are long-standing reference examples; small producers come and go.'));
      draw(); return;
    }
    if (sub === 'kveik') {
      view.append(back, h('h2', null, 'Kveik'), h('p', { class: 'muted' }, 'Norwegian farmhouse yeast cultures: hot, fast, and reusable.'));
      add(h('ul', null, D.KVEIK_NOTES.map(x => h('li', { style: 'margin:0 0 10px' }, x))));
      view.append(h('h3', null, 'Cultures'));
      for (const y of D.YEAST.filter(x => x.type === 'Kveik')) view.append(h('div', { class: 'rec' }, h('div', { class: 't' }, h('b', null, y.name),
        h('div', { class: 'meta mono' }, `${y.tempLow} to ${y.tempHigh} F \u00B7 ${y.attLow} to ${y.attHigh}% \u00B7 ${y.floc} flocculation`), h('div', { class: 'meta' }, y.note))));
      return;
    }
    if (sub === 'fermentables') {
      const q = inp('', 'search', { placeholder: `search ${D.FERMENTABLES.length} fermentables` }); const out = h('div');
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        const list = D.FERMENTABLES.filter(x => !t || x.name.toLowerCase().includes(t) || x.group.toLowerCase().includes(t));
        out.append(h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('thead', null, h('tr', null, ['Fermentable', 'PPG', 'Lovibond', 'Group', 'Note'].map(x => h('th', null, x)))),
          h('tbody', null, list.map(x => h('tr', null, h('td', null, h('span', { class: 'swatch', style: `background:${B.srmHex(x.lovibond)}` }), x.name), h('td', { class: 'mono' }, x.ppg), h('td', { class: 'mono' }, x.lovibond), h('td', null, x.group), h('td', null, x.note))))))); };
      q.addEventListener('input', draw); view.append(back, h('h2', null, 'Fermentables'), field('Search', q), out); draw(); return;
    }
    if (sub === 'yeast') {
      const types = [...new Set(D.YEAST.map(y => y.type))];
      const typeSel = sel(['All types'].concat(types), 'All types');
      const q = inp('', 'search', { placeholder: `search ${D.YEAST.length} strains` });
      const out = h('div');
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        const list = D.YEAST.filter(y => (typeSel.value === 'All types' || y.type === typeSel.value) && (!t || y.name.toLowerCase().includes(t) || y.note.toLowerCase().includes(t)));
        if (typeSel.value === 'Kveik') out.append(h('div', { class: 'note' }, h('b', null, 'Handling kveik'), h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, D.KVEIK_NOTES.map(x => h('li', { class: 'small', style: 'margin:0 0 5px' }, x)))));
        if (!list.length) return out.append(h('div', { class: 'empty' }, 'No strain matches that.'));
        for (const y of list) {
          const rowsData = [['Type', y.type], ['Attenuation', y.attLow + ' to ' + y.attHigh + '%'], ['Temperature', y.tempLow + ' to ' + y.tempHigh + ' F'], ['Flocculation', y.floc]];
          out.append(h('details', { class: 'plat' }, h('summary', null, y.name), h('div', { class: 'body' }, h('p', null, y.note),
            h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('tbody', null, rowsData.map(r => h('tr', null, h('th', { style: 'width:36%' }, r[0]), h('td', null, r[1])))))))));
        } };
      [q, typeSel].forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', draw));
      view.append(back, h('h2', null, 'Yeast'), field('Search', q), field('Type', typeSel), out); draw(); return;
    }
    if (sub === 'styles-old') {
      const q = inp('', 'search', { placeholder: `search ${D.STYLES.length} styles` }); const out = h('div');
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        const list = D.STYLES.filter(x => !t || x.name.toLowerCase().includes(t) || x.group.toLowerCase().includes(t));
        for (const s of list) {
          const rowsData = [['OG', s.ogLow.toFixed(3) + ' to ' + s.ogHigh.toFixed(3)], ['FG', s.fgLow.toFixed(3) + ' to ' + s.fgHigh.toFixed(3)], ['IBU', s.ibuLow + ' to ' + s.ibuHigh], ['SRM', s.srmLow + ' to ' + s.srmHigh], ['ABV', s.abvLow + ' to ' + s.abvHigh + '%']];
          out.append(h('details', { class: 'plat' },
            h('summary', null, h('span', { class: 'swatch', style: 'background:' + B.srmHex((s.srmLow + s.srmHigh) / 2) }), s.name),
            h('div', { class: 'body' }, h('p', null, s.note),
              h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('tbody', null,
                rowsData.map(r => h('tr', null, h('th', { style: 'width:30%' }, r[0]), h('td', { class: 'mono' }, r[1])))))))));
        } };
      q.addEventListener('input', draw); view.append(back, h('h2', null, 'Styles'), field('Search', q), out,
        h('p', { class: 'muted small' }, 'Widely published typical ranges for planning a recipe. For competition, work from the current judging guidelines.')); draw(); return;
    }
    if (sub === 'water') {
      view.append(back, h('h2', null, 'Water profiles'), h('div', { class: 'tablewrap' }, h('table', { class: 'ref' },
        h('thead', null, h('tr', null, ['Profile', 'Ca', 'Mg', 'Na', 'Cl', 'SO4', 'HCO3', 'Use'].map(x => h('th', null, x)))),
        h('tbody', null, D.WATER_PROFILES.map(w => h('tr', null, h('td', null, w.name), ...['Ca', 'Mg', 'Na', 'Cl', 'SO4', 'HCO3'].map(k => h('td', { class: 'mono' }, w[k])), h('td', null, w.note)))))),
        h('p', { class: 'muted small' }, 'Figures in ppm. Burton is famous and almost never copied in full.'),
        h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('calc', 'waterbuild') }, 'Work out what to add to my water')),
        h('h3', null, 'Finding your starting water'), h('ul', null, D.WATER_REPORT_HELP.map(x => h('li', { style: 'margin:0 0 8px' }, x))),
        h('h3', null, 'No report at all? Start from the type'), h('div', { class: 'tablewrap' }, h('table', { class: 'ref' },
          h('thead', null, h('tr', null, ['Water', 'Ca', 'Mg', 'Na', 'Cl', 'SO4', 'HCO3', 'Typical of'].map(x => h('th', null, x)))),
          h('tbody', null, D.WATER_SOURCES.map(w => h('tr', null, h('td', null, w.name), ...B.IONS.map(k => h('td', { class: 'mono' }, w[k])), h('td', null, w.note)))))),
        h('p', { class: 'muted small' }, 'Limescale in the kettle and soap that will not lather mean hard water. The harder and more alkaline it is, the more a pale beer gains from cutting it with RO.'));
      return;
    }
    if (sub === 'hopforms') {
      view.append(back, h('h2', null, 'Hop forms'), h('p', { class: 'muted' }, 'The recipe form offers the five you can dose by weight in the kettle or fermenter. The rest are here so you know what they are when you meet them.'));
      for (const f of D.HOP_FORM_NOTES) view.append(h('details', { class: 'plat' }, h('summary', null, f.name), h('div', { class: 'body' }, h('p', null, f.what), h('p', null, h('b', null, 'Using it: '), f.use), h('p', null, h('b', null, 'In this app: '), f.app))));
      return;
    }
    if (sub === 'off') {
      view.append(back, h('h2', null, 'Off-flavors'));
      for (const o of D.OFF_FLAVORS) view.append(h('details', { class: 'plat' }, h('summary', null, o.taste), h('div', { class: 'body' },
        h('p', null, h('b', null, o.cause), '. ', o.why), h('p', null, h('b', null, 'Fix: '), o.fix))));
      return;
    }
    if (sub === 'process') {
      view.append(back, h('h2', null, 'Process notes'));
      for (const k in D.PROCESS) add(h('h3', null, k), h('ul', null, D.PROCESS[k].map(x => h('li', { style: 'margin:0 0 8px' }, x))));
      return;
    }
    add(h('h2', null, 'Reference'), h('ul', { class: 'list' }, [
      ['styles', 'Styles and recipes', `${RC.RECIPES.filter(r => r.group !== 'Historic').length} styles by region, each with its ranges and a sized 5-gallon recipe`],
      ['hops', 'Hops', `${D.HOPS.length} varieties grouped by genre, with alpha, flavor and substitutes`],
      ['hopforms', 'Hop forms', 'Pellet, leaf, cryo, extract, wet and the rest: what they are and how to dose them'],
      ['fermentables', 'Fermentables', `${D.FERMENTABLES.length} malts, adjuncts, sugars and extracts with PPG and color`],
      ['yeast', 'Yeast', `${D.YEAST.length} strains: attenuation, pitch and ferment range, flocculation`],
      ['water', 'Water profiles', 'Target profiles, how to find your starting water, and the calculator that says what to add'],
      ['off', 'Off-flavors', 'What it tastes like, what causes it, how to fix it'],
      ['world', 'Beers of the world: origins', `${D.WORLD.length} old beers: what they were, what became of them, and the modern beer each one turned into`],
      ['process', 'Process notes', 'Brew day, fermentation, packaging, cleaning']
    ].map(([id, t, s]) => h('li', null, h('button', { onclick: () => go('ref', id) }, h('span', { class: 't' }, h('b', null, t), h('span', null, s)), h('span', { class: 'k' }, '\u203A'))))));
  }

  // ---------- shop ----------
  /* The shop catalog is data, not code: GitHub rebuilds catalog.json on a schedule, the app fetches it fresh at start-up and keeps the
     last good copy for offline. Missing or unreadable simply means no cart buttons. */
  let catalogReady = null;
  function loadCatalog() {
    if (catalogReady) return catalogReady;
    catalogReady = (async () => {
      try { const res = await Promise.race([fetch('catalog.json', { cache: 'no-cache' }), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
        if (res.ok) { const json = await res.json(); if (json && json.vendors) { SH.useCatalog(json); await S.set('catalogCache', json); return; } }
        else if (res.status === 404) { SH.useCatalog(null); return; } } catch (e) { /* offline or no fetch: fall through to the saved copy */ }
      const saved = await S.get('catalogCache', null); if (saved && !Object.keys(SH.CATALOG.vendors).length) SH.useCatalog(saved);
    })();
    return catalogReady;
  }
  // Affiliate tags ship with the app in tags.js (edited on GitHub), so every copy carries the same ones. Blank means no tag.
  function affTags() { const t = window.BREWLOG_TAGS || {}, out = {}; for (const k in t) if (typeof t[k] === 'string' && t[k].trim()) out[k] = t[k].trim(); return out; }
  function tagCheck() {
    const tags = affTags();
    const rows = SH.VENDORS.map(v => { const t = tags[v.id], problem = t ? SH.tagProblem(v.id, t) : '';
      return h('li', { style: 'margin:6px 0' }, h('b', null, v.name), ': ', !t ? h('span', { class: 'muted' }, 'no tag') : problem ? h('span', { style: 'color:var(--warn)' }, problem)
        : h('span', null, 'tag set. ', h('a', { href: SH.searchUrl(v.id, 'pale malt', tags), target: '_blank', rel: 'noopener' }, 'Test it with a search'))); });
    if (!window.BREWLOG_TAGS) return h('div', { class: 'lock' }, h('b', null, 'Tag check'), h('p', { class: 'small', style: 'margin-top:6px;color:var(--warn)' }, 'tags.js did not load, so no shop link carries a tag. Open it on GitHub and look for a missing quote or comma.'));
    return h('div', { class: 'lock' }, h('b', null, 'Tag check'),
      h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Tags come from tags.js in the brewlog repository. Edit that file on GitHub to add or change one; the app picks it up within about ten minutes. This box only shows when the address ends in ?tags.'),
      h('ul', { class: 'small', style: 'padding-left:18px;margin:8px 0 0' }, rows));
  }
  async function renderShop() {
    await loadCatalog();
    const list = await batchList();
    const tags = affTags();
    const region = await S.get('region', 'US');
    view.append(h('h2', null, 'Shopping list'));
    // shop for one of your batches, or straight from a style with no batch made yet
    const styleRecipe = state.sub && state.sub.startsWith('style:') ? RC.RECIPES.find(r => r.name === state.sub.slice(6)) : null;
    const shared = state.sub === 'shared' && state.shared ? state.shared : null;
    const b = styleRecipe ? Object.assign(recipeToBatch(styleRecipe, RECIPE_GAL), { id: 'style:' + styleRecipe.name }) : shared ? Object.assign({}, shared, { id: 'shared' }) : await currentBatch(list);
    if (list.length) view.append(h('div', { class: 'chips' }, list.slice(0, 8).map(x => h('button', { class: 'chip' + (!styleRecipe && !shared && b && x.id === b.id ? ' on' : ''), style: 'font-family:inherit', onclick: async () => { state.batchId = x.id; await S.set('lastBatch', x.id); go('shop'); } }, x.name || 'batch'))));
    if (shared) view.append(h('div', { class: 'note' }, h('b', { style: 'color:var(--text)' }, `Shopping for ${shared.name}, `), 'the recipe you were sent. ', h('button', { class: 'act', style: 'background:none;border:0;color:var(--amber);font:inherit;padding:0;cursor:pointer;text-decoration:underline', onclick: () => go('ref', 'shared') }, 'Back to the recipe')));
    const styleSel = sel([{ v: '', t: list.length ? 'Or start from a style\u2026' : 'Start from a style\u2026' }].concat(RC.RECIPES.filter(r => r.group !== 'Historic').map(r => ({ v: r.name, t: `${r.name}  (${r.region})` }))), styleRecipe ? styleRecipe.name : '');
    styleSel.addEventListener('change', () => go('shop', styleSel.value ? 'style:' + styleSel.value : null));
    view.append(field(list.length ? '' : 'No batch yet? Pick a style and shop for its base recipe', styleSel));
    if (styleRecipe) view.append(sizePicker(() => render()), modelToggle(IBU_MODEL, async m => { IBU_MODEL = m; await S.set('ibuModel', m); render(); }),
      h('p', { class: 'muted small', style: 'margin-top:-4px' }, `The base ${styleRecipe.name} recipe at ${RECIPE_GAL} gal and your ${EQ.efficiency}% efficiency: OG ${styleRecipe.og.toFixed(3)}, ${recipeIbu(styleRecipe).v} IBU, ${styleRecipe.abv}%. A starting point: change anything once it is a batch.`),
      h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: async () => { if (!(await needReg('save'))) return; const nb = recipeToBatch(styleRecipe, RECIPE_GAL); nb.fermentables.forEach(f => delete f.pct); nb.hops.forEach(hp => { delete hp.sized; delete hp.use; }); const id = await DB.put('batches', nb); state.batchId = id; await S.set('lastBatch', id); keepStorage(); toast('Saved as a batch'); go('batches', 'view:' + id); } }, 'Save it as a batch'),
        h('button', { class: 'btn secondary', onclick: () => go('ref', 'recipe:' + styleRecipe.name) }, 'See the full recipe')));
    if (!b) return view.append(h('div', { class: 'empty' }, 'Pick a style above for a ready-made shopping list, or create a batch and the list builds itself from your recipe.'), h('button', { class: 'btn block', onclick: () => go('batches', 'new') }, 'New batch'));
    const packs = packsFor(b);
    const shopping = SH.shoppingList(b, { yeastPacks: packs });
    if (!shopping.length) return view.append(h('div', { class: 'empty' }, 'This batch has no ingredients yet.'));
    const vendors = SH.VENDORS.filter(v => v.region === region).sort((x, y) => (SH.hasCart(y.id) ? 1 : 0) - (SH.hasCart(x.id) ? 1 : 0));   // shops that can take a whole cart come first
    const lastVendor = await S.get('shopVendor', null);
    const vendorSel = sel(vendors.map(v => ({ v: v.id, t: v.name + (SH.hasCart(v.id) ? '  \u2013 one-tap cart' : '') })), vendors.find(v => v.id === lastVendor) ? lastVendor : (vendors[0] && vendors[0].id));
    vendorSel.addEventListener('change', () => S.set('shopVendor', vendorSel.value));
    view.append(field('Shop at', vendorSel));
    const cartBox = h('div'); view.append(cartBox);
    let milled = await S.get('grainMilled', true);
    const listEl = h('div');
    const cart = (await S.get('cart:' + b.id, {})) || {};
    const extrasKey = 'extras:' + b.id; let ticked = (await S.get(extrasKey, [])) || [];
    const drawCart = () => { cartBox.innerHTML = '';
      const avail = SH.extrasFor(b).filter(e => SH.extraAvailable(vendorSel.value, e.name)); ticked = ticked.filter(n => avail.some(e => e.name === n));
      const c = SH.cartFor(vendorSel.value, b, tags, { milled, extras: ticked, yeastPacks: packs }); const vname = (SH.vendor(vendorSel.value) || {}).name || 'the shop';
      if (!c) { const can = SH.VENDORS.filter(v => v.region === region && SH.hasCart(v.id)).map(v => v.name); if (can.length) cartBox.append(h('p', { class: 'muted small' }, `${vname} cannot take a whole cart from outside. ${can.join(' and ')} can: pick ${can.length > 1 ? 'one of them' : 'it'} above for one tap.`)); return; }
      if (!c.url) return cartBox.append(h('p', { class: 'muted small' }, `Nothing on this list matched ${vname}'s catalog. Use Find on each line below.`));
      const hasGrain = c.lines.some(l => l.group === 'Fermentables' && l.packs.some(p => /mill|crush/i.test(p.title || '')));
      const millPick = h('div', { class: 'chips', role: 'group', 'aria-label': 'Grain' }, h('span', { class: 'muted small', style: 'margin-right:4px' }, 'Grain'), [[true, 'Milled'], [false, 'Unmilled (I have a mill)']].map(([val, label]) => h('button', { class: 'chip' + (milled === val ? ' on' : ''), style: 'font-family:inherit', 'aria-pressed': String(milled === val), onclick: async () => { milled = val; await S.set('grainMilled', val); drawCart(); } }, label)));
      cartBox.append(h('a', { class: 'btn block', style: 'font-size:18px;min-height:56px;text-align:center;padding:10px 18px;line-height:1.25', href: c.url, target: '_blank', rel: 'noopener' }, `Add all to cart at ${vname}${c.total !== null ? '  \u00B7  about $' + c.total.toFixed(2) : ''}`));
      // what the beer costs to drink: the cart over the pints that reach the glass
      const cps = c.total !== null && !c.missing.filter(m => m.group === 'Fermentables' || m.group === 'Hops' || m.group === 'Yeast').length ? B.costPerServing(c.total, B.packagedGal(num(b.batchGal), EQ.trubGal)) : null;
      if (cps) cartBox.append(h('p', { class: 'statline', style: 'text-align:center' }, h('b', null, `About ${B.money(cps.perPint)} a pint`), `, ${B.money(cps.perBottle)} a bottle: ${cps.pints} pints from this batch at ${vname}'s prices.`));
      if (hasGrain) cartBox.append(millPick);
      if (avail.length) { const xd = h('details', { class: 'plat' }, h('summary', null, `Brew day extras${ticked.length ? `: ${ticked.length} added` : ''}`), h('div', { class: 'body' },
        h('p', { class: 'muted small' }, 'Nothing here is added unless you check it. Most of these last many batches, so check only what you are out of.'),
        avail.map(e => { const box = h('input', { type: 'checkbox', style: 'width:24px;height:24px;min-height:24px;flex:none;padding:0;margin-top:2px' }); box.checked = ticked.includes(e.name);
          box.addEventListener('change', async () => { ticked = box.checked ? ticked.concat([e.name]) : ticked.filter(n => n !== e.name); await S.set(extrasKey, ticked); drawCart(); });
          return h('label', { style: 'display:flex;gap:12px;align-items:flex-start;padding:8px 0;cursor:pointer' }, box, h('span', null, h('b', null, e.name), e.inRecipe ? h('span', { class: 'badge', style: 'margin-left:8px' }, 'in this recipe\'s water') : null, h('span', { class: 'muted small', style: 'display:block' }, e.note))); })));
        xd.open = ticked.length > 0; cartBox.append(xd); }
      cartBox.append(h('details', { class: 'plat' }, h('summary', null, `What goes in: ${c.lines.length} item${c.lines.length === 1 ? '' : 's'}${c.missing.length ? `, ${c.missing.length} to find yourself` : ''}`), h('div', { class: 'body' },
          h('ul', null, c.lines.map(l => h('li', { class: 'small' }, `${l.item}: ${l.packs.map(p => l.unit === 'each' ? `${p.qty}` : `${p.qty} \u00D7 ${p.size} ${l.unit}`).join(' + ')}${l.unit !== 'each' && l.unit !== 'pack' && l.got > l.need ? ` (you need ${l.need} ${l.unit})` : ''}${l.cost !== null ? `, $${l.cost.toFixed(2)}` : ''}`))),
          c.missing.length ? h('p', { class: 'small' }, h('b', null, 'Not in the cart: '), c.missing.map(m => m.item).join(', '), '. Use Find on those lines below.') : null,
          packs > 1 ? h('p', { class: 'small' }, `${packs} packs of yeast: one per six gallons, doubled for lagers and for anything over 1.065. A starter from one pack does the same job.`) : null,
          h('p', { class: 'muted small' }, `Opens ${vname} with the cart filled; you check it and pay there. Prices and stock are from ${SH.CATALOG.built || 'the last catalog build'} and may have moved. The cheapest combination of pack sizes is chosen, so you may get a little more than the recipe needs; on big batches that is often a whole sack.`))));
    };
    vendorSel.addEventListener('change', drawCart); drawCart();
    const draw = () => { listEl.innerHTML = '';
      const left = shopping.filter(l => !cart[l.term]);
      listEl.append(h('p', { class: 'muted small' }, left.length ? `${shopping.length - left.length} of ${shopping.length} in the cart. "Find" opens the shop on that item; check it off once it is in your cart there.` : 'Everything is in the cart. Check out at the shop.'));
      if (left.length) listEl.append(h('div', { class: 'btns' }, h('a', { class: 'btn', href: SH.searchUrl(vendorSel.value, left[0].term, tags), target: '_blank', rel: 'noopener' }, `Find next: ${left[0].item}`)));
      const kit = SH.kitTerm(b); if (kit) listEl.append(h('div', { class: 'rec' }, h('div', { class: 't' }, h('b', null, 'Or buy it as one kit'), h('div', { class: 'meta' }, `Most shops sell ${/^[aeiou]/i.test(kit) ? 'an' : 'a'} ${kit}: one product instead of ${shopping.length} lines, though not this exact recipe`)), h('a', { class: 'act', href: SH.searchUrl(vendorSel.value, kit, tags), target: '_blank', rel: 'noopener' }, 'Look')));
      const groups = [...new Set(shopping.map(l => l.group))];
      for (const g of groups) {
        listEl.append(h('h3', null, g));
        for (const line of shopping.filter(l => l.group === g)) {
          const url = SH.searchUrl(vendorSel.value, line.term, tags);
          const tick = h('input', { type: 'checkbox', 'aria-label': 'In the cart: ' + line.item, style: 'width:24px;height:24px;margin-top:2px;flex:none' }); tick.checked = !!cart[line.term];
          tick.addEventListener('change', async () => { if (tick.checked) cart[line.term] = true; else delete cart[line.term]; await S.set('cart:' + b.id, cart); draw(); });
          listEl.append(h('div', { class: 'rec', style: cart[line.term] ? 'opacity:.55' : '' }, tick, h('div', { class: 't' }, h('b', null, `${line.qty ? line.qty + '  ' : ''}${line.item}`), line.buy ? h('div', { class: 'meta' }, line.buy) : null),
            h('a', { class: 'act', href: url, target: '_blank', rel: 'noopener' }, 'Find')));
        }
      } };
    vendorSel.addEventListener('change', draw); draw();
    view.append(listEl, h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: async () => { const text = SH.listAsText(shopping); try { await navigator.clipboard.writeText(text); toast('List copied'); } catch (e) { toast('Copy failed'); } } }, 'Copy the list'),
      h('button', { class: 'btn secondary', onclick: async () => { const text = SH.listAsText(shopping); if (navigator.share) { try { await navigator.share({ title: (b.name || 'Brew') + ' shopping list', text }); } catch (e) { /* canceled */ } } else toast('Sharing is not available here'); } }, 'Share')));
    view.append(h('p', { class: 'muted small' }, 'One-tap carts work at shops whose systems accept a filled cart from a link, and only once the catalog for that shop has been built. Everywhere else each item opens as a search and you add it there. Quantities are rounded up to what shops sell.'));
    if (SH.hasAnyTag(tags)) view.append(h('p', { class: 'muted small' }, SH.DISCLOSURE));
    view.append(bookCard());
  }
  function bookCard() {
    return h('div', { class: 'lock' }, h('b', null, BOOK.title), h('p', { class: 'small', style: 'margin-top:6px' }, BOOK.blurb),
      BOOK.url ? h('div', { class: 'btns' }, h('a', { class: 'btn', href: BOOK.url, target: '_blank', rel: 'noopener' }, 'See the log book')) : h('p', { class: 'muted small' }, 'Coming soon.'));
  }

  // ---------- a recipe someone sent ----------
  async function renderShared() {
    const b = state.shared; if (!b) return go('ref', 'styles', { replace: true });
    const est = recipeStats(b), fgEst = expectedFg(b, est), bi = batchIbu(b, est), y = yeastOf(b);
    view.append(h('p', { class: 'muted small', style: 'margin:0 0 6px' }, 'A recipe someone sent you'),
      h('div', { class: 'hero', style: 'align-items:center;margin-bottom:6px' }, glass(est.srm || 4, 34), h('div', null, h('h2', { style: 'margin:0' }, b.name), h('p', { class: 'muted', style: 'margin:2px 0 0' }, [b.style && b.style !== b.name ? b.style : null, `${b.batchGal} gal`, `${b.boilMin} min boil`, `mash ${b.mashF}F`].filter(Boolean).join(' \u00B7 ')))));
    const ro = h('div', { class: 'readout' });
    [['OG / FG', est.og > 1 ? `${est.og.toFixed(3)} / ${fgEst ? fgEst.toFixed(3) : '-'}` : '-', `at the ${b.efficiency}% mash efficiency it was written for`], [`IBU (${bi.label})`, String(bi.v || '-'), bi.other + (est.ibuDry ? `; dry hops read +${est.ibuDry} on a lab test` : '')], ['Color', `${est.srm || '-'} SRM`, ''], ['ABV', est.og > 1 && fgEst ? B.abv(est.og, fgEst) + '%' : '-', y ? `${y.name.split('/')[0].trim()} attenuates ${y.attLow} to ${y.attHigh}%` : 'assuming 75% attenuation']]
      .forEach(([l, v, n]) => ro.append(h('div', { class: 'line' }, h('span', { class: 'l' }, l, n ? h('span', { class: 'n' }, n) : null), h('span', { class: 'v' }, v))));
    view.append(ro);
    const tbl = rows => h('div', { class: 'tablewrap' }, h('table', { class: 'ref', style: 'min-width:0' }, h('tbody', null, rows.map(r => h('tr', null, h('td', { class: 'mono', style: 'width:24%' }, r[0]), h('td', null, r[1]), h('td', { class: 'mono' }, r[2] || ''))))));
    if (b.fermentables.length) view.append(h('h3', null, 'Fermentables'), tbl(b.fermentables.map(f => [`${f.lb} lb`, f.name])));
    if (b.hops.length || b.dryHops.length) view.append(h('h3', null, 'Hops'), tbl(b.hops.map(hp => [`${hp.oz} oz`, `${hp.name}${hp.alpha ? ' (' + hp.alpha + '%)' : ''}`, hp.whirlpool ? 'whirlpool' : hp.minutes === '' ? 'boil' : `${hp.minutes} min`]).concat(b.dryHops.map(d => [`${d.oz} oz`, d.name, `dry hop, ${d.days} days`]))));
    add(h('h3', null, 'Yeast and process'), h('p', null, h('b', null, b.yeast || 'No yeast named'), b.fermF ? ` \u00B7 ferment at ${b.fermF}F` : ''),
      b.salts.length ? h('p', null, h('b', null, 'Water: '), b.salts.map(x => `${x.grams} g ${x.salt.replace(/\s*\(.*\)/, '')}`).join(', ')) : null, b.notes ? h('p', { style: 'white-space:pre-wrap' }, b.notes) : null,
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { if (!(await needReg('save'))) return; const nb = Object.assign(BLANK(), JSON.parse(JSON.stringify(b)), { brewDate: today() }); const id = await DB.put('batches', nb); state.batchId = id; await S.set('lastBatch', id); keepStorage(); state.shared = null; state.sharedCode = ''; toast('Saved to your batches'); go('batches', 'view:' + id, { replace: true }); } }, 'Save to my batches'),
        h('button', { class: 'btn secondary', onclick: () => go('shop', 'shared') }, 'Shop for it')),
      h('p', { class: 'muted small' }, 'The whole recipe traveled inside the link, so nothing was uploaded and nothing is stored anywhere but your phone. Save it and you can scale it to your own system, change anything, and run it through a guided brew day.'));
  }

  // ---------- bring a recipe in: paste it, photograph it, or import a file ----------
  const IMPORT_EXAMPLE = 'Citra Pale Ale (5 gal)\n10 lb 2-row\n1 lb Crystal 40\n0.5 oz Magnum @ 60 min\n1 oz Citra @ 10 min\n2 oz Citra dry hop 5 days\nUS-05, mash at 152F';
  function renderImport() {
    const box = h('textarea', { rows: 9, placeholder: IMPORT_EXAMPLE, 'aria-label': 'The recipe', style: 'width:100%;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:var(--radius);padding:12px;font:inherit;font-size:16px;font-family:var(--mono);line-height:1.4' }); box.value = state.importText || '';
    const out = h('div'), status = h('p', { class: 'muted small' }), bar = h('div', { class: 'progress', hidden: true }, h('i'));
    const read = () => { state.importText = box.value; out.innerHTML = ''; if (!box.value.trim()) return toast('Paste or type a recipe first');
      const p = RT.parse(box.value, { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST });
      if (!p.count) return out.append(h('div', { class: 'empty' }, 'Nothing in that looked like a recipe. Each ingredient needs an amount and a unit on its line, like "10 lb pale malt" or "28 g Cascade 15 min".'));
      const draft = RT.toBatch(p, BLANK(), D.HOPS); draft._said = [p.og ? `OG ${p.og.toFixed(3)}` : '', p.ibu ? `${p.ibu} IBU` : '', p.abv ? `${p.abv}%` : ''].filter(Boolean).join(' \u00B7 ');
      const est = recipeStats(draft), unknown = p.fermentables.filter(f => !f.known).map(f => f.name).concat(p.hops.concat(p.dryHops).filter(x => !x.known).map(x => x.name)), untimed = p.hops.filter(hp => hp.minutes === '' && !hp.whirlpool).map(hp => hp.name);
      const row = (a, n, c, flag) => h('tr', null, h('td', { class: 'mono', style: 'width:24%' }, a), h('td', null, n, flag ? h('span', { class: 'badge due', style: 'margin-left:8px' }, flag) : null), h('td', { class: 'mono' }, c || ''));
      out.append(h('h3', null, 'What it read'), h('p', { class: 'muted small' }, `${p.name || 'No name found'}${p.batchGal ? ` \u00B7 ${p.batchGal} gal` : ''}${p.metric ? ' \u00B7 converted from metric' : ''}${est.og > 1 ? ` \u00B7 comes to OG ${est.og.toFixed(3)} on your system` : ''}${p.og ? ` (the recipe says ${p.og.toFixed(3)})` : ''}`),
        h('div', { class: 'tablewrap' }, h('table', { class: 'ref', style: 'min-width:0' }, h('tbody', null,
          p.fermentables.map(f => row(`${f.lb} lb`, f.name, '', f.known ? '' : 'not in the lists')),
          p.hops.map(hp => row(`${hp.oz} oz`, hp.name + (hp.alpha ? ` (${hp.alpha}%)` : ''), hp.whirlpool ? 'whirlpool' : hp.minutes === '' ? 'no time' : `${hp.minutes} min`, hp.known ? '' : 'not in the lists')),
          p.dryHops.map(d => row(`${d.oz} oz`, d.name, `dry hop, ${d.days} days`, d.known ? '' : 'not in the lists')),
          p.yeast ? row('yeast', p.yeast, p.fermF ? `${p.fermF}F` : '', p.yeastKnown ? '' : 'not in the lists') : null,
          p.salts.map(x => row(`${x.grams} g`, x.salt, 'water')), p.mashF ? row('mash', `${p.mashF}F${p.mashMin ? ' for ' + p.mashMin + ' min' : ''}`, '') : null))));
      if (unknown.length) out.append(h('p', { class: 'small' }, h('b', null, 'Not in the app\'s lists: '), unknown.join(', '), '. They are kept as typed. On the next screen pick the nearest name from the list, or the gravity and bitterness will leave them out.'));
      if (untimed.length) out.append(h('p', { class: 'small' }, h('b', null, 'No boil time found for: '), untimed.join(', '), '. Add the minutes on the next screen.'));
      if (p.unread.length) out.append(h('details', { class: 'plat' }, h('summary', null, `${p.unread.length} line${p.unread.length === 1 ? '' : 's'} it could not use`), h('div', { class: 'body' }, h('pre', { class: 'pkg' }, p.unread.join('\n')))));
      out.append(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { state.draft = draft; go('batches', 'new'); } }, 'Looks right: make it a batch')));
      out.scrollIntoView && out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const photoIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      status.textContent = 'Reading the photo\u2026 the first one takes a little longer while the reader loads.'; bar.hidden = false; bar.firstChild.style.width = '0';
      try { const cv = await fileToCanvas(f, 2200); const text = await ocr(cv, pr => { bar.firstChild.style.width = Math.round(pr * 100) + '%'; });
        if (!text.trim()) status.textContent = 'No text found on that photo. Fill the frame with the recipe, straight on, in good light.';
        else { box.value = text.trim(); status.textContent = 'This is what the reader saw. Photos are never perfect: fix any line that looks wrong, then press Read the recipe.'; read(); } }
      catch (err) { status.textContent = 'The photo reader could not load (it needs a connection the first time). Type or paste the recipe instead.'; }
      bar.hidden = true; } });
    const xmlIn = h('input', { type: 'file', accept: '.xml,.beerxml,text/xml,application/xml', hidden: true, onchange: async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { const recipes = window.BeerXML.importRecipes(await f.text(), { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }, B.matchVocab); if (!(await needReg('save'))) return;
        let lastId = null; for (const r of recipes) { r.status = 'Planned'; lastId = await DB.put('batches', r); } keepStorage(); toast(`${recipes.length} recipe${recipes.length === 1 ? '' : 's'} imported`); state.batchId = lastId; go('batches', 'edit:' + lastId, { replace: true }); }
      catch (err) { toast(err.message); } } });
    view.append(h('button', { class: 'back', onclick: () => goBack('batches') }, '\u2039 Batches'), h('h2', null, 'Bring a recipe in'),
      h('p', { class: 'muted' }, 'Paste a recipe from anywhere (a forum, an email, a brewing program\'s text export) or photograph one from a book or a kit sheet. The app picks out the grain, hops and yeast and builds a batch for you to check.'),
      box, photoIn, xmlIn, status, bar,
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: read }, 'Read the recipe'), h('button', { class: 'btn secondary', onclick: () => photoIn.click() }, 'Photograph one'),
        navigator.clipboard && navigator.clipboard.readText ? h('button', { class: 'btn secondary', onclick: async () => { try { const t = await navigator.clipboard.readText(); if (t) { box.value = t; read(); } else toast('The clipboard is empty'); } catch (e) { toast('Paste into the box instead'); } } }, 'Paste') : null,
        h('button', { class: 'btn secondary', onclick: () => xmlIn.click() }, 'Import BeerXML')),
      h('p', { class: 'muted small' }, 'Pounds, ounces, kilos and grams are all understood, and metric recipes are converted. BeerXML is the file Brewfather, BeerSmith, Brewer\'s Friend and Grainfather export.'), out);
    if (state.importText) read();
  }

  // ---------- registration ----------
  /* Registration is one small file, register.js, edited on GitHub like tags.js. With no sign-up link in it there is no registration
     and the app behaves exactly as it did before. With one, people can look around freely and are asked for a first name and an email
     when they save their first batch or install the app (or before anything else, if the file says when: 'open'). The address goes to
     the list the link points at and nowhere else; nothing about their brewing is sent. */
  const REG = (() => { const c = window.BREWLOG_REGISTER || {}, target = B.signupTarget(c.signup, c.fields), text = k => typeof c[k] === 'string' ? c[k].trim() : '';
    return { loaded: !!window.BREWLOG_REGISTER, target, on: !!target.url && !target.problem && c.when !== 'off', when: c.when === 'open' ? 'open' : 'save', perk: text('perk') || 'You will get an occasional email about new recipes, new features and the Brew Log book.',
      privacy: text('privacy'), contact: text('contact'), extra: c.extra && typeof c.extra === 'object' ? c.extra : null, askSystem: c.askSystem !== false }; })();
  async function registered() { return !REG.on || !!(await S.get('reg', null)); }
  // true once they are registered (or registration is off); false if they closed the form
  async function needReg(reason) { return (await registered()) ? true : regSheet(reason, false, false); }
  async function sendSignup(reg, target) {
    const t = target || REG.target; if (!t.url) return false;
    const body = new URLSearchParams(B.signupPairs(t, { email: reg.email, name: reg.name, system: reg.system, source: 'Brew Log ' + APP_VERSION }, REG.extra)).toString();
    // a form post to another site: the browser sends it but will not let the page read the reply, so "sent" is all that can be known
    try { await Promise.race([fetch(t.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, keepalive: true }), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 8000))]); return true; } catch (e) { return false; }
  }
  // registered with no signal: send it the next time the app opens online
  async function retrySignup() { try { const r = await S.get('reg', null); if (r && !r.sent && REG.on && navigator.onLine !== false && await sendSignup(r)) { r.sent = true; await S.set('reg', r); } } catch (e) { /* next time */ } }
  const sheets = [];
  /* A panel over the page. build(close) returns its contents. locked: no way out but through it. */
  function sheet(build, opts) {
    const o = opts || {}, wrap = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }), card = h('div', { class: 'sheet-card' });
    const close = () => { const i = sheets.indexOf(entry); if (i < 0) return; sheets.splice(i, 1); wrap.remove(); if (o.onclose) o.onclose(); }, entry = { close, locked: !!o.locked };
    for (const k of [].concat(build(close)).flat(Infinity)) if (k !== null && k !== undefined && k !== false) card.append(k.nodeType ? k : document.createTextNode(String(k)));
    wrap.append(card); if (!o.locked) wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    document.body.append(wrap); sheets.push(entry); return close;
  }
  function closeSheets() { for (const e of sheets.slice()) if (!e.locked) e.close(); }
  function regSheet(reason, locked, preview) {
    return new Promise(resolve => {
      const name = inp('', 'text', { autocomplete: 'given-name', placeholder: 'First name', 'aria-label': 'First name' }), email = inp('', 'email', { autocomplete: 'email', placeholder: 'you@example.com', inputmode: 'email', 'aria-label': 'Email' });
      const system = sel([{ v: '', t: 'Choose\u2026' }].concat(D.SYSTEMS.map(x => ({ v: x.id, t: x.name }))).concat([{ v: 'extract', t: 'Extract or partial mash on the stove' }, { v: 'other', t: 'Something else' }, { v: 'none', t: 'Not brewing yet' }]), '');
      const err = h('p', { class: 'small', role: 'alert', style: 'color:var(--warn);min-height:1.3em;margin:0 0 6px' });
      const count = RC.RECIPES.filter(r => r.group !== 'Historic').length; let done = false;
      const title = { save: 'Register to keep your batches', install: 'Register to install Brew Log', open: 'Welcome to Brew Log', settings: 'Register this copy' }[reason] || 'Register';
      const why = reason === 'open' ? `Register and it is yours, free: ${count} recipes sized to your system, a guided brew day with hop alarms, and a shopping list that fills the cart for you.` : 'It is free. Register once and Brew Log is yours: as many batches as you like, on your phone, with or without a signal.';
      const submit = async () => {
        const e = email.value.trim(), n = name.value.trim(); if (!B.validEmail(e)) { err.textContent = 'That email address does not look right.'; email.focus(); return; }
        if (preview) { done = true; close(); toast('A preview: nothing was saved or sent'); return resolve(true); }
        const sys = D.SYSTEMS.find(x => x.id === system.value), reg = { email: e, name: n, system: system.value ? system.options[system.selectedIndex].text : '', at: Date.now(), sent: false };
        await S.set('reg', reg);
        if (sys && !(await hasEquip())) await S.set('equip', Object.assign({}, EQUIP_DEFAULT, sys.eq, { name: sys.name }));
        done = true; close(); toast(n ? `Thanks, ${n}. You are registered.` : 'You are registered.'); resolve(true);
        sendSignup(reg).then(async ok => { if (ok) { reg.sent = true; await S.set('reg', reg); } });   // not waited for: the app is theirs whether or not the signal is good
      };
      const close = sheet(shut => [
        h('div', { class: 'hero', style: 'align-items:center;margin-bottom:10px' }, h('img', { src: 'icons/icon-192.png?v=2', width: 52, height: 52, alt: '', style: 'border-radius:12px;flex:none' }), h('h2', { style: 'margin:0' }, title)),
        h('p', null, why),
        h('form', { onsubmit: ev => { ev.preventDefault(); submit(); } }, field('First name', name), field('Email', email), REG.askSystem ? field('What do you brew on? (optional)', system, 'Pick one and the water volumes and boil-off are set up for that kind of system.') : null, err,
          h('button', { class: 'btn block', type: 'submit', style: 'min-height:54px;font-size:17px' }, 'Register and continue')),
        h('p', { class: 'muted small', style: 'margin-top:10px' }, REG.perk, ' Unsubscribe whenever you like. Your batches, readings and notes are not sent anywhere: they stay on this phone. ', REG.privacy ? h('a', { href: REG.privacy, target: '_blank', rel: 'noopener' }, 'Privacy') : null),
        locked ? null : h('div', { class: 'btns', style: 'justify-content:center' }, h('button', { class: 'btn secondary sm', type: 'button', onclick: shut }, reason === 'save' ? 'Not now: keep looking around' : 'Not now'))
      ], { locked, onclose: () => { if (!done) resolve(false); } });
      setTimeout(() => { try { name.focus(); } catch (e) { /* not focusable yet */ } }, 50);
    });
  }
  // brewlog/?register: what register.js says, whether the link can be used, and a way to try it
  function regCheck() {
    const t = REG.target;
    if (!REG.loaded) return h('div', { class: 'lock' }, h('b', null, 'Registration check'), h('p', { class: 'small', style: 'margin-top:6px;color:var(--warn)' }, 'register.js did not load, so registration is off. Open it on GitHub and look for a missing quote or comma.'));
    const addr = inp(`test-${Date.now().toString(36)}@example.com`, 'email'), result = h('p', { class: 'small' });
    return h('div', { class: 'lock' }, h('b', null, 'Registration check'),
      h('p', { class: 'muted small', style: 'margin-top:6px' }, 'Settings come from register.js in the brewlog repository. Edit that file on GitHub; the app picks the change up within about ten minutes. This box only shows when the address ends in ?register.'),
      h('ul', { class: 'small', style: 'padding-left:18px;margin:8px 0' },
        h('li', { style: 'margin:6px 0' }, h('b', null, 'Sign-up link: '), t.problem ? h('span', { style: 'color:var(--warn)' }, t.problem) : `${t.kind}. Sign-ups are posted to ${t.url}`),
        t.url && !t.problem ? h('li', { style: 'margin:6px 0' }, h('b', null, 'What is sent: '), ['email', 'name', 'system', 'source'].filter(k => t.map[k]).map(k => `${k === 'name' ? 'first name' : k === 'system' ? 'what they brew on' : k === 'source' ? 'the app version' : 'email'} as ${t.map[k]}`).join(', '), t.map.name ? '' : ' (no first name: the link has nowhere to put it)') : null,
        h('li', { style: 'margin:6px 0' }, h('b', null, 'When people are asked: '), REG.on ? (REG.when === 'open' ? 'before anything else, the first time the app opens' : 'when they save their first batch or press Install; everything else is open to look around') : 'never. Registration is off.')),
      t.url && !t.problem ? field('Send a test sign-up as', addr, 'A mailing-list service may refuse a made-up address: use a real one of yours for those.') : null,
      h('div', { class: 'btns' }, t.url && !t.problem ? h('button', { class: 'btn', onclick: async () => { if (!B.validEmail(addr.value)) return toast('Put an email address in the box'); result.textContent = 'Sending\u2026';
        const ok = await sendSignup({ email: addr.value.trim(), name: 'Test', system: 'Test from the app' }); result.textContent = ok ? `Sent as ${addr.value.trim()}. Look for it in your sheet or your list. If it has not arrived within a minute, the link is not right.` : 'It could not be sent. Check the connection, then the link.'; } }, 'Send a test sign-up') : null,
        h('button', { class: 'btn secondary', onclick: () => regSheet('save', false, true) }, 'See the registration screen')), result);
  }

  // ---------- backup and restore ----------
  const saveFile = file => { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove(); };
  /* Everything in one file: batches, their logs, the stock and the settings. The shop catalog is left out; it is fetched fresh anyway. */
  async function backupNow() {
    const data = { app: 'brewlog', version: APP_VERSION, exported: new Date().toISOString(), batches: await DB.all('batches'), entries: await DB.all('entries'), stock: await DB.all('stock'), kv: (await DB.all('kv')).filter(r => r && r.key !== 'catalogCache') };
    const file = new File([JSON.stringify(data)], `brew-log-backup-${today()}.json`, { type: 'application/json' }), said = `${data.batches.length} batch${data.batches.length === 1 ? '' : 'es'} backed up`;
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { try { await navigator.share({ files: [file], title: 'Brew Log backup' }); await S.set('lastBackup', Date.now()); toast(said); if (state.tab === 'batches' || state.tab === 'settings') render(); return; } catch (e) { if (e.name === 'AbortError') return; } }
    saveFile(file); await S.set('lastBackup', Date.now()); toast(said + ': keep the file somewhere safe'); if (state.tab === 'batches' || state.tab === 'settings') render();
  }
  async function applyRestore(data, replace) {
    const objs = v => (Array.isArray(v) ? v : []).filter(x => x && typeof x === 'object'), batches = objs(data.batches), entries = objs(data.entries), stock = objs(data.stock), kv = objs(data.kv).filter(r => typeof r.key === 'string');
    if (replace) { await DB.clearAll(); S.cache = {}; for (const b of batches) await DB.put('batches', b); for (const e of entries) await DB.put('entries', e); for (const x of stock) await DB.put('stock', x); for (const r of kv) await DB.put('kv', { key: r.key, value: r.value }); }
    else { const map = new Map();   // added alongside what is here: every batch gets a fresh number and its log follows it
      for (const b of batches) { const c = Object.assign({}, b); delete c.id; map.set(b.id, await DB.put('batches', c)); }
      for (const e of entries) { if (!map.has(e.batchId)) continue; const c = Object.assign({}, e, { batchId: map.get(e.batchId) }); delete c.id; await DB.put('entries', c); }
      for (const x of stock) { const c = Object.assign({}, x); delete c.id; await DB.put('stock', c); } }
    state.batchId = null; state.restore = null; goLive = null; sheetLive = null; keepStorage(); toast(`${batches.length} batch${batches.length === 1 ? '' : 'es'} restored`); go('batches');
  }
  async function renderRestore() {
    const d = state.restore, here = (await DB.all('batches')).length, n = (d.batches || []).length, when = String(d.exported || '').slice(0, 10);
    add(h('button', { class: 'back', onclick: () => { state.restore = null; goBack('settings'); } }, '\u2039 Settings'), h('h2', null, 'Restore a backup'),
      h('p', null, `This backup ${when ? 'was made on ' + B.niceDate(when) : 'has no date'}${d.version ? ' by Brew Log ' + String(d.version).slice(0, 12) : ''}. It holds ${n} batch${n === 1 ? '' : 'es'}, ${(d.entries || []).length} log entries and ${(d.stock || []).length} stock items.`),
      h('p', { class: 'muted' }, here ? `This phone has ${here} batch${here === 1 ? '' : 'es'} now.` : 'This phone has no batches yet.'),
      h('button', { class: 'btn block', onclick: () => applyRestore(d, false) }, here ? 'Add them to what is here' : 'Restore'),
      here ? h('p', { class: 'muted small' }, 'Keeps everything on this phone and adds the backup\'s batches beside it. Settings are left as they are.') : null,
      here ? h('button', { class: 'btn danger block', onclick: () => { if (confirm('Replace every batch, log entry and setting on this phone with the backup? What is here now will be gone.')) applyRestore(d, true); } }, 'Replace everything on this phone') : null,
      here ? h('p', { class: 'muted small' }, 'For moving to a new phone, or going back to an earlier state: the phone ends up exactly as the backup was, settings included.') : null,
      h('button', { class: 'btn secondary block', onclick: () => { state.restore = null; goBack('settings'); } }, 'Cancel'));
  }

  // ---------- settings ----------
  async function renderSettings() {
    if (state.sub === 'restore') { if (state.restore) return renderRestore(); return go('settings', null, { replace: true }); }
    const region = await S.get('region', 'US');
    const regionSel = sel(['US', 'UK'], region);
    regionSel.addEventListener('change', async () => { await S.set('region', regionSel.value); toast('Saved'); });
    const eq = await equip(); const ef = {};
    const mkE = (k, label, hint) => { ef[k] = inp(eq[k], k === 'name' ? 'text' : 'number'); return field(label, ef[k], hint); };
    const check = on => { const c = h('input', { type: 'checkbox', style: 'width:24px;height:24px;min-height:24px;flex:none;padding:0' }); c.checked = !!on; return c; };
    ef.noSparge = check(eq.noSparge);
    const ratio = mkE('qtPerLb', 'Mash ratio (qt per lb)', 'recirculating systems often run thinner, 1.5 to 2'), syncSparge = () => { ratio.style.opacity = ef.noSparge.checked ? 0.45 : 1; ef.qtPerLb.disabled = ef.noSparge.checked; };
    ef.noSparge.addEventListener('change', syncSparge); syncSparge();
    const preset = sel([{ v: '', t: 'Start from a typical system\u2026' }].concat(D.SYSTEMS.map(x => ({ v: x.id, t: `${x.name}: ${x.eg}` }))), '');
    preset.addEventListener('change', () => { const sys = D.SYSTEMS.find(x => x.id === preset.value); if (!sys) return; for (const k in sys.eq) if (ef[k]) { if (k === 'noSparge') ef[k].checked = !!sys.eq[k]; else ef[k].value = sys.eq[k]; } ef.name.value = sys.name; syncSparge(); toast('Filled in. Check the numbers, then Save equipment'); });
    const restoreIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { const data = JSON.parse(await f.text()); if (!data || data.app !== 'brewlog' || !Array.isArray(data.batches)) throw new Error('not a backup'); state.restore = data; go('settings', 'restore'); } catch (err) { toast('That file is not a Brew Log backup'); } } });
    const exportCsv = async () => {
      const batches = await DB.all('batches'), entries = await DB.all('entries');
      const rows = entries.map(e => { const b = batches.find(x => x.id === e.batchId) || {}; return { batch: b.name || '', date: e.date, type: e.type, detail: e.type === 'gravity' ? Number(e.sg).toFixed(3) : (e.text || ''), note: e.note || '' }; });
      saveFile(new File([B.toCsv(rows, [{ key: 'batch', label: 'Batch' }, { key: 'date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'detail', label: 'Detail' }, { key: 'note', label: 'Note' }])], `brew-log-${today()}.csv`, { type: 'text/csv' }));
    };
    const mine = await S.get('procChips', []), reg = await S.get('reg', null), lastBackup = await S.get('lastBackup', 0);
    add(h('h2', null, 'Settings'),
      TAG_CHECK ? tagCheck() : null, REG_CHECK ? regCheck() : null,
      h('h3', null, 'Equipment profile'),
      h('p', { class: 'muted small' }, 'These numbers drive the brew day sheet and new-batch defaults. Everyone\'s rig is different; put yours in once.'),
      field('', preset), mkE('name', 'System name'), h('div', { class: 'row' }, mkE('batchGal', 'Batch size (gal)'), mkE('boilGal', 'Pre-boil volume (gal)')),
      h('div', { class: 'row' }, mkE('boilMin', 'Boil length (min)'), mkE('efficiency', 'Mash efficiency %')),
      h('label', { class: 'field', style: 'display:flex;align-items:flex-start;gap:10px' }, ef.noSparge, h('span', { style: 'margin:0;color:var(--text)' }, 'No sparge: all the water goes in with the grain', h('span', { class: 'muted small', style: 'display:block' }, 'Brew in a bag, and most all-in-one brews done without a sparge. The strike water is then the pre-boil volume plus what the grain keeps.'))),
      h('div', { class: 'row' }, ratio, mkE('tunLossF', 'Strike temp loss to the tun (F)')),
      h('div', { class: 'row' }, mkE('grainTempF', 'Grain temperature (F)', 'a summer garage is nearer 85: the strike water wants to be cooler'), mkE('absorbGalLb', 'Grain absorption (gal per lb)', 'about 0.08 for a squeezed bag')),
      h('div', { class: 'row' }, mkE('boilOffGalHr', 'Boil-off (gal per hour)'), mkE('trubGal', 'Trub and kettle loss (gal)')),
      h('div', { class: 'row' }, mkE('hydroCalF', 'Hydrometer calibration (F)'), mkE('wcf', 'Refractometer correction factor', 'usually 1.02 to 1.06')),
      h('details', { class: 'plat' }, h('summary', null, 'IBU model: the conditions it assumes'), h('div', { class: 'body' },
        h('p', { class: 'small' }, 'The SMPH model predicts the IBUs a lab would measure in your finished beer, and that depends on more than the hops. The defaults suit most brewers; change only what you know.'),
        h('div', { class: 'row' }, mkE('chillMin', 'Minutes to chill below 140F', 'hops keep bittering until then; an immersion chiller is about 10, no-chill is 60 or more'), mkE('wortPh', 'Wort pH after the boil', 'untreated water about 5.6 to 5.75; treated 5.1 to 5.4. Lower pH, fewer IBUs')),
        h('div', { class: 'row' }, mkE('elevationFt', 'Elevation (ft)', 'water boils cooler higher up: about 1F per 500 ft'), mkE('ageWeeks', 'Beer age when you drink it (weeks)', 'bitterness fades for about four months')),
        (() => { ef.clarity = sel(B.SMPH_CLARITY.map(([t, v]) => ({ v: String(v), t })), String(eq.clarity)); ef.krausen = sel(B.SMPH_KRAUSEN.map(([t, v]) => ({ v: String(v), t })), String(eq.krausen)); return h('div', { class: 'row' }, field('Wort into the fermenter', ef.clarity, 'clear wort keeps more bitterness'), field('Krausen', ef.krausen, 'a blow-off tube carries bitterness away')); })(),
        (() => { const ms = sel([{ v: 'smph', t: 'SMPH: the finished beer, as a lab would measure it' }, { v: 'tinseth', t: 'Tinseth: the usual homebrew figure' }], IBU_MODEL); ms.addEventListener('change', async () => { IBU_MODEL = ms.value; await S.set('ibuModel', ms.value); toast('Saved'); }); return field('IBU figure to lead with', ms, 'Sets how the built-in recipes are hopped and the default for new batches. Each batch keeps its own choice on its recipe form.'); })(),
        h('p', { class: 'muted small' }, B.SMPH_CREDIT))),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { const out = {}; for (const k in ef) out[k] = k === 'name' ? ef[k].value.trim() : k === 'noSparge' ? ef[k].checked : num(ef[k].value); if (!out.wortPh) out.wortPh = 5.5; if (!out.chillMin) out.chillMin = 10; if (!out.clarity) out.clarity = 1; if (!out.krausen) out.krausen = 1; if (!out.grainTempF) out.grainTempF = 65; if (!out.qtPerLb) out.qtPerLb = 1.25; await S.set('equip', out); toast('Equipment saved'); } }, 'Save equipment')),
      mine.length ? h('div', null, h('h3', null, 'Your process note buttons'), h('div', { class: 'chips' }, mine.map(m => h('button', { class: 'chip', style: 'font-family:inherit', onclick: async () => { await S.set('procChips', mine.filter(x => x !== m)); toast('Removed'); render(); } }, m + '  \u00D7'))), h('p', { class: 'muted small' }, 'Tap one to remove it from the brew day buttons. Past log entries are untouched.')) : null,
      field('Shop region', regionSel),
      h('h3', null, 'Back up and restore'), restoreIn,
      h('p', { class: 'muted small' }, 'Your batches, readings, stock and settings live in this browser on this phone and nowhere else. A backup is one file: keep it in your files or email it to yourself, then restore it here or on a new phone.', lastBackup ? ` Last backup ${B.niceDate(B.isoDay(new Date(lastBackup)))}.` : ' No backup made yet.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: backupNow }, 'Back up everything'), h('button', { class: 'btn secondary', onclick: () => restoreIn.click() }, 'Restore from a backup'), h('button', { class: 'btn secondary', onclick: exportCsv }, 'Export the log as .csv')),
      REG.on || reg ? h('div', null, h('h3', null, 'Registration'), h('p', { class: 'muted small' }, reg ? `Registered as ${reg.email}.` : 'This copy is not registered yet. It is free, and it lets you save batches and install the app.'),
        REG.on ? h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: async () => { if (await regSheet('settings', false, false)) render(); } }, reg ? 'Register a different address' : 'Register')) : null) : null,
      h('h3', null, 'Your data'),
      h('p', { class: 'muted small' }, 'Batches, log entries and stock are kept in this browser on this phone. Nothing about your brewing is uploaded.', reg ? ' The name and email you registered with went to the Brew Log mailing list, and nothing else did.' : '', ' Shop links open the shop\'s own site; a photo you ask the app to read is read on the phone.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn danger', onclick: async () => { if (confirm('Delete every batch, log entry, stock item and setting on this phone? Make a backup first if you might want them back.')) { await DB.clearAll(); S.cache = {}; state.batchId = null; goLive = null; sheetLive = null; toast('Cleared'); go('batches'); } } }, 'Delete all data')),
      h('h3', null, 'About'),
      h('p', { class: 'muted small' }, `Brew Log ${APP_VERSION}. Free to use.`), h('p', { class: 'muted small' }, B.SMPH_CREDIT),
      h('div', { class: 'btns' },
        h('button', { class: 'btn secondary', onclick: async () => { const text = 'Brew Log: a free homebrew log with recipes, a guided brew day and one-tap ingredient carts.'; if (navigator.share) { try { await navigator.share({ title: 'Brew Log', text, url: APP_URL }); } catch (e) { /* canceled */ } } else { try { await navigator.clipboard.writeText(APP_URL); toast('Link copied'); } catch (e) { toast(APP_URL); } } } }, 'Tell another brewer'),
        REG.contact ? h('a', { class: 'btn secondary', href: /^https?:/i.test(REG.contact) ? REG.contact : 'mailto:' + REG.contact + '?subject=' + encodeURIComponent('Brew Log ' + APP_VERSION), target: '_blank', rel: 'noopener' }, 'Report a problem or ask for something') : null,
        h('button', { class: 'btn secondary', onclick: async () => { toast('Fetching the latest files'); try { const keys = await caches.keys(); for (const k of keys) if (k.startsWith('blog-')) await caches.delete(k); if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); } } catch (e) { /* ignore */ } location.replace(location.pathname + '?r=' + Date.now()); } }, 'Check for updates and reload')),
      bookCard());
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; if (state.tab === 'batches' && !state.sub) render(); });
  async function installApp() { if (!deferredPrompt) return; if (!(await needReg('install'))) return; const ev = deferredPrompt; deferredPrompt = null; $('#installBtn').hidden = true; try { ev.prompt(); await ev.userChoice; } catch (e) { /* dismissed */ } if (state.tab === 'batches') render(); }
  $('#installBtn').addEventListener('click', installApp);
  window.addEventListener('appinstalled', () => { deferredPrompt = null; $('#installBtn').hidden = true; });
  const pill = $('#timerPill'); if (pill) pill.addEventListener('click', () => go('brewday', goLive ? 'go' : 'sheet'));
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  (async () => {
    const r = readRoute(); if (r && !TAG_CHECK && !REG_CHECK) { state.tab = r.tab; state.sub = r.sub; }
    try { history.replaceState({ r: routeOf(state.tab, state.sub) }, ''); } catch (e) { /* no history */ }
    await resumeBrewday(); await render(); retrySignup();
    if (REG.on && REG.when === 'open' && !TAG_CHECK && !REG_CHECK && !(await S.get('reg', null))) regSheet('open', true, false);
  })();
})();
