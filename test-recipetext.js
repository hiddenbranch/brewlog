/* Recipes as text: the formats brewers actually paste. node test-recipetext.js [-v] */
const assert = require('assert');
const R = require('./recipetext.js'), D = require('./data.js');
const refs = { fermentables: D.FERMENTABLES, hops: D.HOPS, yeast: D.YEAST };
const verbose = process.argv.includes('-v');
const show = (label, p) => { if (verbose) { console.log('\n== ' + label); console.log(JSON.stringify(Object.assign({}, p, { fermentables: p.fermentables.map(f => `${f.lb} lb ${f.name}${f.known ? '' : ' ?'}`), hops: p.hops.map(h => `${h.oz} oz ${h.name}${h.known ? '' : ' ?'} ${h.alpha}% ${h.whirlpool ? 'WP' : h.minutes + 'min'} ${h.type}`), dryHops: p.dryHops.map(h => `${h.oz} oz ${h.name} ${h.days}d day:${h.day}`) }), null, 1)); } };
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= (tol || 0.02), `${msg || ''} expected ${b}, got ${a}`);
const ferm = (p, name) => p.fermentables.find(f => f.name === name), hop = (p, name, minutes) => p.hops.find(h => h.name === name && (minutes === undefined || h.minutes === minutes));

// ---- 1. the way people type a recipe on a forum
let p = R.parse(`Citra Pale Ale (5 gal)

10 lbs 2-row
1 lb Crystal 40
8 oz Carapils

0.5 oz Magnum (12% AA) @ 60 min
1 oz Citra @ 10 min
1 oz Citra at flameout
2 oz Citra dry hop 5 days

US-05
Mash at 152F for 60 min
OG 1.054  FG 1.011  IBU 38`, refs);
show('forum', p);
assert.strictEqual(p.name, 'Citra Pale Ale'); assert.strictEqual(p.batchGal, 5);
assert.strictEqual(ferm(p, '2-row pale malt').lb, 10); assert.strictEqual(ferm(p, 'Crystal / Caramel 40L').lb, 1); assert.strictEqual(ferm(p, 'CaraPils / Carafoam').lb, 0.5);
assert.strictEqual(p.fermentables.length, 3, 'three fermentables');
assert.strictEqual(hop(p, 'Magnum', 60).oz, 0.5); assert.strictEqual(hop(p, 'Magnum', 60).alpha, 12);
assert.strictEqual(hop(p, 'Citra', 10).oz, 1); assert.strictEqual(hop(p, 'Citra', 0).oz, 1); assert.strictEqual(p.hops.length, 3);
assert.strictEqual(p.dryHops.length, 1); assert.strictEqual(p.dryHops[0].name, 'Citra'); assert.strictEqual(p.dryHops[0].oz, 2); assert.strictEqual(p.dryHops[0].days, 5);
assert.strictEqual(p.yeast, 'US-05 / WLP001 / Wyeast 1056'); assert(p.yeastKnown);
assert.strictEqual(p.mashF, 152); assert.strictEqual(p.mashMin, 60); assert.strictEqual(p.og, 1.054); assert.strictEqual(p.fg, 1.011); assert.strictEqual(p.ibu, 38);
assert.strictEqual(p.unread.length, 0, 'nothing left unread: ' + p.unread.join(' | '));

