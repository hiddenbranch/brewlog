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
// calories, against what the label on a commercial beer says: a 5.3% pale ale is about 165 in 12 oz, a dry stout about 125, a barleywine well over 300
near(B.calories(1.050, 1.010), 165, 4, 'calories, pale ale'); near(B.calories(1.038, 1.006), 125, 5, 'calories, dry stout'); near(B.calories(1.060, 1.012), 199, 4, 'calories, IPA');
assert(B.calories(1.100, 1.025) > 320 && B.calories(1.100, 1.025) < 370, 'calories, barleywine: ' + B.calories(1.100, 1.025));
assert(B.calories(1.060, 1.010) > B.calories(1.050, 1.010), 'a bigger beer has more in it'); assert.strictEqual(B.calories(1.050, 0), null); assert.strictEqual(B.calories(1.010, 1.050), null);
// hydrometer: warm sample reads low, correction raises it
assert(B.hydrometerCorrect(1.050, 80) > 1.050, 'warm sample corrects up');
near(B.hydrometerCorrect(1.050, 60), 1.050, 0.0005, 'at calibration temp');
near(B.hydrometerCorrect(1.050, 80), 1.0515, 0.001, 'at 80F');
// refractometer
near(B.brixToSgUnfermented(12, 1.04), 1.0466, 0.001, 'brix to SG');
// refractometer with alcohol present (Novotny linear). A 1.050 beer (12.4 P) that finishes at 1.012 shows about 6.5 on the corrected scale.
const fg = B.refractoFg(12.4 * 1.04, 6.48 * 1.04, 1.04); near(fg, 1.012, 0.0012, 'refracto FG, a 1.050 beer at 1.012');
near(B.refractoFg(12.4 * 1.04, 9.33 * 1.04, 1.04), 1.030, 0.0015, 'refracto mid-ferment, a 1.050 beer at 1.030');     // the case a cubic fitted to finished beer gets badly wrong
near(B.refractoFg(12, 12, 1.04), B.brixToSgUnfermented(12, 1.04), 0.002, 'nothing fermented yet: close to the plain conversion');
assert(B.refractoFg(12, 8, 1.04) > B.refractoFg(12, 6, 1.04), 'a lower reading is a lower gravity'); assert(B.refractoFg(20, 9, 1.04) > 1.005 && B.refractoFg(20, 9, 1.04) < 1.015, 'refracto FG, big beer: ' + B.refractoFg(20, 9, 1.04));
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
// the published starter table: 100 billion cells into 1, 2, 4, 8 and 20 litres ends near 152, 205, 276, 400 and 600 billion
for (const [L, cells] of [[1, 152], [2, 205], [4, 276], [8, 400], [20, 600]]) near(B.starterGrowth(100, L), cells, cells * 0.05, `100 billion in a ${L} L starter`);
assert.strictEqual(B.starterGrowth(100, 0), 100, 'no starter, no growth'); assert(B.starterGrowth(400, 1) >= 400 && B.starterGrowth(400, 1) < 480, 'a crowded starter barely grows: ' + B.starterGrowth(400, 1));
assert(B.starterGrowth(100, 2) >= B.cellsNeeded(5.5, 1.050, 0.75), 'a fresh pack in a 2 L starter covers a 1.050 ale: ' + B.starterGrowth(100, 2) + ' vs ' + B.cellsNeeded(5.5, 1.050, 0.75));
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
const recipe = { boilMin: 60, mashF: 152, boilGal: 7, og: 1.062, yeast: 'US-05', fermF: 66,
  hops: [{ name: 'Columbus', oz: 0.6, minutes: 60 }, { name: 'Citra', oz: 1, minutes: 5 }, { name: 'Citra', oz: 1, minutes: 0, whirlpool: true }],
  dryHops: [{ name: 'Mosaic', oz: 2, days: 4, day: '' }] };
