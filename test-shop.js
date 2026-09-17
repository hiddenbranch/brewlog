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