// ---- 2. a BeerSmith text export
p = R.parse(`Recipe: Two Hearted Clone
Style: American IPA
TYPE: All Grain

Recipe Specifications
--------------------------
Batch Size (fermenter): 5.50 gal
Boil Size: 7.50 gal
Estimated OG: 1.064 SG
Estimated Color: 7.2 SRM
Estimated IBU: 55.0 IBUs
Brewhouse Efficiency: 72.00 %
Boil Time: 60 Minutes

Ingredients:
------------
Amt                   Name                                     Type          #        %/IBU
10 lbs                Pale Malt (2 Row) US (2.0 SRM)           Grain         1        76.9 %
2 lbs                 Vienna Malt (3.5 SRM)                    Grain         2        15.4 %
8.0 oz                Cara-Pils/Dextrine (2.0 SRM)             Grain         3        3.8 %
8.0 oz                Caramel/Crystal Malt - 20L (20.0 SRM)    Grain         4        3.8 %
1.00 oz               Centennial [10.00 %] - Boil 60.0 min     Hop           5        35.6 IBUs
1.00 oz               Centennial [10.00 %] - Boil 20.0 min     Hop           6        21.6 IBUs
1.00 oz               Centennial [10.00 %] - Boil 5.0 min      Hop           7        7.1 IBUs
1.0 pkg               Safale American (DCL/Fermentis #US-05)   Yeast         8        -
2.00 oz               Centennial [10.00 %] - Dry Hop 7.0 Days  Hop           9        0.0 IBUs

Mash Schedule: Single Infusion, Medium Body
Mash In           Add 16.25 qt of water at 163.7 F        152.0 F       60 min`, refs);
show('beersmith', p);
assert.strictEqual(p.name, 'Two Hearted Clone'); assert.strictEqual(p.style, 'American IPA'); assert.strictEqual(p.batchGal, 5.5, 'the fermenter volume, not the boil size');
assert.strictEqual(p.og, 1.064); assert.strictEqual(p.ibu, 55); assert.strictEqual(p.efficiency, 72); assert.strictEqual(p.boilMin, 60); assert.strictEqual(p.srm, 7.2);
assert.strictEqual(ferm(p, '2-row pale malt').lb, 10); assert.strictEqual(ferm(p, 'Vienna malt').lb, 2); assert.strictEqual(ferm(p, 'CaraPils / Carafoam').lb, 0.5); assert.strictEqual(ferm(p, 'Crystal / Caramel 20L').lb, 0.5);
assert.strictEqual(p.fermentables.length, 4); assert.strictEqual(p.hops.length, 3, 'three boil hops');
for (const m of [60, 20, 5]) { assert.strictEqual(hop(p, 'Centennial', m).oz, 1); assert.strictEqual(hop(p, 'Centennial', m).alpha, 10); }
assert.strictEqual(p.dryHops.length, 1); assert.strictEqual(p.dryHops[0].oz, 2); assert.strictEqual(p.dryHops[0].days, 7, 'dry hop 7.0 Days');
assert.strictEqual(p.yeast, 'US-05 / WLP001 / Wyeast 1056'); assert.strictEqual(p.mashF, 152, 'the rest temperature, not the 163.7F strike water');