const plan = B.brewPlan(recipe, EQ, 12, 1.050);
const ids = plan.map(p => p.id);
assert.deepStrictEqual(ids, ['strike', 'mashin', 'mashout', 'sparge', 'preboil', 'boil', 'whirlpool', 'chill', 'og', 'pitch', 'ferment'], 'step order: ' + ids);
const boil = plan.find(p => p.id === 'boil');
assert.strictEqual(boil.minutes, 60);
assert.deepStrictEqual(boil.alarms.map(a => a.at), [0, 45, 55, 60], 'boil alarms at the right minutes: ' + JSON.stringify(boil.alarms));
assert(boil.alarms[0].label.includes('Columbus') && boil.alarms[2].label.includes('Citra') && boil.alarms[3].label === 'Flameout');
assert(plan.find(p => p.id === 'strike').detail[0].startsWith('3.75 gal'), 'strike volume from the profile');
assert(plan.find(p => p.id === 'whirlpool').detail[0].includes('1 oz Citra'));
assert(plan.find(p => p.id === 'mashin').alarms[0].at === 30, 'mash halfway alarm');
assert(plan.find(p => p.id === 'ferment').detail.some(d => /Dry hop: 2 oz Mosaic/.test(d)), 'dry hops are in the plan for the fermenter');
// old batches kept dry hops as text in extras: still read
assert.strictEqual(B.dryHopsOf({ extras: ['Dry hop: 2 oz Mosaic, 4 days'] })[0].name, 'Mosaic');
// extract batch skips the mash
const ext = B.brewPlan({ boilMin: 60, boilGal: 5.5, hops: [] }, EQ, 0, 1.05);
assert.deepStrictEqual(ext.map(p => p.id), ['water', 'boil', 'chill', 'og', 'pitch', 'ferment'], 'extract plan: ' + ext.map(p => p.id));
// the grain temperature comes from the profile: a hot garage wants cooler strike water
const cool = B.brewTargets(recipe, EQ, 12, null), hot = B.brewTargets(recipe, Object.assign({}, EQ, { grainTempF: 90 }), 12, null);
assert.strictEqual(cool.grainF, 65); assert(hot.strikeF < cool.strikeF - 3, `90F grain needs cooler water: ${hot.strikeF} vs ${cool.strikeF}`);
near(cool.totalWaterGal, cool.strikeGal + cool.spargeGal, 0.01, 'total water');
// no sparge (brew in a bag): all the water goes in with the grain
const bag = Object.assign({}, EQ, { noSparge: true, absorbGalLb: 0.08 }), tb = B.brewTargets(recipe, bag, 12, null);
near(tb.strikeGal, 7.96, 0.01, 'strike = pre-boil + what the grain keeps'); assert.strictEqual(tb.spargeGal, 0); near(tb.qtPerLb, 2.65, 0.01, 'the ratio is whatever that works out to');
assert(tb.strikeF < cool.strikeF, 'a thin mash needs less overshoot');
const bagPlan = B.brewPlan(recipe, bag, 12, 1.05), bagIds = bagPlan.map(p => p.id);
assert(bagIds.includes('drain') && !bagIds.includes('sparge'), 'drain instead of sparge: ' + bagIds); assert(/all the water, no sparge/.test(bagPlan[0].detail[0]));
assert(B.brewSteps(recipe, bag, 12, null).steps.some(x => x.id === 'drain') && !B.brewSteps(recipe, bag, 12, null).steps.some(x => x.id === 'sparge'));
assert(!B.brewTargets(recipe, bag, 0, null).noSparge, 'an extract batch has no mash to be no-sparge');
// an overnight mash reads as hours, not as 600 minutes
assert(/Hold 10 h 00 min/.test(B.brewPlan(Object.assign({}, recipe, { mashMin: 600 }), EQ, 12, 1.05)[1].detail[1]));
console.log('brew plan tests passed');

