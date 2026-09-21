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
  /* tags: { morebeer: 'abc', amazon: 'mytag-20' } */
  S.searchUrl = function (vendorId, term, tags) {
    const v = S.vendor(vendorId); if (!v) return null;
    const u = new URL(v.url);
    u.searchParams.set(v.param, String(term || '').trim());
    const tag = tags && tags[vendorId];
    if (tag) {
      if (vendorId === 'amazon') u.searchParams.set('tag', tag);
      else u.searchParams.set('aff', tag);
    }
    return u.toString();
  };
  S.hasAnyTag = tags => !!(tags && Object.values(tags).some(t => t && String(t).trim()));
  // Build a shopping list from a recipe: one line per ingredient, with a sensible search term.
  S.shoppingList = function (batch) {
    const out = [];
    (batch.fermentables || []).forEach(f => { if (f.name && !f.late) out.push({ qty: f.lb ? `${f.lb} lb` : '', item: f.name, term: f.name.replace(/\s*\/.*$/, ''), group: 'Fermentables' }); });
    (batch.hops || []).forEach(hp => { if (hp.name) out.push({ qty: hp.oz ? `${hp.oz} oz` : '', item: `${hp.name}${hp.minutes !== undefined && hp.minutes !== '' ? ' (' + hp.minutes + ' min)' : ''}`, term: hp.name + ' hops' + formTerm(hp.type), group: 'Hops' }); });
    const dry = Array.isArray(batch.dryHops) ? batch.dryHops : [];
    dry.forEach(d => { if (d.name && !d.extra) out.push({ qty: d.oz ? `${d.oz} oz` : '', item: `${d.name} (dry hop)`, term: d.name + ' hops' + formTerm(d.type), group: 'Hops' }); });
    if (batch.yeast) out.push({ qty: '1', item: batch.yeast, term: batch.yeast.split('/')[0].trim() + ' yeast', group: 'Yeast' });
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
  S.DISCLOSURE = 'Some shop links may earn a small commission at no cost to you. They never change what the app recommends.';
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.BrewShop = S;
})(typeof window !== 'undefined' ? window : globalThis);
