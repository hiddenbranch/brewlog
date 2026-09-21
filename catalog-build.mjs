#!/usr/bin/env node
/* Builds catalog.json: the product and pack numbers that let the Shop screen fill a cart in one tap.
   Shopify shops publish their products at /products.json. This reads that feed for each shop, matches the app's ingredients
   to products (shop.js does the matching, so the tests cover it), and writes:
     catalog.json        what the app loads (it fetches this at start-up, so no version bump is needed when it changes)
     catalog-report.txt  what matched, what did not, shop by shop: send this back if something looks wrong
   Needs Node 18 or newer and nothing else.
     node catalog-build.mjs                          every shop in shop.js
     node catalog-build.mjs https://shop.example     also try these (any Shopify homebrew shop)
     node catalog-build.mjs --only northernbrewer    just one
   Normally this is run by GitHub itself (.github/workflows/catalog.yml): monthly, on a button in the Actions tab, and whenever shop.js, data.js
   or this file change. It can also be run by hand anywhere Node is installed. */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const S = require('./shop.js'), D = require('./data.js');
const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const extra = args.filter(a => /^https?:\/\//.test(a));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shops = S.VENDORS.filter(v => v.id !== 'amazon').map(v => ({ id: v.id, name: v.name, region: v.region, origin: new URL(v.url).origin }))
  .concat(extra.map(u => { const o = new URL(u).origin, id = new URL(u).hostname.replace(/^www\./, '').split('.')[0]; return { id, name: id, region: 'US', origin: o }; }))
  .filter(s => !only || s.id === only);

async function feed(origin) {
  const all = [];
  for (let page = 1; page <= 60; page++) {
    const res = await fetch(`${origin}/products.json?limit=250&page=${page}`, { headers: { 'User-Agent': 'BrewLog catalog builder (homebrew recipe app; reads the public product feed a few times a month)', Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) { if (page === 1) throw new Error(`HTTP ${res.status}`); break; }
    const type = res.headers.get('content-type') || ''; if (!/json/.test(type)) { if (page === 1) throw new Error('no product feed here (not a Shopify shop, or the feed is switched off)'); break; }
    const data = await res.json(); if (!data || !Array.isArray(data.products)) { if (page === 1) throw new Error('unexpected feed format'); break; }
    if (!data.products.length) break;
    all.push(...data.products); process.stdout.write(`\r  ${all.length} products`);
    if (data.products.length < 250) break;
    await sleep(500);
  }
  process.stdout.write('\n');
  return all;
}

const catalog = { built: new Date().toISOString().slice(0, 10), vendors: {} }, report = [`Brew Log catalog, built ${catalog.built}`, ''];
const refs = { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }, wanted = refs.fermentables.length + refs.hops.length + refs.yeast.length;
for (const shop of shops) {
  console.log(`${shop.name}  ${shop.origin}`);
  try {
    const products = await feed(shop.origin);
    const built = S.buildCatalogItems(products, refs), n = Object.keys(built.items).length;
    report.push(`== ${shop.name} (${shop.origin}): ${products.length} products read, ${n} of ${wanted} ingredients matched`, '');
    if (n >= 20) catalog.vendors[shop.id] = { name: shop.name, origin: shop.origin, region: shop.region, items: built.items };
    else report.push('  Too few matches to offer a cart here; left out of catalog.json.', '');
    report.push('  MATCHED', ...built.matched.map(([ing, title]) => `    ${ing}  ->  ${title}  [${built.items[ing].map(v => `${v.size} ${v.unit}${v.form && v.form !== 'pellet' ? ' ' + v.form : ''}${v.milled === true ? ' milled' : v.milled === false ? ' unmilled' : ''}${v.price !== null ? ' $' + v.price : ''}`).join(', ')}]`), '', '  NOT FOUND (with the nearest titles the shop does have, if any)', ...built.unmatched.map(x => '    ' + x + (built.near[x] ? '   ~ ' + built.near[x].join(' | ') : '')), '');
    console.log(`  ${n} of ${wanted} ingredients matched${n >= 20 ? '' : ' (too few: left out)'}`);
  } catch (e) { console.log(`  skipped: ${e.message}`); report.push(`== ${shop.name} (${shop.origin}): skipped, ${e.message}`, ''); }
}
writeFileSync('catalog.json', JSON.stringify(catalog));
writeFileSync('catalog-report.txt', report.join('\n'));
const ok = Object.keys(catalog.vendors);
console.log(ok.length ? `\ncatalog.json written with carts for: ${ok.map(id => catalog.vendors[id].name).join(', ')}\ncatalog-report.txt has the detail.` : '\nNo shop gave a usable feed, so catalog.json is empty and the app carries on without cart buttons. catalog-report.txt says why for each shop.');