// ---- dates: the brewer's own day, and arithmetic a clock change cannot break ----
assert.strictEqual(B.addDays('2026-11-10', 7), '2026-11-17'); assert.strictEqual(B.addDays('2026-12-28', 7), '2027-01-04'); assert.strictEqual(B.addDays('2028-02-27', 3), '2028-03-01', 'leap year');
assert.strictEqual(B.addDays('2027-03-10', 7), '2027-03-17', 'across the spring clock change'); assert.strictEqual(B.addDays('2026-10-28', 7), '2026-11-04', 'across the autumn clock change');
assert.strictEqual(B.addDays('nonsense', 3), ''); assert.strictEqual(B.daysBetween('2027-03-10', '2027-03-17'), 7); assert.strictEqual(B.daysBetween('2026-11-10', '2026-11-10'), 0);
assert.strictEqual(B.isoDay(new Date(2026, 10, 10, 23, 30)), '2026-11-10', 'late evening is still today');
assert.strictEqual(B.today(), B.isoDay(new Date())); assert.strictEqual(B.niceDate('not a date'), '', 'nothing but dates come out of niceDate'); assert(/10/.test(B.niceDate('2026-11-10')));
{ // the bug this replaced: at 8:30 pm in Texas, UTC is already tomorrow
  const RealDate = Date, at = new RealDate(2026, 10, 10, 20, 30).getTime();
  global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(at); } static now() { return at; } };
  assert.strictEqual(B.today(), '2026-11-10', 'today is the local day'); global.Date = RealDate; }
