/* Brew Log - BeerXML 1.0 export and import. The interchange format read by Brewfather, BeerSmith, Brewer's Friend and Grainfather. */
(function (root) {
  'use strict';
  const X = {};
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const L_PER_GAL = 3.78541, KG_PER_LB = 0.453592, KG_PER_OZ = 0.0283495;
  const fToC = f => Math.round((f - 32) * 5 / 9 * 100) / 100;
  const cToF = c => Math.round((c * 9 / 5 + 32) * 10) / 10;
  const tag = (name, value) => `<${name}>${esc(value)}</${name}>`;

  const formOf = t => (t === 'leaf' || t === 'wet') ? 'Leaf' : 'Pellet';   // BeerXML 1.0 knows Pellet, Plug and Leaf only
  /* batch: the app's batch object; refs: { fermentables, hops, yeast } reference tables for ppg/colour/attenuation. */
  X.exportRecipe = function (batch, refs) {
    const gal = num(batch.batchGal) || 5.5, boilGal = num(batch.boilGal) || gal * 1.25, boilMin = num(batch.boilMin) || 60;
    const eff = num(batch.efficiency) || 72;
    const ferms = (batch.fermentables || []).filter(f => f.name).map(f => {
      const ref = (refs.fermentables || []).find(x => x.name === f.name) || {};
      const ppg = ref.ppg || 36; const yieldPct = Math.round(ppg / 46.21 * 100 * 10) / 10;   // 46.21 ppg is 100% yield (sucrose)
      const type = ref.extract ? (/dme|dry/i.test(f.name) ? 'Dry Extract' : /sugar|honey|syrup|lactose|maple/i.test(f.name) ? 'Sugar' : 'Extract') : (ref.group === 'Adjunct' ? 'Adjunct' : 'Grain');
      return `<FERMENTABLE>${tag('NAME', f.name)}${tag('VERSION', 1)}${tag('TYPE', type)}${tag('AMOUNT', (num(f.lb) * KG_PER_LB).toFixed(4))}${tag('YIELD', yieldPct)}${tag('COLOR', ref.lovibond !== undefined ? ref.lovibond : 2)}${tag('ADD_AFTER_BOIL', 'FALSE')}</FERMENTABLE>`;
    });
    const hops = (batch.hops || []).filter(hp => hp.name).map(hp => {
      const ref = (refs.hops || []).find(x => x.name === hp.name) || {};
      const alpha = num(hp.alpha) || (ref.alphaLow ? (ref.alphaLow + ref.alphaHigh) / 2 : 5);
      const minutes = num(hp.minutes);
      const use = hp.whirlpool ? 'Aroma' : (minutes === 0 ? 'Aroma' : 'Boil');
      return `<HOP>${tag('NAME', hp.name)}${tag('VERSION', 1)}${tag('ALPHA', alpha)}${tag('AMOUNT', (num(hp.oz) * KG_PER_OZ).toFixed(4))}${tag('USE', use)}${tag('TIME', minutes)}${tag('FORM', formOf(hp.type))}${hp.type && hp.type !== 'pellet' && hp.type !== 'leaf' ? tag('NOTES', 'Form: ' + hp.type) : ''}</HOP>`;
    }).concat((Array.isArray(batch.dryHops) ? batch.dryHops : []).filter(d => d.name).map(d => {
      const ref = (refs.hops || []).find(x => x.name === d.name) || {};
      const alpha = num(d.alpha) || (ref.alphaLow ? (ref.alphaLow + ref.alphaHigh) / 2 : 5);
      return `<HOP>${tag('NAME', d.name)}${tag('VERSION', 1)}${tag('ALPHA', alpha)}${tag('AMOUNT', (num(d.oz) * KG_PER_OZ).toFixed(4))}${tag('USE', 'Dry Hop')}${tag('TIME', (num(d.days) || 4) * 1440)}${tag('FORM', formOf(d.type))}</HOP>`;
    }));
    let yeast = '';
    if (batch.yeast) {
      const ref = (refs.yeast || []).find(x => x.name === batch.yeast) || {};
      const type = ref.type === 'Lager' ? 'Lager' : ref.type === 'Kveik' ? 'Ale' : ref.type === 'Sour' ? 'Ale' : 'Ale';
      yeast = `<YEAST>${tag('NAME', batch.yeast)}${tag('VERSION', 1)}${tag('TYPE', type)}${tag('FORM', /dry|us-05|s-04|nottingham|lalbrew|belle|diamond|novalager|verdant|windsor|bry-97|munich classic/i.test(batch.yeast) ? 'Dry' : 'Liquid')}${tag('AMOUNT', 0.0115)}${tag('AMOUNT_IS_WEIGHT', 'TRUE')}${ref.attLow ? tag('ATTENUATION', Math.round((ref.attLow + ref.attHigh) / 2)) : ''}${ref.tempLow ? tag('MIN_TEMPERATURE', fToC(ref.tempLow)) + tag('MAX_TEMPERATURE', fToC(ref.tempHigh)) : ''}</YEAST>`;
    }
    const salts = (batch.salts || []).filter(s => s.grams).map(s => `<MISC>${tag('NAME', s.salt)}${tag('VERSION', 1)}${tag('TYPE', 'Water Agent')}${tag('USE', 'Mash')}${tag('TIME', 0)}${tag('AMOUNT', (num(s.grams) / 1000).toFixed(4))}${tag('AMOUNT_IS_WEIGHT', 'TRUE')}</MISC>`);
    const mashF = num(batch.mashF) || 152;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>${tag('NAME', batch.name || 'Untitled')}${tag('VERSION', 1)}${tag('TYPE', ferms.some(f => /Extract/.test(f)) && !ferms.some(f => /<TYPE>Grain/.test(f)) ? 'Extract' : 'All Grain')}
<STYLE>${tag('NAME', batch.style || '')}${tag('VERSION', 1)}${tag('CATEGORY', '')}${tag('CATEGORY_NUMBER', 0)}${tag('STYLE_LETTER', '')}${tag('STYLE_GUIDE', '')}${tag('TYPE', 'Ale')}${tag('OG_MIN', 1.03)}${tag('OG_MAX', 1.12)}${tag('FG_MIN', 1.0)}${tag('FG_MAX', 1.03)}${tag('IBU_MIN', 0)}${tag('IBU_MAX', 120)}${tag('COLOR_MIN', 1)}${tag('COLOR_MAX', 50)}</STYLE>
${tag('BREWER', batch.brewer || '')}${tag('BATCH_SIZE', (gal * L_PER_GAL).toFixed(3))}${tag('BOIL_SIZE', (boilGal * L_PER_GAL).toFixed(3))}${tag('BOIL_TIME', boilMin)}${tag('EFFICIENCY', eff)}
${batch.og ? tag('OG', num(batch.og).toFixed(3)) : ''}${batch.fg ? tag('FG', num(batch.fg).toFixed(3)) : ''}${batch.brewDate ? tag('DATE', batch.brewDate) : ''}${tag('NOTES', batch.notes || '')}
<HOPS>${hops.join('')}</HOPS><FERMENTABLES>${ferms.join('')}</FERMENTABLES><MISCS>${salts.join('')}</MISCS><YEASTS>${yeast}</YEASTS><WATERS></WATERS>
<MASH>${tag('NAME', 'Single infusion')}${tag('VERSION', 1)}${tag('GRAIN_TEMP', 20)}<MASH_STEPS><MASH_STEP>${tag('NAME', 'Saccharification')}${tag('VERSION', 1)}${tag('TYPE', 'Infusion')}${tag('STEP_TEMP', fToC(mashF))}${tag('STEP_TIME', 60)}</MASH_STEP></MASH_STEPS></MASH>
</RECIPE></RECIPES>`;
    return xml;
  };

  // ---- import ----
  function parseXml(text) {
    if (typeof DOMParser !== 'undefined') { const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error('That file is not valid XML'); return doc; }
    throw new Error('No XML parser');
  }
  const t = (el, name) => { const n = el.getElementsByTagName(name)[0]; return n && n.parentNode === el ? n.textContent.trim() : ''; };
  const children = (el, name) => el ? [...el.getElementsByTagName(name)].filter(n => n.parentNode.parentNode === el || n.parentNode === el) : [];
  /* Returns an array of batch objects (a BeerXML file may hold several recipes). refs used to snap names onto the app's tables. */
  X.importRecipes = function (text, refs, matcher) {
    const doc = parseXml(text);
    const out = [];
    for (const r of [...doc.getElementsByTagName('RECIPE')]) {
      const gal = num(t(r, 'BATCH_SIZE')) / L_PER_GAL, boilGal = num(t(r, 'BOIL_SIZE')) / L_PER_GAL;
      const snap = (name, vocab) => { if (!matcher) return name; const m = matcher(name, vocab, 1); return m.length && m[0].score >= 60 ? m[0].name : name; };
      const b = {
        name: t(r, 'NAME') || 'Imported recipe', style: (() => { const s = r.getElementsByTagName('STYLE')[0]; return s ? t(s, 'NAME') : ''; })(),
        brewDate: t(r, 'DATE') || '', batchGal: Math.round(gal * 100) / 100 || 5.5, boilGal: Math.round(boilGal * 100) / 100 || 7, boilMin: num(t(r, 'BOIL_TIME')) || 60,
        efficiency: num(t(r, 'EFFICIENCY')) || 72, og: t(r, 'OG') ? num(t(r, 'OG')) : '', fg: t(r, 'FG') ? num(t(r, 'FG')) : '', notes: t(r, 'NOTES') || '', status: 'Planned',
        fermentables: [], hops: [], dryHops: [], yeast: '', salts: [], extras: [], mashF: 152
      };
      const fermsEl = r.getElementsByTagName('FERMENTABLES')[0];
      for (const f of children(fermsEl, 'FERMENTABLE')) b.fermentables.push({ name: snap(t(f, 'NAME'), (refs.fermentables || []).map(x => x.name)), lb: Math.round(num(t(f, 'AMOUNT')) / KG_PER_LB * 100) / 100, lovibond: num(t(f, 'COLOR')), ppg: Math.round(num(t(f, 'YIELD')) / 100 * 46.21) });
      const hopsEl = r.getElementsByTagName('HOPS')[0];
      for (const hp of children(hopsEl, 'HOP')) {
        const use = t(hp, 'USE'); if (/dry hop/i.test(use)) { const mins = num(t(hp, 'TIME')); b.dryHops.push({ name: snap(t(hp, 'NAME'), (refs.hops || []).map(x => x.name)), oz: Math.round(num(t(hp, 'AMOUNT')) / KG_PER_OZ * 100) / 100, alpha: num(t(hp, 'ALPHA')), type: /leaf|plug/i.test(t(hp, 'FORM')) ? 'leaf' : 'pellet', day: '', days: mins >= 1440 ? Math.round(mins / 1440) : (mins > 0 && mins <= 30 ? mins : 4) }); continue; }
        b.hops.push({ name: snap(t(hp, 'NAME'), (refs.hops || []).map(x => x.name)), oz: Math.round(num(t(hp, 'AMOUNT')) / KG_PER_OZ * 100) / 100, alpha: num(t(hp, 'ALPHA')), minutes: num(t(hp, 'TIME')), type: /leaf|plug/i.test(t(hp, 'FORM')) ? 'leaf' : 'pellet', whirlpool: /aroma|whirlpool/i.test(use) && num(t(hp, 'TIME')) > 0 });
      }
      const y = r.getElementsByTagName('YEAST')[0]; if (y) b.yeast = snap(t(y, 'NAME'), (refs.yeast || []).map(x => x.name));
      const miscs = r.getElementsByTagName('MISCS')[0];
      for (const m of children(miscs, 'MISC')) { const name = t(m, 'NAME'); const g = num(t(m, 'AMOUNT')) * 1000; if (/gypsum|calcium chloride|epsom|salt|baking soda|chalk/i.test(name) && g) { const key = /gypsum/i.test(name) ? 'Gypsum (CaSO4)' : /calcium chloride/i.test(name) ? 'Calcium chloride (CaCl2)' : /epsom/i.test(name) ? 'Epsom salt (MgSO4)' : /baking/i.test(name) ? 'Baking soda (NaHCO3)' : /chalk/i.test(name) ? 'Chalk (CaCO3)' : 'Table salt (NaCl)'; b.salts.push({ salt: key, grams: Math.round(g * 10) / 10 }); } else if (name) b.extras.push(name); }
      const step = r.getElementsByTagName('MASH_STEP')[0]; if (step && t(step, 'STEP_TEMP')) b.mashF = Math.round(cToF(num(t(step, 'STEP_TEMP'))));
      out.push(b);
    }
    if (!out.length) throw new Error('No recipes found in that file');
    return out;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = X; else root.BeerXML = X;
})(typeof window !== 'undefined' ? window : globalThis);
