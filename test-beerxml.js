const X = require('./beerxml.js'); const D = require('./data.js'); const B = require('./core.js'); const assert = require('assert');
const { JSDOM } = require('jsdom'); global.DOMParser = new JSDOM('').window.DOMParser;
const batch = { name: 'Test IPA', style: 'American IPA', brewDate: '2026-09-14', batchGal: 5.5, boilGal: 7, boilMin: 60, efficiency: 72, og: 1.062, fg: 1.012, notes: 'Dry hop day 5 with 2 oz Mosaic & Citra',
  fermentables: [{ name: '2-row pale malt', lb: 11 }, { name: 'Crystal / Caramel 40L', lb: 1 }], hops: [{ name: 'Columbus / CTZ', oz: 1, alpha: 15, minutes: 60, type: 'pellet' }, { name: 'Citra', oz: 2, alpha: 12, minutes: 10, type: 'pellet' }, { name: 'Mosaic', oz: 2, alpha: 12.5, minutes: 15, type: 'pellet', whirlpool: true }],
  yeast: 'US-05 / WLP001 / Wyeast 1056', salts: [{ salt: 'Gypsum (CaSO4)', grams: 4 }], mashF: 152 };
const xml = X.exportRecipe(batch, { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST });
assert(xml.startsWith('<?xml') && xml.includes('<RECIPES><RECIPE>'), 'well-formed start');
assert(xml.includes('<NAME>Test IPA</NAME>') && xml.includes('<BATCH_SIZE>20.820</BATCH_SIZE>'), 'batch size in litres');
assert(xml.includes('<AMOUNT>4.9895</AMOUNT>'), '11 lb in kg');
assert(xml.includes('<ALPHA>15</ALPHA>') && xml.includes('<TIME>60</TIME>'), 'hop alpha and time');
assert(xml.includes('&amp;'), 'ampersand escaped');
assert(xml.includes('<STEP_TEMP>66.67</STEP_TEMP>'), 'mash temp in C');
assert(xml.includes('<TYPE>Water Agent</TYPE>'), 'salt exported as misc');
assert(!/<TYPE>Extract<\/TYPE>\s*$/.test(xml) && xml.includes('<TYPE>All Grain</TYPE>'), 'recipe type');
// round trip
const back = X.importRecipes(xml, { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }, B.matchVocab);
assert.strictEqual(back.length, 1);
const r = back[0];
assert.strictEqual(r.name, 'Test IPA'); assert.strictEqual(r.style, 'American IPA');
assert.strictEqual(r.batchGal, 5.5); assert.strictEqual(r.boilGal, 7); assert.strictEqual(r.og, 1.062);
assert.strictEqual(r.fermentables[0].name, '2-row pale malt'); assert.strictEqual(r.fermentables[0].lb, 11);
assert.strictEqual(r.hops[0].name, 'Columbus / CTZ'); assert.strictEqual(r.hops[0].minutes, 60); assert.strictEqual(r.hops[2].whirlpool, true);
assert.strictEqual(r.yeast, 'US-05 / WLP001 / Wyeast 1056'); assert.strictEqual(r.salts[0].grams, 4); assert.strictEqual(r.mashF, 152);
// a foreign file with different naming snaps onto the tables where it can
const foreign = `<?xml version="1.0"?><RECIPES><RECIPE><NAME>Pliny clone</NAME><VERSION>1</VERSION><TYPE>All Grain</TYPE><BATCH_SIZE>20.82</BATCH_SIZE><BOIL_SIZE>26.5</BOIL_SIZE><BOIL_TIME>90</BOIL_TIME><EFFICIENCY>75</EFFICIENCY>
<STYLE><NAME>Double IPA</NAME></STYLE>
<FERMENTABLES><FERMENTABLE><NAME>Pale Malt (2 Row) US</NAME><AMOUNT>6.0</AMOUNT><YIELD>79</YIELD><COLOR>2</COLOR></FERMENTABLE><FERMENTABLE><NAME>Corn Sugar (Dextrose)</NAME><AMOUNT>0.3</AMOUNT><YIELD>100</YIELD><COLOR>0</COLOR></FERMENTABLE></FERMENTABLES>
<HOPS><HOP><NAME>Columbus (Tomahawk)</NAME><ALPHA>15.5</ALPHA><AMOUNT>0.099</AMOUNT><USE>Boil</USE><TIME>90</TIME><FORM>Pellet</FORM></HOP><HOP><NAME>Simcoe</NAME><ALPHA>13</ALPHA><AMOUNT>0.057</AMOUNT><USE>Dry Hop</USE><TIME>7</TIME></HOP></HOPS>
<YEASTS><YEAST><NAME>Safale American</NAME><TYPE>Ale</TYPE></YEAST></YEASTS><MISCS></MISCS>
<MASH><MASH_STEPS><MASH_STEP><STEP_TEMP>65</STEP_TEMP></MASH_STEP></MASH_STEPS></MASH></RECIPE></RECIPES>`;
const f = X.importRecipes(foreign, { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST }, B.matchVocab)[0];
assert.strictEqual(f.boilMin, 90); assert.strictEqual(f.efficiency, 75);
assert.strictEqual(f.fermentables[0].name, '2-row pale malt', 'snapped: ' + f.fermentables[0].name);
assert.strictEqual(f.fermentables[1].name, 'Corn sugar (dextrose)', 'snapped sugar: ' + f.fermentables[1].name);
assert.strictEqual(f.hops[0].name, 'Columbus / CTZ', 'snapped hop: ' + f.hops[0].name);
assert.strictEqual(f.hops.length, 1, 'dry hop moved out of the boil list');
assert(f.extras[0].startsWith('Dry hop: Simcoe'), 'dry hop kept as an extra: ' + f.extras[0]);
assert.strictEqual(f.mashF, 149);
assert.throws(() => X.importRecipes('<not xml', {}, null), /valid XML/);
assert.throws(() => X.importRecipes('<RECIPES></RECIPES>', {}, null), /No recipes/);
console.log('beerxml tests passed');