// ---- 3. a Brewfather-style metric recipe
p = R.parse(`Hazy IPA
New England IPA
6.8% / 16.5 °P
All Grain
72% efficiency
Batch Volume: 21 L
Boil Time: 60 min
Mash Water: 18.5 L
Sparge Water: 11.2 L
Boil Volume: 26.5 L
Pre-Boil Gravity: 1.055

Vitals
Original Gravity: 1.066
Final Gravity: 1.015
IBU (Tinseth): 35
BU/GU: 0.53
Colour: 9.5 EBC

Mash
Temperature — 67 °C — 60 min

Malts (6.35 kg)
4.5 kg (70.9%) — Crisp Maris Otter — Grain — 6.5 EBC
1 kg (15.7%) — Flaked Oats — Grain — 2 EBC
600 g (9.4%) — Wheat Malt — Grain — 4 EBC
250 g (3.9%) — Carapils — Grain — 3 EBC

Hops (250 g)
10 g (12 IBU) — Magnum 12% — Boil — 60 min
50 g (15 IBU) — Citra 12.5% — Aroma — 20 min hopstand @ 80 °C
40 g (8 IBU) — Mosaic 11.5% — Aroma — 20 min hopstand @ 80 °C
75 g — Citra 12.5% — Dry Hop — 3 days
75 g — Mosaic 11.5% — Dry Hop — 3 days

Yeast
1 pkg — Lallemand (LalBrew) Verdant IPA

Fermentation
Primary — 19 °C — 10 days`, refs);
show('brewfather', p);
assert.strictEqual(p.name, 'Hazy IPA'); assert(p.metric, 'noticed it is metric');
near(p.batchGal, 5.55, 0.01, 'batch'); assert.strictEqual(p.efficiency, 72); assert.strictEqual(p.boilMin, 60);
assert.strictEqual(p.og, 1.066); assert.strictEqual(p.fg, 1.015); assert.strictEqual(p.ibu, 35); near(p.srm, 4.8, 0.05, 'EBC to SRM');
assert.strictEqual(p.mashF, 153); assert.strictEqual(p.mashMin, 60); assert.strictEqual(p.fermF, 66, 'primary at 19C');
assert.strictEqual(p.fermentables.length, 4, 'four malts, and the "Malts (6.35 kg)" heading is not one of them: ' + p.fermentables.map(f => f.name));
near(ferm(p, 'Maris Otter').lb, 9.92, 0.01); near(ferm(p, 'Flaked oats').lb, 2.2, 0.01); near(ferm(p, 'Wheat malt').lb, 1.32, 0.01); near(ferm(p, 'CaraPils / Carafoam').lb, 0.551, 0.002);
assert.strictEqual(p.hops.length, 3); near(hop(p, 'Magnum', 60).oz, 0.35, 0.01); assert.strictEqual(hop(p, 'Magnum', 60).alpha, 12);
const wp = p.hops.filter(h => h.whirlpool); assert.strictEqual(wp.length, 2); near(wp[0].oz, 1.76, 0.01); assert.strictEqual(wp[0].alpha, 12.5); assert.strictEqual(p.wpMin, 20); assert.strictEqual(p.wpTempF, 176);
assert.strictEqual(p.dryHops.length, 2); near(p.dryHops[0].oz, 2.65, 0.01); assert.strictEqual(p.dryHops[0].days, 3);
assert.strictEqual(p.yeast, 'Verdant IPA');
assert(!p.unread.some(l => /water|volume|gravity|bu\/gu/i.test(l)), 'water volumes are not left as loose ends: ' + p.unread.join(' | '));

// ---- 4. a Brewer's Friend text export
p = R.parse(`Title: Sierra Nevada Pale Ale Clone
Brew Method: All Grain
Style Name: American Pale Ale
Boil Time: 60 min
Batch Size: 5.5 gallons (fermentor volume)
Boil Size: 7 gallons
Boil Gravity: 1.042
Efficiency: 70% (brew house)

STATS:
Original Gravity: 1.053
Final Gravity: 1.012
ABV (standard): 5.36%
IBU (tinseth): 39.13
SRM (morey): 8.48

FERMENTABLES:
10 lb - American - Pale 2-Row (90.9%)
1 lb - American - Caramel / Crystal 60L (9.1%)

HOPS:
0.5 oz - Magnum, Type: Pellet, AA: 15, Use: Boil for 60 min, IBU: 25.37
1 oz - Cascade, Type: Pellet, AA: 7, Use: Boil for 10 min, IBU: 8.59
2 oz - Cascade, Type: Pellet, AA: 7, Use: Boil for 0 min

MASH GUIDELINES:
1) Infusion, Temp: 152 F, Time: 60 min, Amount: 15 qt

YEAST:
Fermentis / Safale - American Ale Yeast US-05
Starter: No
Form: Dry
Attenuation (avg): 81%
Flocculation: Medium
Optimum Temp: 54 - 77 F
Fermentation Temp: 66 F`, refs);
show('brewers friend', p);
assert.strictEqual(p.name, 'Sierra Nevada Pale Ale Clone'); assert.strictEqual(p.style, 'American Pale Ale'); assert.strictEqual(p.batchGal, 5.5); assert.strictEqual(p.efficiency, 70);
assert.strictEqual(p.og, 1.053); assert.strictEqual(p.fg, 1.012); assert.strictEqual(p.abv, 5.36); assert.strictEqual(p.ibu, 39.13); assert.strictEqual(p.srm, 8.48);
assert.strictEqual(ferm(p, '2-row pale malt').lb, 10); assert.strictEqual(ferm(p, 'Crystal / Caramel 60L').lb, 1); assert.strictEqual(p.fermentables.length, 2);
assert.strictEqual(hop(p, 'Magnum', 60).alpha, 15); assert.strictEqual(hop(p, 'Cascade', 10).oz, 1); assert.strictEqual(hop(p, 'Cascade', 0).oz, 2); assert.strictEqual(hop(p, 'Cascade', 10).alpha, 7);
assert.strictEqual(p.mashF, 152); assert.strictEqual(p.yeast, 'US-05 / WLP001 / Wyeast 1056'); assert.strictEqual(p.fermF, 66);
assert.strictEqual(p.unread.length, 0, 'unread: ' + p.unread.join(' | '));

