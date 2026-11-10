/* Brew Log - recipes as text. Two jobs, both pure (no DOM):
   1. parse(): read a recipe someone typed, pasted from a forum or another program, or photographed, and turn it into a batch.
      It is deliberately forgiving: what it can read becomes ingredients, what it cannot is handed back so nothing is lost silently.
   2. encodeShare() / decodeShare(): a whole recipe packed into the end of a link, so it can be sent to another brewer with no server. */
(function (root) {
  'use strict';
  const R = {};
  const r2 = x => Math.round(x * 100) / 100, r1 = x => Math.round(x * 10) / 10;
  const KG_LB = 2.20462, G_OZ = 28.3495, L_GAL = 3.78541;
  const plain = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---------- numbers and amounts ----------
  const FRACTIONS = { '\u00BD': '1/2', '\u00BC': '1/4', '\u00BE': '3/4', '\u2153': '1/3', '\u2154': '2/3', '\u215B': '1/8', '\u215C': '3/8' };
  R.clean = function (text) {
    return String(text || '').replace(/\r\n?/g, '\n').replace(/[\u00BD\u00BC\u00BE\u2153\u2154\u215B\u215C]/g, c => ' ' + FRACTIONS[c])
      .replace(/[\u2012\u2013\u2014\u2212]/g, '-').replace(/[\u2018\u2019]/g, '\'').replace(/[\u201C\u201D]/g, '"').replace(/\u00A0/g, ' ').replace(/\t/g, '  ')
      .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')                        // 4,5 kg is 4.5 kg
      .replace(/ {3,}/g, '  ');
  };
  const numOf = s => { const t = String(s).trim(); let m = t.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/); if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
    m = t.match(/^(\d+)\/(\d+)$/); if (m) return Number(m[1]) / Number(m[2]); return Number(t.startsWith('.') ? '0' + t : t); };
  const NUM = '(\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|\\.\\d+)';
  const UNIT = '(lbs?\\.?|pounds?|#|oz\\.?|ounces?|kgs?|kilos?|kilograms?|grams?|gms?|gr|g)';
  const AMOUNT = new RegExp('(?:^|[^a-z0-9.])' + NUM + '\\s*' + UNIT + '(?![a-z])', 'i');
  const unitKind = u => { const t = u.toLowerCase(); return /^(lb|pound|#)/.test(t) ? 'lb' : /^(oz|ounce)/.test(t) ? 'oz' : /^k/.test(t) ? 'kg' : 'g'; };
  /* The weight on a line. "9 lb 8 oz" is one amount. Returns { lb, oz, unit, at, len } (lb and oz both filled in) or null. */
  R.amount = function (line) {
    const m = AMOUNT.exec(line); if (!m) return null;
    const lead = m[0].length - m[0].replace(/^[^0-9.]/, '').length, at = m.index + lead; let len = m[0].length - lead;
    const value = numOf(m[1]), kind = unitKind(m[2]); if (!isFinite(value)) return null;
    let lb = kind === 'lb' ? value : kind === 'oz' ? value / 16 : kind === 'kg' ? value * KG_LB : value / G_OZ / 16;
    if (kind === 'lb') { const more = new RegExp('^(?:\\s|,|and)*' + NUM + '\\s*(?:oz\\.?|ounces?)(?![a-z])', 'i').exec(line.slice(at + len)); if (more) { lb += numOf(more[1]) / 16; len += more[0].length; } }
    return { lb, oz: lb * 16, unit: kind, at, len };
  };
  const toF = (n, unit) => /c/i.test(unit || '') ? Math.round(n * 9 / 5 + 32) : Math.round(n);
  const TEMPS = /(\d{2,3}(?:\.\d+)?)\s*(?:\u00B0|deg(?:rees?)?)?\s*([fc])(?![a-z])/gi;
  const temps = s => [...String(s).matchAll(TEMPS)].map(m => ({ f: toF(Number(m[1]), m[2]), metric: /c/i.test(m[2]), at: m.index }));

  // ---------- vocabulary ----------
  /* Fermentables as recipes actually write them. Order matters: the specific names come before the generic ones they contain
     ("honey malt" before "honey", "cara-pils" before "pils", every extract before the grain it is made from). */
  const X = '(lme|liquid (malt )?extract|malt syrup|malt extract)', DX = '(dme|dry (malt )?extract|dried (malt )?extract|spraymalt)';
  const FERM_RULES = [
    ['Rice hulls', /rice hulls?/], ['Rice syrup solids', /rice (syrup )?solids|rice syrup/],
    ['Extra light DME', new RegExp('extra[\\s-]*light.*' + DX + '|' + DX + '.*extra[\\s-]*light')], ['Wheat DME', new RegExp('wheat.*' + DX + '|' + DX + '.*wheat')],
    ['Amber DME', new RegExp('amber.*' + DX + '|' + DX + '.*amber')], ['Dark DME', new RegExp('dark.*' + DX + '|' + DX + '.*dark')], ['Light DME', new RegExp('\\b' + DX)],
    ['Wheat LME', new RegExp('wheat.*' + X + '|' + X + '.*wheat')], ['Munich LME', new RegExp('munich.*' + X + '|' + X + '.*munich')],
    ['Amber LME', new RegExp('amber.*' + X + '|' + X + '.*amber')], ['Dark LME', new RegExp('dark.*' + X + '|' + X + '.*dark')], ['Light LME', new RegExp('\\b' + X)],
    ['Belgian candi syrup D-180', /\bd[\s-]?180\b|dark candi/], ['Belgian candi syrup D-45', /\bd[\s-]?45\b|candi/],
    ['Corn sugar (dextrose)', /corn sugar|dextrose|priming sugar/], ['Brown sugar', /brown sugar|demerara|turbinado|muscovado/], ['Table sugar (sucrose)', /table sugar|cane sugar|beet sugar|sucrose|white sugar|^\s*sugar\s*$/],
    ['Honey malt', /honey malt|brumalt/], ['Honey', /\bhoney\b/], ['Lactose', /lactose|milk sugar/], ['Maple syrup', /maple/], ['Agave nectar', /agave/], ['Molasses', /molasses|treacle/],
    ['Oak-smoked wheat malt', /oak[\s-]*smoked wheat/], ['Midnight wheat', /midnight wheat/], ['Torrified wheat', /torrified/], ['Unmalted wheat', /(unmalted|raw) wheat/],
    ['Flaked wheat', /flaked wheat|wheat,?\s*flaked|wheat flakes/], ['Flaked oats', /flaked oats?|oats?,?\s*flaked|oat flakes|rolled oats|quick oats|^\s*oats\s*$/],
    ['Flaked barley', /flaked barley|barley,?\s*flaked/], ['Flaked corn (maize)', /flaked (corn|maize)|(corn|maize),?\s*flaked/], ['Flaked rice', /flaked rice|rice,?\s*flaked/], ['Flaked rye', /flaked rye|rye,?\s*flaked/],
    ['CaraMunich', /cara[\s-]*munich/], ['CaraPils / Carafoam', /cara[\s-]*pils|cara[\s-]*foam|dextrine?\b/], ['Special B', /special\s*b\b/], ['Carafa Special II', /carafa/],
    ['Pale chocolate', /pale chocolate/], ['Chocolate malt', /chocolate/], ['Roasted barley', /roast(ed)? barley/], ['Black patent', /black\s*\(?patent\)?|black malt|\bpatent\b/],
    ['Biscuit malt', /biscuit/], ['Victory malt', /victory/], ['Aromatic malt', /aromatic/], ['Melanoidin malt', /melanoid/], ['Acidulated malt', /acid(ulated)?( malt)?\b|sauermalz/],
    ['Smoked / Rauch malt', /rauch|beech(wood)?[\s-]*smoked|smoked malt/], ['Peated malt', /\bpeat/], ['Amber malt', /amber malt|\bamber\b/], ['Brown malt', /brown malt/],
    ['Maris Otter', /maris\s*otter/], ['Golden Promise', /golden promise/], ['Pale ale malt', /pale ale malt|\bpale ale\b/],
    ['Vienna malt', /\bvienna\b/], ['Munich malt', /\bmunich\b/], ['Rye malt', /\brye\b/], ['Sorghum malt', /sorghum/], ['Millet malt', /millet/],
    ['Wheat malt', /\bwheat\b/], ['Pilsner malt', /\bpils(ner|en)?\b|lager malt/], ['2-row pale malt', /\b(2|two)[\s-]?row\b|pale malt|brewers malt|\bpale\b/], ['Dates', /\bdates\b/]
  ];
  const CRYSTAL = /(?:crystal|caramel|cara(?:malt)?|\bc)[\s/-]*(?:malt)?[\s-]*(\d{2,3})\s*l?\b|(\d{2,3})\s*l\b.*(?:crystal|caramel)/;
  /* text: what the line calls the ingredient, the amount already removed. known: the table of fermentables. Returns a table name or null. */
  R.matchFermentable = function (text, known) {
    const t = plain(text).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    const has = n => !known || known.some(k => k.name === n);
    if (!/cara[\s-]*(munich|pils|foam)|carafa/.test(t)) { const c = CRYSTAL.exec(t);
      if (c) { const l = Number(c[1] || c[2]), pick = [10, 20, 40, 60, 80, 120].reduce((best, v) => Math.abs(v - l) < Math.abs(best - l) ? v : best, 60), n = `Crystal / Caramel ${pick}L`; if (has(n)) return n; } }
    for (const [name, re] of FERM_RULES) if (re.test(t) && has(name)) return name;
    if (/crystal|caramel|caramalt/.test(t)) { const n = /light|pale/.test(t) ? 'Crystal / Caramel 20L' : /dark|extra/.test(t) ? 'Crystal / Caramel 120L' : 'Crystal / Caramel 60L'; if (has(n)) return n; }
    return null;
  };
  const HOP_ALIASES = { 'Columbus / CTZ': ['columbus', 'ctz', 'tomahawk', 'zeus'], 'East Kent Golding': ['east kent goldings?', 'kent goldings?', 'ekg', 'goldings?'], 'Hallertau Mittelfr\u00FCh': ['hallertau(er)? mittelfr(u|ue)h', 'mittelfr(u|ue)h', 'hallertau(er)?'],
    Tettnang: ['tettnang(er)?'], Spalt: ['spalt(er)?( select)?'], Fuggle: ['fuggles?'], 'Styrian Golding': ['styrian goldings?', 'celeia', 'savinjski'], 'Mt. Hood': ['mt\\.? hood', 'mount hood'], 'Brewer\'s Gold': ['brewer\'?s gold'],
    'Huell Melon': ['huell melon', 'hull melon'], 'Mandarina Bavaria': ['mandarina bavaria', 'mandarina'], 'Nelson Sauvin': ['nelson sauvin', 'nelson'], 'Sorachi Ace': ['sorachi ace', 'sorachi'], 'Idaho 7': ['idaho[\\s-]*7', 'idaho seven'],
    'Wai-iti': ['wai[\\s-]*iti'], Krush: ['krush', 'hbc[\\s-]*586'], Talus: ['talus', 'hbc[\\s-]*692'], Ekuanot: ['ekuanot', 'equinox', 'hbc[\\s-]*366'], Lemondrop: ['lemon\\s*drop'], Hersbrucker: ['hallertau(er)? hersbrucker', 'hersbrucker'],
    Magnum: ['hallertau(er)? magnum', 'magnum'], Saaz: ['saaz(er)?', 'zatec'], Sabro: ['sabro', 'hbc[\\s-]*438'], 'Vic Secret': ['vic secret', 'victoria\'?s secret'] };
  let hopIndexFor = null, hopIndex = null;
  function hopRules(hops) {
    if (hopIndexFor === hops) return hopIndex;
    const out = [];
    for (const hp of hops || []) for (const a of (HOP_ALIASES[hp.name] || hp.name.split('/').map(x => esc(plain(x.trim()))))) out.push({ name: hp.name, re: new RegExp('(^|[^a-z0-9])(' + a + ')s?(?![a-z0-9])'), len: a.length });
    out.sort((a, b) => b.len - a.len);                                 // the longest name wins: Hallertau Blanc before Hallertau
    hopIndexFor = hops; hopIndex = out; return out;
  }
  R.matchHop = function (text, hops) { const t = plain(text); for (const r of hopRules(hops)) if (r.re.test(t)) return r.name; return null; };
  /* Yeast is sold by number as often as by name: "US-05", "WLP001", "Wyeast 1056" and plain "1056" are all one row of the table. */
  const CODE = /\b[a-z]{1,4}[\s-]?\d{2,4}\b|\b\d{4}\b/g, BRANDS = /\b(lalbrew|lallemand|omega|mangrove jack|escarpment|wildbrew|wyeast|white labs|safale|saflager|fermentis)\b/g;
  const GENERIC = /^(american|english|british|german|belgian|irish|scottish|french|czech|mexican|bavarian|munich|london|california|san|francisco|ale|lager|pils|pilsner|pilsen|bock|witbier|hefeweizen|saison|kolsch|alt|dusseldorf|abbey|trappist|high|gravity|golden|dry|new|england|west|coast|us|wheat|classic|swiss|sour|i|ii|iii|iv|v)$/;
  const YEAST_CUE = /yeast|wyeast|\bwy\b|white labs|\bwlp|safale|saflager|lalbrew|lallemand|fermentis|omega|imperial|mangrove|escarpment|kveik|strain|smack|sachet|\bpkgs?\b|\bpacks?\b/;
  let yeastIndexFor = null, yeastIndex = null;
  function yeastRules(yeasts) {
    if (yeastIndexFor === yeasts) return yeastIndex;
    const out = [];
    for (const y of yeasts || []) { const full = plain(y.name).replace(/w-34\/70/, 'w-3470');
      for (const part of full.split('/').map(x => x.trim()).filter(Boolean)) {
        for (const c of part.match(CODE) || []) { const m = /^([a-z]*)[\s-]?(\d+)$/.exec(c);
          out.push({ name: y.name, numeric: !m[1], re: new RegExp('(^|[^a-z0-9.])' + (m[1] ? m[1] + '[\\s-]?' : '') + m[2] + '(?![0-9])'), len: c.length }); }
        const words = part.replace(CODE, ' ').replace(/\((dry|liquid|sacch|sahti)\)/g, ' ').replace(BRANDS, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
        // a name made only of places and styles ("American Lager", "New England") could as easily be the beer's style as its yeast
        if (words.length >= 4 && !/^(ale|lager|german ale|blends?|brett blends?)$/.test(words)) out.push({ name: y.name, words: new RegExp('(^|[^a-z])' + esc(words) + '(?![a-z])'), generic: words.split(' ').every(w => GENERIC.test(w)), len: words.length });
      } }
    const w = (yeasts || []).find(y => /34\/70/.test(y.name)); if (w) out.push({ name: w.name, numeric: false, re: /(^|[^0-9])34[\s/-]?70(?![0-9])/, len: 5 });
    out.sort((a, b) => b.len - a.len);
    yeastIndexFor = yeasts; yeastIndex = out; return out;
  }
  /* strict: the text is not known to be about yeast, so a bare four-digit number ("2007") or a name that could be a style
     ("American Lager") only counts with a yeast word beside it. */
  R.matchYeast = function (text, yeasts, strict) {
    const t = plain(text), cue = !strict || YEAST_CUE.test(t);
    for (const r of yeastRules(yeasts)) if (r.re && r.re.test(t) && (!r.numeric || cue)) return r.name;
    for (const r of yeastRules(yeasts)) if (r.words && r.words.test(t) && (!r.generic || cue)) return r.name;
    return null;
  };
  const SALT_RULES = [['Gypsum (CaSO4)', /gypsum|calcium sul(f|ph)ate|caso4/], ['Calcium chloride (CaCl2)', /calcium chloride|cacl2?\b/], ['Epsom salt (MgSO4)', /epsom|magnesium sul(f|ph)ate|mgso4/],
    ['Baking soda (NaHCO3)', /baking soda|sodium bicarb|nahco3/], ['Chalk (CaCO3)', /\bchalk\b|calcium carbonate|caco3/], ['Table salt (NaCl)', /table salt|sea salt|kosher salt|non-?iodi[sz]ed salt|\bnacl\b|^\s*salt\s*$/]];
  const MISC = /whirlfloc|irish moss|nutrient|campden|lactic|phosphoric|clarity|clarex|gelatin|biofine|servomyces|coriander|orange peel|vanilla|cocoa|cacao|nibs|coffee|oak (chips|cubes|spirals?)|cinnamon|ginger|chil[ie]|pepper(corn)?s?\b|juniper|heather|pur[\u00E9e]e|zest|\bspices?\b|\bsalt\b|protafloc|kettle finings?|energi[sz]er|antifoam|fermcap|ascorbic|metabisul/;
  const HOP_CUE = /\bhops?\b|\bpellets?\b|\bleaf\b|\bcones?\b|cryo|lupul|\baa\b|a\.a\.|alpha|\bibus?\b|\bboil\b|whirl\s*pool|hop\s*stand|hopstand|flame\s*out|knock\s*out|first\s*wort|\bfwh\b|dry[\s-]*hop|\bsteep\b|@|\b\d+(\.\d+)?\s*(min|mins|minutes?)\b/;
  const FERM_CUE = /malt|grain|barley|wheat|oats?\b|crystal|caramel|cara|extract|\bdme\b|\blme\b|sugar|honey|syrup|flaked|munich|vienna|pils|maris|2[\s-]?row|\brye\b|\bcorn\b|rice|roast|chocolate|biscuit|lactose|molasses|\bsrm\b|\bebc\b|lovibond|\bppg\b/;

  // ---------- reading one line ----------
  const SECTIONS = [['ferm', /^(fermentables?|grain bill|grains?|malts?( bill)?|grist|malts? (and|&) adjuncts|extracts?|sugars?|steeping grains?)$/], ['dry', /^(dry hops?|dry hopping)$/], ['hop', /^(hops?( schedule| additions| bill)?|boil additions|kettle hops)$/],
    ['yeast', /^(yeasts?|culture)$/], ['ferment', /^(fermentation( schedule| profile| steps)?|primary|fermenting)$/], ['mash', /^(mash( schedule| steps| profile| guidelines)?|mashing|mash steps)$/], ['water', /^(water( profile| chemistry| treatment| additions)?|salts|minerals)$/],
    ['notes', /^(notes?|instructions?|directions?|method|procedure|process|steps|brew ?day|comments?)$/], ['other', /^(other( ingredients)?|misc(ellaneous)?|miscs?|adjuncts|additions|extras|spices|finings)$/], ['stats', /^(stats|vitals|specs|specifications|recipe specifications|targets?|numbers|profile|style guidelines?)$/]];
  const NOISE = /^(ingredients?|recipe|all[\s-]*grain|partial mash|amount\s+name|amt\s+name|type\s*:|brew method|bu\s*[:/]\s*gu|(mash|sparge|strike|total|top[\s-]?up)\s+water|(boil|pre[\s-]?boil|post[\s-]?boil)\s+(size|volume|gravity)|pre[\s-]?boil|starter\s*:|form\s*:|attenuation|flocculation|optimum temp)/i;
  const stripBullet = s => s.replace(/^[\s>*\u2022\u00B7|]+/, '').replace(/^-+\s+/, '').replace(/^\d{1,2}[.)]\s+(?=\S)/, '').trim();
  function hopTiming(lower) {
    const out = {};
    if (/dry[\s-]*hop|\bdh\b|\bdry\b/.test(lower)) { out.dry = true; const d = /(\d+(?:\.\d+)?)\s*days?\b/.exec(lower), on = /\bday\s*(\d+)\b/.exec(lower); if (d) out.days = Math.round(Number(d[1])); if (on) out.day = Number(on[1]); return out; }
    if (/whirl\s*pool|hop\s*stand|hopstand|\bsteep\b|\bwp\b/.test(lower)) { out.whirlpool = true; const m = /(\d+)\s*(?:mins|minutes?|min|m)(?![a-z])/.exec(lower); if (m) out.wpMin = Number(m[1]);
      const t = temps(lower).find(x => x.f >= 120 && x.f <= 212); if (t) out.wpTempF = t.f; return out; }
    if (/first\s*wort|\bfwh\b/.test(lower)) { out.firstWort = true; return out; }
    if (/mash hop/.test(lower)) { out.mash = true; return out; }
    if (/flame\s*out|knock\s*out|\bfo\b|end of (the )?boil/.test(lower)) { out.minutes = 0; return out; }
    const m = /(\d+(?:\.\d+)?)\s*(?:mins|minutes?|min|m|')(?![a-z0-9])/.exec(lower) || /@\s*(\d+(?:\.\d+)?)\b/.exec(lower) || /\bboil\s*(?:for)?\s*[:-]?\s*(\d+(?:\.\d+)?)\b/.exec(lower) || /(?:bittering|aroma|flavou?r)\s+(\d{1,3})\s*$/.exec(lower);
    if (m && Number(m[1]) <= 240) out.minutes = Math.round(Number(m[1]));
    return out;
  }
  function hopAlpha(lower) {
    const m = /(\d+(?:\.\d+)?)\s*%\s*(?:aa|a\.a\.?|alpha)/.exec(lower) || /\b(?:aa|a\.a\.?|alpha(?: acids?)?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?/.exec(lower) || /[[(]\s*(\d+(?:\.\d+)?)\s*%\s*[\])]/.exec(lower) || /(\d+(?:\.\d+)?)\s*%/.exec(lower);
    const v = m ? Number(m[1]) : 0; return v > 0 && v <= 25 ? v : (v > 25 && v <= 70 && /extract|resin|hopshot/.test(lower) ? v : '');
  }
  const hopForm = lower => /cryo|lupuln2|lupomax|lupulin/.test(lower) ? 'cryo' : /\b(whole|leaf|cones?)\b/.test(lower) ? 'leaf' : /co2 extract|hop extract|hopshot|\bresin\b/.test(lower) ? 'extract' : /\b(wet|fresh)\b/.test(lower) ? 'wet' : 'pellet';
  // what the line calls the thing, with the numbers and the brewing-program columns taken off
  function nameOf(line, amt) {
    return (line.slice(0, amt.at) + ' ' + line.slice(amt.at + amt.len))
      .replace(/\[[^\]]*\]/g, ' ').replace(/\((?:[^)a-z]*(?:srm|ebc|ibus?|ppg|\u00B0?l|lovibond|%|kg|g|lbs?|oz|aa|alpha)[^)]*)\)/gi, ' ')
      .replace(/,?\s*\b(?:type|use|form|ibus?|aa|alpha|origin)\s*:[^,]*/gi, ' ')
      .replace(/\d+(?:\.\d+)?\s*%(\s*(aa|a\.a\.?|alpha( acids?)?))?/gi, ' ').replace(/\b(?:aa|alpha(?: acids?)?)\s*[:=]?\s*\d+(?:\.\d+)?/gi, ' ').replace(/\d+(?:\.\d+)?\s*(?:ibus?|srm|ebc|ppg|\u00B0\s*l\b)/gi, ' ')
      .replace(/@.*$/, ' ').replace(/\s-\s*(grain|adjunct|sugar|extract|liquid extract|dry extract|hop|hops|boil|whirl\s*pool|dry[\s-]*hop|hop\s*stand|aroma|bittering|flame\s*out|first wort|fwh|mash|steep)\b.*$/i, ' ')
      .replace(/\b(boil(ed)?|whirl\s*pool|hop\s*stand|hopstand|flame\s*out|knock\s*out|first\s*wort|fwh|dry[\s-]*hop(ped|ping|s)?|steep|for|at|additions?|bittering)\b.*$/i, ' ')
      .replace(/\b\d+(?:\.\d+)?\s*(?:mins|minutes?|min|days?)\b.*$/i, ' ').replace(/\b(grain|hop|hops|yeast|adjunct|sugar|extract|misc)\s+\d+[\s-]*$/i, ' ')
      .replace(/\b(hops?|pellets?|whole leaf|leaf|t-?90)\b/gi, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-:,|.]+|[\s\-:,|.(]+$/g, '').trim();
  }
  const titleCase = s => s.replace(/(^|[\s(/-])([a-z])/g, (m, pre, c) => pre + c.toUpperCase());

  /* text: the recipe. refs: { fermentables, hops, yeast } from data.js.
     Returns { name, style, batchGal, boilMin, efficiency, mashF, mashMin, fermF, og, fg, ibu, abv, srm, fermentables, hops, dryHops, yeast, yeastKnown,
               salts, wpTempF, wpMin, other, unread, metric, count }. Amounts come back in the app's units whatever the recipe used. */
  R.parse = function (text, refs) {
    const ref = refs || {}, out = { name: '', style: '', fermentables: [], hops: [], dryHops: [], yeast: '', yeastKnown: false, salts: [], other: [], unread: [], metric: false };
    let section = '';
    const setFerm = f => { if (f >= 40 && f <= 105 && !out.fermF) out.fermF = f; };
    function readYeast(s) {
      const y = R.matchYeast(s, ref.yeast);
      if (y) { if (!out.yeastKnown) { out.yeast = y; out.yeastKnown = true; } }
      else if (!out.yeast && !/[:=]/.test(s.replace(/^\s*yeast\s*[:=]/i, ''))) { const t = s.replace(new RegExp('^\\s*' + NUM + '\\s*(pkgs?|packs?|packets?|sachets?|vials?|smack packs?|pouch(es)?|g|grams?|ml)\\b', 'i'), '').replace(/\[[^\]]*\]/g, ' ').replace(/\byeast\b\s*[:=-]?/i, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-:,]+|[\s\-:,]+$/g, ''); if (t.length >= 3) out.yeast = t.slice(0, 80); }
      const f = /ferment(?:ed|ation|ing)?[^0-9]{0,24}(\d{2,3}(?:\.\d+)?)\s*(?:\u00B0|deg(?:rees?)?)?\s*([fc])(?![a-z])/i.exec(s); if (f) setFerm(toF(Number(f[1]), f[2]));
    }
    function readPlain(line, lower, idx) {
      let hit = false, m;
      if ((m = /^(?:recipe\s*)?(?:name|title|beer|recipe)\s*[:=]\s*(.+)$/i.exec(line))) { out.name = m[1].trim().slice(0, 80); return; }
      if ((m = /^(?:beer\s*)?style(?:\s*name)?\s*[:=]\s*(.+)$/i.exec(line))) { out.style = m[1].replace(/\(\s*\d+\s*[a-z]\s*\)/gi, '').trim().slice(0, 60); return; }
      if (/^yeast\b/.test(lower) || section === 'yeast') { readYeast(line); return; }
      if (NOISE.test(line)) return;
      // batch size: said outright, or in the title ("23 litre batch", "(5 gal)")
      m = /(?:batch(?:\s*(?:size|volume))?|final volume|fermenter volume|into (?:the )?fermenter|makes|yield|recipe volume|\bvolume|\bsize)\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*(us gal(?:lons?)?|gal(?:lons?)?|lit(?:er|re)s?|l)(?![a-z])/i.exec(line);
      if (m && /boil|kettle|mash|sparge|strike/.test(lower.slice(0, m.index + 4))) m = null;
      let sizeText = m ? m[0] : '';
      if (!m && !out.batchGal && idx < 3) { m = /\(?\s*(\d+(?:\.\d+)?)[\s-]*(gal(?:lons?)?|lit(?:er|re)s?|l)(?![a-z])\s*(?:batch|recipe|brew)?\s*\)?/i.exec(line); if (m) sizeText = m[0]; }
      if (m) { const n = Number(m[1]), litres = /^l/i.test(m[2]); if (n > 0 && n < 2000) { out.batchGal = litres ? r2(n / L_GAL) : n; if (litres) out.metric = true; hit = true; } }
      if ((m = /\bboil(?:\s*(?:time|length|duration))?\s*[:=]?\s*(\d+)\s*(?:mins|minutes?|min|m)\b/i.exec(line)) || (m = /(\d+)[\s-]*(?:min|minute)\s*boil/i.exec(line))) { const n = Number(m[1]); if (n >= 10 && n <= 240) { out.boilMin = n; hit = true; } }
      if ((m = /eff(?:iciency)?\.?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i.exec(line)) || (m = /(\d+(?:\.\d+)?)\s*%\s*(?:brewhouse |mash )?eff/i.exec(line))) { const n = Number(m[1]); if (n >= 30 && n <= 100) { out.efficiency = n; hit = true; } }
      if ((m = /(?:\bo\.?g\.?|original gravity|starting gravity|est(?:imated)? og)(?![a-z])[^0-9]{0,14}(1\.\d{2,3})/i.exec(line))) { out.og = Number(m[1]); hit = true; }
      if ((m = /(?:\bf\.?g\.?|final gravity|terminal gravity|est(?:imated)? fg)(?![a-z])[^0-9]{0,14}(1\.\d{2,3}|0\.99\d)/i.exec(line))) { out.fg = Number(m[1]); hit = true; }
      if ((m = /\bibus?\b[^0-9]{0,20}(\d+(?:\.\d+)?)/i.exec(line)) || (m = /(\d+(?:\.\d+)?)\s*ibus?\b/i.exec(line))) { out.ibu = Number(m[1]); hit = true; }
      if ((m = /\babv\b[^0-9]{0,20}(\d+(?:\.\d+)?)/i.exec(line)) || (m = /(\d+(?:\.\d+)?)\s*%\s*abv/i.exec(line))) { out.abv = Number(m[1]); hit = true; }
      if ((m = /\bsrm\b[^0-9]{0,20}(\d+(?:\.\d+)?)/i.exec(line)) || (m = /(\d+(?:\.\d+)?)\s*srm\b/i.exec(line))) { out.srm = Number(m[1]); hit = true; }
      else if ((m = /\bebc\b[^0-9]{0,20}(\d+(?:\.\d+)?)/i.exec(line)) || (m = /(\d+(?:\.\d+)?)\s*ebc\b/i.exec(line))) { out.srm = r1(Number(m[1]) / 1.97); hit = true; }
      // temperatures, a clause at a time: "mash at 66C for 60 minutes, ferment at 19C" holds two different ones
      for (const clause of line.split(/[,;]|\bthen\b|\band\b/i)) {
        const cl = plain(clause), ts = temps(clause); if (!ts.length) continue;
        if (/ferment|pitch|primary/.test(cl) || section === 'ferment') { const t = ts.find(x => x.f >= 40 && x.f <= 105); if (t) { setFerm(t.f); if (t.metric) out.metric = true; hit = true; } }
        else if ((section === 'mash' || /\bmash|sacch|\brest\b|infusion|conversion/.test(cl)) && !/mash[\s-]*out|sparge/.test(cl)) { const t = ts.find(x => x.f >= 140 && x.f <= 162);
          if (t) { if (!out.mashF) { out.mashF = t.f; const mm = /(\d+)\s*(?:mins|minutes?|min)\b/i.exec(clause) || /(\d+)\s*(?:mins|minutes?|min)\b/i.exec(line); if (mm) out.mashMin = Number(mm[1]); if (t.metric) out.metric = true; } hit = true; } }
      }
      if (!out.name && idx < 2 && !section && hit && sizeText) { const t = line.replace(sizeText, ' ').replace(/[\s\-:,(]+$/, '').replace(/\s{2,}/g, ' ').trim(); if (/[a-z]{3}/i.test(t) && !/[:=]|\d\.\d{3}/.test(t) && t.length <= 70) out.name = t; }
      if (hit) return;
      if (MISC.test(lower)) { out.other.push(line); return; }
      if (!out.yeastKnown && line.length < 140) { const y = R.matchYeast(line, ref.yeast, true); if (y) { out.yeast = y; out.yeastKnown = true; return; } }
      if (!/[a-z]{3}/i.test(line)) return;                                // "6.8% / 16.5 \u00B0P": numbers with nothing to say what they are
      if (!out.name && idx < 3 && !section && line.length >= 3 && line.length <= 70 && !/[:=]/.test(line)) { out.name = line.replace(/\s*\([^)]*\)\s*$/, '').trim() || line; return; }
      if (out.name && !out.style && idx < 3 && !section && line.length <= 40 && !/[:=\d]/.test(line)) { out.style = line; return; }   // the short line under the title is the style
      (section === 'notes' || section === 'mash' || section === 'water' || section === 'ferment' ? out.other : out.unread).push(line);
    }
    R.clean(text).split('\n').map(stripBullet).filter(l => /[a-z0-9]/i.test(l)).forEach((raw, idx) => {
      let line = raw;
      // a heading on its own ("Hops", "Malts (6.35 kg)", "FERMENTABLES:"), or with its content after a colon ("Yeast: US-05")
      const colon = line.indexOf(':'), headText = plain(colon > 0 ? line.slice(0, colon) : line).replace(/\([^)]*\)/g, ' ').replace(/[\-=_#*]+\s*$/, '').replace(/\s+/g, ' ').trim();
      const sec = SECTIONS.find(([, re]) => re.test(headText));
      if (sec) { const rest = colon > 0 ? line.slice(colon + 1).trim() : ''; section = sec[0]; if (!rest) return; if (section === 'yeast') return readYeast(rest); if (section === 'notes') { out.other.push(rest); return; } line = rest; }
      const lower = plain(line), a = R.amount(line);
      if (!a) return readPlain(line, lower, idx);
      if (a.unit === 'kg' || a.unit === 'g') out.metric = true;
      const rawName = nameOf(line, a), nameLower = plain(rawName);
      for (const [salt, re] of SALT_RULES) if (re.test(nameLower) && !/malt/.test(nameLower)) { out.salts.push({ salt, grams: r1(a.lb * 16 * G_OZ) }); return; }
      const fermName = R.matchFermentable(rawName, ref.fermentables), hopName = R.matchHop(rawName, ref.hops);
      if (MISC.test(nameLower) && !fermName && !hopName) { out.other.push(line); return; }
      if (!fermName && !hopName && (section === 'yeast' || /\b(yeast|wyeast|white labs|safale|saflager|lalbrew|kveik)\b/.test(lower) || R.matchYeast(rawName, ref.yeast, true))) return readYeast(line);
      const cueHop = HOP_CUE.test(lower), cueFerm = FERM_CUE.test(nameLower), timed = /\b(mins?|minutes?|boil|whirl\s*pool|dry[\s-]*hop|flame\s*out|fwh|first\s*wort)\b|@/.test(lower);
      let kind;
      if (section === 'ferm') kind = hopName && timed && !fermName ? 'hop' : 'ferm';
      else if (section === 'hop' || section === 'dry') kind = fermName && cueFerm && !hopName && !timed ? 'ferm' : 'hop';
      else if (hopName && fermName) kind = timed ? 'hop' : (CRYSTAL.test(nameLower) || /malt|caramel/.test(nameLower) || ((a.unit === 'lb' || a.unit === 'kg') && a.oz >= 4)) ? 'ferm' : 'hop';   // "Crystal" is a hop and a malt
      else if (hopName) kind = 'hop'; else if (fermName) kind = 'ferm';
      else kind = cueHop && !cueFerm ? 'hop' : cueFerm ? 'ferm' : (a.unit === 'oz' || a.unit === 'g') && a.oz <= 12 ? 'hop' : 'ferm';
      if (kind === 'ferm') { out.fermentables.push({ name: fermName || titleCase(rawName) || 'Unnamed', lb: a.lb >= 1 ? r2(a.lb) : Math.round(a.lb * 1000) / 1000, raw: line, known: !!fermName }); return; }
      const t = hopTiming(lower), hop = { name: hopName || titleCase(rawName.replace(/\b(bittering|aroma|flavou?r)\b/gi, '').trim()) || 'Unnamed hop', oz: r2(a.oz), alpha: hopAlpha(lower), type: hopForm(lower), raw: line, known: !!hopName };
      if (t.mash) { out.other.push(line); return; }
      if (t.dry || (section === 'dry' && t.minutes === undefined && !t.whirlpool)) { out.dryHops.push(Object.assign(hop, { type: hop.type === 'extract' ? 'pellet' : hop.type, day: t.day === undefined ? '' : t.day, days: t.days || 4 })); return; }
      if (t.whirlpool) { if (t.wpMin) out.wpMin = t.wpMin; if (t.wpTempF) out.wpTempF = t.wpTempF; out.hops.push(Object.assign(hop, { minutes: 0, whirlpool: true })); return; }
      out.hops.push(Object.assign(hop, { minutes: t.firstWort ? 'fw' : t.minutes === undefined ? '' : t.minutes, whirlpool: false }));
    });
    const boil = out.boilMin || 60;
    for (const hp of out.hops) if (hp.minutes === 'fw') hp.minutes = boil;
    if (!out.boilMin) { const longest = Math.max(0, ...out.hops.map(hp => Number(hp.minutes) || 0)); if (longest > 60) out.boilMin = longest; }
    out.count = out.fermentables.length + out.hops.length + out.dryHops.length + (out.yeast ? 1 : 0);
    return out;
  };

  /* A parsed recipe as one of the app's batches. blank: the app's empty batch (it carries the brewer's own defaults).
     hops: the hop table, so an addition with no alpha on the page gets the variety's usual figure. */
  R.toBatch = function (p, blank, hops) {
    const b = Object.assign({}, blank || {}), alphaOf = n => { const ref = (hops || []).find(x => x.name === n); return ref ? r1((ref.alphaLow + ref.alphaHigh) / 2) : ''; };
    b.name = p.name || p.style || 'Imported recipe'; b.style = p.style || '';
    if (p.batchGal) { const gap = Math.max(0.5, (Number(b.boilGal) || 0) - (Number(b.batchGal) || 0)); b.batchGal = p.batchGal; b.boilGal = r2(p.batchGal + gap); }
    if (p.boilMin) b.boilMin = p.boilMin; if (p.efficiency) b.efficiency = p.efficiency; if (p.mashF) b.mashF = p.mashF; if (p.mashMin) b.mashMin = p.mashMin; if (p.fermF) b.fermF = p.fermF;
    if (p.wpTempF) b.wpTempF = p.wpTempF; if (p.wpMin) b.wpMin = p.wpMin;
    b.fermentables = p.fermentables.map(f => ({ name: f.name, lb: f.lb }));
    b.hops = p.hops.map(hp => ({ name: hp.name, oz: hp.oz, alpha: hp.alpha === '' ? alphaOf(hp.name) : hp.alpha, minutes: hp.minutes, type: hp.type || 'pellet', whirlpool: !!hp.whirlpool }));
    b.dryHops = p.dryHops.map(d => ({ name: d.name, oz: d.oz, alpha: d.alpha === '' ? alphaOf(d.name) : d.alpha, type: d.type || 'pellet', day: d.day === undefined ? '' : d.day, days: d.days || 4 }));
    b.yeast = p.yeast || ''; b.salts = (p.salts || []).map(s => ({ salt: s.salt, grams: s.grams })); b.extras = [];
    const said = [p.og ? `OG ${p.og.toFixed(3)}` : '', p.fg ? `FG ${p.fg.toFixed(3)}` : '', p.ibu ? `${p.ibu} IBU` : '', p.abv ? `${p.abv}%` : ''].filter(Boolean).join(', ');
    b.notes = [said ? `As written: ${said}.` : '', (p.other || []).join(' \u00B7 ')].filter(Boolean).join(' ').slice(0, 1200);
    b.status = 'Planned'; delete b.id;
    return b;
  };

  // ---------- a recipe in a link ----------
  /* Short arrays instead of named fields keep the link a sensible length: a typical recipe is 400 to 700 characters.
     Nothing from the brewer's log goes in: only the recipe. */
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; }, str = (v, max) => String(v === undefined || v === null ? '' : v).slice(0, max || 80);
  const toB64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const fromB64 = s => { let t = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const bin = atob(t), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };
  R.encodeShare = function (b) {
    const dry = Array.isArray(b.dryHops) ? b.dryHops : [];
    const data = [1, str(b.name), str(b.style, 60), num(b.batchGal), num(b.boilGal), num(b.boilMin), num(b.efficiency), num(b.mashF), num(b.mashMin), str(b.yeast), num(b.fermF),
      (b.fermentables || []).filter(f => f.name && !f.late).map(f => [str(f.name, 60), num(f.lb)]),
      (b.hops || []).filter(hp => hp.name).map(hp => [str(hp.name, 60), num(hp.oz), num(hp.alpha), hp.minutes === '' || hp.minutes === undefined ? -1 : num(hp.minutes), str(hp.type || 'pellet', 10), hp.whirlpool ? 1 : 0]),
      dry.filter(d => d.name && !d.extra).map(d => [str(d.name, 60), num(d.oz), num(d.alpha), str(d.type || 'pellet', 10), d.day === '' || d.day === undefined ? -1 : num(d.day), num(d.days) || 4]),
      (b.salts || []).filter(s => s.salt && num(s.grams)).map(s => [str(s.salt, 40), num(s.grams)]), num(b.wpTempF), num(b.wpMin), b.ibuModel === 'tinseth' ? 't' : 's', str(b.notes, 400)];
    return toB64(JSON.stringify(data));
  };
  /* Everything in a link is somebody else's typing: every field is forced to the type and length the app expects, and anything
     that does not look like a recipe comes back as null. */
  R.decodeShare = function (code) {
    let d; try { d = JSON.parse(fromB64(String(code || '').trim())); } catch (e) { return null; }
    if (!Array.isArray(d) || d[0] !== 1 || !Array.isArray(d[11]) || !Array.isArray(d[12])) return null;
    const pos = (v, max) => { const n = num(v); return n > 0 && n <= max ? n : ''; }, rows = (v, max) => (Array.isArray(v) ? v : []).filter(Array.isArray).slice(0, max);
    const forms = ['pellet', 'leaf', 'cryo', 'extract', 'wet'], form = v => forms.includes(v) ? v : 'pellet';
    const b = { name: str(d[1]).trim() || 'Shared recipe', style: str(d[2], 60), batchGal: pos(d[3], 2000) || 5.5, boilGal: pos(d[4], 2500) || '', boilMin: pos(d[5], 600) || 60, efficiency: pos(d[6], 100) || 72, mashF: pos(d[7], 212) || 152, yeast: str(d[9]), fermF: pos(d[10], 120),
      fermentables: rows(d[11], 30).map(f => ({ name: str(f[0], 60), lb: pos(f[1], 5000) })).filter(f => f.name),
      hops: rows(d[12], 40).map(hp => ({ name: str(hp[0], 60), oz: pos(hp[1], 2000), alpha: pos(hp[2], 100), minutes: num(hp[3]) < 0 ? '' : Math.min(600, num(hp[3])), type: form(hp[4]), whirlpool: !!hp[5] })).filter(hp => hp.name),
      dryHops: rows(d[13], 20).map(x => ({ name: str(x[0], 60), oz: pos(x[1], 2000), alpha: pos(x[2], 100), type: form(x[3]) === 'extract' ? 'pellet' : form(x[3]), day: num(x[4]) < 0 ? '' : Math.min(400, num(x[4])), days: pos(x[5], 60) || 4 })).filter(x => x.name),
      salts: rows(d[14], 8).map(s => ({ salt: str(s[0], 40), grams: pos(s[1], 500) })).filter(s => s.salt && s.grams), wpTempF: pos(d[15], 212) || 175, wpMin: pos(d[16], 180) || 20, ibuModel: d[17] === 't' ? 'tinseth' : 'smph', notes: str(d[18], 400), extras: [], status: 'Planned' };
    if (pos(d[8], 3000)) b.mashMin = pos(d[8], 3000);
    if (!b.boilGal) b.boilGal = r2(b.batchGal + 1.5);
    if (!b.fermentables.length && !b.hops.length) return null;
    return b;
  };
  // the recipe in words, for the message that carries the link
  R.asText = function (b, stats) {
    const lines = [`${b.name || 'Recipe'}${b.style && b.style !== b.name ? ' (' + b.style + ')' : ''}`];
    lines.push([`${b.batchGal} gal`, stats && stats.og ? `OG ${stats.og}` : '', stats && stats.ibu ? `${stats.ibu} IBU` : '', stats && stats.abv ? `${stats.abv}%` : ''].filter(Boolean).join(', '));
    for (const f of (b.fermentables || []).filter(x => x.name && !x.late)) lines.push(`${f.lb} lb ${f.name}`);
    for (const hp of (b.hops || []).filter(x => x.name)) lines.push(`${hp.oz} oz ${hp.name}${hp.alpha ? ' (' + hp.alpha + '%)' : ''}, ${hp.whirlpool ? 'whirlpool' : hp.minutes === '' || hp.minutes === undefined ? 'boil' : hp.minutes + ' min'}`);
    for (const d of (Array.isArray(b.dryHops) ? b.dryHops : []).filter(x => x.name && !x.extra)) lines.push(`${d.oz} oz ${d.name}, dry hop ${d.days || 4} days`);
    if (b.yeast) lines.push(`Yeast: ${b.yeast.split('/')[0].trim()}`);
    if (b.mashF) lines.push(`Mash ${b.mashF}F, boil ${b.boilMin || 60} min`);
    return lines.join('\n');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.RecipeText = R;
})(typeof window !== 'undefined' ? window : globalThis);
