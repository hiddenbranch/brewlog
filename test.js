const B = require('./core.js'); const assert = require('assert');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
// units
near(B.galToL(5), 18.93, 0.01, 'gal to L'); near(B.ozToG(1), 28.3, 0.1, 'oz to g');
assert.strictEqual(B.fToC(212), 100); assert.strictEqual(B.cToF(66), 150.8);
// gravity
near(B.sgToPlato(1.048), 11.9, 0.15, 'SG to Plato'); near(B.platoToSg(12), 1.0484, 0.001, 'Plato to SG');
assert.strictEqual(B.points(1.048), 48); assert.strictEqual(B.fromPoints(48), 1.048);
near(B.abv(1.050, 1.010, 'simple'), 5.25, 0.01, 'simple ABV');
near(B.abv(1.050, 1.010), 5.3, 0.3, 'standard ABV');
near(B.abv(1.090, 1.020), 9.5, 0.6, 'big beer ABV');
near(B.attenuationApparent(1.050, 1.010), 80, 0.1, 'attenuation');
// hydrometer: warm sample reads low, correction raises it
assert(B.hydrometerCorrect(1.050, 80) > 1.050, 'warm sample corrects up');
near(B.hydrometerCorrect(1.050, 60), 1.050, 0.0005, 'at calibration temp');
near(B.hydrometerCorrect(1.050, 80), 1.0515, 0.001, 'at 80F');
// refractometer
near(B.brixToSgUnfermented(12, 1.04), 1.0466, 0.001, 'brix to SG');
const fg = B.refractoFg(12, 6.5, 1.04); near(fg, 1.010, 0.004, 'refracto FG');
// recipe
const grain = [{ lb: 10, ppg: 37 }, { lb: 1, ppg: 34, lovibond: 60 }];
near(B.ogFromGrain(grain, 5.5, 0.72), 1.053, 0.002, 'OG from grain');
near(B.grainForOg(1.050, 5.5, 37, 0.72), 10.32, 0.05, 'grain for OG');
near(B.efficiency([{ lb: 10, ppg: 37 }], 5.5, 1.048), 71.4, 0.5, 'efficiency');
near(B.gravityAtVolume(1.060, 5, 6), 1.050, 0.001, 'dilution');
near(B.waterToHitGravity(1.060, 5, 1.050), 1.0, 0.05, 'water to dilute');
// hops: a classic 1 oz 60 min at 5% alpha in 5 gal ~ 17-19 IBU
const ibu = B.ibuTinseth([{ oz: 1, alpha: 5, minutes: 60, type: 'leaf' }], 5, 1.050);
assert(ibu >= 16 && ibu <= 20, 'single addition IBU: ' + ibu);
assert(B.ibuTinseth([{ oz: 1, alpha: 5, minutes: 60, type: 'pellet' }], 5, 1.050) > ibu, 'pellets bitter more');
assert(B.ibuTinseth([{ oz: 1, alpha: 5, minutes: 5, type: 'leaf' }], 5, 1.050) < 5, 'late addition low IBU');
assert(B.ibuTinseth([{ oz: 1, alpha: 5, minutes: 60 }], 5, 1.080) < ibu, 'higher gravity, less utilisation');
near(B.hopsForIbu(40, 5, 1.050, 10, 60, 'pellet'), 1.06, 0.15, 'oz for 40 IBU');
// colour
near(B.srm([{ lb: 9, lovibond: 2 }, { lb: 1, lovibond: 60 }], 5.5), 9.5, 1.5, 'SRM');
assert.strictEqual(B.srmHex(4).toLowerCase(), '#ffbf42');
// mash
near(B.strikeTemp(1.25, 65, 152), 165.9, 0.3, 'strike temp');
near(B.infusionVolume(152, 168, 10, 12.5, 212), 5.27, 0.05, 'infusion volume');
near(B.grainAbsorption(10), 1.25, 0.01, 'grain absorption');
near(B.strikeWaterVolume(10, 1.25), 3.13, 0.02, 'strike volume gal');
near(B.boilOff(7, 1.2, 60), 5.8, 0.01, 'boil off');
// carbonation
near(B.residualCo2(68), 0.86, 0.03, 'residual CO2 at 68F');
const prime = B.primingSugar(5, 68, 2.4, 'Corn sugar (dextrose monohydrate)');
assert(prime.grams > 120 && prime.grams < 145, 'priming grams: ' + prime.grams);
assert(B.primingSugar(5, 68, 2.4, 'Table sugar (sucrose)').grams < prime.grams, 'sucrose needs less');
assert.strictEqual(B.primingSugar(5, 75, 0.5).grams, 0, 'already above target');
near(B.kegPsi(38, 2.4), 10.9, 1.2, 'keg psi');
near(B.volumesAtPsi(38, B.kegPsi(38, 2.4)), 2.4, 0.02, 'psi round trip');
// yeast
const need = B.cellsNeeded(5.5, 1.050, 0.75); assert(need > 170 && need < 200, 'cells needed: ' + need);
assert(B.cellsNeeded(5.5, 1.050, 1.5) > need, 'lager needs more');
assert.strictEqual(B.yeastViability(100, 0), 100); assert(B.yeastViability(100, 3) < 50, 'viability falls');
assert(B.starterGrowth(60, 2) > 60, 'starter grows cells');
assert.strictEqual(B.starterDme(2), 200);
// water
const w = B.waterAdditions({ Ca: 20, SO4: 10, Cl: 10 }, [{ salt: 'Gypsum (CaSO4)', grams: 3 }], 6);
near(w.Ca, 50.8, 0.5, 'Ca after gypsum'); near(w.SO4, 83.7, 0.5, 'SO4 after gypsum');
assert.strictEqual(B.ratioVerdict(w.ratio).includes('hoppy'), true, 'ratio verdict: ' + w.ratio);
assert(B.ratioVerdict(0.3).includes('malty'));
// fermentation
const f = B.fermentationStatus([{ date: '2026-09-01', sg: 1.050 }, { date: '2026-09-08', sg: 1.012 }, { date: '2026-09-11', sg: 1.012 }], 1.050);
assert.strictEqual(f.state, 'stable'); near(f.attenuation, 76, 0.5, 'attenuation'); assert.strictEqual(f.stableFor, 3);
assert.strictEqual(B.fermentationStatus([], 1.05).state, 'no readings');
console.log('brew core tests passed');
// ---- inventory matching and suggestions ----
const D = require('./data.js');
B.setHopRef(D.HOPS);
assert.strictEqual(B.normName('Citra Hops (pellets) 1 oz'), 'citra');
assert.strictEqual(B.normName('2-Row Pale Malt'), '2 row pale');
let m = B.matchVocab('BRIESS 2-ROW PALE MALT 50 LB', D.FERMENTABLES.map(f => f.name));
assert.strictEqual(m[0].name, '2-row pale malt', 'matched base malt: ' + JSON.stringify(m.slice(0, 2)));
m = B.matchVocab('YAKIMA CHIEF CITRA PELLETS 2022 CROP 12.4% AA', D.HOPS.map(hp => hp.name));
assert.strictEqual(m[0].name, 'Citra', 'matched hop: ' + JSON.stringify(m.slice(0, 2)));
m = B.matchVocab('SAFALE US-05 11.5g', D.YEAST.map(y => y.name));
assert(m.length && /US-05/.test(m[0].name), 'matched yeast: ' + JSON.stringify(m.slice(0, 2)));
assert.deepStrictEqual(B.matchVocab('xyzzy', D.HOPS.map(h => h.name)), [], 'no false match');
// suggestions: a full shelf can brew a pale ale, an empty one cannot
const fullShelf = [{ kind: 'Fermentable', name: '2-row pale malt', amount: 20 }, { kind: 'Fermentable', name: 'Crystal / Caramel 60L', amount: 2 }, { kind: 'Hop', name: 'Cascade', amount: 4 }, { kind: 'Yeast', name: 'US-05 / WLP001 / Wyeast 1056', amount: 1 }];
let sug = B.suggestBrews(fullShelf, D.STYLES, D.FERMENTABLES, D.YEAST, 5.5);
assert(sug[0].canBrew, 'top suggestion is brewable: ' + JSON.stringify(sug[0].missing));
assert(sug.some(s => /pale ale|blonde|bitter/i.test(s.style.name) && s.canBrew), 'a pale style is brewable');
assert(!sug.find(s => s.style.name === 'Irish dry stout').canBrew, 'stout needs roast malt');
assert(sug.find(s => s.style.name === 'German pilsner').missing.some(x => /yeast/i.test(x)), 'lager needs lager yeast');
const empty = B.suggestBrews([], D.STYLES, D.FERMENTABLES, D.YEAST, 5.5);
assert(empty.every(s => !s.canBrew), 'nothing brewable from an empty shelf');
assert(empty[0].missing.some(x => /base malt/.test(x)), 'missing list explains why');
assert.strictEqual(B.totalOf(fullShelf, 'Hop'), 4);
console.log('inventory tests passed');
// ---- guided brew day plan ----
const EQ = { batchGal: 5.5, boilGal: 7, boilMin: 60, efficiency: 72, qtPerLb: 1.25, tunLossF: 2, boilOffGalHr: 1.2, trubGal: 0.5, absorbGalLb: 0.125 };
const plan = B.brewPlan({ boilMin: 60, mashF: 152, boilGal: 7, og: 1.062, yeast: 'US-05', fermF: 66,
  hops: [{ name: 'Columbus', oz: 0.6, minutes: 60 }, { name: 'Citra', oz: 1, minutes: 5 }, { name: 'Citra', oz: 1, minutes: 0, whirlpool: true }],
  extras: ['Dry hop: 2 oz Mosaic, 4 days'] }, EQ, 12, 1.050);