// ---- 5. short, metric, one line holding two temperatures
p = R.parse(`Irish Stout - 23 litre batch
3.2 kg Maris Otter
500 g flaked barley
400g roasted barley
40 g East Kent Goldings (5.5%) 60 mins
1 tsp Irish moss 15 min
Wyeast 1084
Mash 66C 60 minutes, ferment at 19C`, refs);
show('metric stout', p);
assert.strictEqual(p.name, 'Irish Stout'); near(p.batchGal, 6.08, 0.01);
near(ferm(p, 'Maris Otter').lb, 7.05, 0.01); near(ferm(p, 'Flaked barley').lb, 1.1, 0.01); near(ferm(p, 'Roasted barley').lb, 0.882, 0.002);
near(hop(p, 'East Kent Golding', 60).oz, 1.41, 0.01); assert.strictEqual(hop(p, 'East Kent Golding', 60).alpha, 5.5);
assert.strictEqual(p.yeast, 'Wyeast 1084 Irish Ale / WLP004'); assert.strictEqual(p.mashF, 151); assert.strictEqual(p.mashMin, 60); assert.strictEqual(p.fermF, 66);
assert(p.other.some(l => /irish moss/i.test(l)), 'finings kept as a note, not turned into a hop');

// ---- 6. the awkward ones
const one = (line, section) => R.parse((section ? section + '\n' : 'Test beer\n') + line, refs);
// Crystal is a hop and a malt
p = one('1 lb Crystal 60L'); assert.strictEqual(p.fermentables[0].name, 'Crystal / Caramel 60L');
p = one('8 oz Crystal 40'); assert.strictEqual(p.fermentables[0].name, 'Crystal / Caramel 40L'); assert.strictEqual(p.fermentables[0].lb, 0.5);
p = one('1 oz Crystal (3.5% AA) 10 min'); assert.strictEqual(p.hops[0].name, 'Crystal'); assert.strictEqual(p.hops[0].minutes, 10); assert.strictEqual(p.hops[0].alpha, 3.5);
p = one('0.5 lb C-120'); assert.strictEqual(p.fermentables[0].name, 'Crystal / Caramel 120L');
p = one('12 oz Caramel 80'); assert.strictEqual(p.fermentables[0].name, 'Crystal / Caramel 80L'); assert.strictEqual(p.fermentables[0].lb, 0.75);
// pounds and ounces, fractions, the pound sign
p = one('9 lb 8 oz Maris Otter'); assert.strictEqual(p.fermentables[0].lb, 9.5);
p = one('10# 2-row'); assert.strictEqual(p.fermentables[0].lb, 10); assert.strictEqual(p.fermentables[0].name, '2-row pale malt');
p = one('1 1/2 oz Cascade 15 min'); assert.strictEqual(p.hops[0].oz, 1.5);
p = one('½ oz Saaz (3.5%) FWH'); assert.strictEqual(p.hops[0].oz, 0.5); assert.strictEqual(p.hops[0].minutes, 60, 'first wort counts as the whole boil');
// extracts are not the grain they are made from
p = one('3.3 lbs Briess Golden Light LME'); assert.strictEqual(p.fermentables[0].name, 'Light LME');
p = one('1 lb Pilsen Light DME'); assert.strictEqual(p.fermentables[0].name, 'Light DME');
p = one('3 lb Wheat DME'); assert.strictEqual(p.fermentables[0].name, 'Wheat DME');
p = one('6 lb Amber malt extract syrup'); assert.strictEqual(p.fermentables[0].name, 'Amber LME');
p = one('1 lb Honey Malt'); assert.strictEqual(p.fermentables[0].name, 'Honey malt');
p = one('1 lb Honey (flameout)'); assert.strictEqual(p.fermentables[0].name, 'Honey'); assert.strictEqual(p.hops.length, 0);
p = one('4 oz Pale Chocolate'); assert.strictEqual(p.fermentables[0].name, 'Pale chocolate');
p = one('2 lb White Wheat'); assert.strictEqual(p.fermentables[0].name, 'Wheat malt');
p = one('1 lb Flaked Maize'); assert.strictEqual(p.fermentables[0].name, 'Flaked corn (maize)');
p = one('8 oz Lactose (Milk Sugar)'); assert.strictEqual(p.fermentables[0].name, 'Lactose');
// hop names inside longer names
p = one('1 oz Hallertau Blanc 5 min'); assert.strictEqual(p.hops[0].name, 'Hallertau Blanc');
p = one('1 oz Hallertauer Hersbrucker 20 min'); assert.strictEqual(p.hops[0].name, 'Hersbrucker');
p = one('1 oz Hallertau 60 min'); assert.strictEqual(p.hops[0].name, 'Hallertau Mittelfrüh');
p = one('1 oz German Magnum 60 min'); assert.strictEqual(p.hops[0].name, 'Magnum');
p = one('2 oz Styrian Goldings 15 min'); assert.strictEqual(p.hops[0].name, 'Styrian Golding');
p = one('1 oz Kent Goldings 30 min'); assert.strictEqual(p.hops[0].name, 'East Kent Golding');
p = one('1 oz Northern Brewer 60 min'); assert.strictEqual(p.hops[0].name, 'Northern Brewer');
p = one('1 oz HBC 586 whirlpool 20 min at 170F'); assert.strictEqual(p.hops[0].name, 'Krush'); assert(p.hops[0].whirlpool); assert.strictEqual(p.wpTempF, 170); assert.strictEqual(p.wpMin, 20);
p = one('2 oz Citra Cryo dry hop day 2'); assert.strictEqual(p.dryHops[0].type, 'cryo'); assert.strictEqual(p.dryHops[0].day, 2);
p = one('0.5 oz Warrior - bittering 60'); assert.strictEqual(p.hops[0].name, 'Warrior'); assert.strictEqual(p.hops[0].minutes, 60);
p = one('1 oz Cascade'); assert.strictEqual(p.hops[0].name, 'Cascade'); assert.strictEqual(p.hops[0].minutes, '', 'no time given stays blank rather than guessed');
p = one('1 oz Zappa 10 min'); assert.strictEqual(p.hops[0].name, 'Zappa', 'a hop the app has never heard of is kept as typed'); assert(!p.hops[0].known);
// under a heading the heading decides
p = one('1 oz Amarillo', 'Dry hops'); assert.strictEqual(p.dryHops.length, 1);
p = one('2 lb Munich 10L', 'Grain bill'); assert.strictEqual(p.fermentables[0].name, 'Munich malt');
p = one('1 lb Weyermann Carared', 'Fermentables'); assert.strictEqual(p.fermentables[0].name, 'Weyermann Carared', 'unknown malt kept as typed'); assert(!p.fermentables[0].known);
// yeast by number, by name, and not by accident
for (const [text, want] of [['Safale S-04', 'S-04 / WLP002 / Wyeast 1968'], ['WLP001 California Ale', 'US-05 / WLP001 / Wyeast 1056'], ['Wyeast 1318 London Ale III', 'Wyeast 1318 London Ale III'], ['2 packs W-34/70', 'W-34/70 / WLP830 / Wyeast 2124'],
  ['Saflager 34/70', 'W-34/70 / WLP830 / Wyeast 2124'], ['Lallemand Nottingham', 'Nottingham'], ['Lutra kveik', 'Lutra Kveik'], ['11.5 g SafAle K-97', 'K-97 / SafAle K-97'], ['Fermentis S-23', 'S-23 / SafLager S-23'], ['1 pkg BE-134', 'BE-134 / SafAle BE-134']]) {
  p = one(text); assert.strictEqual(p.yeast, want, text); assert.strictEqual(p.hops.length + p.fermentables.length, 0, text + ' is not an ingredient');
}
p = one('Yeast: Imperial A38 Juice'); assert.strictEqual(p.yeast, 'Imperial A38 Juice'); assert(!p.yeastKnown, 'a strain the app does not know is kept as typed');
p = R.parse('Summer Ale\nBrewed in 2007 with hops 23 days old\n9 lb Pilsner', refs); assert.strictEqual(p.yeast, '', 'a year is not Wyeast 2007 and "hops 23" is not S-23');
// salts go to the water, finings to the notes
p = one('5 g gypsum in the mash'); assert.strictEqual(p.salts[0].salt, 'Gypsum (CaSO4)'); assert.strictEqual(p.salts[0].grams, 5);
p = one('1 Whirlfloc tablet @ 15 min'); assert.strictEqual(p.hops.length, 0); assert.strictEqual(p.other.length, 1);
p = one('0.5 oz coriander seed 5 min'); assert.strictEqual(p.hops.length, 0, 'spices are not hops'); assert.strictEqual(p.other.length, 1);
// nothing useful in, nothing invented out
p = R.parse('hello there\nthis is not a recipe', refs); assert.strictEqual(p.count, 0);
p = R.parse('', refs); assert.strictEqual(p.count, 0);