// ---- fermentation: ready to package, and same-day readings stay in order ----
const ready = B.fermentationStatus([{ date: '2026-09-01', sg: 1.030 }, { date: '2026-09-08', sg: 1.012 }, { date: '2026-09-11', sg: 1.012 }], 1.050);
assert(ready.ready, 'two matching readings three days apart'); assert(!B.fermentationStatus([{ date: '2026-09-08', sg: 1.012 }, { date: '2026-09-08', sg: 1.012 }], 1.050).ready, 'the same reading twice in one day proves nothing');
assert(!B.fermentationStatus([{ date: '2026-09-01', sg: 1.040 }, { date: '2026-09-04', sg: 1.040 }], 1.050).ready, 'stuck at 20% is stable but not ready');
assert.strictEqual(B.fermentationStatus([{ date: '2026-09-08', sg: 1.020 }, { date: '2026-09-08', sg: 1.014 }], 1.050).sg, 1.014, 'the later of two same-day readings is the current one');
// ---- the plan for the fermenter ----
const ale = B.fermentPlan({ name: 'US-05', type: 'Ale' }, 1.050), lager = B.fermentPlan({ name: 'W-34/70', type: 'Lager' }, 1.050), kv = B.fermentPlan({ name: 'Voss Kveik', type: 'Kveik' }, 1.050), big = B.fermentPlan({ name: 'US-05', type: 'Ale' }, 1.095);
assert.strictEqual(ale.text, '10 to 14 days'); assert(/then 4 to 6 weeks cold/.test(lager.text)); assert(kv.high < ale.low + 1); assert(big.low > ale.low + 10, 'a barleywine takes weeks longer');
const sched = B.dryHopSchedule([{ name: 'Citra', oz: 2, day: 2, days: 3 }, { name: 'Mosaic', oz: 1, day: '', days: 4 }], ale, '2026-11-10');
assert.strictEqual(sched[0].fromDate, '2026-11-12'); assert.strictEqual(sched[1].fromDay, ale.dryHopWindow[0]);
const ics = B.icsFor('Test IPA', '2026-11-10', ale, sched); assert(/BEGIN:VCALENDAR/.test(ics) && /Dry hop Test IPA: 2 oz Citra/.test(ics) && /DTSTART;VALUE=DATE:20261112/.test(ics));
// ---- durations as people type them ----
assert.strictEqual(B.parseDuration('75'), 75); assert.strictEqual(B.parseDuration('1:15'), 75); assert.strictEqual(B.parseDuration('14h 20m'), 860); assert.strictEqual(B.parseDuration('14:20'), 860); assert.strictEqual(B.parseDuration('overnight'), null);
assert.strictEqual(B.fmtDuration(60), '60 min'); assert.strictEqual(B.fmtDuration(860), '14 h 20 min');
// ---- IBUs: the SMPH model's behaviour, not its last decimal place ----
const wort = { gallons: 5.5, og: 1.055, boilMin: 60 }, one = B.ibuSmph([{ oz: 1, alpha: 12, minutes: 60, type: 'pellet' }], wort), tin = B.ibuTinseth([{ oz: 1, alpha: 12, minutes: 60, type: 'pellet' }], 5.5, 1.047);
assert(one.kettle > 20 && one.kettle < 40, 'a plain bittering charge: ' + one.kettle); assert(one.kettle < tin, `finished-beer IBUs run below Tinseth: ${one.kettle} vs ${tin}`); assert(one.kettle / tin > 0.5 && one.kettle / tin < 0.9, 'about a third below');
const flood = B.ibuSmph([{ oz: 500, alpha: 12, minutes: 60, type: 'pellet' }], wort); assert(flood.kettle < 140, 'a ridiculous hop charge cannot make 1000 IBU: ' + flood.kettle); assert(flood.dissolved < 0.1, 'because the alpha acid does not dissolve');
assert(B.ibuSmph([{ oz: 2, alpha: 12, minutes: 0, type: 'pellet' }], wort).kettle > B.ibuSmph([], wort).kettle + 3, 'flameout hops are not zero');
const wpHot = B.ibuSmph([{ oz: 2, alpha: 12, minutes: 0, whirlpool: true }], Object.assign({ wpTempF: 200, wpMin: 30 }, wort)), wpCool = B.ibuSmph([{ oz: 2, alpha: 12, minutes: 0, whirlpool: true }], Object.assign({ wpTempF: 160, wpMin: 30 }, wort));
assert(wpHot.kettle > wpCool.kettle + 2, 'a hotter stand bitters more');
const dryOnly = B.ibuSmph([], Object.assign({ dryHops: [{ oz: 4, alpha: 12, type: 'pellet' }] }, wort)); assert(dryOnly.dry > 2, 'dry hops read on a lab test: ' + dryOnly.dry); assert(Math.abs(dryOnly.kettle - B.ibuSmph([], wort).kettle) < 0.01, 'but are reported apart from the kettle figure');
const need40 = B.hopsForIbuSmph(40, { alpha: 12, minutes: 60, type: 'pellet' }, [], wort); near(B.ibuSmph([{ oz: need40, alpha: 12, minutes: 60, type: 'pellet' }], wort).kettle, 40, 0.6, 'sizing an addition to a target');
assert.strictEqual(B.hopsForIbuSmph(400, { alpha: 5, minutes: 60 }, [], wort), null, 'an unreachable target says so');
assert(B.ibuSmph([{ oz: 5, alpha: 5, minutes: 60, type: 'wet' }], wort).kettle < B.ibuSmph([{ oz: 5, alpha: 5, minutes: 60, type: 'pellet' }], wort).kettle / 2, 'wet hops are mostly water');
// ---- water: what to add ----
const soft = { Ca: 10, Mg: 3, Na: 5, Cl: 8, SO4: 10, HCO3: 25 }, hoppy = D.WATER_PROFILES.find(x => /hoppy/i.test(x.name)), solved = B.waterSolve(soft, hoppy, 8);
assert(solved.additions.some(x => /Gypsum/.test(x.salt)), 'a hoppy profile from soft water needs gypsum'); assert(solved.result.SO4 > solved.result.Cl, 'sulfate leads');
const hard = { Ca: 120, Mg: 25, Na: 40, Cl: 60, SO4: 80, HCO3: 320 }, pils = D.WATER_PROFILES.find(x => /Pilsen/.test(x.name));
assert(B.waterSolve(hard, pils, 8).dilution >= 0.8, 'hard water to Pilsen is nearly all RO'); assert.strictEqual(B.waterSolve(hard, pils, 8, { dilute: false }).dilution, 0); assert.strictEqual(B.waterSolve(soft, hoppy, 0), null);
const kit = B.waterFromKit(200, 150); near(kit.Ca, 56.1, 0.2, 'kit Ca'); near(kit.HCO3, 182.9, 0.2, 'kit HCO3'); assert.strictEqual(B.asCaCO3(10, 'gpg'), 171);
// ---- scaling, yeast packs, the low-gravity helper ----
const sc = B.scaleAmounts([{ lb: 10 }, { lb: 1, extract: true }], [{ oz: 1 }], 5, 10, 72, 65); near(sc.fermentables[0].lb, 22.25, 0.01, 'grain follows volume and efficiency'); assert.strictEqual(sc.fermentables[1].lb, 2, 'sugar follows volume only'); assert.strictEqual(sc.hops[0].oz, 2);
assert.strictEqual(B.yeastPacks(5.5, 1.050, 'Ale'), 1); assert.strictEqual(B.yeastPacks(5.5, 1.050, 'Lager'), 2); assert.strictEqual(B.yeastPacks(11, 1.070, 'Ale'), 4); assert.strictEqual(B.yeastPacks(5.5, 1.090, 'Kveik'), 1);
near(B.sugarToReach(1.048, 5.5, 1.056, 46), 0.96, 0.01, 'sugar to lift a low gravity'); assert.strictEqual(B.extraBoilMinutes(1.048, 5.5, 1.056, 1.2), 39);
// ---- what a batch pours, and what a pint costs ----
near(B.packagedGal(5.5, 0.5), 4.7, 0.001, 'packaged'); assert.deepStrictEqual(B.servings(4.7), { pints: 37, bottles: 50 });
const cps = B.costPerServing(41.2, 4.7); near(cps.perPint, 1.11, 0.01, 'a pint'); near(cps.perBottle, 0.82, 0.01, 'a bottle'); assert.strictEqual(B.costPerServing(0, 4.7), null); assert.strictEqual(B.money(0.82), '82¢'); assert.strictEqual(B.money(1.11), '$1.11');
// ---- the year in numbers ----
const yr = B.today().slice(0, 4), rows = [{ brewDate: yr + '-01-05', batchGal: 5.5, brewed: true, abv: 5.5, eff: 68 }, { brewDate: yr + '-02-05', batchGal: 5.5, brewed: true, abv: 6.5, eff: 70 }, { brewDate: yr + '-03-05', batchGal: 11, brewed: true, abv: null, eff: 66 },
  { brewDate: yr + '-04-05', batchGal: 5.5, brewed: false }, { brewDate: yr + '-04-06', batchGal: 5.5, brewed: true, sample: true, abv: 9, eff: 90 }, { brewDate: (yr - 1) + '-06-05', batchGal: 5, brewed: true, abv: 4, eff: null }];
