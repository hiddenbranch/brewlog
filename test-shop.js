const S = require('./shop.js'); const assert = require('assert');
// no tag: a clean link with no tracking
let u = S.searchUrl('morebeer', 'Citra hops', {});
assert(u.startsWith('https://www.morebeer.com/search/') && u.includes('q=Citra+hops') && !u.includes('aff='), 'clean link: ' + u);
// with a tag
u = S.searchUrl('morebeer', 'Citra hops', { morebeer: 'phil123' });
assert(u.includes('aff=phil123'), 'vendor tag applied: ' + u);
u = S.searchUrl('amazon', 'ball lock keg', { amazon: 'secondlight-20' });
assert(u.includes('tag=secondlight-20') && u.includes('k=ball+lock+keg'), 'amazon tag: ' + u);
// another vendor's tag must not leak
u = S.searchUrl('northernbrewer', 'US-05', { amazon: 'secondlight-20' });
assert(!u.includes('secondlight-20'), 'tags do not leak between vendors');
assert.strictEqual(S.searchUrl('nope', 'x', {}), null);
assert.strictEqual(S.hasAnyTag({}), false); assert.strictEqual(S.hasAnyTag({ amazon: '' }), false); assert.strictEqual(S.hasAnyTag({ amazon: 'x' }), true);
// shopping list merges repeat hop additions
const batch = { fermentables: [{ name: 'Maris Otter', lb: 10 }, { name: 'Crystal / Caramel 60L', lb: 1 }], hops: [{ name: 'Citra', oz: 1, minutes: 60 }, { name: 'Citra', oz: 2, minutes: 5 }, { name: 'Mosaic', oz: 2, minutes: 0 }], yeast: 'US-05 / WLP001 / Wyeast 1056', salts: [{ salt: 'Gypsum (CaSO4)', grams: 4 }], extras: ['Star San'] };
const list = S.shoppingList(batch);
const citra = list.find(l => l.term === 'Citra hops');
assert.strictEqual(citra.qty, '3 oz', 'merged hop quantity: ' + citra.qty);
assert(list.find(l => l.item === 'Crystal / Caramel 60L').term === 'Crystal', 'search term drops the slash variant');
assert(list.find(l => l.group === 'Yeast').term.startsWith('US-05'), 'yeast search term');
assert.strictEqual(list.filter(l => l.group === 'Hops').length, 2, 'two hop lines after merge');
const text = S.listAsText(list);
assert(text.includes('FERMENTABLES') && text.includes('- 3 oz  Citra (multiple additions)'), 'text list: ' + text);
console.log('shop tests passed');

// ---- affiliate links: the three shapes a programme hands out ----
const dest = 'https://www.morebeer.com/search/?q=Citra+hops';
assert.strictEqual(S.affiliate(dest, 'morebeer', { morebeer: 'https://net.example/click?id=9&url={url}' }), 'https://net.example/click?id=9&url=' + encodeURIComponent(dest), 'a network deep link wraps the destination');
assert(S.affiliate(dest, 'morebeer', { morebeer: 'a_aid=abc123' }).endsWith('&a_aid=abc123'), 'a parameter is added to the shop\'s own link');
assert.strictEqual(S.affiliate(dest, 'morebeer', {}), dest, 'no tag, no change');
assert(/no \{url\}/.test(S.tagProblem('morebeer', 'https://net.example/click?id=9')), 'a link that cannot carry a destination is flagged'); assert.strictEqual(S.tagProblem('morebeer', 'a_aid=abc'), '');

// ---- one-tap carts: matching the app's ingredients to what shops call them ----
/* Titles follow the way MoreBeer, Northern Brewer and Adventures in Homebrewing actually name things (see catalog-report.txt). */
const D = require('./data.js');
let nextId = 1000;
const prod = (title, type, variants, options) => ({ title, product_type: type, tags: [], options: (options || ['Size']).map(name => ({ name })),
  variants: variants.map(v => ({ id: nextId++, title: v[0], option1: v[0].split(' / ')[0], option2: v[0].split(' / ')[1] || null, price: String(v[1]), grams: v[2] || 0, available: v[3] !== false })) });