// ---- 7. into a batch
p = R.parse(`Citra Pale Ale (5 gal)\n10 lbs 2-row\n1 oz Citra @ 10 min\n1 oz Saaz FWH\nUS-05\nOG 1.054`, refs);
const blank = { batchGal: 5.5, boilGal: 7, boilMin: 60, efficiency: 72, mashF: 152, wpTempF: 175, wpMin: 20, salts: [], dryHops: [], extras: [], status: 'Planned', id: 99 };
const b = R.toBatch(p, blank, D.HOPS);
assert.strictEqual(b.name, 'Citra Pale Ale'); assert.strictEqual(b.batchGal, 5); assert.strictEqual(b.boilGal, 6.5, 'pre-boil keeps the brewer\'s own gap over the batch size');
assert.strictEqual(b.hops[0].alpha, 12, 'no alpha on the page: the variety\'s usual figure'); assert.strictEqual(b.hops[1].minutes, 60); assert.strictEqual(b.id, undefined, 'a new batch, not a copy of an old one');
assert(/OG 1\.054/.test(b.notes), 'the recipe\'s own numbers go in the notes to compare against');

// ---- 8. a recipe in a link
const batch = { name: 'Hüll & Höpfen "Weiße" <b>', style: 'Hefeweizen', batchGal: 5.5, boilGal: 7, boilMin: 75, efficiency: 70, mashF: 150, mashMin: 90, yeast: 'Wyeast 3068 Weihenstephan', fermF: 64,
  fermentables: [{ name: 'Wheat malt', lb: 5.5 }, { name: 'Pilsner malt', lb: 4.5 }, { name: 'Agave nectar', lb: 0.5, late: true }],
  hops: [{ name: 'Hallertau Mittelfrüh', oz: 1, alpha: 4.2, minutes: 60, type: 'pellet' }, { name: 'Citra', oz: 2, alpha: 12, minutes: 0, type: 'cryo', whirlpool: true }, { name: 'Saaz', oz: 0.5, alpha: 3, minutes: '', type: 'leaf' }],
  dryHops: [{ name: 'Mosaic', oz: 2, alpha: 12.5, type: 'pellet', day: 2, days: 3, added: '2026-01-01' }, { name: 'Citra', oz: 1, alpha: 12, type: 'pellet', day: '', days: 4, extra: true }],
  salts: [{ salt: 'Calcium chloride (CaCl2)', grams: 3.5 }], wpTempF: 170, wpMin: 30, ibuModel: 'tinseth', notes: 'Decoct if you dare.', og: 1.052, actuals: { mashInF: 151 }, process: ['Whirlfloc'], pitchDate: '2026-01-01', id: 7 };