const ids = plan.map(p => p.id);
assert.deepStrictEqual(ids, ['strike', 'mashin', 'mashout', 'sparge', 'preboil', 'boil', 'whirlpool', 'chill', 'og', 'pitch', 'dryhop'], 'step order: ' + ids);
const boil = plan.find(p => p.id === 'boil');
assert.strictEqual(boil.minutes, 60);
assert.deepStrictEqual(boil.alarms.map(a => a.at), [0, 45, 55, 60], 'boil alarms at the right minutes: ' + JSON.stringify(boil.alarms));
assert(boil.alarms[0].label.includes('Columbus') && boil.alarms[2].label.includes('Citra') && boil.alarms[3].label === 'Flameout');
assert(plan.find(p => p.id === 'strike').detail[0].startsWith('3.75 gal'), 'strike volume from the profile');
assert(plan.find(p => p.id === 'whirlpool').detail[0].includes('1 oz Citra'));
assert(plan.find(p => p.id === 'mashin').alarms[0].at === 30, 'mash halfway alarm');
// extract batch skips the mash
const ext = B.brewPlan({ boilMin: 60, boilGal: 5.5, hops: [] }, EQ, 0, 1.05);
assert.deepStrictEqual(ext.map(p => p.id), ['water', 'boil', 'chill', 'og', 'pitch'], 'extract plan: ' + ext.map(p => p.id));
console.log('brew plan tests passed');
