/* Brew Log - core brewing math. Pure functions, no DOM. Formulas named so they can be checked against a source. */
(function (root) {
  'use strict';
  const B = {};
  const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;
  const r4 = x => Math.round(x * 10000) / 10000;
  B.round = { r1, r2, r3, r4 };
  const L_PER_GAL = 3.78541, KG_PER_LB = 0.453592, G_PER_OZ = 28.3495;
  B.galToL = g => r2(g * L_PER_GAL); B.lToGal = l => r2(l / L_PER_GAL);
  B.lbToKg = p => r2(p * KG_PER_LB); B.kgToLb = k => r2(k / KG_PER_LB);
  B.ozToG = o => r1(o * G_PER_OZ); B.gToOz = g => r2(g / G_PER_OZ);
  B.fToC = f => r1((f - 32) * 5 / 9); B.cToF = c => r1(c * 9 / 5 + 32);
  B.psiToBar = p => r2(p * 0.0689476);

  // ---- gravity ----
  B.sgToPlato = sg => r2(259 - (259 / sg));                       // standard approximation
  B.platoToSg = p => r4(259 / (259 - p));
  B.points = sg => Math.round((sg - 1) * 1000);                   // 1.048 -> 48
  B.fromPoints = pts => r3(1 + pts / 1000);

  // ABV. "simple" is the (OG-FG)*131.25 rule; "standard" is the Novotny/alternate formula, closer above ~1.070.
  B.abv = function (og, fg, method) {
    if (!(og > 1) || !(fg > 0)) return null;
    if (method === 'simple') return r2((og - fg) * 131.25);
    return r2((76.08 * (og - fg) / (1.775 - og)) * (fg / 0.794));
  };
  B.attenuationApparent = (og, fg) => r1((og - fg) / (og - 1) * 100);
  B.attenuationReal = (og, fg) => r1(0.8192 * B.attenuationApparent(og, fg));
  // 12 oz (355 ml) calories, Palmer/standard
  B.calories = function (og, fg) {
    const abw = (og - fg) * 105.5 / 0.794 / 100 * 0.794;
    const cal_a = 6.9 * ((og - fg) * 131.25 * 0.795 * fg / 100) * 3.55 * 10;
    const cal_c = 4.0 * ((0.8114 * B.sgToPlato(fg) / 100) * fg * 1000 - 0.44) * 3.55;
    return Math.round(cal_a + cal_c);
  };
  // hydrometer calibrated at 60F; correction for sample temperature (F)
  B.hydrometerCorrect = function (reading, tempF, calF) {
    const cal = calF || 60;
    const f = t => 1.00130346 - 1.34722124e-4 * t + 2.04052596e-6 * t * t - 2.32820948e-9 * t * t * t;
    return r4(reading * (f(tempF) / f(cal)));
  };
  // refractometer: Brix -> SG. wcf = wort correction factor (1.02 to 1.06, default 1.04)
  B.brixToSgUnfermented = function (brix, wcf) { return B.platoToSg(brix / (wcf || 1.04)); };
  // Terrill cubic for fermenting/finished wort
  B.refractoFg = function (obBrix, fbBrix, wcf) {
    const ob = obBrix / (wcf || 1.04), ab = fbBrix / (wcf || 1.04);
    const sg = 1.001843 - 0.002318474 * ob - 0.000007775 * ob * ob - 0.000000034 * ob * ob * ob
      + 0.00574 * ab + 0.00003344 * ab * ab + 0.000000086 * ab * ab * ab;
    return r4(sg);
  };

  // ---- recipe ----
  // og from fermentables: [{lb, ppg}], volume in gallons, efficiency 0-1 (extract: efficiency 1)
  B.ogFromGrain = function (items, gallons, efficiency) {
    if (!gallons) return null;
    const pts = items.reduce((s, i) => s + (Number(i.lb) || 0) * (Number(i.ppg) || 0) * (i.extract ? 1 : (efficiency === undefined ? 0.72 : efficiency)), 0);
    return B.fromPoints(pts / gallons);
  };
  B.grainForOg = function (targetOg, gallons, ppg, efficiency) {
    const pts = B.points(targetOg) * gallons;
    return r2(pts / (ppg * (efficiency === undefined ? 0.72 : efficiency)));
  };
  // mash efficiency achieved: actual points over the maximum the grain could give
  B.efficiency = function (items, gallons, actualOg) {
    const maxPts = items.reduce((s, i) => s + (Number(i.lb) || 0) * (Number(i.ppg) || 0), 0);
    if (!maxPts) return null;
    return r1(B.points(actualOg) * gallons / maxPts * 100);
  };
  // dilution or boil-off: points are conserved
  B.gravityAtVolume = (sg, fromVol, toVol) => B.fromPoints(B.points(sg) * fromVol / toVol);
  B.waterToHitGravity = (sg, vol, targetSg) => r2(B.points(sg) * vol / B.points(targetSg) - vol);

  // ---- hops: Tinseth ----
  B.tinsethUtilization = function (boilGravity, minutes) {
    const bigness = 1.65 * Math.pow(0.000125, boilGravity - 1);
    const timeFactor = (1 - Math.exp(-0.04 * minutes)) / 4.15;
    return r4(bigness * timeFactor);
  };
  // hop: {oz, alpha (percent), minutes, type: 'pellet'|'leaf', whirlpool}
  B.ibuTinseth = function (hops, gallons, boilGravity) {
    const liters = gallons * L_PER_GAL;
    let total = 0;
    for (const hp of hops) {
      const grams = (Number(hp.oz) || 0) * G_PER_OZ;
      const mgl = grams * (Number(hp.alpha) || 0) / 100 * 1000 / liters;
      let u = B.tinsethUtilization(boilGravity, Number(hp.minutes) || 0);
      if (hp.type === 'pellet') u *= 1.1;
      if (hp.whirlpool) u *= 0.5;                 // rough allowance for a sub-boiling stand
      total += mgl * u;
    }
    return Math.round(total);
  };
  B.hopsForIbu = function (targetIbu, gallons, boilGravity, alpha, minutes, type) {
    const one = B.ibuTinseth([{ oz: 1, alpha, minutes, type }], gallons, boilGravity);
    return one ? r2(targetIbu / one) : null;
  };
  B.bitternessRatio = (ibu, og) => r2(ibu / (B.points(og)));      // BU:GU

  // ---- colour: Morey ----
  B.srm = function (items, gallons) {
    if (!gallons) return null;
    const mcu = items.reduce((s, i) => s + (Number(i.lb) || 0) * (Number(i.lovibond) || 0), 0) / gallons;
    return r1(1.4922 * Math.pow(mcu, 0.6859));
  };
  B.srmHex = function (srm) {
    const table = [[0, '#FFE699'], [2, '#FFD878'], [3, '#FFCA5A'], [4, '#FFBF42'], [6, '#FBB123'], [8, '#F8A600'], [10, '#F39C00'], [13, '#EA8F00'], [17, '#E58500'], [20, '#D77400'], [24, '#CB6200'], [29, '#BF5000'], [35, '#8E2900'], [40, '#701400'], [50, '#3D0708'], [70, '#180000']];
    let hex = table[0][1];
    for (const [v, c] of table) if (srm >= v) hex = c;
    return hex;
  };

  // ---- mash ----
  // strike temp: Tw = (0.2 / R)(T2 - T1) + T2, R = quarts per pound
  B.strikeTemp = function (qtPerLb, grainTempF, targetMashF, tunLossF) {
    if (!qtPerLb) return null;
    return r1((0.2 / qtPerLb) * (targetMashF - grainTempF) + targetMashF + (tunLossF || 0));
  };
  // infusion to raise a mash: Vw = (T2 - T1)(0.2 G + Vm) / (Tw - T2), all in quarts and pounds
  B.infusionVolume = function (currentF, targetF, grainLb, mashQt, waterF) {
    if (waterF <= targetF) return null;
    return r2((targetF - currentF) * (0.2 * grainLb + mashQt) / (waterF - targetF));
  };
  B.mashThickness = (mashQt, grainLb) => grainLb ? r2(mashQt / grainLb) : null;
  // grain absorption ~0.125 gal/lb (0.5 qt/lb); returns gallons
  B.grainAbsorption = (grainLb, ratePerLb) => r2(grainLb * (ratePerLb === undefined ? 0.125 : ratePerLb));
  B.strikeWaterVolume = (grainLb, qtPerLb) => r2(grainLb * qtPerLb / 4);
  B.spargeVolume = function (preBoilGal, strikeGal, grainLb, absorbPerLb, tunDeadGal) {
    const absorbed = B.grainAbsorption(grainLb, absorbPerLb);
    return r2(preBoilGal - (strikeGal - absorbed) + (tunDeadGal || 0));
  };
  B.boilOff = (preBoilGal, rateGalPerHr, minutes) => r2(preBoilGal - rateGalPerHr * minutes / 60);
  // wort shrinks about 4% cooling from boiling to room temperature
  B.postBoilToPackage = (hotGal, trubLossGal) => r2(hotGal * 0.96 - (trubLossGal || 0));

  // ---- carbonation ----
  // residual CO2 in beer at its highest post-fermentation temperature (volumes), temp in F
  B.residualCo2 = tempF => r2(3.0378 - 0.050062 * tempF + 0.00026555 * tempF * tempF);
  B.SUGARS = {
    'Corn sugar (dextrose monohydrate)': 0.4444, 'Table sugar (sucrose)': 0.5146,
    'Dry malt extract': 0.3600, 'Honey': 0.4100, 'Maple syrup': 0.3600, 'Turbinado': 0.5000
  };
  // grams of sugar for the whole batch; 1 volume of CO2 = 1.96 g/L
  B.primingSugar = function (gallons, tempF, targetVolumes, sugarName) {
    const yieldFactor = B.SUGARS[sugarName] || B.SUGARS['Corn sugar (dextrose monohydrate)'];
    const need = targetVolumes - B.residualCo2(tempF);
    if (need <= 0) return { grams: 0, oz: 0, needed: r2(need) };
    const grams = need * 1.96 * (gallons * L_PER_GAL) / yieldFactor;
    return { grams: r1(grams), oz: r2(grams / G_PER_OZ), needed: r2(need) };
  };
  // forced carbonation pressure (psi) for a target volume at serving temperature
  B.kegPsi = function (tempF, volumes) {
    const psi = -16.6999 - 0.0101059 * tempF + 0.00116512 * tempF * tempF + 0.173354 * tempF * volumes + 4.24267 * volumes - 0.0684226 * volumes * volumes;
    return r1(psi);
  };
  B.volumesAtPsi = function (tempF, psi) {
    let lo = 0, hi = 5;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (B.kegPsi(tempF, mid) < psi) lo = mid; else hi = mid; }
    return r2((lo + hi) / 2);
  };

  // ---- yeast ----
  // Pitch rate: cells needed = rate (M cells / ml / degP) * volume ml * plato
  B.cellsNeeded = function (gallons, og, rate) {
    const ml = gallons * L_PER_GAL * 1000;
    const plato = B.sgToPlato(og);
    return Math.round(rate * ml * plato / 1000);      // billions
  };
  B.PITCH_RATES = { 'Ale (0.75)': 0.75, 'Ale, big beer (1.0)': 1.0, 'Lager (1.5)': 1.5, 'Lager, big beer (2.0)': 2.0 };
  // viability of a liquid pack, roughly 21% loss per month from manufacture
  B.yeastViability = function (cellsBillion, monthsOld) { return Math.round(cellsBillion * Math.pow(0.79, Math.max(0, monthsOld))); };
  B.starterGrowth = function (cellsBillion, starterL) {
    // simple stir-plate model: growth falls as inoculation rate rises
    if (!starterL || !cellsBillion) return cellsBillion;
    const rate = cellsBillion / starterL;                       // billion per litre
    const factor = Math.max(1, Math.min(6, 12.54793776 * Math.pow(rate, -0.4594858324) - 0.9994994906));
    return Math.round(cellsBillion * factor);
  };
  B.starterDme = starterL => r1(starterL * 100);                // 10% w/v, about 1.036

  // ---- water ----
  // ppm added by 1 gram of salt in 1 gallon
  B.SALTS = {
    'Gypsum (CaSO4)': { Ca: 61.5, SO4: 147.4 },
    'Calcium chloride (CaCl2)': { Ca: 72.0, Cl: 127.4 },
    'Epsom salt (MgSO4)': { Mg: 26.1, SO4: 103.0 },
    'Table salt (NaCl)': { Na: 103.2, Cl: 160.3 },
    'Baking soda (NaHCO3)': { Na: 72.3, HCO3: 191.7 },
    'Chalk (CaCO3)': { Ca: 105.7, HCO3: 158.4 }
  };
  B.waterAdditions = function (base, additions, gallons) {
    const out = Object.assign({ Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 }, base || {});
    for (const a of additions || []) {
      const salt = B.SALTS[a.salt]; if (!salt || !a.grams || !gallons) continue;
      for (const ion in salt) out[ion] = (out[ion] || 0) + salt[ion] * a.grams / gallons;
    }
    for (const k in out) out[k] = r1(out[k]);
    out.ratio = out.Cl ? r2(out.SO4 / out.Cl) : null;
    return out;
  };
  B.ratioVerdict = function (ratio) {
    if (ratio === null || ratio === undefined) return 'no chloride: add some for body';
    if (ratio < 0.5) return 'malty, rounded';
    if (ratio < 1.0) return 'balanced, leaning malty';
    if (ratio < 2.0) return 'balanced, leaning hoppy';
    if (ratio < 4.0) return 'hoppy, crisp';
    return 'very hoppy, can turn harsh';
  };

  // ---- fermentation tracking ----
  B.fermentationStatus = function (readings, og) {
    const r = (readings || []).filter(x => x.sg > 0).sort((a, b) => a.date < b.date ? -1 : 1);
    if (!r.length) return { state: 'no readings' };
    const last = r[r.length - 1], prev = r.length > 1 ? r[r.length - 2] : null;
    const att = B.attenuationApparent(og, last.sg);
    let state = 'fermenting';
    if (prev && Math.abs(last.sg - prev.sg) <= 0.001) state = 'stable';
    if (att < 40) state = prev ? 'slow' : 'early';
    return { state, sg: last.sg, attenuation: att, abv: B.abv(og, last.sg), readings: r.length, stableFor: prev && Math.abs(last.sg - prev.sg) <= 0.001 ? B.daysBetween(prev.date, last.date) : 0 };
  };
  B.daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  B.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  B.today = () => new Date().toISOString().slice(0, 10);


  // ---- inventory and "what can I brew" ----
  B.INV_KINDS = ['Fermentable', 'Hop', 'Yeast', 'Other'];
  // normalise a name for matching: lower case, no punctuation, no filler words
  B.normName = function (n) {
    return String(n || '').toLowerCase()
      .replace(/\b\d+(\.\d+)?\s*%?\s*(lb|lbs|oz|kg|g|aa|alpha)\b/g, ' ')   // weights and alpha percentages
      .replace(/\b(19|20)\d{2}\b/g, ' ')                                      // crop years
      .replace(/\b(malt|hops?|yeast|pellets?|leaf|dry|liquid|crop|pack|sachet)\b/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  };
  /* Match free text (from a label photo or typed) against a vocabulary of known names.
     Returns the best matches with a score, so the app can offer a confirm list rather than guessing. */
  B.matchVocab = function (text, vocab, limit) {
    const t = B.normName(text); if (!t) return [];
    const words = t.split(' ').filter(w => w.length >= 2);
    const scored = [];
    for (const v of vocab) {
      // a vocabulary entry may carry aliases: "US-05 / WLP001 / Wyeast 1056"
      const aliases = String(v).split('/').map(a => B.normName(a)).filter(Boolean);
      let best = 0;
      for (const n of aliases) {
        let score = 0;
        if (t.includes(n)) score = 100 + n.length;
        else {
          const nw = n.split(' ').filter(w => w.length >= 2);
          if (!nw.length) continue;
          const hits = nw.filter(w => words.includes(w)).length;
          if (hits) score = hits / nw.length * 60 + hits * 12;
        }
        if (score > best) best = score;
      }
      if (best > 0) scored.push({ name: v, score: Math.round(best) });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit || 5);
  };
  B.totalOf = (inv, kind) => inv.filter(i => i.kind === kind).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  /* Suggest what the stock could make.
     inv: [{kind, name, amount, unit}], styles: D.STYLES, fermRef/hopRef: reference tables.
     Scores each style on whether there is enough base malt for its OG, enough hops for its IBU,
     and whether a suitable yeast is on the shelf. */
  B.suggestBrews = function (inv, styles, fermRef, yeastRef, gallons) {
    const gal = gallons || 5.5;
    const ferms = inv.filter(i => i.kind === 'Fermentable');
    const hops = inv.filter(i => i.kind === 'Hop');
    const yeasts = inv.filter(i => i.kind === 'Yeast');
    const baseLb = ferms.reduce((s, f) => { const ref = fermRef.find(x => x.name === f.name); const isBase = ref ? (ref.group === 'Base' || ref.group === 'Extract') : true; return s + (isBase ? Number(f.amount) || 0 : 0); }, 0);
    const specialLb = ferms.reduce((s, f) => { const ref = fermRef.find(x => x.name === f.name); return s + (ref && ref.group !== 'Base' && ref.group !== 'Extract' ? Number(f.amount) || 0 : 0); }, 0);
    const darkLb = ferms.reduce((s, f) => { const ref = fermRef.find(x => x.name === f.name); return s + (ref && ref.lovibond >= 150 ? Number(f.amount) || 0 : 0); }, 0);
    const totalAlphaOz = hops.reduce((s, hp) => { const ref = (B._hopRef || []).find(x => x.name === hp.name); const aa = ref ? (ref.alphaLow + ref.alphaHigh) / 2 : 8; return s + (Number(hp.amount) || 0) * aa; }, 0);
    const out = [];
    for (const st of styles) {
      const needLb = B.grainForOg(st.ogLow, gal, 36, 0.72);
      const haveGrain = baseLb >= needLb * 0.9;
      // one oz of 10% alpha at 60 min in 5.5 gal is roughly 30 IBU; approximate the alpha-ounces needed
      const needAlphaOz = st.ibuLow / 3;
      const haveHops = totalAlphaOz >= needAlphaOz * 0.9;
      const needsDark = st.srmLow >= 15;
      const haveDark = !needsDark || darkLb > 0;
      const yeastOk = yeasts.some(y => {
        const ref = yeastRef.find(x => x.name === y.name); if (!ref) return true;
        const lagerStyle = /lager|pils|helles|bock|schwarz|dunkel|oktober|vienna/i.test(st.name);
        return lagerStyle ? ref.type === 'Lager' : ref.type !== 'Lager';
      });
      let score = 0; const missing = [];
      if (haveGrain) score += 40; else missing.push(`about ${Math.max(0, Math.round((needLb - baseLb) * 10) / 10)} lb more base malt`);
      if (haveHops) score += 25; else missing.push('more hops, or higher alpha ones');
      if (haveDark) score += 15; else missing.push('a dark or roast malt');
      if (yeastOk && yeasts.length) score += 20; else missing.push(yeasts.length ? 'a suitable yeast for this style' : 'yeast');
      if (specialLb > 0 && st.srmLow > 4) score += 5;
      out.push({ style: st, score: Math.min(100, score), missing, canBrew: missing.length === 0 });
    }
    return out.sort((a, b) => b.score - a.score || a.style.name.localeCompare(b.style.name));
  };
  B.setHopRef = ref => { B._hopRef = ref; };

  B.csvEscape = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  B.toCsv = (rows, cols) => [cols.map(c => B.csvEscape(c.label)).join(',')].concat(rows.map(r => cols.map(c => B.csvEscape(typeof c.key === 'function' ? c.key(r) : r[c.key])).join(','))).join('\n');

  if (typeof module !== 'undefined' && module.exports) module.exports = B; else root.BrewCore = B;
})(typeof window !== 'undefined' ? window : globalThis);