const code = R.encodeShare(batch);
assert(/^[A-Za-z0-9_-]+$/.test(code), 'safe in a link without escaping'); assert(code.length < 900, 'a sensible length: ' + code.length);
const back = R.decodeShare(code);
assert.strictEqual(back.name, batch.name, 'accents and punctuation survive'); assert.strictEqual(back.style, 'Hefeweizen'); assert.strictEqual(back.batchGal, 5.5); assert.strictEqual(back.boilMin, 75); assert.strictEqual(back.mashMin, 90);
assert.strictEqual(back.fermentables.length, 2, 'the late sugar that rescued a low gravity is not part of the recipe');
assert.deepStrictEqual(back.hops[1], { name: 'Citra', oz: 2, alpha: 12, minutes: 0, type: 'cryo', whirlpool: true });
assert.strictEqual(back.hops[2].minutes, '', 'a blank time stays blank'); assert.strictEqual(back.dryHops.length, 1, 'extra dry hops thrown in for fun are left out');
assert.deepStrictEqual(back.dryHops[0], { name: 'Mosaic', oz: 2, alpha: 12.5, type: 'pellet', day: 2, days: 3 }); assert.strictEqual(back.ibuModel, 'tinseth'); assert.strictEqual(back.wpTempF, 170);
assert.strictEqual(back.og, undefined, 'none of the brewer\'s own log travels'); assert.strictEqual(back.actuals, undefined); assert.strictEqual(back.pitchDate, undefined); assert.strictEqual(back.id, undefined);
// a link is somebody else's typing
assert.strictEqual(R.decodeShare('not a recipe'), null); assert.strictEqual(R.decodeShare(''), null); assert.strictEqual(R.decodeShare(Buffer.from('{"a":1}').toString('base64')), null);
const evil = Buffer.from(JSON.stringify([1, 'x'.repeat(5000), 7, '9e99', -3, 'abc', null, {}, [], 5, 'hot', [['Malt', '1e9'], 'junk', [null, 2]], [['Hop', -1, 900, 99999, 'weapon', 'yes']], 'nope', [['Salt', 1e9]], 9999, -5, 'z', 12])).toString('base64');
const safe = R.decodeShare(evil);
assert.strictEqual(safe.name.length, 80, 'names are cut to length'); assert.strictEqual(safe.batchGal, 5.5, 'nonsense numbers fall back to defaults'); assert.strictEqual(safe.fermentables.length, 1, 'a row with no name is dropped'); assert.strictEqual(safe.fermentables[0].lb, '');
assert.strictEqual(safe.hops[0].type, 'pellet'); assert.strictEqual(safe.hops[0].oz, ''); assert.strictEqual(safe.hops[0].alpha, ''); assert.strictEqual(safe.hops[0].minutes, 600); assert.strictEqual(safe.salts.length, 0); assert.strictEqual(safe.dryHops.length, 0);
assert.strictEqual(typeof safe.notes, 'string');
const text = R.asText(batch, { og: '1.052', ibu: 14, abv: 5.2 });
assert(/5\.5 gal, OG 1\.052, 14 IBU, 5\.2%/.test(text)); assert(/5\.5 lb Wheat malt/.test(text)); assert(!/Agave/.test(text)); assert(/2 oz Citra \(12%\), whirlpool/.test(text)); assert(/Yeast: Wyeast 3068 Weihenstephan/.test(text));

console.log('recipe text tests passed');
