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

  // ---- hop forms ----
  /* How each form of hop behaves. oaa: relative production of oxidized alpha acids in hot wort (pellets about twice cones);
     pp: polyphenols as a fraction of the weight; alphaScale: multiplier on the entered alpha (wet hops are ~80% water,
     so the normal dried rating is divided by five); tinseth: the old pellet bonus, kept for the comparison figure. */
  B.HOP_FORMS = {
    pellet: { label: 'Pellet (T-90)', oaa: 2.0, pp: 0.04, alphaScale: 1, tinseth: 1.1, hint: '' },
    leaf: { label: 'Whole leaf / cone', oaa: 1.0, pp: 0.04, alphaScale: 1, tinseth: 1.0, hint: 'Soaks up more wort than pellets: allow about 1 cup per oz.' },
    cryo: { label: 'Cryo / lupulin pellet', oaa: 2.0, pp: 0.02, alphaScale: 1, tinseth: 1.1, hint: 'Cryo, LupuLN2, Lupomax: about twice the alpha of the same hop in T-90. Use the alpha on the pack and about half the weight.' },
    extract: { label: 'CO2 extract (resin)', oaa: 1.0, pp: 0, alphaScale: 1, tinseth: 1.1, hint: 'Bittering only. Enter grams as oz (1 mL is about 1 g, 28 g per oz) and the alpha on the syringe, usually 55 to 65%.' },
    wet: { label: 'Wet / fresh hops', oaa: 1.0, pp: 0.008, alphaScale: 0.2, tinseth: 1.0, hint: 'Enter the normal dried alpha for the variety. Wet hops are about 80% water, so the app counts a fifth of it: use five to six times the weight.' }
  };
  B.hopForm = t => B.HOP_FORMS[t] || B.HOP_FORMS.pellet;

  // ---- hops: Tinseth (kept for comparison; the app's IBU figure is SMPH, below) ----
  B.tinsethUtilization = function (boilGravity, minutes) {
    const bigness = 1.65 * Math.pow(0.000125, boilGravity - 1);
    const timeFactor = (1 - Math.exp(-0.04 * minutes)) / 4.15;
    return r4(bigness * timeFactor);
  };
  // hop: {oz, alpha (percent), minutes, type: a HOP_FORMS key, whirlpool}
  B.ibuTinseth = function (hops, gallons, boilGravity) {
    const liters = gallons * L_PER_GAL;
    let total = 0;
    for (const hp of hops) {
      const form = B.hopForm(hp.type);
      const grams = (Number(hp.oz) || 0) * G_PER_OZ;
      const mgl = grams * (Number(hp.alpha) || 0) * form.alphaScale / 100 * 1000 / liters;
      let u = B.tinsethUtilization(boilGravity, Number(hp.minutes) || 0);
      u *= form.tinseth;
      if (hp.whirlpool) u *= 0.5;                 // rough allowance for a sub-boiling stand
      total += mgl * u;
    }
    return Math.round(total);
  };

  // ---- hops: SMPH ----
  /* The SMPH model of IBUs by John-Paul Hosom (alchemyoverlord), written here from his published description
     ("A Summary of Factors Affecting IBUs" and "IBUs and the SMPH Model"), not from his source code.
     It builds on M. G. Malowicki's isomerization kinetics, V. Peacock's definition of the IBU and work from
     T. H. Shellhammer's lab. What it does that Tinseth cannot:
       - alpha acids stop dissolving above roughly 200 ppm, so piling in hops stops adding bitterness;
       - isomerization follows temperature, so flameout, whirlpool and chill time are modelled rather than guessed;
       - isomerized alpha acids (IAA) are separated from the auxiliary bittering compounds (oxidized alpha and
         beta acids, hop and malt polyphenols) that a lab IBU test also reads;
       - the result is the IBU of finished beer, after the losses of the boil, fermentation and ageing.
     Parameter values are the published ones. Where the write-up covers one addition and a recipe has several, the
     solubility limit is applied to what is already dissolved (see dissolve()); that generalisation is ours. */
  B.SMPH_CREDIT = 'IBU calculations optimized using the SMPH Model by J. P. Hosom, based on the research of M. G. Malowicki, T. H. Shellhammer, and V. Peacock regarding non-linear hop alpha-acid isomerization kinetics.';
  const SM = B.SMPH = {
    k1: T => 7.9e11 * Math.exp(-11858 / T),       // alpha acids -> iso-alpha acids, per minute, T in kelvin (Malowicki)
    k2: T => 4.1e12 * Math.exp(-12994 / T),       // iso-alpha acids -> degradation products
    AA_MIN: 200, AA_MAX: 580,                     // solubility: all dissolves up to 200 ppm, never more than 580
    LF_BOIL: 0.51, LF_FERMENT: 0.85,              // IAA and oAA lost to trub in the boil; lost in fermentation
    OAA_BOIL: 0.11, OAA_AGESCALE: 0.33, OAA_FRESH: 0.0084, OBA_BOIL: 0.071,
    SCALE_OAA: 0.9155, SCALE_OBA: 0.85, SCALE_PP: 0.03, PP_PRECIP: 0.20, PP_FERMENT: 0.70,
    STOP_F: 140                                   // below this isomerization is negligible
  };
  B.SMPH_DEFAULTS = { pH: 5.5, clarity: 1.0, krausen: 1.0, ageWeeks: 3, chillMin: 10, wpTempF: 175, wpMin: 20, boilTempF: 212, freshness: 1, filterMicron: 0 };
  B.SMPH_CLARITY = [['Very clear', 1.3], ['Clear', 1.2], ['Somewhat clear', 1.1], ['Average', 1.0], ['Somewhat cloudy', 0.9], ['Cloudy (brew in a bag)', 0.8], ['Very cloudy', 0.7]];
  B.SMPH_KRAUSEN = [['Mixed back in, no loss', 1.126], ['Minor deposits', 1.05], ['Medium deposits (typical)', 1.0], ['Heavy deposits', 0.95], ['Blow-off, slow ferment', 0.938], ['Blow-off, normal ferment', 0.833], ['Blow-off, vigorous ferment', 0.729]];
  const fToK = f => (f - 32) * 5 / 9 + 273.15;
  // how much alpha acid is in solution when `raw` ppm has been added
  SM.soluble = function (raw) {
    if (raw <= SM.AA_MIN) return raw;
    const slope = Math.log(1 - SM.AA_MIN / SM.AA_MAX) / SM.AA_MIN;
    return SM.AA_MAX * (1 - Math.exp(slope * raw));
  };
  // the raw addition that would leave `dissolved` ppm in solution (inverse of soluble)
  SM.rawFor = function (dissolved) {
    if (dissolved <= SM.AA_MIN) return dissolved;
    const slope = Math.log(1 - SM.AA_MIN / SM.AA_MAX) / SM.AA_MIN;
    return Math.log(1 - Math.min(dissolved, SM.AA_MAX - 1e-6) / SM.AA_MAX) / slope;
  };
  // adding `add` ppm to wort that already holds `current` ppm in solution: how much of the new charge dissolves
  SM.dissolve = (current, add) => Math.max(0, SM.soluble(SM.rawFor(current) + add) - current);
  SM.lfGravity = function (og, boilMinutes) {
    const s = boilMinutes <= 30 ? 1 : boilMinutes >= 40 ? 4.9 : 0.39 * (boilMinutes - 30) + 1;
    return og > 1 ? 1 - 2 * Math.exp(-1 / (s * (og - 1))) : 1;
  };
  SM.lfPhIaa = pH => Math.max(0, Math.min(1.1, 0.071 * pH + 0.592));
  SM.lfPhNonIaa = pH => Math.max(0, Math.min(1.25, 0.8948 * pH - 4.145));
  SM.lfAge = weeks => 0.35 * Math.exp(-0.073 * Math.min(16, Math.max(0, weeks))) + 0.65;
  SM.lfFilter = micron => (micron > 0 && micron < 3.83) ? 0.017 * micron + 0.934 : 1;
  SM.lfFloc = floc => /low/i.test(floc || '') ? 1.05 : /high/i.test(floc || '') ? 0.95 : 1.0;
  SM.lfKrausenNonIaa = k => Math.max(0, 1 - 3 * (1 - k));   // auxiliary compounds are lost about three times as fast as IAA
  /* Hop polyphenols saturate at very high hopping rates. The published curve is a quadratic fitted to dry-hop data; it is applied
     in the kettle as well and held at its peak beyond it, so an absurd hop charge cannot add bitterness without limit. */
  // oxidized alpha and beta acids already in the hop dissolve freely, but they saturate too (published for dry hopping above 2200 ppm of hops)
  SM.oxEffective = function (hopsPpm) {
    const f = x => x * (x > 2200 ? Math.min(1, 1.1181 * Math.exp(-0.0000506 * x)) : 1), PEAK = 1 / 0.0000506;
    return hopsPpm >= PEAK ? f(PEAK) : f(hopsPpm);
  };
  SM.ppEffective = function (hopsPpm) {
    const f = x => x * Math.min(1, -7.47e-10 * x * x + 0.00000542 * x + 0.99733), PEAK = 23650;
    return hopsPpm >= PEAK ? f(PEAK) : f(hopsPpm);
  };

  /* hops: [{oz, alpha, minutes, type, whirlpool}] kettle additions; opts: { gallons (post-boil, cooled), og, boilMin,
     dryHops: [{oz, alpha, type}], wpTempF, wpMin, chillMin, boilTempF, pH, clarity, krausen, floc, ageWeeks, filterMicron, freshness }.
     Returns { ibu, kettle, dry, parts, utilization, dissolved (fraction of kettle alpha that went into solution), peakAA }. */
  B.ibuSmph = function (hops, opts) {
    const o = Object.assign({}, B.SMPH_DEFAULTS, opts || {});
    const liters = (Number(o.gallons) || 0) * L_PER_GAL;
    const empty = { ibu: 0, kettle: 0, dry: 0, parts: { iaa: 0, oaa: 0, oba: 0, pp: 0, malt: 0, dry: 0 }, utilization: 0, dissolved: 1, peakAA: 0 };
    if (!(liters > 0)) return empty;
    const og = Number(o.og) > 1 ? Number(o.og) : 1.050, boilMin = Math.max(0, Number(o.boilMin) || 60);
    const boilF = Number(o.boilTempF) || 212, wpF = Math.min(boilF, Number(o.wpTempF) || 175), wpMin = Math.max(0, Number(o.wpMin) || 0);
    const chillMin = Math.max(0.5, Number(o.chillMin) || 10), rate = (boilF - SM.STOP_F) / chillMin;   // F per minute under the chiller
    const fresh = Math.min(1, Math.max(0.3, Number(o.freshness) || 1));
    const list = (hops || []).map(h => {
      const form = B.hopForm(h.type), grams = (Number(h.oz) || 0) * G_PER_OZ, alpha = (Number(h.alpha) || 0) / 100 * form.alphaScale;
      const mins = Math.min(boilMin, Math.max(0, Number(h.minutes) || 0));
      return { form, grams, alpha, whirlpool: !!h.whirlpool, boilTime: h.whirlpool ? 0 : mins, ppmHops: grams * 1000 / liters, ppmAA: grams * alpha * 1000 / liters, AA: 0, IAA: 0, dissolvedAA: 0, added: false };
    }).filter(h => h.grams > 0);
    const anyWp = list.some(h => h.whirlpool);
    // temperature timeline after flameout: ramp to the stand temperature, hold, then chill to 140F
    const rampMin = anyWp ? (boilF - wpF) / rate : 0, holdEnd = boilMin + rampMin + (anyWp ? wpMin : 0);
    const endMin = holdEnd + ((anyWp ? wpF : boilF) - SM.STOP_F) / rate;
    const tempAt = t => t <= boilMin ? boilF : anyWp ? (t <= boilMin + rampMin ? boilF - rate * (t - boilMin) : t <= holdEnd ? wpF : wpF - rate * (t - holdEnd)) : boilF - rate * (t - boilMin);
    for (const h of list) h.at = h.whirlpool ? boilMin + rampMin : boilMin - h.boilTime;
    const dt = 0.25; let peak = 0;
    for (let t = 0; t < endMin + dt; t += dt) {
      for (const h of list) if (!h.added && h.at <= t + 1e-9) {
        const current = list.reduce((s, x) => s + x.AA, 0);
        h.dissolvedAA = SM.dissolve(current, h.ppmAA); h.AA = h.dissolvedAA; h.added = true;
      }
      peak = Math.max(peak, list.reduce((s, x) => s + x.AA, 0));
      if (t >= endMin) break;
      const T = fToK(tempAt(t + dt / 2)), k1 = SM.k1(T), k2 = SM.k2(T), e1 = Math.exp(-k1 * dt), e2 = Math.exp(-k2 * dt), c = k1 / (k2 - k1);
      for (const h of list) if (h.added) { h.IAA = h.IAA * e2 + h.AA * c * (e1 - e2); h.AA *= e1; }   // exact for a constant temperature over the step
    }
    const floc = SM.lfFloc(o.floc), kI = Number(o.krausen) || 1, kN = SM.lfKrausenNonIaa(kI), filt = SM.lfFilter(Number(o.filterMicron) || 0), age = SM.lfAge(Number(o.ageWeeks) || 0);
    const pH = Number(o.pH) || 5.5, pH0 = Number(o.pHUntreated) || pH;
    let iaa = 0, oaa = 0, oba = 0, pp = 0, addedAA = 0, dissolvedAA = 0;
    const kettlePpm = list.reduce((s, h) => s + h.ppmHops, 0), ppSat = kettlePpm > 0 ? SM.ppEffective(kettlePpm) / kettlePpm : 1, oxSat = kettlePpm > 0 ? SM.oxEffective(kettlePpm) / kettlePpm : 1;
    for (const h of list) {
      const lfOg = SM.lfGravity(og, h.boilTime), lfHop = h.ppmAA > 0 ? h.dissolvedAA / h.ppmAA : 1;
      iaa += h.IAA * SM.LF_BOIL * lfOg * SM.lfPhIaa(pH) * (Number(o.clarity) || 1) * SM.LF_FERMENT * floc * kI * filt * age;
      // oxidized alpha acids: whichever is larger of those already in the hop (fresh plus storage) and those made in the hot wort
      const aaHarvest = h.alpha / fresh;
      const oaaFrac = Math.max(aaHarvest * (SM.OAA_FRESH + SM.OAA_AGESCALE * (1 - fresh)) * oxSat, h.alpha * h.form.oaa * lfHop * SM.OAA_BOIL);
      oaa += oaaFrac * h.ppmHops * SM.LF_BOIL * lfOg * SM.lfPhNonIaa(pH) * SM.LF_FERMENT * floc * kN * filt * age;
      const obaFrac = SM.OBA_BOIL * (aaHarvest * 0.75) * (SM.OAA_FRESH + SM.OAA_AGESCALE * (1 - fresh)) * oxSat;   // beta acids taken as three quarters of alpha
      oba += obaFrac * h.ppmHops * SM.LF_BOIL * lfOg * SM.lfPhNonIaa(pH) * SM.LF_FERMENT * floc * kN * filt * age;
      pp += h.form.pp * h.ppmHops * ppSat * SM.PP_PRECIP * SM.PP_FERMENT * floc * kN * filt;
      addedAA += h.ppmAA; dissolvedAA += h.dissolvedAA;
    }
    const malt = (69.68 / 51.2) * (og - 1) * 19 * (2.477 * (pH0 - pH) + 1);
    // dry hops: no isomerization, but a lab IBU test reads the alpha acids, oxidized alpha acids and polyphenols they leave behind
    let dryScaled = 0;
    const dh = (o.dryHops || []).map(d => { const form = B.hopForm(d.type), grams = (Number(d.oz) || 0) * G_PER_OZ; return { form, ppmHops: grams * 1000 / liters, ppmAA: grams * (Number(d.alpha) || 0) / 100 * form.alphaScale * 1000 / liters }; }).filter(d => d.ppmHops > 0);
    if (dh.length) {
      const hopsPpm = dh.reduce((s, d) => s + d.ppmHops, 0), aaPpm = dh.reduce((s, d) => s + d.ppmAA, 0);
      const satOaa = SM.oxEffective(hopsPpm) / hopsPpm;
      const satPp = SM.ppEffective(hopsPpm) / hopsPpm;
      const aaBeer = 14.7 * (1 - Math.exp(-0.00102 * aaPpm));
      const oaaDry = aaPpm * (0.02 + 0.09 * Math.max(0, 0.96 - fresh)) * satOaa;
      const ppDry = dh.reduce((s, d) => s + d.form.pp * d.ppmHops, 0) * SM.PP_PRECIP * Math.max(0, satPp);
      dryScaled = aaBeer + oaaDry * SM.SCALE_OAA + ppDry * SM.SCALE_PP;
    }
    const k = 5 / 7;
    const parts = { iaa: r1(k * iaa), oaa: r1(k * oaa * SM.SCALE_OAA), oba: r1(k * oba * SM.SCALE_OBA), pp: r1(k * pp * SM.SCALE_PP), malt: r1(k * malt), dry: r1(k * dryScaled) };
    const kettle = k * (iaa + oaa * SM.SCALE_OAA + oba * SM.SCALE_OBA + pp * SM.SCALE_PP + malt), dry = k * dryScaled;
    return { ibu: Math.round(kettle + dry), kettle: r1(kettle), dry: r1(dry), parts, utilization: addedAA ? r3(iaa / addedAA) : 0, dissolved: addedAA ? r3(dissolvedAA / addedAA) : 1, peakAA: Math.round(peak) };
  };
  /* Ounces of one addition needed to bring a recipe to a target IBU, with the other additions in place.
     Returns null when the target cannot be reached (the solubility limit), so callers can say so rather than ask for a pound of hops. */
  B.hopsForIbuSmph = function (targetIbu, hop, otherHops, opts, maxOz) {
    const at = oz => B.ibuSmph((otherHops || []).concat([Object.assign({}, hop, { oz })]), opts);
    const cap = maxOz || 16;
    if (at(0).kettle + at(0).dry >= targetIbu) return 0;
    const top = at(cap); if (top.kettle + top.dry < targetIbu) return null;
    let lo = 0, hi = cap;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, r = at(mid); if (r.kettle + r.dry < targetIbu) lo = mid; else hi = mid; }
    return r2(hi);
  };
  // kept for callers that still think in Tinseth terms
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

  // ---- water: from a report to ions, and from ions to additions ----
  B.IONS = ['Ca', 'Mg', 'Na', 'Cl', 'SO4', 'HCO3'];
  // Reports quote hardness and alkalinity "as CaCO3". units: 'ppm' | 'gpg' (grains per gallon) | 'dH' (German degrees)
  B.asCaCO3 = (v, units) => (Number(v) || 0) * (units === 'gpg' ? 17.1 : units === 'dH' ? 17.85 : 1);
  B.caFromHardness = caHardness => r1(caHardness * 0.4004);          // calcium hardness as CaCO3 -> Ca ppm
  B.mgFromHardness = mgHardness => r1(mgHardness * 0.2428);          // magnesium hardness as CaCO3 -> Mg ppm
  B.hco3FromAlkalinity = alk => r1(alk * 1.219);                      // total alkalinity as CaCO3 -> bicarbonate ppm
  B.alkalinityFromHco3 = hco3 => r1(hco3 / 1.219);
  B.so4FromSulfur = s => r1(s * 2.996);                               // sulfate reported "as S"
  /* Only total hardness and alkalinity known (a test kit, or a thin report): split the hardness 70:30 calcium to magnesium,
     which is typical of natural waters. An estimate, flagged as one in the app. */
  B.waterFromKit = function (totalHardness, alkalinity) {
    return { Ca: B.caFromHardness(totalHardness * 0.7), Mg: B.mgFromHardness(totalHardness * 0.3), Na: 0, Cl: 0, SO4: 0, HCO3: B.hco3FromAlkalinity(alkalinity), estimated: true };
  };
  // Kolbach residual alkalinity, ppm as CaCO3: what is left to push mash pH up after calcium and magnesium have pulled it down
  B.residualAlkalinity = w => Math.round(B.alkalinityFromHco3(w.HCO3 || 0) - (w.Ca || 0) / 1.4 - (w.Mg || 0) / 1.7);
  B.raVerdict = function (ra) {
    if (ra < -50) return 'suits only the palest beers; dark grists will mash too acid';
    if (ra < 25) return 'right for pale beers: pilsner, helles, pale ale, IPA';
    if (ra < 100) return 'right for amber beers; pale beers need acid or dilution';
    if (ra < 200) return 'right for brown and dark beers; pale beers need acid or dilution';
    return 'too alkaline for anything but the darkest beers: dilute or acidify';
  };
  // 88% lactic acid to neutralise alkalinity: about 11.8 milliequivalents per mL. Approximate: add in steps, measure if you can.
  B.lacticForAlkalinity = (alkToRemoveAsCaCO3, gallons) => alkToRemoveAsCaCO3 > 0 ? r1(alkToRemoveAsCaCO3 / 50 * gallons * L_PER_GAL / 11.8) : 0;
  B.SALT_TSP = { 'Gypsum (CaSO4)': 4.0, 'Calcium chloride (CaCl2)': 3.4, 'Epsom salt (MgSO4)': 4.5, 'Table salt (NaCl)': 6.0, 'Baking soda (NaHCO3)': 4.6 };   // grams per level teaspoon, roughly
  /* Work out what to add. source and target are ion profiles in ppm; gallons is all the brewing water.
     Ions can only come out by dilution, so each dilution with RO from 0 to 100% is tried, the salts are solved for each
     (non-negative least squares, by coordinate descent), and the closest result wins, with a small bias toward using less RO.
     opts: { dilute: false to forbid RO, salts: names to allow }. */
  B.waterSolve = function (source, target, gallons, opts) {
    const o = opts || {}, ions = B.IONS, W = { Ca: 0.7, Mg: 0.7, Na: 1.0, Cl: 1.5, SO4: 1.0, HCO3: 0.5 };
    const names = (o.salts || ['Gypsum (CaSO4)', 'Calcium chloride (CaCl2)', 'Epsom salt (MgSO4)', 'Table salt (NaCl)', 'Baking soda (NaHCO3)']).filter(n => B.SALTS[n]);
    const gal = Number(gallons) || 0; if (!(gal > 0)) return null;
    const src = {}, tgt = {}; for (const i of ions) { src[i] = Number(source && source[i]) || 0; tgt[i] = Number(target && target[i]) || 0; }
    const err = res => ions.reduce((s, i) => s + W[i] * Math.pow(res[i] - tgt[i], 2), 0);
    const apply = (base, grams) => { const res = Object.assign({}, base); names.forEach((n, j) => { for (const ion in B.SALTS[n]) res[ion] += B.SALTS[n][ion] * grams[j] / gal; }); return res; };
    const solveFor = d => {
      const base = {}; for (const i of ions) base[i] = src[i] * (1 - d);
      const g = names.map(() => 0);
      for (let it = 0; it < 300; it++) names.forEach((n, j) => {
        const others = g.slice(); others[j] = 0; const res = apply(base, others);
        let num = 0, den = 0; for (const ion in B.SALTS[n]) { const a = B.SALTS[n][ion] / gal; num += W[ion] * a * (tgt[ion] - res[ion]); den += W[ion] * a * a; }
        g[j] = den ? Math.max(0, num / den) : 0;
      });
      const grams = g.map(x => { const v = Math.round(x * 10) / 10; return v < 0.3 ? 0 : v; }), result = apply(base, grams);   // under 0.3 g is not worth weighing
      return { dilution: d, grams, result, error: err(result) };
    };
    const tries = o.dilute === false ? [0] : [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1];
    let best = null;
    for (const d of tries) { const t = solveFor(d); t.score = t.error + 60 * d; if (!best || t.score < best.score - 1e-9) best = t; }
    const result = {}; for (const i of ions) result[i] = Math.round(best.result[i]);
    result.ratio = result.Cl ? r2(result.SO4 / result.Cl) : null;
    return { dilution: best.dilution, roGal: r2(gal * best.dilution), tapGal: r2(gal * (1 - best.dilution)),
      additions: names.map((n, j) => ({ salt: n, grams: best.grams[j], tsp: r2(best.grams[j] / (B.SALT_TSP[n] || 4)) })).filter(a => a.grams > 0),
      result, target: tgt, rms: Math.round(Math.sqrt(ions.reduce((s, i) => s + Math.pow(result[i] - tgt[i], 2), 0) / ions.length)),
      ra: B.residualAlkalinity(result), excessAlk: Math.max(0, Math.round(B.alkalinityFromHco3(result.HCO3 - tgt.HCO3))) };
  };

  // ---- gravity came in low: sugar, or a longer boil ----
  B.sugarToReach = (currentSg, gallons, targetSg, ppg) => { const pts = (B.points(targetSg) - B.points(currentSg)) * gallons; return pts > 0 && ppg ? r2(pts / ppg) : 0; };   // lb
  B.extraBoilMinutes = function (currentSg, gallons, targetSg, boilOffGalHr) {
    if (!(targetSg > currentSg) || !boilOffGalHr) return 0;
    const needGal = gallons - gallons * B.points(currentSg) / B.points(targetSg);
    return Math.round(needGal / boilOffGalHr * 60);
  };

  // ---- durations typed on brew day: "75", "1:15", "14h", "14h 20m", "overnight" is left to the note ----
  B.parseDuration = function (text) {
    const t = String(text === undefined || text === null ? '' : text).trim().toLowerCase(); if (!t) return null;
    let m = t.match(/^(\d+)\s*:\s*(\d{1,2})$/); if (m) return Number(m[1]) * 60 + Number(m[2]);
    m = t.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/); if (m) return Math.round(Number(m[1]) * 60 + (Number(m[2]) || 0));
    m = t.match(/^(\d+(?:\.\d+)?)\s*(?:m(?:in(?:utes?)?)?)?$/); if (m) return Math.round(Number(m[1]));
    return null;
  };
  B.fmtDuration = function (minutes) {
    const n = Math.round(Number(minutes)); if (!isFinite(n) || n < 0) return '';
    return n < 100 ? `${n} min` : `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')} min`;
  };

  // ---- how long it sits in the fermenter ----
  /* An estimate to plan around, not a schedule: gravity readings decide when a beer is done. yeast: a D.YEAST row (or null). */
  B.fermentPlan = function (yeast, og) {
    const name = (yeast && yeast.name) || '', type = (yeast && yeast.type) || 'Ale', g = Number(og) > 1 ? Number(og) : 1.050;
    let low, high, note, lager = null, dry = [7, 10];
    if (type === 'Kveik') { low = 4; high = 7; dry = [3, 4]; note = 'Kveik at 85 to 95F is usually finished in three or four days; give it a week to clean up.'; }
    else if (type === 'Lager') { low = 14; high = 21; dry = [10, 14]; lager = [4, 6]; note = 'Two to three weeks including a diacetyl rest near 62F for the last few days, then four to six weeks cold.'; }
    else if (type === 'Sour' || type === 'Mixed') { low = 180; high = 540; dry = [170, 180]; note = 'Mixed fermentation works in months, not weeks: 6 to 18, and it is ready when it tastes ready. A kettle sour follows its ale yeast instead.'; }
    else if (/saison|belgian|trappist|abbey|ardennes|3711|3724|belle/i.test(name)) { low = 14; high = 21; dry = [10, 14]; note = 'Belgian and saison strains start fast and finish slowly; let it free-rise and give it the third week.'; }
    else { low = 10; high = 14; note = 'Most ales reach final gravity in 5 to 8 days; the extra days let the yeast clean up and drop.'; }
    if (type !== 'Sour' && type !== 'Mixed') { if (g >= 1.090) { low += 14; high += 21; dry = dry.map(d => d + 10); note += ' At this gravity expect at least two more weeks.'; } else if (g >= 1.070) { low += 5; high += 7; dry = dry.map(d => d + 4); note += ' Strong beers take about a week longer.'; } }
    return { low, high, checkDay: Math.max(3, low - 3), dryHopWindow: dry, lagerWeeks: lager, note,
      text: low >= 60 ? `${Math.round(low / 30)} to ${Math.round(high / 30)} months` : `${low} to ${high} days` + (lager ? `, then ${lager[0]} to ${lager[1]} weeks cold` : '') };
  };
  /* Dry hops carry their own day when the brewer set one; otherwise they fall in the plan's window.
     Returns [{name, oz, type, fromDay, toDay, fromDate, toDate, days}] */
  B.dryHopSchedule = function (dryHops, plan, pitchDate) {
    return (dryHops || []).filter(d => d && d.name).map(d => {
      const from = d.day !== undefined && d.day !== '' && isFinite(Number(d.day)) ? Number(d.day) : plan.dryHopWindow[0];
      const to = d.day !== undefined && d.day !== '' && isFinite(Number(d.day)) ? Number(d.day) + 2 : plan.dryHopWindow[1];
      return { name: d.name, oz: d.oz, type: d.type || 'pellet', days: Number(d.days) || 4, fromDay: from, toDay: to, fromDate: pitchDate ? B.addDays(pitchDate, from) : null, toDate: pitchDate ? B.addDays(pitchDate, to) : null };
    });
  };
  // A calendar file, because a web page cannot reliably ring an alarm a week from now and a phone calendar can.
  B.icsFor = function (batchName, pitchDate, plan, schedule) {
    const d = s => String(s).replace(/-/g, ''), esc = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const ev = (date, title, body, uid) => ['BEGIN:VEVENT', `UID:${uid}@brewlog`, `DTSTAMP:${d(pitchDate)}T000000Z`, `DTSTART;VALUE=DATE:${d(date)}`, `DTEND;VALUE=DATE:${d(B.addDays(date, 1))}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(body)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT'].join('\r\n');
    const id = String(batchName || 'batch').replace(/[^\w]/g, '') + d(pitchDate);
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Brew Log//EN', 'CALSCALE:GREGORIAN'];
    (schedule || []).forEach((h, i) => out.push(ev(h.fromDate, `Dry hop ${batchName}: ${h.oz ? h.oz + ' oz ' : ''}${h.name}`, `Add between day ${h.fromDay} and day ${h.toDay}. Leave ${h.days} days, then crash or package.`, `${id}dh${i}`)));
    out.push(ev(B.addDays(pitchDate, plan.checkDay), `Gravity check: ${batchName}`, 'First reading. The same number twice, three days apart, means it is done.', `${id}g`));
    out.push(ev(B.addDays(pitchDate, plan.low), `${batchName}: earliest packaging`, `Expected ${plan.text} in the fermenter. Package only on a stable gravity.`, `${id}p`));
    out.push('END:VCALENDAR');
    return out.join('\r\n');
  };
  // Old batches kept dry hops as text in extras ("Dry hop: 2 oz Mosaic, 4 days" or "Dry hop: Mosaic 2 oz"); read those too.
  B.dryHopsOf = function (batch) {
    if (batch && Array.isArray(batch.dryHops)) return batch.dryHops;
    const out = [];
    for (const e of (batch && batch.extras) || []) {
      const m = /^dry hop:\s*(.*)$/i.exec(String(e || '')); if (!m) continue;
      const body = m[1]; const oz = (body.match(/(\d+(?:\.\d+)?)\s*oz/i) || [])[1]; const days = (body.match(/(\d+)\s*days?/i) || [])[1];
      const name = body.replace(/(\d+(?:\.\d+)?)\s*oz/i, '').replace(/,?\s*\d+\s*days?/i, '').replace(/^[\s,]+|[\s,]+$/g, '');
      if (name) out.push({ name, oz: oz || '', type: 'pellet', days: days || 4, day: '' });
    }
    return out;
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


  // ---- brew day: what gets written down at each step ----
  /* One definition of the numbers a brewer records, shared by the quick step list and the guided mode.
     kind: 'temp' | 'vol' | 'gravity' | 'duration'. ph: the target, shown as a placeholder so a blank stays blank. */
  B.stepFields = function (id, t) {
    const T = t || {};
    return ({
      strike: [{ k: 'strikeF', l: 'Water temp (F)', kind: 'temp', ph: T.strikeF }],
      mashin: [{ k: 'mashInF', l: 'Mash temp (F)', kind: 'temp', ph: T.mashF }],
      mashout: [{ k: 'mashTotal', l: 'Total mash time', kind: 'duration', ph: 'min, or h:mm if it sat overnight' }],
      sparge: [{ k: 'spargeGal', l: 'Sparge volume (gal)', kind: 'vol', ph: T.spargeGal }, { k: 'spargeF', l: 'Sparge temp (F)', kind: 'temp', ph: 168 }],
      boil: [{ k: 'boilStartF', l: 'Boil temp (F)', kind: 'temp', ph: T.boilF || 212 }],
      flameout: [{ k: 'boilTotal', l: 'Total boil time', kind: 'duration', ph: T.boilMin ? T.boilMin + ' planned' : 'min' }],
      chill: [{ k: 'chilledToF', l: 'Chilled to (F)', kind: 'temp', ph: T.pitchF }],
      pitch: [{ k: 'pitchF', l: 'Pitch temp (F)', kind: 'temp', ph: T.pitchF }]
    })[id] || [];
  };
  B.ACTUAL_LABELS = { strikeF: 'Strike water', mashInF: 'Mash in', mashTotal: 'Total mash', spargeGal: 'Sparge volume', spargeF: 'Sparge temp', boilStartF: 'Boil temp', boilTotal: 'Total boil', chilledToF: 'Chilled to', pitchF: 'Pitched at' };
  B.fmtActual = function (k, v) {
    if (v === undefined || v === null || v === '') return '';
    if (k === 'mashTotal' || k === 'boilTotal') return B.fmtDuration(v);
    if (k === 'spargeGal') return v + ' gal';
    return v + 'F';
  };
  // "153F" / "5.5 gal, 168F": the recorded numbers as they go in the log line
  B.actualsText = (fields, vals) => fields.map(f => B.fmtActual(f.k, vals[f.k])).filter(Boolean).join(', ');
  B.brewTargets = function (batch, eq, grainLb, yeast) {
    const n = v => Number(v) || 0;
    const mashF = n(batch.mashF) || 152, boilMin = n(batch.boilMin) || eq.boilMin || 60, preBoil = n(batch.boilGal) || eq.boilGal;
    const strikeGal = B.strikeWaterVolume(grainLb, eq.qtPerLb);
    const pitchF = n(batch.fermF) || (yeast ? yeast.tempLow + Math.round((yeast.tempHigh - yeast.tempLow) / 3) : 66);
    return { mashF, boilMin, preBoil, strikeGal, strikeF: B.strikeTemp(eq.qtPerLb, 65, mashF, eq.tunLossF), spargeGal: B.spargeVolume(preBoil, strikeGal, grainLb, eq.absorbGalLb),
      mashMin: n(batch.mashMin) || 60, pitchF, boilF: eq.elevationFt ? Math.round(212 - eq.elevationFt / 500) : 212, wpTempF: n(batch.wpTempF) || 175, wpMin: n(batch.wpMin) || 20,
      pitchRange: yeast ? [yeast.tempLow, yeast.tempHigh] : null };
  };
  B.pitchAdvice = function (yeast, pitchF) {
    if (!yeast) return 'Pick a yeast from the list on the recipe and its pitch and ferment range shows here.';
    const base = `${yeast.name.split('/')[0].trim()}: pitch and ferment at ${yeast.tempLow} to ${yeast.tempHigh}F. Pitch at the low end and let it rise.`;
    const t = Number(pitchF); if (!t) return base;
    if (t > yeast.tempHigh) return `${base} ${t}F is ${t - yeast.tempHigh}F above the range: keep chilling or wait, hot pitches make fusels and esters.`;
    if (t < yeast.tempLow) return `${base} ${t}F is ${yeast.tempLow - t}F below the range: a slow start is likely; let it warm before you worry.`;
    return `${base} ${t}F is in range.`;
  };

  /* The quick step list: one line per thing that happens, hops at their clock positions. */
  B.brewSteps = function (batch, eq, grainLb, yeast) {
    const n = v => Number(v) || 0, T = B.brewTargets(batch, eq, grainLb, yeast);
    const steps = [];
    if (grainLb > 0) steps.push({ id: 'strike', t: 'Strike water heated' }, { id: 'mashin', t: 'Mash in' }, { id: 'mashout', t: 'Mash out' }, { id: 'sparge', t: 'Sparge' });
    steps.push({ id: 'boil', t: 'Boil starts' });
    (batch.hops || []).filter(hp => hp.name && hp.minutes !== '' && !hp.whirlpool).sort((x, y) => n(y.minutes) - n(x.minutes)).forEach((hp, i) => steps.push({ id: `hop:${hp.name}:${hp.minutes}:${i}`, t: `${hp.oz} oz ${hp.name}`, at: Math.max(0, T.boilMin - n(hp.minutes)), hop: true }));
    steps.push({ id: 'flameout', t: 'Flameout', at: T.boilMin });
    (batch.hops || []).filter(hp => hp.name && hp.whirlpool).forEach((hp, i) => steps.push({ id: `wp:${hp.name}:${i}`, t: `Whirlpool: ${hp.oz} oz ${hp.name} at ${T.wpTempF}F for ${T.wpMin} min`, hop: true }));
    steps.push({ id: 'chill', t: 'Chilled' }, { id: 'pitch', t: 'Yeast pitched' });
    steps.forEach(s => { s.fields = B.stepFields(s.id, T); });
    return { steps, targets: T };
  };

  // ---- guided brew day plan ----
  /* Builds the step sequence for a batch from its recipe and the equipment profile. Pure, so it is testable.
     batch: the app's batch; eq: equipment profile; grainLb: mashed grain weight; boilG: estimated boil gravity; yeast: D.YEAST row or null */
  B.brewPlan = function (batch, eq, grainLb, boilG, yeast) {
    const n = v => Number(v) || 0, T = B.brewTargets(batch, eq, grainLb, yeast);
    const boilMin = T.boilMin, mashF = T.mashF, mashMin = T.mashMin, strikeGal = T.strikeGal, strikeF = T.strikeF, preBoil = T.preBoil, spargeGal = T.spargeGal;
    const hops = (batch.hops || []).filter(h => h.name);
    const boilHops = hops.filter(h => !h.whirlpool && h.minutes !== '' && n(h.minutes) <= boilMin).map(h => ({ at: boilMin - n(h.minutes), label: `Add ${h.oz} oz ${h.name}` })).sort((a, b) => a.at - b.at);
    const wp = hops.filter(h => h.whirlpool);
    const dryHops = B.dryHopsOf(batch);
    const salts = (batch.salts || []).filter(s => s.grams);
    const steps = [];
    const yeastNote = batch.yeast ? `Yeast: ${batch.yeast}` : 'Yeast: as planned';
    if (grainLb > 0) {
      steps.push({ id: 'strike', kind: 'action', title: 'Heat strike water', detail: [`${strikeGal} gal at ${eq.qtPerLb} qt per lb`, `Target ${strikeF}F (grain at 65F, ${eq.tunLossF}F lost to the vessel)`, salts.length ? `Salts in now: ${salts.map(s => `${s.grams} g ${String(s.salt).replace(/\s*\(.*\)/, '')}`).join(', ')}` : 'Salts and any Campden tablet go in the water now'], done: 'Water is at temperature' });
      steps.push({ id: 'mashin', kind: 'timer', minutes: mashMin, title: 'Mash in', detail: [`Stir the grain in, break every dough ball, check the bed reads ${mashF}F`, `Hold ${mashMin} minutes, or as long as you like: an overnight mash is fine, just note it`, 'Recirculating system: pump on once the bed settles'], alarms: [{ at: Math.round(mashMin / 2), label: 'Halfway: check the mash temperature and stir if it has stratified' }, { at: mashMin, label: 'Mash complete' }], done: 'Mash finished' });
      steps.push({ id: 'mashout', kind: 'timer', minutes: 10, title: 'Mash out', detail: ['Raise to 168F and hold 10 minutes; stops conversion and thins the sugars for the sparge', 'Skip on a single-infusion no-sparge system if you prefer', 'The total mash time below is counted from when you started the mash timer; correct it if it sat longer'], alarms: [{ at: 10, label: 'Mash out done' }], done: 'At 168F for 10 minutes', optional: true });
      steps.push({ id: 'sparge', kind: 'action', title: 'Sparge and collect', detail: [`Sparge with about ${spargeGal} gal at 168F`, `Collect ${preBoil} gal pre-boil`, 'Stop when runnings drop below 1.010 or the collected volume is reached'], done: `Collected ${preBoil} gal` });
      steps.push({ id: 'preboil', kind: 'input', title: 'Pre-boil gravity', detail: [boilG ? `Expected about ${boilG.toFixed(3)} at ${preBoil} gal` : 'Take a reading and note the volume', 'Cool the sample; write the temperature next to the reading'], input: 'gravity', done: 'Reading taken' });
    } else {
      steps.push({ id: 'water', kind: 'action', title: 'Heat the water', detail: [`Bring ${preBoil} gal to a boil`, 'Extract batch: add extract off the heat, stir until dissolved, then return to the boil'], done: 'Extract dissolved, back on the heat' });
    }
    const boilAlarms = boilHops.map(h => ({ at: h.at, label: h.label }));
    if (boilMin >= 15) boilAlarms.push({ at: boilMin - 15, label: 'Whirlfloc or Irish moss, and drop the chiller in to sanitise' });
    boilAlarms.push({ at: boilMin, label: 'Flameout' });
    boilAlarms.sort((a, b) => a.at - b.at);
    steps.push({ id: 'boil', kind: 'timer', minutes: boilMin, title: `Boil ${boilMin} minutes`, detail: ['Watch the first five minutes for boilover', 'Additions fire as alarms below; tick each one as it goes in', 'Gravity short at the end? Boil on, or add sugar: both are below'], alarms: boilAlarms, done: 'Flameout', sugar: true, extraFields: ['flameout'] });
    if (wp.length) steps.push({ id: 'whirlpool', kind: 'timer', minutes: T.wpMin, title: 'Whirlpool hop stand', detail: [`Cool to ${T.wpTempF}F, then add ${wp.map(h => `${h.oz} oz ${h.name}`).join(', ')}`, `Stir to a whirlpool, lid on, ${T.wpMin} minutes`], alarms: [{ at: T.wpMin, label: 'Stand complete: start chilling' }], done: 'Stand finished' });
    const pitchF = T.pitchF;
    steps.push({ id: 'chill', kind: 'action', title: 'Chill', detail: [`Chill to ${pitchF}F, or as close as the tap water allows; in summer, note where it stopped and let the fermenter finish the job`, 'Sanitise everything from here on: fermenter, lid, airlock, hydrometer, thief'], done: 'At pitching temperature' });
    steps.push({ id: 'og', kind: 'input', title: 'Transfer and original gravity', detail: [batch.og ? `Expected OG ${Number(batch.og).toFixed(3)}` : 'Take the OG reading', 'Leave the trub behind; note the volume in the fermenter', 'Aerate or oxygenate before pitching'], input: 'gravity', done: 'OG logged', sugar: true });
    steps.push({ id: 'pitch', kind: 'action', title: 'Pitch', detail: [yeastNote, B.pitchAdvice(yeast), 'Hold the first 72 hours at the low end; airlock or blow-off on; label the fermenter with the batch and date'], done: 'Pitched' });
    const plan = B.fermentPlan(yeast, n(batch.og) || 1.05), sched = B.dryHopSchedule(dryHops, plan, null);
    steps.push({ id: 'ferment', kind: 'note', title: 'Now it sits', detail: [`Expect ${plan.text} in the fermenter`, plan.note, `First gravity check around day ${plan.checkDay}; the same number twice, three days apart, means it is done`].concat(sched.map(h => `Dry hop: ${h.oz ? h.oz + ' oz ' : ''}${h.name} between day ${h.fromDay} and day ${h.toDay}, ${h.days} days' contact`)), done: 'Done for today' });
    steps.forEach(s => { s.fields = B.stepFields(s.id, T).concat((s.extraFields || []).flatMap(x => B.stepFields(x, T))); });
    return steps;
  };

  B.csvEscape = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  B.toCsv = (rows, cols) => [cols.map(c => B.csvEscape(c.label)).join(',')].concat(rows.map(r => cols.map(c => B.csvEscape(typeof c.key === 'function' ? c.key(r) : r[c.key])).join(','))).join('\n');

  if (typeof module !== 'undefined' && module.exports) module.exports = B; else root.BrewCore = B;
})(typeof window !== 'undefined' ? window : globalThis);