const stats = B.brewStats(rows); assert.strictEqual(stats.batchesYear, 3, 'planned batches and the example are not counted'); assert.strictEqual(stats.batches, 4); assert.strictEqual(stats.gallonsYear, 22); assert.strictEqual(stats.avgEff, 68); assert.strictEqual(stats.effCount, 3); near(stats.avgAbv, 5.3, 0.01, 'average ABV');
assert.strictEqual(B.brewStats([]).batches, 0); assert.strictEqual(B.nextBrewName('Citra Pale Ale'), 'Citra Pale Ale #2'); assert.strictEqual(B.nextBrewName('Citra Pale Ale #2'), 'Citra Pale Ale #3'); assert.strictEqual(B.nextBrewName(''), 'Batch #2');
// ---- registration: where a sign-up goes ----
let tg = B.signupTarget('https://docs.google.com/forms/d/e/1FAIpQLSabc_-9/viewform?usp=pp_url&entry.111=EMAIL&entry.222=NAME&entry.333=SYSTEM');
assert.strictEqual(tg.kind, 'Google Form'); assert.strictEqual(tg.url, 'https://docs.google.com/forms/d/e/1FAIpQLSabc_-9/formResponse'); assert.deepStrictEqual(tg.map, { email: 'entry.111', name: 'entry.222', system: 'entry.333' }); assert.strictEqual(tg.problem, '');
assert.deepStrictEqual(B.signupPairs(tg, { email: ' a@b.co ', name: 'Phil', system: '', source: 'Brew Log 1.9.0' }), [['entry.111', 'a@b.co'], ['entry.222', 'Phil']], 'only what was given, and only where the form has a place for it');
tg = B.signupTarget('https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform?usp=pp_url&entry.5=your+email+here&entry.6=first%20name'); assert.deepStrictEqual(tg.map, { email: 'entry.5', name: 'entry.6' }, 'the marker words can be in any case, inside other words');
assert(/no answer marked EMAIL/.test(B.signupTarget('https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform').problem)); assert(/short link/.test(B.signupTarget('https://forms.gle/abc').problem)); assert(/form editor/.test(B.signupTarget('https://docs.google.com/forms/d/1abc/edit').problem));
assert(/switched off/.test(B.signupTarget('').problem)); assert(/does not look like a link/.test(B.signupTarget('docs.google.com/forms').problem)); assert(/https/.test(B.signupTarget('http://example.com/x').problem));
tg = B.signupTarget('https://app.kit.com/forms/1234567/subscriptions'); assert.strictEqual(tg.kind, 'Kit'); assert.strictEqual(tg.map.email, 'email_address'); assert.strictEqual(tg.url, 'https://app.kit.com/forms/1234567/subscriptions');
tg = B.signupTarget('https://example.us21.list-manage.com/subscribe/post-json?u=abc&id=def'); assert.strictEqual(tg.kind, 'Mailchimp'); assert(/\/subscribe\/post\?u=abc&id=def$/.test(tg.url)); assert.strictEqual(tg.map.email, 'EMAIL');
tg = B.signupTarget('https://formspree.io/f/abcd', { email: '_replyto' }); assert.strictEqual(tg.kind, 'Form'); assert.strictEqual(tg.map.email, '_replyto', 'field names can be overridden'); assert.strictEqual(tg.map.name, 'name');
assert.deepStrictEqual(B.signupPairs(tg, { email: 'a@b.co' }, { _subject: 'New' }), [['_replyto', 'a@b.co'], ['_subject', 'New']]);
for (const ok of ['a@b.co', 'first.last+tag@sub.example.com']) assert(B.validEmail(ok), ok); for (const bad of ['', 'a@b', 'a b@c.com', '@b.com', 'a@b.c', 'a@b.com.']) assert(!B.validEmail(bad), bad);
// ---- the reference tables hold together ----
for (const hp of D.HOPS) { assert(hp.alphaLow > 0 && hp.alphaHigh >= hp.alphaLow && hp.alphaHigh < 25, hp.name + ' alpha'); assert(D.HOP_GENRES.includes(hp.genre) && 'BAD'.includes(hp.use), hp.name); }
for (const y of D.YEAST) { assert(y.tempHigh > y.tempLow, y.name + ' temperatures'); assert(y.type === 'Sour' || (y.attHigh >= y.attLow && y.attLow > 50 && y.attHigh <= 95), y.name + ' attenuation'); }
for (const f of D.FERMENTABLES) assert(f.ppg >= 0 && f.ppg <= 46 && f.lovibond >= 0, f.name);
for (const list of [D.HOPS, D.YEAST, D.FERMENTABLES]) assert.strictEqual(new Set(list.map(x => x.name)).size, list.length, 'no name appears twice');
for (const sys of D.SYSTEMS) { const made = B.postBoilToPackage(B.boilOff(sys.eq.boilGal, sys.eq.boilOffGalHr, 60), 0); near(made, sys.eq.batchGal, 0.2, `${sys.name}: an hour's boil from the pre-boil volume leaves the batch size`); }
const R = require('./recipes.js'), recipes = (R.RECIPES || (R.BrewRecipes && R.BrewRecipes.RECIPES) || []);
if (recipes.length) for (const r of recipes) { assert(D.YEAST.some(y => y.name === r.yeast), `${r.name}: its yeast is in the table`); for (const f of r.fermentables) assert(D.FERMENTABLES.some(x => x.name === f.name), `${r.name}: ${f.name}`); }
console.log('dates, fermentation, IBU, water, stats and registration tests passed');
