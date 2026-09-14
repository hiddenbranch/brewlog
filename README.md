# Brew Log (PWA) v1.0

Batches with live recipe stats, a brew day list built from the recipe with a boil timer, fermentation tracking, twelve calculators, a reference library, and a shopping list that links to homebrew retailers. Installs to a phone, works offline, no accounts, nothing leaves the phone.

## Deploy
Same as the other apps: new repository, upload `index.html`, `data.js`, `shop.js`, `core.js`, `app.js`, `sw.js`, `manifest.webmanifest` and `icons/`, then Settings > Pages > main branch, root. Run `node bump.mjs 1.0.1` before any later upload so no cache serves a stale file.

## What it does
- **Batches**: recipe with fermentables, hops, yeast and water salts. As you type it shows estimated OG, IBU (Tinseth), colour, and expected FG and ABV from the chosen yeast's attenuation, each marked against the style's published range. Alpha acid fills itself from the hop table. After brewing it shows measured OG and FG, ABV, calories, BU:GU and the mash efficiency you actually achieved.
- **Brew day**: strike volume, strike temperature and sparge volume calculated from the grain bill; a boil timer; a step list built from the recipe with the hop additions at their real clock positions. Ticking a step timestamps it into the batch log.
- **Gravity log** from a hydrometer (temperature corrected on entry) or a refractometer (Terrill correction from original and current Brix), with an optional fermenter temperature, a gravity chart, and a fermentation state (fermenting, slow, stable and for how long).
- **Packaging and tasting** entries: bottles or keg with the priming sugar or regulator pressure calculated on the spot, then appearance, aroma, flavour, mouthfeel and a score. Packaging moves the batch to Packaged; ticking "yeast pitched" on brew day moves it to Fermenting.
- **Hop countdown** on the boil timer: the next addition and the minutes to it, with a vibration in the last minute on phones that support it.
- **Calculators** (12): ABV and attenuation, hydrometer correction, refractometer with the Terrill correction, strike and infusion, volume and gravity, IBU, priming sugar across six sugars, keg carbonation both directions, pitch rate and starter growth, water salts with the sulfate to chloride verdict, conversions.
- **Reference**: 43 hops grouped into 11 genres (citrus, tropical, noble, dank, pine, stone fruit, wine-like and so on) with filters for genre and use; 45 fermentables; 50 yeast strains including 12 kveik cultures, with a dedicated kveik screen covering how to pitch, harvest and steer them by temperature; 40 styles; 10 water profiles; 15 off-flavours with cause and fix; process notes; and Beers of the World, 35 historical and regional beers from Sumerian sikaru to Norwegian no-boil farmhouse ale, filterable by era, strength and bitterness and sortable by age.
- **Stock**: what is on the shelf. Photograph one label at a time and the text is read on the phone and matched against the ingredient tables, with a confirm list rather than a guess; or add by hand from the same tables. Then "What can I brew?" ranks every style against the stock (enough base malt for the gravity, enough alpha acid for the bitterness, a dark malt where the style needs one, a suitable yeast) and starts a batch prefilled from what you have.
- **Shop**: a shopping list generated from the recipe, with repeat hop additions merged, and a Find link per line at the retailer you choose.

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
