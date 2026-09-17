const { JSDOM } = require('jsdom'); const fs = require('fs'); const fidb = require('fake-indexeddb');
const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window; w.indexedDB = fidb.indexedDB; w.IDBKeyRange = fidb.IDBKeyRange; w.scrollTo = () => {}; w.confirm = () => true;
w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
const errors = []; w.addEventListener('error', e => errors.push(e.message));
for (const f of ['recipes.js', 'beerxml.js', 'data.js', 'shop.js', 'core.js', 'app.js']) w.eval(fs.readFileSync(f, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
const text = () => $('#view').textContent;
const tab = i => { $$('#tabs button')[i].click(); return sleep(90); };
const clickText = t => { const b = $$('#view button, #view a').find(x => x.textContent.trim() === t); if (!b) throw new Error('no button ' + t); b.click(); return sleep(140); };
const setInput = (label, val) => { const f = $$('#view label.field').find(l => l.querySelector('span') && l.querySelector('span').textContent.trim() === label); if (!f) throw new Error('no field ' + label); const i = f.querySelector('input,select,textarea'); i.value = val; i.dispatchEvent(new w.Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return i; };
(async () => {
  await sleep(150);
  console.assert(text().includes('No batches yet'), 'empty batches');
  await clickText('New batch');
  setInput('Name', 'Test IPA');
  const st = setInput('Style', 'American IPA'); st.dispatchEvent(new w.Event('change'));
  setInput('Batch size (gal)', '5.5'); setInput('Pre-boil volume (gal)', '7');
  // fermentables
  const ferm = $$('#view label.field').find(l => l.querySelector('span').textContent === 'Fermentable').querySelector('input');
  ferm.value = '2-row pale malt'; ferm.dispatchEvent(new w.Event('input', { bubbles: true }));
  const lb = $$('#view label.field').find(l => l.querySelector('span').textContent === 'lb').querySelector('input');
  lb.value = '11'; lb.dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(50);
  const readout = $('#view .readout').textContent;
  console.assert(/1\.0[45]\d/.test(readout), 'OG estimated: ' + readout.slice(0, 120));
  console.assert(readout.includes('style 1.056'), 'style range shown: ' + readout.slice(0, 200));
  // hop with auto alpha
  const hop = $$('#view label.field').find(l => l.querySelector('span').textContent === 'Hop').querySelector('input');
  hop.value = 'Citra'; hop.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(30);
  const alpha = $$('#view label.field').find(l => l.querySelector('span').textContent === 'Alpha %').querySelector('input');
  console.assert(alpha.value === '12.0', 'alpha auto-filled from the hop table: ' + alpha.value);
  const oz = $$('#view label.field').find(l => l.querySelector('span').textContent === 'oz').querySelector('input');
  oz.value = '2'; oz.dispatchEvent(new w.Event('input', { bubbles: true }));
  const mins = $$('#view label.field').find(l => l.querySelector('span').textContent === 'Minutes').querySelector('input');
  mins.value = '60'; mins.dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(50);
  const ibuLine = $('#view .readout').textContent;
  console.assert(/IBU \(Tinseth\)/.test(ibuLine), 'IBU line present');
  setInput('Yeast', 'US-05 / WLP001 / Wyeast 1056'); await sleep(30);
  await clickText('Create batch');
  console.assert(text().includes('Test IPA') && text().includes('OG'), 'batch view: ' + text().slice(0, 120));
  // gravity entries
  await clickText('Log gravity'); setInput('Specific gravity', '1.055'); setInput('Sample temp (F)', '70'); await sleep(30);
  console.assert(text().includes('Corrected for temperature'), 'hydrometer correction shown');
  await clickText('Save');
  await clickText('Log gravity'); setInput('Specific gravity', '1.012'); await clickText('Save');
  console.assert(text().includes('Gravity'), 'gravity chart or log present');
  console.assert($('#view svg') !== null, 'gravity chart drawn');
  // refractometer reading with the Terrill correction
  await clickText('Log gravity');
  const instr = setInput('Instrument', 'brix'); instr.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(30);
  setInput('Original Brix (at pitch)', '14'); setInput('Current Brix', '7'); await sleep(30);
  console.assert(text().includes('Terrill-corrected gravity'), 'brix entry corrected: ' + text().slice(0, 300));
  await clickText('Save');
  console.assert(text().includes('(from 7 Brix)'), 'brix reading logged with its source');
  // packaging moves the status on and calculates priming
  await clickText('Log packaging'); await sleep(50);
  console.assert(text().includes('Corn sugar'), 'priming calc shown');
  await clickText('Save');
  console.assert(text().includes('Packaging') && text().includes('Packaged'), 'packaged: ' + text().slice(0, 200));
  await clickText('Log tasting'); setInput('Aroma', 'grapefruit and pine'); setInput('Score out of 5', '4'); await clickText('Save');
  console.assert(text().includes('aroma: grapefruit and pine') && text().includes('(4/5)'), 'tasting logged');
  // export produces BeerXML
  let exported = null; w.URL.createObjectURL = f => { if (f && f.name && f.name.endsWith('.xml')) exported = f; return 'blob:x'; };
  await clickText('Export BeerXML'); await sleep(50);
  console.assert(exported && exported.name === 'Test_IPA.xml', 'BeerXML export file: ' + (exported && exported.name));
  const xmlText = await exported.text(); console.assert(xmlText.includes('<NAME>Test IPA</NAME>') && xmlText.includes('<HOP>'), 'export contents');
  // equipment profile changes the brew day numbers
  $('#gearBtn').click(); await sleep(80);
  console.assert(text().includes('Equipment profile'), 'equipment settings present');
  setInput('Mash ratio (qt per lb)', '1.5'); setInput('System name', 'BrewZilla 65'); await clickText('Save equipment');
  // brew day
  await tab(1);
  console.assert(text().includes('Strike temp') && text().includes('Strike water'), 'brew day numbers: ' + text().slice(0, 200));
  console.assert(text().includes('1.5 qt per lb') && text().includes('BrewZilla 65'), 'equipment profile applied: ' + text().slice(0, 300));
  console.assert(text().includes('Expected in fermenter'), 'fermenter volume estimate shown');
  console.assert(text().includes('First addition at +0 min'), 'hop countdown before start: ' + text().slice(0, 400));
  console.assert(text().includes('2 oz Citra'), 'hop step from the recipe');
  await clickText('Start boil timer'); await sleep(30);
  console.assert(/\d\d:\d\d/.test($('#view .timer').textContent), 'timer running');
  await sleep(1100); console.assert(/All hops in; flameout in|Next:/.test(text()), 'countdown text after start: ' + text().slice(0, 400));
  const doneBtn = $$('#view .step button')[0]; doneBtn.click(); await sleep(140);
  console.assert($$('#view .step.done').length === 1, 'step marked done');
  // guided brew day: walks the plan, starts a timer, logs steps
  await tab(1); const testChip = $$('#view .chip').find(c => c.textContent.trim() === 'Test IPA'); if (testChip) { testChip.click(); await sleep(120); }
  await clickText('Go: guided brew day, start to finish'); await sleep(60);
  console.assert(text().includes('Step 1 of') && text().includes('Heat strike water') && text().includes('gal at 1.5 qt per lb'), 'go step 1: ' + text().slice(0, 200));
  await clickText('Water is at temperature'); await sleep(60);
  console.assert(text().includes('Mash in') && text().includes('60-minute timer'), 'go step 2: ' + text().slice(0, 200));
  await clickText('Start 60-minute timer'); await sleep(1200);
  console.assert(/59:5\d/.test($('#view .timer').textContent), 'mash countdown running: ' + $('#view .timer').textContent);
  console.assert(text().includes('Next: Halfway'), 'next alarm shown');
  await clickText('Mash finished'); await sleep(60);
  console.assert(text().includes('Mash out'), 'step 3');
  await clickText('Skip'); await sleep(60); console.assert(text().includes('Sparge and collect'), 'step 4 after skip');
  await clickText('Collected 7 gal'); await sleep(60); console.assert(text().includes('Pre-boil gravity'), 'step 5 input');
  const gIn = $$('#view input[type=number]'); gIn[0].value = '1.045'; gIn[0].dispatchEvent(new w.Event('input')); await sleep(20);
  console.assert(text().includes('Corrected: 1.045'), 'pre-boil correction text');
  await clickText('Continue'); await sleep(60);
  console.assert(text().includes('Boil 60 minutes') && text().includes('Citra') && text().includes('Flameout'), 'boil step with hop alarms: ' + text().slice(0, 300));
  // leave the guided day here; check the batch log took the steps
  await tab(0); $$('#view .rec button').find(b => b.closest('.rec').textContent.includes('Test IPA')).click(); await sleep(120);
  console.assert(text().includes('Water is at temperature') && text().includes('Mash in started'), 'steps logged into the batch: ' + text().slice(0, 300));
  // calculators
  await tab(2); const n = $$('#view .list button').length;
  for (let i = 0; i < n; i++) { await tab(2); $$('#view .list button')[i].click(); await sleep(60);
    const lines = $$('#view .readout .line'); console.assert(lines.length > 0, 'calc ' + i + ' readout');
    const bad = $$('#view .readout').map(r => r.textContent).join(' ');
    console.assert(!/NaN|undefined|Infinity/.test(bad), 'calc ' + i + ' produced ' + bad.slice(0, 80)); }
  console.log('calculators ok:', n);
  // reference
  await tab(3); const refs = $$('#view .list button').length;
  for (let i = 0; i < refs; i++) { await tab(3); $$('#view .list button')[i].click(); await sleep(70);
    console.assert($$('#view table, #view details, #view ul, #view .rec').length > 0, 'ref ' + i); }
  console.log('reference ok:', refs);
  // recipes: browse, open, brew this
  await tab(3); $$('#view .list button').find(b => b.textContent.includes('Styles and recipes')).click(); await sleep(120);
  console.assert($$('#view .rec').length >= 70 && !text().includes('Sumerian'), 'modern styles listed, historic excluded: ' + $$('#view .rec').length);
  const rsel = $$('#view select')[0]; rsel.value = 'Belgian'; rsel.dispatchEvent(new w.Event('change')); await sleep(60);
  console.assert($$('#view .rec').length === 12 && $$('#view h3').length === 1, 'region filter: ' + $$('#view .rec').length);
  $$('#view .rec button').find(b => b.closest('.rec').textContent.includes('Belgian tripel')).click(); await sleep(100);
  console.assert(text().includes('Belgian tripel') && text().includes('Fermentables') && text().includes('Table sugar') && text().includes('Mash 149F'), 'recipe card: ' + text().slice(0, 300));
  await clickText('Brew this');
  console.assert(text().includes('Belgian tripel') && text().includes('OG') && /1\.0(7|8)\d/.test(text()), 'batch created from recipe: ' + text().slice(0, 200));
  // hops grouped by genre, and the genre filter
  await tab(3); $$('#view .list button').find(b => b.textContent.includes('Hops')).click(); await sleep(90);
  console.assert($$('#view h3').length >= 8, 'hops grouped by genre: ' + $$('#view h3').length);
  const gsel = $$('#view select')[0]; gsel.value = 'Noble'; gsel.dispatchEvent(new w.Event('change')); await sleep(60);
  console.assert($$('#view h3').length === 1 && $$('#view tbody tr').length === 9, 'noble filter: ' + $$('#view tbody tr').length);
  // kveik under the yeast filter
  await tab(3); $$('#view .list button').find(b => b.querySelector('b') && b.querySelector('b').textContent === 'Yeast').click(); await sleep(120);
  const ysel = $$('#view select')[0]; ysel.value = 'Kveik'; ysel.dispatchEvent(new w.Event('change')); await sleep(60);
  console.assert($$('#view details').length === 5 && text().includes('Handling kveik'), 'five kveik with notes: ' + $$('#view details').length);
  // world beers with filters
  await tab(3); $$('#view .list button').find(b => b.textContent.includes('Beers of the world')).click(); await sleep(90);
  const all = $$('#view details').length;
  console.assert(all >= 30, 'world beers listed: ' + all);
  console.assert(text().includes('Brew it:') && text().includes('Full recipe and Brew this'), 'world entries carry their reconstruction');
  const eraSel = $$('#view select')[0]; eraSel.value = 'Ancient'; eraSel.dispatchEvent(new w.Event('change')); await sleep(60);
  console.assert($$('#view details').length < all && $$('#view details').length >= 3, 'era filter: ' + $$('#view details').length);
  eraSel.value = 'All eras'; eraSel.dispatchEvent(new w.Event('change'));
  const strengthSel = $$('#view select')[2]; strengthSel.value = 'high'; strengthSel.dispatchEvent(new w.Event('change')); await sleep(60);
  console.assert($$('#view details').length > 0 && $$('#view details').length < all, 'strength filter: ' + $$('#view details').length);
  // stock: add by hand, then suggestions
  await tab(4);
  console.assert(text().includes('Nothing in stock yet'), 'empty stock');
  await clickText('Add by hand');
  setInput('Name', '2-row pale malt'); setInput('Amount', '20'); await clickText('Save');
  await clickText('Add by hand');
  const k = setInput('Kind', 'Hop'); k.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(30);
  setInput('Name', 'Cascade'); setInput('Amount', '4'); await clickText('Save');
  await clickText('Add by hand');
  const k2 = setInput('Kind', 'Yeast'); k2.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(30);
  setInput('Name', 'US-05 / WLP001 / Wyeast 1056'); setInput('Amount', '2'); await clickText('Save');
  console.assert(text().includes('2-row pale malt') && text().includes('Cascade') && text().includes('4.5 to 7% alpha'), 'stock list with reference detail: ' + text().slice(0, 200));
  await clickText('What can I brew?'); await sleep(120);
  console.assert(text().includes('Ready to brew'), 'suggestions produced: ' + text().slice(0, 200));
  console.assert(/Needs .*(roast|dark|yeast|malt)/.test(text()), 'missing reasons shown');
  const startBtn = $$('#view button').find(b => b.textContent.trim() === 'Start');
  console.assert(startBtn, 'a style can be started from stock');
  startBtn.click(); await sleep(200);
  console.assert(text().includes('Edit batch') && $$('#view input[list=ferms]').some(i => i.value === '2-row pale malt'), 'batch prefilled from stock');
  // shop: no tag means no tracking in the link
  await tab(5);
  const testIpaChip = $$('#view .chip').find(c => c.textContent.trim() === 'Test IPA');
  if (testIpaChip) { testIpaChip.click(); await sleep(140); }
  console.assert(text().includes('2-row pale malt') && text().includes('Citra'), 'shopping list built: ' + text().slice(0, 200));
  let links = $$('#view a.act');
  console.assert(links.length >= 3 && !links[0].href.includes('aff='), 'clean links without a tag: ' + links[0].href);
  console.assert(!text().includes('commission'), 'no disclosure shown when there is no tag');
  $('#gearBtn').click(); await sleep(80);
  const mb = $$('#view label.field').find(l => l.querySelector('span').textContent.startsWith('MoreBeer')).querySelector('input');
  mb.value = 'phil123'; await clickText('Save tags');
  await tab(5); links = $$('#view a.act');
  console.assert(links[0].href.includes('aff=phil123'), 'tag applied: ' + links[0].href);
  console.assert(text().includes('commission'), 'disclosure appears once a tag is set');
  // BeerXML import creates a batch with snapped names
  await tab(0);
  const xmlInput = $('#view input[type=file]');
  const foreignXml = '<?xml version="1.0"?><RECIPES><RECIPE><NAME>Imported Pils</NAME><TYPE>All Grain</TYPE><BATCH_SIZE>20.82</BATCH_SIZE><BOIL_SIZE>26.5</BOIL_SIZE><BOIL_TIME>90</BOIL_TIME><EFFICIENCY>75</EFFICIENCY><STYLE><NAME>German pilsner</NAME></STYLE><FERMENTABLES><FERMENTABLE><NAME>Weyermann Pilsner Malt</NAME><AMOUNT>4.5</AMOUNT><YIELD>80</YIELD><COLOR>1.7</COLOR></FERMENTABLE></FERMENTABLES><HOPS><HOP><NAME>Hallertau Mittelfrueh</NAME><ALPHA>4</ALPHA><AMOUNT>0.056</AMOUNT><USE>Boil</USE><TIME>60</TIME></HOP></HOPS><YEASTS><YEAST><NAME>W-34/70</NAME><TYPE>Lager</TYPE></YEAST></YEASTS><MASH><MASH_STEPS><MASH_STEP><STEP_TEMP>65</STEP_TEMP></MASH_STEP></MASH_STEPS></MASH></RECIPE></RECIPES>';
  const xmlFile = new w.File([foreignXml], 'pils.xml', { type: 'application/xml' }); xmlFile.text = async () => foreignXml;
  Object.defineProperty(xmlInput, 'files', { value: [xmlFile] }); xmlInput.dispatchEvent(new w.Event('change')); await sleep(250);
  console.assert(text().includes('Edit batch') && $$('#view input[list=ferms]').some(i => i.value === 'Pilsner malt'), 'imported and snapped: ' + $$('#view input[list=ferms]').map(i => i.value));
  console.assert($$('#view input').some(i => i.value === '90'), 'boil time imported');
  console.log('brew smoke ok; errors:', errors);
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('SMOKE FAIL', e); process.exit(1); });
