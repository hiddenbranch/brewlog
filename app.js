/* Brew Log - app UI. Depends on core.js (BrewCore), data.js (BrewData), shop.js (BrewShop). */
(function () {
  'use strict';
  const B = window.BrewCore, D = window.BrewData, SH = window.BrewShop, RC = window.BrewRecipes;
  B.setHopRef(D.HOPS);
  const OCR_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
  const APP_VERSION = '1.5.0';
  const BOOK = { title: 'Homebrewer\'s Brew Log Book', url: '', blurb: 'The paper companion: brew day sheets, fermentation charts and recipe pages built to be photographed into this app.' };
  const CDN = { jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' };
  const STATUSES = ['Planned', 'Brewing', 'Fermenting', 'Conditioning', 'Packaged', 'Drinking', 'Finished'];
  const EQUIP_DEFAULT = { name: 'My system', batchGal: 5.5, boilGal: 7, boilMin: 60, efficiency: 72, qtPerLb: 1.25, tunLossF: 2, boilOffGalHr: 1.2, trubGal: 0.5, absorbGalLb: 0.125, wcf: 1.04, hydroCalF: 60 };
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

  const state = { tab: 'batches', sub: null, batchId: null };
  const view = $('#view');
  // DOM append does not flatten arrays, so anything built with .map() must go through this
  const add = (...kids) => { kids.flat(Infinity).forEach(k => { if (k !== null && k !== undefined && k !== false) view.append(k.nodeType ? k : document.createTextNode(String(k))); }); };
  function go(tab, sub) { state.tab = tab; state.sub = sub || null; render(); window.scrollTo(0, 0); }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.tab); });
  $('#gearBtn').addEventListener('click', () => go('settings'));
  async function render() {
    EQ = await equip();
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
    view.innerHTML = '';
    await ({ batches: renderBatches, brewday: renderBrewday, calc: renderCalc, ref: renderRef, shop: renderShop, stock: renderStock, settings: renderSettings }[state.tab])();
    const chip = $('#jobChip'); const b = state.batchId ? await DB.get('batches', state.batchId) : null;
    chip.hidden = !b; if (b) chip.textContent = b.name || ('batch ' + b.id);
  }
  const today = B.today;
  const field = (label, input, hint) => h('label', { class: 'field' }, h('span', null, label), input, hint ? h('span', { class: 'muted small' }, hint) : null);
  const sel = (opts, cur) => h('select', null, opts.map(o => h('option', { value: typeof o === 'object' ? o.v : o, selected: (typeof o === 'object' ? o.v : o) === cur ? true : false }, typeof o === 'object' ? o.t : o)));
  const inp = (v, type, extra) => h('input', Object.assign({ type: type || 'text', value: v === undefined || v === null ? '' : v, inputmode: type === 'number' ? 'decimal' : undefined, step: type === 'number' ? 'any' : undefined }, extra || {}));
  async function batchList() { const b = await DB.all('batches'); return b.sort((x, y) => (y.brewDate || '').localeCompare(x.brewDate || '') || y.id - x.id); }
  async function currentBatch(list) { if (state.batchId && list.find(b => b.id === state.batchId)) return list.find(b => b.id === state.batchId); const last = await S.get('lastBatch', null); const b = list.find(x => x.id === last) || list[0] || null; if (b) state.batchId = b.id; return b; }

  // ---------- batches ----------
  let EQ = EQUIP_DEFAULT;
  const BLANK = () => ({ name: '', style: '', brewDate: today(), batchGal: EQ.batchGal, boilGal: EQ.boilGal, boilMin: EQ.boilMin, efficiency: EQ.efficiency, og: '', fg: '', fermentables: [{ name: '', lb: '' }], hops: [{ name: '', oz: '', alpha: '', minutes: '', type: 'pellet' }], yeast: '', mashF: 152, salts: [], extras: [], notes: '', status: 'Planned' });
  async function renderBatches() {
    const list = await batchList();
    if (state.sub === 'new' || (state.sub && state.sub.startsWith('edit:'))) return batchForm(state.sub === 'new' ? null : await DB.get('batches', Number(state.sub.split(':')[1])));
    if (state.sub && state.sub.startsWith('view:')) return batchView(await DB.get('batches', Number(state.sub.split(':')[1])));
    const xmlIn = h('input', { type: 'file', accept: '.xml,.beerxml,text/xml,application/xml', hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; e.target.value = '';
      try { const recipes = window.BeerXML.importRecipes(await f.text(), { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }, B.matchVocab);
        let lastId = null; for (const r of recipes) { r.status = 'Planned'; lastId = await DB.put('batches', r); }
        toast(`${recipes.length} recipe${recipes.length === 1 ? '' : 's'} imported`); state.batchId = lastId; go('batches', 'edit:' + lastId); }
      catch (err) { toast(err.message); } } });
    view.append(h('h2', null, 'Batches'), xmlIn, h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('batches', 'new') }, 'New batch'), h('button', { class: 'btn secondary', onclick: () => xmlIn.click() }, 'Import BeerXML')));
    if (!list.length) return view.append(h('div', { class: 'empty' }, 'No batches yet. A batch holds the recipe, the brew day log and the fermentation readings.'));
    for (const b of list) {
      const est = recipeStats(b);
      view.append(h('div', { class: 'rec' }, h('span', { class: 'swatch', style: `background:${B.srmHex(est.srm || 0)}` }),
        h('div', { class: 't' }, h('b', null, b.name || 'untitled'), h('div', { class: 'meta' }, [b.style, b.brewDate, est.og ? 'OG ' + est.og.toFixed(3) : null, est.ibu ? est.ibu + ' IBU' : null, b.fg ? 'ABV ' + B.abv(num(b.og) || est.og, num(b.fg)) + '%' : null].filter(Boolean).join(' \u00B7 ')), h('div', { class: 'meta' }, b.status)),
        h('button', { class: 'act', onclick: () => go('batches', 'view:' + b.id) }, 'Open')));
    }
  }
  function recipeStats(b) {
    const gal = num(b.batchGal) || 5.5, boilGal = num(b.boilGal) || gal * 1.2;
    const ferms = (b.fermentables || []).map(f => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return { lb: num(f.lb), ppg: ref ? ref.ppg : num(f.ppg), lovibond: ref ? ref.lovibond : num(f.lovibond), extract: ref ? ref.extract : false }; });
    const og = B.ogFromGrain(ferms, gal, num(b.efficiency) / 100 || 0.72);
    const boilG = B.ogFromGrain(ferms, boilGal, num(b.efficiency) / 100 || 0.72);
    const ibu = B.ibuTinseth((b.hops || []).map(hp => ({ oz: num(hp.oz), alpha: num(hp.alpha), minutes: num(hp.minutes), type: hp.type, whirlpool: hp.whirlpool })), gal, boilG || 1.05);
    const srm = B.srm(ferms, gal);
    return { og, ibu, srm, boilG };
  }
  function batchForm(b) {
    const r = b || BLANK();
    const f = {};
    const mk = (k, label, type, extra, hint) => { f[k] = inp(r[k], type, extra); return field(label, f[k], hint); };
    const styleList = h('datalist', { id: 'styles' }, RC.RECIPES.map(s => h('option', { value: s.name })));
    f.style = inp(r.style, 'text', { list: 'styles' });
    const stats = h('div', { class: 'readout' });
    const rows = { fermentables: h('div'), hops: h('div'), salts: h('div') };
    function collect() {
      const out = Object.assign({}, r);
      for (const k in f) out[k] = f[k].value;
      out.fermentables = [...rows.fermentables.children].map(el => ({ name: $('.fname', el).value, lb: $('.flb', el).value })).filter(x => x.name || x.lb);
      out.hops = [...rows.hops.children].map(el => ({ name: $('.hname', el).value, oz: $('.hoz', el).value, alpha: $('.halpha', el).value, minutes: $('.hmin', el).value, type: $('.htype', el).value, whirlpool: $('.hwp', el).checked })).filter(x => x.name || x.oz);
      out.salts = [...rows.salts.children].map(el => ({ salt: $('.sname', el).value, grams: $('.sg', el).value })).filter(x => x.grams);
      return out;
    }
    function refresh() {
      const cur = collect(); const est = recipeStats(cur); stats.innerHTML = '';
      const styleRec = RC.RECIPES.find(r => r.name === cur.style); const style = styleRec ? { ogLow: styleRec.ranges.og[0], ogHigh: styleRec.ranges.og[1], ibuLow: styleRec.ranges.ibu[0], ibuHigh: styleRec.ranges.ibu[1], srmLow: styleRec.ranges.srm[0], srmHigh: styleRec.ranges.srm[1] } : D.STYLES.find(s => s.name === cur.style);
      const line = (l, v, inRange, n) => stats.append(h('div', { class: 'line ' + (inRange === true ? 'ok' : inRange === false ? 'bad' : '') }, h('span', { class: 'l' }, l, n ? h('span', { class: 'n' }, n) : null), h('span', { class: 'v' }, v)));
      const within = (v, lo, hi) => style && v ? (v >= lo && v <= hi) : null;
      line('Estimated OG', est.og ? est.og.toFixed(3) : '-', within(est.og, style && style.ogLow, style && style.ogHigh), style ? `style ${style.ogLow.toFixed(3)} to ${style.ogHigh.toFixed(3)}` : null);
      line('IBU (Tinseth)', est.ibu || '-', within(est.ibu, style && style.ibuLow, style && style.ibuHigh), style ? `style ${style.ibuLow} to ${style.ibuHigh}` : null);
      line('Colour (SRM)', est.srm || '-', within(est.srm, style && style.srmLow, style && style.srmHigh), style ? `style ${style.srmLow} to ${style.srmHigh}` : null);
      if (est.og) { const yeastRef = D.YEAST.find(y => y.name === cur.yeast); const att = yeastRef ? (yeastRef.attLow + yeastRef.attHigh) / 2 : 75;
        const fgEst = B.fromPoints(B.points(est.og) * (1 - att / 100));
        line('Expected FG and ABV', `${fgEst.toFixed(3)}  /  ${B.abv(est.og, fgEst)}%`, null, yeastRef ? `${yeastRef.name.split('/')[0].trim()} attenuates ${yeastRef.attLow} to ${yeastRef.attHigh}%` : 'assuming 75% attenuation'); }
      const salts = B.waterAdditions({}, collect().salts.map(s => ({ salt: s.salt, grams: num(s.grams) })), num(cur.batchGal) + 1.5);
      if (collect().salts.length) line('Sulfate : chloride', salts.ratio === null ? '-' : salts.ratio, null, B.ratioVerdict(salts.ratio));
    }
    function fermRow(v) {
      const name = inp(v.name, 'text', { class: 'fname', list: 'ferms' }), lb = inp(v.lb, 'number', { class: 'flb' });
      const row = h('div', { class: 'row', style: 'grid-template-columns:1fr 90px 44px;align-items:end' }, field('Fermentable', name), field('lb', lb), h('button', { class: 'btn secondary', style: 'min-height:48px;padding:0 12px', onclick: () => { row.remove(); refresh(); } }, '\u00D7'));
      [name, lb].forEach(i => i.addEventListener('input', refresh));
      return row;
    }
    function hopRow(v) {
      const name = inp(v.name, 'text', { class: 'hname', list: 'hops' }), oz = inp(v.oz, 'number', { class: 'hoz' }), alpha = inp(v.alpha, 'number', { class: 'halpha' }), min = inp(v.minutes, 'number', { class: 'hmin' });
      const type = sel([{ v: 'pellet', t: 'Pellet' }, { v: 'leaf', t: 'Leaf' }], v.type || 'pellet'); type.classList.add('htype');
      const wp = h('input', { type: 'checkbox', class: 'hwp' }); if (v.whirlpool) wp.checked = true;
      name.addEventListener('change', () => { const ref = D.HOPS.find(x => x.name === name.value); if (ref && !alpha.value) { alpha.value = ((ref.alphaLow + ref.alphaHigh) / 2).toFixed(1); refresh(); } });
      const row = h('div', null, h('div', { class: 'row', style: 'grid-template-columns:1fr 70px 44px;align-items:end' }, field('Hop', name), field('oz', oz), h('button', { class: 'btn secondary', style: 'min-height:48px;padding:0 12px', onclick: () => { row.remove(); refresh(); } }, '\u00D7')),
        h('div', { class: 'row3' }, field('Alpha %', alpha), field('Minutes', min), field('Form', type)),
        h('label', { class: 'field' }, h('span', null, 'Whirlpool or hop stand (roughly half utilisation)'), wp));
      [oz, alpha, min].forEach(i => i.addEventListener('input', refresh)); type.addEventListener('change', refresh); wp.addEventListener('change', refresh);
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
    const yeastList = h('datalist', { id: 'yeasts' }, D.YEAST.map(y => h('option', { value: y.name })));
    f.yeast = inp(r.yeast, 'text', { list: 'yeasts' });
    const status = sel(STATUSES, r.status || 'Planned');
    view.append(h('button', { class: 'back', onclick: () => go('batches') }, '\u2039 Batches'), h('h2', null, b ? 'Edit batch' : 'New batch'), styleList, yeastList,
      h('datalist', { id: 'ferms' }, D.FERMENTABLES.map(x => h('option', { value: x.name }))), h('datalist', { id: 'hops' }, D.HOPS.map(x => h('option', { value: x.name }))),
      mk('name', 'Name'), field('Style', f.style), h('div', { class: 'row' }, mk('brewDate', 'Brew date', 'date'), field('Status', status)),
      h('div', { class: 'row' }, mk('batchGal', 'Batch size (gal)', 'number'), mk('boilGal', 'Pre-boil volume (gal)', 'number')),
      h('div', { class: 'row3' }, mk('boilMin', 'Boil (min)', 'number'), mk('efficiency', 'Efficiency %', 'number'), mk('mashF', 'Mash temp (F)', 'number')),
      stats,
      h('h3', null, 'Fermentables'), rows.fermentables, h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => { rows.fermentables.append(fermRow({})); } }, 'Add fermentable')),
      h('h3', null, 'Hops'), rows.hops, h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => { rows.hops.append(hopRow({})); } }, 'Add hop')),
      h('h3', null, 'Yeast'), field('Yeast', f.yeast),
      h('h3', null, 'Water salts (optional)'), rows.salts, h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => { rows.salts.append(saltRow({})); } }, 'Add salt')),
      mk('notes', 'Notes'),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { const out = collect(); out.status = status.value; if (!out.name) return toast('Give the batch a name'); const id = await DB.put('batches', out); state.batchId = out.id || id; await S.set('lastBatch', state.batchId); toast(b ? 'Saved' : 'Batch created'); go('batches', 'view:' + state.batchId); } }, b ? 'Save' : 'Create batch'),
        b ? h('button', { class: 'btn danger', onclick: async () => { if (!confirm('Delete this batch and its log?')) return; for (const e of await DB.byBatch('entries', b.id)) await DB.del('entries', e.id); await DB.del('batches', b.id); state.batchId = null; go('batches'); } }, 'Delete') : null));
    refresh();
  }
  async function batchView(b) {
    if (!b) return go('batches');
    state.batchId = b.id; await S.set('lastBatch', b.id);
    const entries = (await DB.byBatch('entries', b.id)).sort((x, y) => (x.date || '').localeCompare(y.date || '') || x.id - y.id);
    const est = recipeStats(b);
    const gravity = entries.filter(e => e.type === 'gravity');
    const ferm = B.fermentationStatus(gravity.map(g => ({ date: g.date, sg: num(g.sg) })), num(b.og) || est.og || 1.05);
    view.append(h('button', { class: 'back', onclick: () => go('batches') }, '\u2039 Batches'),
      h('h2', null, h('span', { class: 'swatch', style: `background:${B.srmHex(est.srm || 0)}` }), b.name || 'untitled'),
      h('p', { class: 'muted' }, [b.style, b.brewDate, b.status].filter(Boolean).join(' \u00B7 ')));
    const readout = h('div', { class: 'readout' });
    const line = (l, v, n) => readout.append(h('div', { class: 'line' }, h('span', { class: 'l' }, l, n ? h('span', { class: 'n' }, n) : null), h('span', { class: 'v' }, v)));
    const og = num(b.og) || est.og, fg = num(b.fg) || (ferm.sg || 0);
    line('OG', b.og ? Number(b.og).toFixed(3) : (est.og ? est.og.toFixed(3) + ' est' : '-'), b.og && est.og ? `estimated ${est.og.toFixed(3)}` : null);
    line('FG', fg ? Number(fg).toFixed(3) : '-', ferm.state !== 'no readings' ? `${ferm.state}, ${ferm.attenuation}% attenuation` : null);
    if (og && fg) line('ABV', B.abv(og, fg) + '%', `${B.calories(og, fg)} calories per 12 oz`);
    line('IBU / SRM', `${est.ibu || '-'} / ${est.srm || '-'}`, og ? `BU:GU ${B.bitternessRatio(est.ibu, og)}` : null);
    if (b.og && est.og) { const eff = B.efficiency((b.fermentables || []).map(f => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return { lb: num(f.lb), ppg: ref ? ref.ppg : 0 }; }), num(b.batchGal), num(b.og)); if (eff) line('Efficiency achieved', eff + '%', `planned ${b.efficiency}%`); }
    view.append(readout);
    view.append(h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => go('brewday') }, 'Brew day'),
      h('button', { class: 'btn secondary', onclick: () => entryForm(b, 'gravity') }, 'Log gravity'),
      h('button', { class: 'btn secondary', onclick: () => entryForm(b, 'note') }, 'Log note'),
      h('button', { class: 'btn secondary', onclick: () => go('batches', 'edit:' + b.id) }, 'Edit recipe'),
      h('button', { class: 'btn secondary', onclick: () => { state.batchId = b.id; go('shop'); } }, 'Shopping list'),
      h('button', { class: 'btn secondary', onclick: () => entryForm(b, 'package') }, 'Log packaging'),
      h('button', { class: 'btn secondary', onclick: () => entryForm(b, 'tasting') }, 'Log tasting'),
      h('button', { class: 'btn secondary', onclick: async () => { const xml = window.BeerXML.exportRecipe(b, { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }); const file = new File([xml], `${(b.name || 'recipe').replace(/[^\w-]/g, '_')}.xml`, { type: 'application/xml' });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { try { await navigator.share({ title: b.name, files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
        const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove(); toast('BeerXML saved; import it in Brewfather, BeerSmith or Brewer\'s Friend'); } }, 'Export BeerXML')));
    if (gravity.length > 1) view.append(gravityChart(gravity, og));
    view.append(h('h3', null, 'Log'));
    if (!entries.length) view.append(h('div', { class: 'empty' }, 'Nothing logged yet.'));
    const LBL = { gravity: 'Gravity', step: 'Brew day', note: 'Note', package: 'Packaging', tasting: 'Tasting' };
    for (const e of entries.slice().reverse()) view.append(h('div', { class: 'rec' }, h('div', { class: 't' }, h('b', null, `${e.date}  ${LBL[e.type] || 'Note'}`),
      h('div', { class: 'meta' }, e.type === 'gravity' ? `${Number(e.sg).toFixed(3)}${e.instrument === 'brix' ? ' (from ' + e.raw + ' Brix)' : e.tempF ? ' at ' + e.tempF + 'F' : ''}${e.fermTempF ? ' \u00B7 fermenter ' + e.fermTempF + 'F' : ''}${e.note ? ' \u00B7 ' + e.note : ''}` : [e.text, e.note].filter(Boolean).join(' \u00B7 '))),
      h('button', { class: 'act', onclick: async () => { if (confirm('Delete this entry?')) { await DB.del('entries', e.id); go('batches', 'view:' + b.id); } } }, 'Delete')));
  }
  function gravityChart(gravity, og) {
    const pts = gravity.map(g => ({ d: g.date, sg: num(g.sg) })).filter(p => p.sg > 0);
    const max = Math.max(og || 0, ...pts.map(p => p.sg)), min = Math.min(...pts.map(p => p.sg)) - 0.004;
    const w = 300, hh = 120, pad = 4;
    const x = i => pad + i * (w - 2 * pad) / Math.max(1, pts.length - 1);
    const y = sg => hh - pad - (sg - min) / Math.max(0.001, max - min) * (hh - 2 * pad);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.sg).toFixed(1)}`).join(' ');
    const svg = `<svg viewBox="0 0 ${w} ${hh}" style="width:100%;height:140px;background:var(--panel);border:1px solid var(--line);border-radius:6px">
      <path d="${path}" fill="none" stroke="var(--amber)" stroke-width="2"/>
      ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.sg).toFixed(1)}" r="3" fill="var(--amber)"/>`).join('')}
    </svg>`;
    return h('div', null, h('h3', null, 'Gravity'), h('div', { html: svg }), h('p', { class: 'muted small' }, `${pts.length} readings, ${pts[0].sg.toFixed(3)} down to ${pts[pts.length - 1].sg.toFixed(3)}`));
  }
  function entryForm(b, type) {
    view.innerHTML = '';
    const date = inp(today(), 'date'), note = inp('', 'text');
    const titles = { gravity: 'Gravity reading', note: 'Note', package: 'Packaging', tasting: 'Tasting notes' };
    view.append(h('button', { class: 'back', onclick: () => go('batches', 'view:' + b.id) }, '\u2039 ' + (b.name || 'batch')), h('h2', null, titles[type]), field('Date', date));
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
        else { const ob = num(obrix.value), cb = num(cbrix.value); if (!cb) { corrected.textContent = ''; return; } const val = ob ? B.refractoFg(ob, cb, EQ.wcf) : B.brixToSgUnfermented(cb, EQ.wcf); corrected.textContent = `${ob ? 'Terrill-corrected gravity' : 'Unfermented wort gravity'}: ${val.toFixed(3)} (correction factor ${EQ.wcf})`; }
      };
      mode.addEventListener('change', () => { wrap.innerHTML = ''; wrap.append(mode.value === 'sg' ? sgRow : brixRow); update(); });
      [sg, temp, obrix, cbrix].forEach(i => i.addEventListener('input', update));
      view.append(field('Instrument', mode), wrap, corrected, field('Fermenter temp (F), optional', fermTemp), field('Note', note));
      collect = () => {
        const rec = { instrument: mode.value, note: note.value.trim() }; if (num(fermTemp.value)) rec.fermTempF = num(fermTemp.value);
        if (mode.value === 'sg') { const v = num(sg.value); if (!v) { toast('Enter the reading'); return null; } rec.raw = v; rec.sg = num(temp.value) ? B.hydrometerCorrect(v, num(temp.value), EQ.hydroCalF) : v; rec.tempF = temp.value; }
        else { const v = num(cbrix.value); if (!v) { toast('Enter the reading'); return null; } const ob = num(obrix.value); rec.raw = v; rec.sg = ob ? B.refractoFg(ob, v, EQ.wcf) : B.brixToSgUnfermented(v, EQ.wcf); if (ob) rec.obrix = ob; }
        return rec; };
    } else if (type === 'package') {
      const method = sel(['Bottles', 'Keg', 'Cans', 'Cask'], 'Bottles'), vols = inp(2.4, 'number'), temp = inp(68, 'number'), gal = inp(b.batchGal, 'number'), sugar = sel(Object.keys(B.SUGARS), Object.keys(B.SUGARS)[0]), psi = inp('', 'number');
      const calc = h('p', { class: 'muted small' });
      const update = () => { if (method.value === 'Keg') { const p = B.kegPsi(num(temp.value) || 38, num(vols.value) || 2.4); calc.textContent = `Set the regulator to about ${p} psi at ${temp.value || 38}F for ${vols.value || 2.4} volumes`; } else { const p = B.primingSugar(num(gal.value) || 5, num(temp.value) || 68, num(vols.value) || 2.4, sugar.value); calc.textContent = `${p.grams} g (${p.oz} oz) of ${sugar.value} for ${vols.value || 2.4} volumes, residual ${B.residualCo2(num(temp.value) || 68)}`; } };
      [method, vols, temp, gal, sugar].forEach(i => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', update));
      view.append(field('Method', method), h('div', { class: 'row' }, field('Target CO2 (volumes)', vols), field('Beer temp (F)', temp, 'kegs: serving temp; bottles: warmest since fermentation')), h('div', { class: 'row' }, field('Volume packaged (gal)', gal), field('Priming sugar', sugar)), calc, field('Regulator set to (psi), if kegged', psi), field('Note', note));
      update();
      collect = () => ({ method: method.value, volumes: num(vols.value), tempF: num(temp.value), gal: num(gal.value), sugar: method.value === 'Keg' ? '' : sugar.value, grams: method.value === 'Keg' ? 0 : B.primingSugar(num(gal.value) || 5, num(temp.value) || 68, num(vols.value) || 2.4, sugar.value).grams, psi: num(psi.value), note: note.value.trim(), text: `${method.value}, ${vols.value} vol${method.value === 'Keg' ? `, ${psi.value || B.kegPsi(num(temp.value) || 38, num(vols.value) || 2.4)} psi at ${temp.value}F` : `, ${B.primingSugar(num(gal.value) || 5, num(temp.value) || 68, num(vols.value) || 2.4, sugar.value).grams} g ${sugar.value}`}` });
    } else if (type === 'tasting') {
      const f = {}; const mk = k => { f[k] = inp('', 'text'); return field(k[0].toUpperCase() + k.slice(1), f[k]); };
      const score = sel(['', '1', '2', '3', '4', '5'], '');
      view.append(mk('appearance'), mk('aroma'), mk('flavour'), mk('mouthfeel'), field('Score out of 5', score), field('Would you brew it again? What changes?', note));
      collect = () => { const parts = Object.keys(f).map(k => f[k].value.trim() ? `${k}: ${f[k].value.trim()}` : null).filter(Boolean); if (!parts.length && !note.value.trim()) { toast('Write something'); return null; } return { score: score.value, text: parts.join('; ') + (score.value ? ` (${score.value}/5)` : ''), note: note.value.trim() }; };
    } else {
      const text = h('textarea'); view.append(field('Note', text));
      collect = () => { if (!text.value.trim()) { toast('Write something'); return null; } return { text: text.value.trim() }; };
    }
    view.append(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => {
      const data = collect(); if (!data) return;
      const rec = Object.assign({ batchId: b.id, type, date: date.value || today(), created: Date.now() }, data);
      await DB.put('entries', rec);
      if (type === 'package' && ['Planned', 'Brewing', 'Fermenting', 'Conditioning'].includes(b.status)) { b.status = 'Packaged'; await DB.put('batches', b); }
      if (type === 'gravity' && !b.og && rec.sg > 1.02 && b.status !== 'Packaged') { /* first reading of a fresh batch is probably the OG; leave that to the user */ }
      toast('Logged'); go('batches', 'view:' + b.id); } }, 'Save'),
      h('button', { class: 'btn secondary', onclick: () => go('batches', 'view:' + b.id) }, 'Cancel')));
  }

  // ---------- brew day ----------
  function defaultSteps(b) {
    const boil = num(b.boilMin) || 60;
    const steps = [
      { t: 'Strike water heated', at: null }, { t: 'Mash in', at: null }, { t: 'Mash out / sparge', at: null },
      { t: 'Boil starts', at: null }
    ];
    (b.hops || []).filter(hp => hp.name && hp.minutes !== '').sort((x, y) => num(y.minutes) - num(x.minutes)).forEach(hp => {
      steps.push({ t: `${hp.oz} oz ${hp.name}`, at: boil - num(hp.minutes), hop: true });
    });
    steps.push({ t: 'Flameout', at: boil }, { t: 'Chilled', at: null }, { t: 'OG taken, yeast pitched', at: null });
    return steps;
  }
  let timer = null;
  async function renderBrewday() {
    const list = await batchList(); const b = await currentBatch(list);
    if (state.sub === 'go' && b) return renderGo(b);
    clearInterval(goTimer);
    view.append(h('h2', null, 'Brew day'));
    if (!b) return view.append(h('div', { class: 'empty' }, 'Create a batch first; the brew day list is built from its recipe.'), h('button', { class: 'btn block', onclick: () => go('batches', 'new') }, 'New batch'));
    view.append(h('div', { class: 'chips' }, list.slice(0, 8).map(x => h('button', { class: 'chip' + (x.id === b.id ? ' on' : ''), style: 'font-family:inherit', onclick: async () => { state.batchId = x.id; await S.set('lastBatch', x.id); render(); } }, x.name || 'batch'))));
    const goState = await S.get('go:' + b.id, null);
    view.append(h('button', { class: 'btn block', style: 'font-size:18px;min-height:56px', onclick: () => go('brewday', 'go') }, goState ? `Continue guided brew day (step ${goState.i + 1})` : 'Go: guided brew day, start to finish'),
      h('p', { class: 'muted small' }, 'One step at a time from strike water to pitching, with timers, hop alarms and gravity checks built from this recipe and your equipment profile.'));
    const done = (await S.get('steps:' + b.id, {})) || {};
    // numbers you want in your hand on brew day
    const grainLb = (b.fermentables || []).reduce((s, f) => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return s + (ref && ref.extract ? 0 : num(f.lb)); }, 0);
    const qtLb = EQ.qtPerLb;
    const readout = h('div', { class: 'readout' });
    const line = (l, v, n) => readout.append(h('div', { class: 'line' }, h('span', { class: 'l' }, l, n ? h('span', { class: 'n' }, n) : null), h('span', { class: 'v' }, v)));
    if (grainLb) {
      line('Strike water', `${B.strikeWaterVolume(grainLb, qtLb)} gal`, `${qtLb} qt per lb over ${grainLb} lb (${EQ.name})`);
      line('Strike temp', `${B.strikeTemp(qtLb, 65, num(b.mashF) || 152, EQ.tunLossF)} F`, `grain at 65F, ${EQ.tunLossF}F for the tun`);
      line('Sparge water', `${B.spargeVolume(num(b.boilGal) || EQ.boilGal, B.strikeWaterVolume(grainLb, qtLb), grainLb, EQ.absorbGalLb)} gal`, `${EQ.absorbGalLb} gal per lb absorbed`);
      line('Expected in fermenter', `${B.postBoilToPackage(B.boilOff(num(b.boilGal) || EQ.boilGal, EQ.boilOffGalHr, num(b.boilMin) || EQ.boilMin), EQ.trubGal)} gal`, `${EQ.boilOffGalHr} gal/hr boil-off, ${EQ.trubGal} gal trub`);
    }
    line('Pre-boil target', `${b.boilGal || '-'} gal`, recipeStats(b).boilG ? `about ${recipeStats(b).boilG.toFixed(3)}` : null);
    view.append(readout);
    // timer
    const tdisp = h('div', { class: 'timer' }, '00:00');
    let start = await S.get('timerStart:' + b.id, null);
    const nextEl = h('p', { class: 'muted small', style: 'text-align:center;margin-top:-4px' });
    const boilLen = num(b.boilMin) || EQ.boilMin;
    const additions = (b.hops || []).filter(hp => hp.name && hp.minutes !== '' && !hp.whirlpool).map(hp => ({ label: `${hp.oz} oz ${hp.name}`, at: boilLen - num(hp.minutes) })).sort((x, y) => x.at - y.at);
    function tick() {
      if (!start) { tdisp.textContent = '00:00'; nextEl.textContent = additions.length ? `First addition at +${additions[0].at} min` : ''; return; }
      const s = Math.floor((Date.now() - start) / 1000); const m = s / 60;
      tdisp.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      const next = additions.find(a => a.at * 60 > s);
      if (next) { const left = next.at * 60 - s; nextEl.textContent = `Next: ${next.label} in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 60 && !tdisp._warned) { tdisp._warned = next.label; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ } } if (left > 60) tdisp._warned = null; }
      else if (m >= boilLen) nextEl.textContent = 'Boil done: flameout';
      else nextEl.textContent = `All hops in; flameout in ${Math.floor(boilLen - m)} min`;
    }
    clearInterval(timer); timer = setInterval(tick, 1000); tick();
    view.append(tdisp, nextEl, h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: async () => { start = Date.now(); await S.set('timerStart:' + b.id, start); tick(); toast('Boil timer started'); } }, 'Start boil timer'),
      h('button', { class: 'btn secondary', onclick: async () => { start = null; await S.set('timerStart:' + b.id, null); tick(); } }, 'Reset')));
    view.append(h('h3', null, 'Steps'));
    const steps = defaultSteps(b);
    steps.forEach((st, i) => {
      const key = String(i);
      const row = h('div', { class: 'step' + (done[key] ? ' done' : '') },
        h('span', { class: 'tm' }, st.at !== null && st.at !== undefined ? `+${st.at}m` : ''),
        h('span', { class: 't' }, st.t, done[key] ? h('div', { class: 'meta muted small' }, done[key]) : null),
        h('button', { class: 'act', onclick: async () => {
          if (done[key]) delete done[key]; else done[key] = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          await S.set('steps:' + b.id, done);
          if (done[key]) { await DB.put('entries', { batchId: b.id, type: 'step', date: today(), text: `${st.t} at ${done[key]}`, created: Date.now() });
            const status = /pitched/i.test(st.t) ? 'Fermenting' : (b.status === 'Planned' ? 'Brewing' : null);
            if (status && status !== b.status) { b.status = status; await DB.put('batches', b); } }
          render();
        } }, done[key] ? 'Undo' : 'Done'));
      view.append(row);
    });
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
    view.append(h('h2', null, 'Stock'));
    const photoIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: e => { if (e.target.files[0]) labelFlow(e.target.files[0]); e.target.value = ''; } });
    view.append(photoIn,
      h('div', { class: 'btns' },
        h('button', { class: 'btn', onclick: () => photoIn.click() }, 'Photograph a label'),
        h('button', { class: 'btn secondary', onclick: () => stockForm(null) }, 'Add by hand'),
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
          h('button', { class: 'act', onclick: () => stockForm(it) }, 'Edit')));
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
    view.append(h('button', { class: 'back', onclick: () => go('stock') }, '\u2039 Stock'), h('h2', null, item ? 'Edit stock' : 'Add to stock'), dl,
      field('Kind', kind), field('Name', name), h('div', { class: 'row' }, field('Amount', amount), field('Unit', unit)), field('Note', note),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { r.kind = kind.value; r.name = name.value.trim(); r.amount = amount.value; r.unit = unit.value.trim(); r.note = note.value.trim(); if (!r.name) return toast('Name it'); await DB.put('stock', r); toast('Saved'); go('stock'); } }, 'Save'),
        item ? h('button', { class: 'btn danger', onclick: async () => { await DB.del('stock', item.id); go('stock'); } }, 'Remove') : null,
        h('button', { class: 'btn secondary', onclick: () => go('stock') }, 'Cancel')));
  }
  async function labelFlow(file) {
    view.innerHTML = '';
    const cv = await fileToCanvas(file, 1500).catch(e => { toast(e.message); return null; }); if (!cv) return render();
    const bar = h('div', { class: 'progress' }, h('i')); const status = h('p', { class: 'muted small' }, 'Reading the label\u2026');
    view.append(h('h2', null, 'Label'), h('img', { class: 'preview', src: cv.toDataURL('image/jpeg', 0.6) }), status, bar);
    let text = '';
    try { text = await ocr(cv, p => { bar.firstChild.style.width = Math.round(p * 100) + '%'; }); } catch (e) { status.textContent = 'The reader could not load (offline?). Add it by hand instead.'; }
    bar.remove();
    if (!text.trim()) { status.textContent = 'No text found on that photo. Try filling the frame with the label, straight on, without glare.'; view.append(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => stockForm(null) }, 'Add by hand'), h('button', { class: 'btn secondary', onclick: () => go('stock') }, 'Back'))); return; }
    const candidates = [];
    for (const kind of ['Hop', 'Fermentable', 'Yeast']) B.matchVocab(text, VOCAB[kind](), 3).forEach(m => candidates.push({ kind, name: m.name, score: m.score }));
    candidates.sort((a, b) => b.score - a.score);
    status.textContent = candidates.length ? 'Tap the match, or add it by hand.' : 'Text read, but nothing matched the ingredient tables. Add it by hand.';
    for (const c of candidates.slice(0, 6)) view.append(h('div', { class: 'rec' }, h('div', { class: 't' }, h('b', null, c.name), h('div', { class: 'meta' }, `${c.kind} \u00B7 confidence ${c.score}`)), h('button', { class: 'act', onclick: () => stockForm(null, { kind: c.kind, name: c.name, unit: UNIT[c.kind] }) }, 'Use')));
    view.append(h('details', { class: 'plat' }, h('summary', null, 'What the reader saw'), h('div', { class: 'body' }, h('pre', { class: 'pkg' }, text))),
      h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => stockForm(null) }, 'Add by hand'), h('button', { class: 'btn secondary', onclick: () => go('stock') }, 'Back')));
  }
  async function suggestScreen(inv) {
    view.append(h('button', { class: 'back', onclick: () => go('stock') }, '\u2039 Stock'), h('h2', null, 'What can I brew?'));
    if (!inv.length) return view.append(h('div', { class: 'empty' }, 'Add some stock first and this ranks every style against what is on the shelf.'));
    const galIn = inp(5.5, 'number');
    const out = h('div');
    const draw = () => { out.innerHTML = '';
      const sug = B.suggestBrews(inv, D.STYLES, D.FERMENTABLES, D.YEAST, num(galIn.value) || 5.5);
      const can = sug.filter(s => s.canBrew), near = sug.filter(s => !s.canBrew).slice(0, 8);
      if (can.length) { out.append(h('h3', null, `Ready to brew (${can.length})`));
        for (const s of can) out.append(h('div', { class: 'rec' }, h('span', { class: 'swatch', style: 'background:' + B.srmHex((s.style.srmLow + s.style.srmHigh) / 2) }),
          h('div', { class: 't' }, h('b', null, s.style.name), h('div', { class: 'meta' }, `${s.style.abvLow} to ${s.style.abvHigh}% \u00B7 ${s.style.ibuLow} to ${s.style.ibuHigh} IBU \u00B7 ${s.style.note}`)),
          h('button', { class: 'act', onclick: async () => { const b = BLANK(); b.name = s.style.name; b.style = s.style.name; b.batchGal = num(galIn.value) || 5.5;
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
  let goTimer = null, wakeLock = null;
  function beep(times) {
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const n = times || 3;
      for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); const t = ctx.currentTime + i * 0.35; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.start(t); o.stop(t + 0.3); } } catch (e) { /* no audio */ }
    try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { /* no vibration */ }
  }
  async function notify(title, body) { try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag: 'brewday' }); } catch (e) { /* not available */ } }
  async function keepAwake() { try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* denied */ } }
  const fmtMS = s => `${String(Math.floor(Math.abs(s) / 60)).padStart(2, '0')}:${String(Math.abs(s) % 60).padStart(2, '0')}`;
  async function renderGo(b) {
    clearInterval(goTimer);
    const est = recipeStats(b);
    const grainLb = (b.fermentables || []).reduce((sum, f) => { const ref = D.FERMENTABLES.find(x => x.name === f.name); return sum + (ref && ref.extract ? 0 : num(f.lb)); }, 0);
    const plan = B.brewPlan(b, EQ, grainLb, est.boilG);
    const key = 'go:' + b.id;
    const st = (await S.get(key, null)) || { i: 0, timers: {}, fired: {}, ticked: {}, startedAt: Date.now() };
    const save = () => S.set(key, st);
    if (st.i >= plan.length) {
      view.innerHTML = ''; view.append(h('button', { class: 'back', onclick: () => go('brewday') }, '\u2039 Brew day'), h('h2', null, 'Brew day complete'),
        h('p', null, `${b.name || 'The batch'} is in the fermenter. Gravity readings from the Batches screen from here on; the fermentation state updates itself.`),
        h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('batches', 'view:' + b.id) }, 'Open the batch'), h('button', { class: 'btn secondary', onclick: async () => { await S.set(key, null); go('brewday'); } }, 'Clear this brew day')));
      return;
    }
    keepAwake();
    const step = plan[st.i]; const next = plan[st.i + 1];
    view.innerHTML = '';
    view.append(h('button', { class: 'back', onclick: () => go('brewday') }, '\u2039 Brew day'),
      h('p', { class: 'muted small' }, `Step ${st.i + 1} of ${plan.length} \u00B7 ${b.name || 'batch'}`),
      h('h2', null, step.title));
    add(h('ul', { style: 'padding-left:18px;margin:0 0 12px' }, step.detail.map(d => h('li', { style: 'margin:0 0 6px' }, d))));
    const tdisp = h('div', { class: 'timer' }, '');
    const nextEl = h('p', { class: 'muted small', style: 'text-align:center;margin-top:-4px' });
    const alarmList = h('div');
    if (step.kind === 'timer') {
      const started = st.timers[step.id];
      const tick = () => {
        if (!started) { tdisp.textContent = fmtMS(step.minutes * 60); nextEl.textContent = 'Not started'; return; }
        const el = Math.floor((Date.now() - started) / 1000); const left = step.minutes * 60 - el;
        tdisp.textContent = (left < 0 ? '+' : '') + fmtMS(left); tdisp.style.color = left < 0 ? 'var(--warn)' : '';
        const due = (step.alarms || []).filter(a => a.at * 60 <= el);
        for (const a of due) { const k = step.id + ':' + a.at; if (!st.fired[k]) { st.fired[k] = Date.now(); save(); beep(3); notify(step.title, a.label); } }
        const upcoming = (step.alarms || []).find(a => a.at * 60 > el);
        nextEl.textContent = upcoming ? `Next: ${upcoming.label} in ${fmtMS(upcoming.at * 60 - el)}` : (left > 0 ? 'No more additions; timer runs to the end' : 'Time is up');
        alarmList.querySelectorAll('[data-alarm]').forEach(row => { const k = row.dataset.alarm; row.classList.toggle('done', !!st.ticked[k]); row.querySelector('.tm').textContent = st.fired[k] ? 'now' : `+${row.dataset.at}m`; });
      };
      view.append(tdisp, nextEl);
      if (!started) view.append(h('div', { class: 'btns' }, h('button', { class: 'btn block', onclick: async () => { st.timers[step.id] = Date.now(); await save(); await DB.put('entries', { batchId: b.id, type: 'step', date: today(), text: `${step.title} started ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, created: Date.now() }); if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { /* ignore */ } } renderGo(b); } }, `Start ${step.minutes}-minute timer`)));
      for (const a of step.alarms || []) { const k = step.id + ':' + a.at;
        alarmList.append(h('div', { class: 'step' + (st.ticked[k] ? ' done' : ''), 'data-alarm': k, 'data-at': a.at }, h('span', { class: 'tm' }, `+${a.at}m`), h('span', { class: 't' }, a.label),
          h('button', { class: 'act', onclick: async () => { st.ticked[k] = !st.ticked[k]; await save(); if (st.ticked[k]) await DB.put('entries', { batchId: b.id, type: 'step', date: today(), text: `${a.label} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, created: Date.now() }); renderGo(b); } }, st.ticked[k] ? 'Undo' : 'Done'))); }
      view.append(alarmList);
      goTimer = setInterval(tick, 1000); tick();
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
      view.append(h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { const v = num(sg.value); if (v) { const c = num(temp.value) ? B.hydrometerCorrect(v, num(temp.value), EQ.hydroCalF) : v; await DB.put('entries', { batchId: b.id, type: 'gravity', date: today(), sg: c, raw: v, tempF: temp.value, instrument: 'sg', note: `${step.id === 'og' ? 'OG' : 'Pre-boil'}${vol.value ? ', ' + vol.value + ' gal' : ''}`, created: Date.now() }); if (step.id === 'og') { b.og = c; await DB.put('batches', b); } } st.i++; await save(); renderGo(b); } }, sg.value ? 'Log and continue' : 'Continue'),
        h('button', { class: 'btn secondary', onclick: async () => { st.i++; await save(); renderGo(b); } }, 'Skip')));
    } else {
      view.append(h('div', { class: 'btns' },
        h('button', { class: 'btn', onclick: async () => { await DB.put('entries', { batchId: b.id, type: 'step', date: today(), text: `${step.done} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, created: Date.now() });
          if (step.id === 'pitch') { b.status = 'Fermenting'; await DB.put('batches', b); } else if (b.status === 'Planned') { b.status = 'Brewing'; await DB.put('batches', b); }
          st.i++; await save(); renderGo(b); } }, step.done),
        step.optional ? h('button', { class: 'btn secondary', onclick: async () => { st.i++; await save(); renderGo(b); } }, 'Skip') : null,
        st.i > 0 ? h('button', { class: 'btn secondary', onclick: async () => { st.i--; await save(); renderGo(b); } }, 'Back') : null));
    }
    if (next) view.append(h('div', { class: 'note' }, h('b', null, 'Next: '), next.title, next.kind === 'timer' ? ` (${next.minutes} min)` : ''));
    view.append(h('p', { class: 'muted small' }, 'Timers keep running if the phone locks or the app closes; reopen and the countdown is where it should be. Every step and addition is timestamped into the batch log.'));
  }

  // ---------- calculators ----------
  const CALCS = [
    { id: 'abv', title: 'ABV and attenuation', fields: [{ k: 'og', l: 'OG', v: 1.050 }, { k: 'fg', l: 'FG', v: 1.010 }],
      out: v => [{ l: 'ABV', v: B.abv(v.og, v.fg) + '%', n: `simple formula ${B.abv(v.og, v.fg, 'simple')}%` }, { l: 'Apparent attenuation', v: B.attenuationApparent(v.og, v.fg) + '%', n: `real ${B.attenuationReal(v.og, v.fg)}%` }, { l: 'Calories', v: B.calories(v.og, v.fg) + ' per 12 oz' }] },
    { id: 'hydro', title: 'Hydrometer temperature correction', fields: [{ k: 'r', l: 'Reading', v: 1.050 }, { k: 't', l: 'Sample temp (F)', v: 80 }, { k: 'c', l: 'Calibrated at (F)', v: 60 }],
      out: v => [{ l: 'Corrected gravity', v: B.hydrometerCorrect(v.r, v.t, v.c).toFixed(4), n: v.t > v.c ? 'warm sample reads low' : 'cold sample reads high' }] },
    { id: 'refract', title: 'Refractometer', fields: [{ k: 'ob', l: 'Original Brix', v: 12 }, { k: 'fb', l: 'Current Brix', v: 6.5 }, { k: 'wcf', l: 'Wort correction factor', v: 1.04 }],
      out: v => { const og = B.brixToSgUnfermented(v.ob, v.wcf), fg = B.refractoFg(v.ob, v.fb, v.wcf); return [{ l: 'OG', v: og.toFixed(3) }, { l: 'Current gravity', v: fg.toFixed(3), n: 'Terrill correction for alcohol' }, { l: 'ABV so far', v: B.abv(og, fg) + '%' }]; } },
    { id: 'strike', title: 'Strike and infusion', fields: [{ k: 'lb', l: 'Grain (lb)', v: 11 }, { k: 'r', l: 'Ratio (qt per lb)', v: 1.25 }, { k: 'gt', l: 'Grain temp (F)', v: 65 }, { k: 'mt', l: 'Target mash (F)', v: 152 }, { k: 'loss', l: 'Tun loss (F)', v: 2 }],
      out: v => [{ l: 'Strike temp', v: B.strikeTemp(v.r, v.gt, v.mt, v.loss) + ' F' }, { l: 'Strike volume', v: B.strikeWaterVolume(v.lb, v.r) + ' gal', n: `${B.round.r1(v.lb * v.r)} quarts` }, { l: 'Grain absorbs', v: B.grainAbsorption(v.lb) + ' gal' }, { l: 'Mash thickness', v: B.mashThickness(v.lb * v.r, v.lb) + ' qt/lb' }] },
    { id: 'infusion', title: 'Infusion step', fields: [{ k: 'cur', l: 'Current mash (F)', v: 152 }, { k: 'tgt', l: 'Target (F)', v: 168 }, { k: 'lb', l: 'Grain (lb)', v: 11 }, { k: 'qt', l: 'Mash water (qt)', v: 13.75 }, { k: 'wf', l: 'Infusion water (F)', v: 212 }],
      out: v => [{ l: 'Add', v: B.infusionVolume(v.cur, v.tgt, v.lb, v.qt, v.wf) + ' qt', n: 'boiling water is the usual choice' }] },
    { id: 'volume', title: 'Volume and gravity', fields: [{ k: 'sg', l: 'Gravity now', v: 1.060 }, { k: 'vol', l: 'Volume now (gal)', v: 5 }, { k: 'target', l: 'Target gravity', v: 1.050 }, { k: 'boil', l: 'Boil-off rate (gal/hr)', v: 1.2 }, { k: 'min', l: 'Boil time (min)', v: 60 }],
      out: v => [{ l: 'Water to add', v: B.waterToHitGravity(v.sg, v.vol, v.target) + ' gal', n: 'to dilute down to the target' }, { l: 'After the boil', v: `${B.boilOff(v.vol, v.boil, v.min)} gal at ${B.gravityAtVolume(v.sg, v.vol, B.boilOff(v.vol, v.boil, v.min)).toFixed(3)}` }, { l: 'Into the fermenter', v: B.postBoilToPackage(B.boilOff(v.vol, v.boil, v.min), 0.5) + ' gal', n: '4% cooling shrinkage, half a gallon of trub' }] },
    { id: 'ibu', title: 'IBU for one addition', fields: [{ k: 'oz', l: 'Hops (oz)', v: 1 }, { k: 'aa', l: 'Alpha acid %', v: 12 }, { k: 'min', l: 'Boil minutes', v: 60 }, { k: 'gal', l: 'Batch (gal)', v: 5.5 }, { k: 'bg', l: 'Boil gravity', v: 1.055 }],
      out: v => [{ l: 'IBU, pellets', v: B.ibuTinseth([{ oz: v.oz, alpha: v.aa, minutes: v.min, type: 'pellet' }], v.gal, v.bg) }, { l: 'IBU, leaf', v: B.ibuTinseth([{ oz: v.oz, alpha: v.aa, minutes: v.min, type: 'leaf' }], v.gal, v.bg), n: 'Tinseth; a model, not a measurement' }, { l: 'Utilisation', v: (B.tinsethUtilization(v.bg, v.min) * 100).toFixed(1) + '%' }] },
    { id: 'prime', title: 'Priming sugar', fields: [{ k: 'gal', l: 'Beer (gal)', v: 5 }, { k: 'temp', l: 'Highest temp since fermentation (F)', v: 68 }, { k: 'vol', l: 'Target CO2 volumes', v: 2.4 }],
      out: v => Object.keys(B.SUGARS).map(s => { const p = B.primingSugar(v.gal, v.temp, v.vol, s); return { l: s, v: `${p.grams} g`, n: `${p.oz} oz` }; }).concat([{ l: 'Residual CO2 in the beer', v: B.residualCo2(v.temp) + ' volumes', n: 'use the warmest it has been since fermentation ended' }]) },
    { id: 'keg', title: 'Keg carbonation', fields: [{ k: 'temp', l: 'Serving temp (F)', v: 38 }, { k: 'vol', l: 'Target CO2 volumes', v: 2.4 }, { k: 'psi', l: 'Or: set pressure (psi)', v: 12 }],
      out: v => [{ l: 'Set regulator to', v: B.kegPsi(v.temp, v.vol) + ' psi', n: `${B.psiToBar(B.kegPsi(v.temp, v.vol))} bar; a week to equilibrate` }, { l: `At ${v.psi} psi you get`, v: B.volumesAtPsi(v.temp, v.psi) + ' volumes' }] },
    { id: 'yeast', title: 'Pitch rate and starter', fields: [{ k: 'gal', l: 'Batch (gal)', v: 5.5 }, { k: 'og', l: 'OG', v: 1.055 }, { k: 'rate', l: 'Rate (M cells/ml/degP)', v: 0.75 }, { k: 'cells', l: 'Cells in the pack (billion)', v: 100 }, { k: 'months', l: 'Pack age (months)', v: 2 }, { k: 'starter', l: 'Starter size (L)', v: 2 }],
      out: v => { const need = B.cellsNeeded(v.gal, v.og, v.rate); const viable = B.yeastViability(v.cells, v.months); const grown = B.starterGrowth(viable, v.starter);
        return [{ l: 'Cells needed', v: need + ' billion', n: '0.75 ale, 1.5 lager' }, { l: 'Viable in the pack', v: viable + ' billion', n: `${v.months} months old` }, { l: `After a ${v.starter} L starter`, v: grown + ' billion', n: `${B.starterDme(v.starter)} g DME`, tone: grown >= need ? 'ok' : 'bad' }, { l: 'Verdict', v: grown >= need ? 'enough' : 'short: bigger starter or another pack', tone: grown >= need ? 'ok' : 'bad' }]; } },
    { id: 'water', title: 'Water salts', fields: [{ k: 'gal', l: 'Total water (gal)', v: 7 }, { k: 'gyp', l: 'Gypsum (g)', v: 4 }, { k: 'cacl', l: 'Calcium chloride (g)', v: 2 }, { k: 'eps', l: 'Epsom (g)', v: 0 }, { k: 'salt', l: 'Table salt (g)', v: 0 }, { k: 'soda', l: 'Baking soda (g)', v: 0 }],
      out: v => { const w = B.waterAdditions({}, [{ salt: 'Gypsum (CaSO4)', grams: v.gyp }, { salt: 'Calcium chloride (CaCl2)', grams: v.cacl }, { salt: 'Epsom salt (MgSO4)', grams: v.eps }, { salt: 'Table salt (NaCl)', grams: v.salt }, { salt: 'Baking soda (NaHCO3)', grams: v.soda }], v.gal);
        return [{ l: 'Calcium', v: w.Ca + ' ppm', n: 'aim 50 to 150' }, { l: 'Sulfate', v: w.SO4 + ' ppm' }, { l: 'Chloride', v: w.Cl + ' ppm' }, { l: 'Sodium / magnesium', v: `${w.Na} / ${w.Mg} ppm` }, { l: 'Sulfate : chloride', v: w.ratio === null ? '-' : w.ratio, n: B.ratioVerdict(w.ratio) }]; } },
    { id: 'convert', title: 'Conversions', fields: [{ k: 'sg', l: 'Specific gravity', v: 1.048 }, { k: 'p', l: 'Plato', v: 12 }, { k: 'f', l: 'Fahrenheit', v: 152 }, { k: 'gal', l: 'Gallons', v: 5.5 }, { k: 'lb', l: 'Pounds', v: 11 }],
      out: v => [{ l: `${v.sg} SG`, v: B.sgToPlato(v.sg) + ' °P' }, { l: `${v.p} °P`, v: B.platoToSg(v.p).toFixed(4) + ' SG' }, { l: `${v.f} F`, v: B.fToC(v.f) + ' C' }, { l: `${v.gal} gal`, v: B.galToL(v.gal) + ' L' }, { l: `${v.lb} lb`, v: B.lbToKg(v.lb) + ' kg' }] }
  ];
  const calcVals = {};
  async function renderCalc() {
    if (!state.sub) return view.append(h('h2', null, 'Calculators'), h('ul', { class: 'list' }, CALCS.map(c => h('li', null, h('button', { onclick: () => go('calc', c.id) }, h('span', { class: 't' }, h('b', null, c.title)), h('span', { class: 'k' }, '\u203A'))))));
    const c = CALCS.find(x => x.id === state.sub); if (!c) return go('calc');
    const vals = calcVals[c.id] || (calcVals[c.id] = Object.fromEntries(c.fields.map(f => [f.k, f.v])));
    const readout = h('div', { class: 'readout' });
    const update = () => { readout.innerHTML = ''; const v = {}; for (const f of c.fields) v[f.k] = num(vals[f.k]);
      let res; try { res = c.out(v); } catch (e) { res = [{ l: 'Check the inputs', v: '-', tone: 'bad' }]; }
      for (const r of res) readout.append(h('div', { class: 'line ' + (r.tone || '') }, h('span', { class: 'l' }, r.l, r.n ? h('span', { class: 'n' }, r.n) : null), h('span', { class: 'v' }, r.v))); };
    view.append(h('button', { class: 'back', onclick: () => go('calc') }, '\u2039 Calculators'), h('h2', null, c.title), readout,
      h('div', null, c.fields.map(f => field(f.l, inp(vals[f.k], 'number', { oninput: e => { vals[f.k] = e.target.value; update(); } })))));
    update();
  }

  // ---------- reference ----------
  async function renderRef() {
    const sub = state.sub;
    const back = h('button', { class: 'back', onclick: () => go('ref') }, '\u2039 Reference');
    if (sub === 'hops') {
      const q = inp('', 'search', { placeholder: `search ${D.HOPS.length} hops` });
      const genre = sel(['All genres'].concat(D.HOP_GENRES), 'All genres');
      const use = sel([{ v: 'All', t: 'Any use' }, { v: 'B', t: 'Bittering' }, { v: 'A', t: 'Aroma' }, { v: 'D', t: 'Dual' }], 'All');
      const out = h('div');
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        const list = D.HOPS.filter(x => (!t || x.name.toLowerCase().includes(t) || x.flavour.toLowerCase().includes(t) || x.genre.toLowerCase().includes(t))
          && (genre.value === 'All genres' || x.genre === genre.value) && (use.value === 'All' || x.use === use.value));
        if (!list.length) return out.append(h('div', { class: 'empty' }, 'No hop matches that.'));
        const groups = genre.value === 'All genres' ? D.HOP_GENRES : [genre.value];
        for (const g of groups) {
          const inG = list.filter(x => x.genre === g); if (!inG.length) continue;
          out.append(h('h3', null, g, h('span', { class: 'muted small' }, `  ${inG.length}`)));
          out.append(h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('thead', null, h('tr', null, ['Hop', 'Alpha %', 'Use', 'Flavour', 'Substitutes'].map(x => h('th', null, x)))),
            h('tbody', null, inG.map(x => h('tr', null, h('td', null, x.name), h('td', { class: 'mono' }, `${x.alphaLow} to ${x.alphaHigh}`), h('td', null, { B: 'Bittering', A: 'Aroma', D: 'Dual' }[x.use]), h('td', null, x.flavour), h('td', null, x.subs)))))));
        } };
      [q, genre, use].forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', draw));
      view.append(back, h('h2', null, 'Hops'), field('Search', q), h('div', { class: 'row' }, field('Genre', genre), field('Use', use)), out); draw(); return;
    }
    if (sub === 'styles' || (sub && sub.startsWith('recipe:'))) {
      if (sub.startsWith('recipe:')) {
        const r = RC.RECIPES.find(x => x.name === sub.slice(7)); if (!r) return go('ref', 'recipes');
        view.append(h('button', { class: 'back', onclick: () => go('ref', r.group === 'Historic' ? 'world' : 'styles') }, r.group === 'Historic' ? '\u2039 Beers of the world' : '\u2039 Styles'),
          h('h2', null, h('span', { class: 'swatch', style: 'background:' + B.srmHex(r.srm) }), r.name),
          h('p', { class: 'muted' }, `${r.region} \u00B7 ${r.group} \u00B7 ${r.gallons} gal, ${r.boilMin} min boil, ${r.efficiency}% efficiency`));
        const ro = h('div', { class: 'readout' });
        [['OG / FG', `${r.og.toFixed(3)} / ${r.fg.toFixed(3)}`, `style ${r.ranges.og[0].toFixed(3)} to ${r.ranges.og[1].toFixed(3)}`], ['IBU', String(r.ibu), `style ${r.ranges.ibu[0]} to ${r.ranges.ibu[1]}`], ['Colour', `${r.srm} SRM`, `style ${r.ranges.srm[0]} to ${r.ranges.srm[1]}`], ['ABV', `${r.abv}%`, `style ${r.ranges.abv[0]} to ${r.ranges.abv[1]}`]]
          .forEach(([l, v, n]) => ro.append(h('div', { class: 'line' }, h('span', { class: 'l' }, l, h('span', { class: 'n' }, n)), h('span', { class: 'v' }, v))));
        view.append(ro);
        view.append(h('h3', null, 'Fermentables'), h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('tbody', null, r.fermentables.map(f => h('tr', null, h('td', { class: 'mono', style: 'width:22%' }, `${f.lb} lb`), h('td', null, f.name), h('td', { class: 'mono' }, `${f.pct}%`)))))));
        if (r.hops.length) view.append(h('h3', null, 'Hops'), h('div', { class: 'tablewrap' }, h('table', { class: 'ref' }, h('tbody', null, r.hops.map(hp => h('tr', null, h('td', { class: 'mono', style: 'width:22%' }, `${hp.oz} oz`), h('td', null, `${hp.name} (${hp.alpha}%)`), h('td', { class: 'mono' }, hp.use === 'Dry hop' ? `dry hop, ${hp.dryDays} days` : hp.use === 'Whirlpool' ? 'whirlpool' : `${hp.minutes} min`)))))));
        else view.append(h('p', { class: 'muted small' }, 'No hops: see the notes for what bitters it.'));
        view.append(h('h3', null, 'Yeast and process'),
          h('p', null, h('b', null, r.yeast), ` \u00B7 pitch and ferment at ${r.fermF}F (strain range ${r.yeastRange[0]} to ${r.yeastRange[1]}F)`),
          h('p', null, h('b', null, 'Mash '), `${r.mashF}F for 60 minutes. `, h('b', null, 'Water: '), r.water),
          h('p', null, r.notes),
          h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => {
            const b = BLANK(); b.name = r.name; b.style = D.STYLES.find(s => s.name === r.name) ? r.name : (r.group === 'IPA' ? 'American IPA' : ''); b.style = r.name; b.batchGal = r.gallons; b.boilGal = r.boilGallons; b.boilMin = r.boilMin; b.efficiency = r.efficiency; b.mashF = r.mashF;
            b.fermentables = r.fermentables.map(f => ({ name: f.name, lb: f.lb }));
            b.hops = r.hops.filter(hp => hp.use !== 'Dry hop').map(hp => ({ name: hp.name, oz: hp.oz, alpha: hp.alpha, minutes: hp.minutes, type: 'pellet', whirlpool: hp.use === 'Whirlpool' }));
            b.extras = r.hops.filter(hp => hp.use === 'Dry hop').map(hp => `Dry hop: ${hp.oz} oz ${hp.name}, ${hp.dryDays} days`);
            b.yeast = r.yeast; b.notes = `${r.water}. ${r.notes}`;
            const id = await DB.put('batches', b); state.batchId = id; await S.set('lastBatch', id); toast('Batch created from the recipe'); go('batches', 'view:' + id); } }, 'Brew this'),
            h('button', { class: 'btn secondary', onclick: () => go('ref', r.group === 'Historic' ? 'world' : 'styles') }, 'Back')),
          h('p', { class: 'muted small' }, 'A generic, sensible version of the style sized to 5 gallons at 72% efficiency and checked against the style ranges. Scale the batch size on the recipe form after "Brew this" and everything recalculates.'));
        return;
      }
      const MODERN = RC.RECIPES.filter(r => r.group !== 'Historic'); const MREG = [...new Set(MODERN.map(r => r.region))];
      const q = inp('', 'search', { placeholder: `search ${MODERN.length} styles` });
      const region = sel(['All regions'].concat(MREG), 'All regions');
      const strength = sel([{ v: 'all', t: 'Any strength' }, { v: 'low', t: 'Under 4.5%' }, { v: 'mid', t: '4.5 to 6.5%' }, { v: 'high', t: 'Over 6.5%' }], 'all');
      const out = h('div');
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        const list = MODERN.filter(r => (!t || r.name.toLowerCase().includes(t) || r.group.toLowerCase().includes(t) || r.region.toLowerCase().includes(t))
          && (region.value === 'All regions' || r.region === region.value)
          && (strength.value === 'all' || (strength.value === 'low' && r.abv < 4.5) || (strength.value === 'mid' && r.abv >= 4.5 && r.abv <= 6.5) || (strength.value === 'high' && r.abv > 6.5)));
        if (!list.length) return out.append(h('div', { class: 'empty' }, 'No recipe matches that.'));
        const regions = region.value === 'All regions' ? MREG : [region.value];
        for (const rg of regions) { const inR = list.filter(r => r.region === rg); if (!inR.length) continue;
          out.append(h('h3', null, rg, h('span', { class: 'muted small' }, `  ${inR.length}`)));
          for (const r of inR) out.append(h('div', { class: 'rec' }, h('span', { class: 'swatch', style: 'background:' + B.srmHex(r.srm) }),
            h('div', { class: 't' }, h('b', null, r.name), h('div', { class: 'meta' }, `${r.og.toFixed(3)} \u00B7 ${r.ibu} IBU \u00B7 ${r.srm} SRM \u00B7 ${r.abv}% \u00B7 ${r.yeast.split('/')[0].trim()}`)),
            h('button', { class: 'act', onclick: () => go('ref', 'recipe:' + r.name) }, 'Open'))); } };
      [q, region, strength].forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', draw));
      view.append(back, h('h2', null, 'Styles and recipes'), field('Search', q), h('div', { class: 'row' }, field('Region', region), field('Strength', strength)), out,
        h('p', { class: 'muted small' }, 'Each style shows its published ranges and a generic 5-gallon recipe sized to the middle of them by the same math as the calculators. Starting points, not award winners. Historical beers are under Beers of the world.'));
      draw(); return;
    }
    if (sub === 'world') {
      const q = inp('', 'search', { placeholder: `search ${D.WORLD.length} beers` });
      const era = sel(['All eras'].concat(D.WORLD_ERAS), 'All eras');
      const strength = sel([{ v: 'all', t: 'Any strength' }, { v: 'low', t: 'Under 4%' }, { v: 'mid', t: '4 to 7%' }, { v: 'high', t: 'Over 7%' }], 'all');
      const bitter = sel([{ v: 'all', t: 'Any bitterness' }, { v: 'low', t: 'Under 15 IBU' }, { v: 'mid', t: '15 to 40 IBU' }, { v: 'high', t: 'Over 40 IBU' }], 'all');
      const sort = sel([{ v: 'year', t: 'Oldest first' }, { v: 'abv', t: 'Strongest first' }, { v: 'name', t: 'A to Z' }], 'year');
      const out = h('div');
      const draw = () => { out.innerHTML = ''; const t = q.value.toLowerCase();
        let list = D.WORLD.filter(w => (!t || w.name.toLowerCase().includes(t) || w.region.toLowerCase().includes(t) || w.note.toLowerCase().includes(t) || w.key.toLowerCase().includes(t))
          && (era.value === 'All eras' || w.era === era.value)
          && (strength.value === 'all' || (strength.value === 'low' && w.abvHigh < 4) || (strength.value === 'mid' && w.abvLow >= 3 && w.abvLow <= 7) || (strength.value === 'high' && w.abvHigh > 7))
          && (bitter.value === 'all' || (bitter.value === 'low' && w.ibuHigh < 15) || (bitter.value === 'mid' && w.ibuHigh >= 15 && w.ibuLow <= 40) || (bitter.value === 'high' && w.ibuHigh > 40)));
        list = list.sort(sort.value === 'year' ? (a, b) => a.year - b.year : sort.value === 'abv' ? (a, b) => b.abvHigh - a.abvHigh : (a, b) => a.name.localeCompare(b.name));
        if (!list.length) return out.append(h('div', { class: 'empty' }, 'Nothing matches those filters.'));
        for (const w of list) {
          const when = w.year < 0 ? `about ${Math.abs(w.year)} BC` : `about ${w.year} AD`;
          out.append(h('details', { class: 'plat' }, h('summary', null, w.name),
            h('div', { class: 'body' },
              h('p', { class: 'muted small' }, `${w.era} \u00B7 ${w.region} \u00B7 ${when} \u00B7 ${w.abvLow} to ${w.abvHigh}% \u00B7 ${w.ibuLow} to ${w.ibuHigh} IBU`),
              h('p', null, w.note),
              h('p', null, h('b', null, 'What makes it: '), w.key),
              (() => { const stem = w.name.toLowerCase().split(' (')[0].slice(0, 8); const rec = RC.RECIPES.find(r => r.name.toLowerCase().startsWith(stem)); if (!rec) return h('p', { class: 'muted small' }, 'No reconstruction: the original method does not translate to a home kettle.');
                return h('div', null, h('h4', { style: 'margin:10px 0 4px;font-size:13px' }, `Brew it: ${rec.og.toFixed(3)} \u00B7 ${rec.ibu} IBU \u00B7 ${rec.abv}%`),
                  h('p', { class: 'small', style: 'margin:0 0 4px' }, rec.fermentables.map(f => `${f.lb} lb ${f.name}`).join(', ')),
                  rec.hops.length ? h('p', { class: 'small', style: 'margin:0 0 4px' }, rec.hops.map(hp => `${hp.oz} oz ${hp.name} ${hp.use === 'Dry hop' ? 'dry' : hp.use === 'Whirlpool' ? 'whirlpool' : hp.minutes + ' min'}`).join(', ')) : null,
                  h('p', { class: 'small', style: 'margin:0 0 6px' }, `${rec.yeast}, mash ${rec.mashF}F, ferment ${rec.fermF}F`),
                  h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: () => go('ref', 'recipe:' + rec.name) }, 'Full recipe and Brew this'))); })())));
        } };
      [q, era, strength, bitter, sort].forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', draw));
      view.append(back, h('h2', null, 'Beers of the world'), field('Search', q),
        h('div', { class: 'row' }, field('Era', era), field('Sort', sort)),
        h('div', { class: 'row' }, field('Strength', strength), field('Bitterness', bitter)), out,
        h('p', { class: 'muted small' }, 'Ancient entries are modern reconstructions: nobody recorded gravities or bitterness at the time. Figures are what you would aim at to brew something in that spirit today.'));
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
        h('p', { class: 'muted small' }, 'Figures in ppm. Build from RO or distilled water rather than trying to match a city profile out of the tap. Burton is famous and almost never copied in full.'));
      return;
    }
    if (sub === 'off') {
      view.append(back, h('h2', null, 'Off-flavours'));
      for (const o of D.OFF_FLAVOURS) view.append(h('details', { class: 'plat' }, h('summary', null, o.taste), h('div', { class: 'body' },
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
      ['hops', 'Hops', `${D.HOPS.length} varieties grouped by genre, with alpha, flavour and substitutes`],
      ['fermentables', 'Fermentables', `${D.FERMENTABLES.length} malts, adjuncts, sugars and extracts with PPG and colour`],
      ['yeast', 'Yeast', `${D.YEAST.length} strains: attenuation, pitch and ferment range, flocculation`],
      ['water', 'Water profiles', 'Classic and target profiles in ppm'],
      ['off', 'Off-flavours', 'What it tastes like, what causes it, how to fix it'],
      ['world', 'Beers of the world', `${D.WORLD.length} historical and regional beers with brewable reconstructions, filter by era, strength and bitterness`],
      ['process', 'Process notes', 'Brew day, fermentation, packaging, cleaning']
    ].map(([id, t, s]) => h('li', null, h('button', { onclick: () => go('ref', id) }, h('span', { class: 't' }, h('b', null, t), h('span', null, s)), h('span', { class: 'k' }, '\u203A'))))));
  }

  // ---------- shop ----------
  async function renderShop() {
    const list = await batchList(); const b = await currentBatch(list);
    const tags = await S.get('affTags', {});
    const region = await S.get('region', 'US');
    view.append(h('h2', null, 'Shopping list'));
    if (!b) return view.append(h('div', { class: 'empty' }, 'Create a batch and the shopping list builds itself from the recipe.'), h('button', { class: 'btn block', onclick: () => go('batches', 'new') }, 'New batch'));
    view.append(h('div', { class: 'chips' }, list.slice(0, 8).map(x => h('button', { class: 'chip' + (x.id === b.id ? ' on' : ''), style: 'font-family:inherit', onclick: async () => { state.batchId = x.id; await S.set('lastBatch', x.id); render(); } }, x.name || 'batch'))));
    const shopping = SH.shoppingList(b);
    if (!shopping.length) return view.append(h('div', { class: 'empty' }, 'This batch has no ingredients yet.'));
    const vendors = SH.VENDORS.filter(v => v.region === region);
    const vendorSel = sel(vendors.map(v => ({ v: v.id, t: v.name })), vendors[0] && vendors[0].id);
    view.append(field('Search at', vendorSel));
    const listEl = h('div');
    const draw = () => { listEl.innerHTML = '';
      const groups = [...new Set(shopping.map(l => l.group))];
      for (const g of groups) {
        listEl.append(h('h3', null, g));
        for (const line of shopping.filter(l => l.group === g)) {
          const url = SH.searchUrl(vendorSel.value, line.term, tags);
          listEl.append(h('div', { class: 'rec' }, h('div', { class: 't' }, h('b', null, `${line.qty ? line.qty + '  ' : ''}${line.item}`)),
            h('a', { class: 'act', href: url, target: '_blank', rel: 'noopener' }, 'Find')));
        }
      } };
    vendorSel.addEventListener('change', draw); draw();
    view.append(listEl, h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: async () => { const text = SH.listAsText(shopping); try { await navigator.clipboard.writeText(text); toast('List copied'); } catch (e) { toast('Copy failed'); } } }, 'Copy the list'),
      h('button', { class: 'btn secondary', onclick: async () => { const text = SH.listAsText(shopping); if (navigator.share) { try { await navigator.share({ title: (b.name || 'Brew') + ' shopping list', text }); } catch (e) { /* cancelled */ } } else toast('Sharing is not available here'); } }, 'Share')));
    if (SH.hasAnyTag(tags)) view.append(h('p', { class: 'muted small' }, SH.DISCLOSURE));
    view.append(bookCard());
  }
  function bookCard() {
    return h('div', { class: 'lock' }, h('b', null, BOOK.title), h('p', { class: 'small', style: 'margin-top:6px' }, BOOK.blurb),
      BOOK.url ? h('div', { class: 'btns' }, h('a', { class: 'btn', href: BOOK.url, target: '_blank', rel: 'noopener' }, 'See the log book')) : h('p', { class: 'muted small' }, 'Coming soon.'));
  }

  // ---------- settings ----------
  async function renderSettings() {
    const tags = await S.get('affTags', {});
    const region = await S.get('region', 'US');
    const regionSel = sel(['US', 'UK'], region);
    regionSel.addEventListener('change', async () => { await S.set('region', regionSel.value); toast('Saved'); });
    const tagInputs = SH.VENDORS.map(v => { const i = inp(tags[v.id] || ''); i.dataset.vendor = v.id; return field(`${v.name} (${v.region})`, i, v.note); });
    const eq = await equip(); const ef = {};
    const mkE = (k, label, hint) => { ef[k] = inp(eq[k], k === 'name' ? 'text' : 'number'); return field(label, ef[k], hint); };
    view.append(h('h2', null, 'Settings'),
      h('h3', null, 'Equipment profile'),
      h('p', { class: 'muted small' }, 'These numbers drive the brew day sheet and new-batch defaults. Everyone\'s rig is different; put yours in once.'),
      mkE('name', 'System name'), h('div', { class: 'row' }, mkE('batchGal', 'Batch size (gal)'), mkE('boilGal', 'Pre-boil volume (gal)')),
      h('div', { class: 'row' }, mkE('boilMin', 'Boil length (min)'), mkE('efficiency', 'Mash efficiency %')),
      h('div', { class: 'row' }, mkE('qtPerLb', 'Mash ratio (qt per lb)', 'recirculating systems often run thinner, 1.5 to 2'), mkE('tunLossF', 'Strike temp loss to the tun (F)')),
      h('div', { class: 'row' }, mkE('boilOffGalHr', 'Boil-off (gal per hour)'), mkE('trubGal', 'Trub and kettle loss (gal)')),
      h('div', { class: 'row' }, mkE('absorbGalLb', 'Grain absorption (gal per lb)'), mkE('hydroCalF', 'Hydrometer calibration (F)')),
      mkE('wcf', 'Refractometer wort correction factor', 'usually 1.02 to 1.06'),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { const out = {}; for (const k in ef) out[k] = k === 'name' ? ef[k].value.trim() : num(ef[k].value); await S.set('equip', out); toast('Equipment saved'); } }, 'Save equipment')),
      field('Shop region', regionSel),
      h('h3', null, 'Affiliate tags'),
      h('p', { class: 'muted small' }, 'Leave these blank and shop links are plain search links with no tracking. Paste a tag and links to that shop carry it. Apply to each programme yourself; most want to see traffic before approving.'),
      h('div', null, tagInputs),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => { const out = {}; view.querySelectorAll('input[data-vendor]').forEach(i => { if (i.value.trim()) out[i.dataset.vendor] = i.value.trim(); }); await S.set('affTags', out); toast('Saved'); } }, 'Save tags')),
      h('p', { class: 'muted small' }, SH.DISCLOSURE),
      h('h3', null, 'Export'),
      h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: async () => {
        const batches = await DB.all('batches'), entries = await DB.all('entries');
        const rows = entries.map(e => { const b = batches.find(x => x.id === e.batchId) || {}; return { batch: b.name || '', date: e.date, type: e.type, detail: e.type === 'gravity' ? Number(e.sg).toFixed(3) : (e.text || ''), note: e.note || '' }; });
        const csv = B.toCsv(rows, [{ key: 'batch', label: 'Batch' }, { key: 'date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'detail', label: 'Detail' }, { key: 'note', label: 'Note' }]);
        const file = new File([csv], `brew-log-${today()}.csv`, { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove();
      } }, 'Export the log as .csv')),
      h('h3', null, 'Your data'),
      h('p', { class: 'muted small' }, 'Batches and log entries live in this browser on this phone. Nothing is uploaded.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn danger', onclick: async () => { if (confirm('Delete every batch and log entry?')) { await DB.clearAll(); S.cache = {}; state.batchId = null; toast('Cleared'); go('batches'); } } }, 'Delete all data')),
      h('h3', null, 'Updates'),
      h('p', { class: 'muted small' }, `This page is Brew Log ${APP_VERSION}.`),
      h('div', { class: 'btns' }, h('button', { class: 'btn secondary', onclick: async () => { toast('Fetching the latest files'); try { const keys = await caches.keys(); for (const k of keys) await caches.delete(k); if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); } } catch (e) { /* ignore */ } location.replace(location.pathname + '?r=' + Date.now()); } }, 'Check for updates and reload')),
      bookCard());
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').hidden = true; });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
