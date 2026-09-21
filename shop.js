/* Brew Log - shopping links. Builds search URLs at homebrew retailers, with the user's own affiliate tag
   appended only when they have set one. No tag, no tracking, and the link still works. */
(function (root) {
  'use strict';
  const S = {};
  // param: the query string key for a search term. tagParam/tagValue come from the user's settings.
  S.VENDORS = [
    { id: 'morebeer', name: 'MoreBeer', region: 'US', url: 'https://www.morebeer.com/search/', param: 'q', note: 'Wide range, free shipping over a threshold' },
    { id: 'northernbrewer', name: 'Northern Brewer', region: 'US', url: 'https://www.northernbrewer.com/search', param: 'q', note: 'Kits and ingredients' },
    { id: 'homebrewing', name: 'Adventures in Homebrewing', region: 'US', url: 'https://www.homebrewing.org/search', param: 'q', note: 'In-house affiliate programme' },
    { id: 'ritebrew', name: 'Ritebrew', region: 'US', url: 'https://www.ritebrew.com/search', param: 'keyword', note: 'Bulk grain and hops' },
    { id: 'yeastmarket', name: 'Yeast Market', region: 'US', url: 'https://yeastmarket.com/search', param: 'q', note: 'Liquid yeast, cold shipped' },
    { id: 'amazon', name: 'Amazon', region: 'US', url: 'https://www.amazon.com/s', param: 'k', note: 'Equipment and sundries' },
    { id: 'themaltmiller', name: 'The Malt Miller', region: 'UK', url: 'https://www.themaltmiller.co.uk/search', param: 'q', note: 'UK ingredients' },
    { id: 'geterbrewed', name: 'Get Er Brewed', region: 'UK', url: 'https://www.geterbrewed.com/search', param: 'q', note: 'UK and Ireland' }
  ];
  S.vendor = id => S.VENDORS.find(v => v.id === id) || null;
  // Shops found by the catalog builder that are not in the list above join it, so their carts can be used
  S.useCatalog = function (catalog) {
    S.CATALOG = catalog && catalog.vendors ? catalog : { built: null, vendors: {} };
    for (const id in S.CATALOG.vendors) { const c = S.CATALOG.vendors[id]; if (!S.vendor(id) && c.origin) S.VENDORS.push({ id, name: c.name || id, region: c.region || 'US', url: c.origin.replace(/\/$/, '') + '/search', param: 'q', note: 'One-tap cart' }); }
    return S.CATALOG;
  };
  S.hasCart = id => !!(S.CATALOG && S.CATALOG.vendors[id] && Object.keys(S.CATALOG.vendors[id].items || {}).length);
  /* Affiliate programmes hand out links in three shapes, and the app takes any of them in the vendor's box in Settings:
       1. a deep-link template with {url} where the destination goes (affiliate networks):  https://network.example/click?id=123&url={url}
       2. a parameter to add to the shop's own URLs (in-house programmes):                  a_aid=abc123   or   ?ref=phil
       3. a bare code (Amazon's tag, or the old behaviour):                                  mysite-20
     The destination is whatever the app was going to open anyway: a search, or a filled cart. */
  S.affiliate = function (url, vendorId, tags) {
    const tag = tags && tags[vendorId] ? String(tags[vendorId]).trim() : ''; if (!tag) return url;
    if (/\{url\}/i.test(tag)) return tag.replace(/\{url\}/ig, encodeURIComponent(url));
    const u = new URL(url);
    if (/^https?:\/\//i.test(tag)) {            // a whole link with no {url}: borrow its parameters if it points at the same shop
      try { const t = new URL(tag); if (t.hostname.replace(/^www\./, '') === u.hostname.replace(/^www\./, '')) { t.searchParams.forEach((v, k) => u.searchParams.set(k, v)); return u.toString(); } } catch (e) { /* not a URL after all */ }
      return url;
    }
    if (tag.includes('=')) { new URLSearchParams(tag.replace(/^[?&]/, '')).forEach((v, k) => u.searchParams.set(k, v)); return u.toString(); }
    u.searchParams.set(vendorId === 'amazon' ? 'tag' : 'aff', tag);
    return u.toString();
  };
  // A link that cannot carry the visitor anywhere but the front page earns nothing from a search or a cart: say so in Settings.
  S.tagProblem = function (vendorId, tag) {
    const t = String(tag || '').trim(); if (!t || /\{url\}/i.test(t) || !/^https?:\/\//i.test(t)) return '';
    const v = S.vendor(vendorId); try { if (v && new URL(t).hostname.replace(/^www\./, '') === new URL(v.url).hostname.replace(/^www\./, '')) return ''; } catch (e) { return 'That does not look like a link.'; }
    return 'This link has no {url} in it, so the app cannot send people through it to a search or a cart. In the programme\'s dashboard look for "deep link" or "custom link", and put {url} where the destination address goes.';
  };
  S.searchUrl = function (vendorId, term, tags) {
    const v = S.vendor(vendorId); if (!v) return null;
    const u = new URL(v.url);
    u.searchParams.set(v.param, String(term || '').trim());
    return S.affiliate(u.toString(), vendorId, tags);
  };
  S.hasAnyTag = tags => !!(tags && Object.values(tags).some(t => t && String(t).trim()));
  // Build a shopping list from a recipe: one line per ingredient, with a sensible search term.
  S.shoppingList = function (batch, opts) {
    const packs = Math.max(1, Math.round(Number(opts && opts.yeastPacks) || 1));
    const out = [];
    (batch.fermentables || []).forEach(f => { if (f.name && !f.late) out.push({ qty: f.lb ? `${f.lb} lb` : '', item: f.name, term: f.name.replace(/\s*\/.*$/, ''), group: 'Fermentables', key: f.name, unit: 'lb' }); });
    (batch.hops || []).forEach(hp => { if (hp.name) out.push({ qty: hp.oz ? `${hp.oz} oz` : '', item: `${hp.name}${hp.minutes !== undefined && hp.minutes !== '' ? ' (' + hp.minutes + ' min)' : ''}`, term: hp.name + ' hops' + formTerm(hp.type), group: 'Hops', key: hp.name, unit: 'oz', form: hp.type || 'pellet' }); });
    const dry = Array.isArray(batch.dryHops) ? batch.dryHops : [];
    dry.forEach(d => { if (d.name && !d.extra) out.push({ qty: d.oz ? `${d.oz} oz` : '', item: `${d.name} (dry hop)`, term: d.name + ' hops' + formTerm(d.type), group: 'Hops', key: d.name, unit: 'oz', form: d.type || 'pellet' }); });
    if (batch.yeast) out.push({ qty: String(packs), item: batch.yeast + (packs > 1 ? ` (${packs} packs)` : ''), term: batch.yeast.split('/')[0].trim() + ' yeast', group: 'Yeast', key: batch.yeast, unit: 'pack' });
    (batch.salts || []).forEach(s => { if (s.salt && s.grams) out.push({ qty: `${s.grams} g`, item: s.salt, term: s.salt.replace(/\s*\(.*\)/, ''), group: 'Water' }); });
    (batch.extras || []).forEach(e => { if (!e) return; const m = /^dry hop:\s*(.*)$/i.exec(e);
      if (m && !dry.length) { const name = m[1].replace(/(\d+(?:\.\d+)?)\s*oz/i, '').replace(/,?\s*\d+\s*days?/i, '').replace(/^[\s,]+|[\s,]+$/g, ''); const oz = (m[1].match(/(\d+(?:\.\d+)?)\s*oz/i) || [])[1]; out.push({ qty: oz ? `${oz} oz` : '', item: `${name} (dry hop)`, term: name + ' hops', group: 'Hops' }); }
      else if (!m) out.push({ qty: '', item: e, term: e, group: 'Other' }); });
    // merge duplicate ingredients (two hop additions of the same variety)
    const merged = [];
    for (const line of out) {
      const hit = merged.find(m => m.group === line.group && m.term === line.term);
      if (hit && line.group === 'Hops') { hit.qty = addQty(hit.qty, line.qty); hit.item = hit.term.replace(/ hops.*$/, '') + ' (multiple additions)'; }
      else merged.push(Object.assign({}, line));
    }
    merged.forEach(l => { l.buy = S.buyQty(l); });
    return merged;
  };
  const formTerm = t => t === 'cryo' ? ' cryo' : t === 'leaf' ? ' whole leaf' : t === 'extract' ? ' extract' : '';
  /* What you actually put in the basket: shops sell grain by the pound, hops by the ounce and yeast by the pack.
     Salts are left alone; a jar lasts years. */
  S.buyQty = function (line) {
    const n = parseFloat(line.qty); if (!isFinite(n) || n <= 0) return '';
    if (line.group === 'Fermentables') { const lb = Math.ceil(n - 1e-9); return lb === n ? '' : `buy ${lb} lb`; }
    if (line.group === 'Hops') { const oz = Math.ceil(n - 1e-9); return oz === n ? '' : `buy ${oz} oz`; }
    return '';
  };
  // Most retailers sell all-grain and extract kits for the common styles: one product instead of a dozen.
  S.kitTerm = batch => batch && batch.style ? `${String(batch.style).replace(/\s*\(.*\)/, '').replace(/\s*\/.*$/, '')} recipe kit` : '';
  function addQty(a, b) {
    const na = parseFloat(a) || 0, nb = parseFloat(b) || 0, unit = (String(a).match(/[a-z]+/) || [''])[0];
    const sum = Math.round((na + nb) * 100) / 100;
    return unit ? `${sum} ${unit}` : String(sum);
  }
  S.listAsText = function (list) {
    const groups = [...new Set(list.map(l => l.group))];
    return groups.map(g => g.toUpperCase() + '\n' + list.filter(l => l.group === g).map(l => `- ${l.qty ? l.qty + '  ' : ''}${l.item}${l.buy ? '  (' + l.buy + ')' : ''}`).join('\n')).join('\n\n');
  };
  /* The short list of brew day extras offered beside a cart. Deliberately short: the things most brewers use on most batches.
     use: borrow an ingredient already in the catalog (priming sugar is corn sugar). salt: the recipe salt this one covers. */
  S.EXTRAS = [
    { name: 'Campden tablets', aliases: ['campden tablets', 'campden'], note: 'Takes chlorine and chloramine out of tap water: half a tablet per 10 gallons' },
    { name: 'Lactic acid', aliases: ['lactic acid'], note: 'Brings mash pH down when the water is alkaline; a bottle lasts a year' },
    { name: 'Whirlfloc tablets', aliases: ['whirlfloc', 'irish moss'], note: 'Kettle finings for clear beer: one tablet at 15 minutes' },
    { name: 'Yeast nutrient', aliases: ['yeast nutrient', 'wyeast nutrient', 'fermaid'], note: 'Worth it for strong beers, lagers and anything with a lot of sugar' },
    { name: 'Gypsum', aliases: ['gypsum', 'calcium sulfate'], salt: 'Gypsum (CaSO4)', note: 'Sulfate, for hoppy beers' },
    { name: 'Calcium chloride', aliases: ['calcium chloride'], salt: 'Calcium chloride (CaCl2)', note: 'Chloride, for malty and hazy beers' },
    { name: 'Epsom salt', aliases: ['epsom salt', 'magnesium sulfate'], salt: 'Epsom salt (MgSO4)', onlyIfSalt: true, note: 'Magnesium and sulfate' },
    { name: 'Priming sugar', use: 'Corn sugar (dextrose)', need: 0.31, unit: 'lb', note: 'About 5 oz of corn sugar, enough to bottle 5 gallons' },
    { name: 'Sanitizer', aliases: ['star san', 'starsan', 'io star', 'sanitizer'], note: 'No-rinse sanitizer; the small bottle makes dozens of batches' }
  ];
  // Which extras to show for a batch: the standing list, plus any salt its water calls for; those are flagged
  S.extrasFor = function (batch) {
    const salts = ((batch && batch.salts) || []).filter(x => x.salt && x.grams).map(x => x.salt);
    return S.EXTRAS.filter(e => !e.onlyIfSalt || salts.includes(e.salt)).map(e => Object.assign({}, e, { inRecipe: !!e.salt && salts.includes(e.salt) }));
  };

  // ---- one-tap carts ----
  /* Shopify shops accept a link that fills the cart: /cart/<variant>:<qty>,<variant>:<qty>. The variant numbers come from
     catalog.json, which catalog-build.mjs writes from each shop's public product feed. No catalog, no button: everything else still works.
     catalog: { built, vendors: { id: { name, origin, items: { '<ingredient name>': [ { id, size, unit, price, form, milled, title } ] } } } } */
  const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
  const KG_LB = 2.20462, G_OZ = 28.3495;
  const WORD_NUM = { half: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twenty: 20, 'twenty five': 25, fifty: 50, 'fifty five': 55 };
  // "1 lb", "5 lbs", "Ten pounds", "2 oz", "500 g", "1 kg" -> a number in the unit the ingredient is bought in
  S.parseSize = function (text, unit) {
    let t = String(text || '').toLowerCase().replace(/\b(twenty five|fifty five|half|one|two|three|four|five|six|eight|ten|twenty|fifty)\b(?=\s*(lbs?|pounds?|oz|ounces?|kg|kilos?)\b)/g, w => WORD_NUM[w]);
    const m = t.match(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|oz|ounces?|kg|kilos?|g|grams?)\b/); if (!m) return null;
    const n = Number(m[1]), u = m[2]; let lb;
    if (/^(lb|pound)/.test(u)) lb = n; else if (/^(oz|ounce)/.test(u)) lb = n / 16; else if (/^k/.test(u)) lb = n * KG_LB; else lb = n / G_OZ / 16;
    return Math.round((unit === 'oz' ? lb * 16 : lb) * 100) / 100;
  };
  const NOT_INGREDIENT = /\b(kit|kits|rhizome|plant|seeds?|shirt|hat|glass|poster|book|candle|soap|sign|sticker|gift|mill|scale|bag only|bucket|spoon)\b/;
  const ALIASES = {   // generic names in the app against the way shops title the same thing; the first alias that matches anything wins
    '2-row pale malt': ['2 row', 'two row', '2row'], 'Pilsner malt': ['pilsner malt', 'pilsen malt', 'pilsner', 'pilsen', 'pils'], 'Maris Otter': ['maris otter'], 'Munich malt': ['munich malt', 'munich'], 'Vienna malt': ['vienna'],
    'Wheat malt': ['white wheat malt', 'wheat malt', 'white wheat', 'pale wheat'], 'Flaked oats': ['flaked oats', 'oat flakes'], 'Flaked corn (maize)': ['flaked corn', 'flaked maize'], 'Flaked barley': ['flaked barley'], 'Flaked rice': ['flaked rice'],
    'Corn sugar (dextrose)': ['corn sugar', 'dextrose', 'priming sugar'], 'Table sugar (sucrose)': [], 'Light DME': ['light dme', 'dme light', 'light dry malt extract', 'golden light dme', 'pilsen light dry malt extract'], 'Light LME': ['light lme', 'lme light', 'light liquid malt extract', 'golden light lme', 'light malt syrup'],
    'CaraPils / Carafoam': ['carapils', 'carafoam', 'dextrin malt', 'dextrine malt'], 'Carafa Special II': ['carafa special ii', 'carafa ii special', 'carafa special 2', 'carafa 2 special', 'dehusked carafa ii'], 'Victory malt': ['victory'],
    'Belgian candi syrup D-45': ['candi syrup d 45', 'd 45 candi', 'd 45', 'd45'], 'Belgian candi syrup D-180': ['candi syrup d 180', 'd 180 candi', 'd 180', 'd180'],
    'Columbus / CTZ': ['columbus', 'ctz', 'tomahawk', 'zeus'], 'Hallertau Mittelfrüh': ['hallertau mittelfruh', 'hallertau mittelfrueh', 'hallertauer mittelfruh', 'hallertauer mittelfrueh', 'mittelfruh', 'hallertau', 'hallertauer'],
    'East Kent Golding': ['east kent golding', 'kent golding', 'ekg'], Tettnang: ['tettnang', 'tettnanger'], Spalt: ['spalt', 'spalter'], 'Huell Melon': ['huell melon', 'hull melon'], 'Styrian Golding': ['styrian golding', 'celeia']
  };
  // A word in the shop's title that makes it a different ingredient, unless our ingredient has the word too
  const MODIFIERS = ['flaked', 'torrified', 'unmalted', 'raw', 'smoked', 'oak', 'cherrywood', 'peated', 'midnight', 'chocolate', 'roasted', 'black', 'dark', 'caramel', 'crystal', 'honey', 'candi', 'rye', 'wheat', 'oat', 'oats', 'spelt', 'toasted', 'red', 'acidulated', 'melanoidin', 'special'];
  // Where the classic version of a hop grows: breaks the tie when a shop sells the same name from two countries
  const UK = 'uk|english|british|england', DE = 'german|germany';
  const HOP_ORIGIN = { Fuggle: UK, 'East Kent Golding': UK, Challenger: UK, Target: UK, 'Bramling Cross': UK, Progress: UK, Saaz: 'czech', Tettnang: DE, Spalt: DE, Perle: DE, Hersbrucker: DE, Magnum: DE, 'Northern Brewer': DE, 'Hallertau Mittelfrüh': DE, 'Styrian Golding': 'slovenia|slovenian' };
  const BULK_YEAST = /\b(100|250|500)\s*(g|grams?)\b|\b1\s*kg\b|\bbrick\b|\bbulk\b/;
  S.aliasesFor = function (name, kind) {
    if (ALIASES[name]) return ALIASES[name].map(norm);
    const parts = String(name).replace(/w-34\/70/i, 'W-34-70').split('/').map(x => x.trim()).filter(Boolean);
    if (kind === 'Yeast') { const codes = [], names = []; for (const p of parts) { const clean = p.replace(/\((dry|liquid)\)/i, ''); const code = clean.match(/\b([a-z]{1,4}-?\d{2,4}(?:-\d+)?|\d{4})\b/i); if (code) codes.push(norm(code[1])); else names.push(norm(clean.replace(/\b(lalbrew|lallemand|omega|mangrove jack|escarpment|wildbrew|fermentis)\b/ig, ''))); }
      return (codes.length ? codes : names).filter(Boolean); }   // a strain number is exact; a descriptive name ("Kölsch") is only used when there is no number
    if (parts.length === 1) return [norm(name)];
    // "Crystal / Caramel 60L": the qualifier on the last name belongs to every name
    const last = parts[parts.length - 1].split(' '), tail = last.length > 1 ? last.slice(1).join(' ') : '';
    return parts.map((p, i) => norm(i < parts.length - 1 && tail && p.split(' ').length === 1 ? p + ' ' + tail : p));
  };
  const hasWords = (titleWords, alias) => alias.split(' ').every(w => titleWords.includes(w) || (/^\d+l$/.test(w) && (titleWords.includes(w.slice(0, -1)) || titleWords.includes(w.slice(0, -1) + ' l'))) || (w.length > 3 && titleWords.some(t => t === w + 's')));
  /* Turn a shop's product feed into catalog items. products: the "products" array of Shopify's /products.json.
     refs: { fermentables, hops, yeast } from data.js. Returns { items, matched: [[ingredient, product title]], unmatched: [names], near: { name: [titles] } }. */
  S.buildCatalogItems = function (products, refs) {
    const items = {}, matched = [], unmatched = [], near = {};
    const prods = (products || []).map(p => { const t = norm(p.title); return { p, t, words: t.split(' '), type: norm(p.product_type), tags: norm(Array.isArray(p.tags) ? p.tags.join(' ') : p.tags) }; }).filter(x => !NOT_INGREDIENT.test(x.t));
    const kinds = [['Fermentable', refs.fermentables || [], 'lb'], ['Hop', refs.hops || [], 'oz'], ['Yeast', refs.yeast || [], 'pack'], ['Extra', (refs.extras || S.EXTRAS).filter(e => !e.use), 'each']];
    const variantsOf = (x, kind, unit) => {
      const out = [], opts = (x.p.options || []).map(o => norm(o && o.name)), millAt = opts.findIndex(o => /mill|crush|grind/.test(o));
      const grams = (x.p.variants || []).map(v => v.grams || 0), gramsDiffer = new Set(grams).size > 1;
      for (const v of x.p.variants || []) {
        if (v.available === false) continue;
        const vt = norm([v.title, v.option1, v.option2, v.option3].filter(Boolean).join(' ')), text = vt + ' ' + x.t;
        const price = v.price !== undefined && v.price !== null && isFinite(Number(v.price)) ? Number(v.price) : null;
        if (kind === 'Yeast' && (BULK_YEAST.test(text) || (price !== null && price > 40))) continue;   // bricks are for breweries
        const fromGrams = v.grams > 0 && unit !== 'pack' ? (() => { const raw = unit === 'oz' ? v.grams / G_OZ : v.grams / G_OZ / 16; return raw >= 0.9 ? Math.round(raw) : Math.round(raw * 4) / 4; })() : null;
        // the variant's own words first; then its shipping weight when the variants differ by weight; only then the product title
        const size = unit === 'pack' || unit === 'each' ? 1 : (S.parseSize(vt, unit) || (gramsDiffer ? fromGrams : null) || S.parseSize(x.t, unit) || fromGrams);
        if (!size) continue;
        let milled; if (kind === 'Fermentable') { const mv = millAt >= 0 ? norm(v['option' + (millAt + 1)]) : '';
          milled = /^(no|none|unmilled|uncrushed|whole)\b/.test(mv) || /\b(unmilled|uncrushed|whole)\b/.test(vt) ? false : /^(yes|milled|crushed)\b/.test(mv) || /\b(milled|crushed)\b/.test(vt) ? true : null; }
        out.push({ id: v.id, size, unit, price, title: `${x.p.title}${v.title && v.title !== 'Default Title' ? ' \u2013 ' + v.title : ''}`,
          form: kind === 'Hop' ? (/\b(cryo|lupuln2|lupomax|cryogenic|lupulin)\b/.test(text) ? 'cryo' : /\b(leaf|whole|cone)\b/.test(text) ? 'leaf' : 'pellet') : undefined, milled });
      }
      return out;
    };
    for (const [kind, list, unit] of kinds) for (const ref of list) {
      const aliases = kind === 'Extra' ? ref.aliases.map(norm) : S.aliasesFor(ref.name, kind), own = norm(ref.name + ' ' + aliases.join(' ')).split(' ');
      const allowed = x => {
        const hay = x.t + ' ' + x.type + ' ' + x.tags;
        if (kind === 'Hop') return /\bhops?\b/.test(hay) && !/\b(extract|oil|terpene|tea|hash)\b/.test(x.t);
        if (kind === 'Extra') return !/\b(test|tester|meter|refill|crusher|dispenser|spray bottle)\b/.test(x.t);
        if (kind === 'Yeast') return /\b(yeast|wyeast|white labs|wlp|safale|saflager|lalbrew|lallemand|omega|imperial|fermentis|wildbrew)\b/.test(hay);
        if (/\bhops?\b|\byeast\b/.test(x.t)) return false;
        if (!ref.extract && /\b(extract|dme|lme|syrup)\b/.test(x.t)) return false;
        if (ref.extract && !/\bmalt\b/.test(norm(ref.name)) && !/dme|lme/i.test(ref.name) && /\bmalt\b/.test(x.t)) return false;   // honey is not honey malt
        return !MODIFIERS.some(m => x.words.includes(m) && !own.includes(m));
      };
      const origin = HOP_ORIGIN[ref.name] ? new RegExp('\\b(' + HOP_ORIGIN[ref.name] + ')\\b') : null;
      const score = (x, al) => al.split(' ').length / x.words.length + (new RegExp('\\b(' + (kind === 'Hop' ? 'hop' : kind === 'Yeast' ? 'yeast' : kind === 'Extra' ? 'additive|chemical|water|clean|sanit|fining' : 'grain|malt') + ')', 'i').test(x.type) ? 0.2 : 0) + (origin && origin.test(x.t) ? 0.3 : 0) + (/\borganic\b/.test(x.t) ? -0.15 : 0);
      let variants = [], titles = [];
      for (const al of aliases) {           // most specific alias first; stop at the first one the shop stocks
        const hits = prods.filter(x => allowed(x) && (kind !== 'Hop' || !(al === 'hallertau' || al === 'hallertauer') || !/\b(blanc|tradition|magnum|taurus|merkur|herkules|hersbrucker|mittelfruh)\b/.test(x.t)) && hasWords(x.words, al))
          .map(x => ({ x, s: score(x, al), vs: variantsOf(x, kind, unit) })).filter(h => h.vs.length).sort((a, b) => b.s - a.s);
        if (!hits.length) continue;
        if (kind === 'Hop') { const seen = {}; for (const h of hits) for (const form of [...new Set(h.vs.map(v => v.form))]) if (!seen[form]) { seen[form] = true; variants.push(...h.vs.filter(v => v.form === form)); titles.push(h.x.p.title); } }   // the best product for each form
        else { variants = hits[0].vs; titles = [hits[0].x.p.title]; }
        break;
      }
      if (variants.length) { items[ref.name] = variants; matched.push([ref.name, [...new Set(titles)].join(' | ')]); }
      else { unmatched.push(ref.name); const key = aliases.concat([norm(ref.name)]).join(' ').split(' ').filter(w => w.length > 3 && !['malt', 'hops', 'yeast', 'belgian', 'german', 'american', 'english', 'lager', 'syrup', 'sugar'].includes(w));
        const close = prods.filter(x => key.some(w => x.words.includes(w) || x.words.includes(w + 's'))).slice(0, 4).map(x => x.p.title); if (close.length) near[ref.name] = close; }
    }
    return { items, matched, unmatched, near };
  };
  /* The cheapest set of packs that covers the amount, or when prices are unknown the one with least left over, then fewest packs.
     variants: [{id, size, price}] -> [{id, qty, size, price}] */
  S.pickPacks = function (variants, need) {
    const vs = (variants || []).filter(v => v.size > 0).sort((a, b) => b.size - a.size); if (!vs.length || !(need > 0)) return [];
    const priced = vs.every(v => v.price !== null && v.price !== undefined); let best = null;
    const walk = (i, left, picked, cost, count) => {
      if (left <= 1e-9) { const over = -left, key = priced ? [cost, over, count] : [over, count, 0]; if (!best || key[0] < best.key[0] - 1e-9 || (Math.abs(key[0] - best.key[0]) < 1e-9 && (key[1] < best.key[1] - 1e-9 || (Math.abs(key[1] - best.key[1]) < 1e-9 && key[2] < best.key[2])))) best = { key, picked: picked.slice() }; return; }
      if (i >= vs.length || count > 12) return;
      const v = vs[i], max = Math.ceil(left / v.size - 1e-9);
      for (let q = Math.min(max, 12); q >= 0; q--) { if (q) picked.push({ id: v.id, qty: q, size: v.size, price: v.price, title: v.title }); walk(i + 1, left - q * v.size, picked, cost + q * (v.price || 0), count + q); if (q) picked.pop(); }
    };
    walk(0, need, [], 0, 0);
    return best ? best.picked : [];
  };
  /* Everything the recipe needs at one shop, as a cart. opts: { milled: true|false } for grain.
     Returns null when the shop has no catalog; otherwise { url, lines: [{item, need, unit, packs, got, cost}], missing: [shopping lines], total }. */
  S.cartFor = function (vendorId, batch, tags, opts) {
    const c = S.CATALOG && S.CATALOG.vendors[vendorId]; if (!c || !c.items) return null;
    const o = Object.assign({ milled: true, extras: [], yeastPacks: 1 }, opts || {}), lines = [], missing = [], bag = {};
    const needs = {};   // one line per ingredient and form, amounts added up
    for (const l of S.shoppingList(batch, { yeastPacks: o.yeastPacks })) { if (!l.key) { missing.push(l); continue; } const k = l.key + '|' + (l.form || ''); const n = parseFloat(l.qty) || (l.unit === 'pack' ? 1 : 0); if (!needs[k]) needs[k] = Object.assign({}, l, { need: 0 }); needs[k].need += n; }
    for (const name of o.extras || []) { const e = S.EXTRAS.find(x => x.name === name); if (!e) continue;   // ticked brew day extras: one of each, the smallest pack
      needs['extra|' + name] = { key: e.use || e.name, item: e.name, group: 'Extras', unit: e.unit || 'each', need: e.need || 1, label: e.name }; }
    for (const k in needs) { const l = needs[k]; let vs = c.items[l.key] || [];
      if (l.group === 'Hops') { const same = vs.filter(v => v.form === l.form); vs = same.length ? same : vs.filter(v => v.form === 'pellet').length ? vs.filter(v => v.form === 'pellet') : vs; }
      if (l.group === 'Fermentables') { const pref = vs.filter(v => v.milled === o.milled || v.milled === null); if (pref.length) vs = pref; }
      const packs = l.need > 0 ? S.pickPacks(vs, l.need) : [];
      if (!packs.length) { missing.push(Object.assign({ term: (l.label || l.key) }, l, { item: l.label || l.item || l.key })); continue; }
      for (const p of packs) bag[p.id] = (bag[p.id] || 0) + p.qty;
      lines.push({ item: l.label || l.key, group: l.group, need: Math.round(l.need * 100) / 100, unit: l.unit, packs, got: Math.round(packs.reduce((s2, p) => s2 + p.qty * p.size, 0) * 100) / 100, cost: packs.every(p => p.price !== null) ? Math.round(packs.reduce((s2, p) => s2 + p.qty * p.price, 0) * 100) / 100 : null });
    }
    if (!lines.length) return { url: null, lines, missing, total: null };
    const dest = `${c.origin.replace(/\/$/, '')}/cart/${Object.keys(bag).map(id => `${id}:${bag[id]}`).join(',')}?storefront=true&ref=brewlog`;
    return { url: S.affiliate(dest, vendorId, tags), lines, missing, total: lines.every(l => l.cost !== null) ? Math.round(lines.reduce((s2, l) => s2 + l.cost, 0) * 100) / 100 : null };
  };
  S.extraAvailable = (vendorId, name) => { const c = S.CATALOG && S.CATALOG.vendors[vendorId], e = S.EXTRAS.find(x => x.name === name); return !!(c && e && c.items[e.use || e.name] && c.items[e.use || e.name].length); };
  S.useCatalog(null);   // the app fetches catalog.json at start-up and hands it in

  S.DISCLOSURE = 'Some shop links may earn a small commission at no cost to you. They never change what the app recommends.';
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.BrewShop = S;
})(typeof window !== 'undefined' ? window : globalThis);