const hopSizes = [['1 oz.', 2.99, 28], ['2 oz.', 4.99, 57], ['8 oz.', 14.99, 227], ['1 lb.', 24.99, 454]], grainSizes = [['1 lb. / Unmilled', 2.69], ['1 lb. / Milled', 2.79], ['10 lb. / Unmilled', 19.69], ['10 lb. / Milled', 20.69], ['50 lb. / Unmilled', 62.99]];
const feed = [
  prod('2-Row Malt - Briess Malting', 'Grain', grainSizes, ['Size', 'Milling']), prod('Pale Ale Malt - Rahr Malting', 'Grain', grainSizes, ['Size', 'Milling']), prod('Maris Otter Malt - Thomas Fawcett Malting', 'Grain', grainSizes, ['Size', 'Milling']),
  prod('Golden Promise Malt | Simpsons Malt', 'Grain', grainSizes, ['Size', 'Milling']), prod('Caramel 10L Malt - Briess Malting', 'Grain', grainSizes, ['Size', 'Milling']), prod('Caramel 60L Malt - Briess Malting', 'Grain', grainSizes, ['Size', 'Milling']),
  prod('Midnight Wheat Malt - Briess Malting', 'Grain', grainSizes, ['Size', 'Milling']), prod('White Wheat Malt - Briess Malting', 'Grain', grainSizes, ['Size', 'Milling']), prod('Flaked Rye', 'Grain', [['1 lb.', 2.99], ['5 lb.', 12.99]]), prod('Rye Malt - Briess Malting', 'Grain', grainSizes, ['Size', 'Milling']),
  prod('Munich Malt - BestMalz', 'Grain', grainSizes, ['Size', 'Milling']),
  prod('Briess CBW® Pilsen Light | Concentrated Brewers Wort | Dry Malt Extract | DME | 2 SRM', 'Malt Extract', [['1 lb', 7.49], ['3 lb', 17.99]]), prod('Briess CBW® Golden Light | Concentrated Brewers Wort | Dry Malt Extract | DME | 4 SRM', 'Malt Extract', [['1 lb', 7.49], ['3 lb', 17.99]]),
  prod('Briess CBW® Sparkling Amber | Concentrated Brewers Wort | Dry Malt Extract | DME | 10 SRM', 'Malt Extract', [['1 lb', 7.49], ['3 lb', 17.99]]), prod('Briess CBW® Traditional Dark | Concentrated Brewers Wort | Dry Malt Extract | DME | 30 SRM', 'Malt Extract', [['1 lb', 7.49], ['3 lb', 17.99]]),
  prod('Muntons DME Extra Light - Dry Malt Extract', 'Malt Extract', [['1 lb', 9.99], ['3 lb', 24.99]]),
  prod('Briess CBW® Sparkling Amber | Concentrated Brewers Wort | Liquid Malt Extract | LME | 11 SRM', 'Malt Extract', [['3.3 lb', 14.99]]), prod('Briess CBW® Traditional Dark | Concentrated Brewers Wort | Liquid Malt Extract | LME | 30 SRM', 'Malt Extract', [['3.3 lb', 14.99]]),
  prod('Briess CBW® Bavarian Wheat | Concentrated Brewers Wort | Liquid Malt Extract | LME | 3 SRM', 'Malt Extract', [['3.3 lb', 14.99]]), prod('Briess CBW® Munich | Concentrated Brewers Wort | Liquid Malt Extract | LME | 8 SRM', 'Malt Extract', [['3.3 lb', 14.99]]),
  prod('Briess CBW® Pilsen Light | Concentrated Brewers Wort | Liquid Malt Extract | LME | 2 SRM', 'Malt Extract', [['3.3 lb', 14.99]]), prod('Rice Syrup Solids', 'Adjunct', [['1 lb', 5.99]]),
  prod('Krush™ Brand HBC 586 | Pellet Hops', 'Hops', hopSizes), prod('Krush™ Brand HBC 586 | Cryo Hops®', 'Hops', hopSizes), prod('Nectaron® | Pellet Hops', 'Hops', hopSizes), prod('Talus® Brand HBC 692 | Pellet Hops', 'Hops', hopSizes),
  prod('Ekuanot® Brand HBC 366 | Pellet Hops', 'Hops', hopSizes), prod('Lemondrop™ | Pellet Hops', 'Hops', hopSizes), prod('Cashmere | Pellet Hops', 'Hops', hopSizes), prod('Waimea™ | Pellet Hops', 'Hops', hopSizes), prod('Rakau™ | Pellet Hops', 'Hops', hopSizes),
  prod('Bravo | Pellet Hops', 'Hops', hopSizes), prod('Galena | Pellet Hops', 'Hops', hopSizes), prod('German Herkules | Pellet Hops', 'Hops', hopSizes), prod('US Herkules | Pellet Hops', 'Hops', hopSizes), prod('UK First Gold | Pellet Hops', 'Hops', hopSizes),
  prod('Magnum | Pellet Hops', 'Hops', hopSizes), prod('Citra® Brand HBC 394 | Pellet Hops', 'Hops', hopSizes), prod('Hallertau Blanc | Pellet Hops', 'Hops', hopSizes), prod('German Hallertau Mittelfruh | Pellet Hops', 'Hops', hopSizes),
  prod('Fermentis | SafAle™ US-05 American Ale | Dry Beer Yeast', 'Yeast', [['11.5 g', 6.79], ['500 g', 89.99]]), prod('Fermentis | SafAle™ S-04 English Ale | Dry Beer Yeast', 'Yeast', [['11.5 g', 6.79]]), prod('Fermentis | SafAle™ K-97 German Ale | Dry Beer Yeast', 'Yeast', [['11.5 g', 6.79]]),
  prod('Fermentis | SafAle™ T-58 | Dry Beer Yeast', 'Yeast', [['11.5 g', 6.79]]), prod('Fermentis | SafAle™ WB-06 | Dry Beer Yeast', 'Yeast', [['11.5 g', 6.79]]), prod('Fermentis | SafAle™ BE-134 | Dry Beer Yeast', 'Yeast', [['11.5 g', 6.79]]),
  prod('Fermentis | SafAle™ BE-256 | Dry Beer Yeast', 'Yeast', [['11.5 g', 6.79]]), prod('Fermentis | SafAle™ S-33 | Dry Beer Yeast', 'Yeast', [['11.5 g', 6.79]]), prod('Fermentis | SafLager™ S-23 | Dry Beer Yeast', 'Yeast', [['11.5 g', 7.79]]),
  prod('Fermentis | SafLager™ S-189 | Dry Beer Yeast', 'Yeast', [['11.5 g', 7.79]]), prod('Fermentis | SafLager™ W-34/70 Bohemian Lager | Dry Beer Yeast', 'Yeast', [['11.5 g', 8.79]]), prod('LalBrew® BRY-97 West Coast Ale Yeast | Lallemand', 'Yeast', [['11 g', 6.99]]),
  prod('Campden Tablets (Potassium Metabisulfite)', 'Additives', [['25 tablets', 2.49], ['100 tablets', 5.49]]), prod('Whirlfloc Tablets', 'Finings', [['10 tablets', 2.99]]), prod('Citra Pale Ale All Grain Recipe Kit', 'Kits', [['5 gal', 39.99]])
];
const built = S.buildCatalogItems(feed, { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }), got = Object.fromEntries(built.matched);
const is = (name, title) => assert.strictEqual(got[name], title, `${name} -> ${got[name]}`);
// the ingredients added in 1.9.0 land on the right products
is('Pale ale malt', 'Pale Ale Malt - Rahr Malting'); is('Golden Promise', 'Golden Promise Malt | Simpsons Malt'); is('Crystal / Caramel 10L', 'Caramel 10L Malt - Briess Malting'); is('Midnight wheat', 'Midnight Wheat Malt - Briess Malting'); is('Flaked rye', 'Flaked Rye');
is('Amber DME', 'Briess CBW® Sparkling Amber | Concentrated Brewers Wort | Dry Malt Extract | DME | 10 SRM'); is('Dark DME', 'Briess CBW® Traditional Dark | Concentrated Brewers Wort | Dry Malt Extract | DME | 30 SRM'); is('Extra light DME', 'Muntons DME Extra Light - Dry Malt Extract');
is('Amber LME', 'Briess CBW® Sparkling Amber | Concentrated Brewers Wort | Liquid Malt Extract | LME | 11 SRM'); is('Dark LME', 'Briess CBW® Traditional Dark | Concentrated Brewers Wort | Liquid Malt Extract | LME | 30 SRM');
is('Wheat LME', 'Briess CBW® Bavarian Wheat | Concentrated Brewers Wort | Liquid Malt Extract | LME | 3 SRM'); is('Munich LME', 'Briess CBW® Munich | Concentrated Brewers Wort | Liquid Malt Extract | LME | 8 SRM'); is('Rice syrup solids', 'Rice Syrup Solids');
for (const [n, t] of [['Nectaron', 'Nectaron® | Pellet Hops'], ['Talus', 'Talus® Brand HBC 692 | Pellet Hops'], ['Ekuanot', 'Ekuanot® Brand HBC 366 | Pellet Hops'], ['Lemondrop', 'Lemondrop™ | Pellet Hops'], ['Cashmere', 'Cashmere | Pellet Hops'], ['Waimea', 'Waimea™ | Pellet Hops'], ['Rakau', 'Rakau™ | Pellet Hops'], ['Bravo', 'Bravo | Pellet Hops'], ['Galena', 'Galena | Pellet Hops'], ['First Gold', 'UK First Gold | Pellet Hops']]) is(n, t);
is('Krush', 'Krush™ Brand HBC 586 | Pellet Hops | Krush™ Brand HBC 586 | Cryo Hops®');   // one product for each form the shop sells
assert(built.items.Krush.some(v => v.form === 'cryo') && built.items.Krush.some(v => v.form === 'pellet'));
is('Herkules', 'German Herkules | Pellet Hops');                                          // the German one when a shop sells both
for (const code of ['K-97', 'T-58', 'WB-06', 'BE-134', 'BE-256', 'S-33', 'S-23', 'S-189']) { const name = D.YEAST.find(y => y.name.startsWith(code + ' /')).name; assert(got[name] && got[name].includes(code), `${name} -> ${got[name]}`); }
// and the ones that were already there are not disturbed by the newcomers
is('2-row pale malt', '2-Row Malt - Briess Malting'); is('Maris Otter', 'Maris Otter Malt - Thomas Fawcett Malting'); is('Munich malt', 'Munich Malt - BestMalz'); is('Wheat malt', 'White Wheat Malt - Briess Malting'); is('Rye malt', 'Rye Malt - Briess Malting');
is('Crystal / Caramel 60L', 'Caramel 60L Malt - Briess Malting'); is('Magnum', 'Magnum | Pellet Hops'); is('Citra', 'Citra® Brand HBC 394 | Pellet Hops'); is('Hallertau Mittelfrüh', 'German Hallertau Mittelfruh | Pellet Hops'); is('Hallertau Blanc', 'Hallertau Blanc | Pellet Hops');
is('US-05 / WLP001 / Wyeast 1056', 'Fermentis | SafAle™ US-05 American Ale | Dry Beer Yeast'); is('S-04 / WLP002 / Wyeast 1968', 'Fermentis | SafAle™ S-04 English Ale | Dry Beer Yeast'); is('W-34/70 / WLP830 / Wyeast 2124', 'Fermentis | SafLager™ W-34/70 Bohemian Lager | Dry Beer Yeast'); is('LalBrew BRY-97', 'LalBrew® BRY-97 West Coast Ale Yeast | Lallemand');
assert.strictEqual(built.items['US-05 / WLP001 / Wyeast 1056'].length, 1, 'the 500 g brick is left for breweries');
assert(/Pilsen Light|Golden Light/.test(got['Light DME']) && /Dry Malt Extract/.test(got['Light DME']), 'Light DME is a light DME: ' + got['Light DME']); assert(/Pilsen Light.*LME/.test(got['Light LME']), 'Light LME: ' + got['Light LME']);
assert(!Object.values(got).some(t => /Recipe Kit/.test(t)), 'a recipe kit is never taken for an ingredient');
// a cart: the cheapest packs that cover the recipe, milled or not, and the link that fills it
S.useCatalog({ built: '2026-11-10', vendors: { testshop: { name: 'Test Shop', origin: 'https://shop.example', region: 'US', items: built.items } } });
const brew = { batchGal: 5.5, fermentables: [{ name: 'Pale ale malt', lb: 11 }, { name: 'Crystal / Caramel 10L', lb: 0.75 }], hops: [{ name: 'Krush', oz: 1, minutes: 10, type: 'pellet' }, { name: 'Krush', oz: 3, minutes: 0, type: 'cryo', whirlpool: true }], dryHops: [{ name: 'Nectaron', oz: 2 }], yeast: 'K-97 / SafAle K-97', salts: [{ salt: 'Gypsum (CaSO4)', grams: 4 }] };
const cart = S.cartFor('testshop', brew, { testshop: 'ref=phil' }, { milled: true, yeastPacks: 1 });
assert(cart.url.startsWith('https://shop.example/cart/') && /storefront=true/.test(cart.url) && /ref=phil/.test(cart.url), 'cart link: ' + cart.url);
const line = n => cart.lines.find(l => l.item === n);
assert.deepStrictEqual(line('Pale ale malt').packs.map(p => [p.qty, p.size]), [[1, 10], [1, 1]], 'one ten and one single, not eleven singles'); assert(line('Pale ale malt').packs.every(p => /Milled/.test(p.title)), 'milled, as asked');
assert.strictEqual(cart.lines.filter(l => l.item === 'Krush').length, 2, 'pellet and cryo Krush are bought separately'); assert.strictEqual(line('Nectaron').got, 2);
assert.deepStrictEqual(cart.missing.map(m => m.item), ['Gypsum (CaSO4)'], 'what the cart cannot cover is said, not hidden');
assert(cart.total > 30 && cart.total < 70, 'a believable total: ' + cart.total);
assert(S.cartFor('testshop', brew, {}, { milled: false }).lines.find(l => l.item === 'Pale ale malt').packs.every(p => /Unmilled/.test(p.title)));
assert.strictEqual(S.cartFor('nowhere', brew, {}), null);
S.useCatalog(null);
console.log('cart and catalog tests passed');
