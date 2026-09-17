# Brew Log (PWA) v1.0

Batches with live recipe stats, a brew day list built from the recipe with a boil timer, fermentation tracking, twelve calculators, a reference library, and a shopping list that links to homebrew retailers. Installs to a phone, works offline, no accounts, nothing leaves the phone.

## Deploy
Same as the other apps: new repository, upload `index.html`, `data.js`, `shop.js`, `core.js`, `app.js`, `sw.js`, `manifest.webmanifest` and `icons/`, then Settings > Pages > main branch, root. Run `node bump.mjs 1.0.1` before any later upload so no cache serves a stale file.

## What it does
- **Batches**: recipe with fermentables, hops, yeast and water salts. As you type it shows estimated OG, IBU (Tinseth), colour, and expected FG and ABV from the chosen yeast's attenuation, each marked against the style's published range. Alpha acid fills itself from the hop table. After brewing it shows measured OG and FG, ABV, calories, BU:GU and the mash efficiency you actually achieved.
- **Go, the guided brew day**: one screen, one step at a time, from heating strike water to pitching, built from the batch's recipe and your equipment profile. Strike water and temperature, a mash timer with a halfway check, mash out, sparge with the volume to collect, a pre-boil gravity check that tells you how many points off you are and what to do about it, the boil with every hop addition, the whirlfloc, and flameout as alarms (sound, vibration and a notification if allowed), a whirlpool stand if the recipe has one, chilling, the OG reading against the expected number, and pitching, which moves the batch to Fermenting. Timers are stored as start times, so locking the phone or closing the app loses nothing. The screen stays awake while a timer runs. Every step and every addition is timestamped into the batch log.
- **Brew day sheet**: the same numbers and the hop schedule as a checklist, for people who would rather run it themselves.
- **Gravity log** from a hydrometer (temperature corrected on entry) or a refractometer (Terrill correction from original and current Brix), with an optional fermenter temperature, a gravity chart, and a fermentation state (fermenting, slow, stable and for how long).
- **Packaging and tasting** entries: bottles or keg with the priming sugar or regulator pressure calculated on the spot, then appearance, aroma, flavour, mouthfeel and a score. Packaging moves the batch to Packaged; ticking "yeast pitched" on brew day moves it to Fermenting.
- **Hop countdown** on the boil timer: the next addition and the minutes to it, with a vibration in the last minute on phones that support it.
- **Calculators** (12): ABV and attenuation, hydrometer correction, refractometer with the Terrill correction, strike and infusion, volume and gravity, IBU, priming sugar across six sugars, keg carbonation both directions, pitch rate and starter growth, water salts with the sulfate to chloride verdict, conversions.
- **Reference**: Styles and recipes, 75 modern styles by region each with its ranges and a sized 5-gallon recipe; Beers of the world, the historical and regional beers each with a brewable reconstruction; 51 hops grouped into 11 genres (citrus, tropical, noble, dank, pine, stone fruit, wine-like and so on) with filters for genre and use; 54 fermentables; 59 yeast strains including five kveik cultures and the classic British, Belgian and lager strains, with a dedicated kveik screen covering how to pitch, harvest and steer them by temperature; 40 styles; 10 water profiles; 15 off-flavours with cause and fix; process notes; and Beers of the World, 35 historical and regional beers from Sumerian sikaru to Norwegian no-boil farmhouse ale, filterable by era, strength and bitterness and sortable by age.
- **Stock**: what is on the shelf. Photograph one label at a time and the text is read on the phone and matched against the ingredient tables, with a confirm list rather than a guess; or add by hand from the same tables. Then "What can I brew?" ranks every style against the stock (enough base malt for the gravity, enough alpha acid for the bitterness, a dark malt where the style needs one, a suitable yeast) and starts a batch prefilled from what you have.
- **Shop**: a shopping list generated from the recipe, with repeat hop additions merged, and a Find link per line at the retailer you choose.

## Recipes
`recipes.js` holds 96 five-gallon recipes, one generic version of each style grouped by region, plus brewable reconstructions of the ancient and regional beers. They are generated, not typed: `recipes-gen.js` holds the authored shape of each recipe (grist percentages, hop schedule, yeast, mash temperature, water, process note) and sizes it to the style's midpoint gravity with the same math the calculators use, computes the bittering charge to hit the IBU target, and refuses to build if OG, IBU, colour or ABV land outside the style's range. Nineteen of the first drafts failed that check, mostly big dark beers whose percentages overshot on colour; all 96 pass now. Every recipe card has "Brew this", which creates a batch with the full grain bill, hop schedule and yeast, ready to scale or export as BeerXML. Regenerate with `node recipes-gen.js` after editing a template.

## BeerXML
Export any batch as BeerXML from the batch screen (share sheet on a phone, download on a desktop) and import it into Brewfather, BeerSmith, Brewer's Friend or Grainfather; import a BeerXML file from any of them on the Batches screen. Ingredient names are snapped onto the app's tables where they match ("Pale Malt (2 Row) US" becomes 2-row pale malt), dry hops are kept as extras rather than boil additions, and mash temperature, boil length and efficiency come across. Note Brewfather's import is a Premium feature on their side.

## Equipment profile
Settings holds your system: batch and pre-boil volume, boil length, efficiency, mash ratio, strike loss to the vessel, boil-off rate, trub loss, grain absorption, hydrometer calibration temperature and refractometer correction factor. The brew day sheet and new batches use these instead of hardcoded guesses.

## Affiliate links
`shop.js` holds eight retailers (six US, two UK). With no affiliate tag set, links are plain search links with no tracking and no disclosure line. Paste a tag in Settings and links to that retailer carry it, and the FTC disclosure appears automatically wherever affiliate links are shown. Tags never leak between retailers (there is a test for that).

Apply to the programmes yourself. Adventures in Homebrewing runs an in-house programme at 6%; Amazon Associates covers equipment; MoreBeer and Northern Brewer run through affiliate networks. Most want to see traffic before approving, so the app is built to work fine unapproved.

## The log book link
`BOOK` at the top of `app.js` holds the title, blurb and URL for the paper log book, shown on the Shop and Settings screens. `url` is empty until the book is published; the card says "coming soon" until then. Point it at Amazon, or at a direct storefront when one exists, which is also the only way a real discount can be offered (KDP has no coupons).

## What the label reader can and cannot do
It reads one label at a time and matches the text against the ingredient tables, so "YAKIMA CHIEF CITRA PELLETS 2022 CROP 12.4% AA" resolves to Citra and "SAFALE US-05 11.5g" to the US-05 entry, aliases and all. A photo of a whole shelf will not work: the text is too small and the labels overlap. The matcher strips weights, alpha percentages and crop years before comparing, and it offers a ranked confirm list rather than committing to a guess.

## Testing
`node test.js` (brewing math, label matching, stock suggestions), `node test-beerxml.js` (export, round trip, and a foreign file with different naming), `node test-shop.js` (link building and shopping lists), `node smoke.js` (headless walk: batch creation with live stats, gravity entry and chart, brew day steps and timer, all 12 calculators checked for NaN, all 7 reference screens, shop links with and without a tag).
