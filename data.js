/* Brew Log - reference data. Published typical figures; always check the bag, the pack and the lab sheet. */
(function (root) {
  'use strict';
  const D = {};
  // alpha: typical percent range. use: B bittering, A aroma, D dual
  D.HOPS = [
    ['Cascade', 4.5, 7.0, 'D', 'Grapefruit, floral', 'Centennial, Amarillo', 'Citrus'],
    ['Centennial', 9.5, 11.5, 'D', 'Citrus, lemon, floral', 'Cascade, Amarillo', 'Citrus'],
    ['Chinook', 12, 14, 'B', 'Pine, grapefruit, spice', 'Columbus, Simcoe', 'Pine and resin'],
    ['Columbus / CTZ', 14, 16, 'B', 'Dank, pungent, herbal', 'Chinook, Nugget', 'Dank and herbal'],
    ['Simcoe', 12, 14, 'D', 'Pine, passionfruit, apricot', 'Summit, Chinook', 'Pine and resin'],
    ['Citra', 11, 13, 'A', 'Grapefruit, lime, tropical', 'Mosaic, Galaxy', 'Tropical'],
    ['Mosaic', 11.5, 13.5, 'A', 'Blueberry, mango, pine', 'Citra, Galaxy', 'Tropical'],
    ['Amarillo', 8, 11, 'A', 'Orange, peach, floral', 'Cascade, Centennial', 'Stone fruit'],
    ['Galaxy', 13, 15, 'A', 'Passionfruit, peach', 'Citra, Mosaic', 'Tropical'],
    ['Nelson Sauvin', 11, 13, 'A', 'White wine, gooseberry', 'Hallertau Blanc', 'Wine and white grape'],
    ['Sabro', 12, 16, 'A', 'Coconut, tangerine, cedar', 'Citra', 'Tropical'],
    ['El Dorado', 13, 16, 'D', 'Watermelon, pear, candy', 'Citra, Mosaic', 'Tropical'],
    ['Idaho 7', 9, 13, 'D', 'Tropical, pine, black tea', 'Mosaic', 'Tropical'],
    ['Strata', 11, 13, 'A', 'Passionfruit, dank, strawberry', 'Mosaic', 'Dank and herbal'],
    ['Willamette', 4, 6, 'A', 'Mild, floral, spicy', 'Fuggle, Styrian Golding', 'Earthy and floral'],
    ['Fuggle', 4, 5.5, 'A', 'Earthy, woody, mint', 'Willamette, East Kent Golding', 'Earthy and floral'],
    ['East Kent Golding', 4.5, 6.5, 'A', 'Honey, earth, gentle spice', 'Fuggle, Progress', 'Earthy and floral'],
    ['Challenger', 6.5, 8.5, 'D', 'Cedar, green tea, spice', 'Northern Brewer', 'Spicy'],
    ['Target', 9.5, 12.5, 'B', 'Sage, spicy, citrus peel', 'Challenger', 'Spicy'],
    ['Northern Brewer', 8, 10, 'B', 'Pine, mint, woody', 'Perle, Magnum', 'Pine and resin'],
    ['Magnum', 12, 15, 'B', 'Clean bittering, little aroma', 'Nugget, Warrior', 'Clean bittering'],
    ['Warrior', 15, 17, 'B', 'Clean, mild citrus', 'Magnum, Columbus', 'Clean bittering'],
    ['Nugget', 12, 14, 'B', 'Herbal, heavy', 'Columbus', 'Dank and herbal'],
    ['Hallertau Mittelfrüh', 3, 5.5, 'A', 'Noble: floral, herbal', 'Tettnang, Liberty', 'Noble'],
    ['Tettnang', 3.5, 5.5, 'A', 'Noble: mild, spicy', 'Hallertau, Saaz', 'Noble'],
    ['Saaz', 2.5, 4.5, 'A', 'Noble: earthy, cinnamon', 'Sterling, Tettnang', 'Noble'],
    ['Spalt', 3, 5, 'A', 'Noble: clean, woody', 'Saaz, Tettnang', 'Noble'],
    ['Perle', 6, 9, 'D', 'Mint, spice, clean', 'Northern Brewer', 'Spicy'],
    ['Hersbrucker', 2, 5, 'A', 'Floral, hay', 'Hallertau', 'Noble'],
    ['Styrian Golding', 4.5, 6, 'A', 'Lemon, resin', 'Fuggle', 'Earthy and floral'],
    ['Motueka', 6.5, 8.5, 'A', 'Lime, lemongrass', 'Saaz, Nelson', 'Citrus'],
    ['Riwaka', 4.5, 6.5, 'A', 'Grapefruit, passionfruit', 'Nelson Sauvin', 'Tropical'],
    ['Wai-iti', 2.5, 3.5, 'A', 'Peach, lime', 'Motueka', 'Stone fruit'],
    ['Vic Secret', 14, 18, 'A', 'Pineapple, pine', 'Galaxy', 'Tropical'],
    ['Enigma', 13, 18, 'A', 'Redcurrant, melon', 'Galaxy', 'Wine and white grape'],
    ['Huell Melon', 6.5, 7.5, 'A', 'Honeydew, strawberry', 'Mandarina Bavaria', 'Stone fruit'],
    ['Mandarina Bavaria', 7, 10, 'A', 'Tangerine, sweet citrus', 'Cascade', 'Citrus'],
    ['Hallertau Blanc', 9, 12, 'A', 'White wine, gooseberry', 'Nelson Sauvin', 'Wine and white grape'],
    ['Sorachi Ace', 10, 16, 'D', 'Lemon, dill, coconut', 'none close', 'Unusual'],
    ['Apollo', 15, 19, 'B', 'Grapefruit, resin', 'Columbus', 'Pine and resin'],
    ['Summit', 16, 18, 'B', 'Tangerine, onion at high rates', 'Simcoe', 'Dank and herbal'],
    ['Azacca', 14, 16, 'A', 'Mango, papaya, pine', 'Citra', 'Tropical'],
    ['Comet', 9, 12, 'D', 'Wild, grapefruit, grassy', 'Cascade', 'Dank and herbal'],
    ['Cluster', 6, 8, 'B', 'Black currant, fruity; the old American workhorse', 'Northern Brewer', 'Earthy and floral'],
    ["Brewer's Gold", 8, 10, 'B', 'Spicy, black currant', 'Northern Brewer', 'Spicy'],
    ['Liberty', 3, 5, 'A', 'Mild noble character', 'Hallertau Mittelfrüh', 'Noble'],
    ['Mt. Hood', 4, 7, 'A', 'Mild, herbal, clean', 'Hallertau Mittelfrüh', 'Noble'],
    ['Sterling', 6, 9, 'D', 'Saaz-like, spicy lemon', 'Saaz', 'Noble'],
    ['Crystal', 3.5, 5.5, 'A', 'Woody, floral, spicy', 'Hallertau Mittelfrüh', 'Noble'],
    ['Bramling Cross', 5, 7, 'D', 'Black currant, lemon, spice', 'Progress', 'Earthy and floral'],
    ['Progress', 5, 7.5, 'A', 'Soft, earthy, honey', 'East Kent Golding', 'Earthy and floral']
  ].map(h => ({ name: h[0], alphaLow: h[1], alphaHigh: h[2], use: h[3], flavour: h[4], subs: h[5], genre: h[6] }));
  D.HOP_GENRES = [...new Set(D.HOPS.map(h => h.genre))].sort();

  // ppg: points per pound per gallon at 100% efficiency. lovibond: colour. extract: not mashed
  D.FERMENTABLES = [
    ['2-row pale malt', 37, 1.8, 'Base', false, 'Clean American base, up to 100%'],
    ['Maris Otter', 38, 3.0, 'Base', false, 'British base, bready and rich'],
    ['Pilsner malt', 37, 1.6, 'Base', false, 'Lightest base; needs a longer boil for DMS'],
    ['Vienna malt', 36, 3.5, 'Base', false, 'Toasty, up to 100%'],
    ['Munich malt', 36, 9, 'Base', false, 'Malty depth, up to 100% in some styles'],
    ['Wheat malt', 39, 2, 'Base', false, 'Head and haze; sticky mash above 50%'],
    ['Flaked wheat', 35, 2, 'Adjunct', false, 'Head retention, haze, body'],
    ['Flaked oats', 33, 2.2, 'Adjunct', false, 'Silky body; classic in hazy IPA and stout'],
    ['Flaked barley', 32, 2.2, 'Adjunct', false, 'Body and head, dry Irish stout'],
    ['Flaked corn (maize)', 37, 0.5, 'Adjunct', false, 'Lightens body, classic American lager'],
    ['Flaked rice', 38, 0.5, 'Adjunct', false, 'Very neutral, dries the beer'],
    ['Crystal / Caramel 20L', 35, 20, 'Crystal', false, 'Light sweetness and body'],
    ['Crystal / Caramel 40L', 34, 40, 'Crystal', false, 'Caramel, amber colour'],
    ['Crystal / Caramel 60L', 34, 60, 'Crystal', false, 'Classic caramel note'],
    ['Crystal / Caramel 80L', 34, 80, 'Crystal', false, 'Raisin, deep caramel'],
    ['Crystal / Caramel 120L', 33, 120, 'Crystal', false, 'Dark fruit, can taste burnt above 10%'],
    ['CaraMunich', 34, 60, 'Crystal', false, 'German crystal, clean malty'],
    ['CaraPils / Carafoam', 33, 1.8, 'Crystal', false, 'Body and head without colour'],
    ['Special B', 30, 180, 'Crystal', false, 'Raisin and plum, Belgian dark beers'],
    ['Biscuit malt', 35, 25, 'Roast', false, 'Toasted bread crust'],
    ['Victory malt', 34, 28, 'Roast', false, 'Nutty, toasty'],
    ['Amber malt', 33, 22, 'Roast', false, 'Dry toast, British ales'],
    ['Brown malt', 32, 65, 'Roast', false, 'Dry coffee, porter'],
    ['Chocolate malt', 28, 350, 'Roast', false, 'Cocoa, smooth roast'],
    ['Pale chocolate', 30, 200, 'Roast', false, 'Milder cocoa'],
    ['Roasted barley', 25, 300, 'Roast', false, 'Sharp coffee, dry stout; unmalted'],
    ['Black patent', 25, 500, 'Roast', false, 'Acrid roast, colour; use sparingly'],
    ['Carafa Special II', 30, 425, 'Roast', false, 'Dehusked: colour and roast without harshness'],
    ['Acidulated malt', 27, 3, 'Special', false, 'Lowers mash pH about 0.1 per 1%'],
    ['Smoked / Rauch malt', 37, 3, 'Special', false, 'Beechwood smoke'],
    ['Peated malt', 34, 3, 'Special', false, 'Very strong; 1 to 2% is plenty'],
    ['Rye malt', 36, 3.5, 'Base', false, 'Spicy, sticky mash; add rice hulls'],
    ['Melanoidin malt', 33, 30, 'Special', false, 'Malty depth, decoction character'],
    ['Honey malt', 34, 25, 'Special', false, 'Sweet honey note'],
    ['Light DME', 44, 4, 'Extract', true, 'Dry malt extract; no mash needed'],
    ['Light LME', 36, 4, 'Extract', true, 'Liquid extract; darkens with age'],
    ['Wheat DME', 44, 3, 'Extract', true, 'For wheat beers'],
    ['Corn sugar (dextrose)', 42, 0.5, 'Sugar', true, 'Dries the beer; ferments fully'],
    ['Table sugar (sucrose)', 46, 0, 'Sugar', true, 'Belgian ales; boosts ABV without body'],
    ['Belgian candi syrup D-45', 32, 45, 'Sugar', true, 'Caramel and stone fruit'],
    ['Belgian candi syrup D-180', 32, 180, 'Sugar', true, 'Dark fruit, raisin, no body'],
    ['Honey', 35, 2, 'Sugar', true, 'Ferments dry; add after the boil'],
    ['Lactose', 35, 1, 'Sugar', true, 'Unfermentable: sweetness and body'],
    ['Maple syrup', 30, 35, 'Sugar', true, 'Mostly ferments out; flavour is subtle'],
    ['Agave nectar', 35, 3, 'Sugar', true, 'About three quarters sugar by weight, mostly fructose; ferments out almost completely. Handy for lifting a gravity that came in low'],
    ['Aromatic malt', 36, 20, 'Special', false, 'Intense malt aroma; 5 to 10% in Belgian and amber beers'],
    ['Torrified wheat', 36, 2, 'Adjunct', false, 'Puffed wheat: head retention in British ales'],
    ['Unmalted wheat', 34, 2, 'Adjunct', false, 'Raw wheat: witbier and lambic haze and body'],
    ['Sorghum malt', 36, 3, 'Base', false, 'African traditional beers; gluten-free'],
    ['Millet malt', 32, 2, 'Base', false, 'Gluten-free base; Himalayan chang'],
    ['Oak-smoked wheat malt', 37, 2, 'Special', false, 'Grodziskie; gentle, clean smoke'],
    ['Molasses', 36, 80, 'Sugar', true, 'Rum-like, strong; a little goes far'],
    ['Brown sugar', 46, 15, 'Sugar', true, 'Light caramel; ferments fully'],
    ['Dates', 30, 10, 'Sugar', true, 'Ancient and Middle Eastern beers; fruity sweetness'],
    ['Rice hulls', 0, 0, 'Adjunct', false, 'No sugar: prevents a stuck mash']
  ].map(f => ({ name: f[0], ppg: f[1], lovibond: f[2], group: f[3], extract: f[4], note: f[5] }));

  // attenuation percent, temp range F, flocculation
  D.YEAST = [
    ['US-05 / WLP001 / Wyeast 1056', 'Ale', 78, 84, 59, 72, 'Medium', 'The neutral American ale workhorse'],
    ['S-04 / WLP002 / Wyeast 1968', 'Ale', 71, 78, 64, 72, 'High', 'English: fruity, drops bright fast, can stall'],
    ['Nottingham', 'Ale', 77, 82, 57, 70, 'High', 'Clean, tolerates cool fermentation'],
    ['WLP007 Dry English', 'Ale', 70, 80, 65, 70, 'High', 'Attenuates further than most English strains'],
    ['Wyeast 1318 London Ale III', 'Ale', 71, 75, 64, 74, 'Medium-high', 'The hazy IPA strain: soft, fruity, leaves body'],
    ['WLP095 Burlington', 'Ale', 71, 75, 65, 72, 'Medium', 'Similar to 1318, juicy and soft'],
    ['Verdant IPA', 'Ale', 75, 82, 64, 72, 'Medium', 'Peach and stone fruit, hazy styles'],
    ['WLP029 German Ale / Kölsch', 'Ale', 72, 78, 65, 69, 'Medium', 'Clean, slight wine note, cold conditions well'],
    ['Wyeast 1007 German Ale', 'Ale', 73, 77, 55, 68, 'Low', 'Very dry and crisp, needs time to clear'],
    ['WLP300 Hefeweizen', 'Ale', 72, 76, 68, 72, 'Low', 'Banana and clove; warmer favours banana'],
    ['Wyeast 3068 Weihenstephan', 'Ale', 73, 77, 64, 75, 'Low', 'The classic hefeweizen strain'],
    ['WLP530 Abbey Ale', 'Ale', 75, 80, 66, 72, 'Medium', 'Belgian: spicy, fruity, likes to warm up'],
    ['Wyeast 3787 Trappist High Gravity', 'Ale', 74, 78, 64, 78, 'Medium', 'Dubbel and quad; tolerant of high gravity'],
    ['WLP565 Saison I', 'Ale', 65, 75, 68, 75, 'Medium', 'Famous for stalling; finish warm'],
    ['Wyeast 3711 French Saison', 'Ale', 77, 83, 65, 77, 'Low', 'Reliable saison, dries out fully'],
    ['Belle Saison (dry)', 'Ale', 85, 90, 63, 75, 'Low', 'Very attenuative; can finish under 1.002'],
    ['WLP644 Brett Trois (Sacch)', 'Ale', 80, 85, 70, 85, 'Low', 'Not a true Brett: tropical fruit'],
    ['WLP001 + Brett blends', 'Mixed', 80, 90, 68, 78, 'Low', 'Long conditioning; dedicate plastic and hoses'],
    ['Voss Kveik', 'Kveik', 75, 82, 72, 98, 'High', 'Orange and citrus; clean and neutral at the low end, fruity when hot. Ferments out in 2 to 4 days at 95F. Sold dry (LalBrew Voss) and liquid.'],
    ['Hornindal Kveik', 'Kveik', 75, 82, 77, 98, 'High', 'Tropical: pineapple, mango. The most expressive common kveik; hot and fast.'],
    ['Lutra Kveik', 'Kveik', 75, 82, 68, 95, 'High', 'Exceptionally clean at any temperature: the pseudo-lager kveik. Good for a fast crisp beer with no temperature control.'],
    ['Oslo Kveik', 'Kveik', 72, 80, 60, 98, 'High', 'Clean and lager-like, and unusual among kveik for working down into the 60s.'],
    ['HotHead Ale', 'Kveik', 75, 80, 68, 98, 'Medium-high', 'Norwegian ale strain that stays clean up to 98F; not strictly a kveik culture but used the same way.'],
    ['LalBrew Verdant IPA', 'Ale', 75, 82, 64, 72, 'Medium', 'Peach and stone fruit, leaves body; the dry option for hazy IPA.'],
    ['LalBrew New England', 'Ale', 74, 78, 59, 72, 'Medium', 'Tropical esters, low attenuation for a full mouthfeel.'],
    ['LalBrew Köln', 'Ale', 76, 82, 54, 72, 'High', 'Kölsch-style dry yeast; clean and crisp, ferments cool.'],
    ['LalBrew Windsor', 'Ale', 68, 72, 59, 72, 'Low', 'Low attenuation on purpose: sweet, full English ales.'],
    ['LalBrew BRY-97', 'Ale', 77, 81, 59, 72, 'High', 'West Coast workhorse; slow to start, drops very clear.'],
    ['LalBrew Munich Classic', 'Ale', 70, 76, 62, 77, 'Low', 'Wheat beer dry yeast: banana and clove.'],
    ['Omega Cosmic Punch', 'Ale', 73, 80, 68, 78, 'Medium', 'Thiolised: releases tropical thiols from the malt and hops. Pairs with Phantasm or thiol-rich hops.'],
    ['Lallemand Philly Sour', 'Sour', 75, 82, 68, 77, 'Medium', 'Lachancea: produces lactic acid and alcohol in one pitch. No kettle souring needed.'],
    ['WildBrew Sour Pitch', 'Sour', 0, 0, 86, 104, 'n/a', 'Lactobacillus for kettle souring before the boil; not a fermenting yeast.'],
    ['Mangrove Jack M44 US West Coast', 'Ale', 73, 77, 64, 72, 'Medium', 'Clean, hop-forward American ale dry yeast.'],
    ['Escarpment Foggy London', 'Ale', 71, 76, 64, 72, 'Medium-high', 'London III style: soft, hazy, stone fruit.'],
    ['Wyeast 1084 Irish Ale / WLP004', 'Ale', 71, 75, 62, 72, 'Medium', 'Dry stout and Irish red; slight fruit, clean roast'],
    ['Wyeast 1728 Scottish Ale / WLP028', 'Ale', 69, 73, 55, 75, 'High', 'Malty, tolerates cool ferments; wee heavy'],
    ['WLP013 London Ale / Wyeast 1028', 'Ale', 67, 75, 66, 71, 'Medium', 'Porter and brown ale; mineral, dry'],
    ['WLP023 Burton Ale', 'Ale', 69, 75, 68, 73, 'Medium', 'English IPA and bitter; apple and pear'],
    ['WLP036 Düsseldorf Alt', 'Ale', 65, 72, 65, 69, 'Medium', 'Altbier; clean, slightly malty'],
    ['Wyeast 3944 Belgian Witbier / WLP400', 'Ale', 72, 76, 62, 75, 'Low', 'Witbier; tart, spicy, hazy'],
    ['Wyeast 3522 Belgian Ardennes', 'Ale', 72, 76, 65, 85, 'High', 'Belgian pale and blonde; fruity, phenolic, forgiving'],
    ['WLP510 Bastogne / Wyeast 1762', 'Ale', 74, 80, 66, 72, 'Medium', 'Belgian dark strong; dry, clean spice'],
    ['WLP072 French Ale', 'Ale', 68, 75, 63, 73, 'High', 'Bière de garde; clean, malty, lager-like'],
    ['Wyeast 3763 Roeselare blend', 'Mixed', 80, 90, 65, 80, 'Low', 'Flanders red and oud bruin; a year or more, dedicate the plastic'],
    ["Baker's yeast (sahti)", 'Ale', 65, 75, 65, 80, 'Low', 'The traditional sahti pitch: banana, clove, cloudy, fast'],
    ['Wyeast 2035 American Lager', 'Lager', 73, 77, 48, 58, 'Medium', 'Pre-prohibition and American lagers'],
    ['WLP810 San Francisco Lager', 'Lager', 65, 70, 58, 65, 'High', 'California common: lager yeast at ale temperature'],
    ['Wyeast 2206 Bavarian Lager', 'Lager', 73, 77, 46, 58, 'Medium', 'Bocks, dunkel, Märzen; rich and malty'],
    ['Wyeast 2308 Munich Lager', 'Lager', 70, 74, 48, 56, 'Medium', 'Helles and Oktoberfest; smooth, needs a diacetyl rest'],
    ['WLP940 Mexican Lager', 'Lager', 70, 75, 50, 55, 'Medium', 'Vienna lager and Mexican styles; crisp'],
    ['W-34/70 / WLP830 / Wyeast 2124', 'Lager', 73, 77, 48, 58, 'Medium', 'The default lager strain; clean at 55F'],
    ['WLP833 German Bock', 'Lager', 70, 76, 48, 55, 'Medium', 'Malty, for dark lagers'],
    ['Wyeast 2278 Czech Pils', 'Lager', 70, 74, 48, 58, 'Medium-high', 'Sulfur during fermentation, clears with time'],
    ['WLP800 Pilsner', 'Lager', 72, 77, 50, 55, 'Medium', 'Dry, classic Czech character'],
    ['Wyeast 2007 Pilsen', 'Lager', 71, 75, 48, 56, 'High', 'Clean American lager'],
    ['Diamond Lager (dry)', 'Lager', 75, 82, 50, 59, 'High', 'Dry lager yeast, forgiving'],
    ['Novalager (dry)', 'Lager', 78, 83, 50, 68, 'High', 'Ferments lager-clean at ale temperatures'],
    ['WLP570 Belgian Golden', 'Ale', 74, 78, 68, 75, 'Low', 'Golden strong; pear and spice'],
    ['Wyeast 1272 American Ale II', 'Ale', 72, 76, 60, 72, 'Medium-high', 'Slightly fruitier than 1056']
  ].map(y => ({ name: y[0], type: y[1], attLow: y[2], attHigh: y[3], tempLow: y[4], tempHigh: y[5], floc: y[6], note: y[7] }));

  // og, fg, ibu, srm, abv ranges: widely published typical figures, not a quotation of any guideline document
  D.STYLES = [
    ['American IPA', 'IPA', 1.056, 1.070, 1.008, 1.014, 40, 70, 6, 14, 5.5, 7.5, 'Hop-forward, dry finish, clean bitterness'],
    ['Hazy / New England IPA', 'IPA', 1.060, 1.075, 1.010, 1.018, 25, 60, 4, 9, 6.0, 8.0, 'Soft body, big late hops, low bitterness, oats and wheat'],
    ['West Coast IPA', 'IPA', 1.056, 1.070, 1.006, 1.012, 50, 80, 4, 10, 6.0, 7.5, 'Bone dry, pine and citrus, clear'],
    ['Double IPA', 'IPA', 1.070, 1.090, 1.008, 1.018, 60, 100, 6, 14, 7.5, 10.0, 'Big but not sweet; sugar helps it finish dry'],
    ['American pale ale', 'Pale ale', 1.045, 1.060, 1.010, 1.015, 30, 50, 5, 10, 4.5, 6.2, 'Balanced, citrus hops over a light malt base'],
    ['English bitter', 'Pale ale', 1.032, 1.040, 1.007, 1.011, 25, 35, 8, 14, 3.2, 3.8, 'Low gravity, earthy hops, drinkable'],
    ['ESB', 'Pale ale', 1.048, 1.060, 1.010, 1.016, 30, 50, 6, 18, 4.6, 6.2, 'Fuller bitter with caramel and marmalade'],
    ['Blonde ale', 'Pale ale', 1.038, 1.054, 1.008, 1.013, 15, 28, 3, 6, 3.8, 5.5, 'Easy, clean, a good first all-grain beer'],
    ['Cream ale', 'Pale ale', 1.042, 1.055, 1.006, 1.012, 8, 20, 2.5, 5, 4.2, 5.6, 'Corn adjunct, very clean and light'],
    ['Kölsch', 'Pale ale', 1.044, 1.050, 1.007, 1.011, 18, 30, 3.5, 5, 4.4, 5.2, 'Ferment cool, lager cold, keep it clean'],
    ['Amber ale', 'Amber', 1.045, 1.060, 1.010, 1.015, 25, 40, 10, 17, 4.5, 6.2, 'Caramel malt with moderate hops'],
    ['Irish red', 'Amber', 1.036, 1.046, 1.010, 1.014, 18, 28, 9, 14, 3.8, 5.0, 'Light roast dryness, caramel'],
    ['Oktoberfest / Märzen', 'Lager', 1.054, 1.060, 1.010, 1.014, 18, 24, 8, 17, 5.8, 6.3, 'Munich malt depth, clean lager finish'],
    ['German pilsner', 'Lager', 1.044, 1.050, 1.008, 1.013, 22, 40, 2, 5, 4.4, 5.2, 'Crisp, spicy noble hops, needs clean fermentation'],
    ['Czech pale lager', 'Lager', 1.044, 1.060, 1.013, 1.017, 30, 45, 3.5, 6, 4.2, 5.8, 'Soft water, Saaz, decoction character'],
    ['Helles', 'Lager', 1.044, 1.048, 1.006, 1.012, 16, 22, 3, 5, 4.7, 5.4, 'Malt-forward but delicate; nowhere to hide'],
    ['Vienna lager', 'Lager', 1.048, 1.055, 1.010, 1.014, 18, 30, 9, 15, 4.7, 5.5, 'Toasty Vienna malt, dry finish'],
    ['Schwarzbier', 'Lager', 1.046, 1.052, 1.010, 1.016, 20, 30, 17, 30, 4.4, 5.4, 'Dark but light-bodied, gentle roast'],
    ['Dunkel', 'Lager', 1.048, 1.056, 1.010, 1.016, 18, 28, 14, 28, 4.5, 5.6, 'Munich malt, bread crust, no roast bite'],
    ['Doppelbock', 'Lager', 1.072, 1.112, 1.016, 1.024, 16, 26, 6, 25, 7.0, 10.0, 'Rich, malty, long cold conditioning'],
    ['American stout', 'Stout', 1.050, 1.075, 1.010, 1.022, 35, 75, 30, 40, 5.0, 7.0, 'Roast plus American hops'],
    ['Irish dry stout', 'Stout', 1.036, 1.044, 1.007, 1.011, 25, 45, 25, 40, 4.0, 4.5, 'Roasted barley and flaked barley, dry'],
    ['Oatmeal stout', 'Stout', 1.045, 1.065, 1.010, 1.018, 25, 40, 22, 40, 4.2, 5.9, 'Oats for silk; restrained roast'],
    ['Milk stout', 'Stout', 1.044, 1.060, 1.012, 1.024, 20, 40, 25, 40, 4.0, 6.0, 'Lactose sweetness, low bitterness'],
    ['Imperial stout', 'Stout', 1.075, 1.115, 1.018, 1.030, 50, 90, 30, 40, 8.0, 12.0, 'Big pitch, long ferment, years of cellaring'],
    ['Porter', 'Porter', 1.040, 1.070, 1.008, 1.020, 18, 50, 20, 35, 4.0, 6.5, 'Chocolate and brown malt, less sharp than stout'],
    ['Brown ale', 'Brown', 1.045, 1.060, 1.010, 1.016, 20, 30, 18, 35, 4.2, 6.2, 'Nutty, toasty, moderate bitterness'],
    ['Hefeweizen', 'Wheat', 1.044, 1.052, 1.008, 1.014, 8, 15, 2, 6, 4.3, 5.6, 'At least 50% wheat; yeast makes the beer'],
    ['Witbier', 'Wheat', 1.044, 1.052, 1.008, 1.012, 8, 20, 2, 4, 4.5, 5.5, 'Unmalted wheat, coriander and orange peel'],
    ['American wheat', 'Wheat', 1.040, 1.055, 1.008, 1.013, 15, 30, 3, 6, 4.0, 5.5, 'Clean yeast, wheat for body'],
    ['Berliner weisse', 'Sour', 1.028, 1.032, 1.003, 1.006, 3, 8, 2, 3, 2.8, 3.8, 'Kettle soured, very low bitterness'],
    ['Gose', 'Sour', 1.036, 1.056, 1.006, 1.010, 5, 12, 3, 4, 4.2, 4.8, 'Salt and coriander with lactic tartness'],
    ['Belgian dubbel', 'Belgian', 1.062, 1.075, 1.008, 1.018, 15, 25, 10, 17, 6.0, 7.6, 'Dark candi syrup, dried fruit'],
    ['Belgian tripel', 'Belgian', 1.075, 1.085, 1.008, 1.014, 20, 40, 4.5, 7, 7.5, 9.5, 'Pale, strong, dry; sugar is essential'],
    ['Saison', 'Belgian', 1.048, 1.065, 1.002, 1.008, 20, 35, 5, 14, 5.0, 7.0, 'Finish warm or it stalls; very dry'],
    ['Belgian blonde', 'Belgian', 1.062, 1.075, 1.008, 1.018, 15, 30, 4, 7, 6.0, 7.5, 'Soft spice, gentle fruit'],
    ['Barleywine', 'Strong', 1.080, 1.120, 1.016, 1.030, 35, 100, 10, 22, 8.0, 12.0, 'Long boil, big pitch, patience'],
    ['Scottish export', 'Scottish', 1.040, 1.060, 1.010, 1.016, 15, 30, 13, 22, 3.9, 6.0, 'Malty, low hops, no smoke'],
    ['Altbier', 'Amber', 1.044, 1.052, 1.008, 1.014, 25, 50, 11, 17, 4.3, 5.5, 'Ferment warm with ale yeast, condition cold'],
    ['Session IPA', 'IPA', 1.038, 1.048, 1.006, 1.012, 30, 50, 4, 8, 3.5, 5.0, 'All the hops at low gravity; easy to taste thin']
  ].map(s => ({ name: s[0], group: s[1], ogLow: s[2], ogHigh: s[3], fgLow: s[4], fgHigh: s[5], ibuLow: s[6], ibuHigh: s[7], srmLow: s[8], srmHigh: s[9], abvLow: s[10], abvHigh: s[11], note: s[12] }));

  D.KVEIK_NOTES = [
    'Pitch hot. Most kveik is happiest between 85 and 98F and finishes a normal-gravity beer in two to four days.',
    'Underpitching is normal: kveik tolerates rates a tenth of a standard ale pitch, though a healthy pitch still ferments faster and cleaner.',
    'Temperature steers the flavour. The same culture is close to neutral at 70F and full of fruit at 95F.',
    'Harvest it. Kveik is traditionally dried on a ring or a log and stored for months; slurry keeps in the fridge and rouses back easily.',
    'It tolerates high gravity and low oxygen better than most ale yeast, which is why it suits big beers brewed in a hurry.',
    'Kveik is a culture, not a single strain. Two packs labelled Voss from different suppliers can behave differently.',
    'Beyond the five listed there are a dozen other named farmhouse cultures (Ebbegarden, Stranda, Opshaug, Framgarden, Skare, Gjernes, Laerdal among them), mostly through Escarpment Labs and the kveik ring; treat them like Voss until you know them.'
  ];
  D.WATER_PROFILES = [
    ['Distilled / RO', 0, 0, 0, 0, 0, 0, 'Blank slate: build what the style wants'],
    ['Balanced light', 50, 5, 10, 50, 50, 40, 'General purpose for most pale beers'],
    ['Pale ale / hoppy', 110, 10, 15, 60, 250, 50, 'Sulfate forward, crisp bitterness'],
    ['Hazy IPA', 100, 10, 20, 175, 100, 50, 'Chloride forward, soft and full'],
    ['Pilsen (soft)', 7, 2, 2, 5, 5, 15, 'Very soft; classic Czech pale lager'],
    ['Munich', 76, 18, 2, 2, 10, 152, 'Alkaline, suits dark malty lagers'],
    ['Dublin', 118, 4, 12, 19, 54, 319, 'Alkaline: roast malt balances it'],
    ['Burton on Trent', 275, 40, 25, 35, 610, 270, 'Extreme sulfate; scale it back for homebrew'],
    ['Vienna', 200, 60, 8, 12, 125, 120, 'Amber lagers'],
    ['London', 100, 4, 86, 41, 77, 156, 'Porters and browns']
  ].map(w => ({ name: w[0], Ca: w[1], Mg: w[2], Na: w[3], Cl: w[4], SO4: w[5], HCO3: w[6], note: w[7] }));

  // Historical and regional beers: era, region, and the figures you would aim at to brew one today.
  // Ancient entries are reconstructions, not recipes from the period; nobody has the original numbers.
  D.WORLD = [
    ['Sumerian sikaru', 'Ancient', 'Mesopotamia', -3000, 3.0, 5.0, 0, 5, 'Bread-based beer made from twice-baked bappir loaves, drunk through reed straws to avoid the grain husks. The Hymn to Ninkasi doubles as the oldest surviving brewing description.', 'Barley bread, malt, dates, no hops'],
    ['Egyptian heqet', 'Ancient', 'Egypt', -2500, 3.0, 6.0, 0, 5, 'Emmer wheat beer, thick and nourishing, issued as wages to pyramid workers. Residue analysis shows a heated mash rather than raw bread soaking.', 'Emmer wheat, dates, no hops'],
    ['Chicha de jora', 'Ancient', 'Andes', -1000, 2.0, 5.0, 0, 5, 'Maize beer where the starch is converted by chewing: enzymes in saliva do the work malt does elsewhere. Still brewed in Peru and Bolivia.', 'Maize, saliva or malted maize'],
    ['English monastic ale', 'Medieval', 'England', 1100, 3.0, 6.0, 0, 15, 'Monasteries were the best record-keepers of the age, but what survives is accounts, not recipes: malt bought, brewings made, gallons produced, allowances per head. A Peterborough corrody promised eight gallons of the better beer twice a week, which tells you there were grades and rations, not what went in. Recipes with quantities are scarce before the 1500s, and the famous gallon a day per monk is contested.', 'Malted barley and oats, gruit or early hops, wooden vessels'],
    ['St Gall abbey beer', 'Medieval', 'Switzerland', 820, 3.0, 6.0, 0, 15, 'The plan of the abbey of St Gall, drawn around 820, shows three breweries: one for the monks, one for guests, one for pilgrims and the poor. It is the oldest surviving drawing of a working brewery.', 'Barley and oats, three grades of beer'],
    ['Gruit ale', 'Medieval', 'Northern Europe', 1100, 4.0, 7.0, 0, 10, 'Before hops, beer was bittered with a herb mix controlled by the church or the crown, which taxed the gruit. Bog myrtle, yarrow and marsh rosemary were the common three.', 'Bog myrtle, yarrow, wild rosemary'],
    ['Sahti', 'Traditional', 'Finland', 1500, 7.0, 9.0, 5, 15, 'Farmhouse beer filtered through juniper branches in a wooden trough, unhopped or lightly hopped, fermented with baker\'s yeast. Banana and clove, and famously cloudy.', 'Rye and barley malt, juniper, baker\'s yeast'],
    ['Gotlandsdricke', 'Traditional', 'Gotland, Sweden', 1500, 5.0, 8.0, 10, 20, 'Smoked farmhouse ale with juniper, close cousin to sahti. Often fermented with a farmhouse culture kept in the family.', 'Smoked malt, juniper, kveik-like cultures'],
    ['Kvass', 'Traditional', 'Eastern Europe', 1000, 0.5, 2.5, 0, 5, 'Rye bread beer, barely alcoholic, sold from street tankers in Russia and Ukraine. Fast, sour and refreshing.', 'Stale rye bread, sugar, raisins'],
    ['Grodziskie', 'Historic', 'Poland', 1600, 2.5, 3.5, 20, 35, 'Oak-smoked wheat beer, highly carbonated, pale and low in alcohol. Died out in 1993 and was revived by Polish brewers in the 2010s.', 'Oak-smoked wheat malt, noble hops'],
    ['Lichtenhainer', 'Historic', 'Germany', 1700, 3.5, 4.5, 5, 12, 'Smoked, sour wheat beer from Thuringia. Kettle souring plus beechwood smoke gets close.', 'Smoked wheat, lactobacillus'],
    ['Adambier', 'Historic', 'Dortmund', 1600, 9.0, 13.0, 30, 50, 'Strong dark sour ale, aged in wood, often with brettanomyces. Almost extinct; a handful of German and American brewers make it.', 'Munich and dark malts, aged hops, brett'],
    ['Kottbusser', 'Historic', 'Germany', 1800, 4.5, 5.5, 18, 25, 'Wheat and oat beer sweetened with honey and molasses, brewed in defiance of the purity law.', 'Wheat, oats, honey, molasses'],
    ['Mumme', 'Historic', 'Brunswick', 1500, 3.0, 12.0, 10, 25, 'Extremely thick, barely fermented malt beer exported by sea because it kept. Ranged from a low-alcohol syrup to a strong ale.', 'Very high malt bill, low attenuation'],
    ['Berliner weisse (historic)', 'Historic', 'Berlin', 1700, 2.8, 3.8, 3, 8, 'Once called the champagne of the north, served in litre bowls with raspberry or woodruff syrup. Mixed fermentation with brett in the traditional version.', 'Wheat, lacto, brett'],
    ['Gose (historic)', 'Historic', 'Goslar and Leipzig', 1300, 4.0, 5.0, 5, 12, 'Salty, coriander-spiced sour wheat beer from a naturally saline river. Revived twice, once in the 1980s and again by American brewers.', 'Wheat, salt, coriander, lacto'],
    ['Kentucky common', 'Historic', 'Louisville', 1850, 4.0, 5.5, 15, 25, 'Dark, quick-turnaround beer sold within days of brewing, soured slightly by the local mash practice. Died with prohibition.', 'Corn, caramel and black malt, light sour'],
    ['Steinbier', 'Traditional', 'Bavaria', 1500, 5.0, 6.5, 20, 30, 'Wort heated by dropping fire-heated rocks into it, caramelising sugar on the stones. Brewed where wooden vessels could not take direct fire.', 'Munich malt, heated granite'],
    ['Porter (18th century)', 'Historic', 'London', 1720, 6.0, 7.5, 40, 60, 'The first industrial beer: brown malt, aged in vats for months, blended young and old. Far stronger and more sour than modern porter.', 'Brown malt, aged hops, vat ageing'],
    ['India pale ale (19th century)', 'Historic', 'Burton', 1820, 6.0, 7.5, 60, 100, 'Heavily hopped pale ale shipped to India. Burton sulfate water, brett character from the cask, and much drier than the original story suggests.', 'Pale malt, huge hop rates, Burton water'],
    ['Bière de garde', 'Traditional', 'Northern France', 1800, 6.0, 8.5, 18, 28, 'Farmhouse beer brewed in winter to keep through summer. Malty, lightly fruity, often corked.', 'Pilsner and Munich malt, French ale yeast'],
    ['Saison (traditional)', 'Traditional', 'Wallonia', 1800, 3.5, 5.0, 20, 35, 'Originally a low-strength summer ration for farm workers, far weaker than the 6.5% version sold today.', 'Pilsner malt, wheat, saison yeast'],
    ['Lambic', 'Traditional', 'Pajottenland', 1500, 5.0, 6.5, 0, 10, 'Spontaneously fermented with wild yeast from the air of the Senne valley, aged in oak for one to three years, blended into gueuze.', 'Raw wheat, aged hops, spontaneous'],
    ['Flanders red', 'Traditional', 'West Flanders', 1800, 5.0, 6.5, 10, 25, 'Sour red ale aged in large oak foeders for up to two years, then blended with young beer.', 'Vienna malt, lacto, brett, oak'],
    ['Sorghum beer (umqombothi)', 'Traditional', 'Southern Africa', 1000, 2.0, 4.0, 0, 5, 'Sour, cloudy, still fermenting when drunk, made from sorghum and maize. Brewed at home for ceremonies.', 'Sorghum malt, maize, lacto'],
    ['Tella', 'Traditional', 'Ethiopia', 1000, 2.0, 6.0, 5, 15, 'Home-brewed beer using gesho leaves as the bittering herb instead of hops.', 'Barley, gesho, teff'],
    ['Chang', 'Traditional', 'Tibet and Nepal', 1000, 3.0, 6.0, 0, 5, 'Barley or millet beer served warm, sometimes drunk through a bamboo straw from the fermenting vessel.', 'Barley or millet, rice-culture starter'],
    ['Huangjiu-adjacent rice beer', 'Traditional', 'China', -2000, 8.0, 18.0, 0, 5, 'Grain wine using mould-based amylase (qu) rather than malt to convert starch. Older than any European beer tradition.', 'Rice, millet, qu starter'],
    ['Kulmbacher eisbock', 'Historic', 'Franconia', 1890, 9.0, 14.0, 25, 35, 'Doppelbock partly frozen and the ice removed, concentrating what is left. Said to have started as an accident in a Kulmbach yard.', 'Munich malt, freeze concentration'],
    ['Baltic porter', 'Historic', 'Baltic coast', 1800, 8.0, 10.0, 20, 40, 'Porter reinterpreted with lager yeast for the Russian and Baltic trade. Smooth, dark, deceptively strong.', 'Munich, chocolate malt, lager yeast'],
    ['Scotch ale / wee heavy', 'Traditional', 'Scotland', 1800, 6.5, 10.0, 17, 35, 'Strong malty ale from a long boil that caramelises the wort. The peat-smoke notion is a modern invention.', 'Maris Otter, long boil, minimal hops'],
    ['Dampfbier', 'Traditional', 'Bavaria', 1800, 4.5, 5.5, 20, 25, 'Barley beer fermented warm with hefeweizen yeast: banana and clove without wheat.', 'Barley malt, weizen yeast'],
    ['Roggenbier', 'Traditional', 'Bavaria', 1500, 4.5, 6.0, 10, 20, 'Rye beer, spicy and full, made when rye was cheaper than barley until it was banned to protect the bread supply.', 'Rye malt, weizen yeast'],
    ['Sake-adjacent kuchikami', 'Ancient', 'Japan', -300, 3.0, 8.0, 0, 5, 'Chewed-rice brewing, the Japanese parallel to chicha, later replaced by koji mould.', 'Rice, saliva or koji'],
    ['Braggot', 'Medieval', 'Wales and England', 1200, 6.0, 12.0, 10, 30, 'Half beer, half mead: malt and honey fermented together. Old enough to appear in Chaucer.', 'Pale malt, honey, gruit or hops'],
    ['Small beer', 'Historic', 'England and colonies', 1600, 0.5, 2.5, 5, 15, 'The second or third runnings from a strong beer mash, drunk all day by everyone including children, because it was safer than water.', 'Second runnings, minimal hops'],
    ['Stein-age farmhouse ale (maltol)', 'Traditional', 'Norway', 1600, 6.0, 9.0, 5, 20, 'Juniper infusion, kveik, no boil in some traditions: the wort was steeped rather than boiled, giving a distinct flavour.', 'Juniper, kveik, raw or short boil']
  ].map(w => ({ name: w[0], era: w[1], region: w[2], year: w[3], abvLow: w[4], abvHigh: w[5], ibuLow: w[6], ibuHigh: w[7], note: w[8], key: w[9] }));
  D.WORLD_ERAS = [...new Set(D.WORLD.map(w => w.era))];
  /* What became of each beer. fate: 'Still brewed' (never stopped), 'Revived' (died out, brought back), 'Evolved' (the name or the
     idea lives on in a changed modern style), 'Lost' (known only from reconstruction). modern: the living style closest to it.
     recipe: a modern style recipe in recipes.js to open, where one fits. today: where it stands now. Breweries named are the long-standing
     reference examples; small producers come and go, so treat them as a place to start looking. */
  D.WORLD_FATES = ['Still brewed', 'Revived', 'Evolved', 'Lost'];
  const TODAY = {
    'Sumerian sikaru': ['Lost', 'No direct descendant; bread beers such as kvass are the nearest living relatives', 'Kvass', 'Known from tablets and residue, not from an unbroken tradition. Anchor Brewing made a famous reconstruction, Ninkasi, in 1989 from the Hymn. The idea of brewing from bread survives in kvass and in modern beers made from surplus loaves.'],
    'Egyptian heqet': ['Lost', 'No direct descendant; the unhopped wheat ales are nearest in spirit', 'Witbier', 'Reconstructed several times by archaeologists working with brewers. Nothing brewed today descends from it directly, but a cloudy, lightly spiced wheat beer drunk young is the same kind of drink.'],
    'Chicha de jora': ['Still brewed', 'Chicha de jora itself, now made from malted maize rather than chewed', null, 'Sold in chicherias across Peru, Bolivia and Ecuador, marked by a red flag or a bunch of flowers on a pole. Malted maize (jora) has replaced chewing almost everywhere.'],
    'English monastic ale': ['Evolved', 'Trappist and abbey ales', 'Belgian dubbel', 'English monastic brewing ended with the dissolution in the 1530s. The tradition of monks brewing to support the house carried on in the Low Countries, and returned to England in 2018 when Mount St Bernard Abbey released Tynt Meadow. Modern abbey styles date from the 1800s and 1900s, not the middle ages.'],
    'St Gall abbey beer': ['Evolved', 'The graded abbey range: table beer, dubbel, tripel', 'Belgian tripel', 'Three breweries for three ranks of drinker is the same idea as a Trappist brewery keeping a light beer for the brothers and stronger ones for sale. The beers themselves are gone; the structure is not.'],
    'Gruit ale': ['Revived', 'Modern gruit and herb ales; heather ale', null, 'Hops won between 1400 and 1600 and gruit vanished. Craft brewers brought it back, and 1 February is kept as International Gruit Day. Fraoch heather ale from Scotland and Jopen Koyt from Haarlem are long-running examples.'],
    'Sahti': ['Still brewed', 'Sahti itself', null, 'Never stopped being made on Finnish farms and holds protected traditional-speciality status in the EU. A few commercial sahtis are sold in Finland, Lammin Sahti being the best known. It does not travel: it is unboiled, barely carbonated and short-lived.'],
    'Gotlandsdricke': ['Still brewed', 'Gotlandsdricke itself; smoked farmhouse ale', null, 'Still a home-brewed beer on Gotland, where there is an annual championship. Commercial versions are rare one-offs.'],
    'Kvass': ['Still brewed', 'Kvass itself, now mostly a bottled soft drink', null, 'Sold everywhere from Poland to Central Asia, bottled and on draught. Most commercial kvass is now a sweetened soft drink; the home-made version is closer to the original.'],
    'Grodziskie': ['Revived', 'Piwo Grodziskie, recognised again as a style', null, 'The last brewery in Grodzisk closed in 1993. Polish homebrewers kept it alive, the style entered the judging guidelines as a historical beer, and a brewery reopened in the town in 2015.'],
    'Lichtenhainer': ['Revived', 'The sour wheat family: Berliner weisse and gose, plus smoke', 'Berliner weisse', 'Gone by the 1980s, now listed as a historical style and brewed occasionally by craft brewers. If you can make a kettle sour you can make this: swap some of the wheat for smoked malt.'],
    'Adambier': ['Revived', 'Old ale and other strong, aged dark ales', 'Old ale', 'Extinct in Dortmund. Hair of the Dog in Portland, Oregon has brewed Adam since 1994 in homage to it, and that beer is how most people know the name.'],
    'Kottbusser': ['Revived', 'Honey wheat ales', 'American wheat', 'Killed off when the purity law reached Prussia in 1877 because of the honey and molasses. Brewed now and then by craft breweries; an American wheat with oats and a little honey is a fair modern reading.'],
    'Mumme': ['Evolved', 'Malt tonics and Malzbier; doppelbock in spirit', 'Doppelbock', 'The name survives in Brunswick, mostly as a thick non-alcoholic malt extract, with beer versions made occasionally. The idea of beer as liquid bread is what doppelbock kept.'],
    'Berliner weisse (historic)': ['Evolved', 'Modern Berliner weisse, usually kettle-soured and clean', 'Berliner weisse', 'From hundreds of breweries down to a single industrial brand by the 1990s. The modern craft version is quick and clean; a few small Berlin breweries have gone back to mixed fermentation with brettanomyces.'],
    'Gose (historic)': ['Revived', 'Modern gose, often fruited', 'Gose', 'Died out in Leipzig in 1966, was revived in the 1980s, and has been brewed at the Bayerischer Bahnhof in Leipzig since 2000. American craft brewers then made it one of the most common sour styles anywhere.'],
    'Kentucky common': ['Revived', 'Kentucky common as a historical style; cream ale is its nearest surviving cousin', 'Kentucky common', 'Finished by Prohibition. Revived by homebrewers from brewery records and now brewed from time to time around Louisville.'],
    'Steinbier': ['Revived', 'Amber and dark Bavarian lagers with a caramelised edge', 'Märzen / Oktoberfest', 'Pointless once metal kettles were cheap, so it lapsed, then came back as a curiosity in the 1980s. A handful of German and Austrian brewers still do it, along with craft one-offs.'],
    'Porter (18th century)': ['Evolved', 'Modern porter, and stout, which began as stout porter', 'London porter', 'Porter nearly vanished in Britain by the 1950s and was revived from the 1970s on. Today it is milder, fresher and not vatted; Fuller\'s London Porter is the usual benchmark. Every stout is a descendant.'],
    'India pale ale (19th century)': ['Evolved', 'English IPA, and the American IPA family that took the name', 'English IPA', 'Shrank into an ordinary-strength bitter in twentieth-century Britain, then was reinvented by American brewers from the 1980s with their own hops. English IPA is the closest to the Burton original; West Coast, hazy and double IPA are the grandchildren.'],
    'Bière de garde': ['Still brewed', 'Bière de garde itself', 'Bière de garde', 'Made continuously in French Flanders. Jenlain, 3 Monts and Ch\'ti are the long-standing names.'],
    'Saison (traditional)': ['Evolved', 'Modern saison, which is stronger; grisette and table saison are closer to the original', 'Grisette', 'The farm version faded with farm labour. The style was rebuilt around Saison Dupont at about 6.5%, roughly twice the strength of what field workers drank.'],
    'Lambic': ['Still brewed', 'Lambic and gueuze, unchanged', 'Lambic-style (mixed fermentation)', 'Made the same way in the same place: Cantillon, 3 Fonteinen, Boon and others. The words oude geuze and oude kriek on a label are legally protected and mean the traditional product.'],
    'Flanders red': ['Still brewed', 'Flanders red itself', 'Flanders red', 'Rodenbach still ages it in oak foeders in Roeselare, and Duchesse de Bourgogne is the other widely found example.'],
    'Sorghum beer (umqombothi)': ['Still brewed', 'Umqombothi, and commercial opaque beer', null, 'Home-brewed across southern Africa for ceremonies and sold commercially as opaque beer in cartons, still fermenting when you open it.'],
    'Tella': ['Still brewed', 'Tella itself', null, 'Still the everyday home-brewed beer of Ethiopia and Eritrea, sold from houses rather than breweries. There is no real commercial equivalent.'],
    'Chang': ['Still brewed', 'Chang, and tongba, the millet version', null, 'Made at home across Tibet, Nepal, Bhutan and Sikkim. Tongba is served as the fermented grain itself in a wooden mug, topped up with hot water and drunk through a straw.'],
    'Huangjiu-adjacent rice beer': ['Still brewed', 'Huangjiu; Shaoxing wine is the best-known kind', null, 'A continuous tradition of several thousand years. Sake is its Japanese cousin, made with a different mould.'],
    'Kulmbacher eisbock': ['Still brewed', 'Eisbock', 'Kulmbacher eisbock', 'Kulmbacher still makes it, and Schneider makes a wheat version, Aventinus Eisbock.'],
    'Baltic porter': ['Still brewed', 'Baltic porter', 'Baltic porter', 'Never went away in Poland, Finland and the Baltic states, and craft brewers around the world have picked it up. Zywiec Porter is the classic Polish example.'],
    'Scotch ale / wee heavy': ['Still brewed', 'Wee heavy', 'Wee heavy', 'Traquair House Ale, brewed in a manor house near Peebles, is the reference; Belhaven also makes one. Probably more are brewed in North America than in Scotland now.'],
    'Dampfbier': ['Revived', 'Dampfbier as a regional speciality', 'Dampfbier', 'A poor-country beer from the Bavarian Forest that faded when wheat and lager became affordable. Brewed again in and around Zwiesel.'],
    'Roggenbier': ['Revived', 'Roggenbier', 'Roggenbier', 'Rye was barred from Bavarian brewing for centuries. The style was brought back in Bavaria in the late 1980s and is still a rarity.'],
    'Sake-adjacent kuchikami': ['Evolved', 'Sake, brewed with koji instead', null, 'Koji mould did the job better and the practice ended well over a thousand years ago. Modern sake is its descendant.'],
    'Braggot': ['Revived', 'Braggot, judged today as a kind of mead', null, 'Rare for centuries, now made by craft meaderies and brewers.'],
    'Small beer': ['Evolved', 'Table beer, mild, session ales and low-alcohol beer', 'Dark mild', 'Clean water ended the need for it. The idea is back as table beer and modern low-alcohol brewing, and making one from the second runnings of a big beer is still a good brew day trick.'],
    'Stein-age farmhouse ale (maltol)': ['Still brewed', 'Norwegian farmhouse ale; kveik is now sold worldwide', 'Norwegian raw ale (maltøl)', 'Still brewed on farms in western Norway with family yeast. The yeast escaped first: kveik cultures became commercially available from the late 2010s and are now used for everything from IPA to pseudo-lager.']
  };
  D.WORLD.forEach(w => { const t = TODAY[w.name]; if (t) { w.fate = t[0]; w.modern = t[1]; w.recipe = t[2]; w.today = t[3]; } });
  D.OFF_FLAVOURS = [
    ['Green apple, cidery', 'Acetaldehyde', 'Beer packaged too early, or yeast pulled off the beer before cleanup', 'Leave it on the yeast another week at fermentation temperature'],
    ['Butter, butterscotch, slick', 'Diacetyl', 'Fermentation ended cold, stressed yeast, or an infection', 'Raise to 68F for two to three days before crashing (a diacetyl rest)'],
    ['Cooked corn, tomato', 'DMS', 'Pilsner malt with a lid on the boil, or slow chilling', 'Boil uncovered at least 60 minutes and chill fast'],
    ['Band-aid, clove, smoky', 'Phenols', 'Chlorine in the water, wild yeast, or a very warm ferment', 'Campden tablet in the brewing water; sanitise better; control temperature'],
    ['Cardboard, sherry, stale', 'Oxidation', 'Splashing after fermentation, headspace, slow packaging', 'Closed transfers, purge with CO2, fill to the top'],
    ['Solvent, hot alcohol', 'Fusel alcohols', 'Fermented too warm, underpitched, high gravity', 'Pitch enough yeast and hold the temperature down for the first 72 hours'],
    ['Sour, vinegar', 'Acetobacter or lactic bacteria', 'Infection: scratched plastic, tubing, unclean taps', 'Replace scratched plastic and hoses; review sanitation'],
    ['Sulfur, rotten egg', 'Yeast sulfur', 'Normal during lager fermentation; can also be stressed yeast', 'Give it time and a warm rest; usually clears on its own'],
    ['Astringent, mouth-drying', 'Tannins', 'Sparge water too hot or too alkaline, over-crushed grain, grain bag squeezed', 'Sparge below 170F, watch pH, crush without pulverising'],
    ['Metallic, blood', 'Metal ions', 'Corroded equipment, some water sources', 'Check for rust and scratched enamel; try RO water'],
    ['Vegetal, cabbage', 'Wort spoilage', 'Old hops, slow chill, wort held warm too long', 'Chill fast, pitch promptly, use fresh hops'],
    ['Soapy', 'Fatty acids', 'Beer left on the trub too long, or soap residue', 'Transfer off the yeast cake sooner; rinse everything well'],
    ['Skunky', 'Lightstruck', 'Beer exposed to light in clear or green glass', 'Brown bottles and keep them in the dark'],
    ['Thin, watery', 'Over-attenuation', 'Mash too low, too much sugar, very attenuative yeast', 'Mash at 154F or higher, cut the sugar, choose a lower attenuator'],
    ['Cloying, sweet', 'Under-attenuation', 'Mash too high, stalled or underpitched yeast, wrong strain', 'Mash lower, pitch more yeast, keep the ferment warm enough']
  ].map(o => ({ taste: o[0], cause: o[1], why: o[2], fix: o[3] }));

  // Carbonation by style, in volumes of CO2. Widely published typical ranges.
  D.CARBONATION = [
    ['Cask ale, served by handpump', 1.0, 1.5, 'Barely sparkling'],
    ['British bitter, mild and brown ale', 1.5, 2.0, 'Low: the pint should not fill you up'],
    ['Porter and stout', 1.7, 2.3, 'Dry stout on nitrogen is lower still'],
    ['Scottish ale and wee heavy', 1.5, 2.3, ''],
    ['Barleywine, old ale, imperial stout', 1.5, 2.3, 'Big beers want gentle carbonation'],
    ['American ale, pale ale and IPA', 2.2, 2.7, 'The default for most homebrew'],
    ['Amber and brown American ales', 2.2, 2.6, ''],
    ['Lager, pilsner and Kölsch', 2.4, 2.7, ''],
    ['Light lager and cream ale', 2.5, 2.8, ''],
    ['Bock and dark lager', 2.2, 2.7, ''],
    ['Altbier and California common', 2.2, 2.7, ''],
    ['Belgian abbey ale: blonde, dubbel, dark strong', 1.9, 2.6, ''],
    ['Tripel, golden strong and saison', 2.7, 3.5, 'Heavy bottles above 3.0'],
    ['Witbier and American wheat', 2.4, 2.9, ''],
    ['German wheat: hefeweizen, dunkelweizen, weizenbock', 3.3, 4.5, 'Heavy bottles only'],
    ['Berliner weisse, gose and Grodziskie', 3.0, 3.6, 'Heavy bottles only'],
    ['Lambic, unblended', 0.8, 1.5, 'Traditionally almost still'],
    ['Gueuze and fruit lambic', 3.0, 4.5, 'Champagne bottles'],
    ['Flanders red and oud bruin', 2.2, 2.8, ''],
    ['Farmhouse and ancient beers served young', 1.0, 1.8, 'Sahti, kvass, chicha: close to still']
  ].map(c => ({ name: c[0], low: c[1], high: c[2], mid: Math.round((c[1] + c[2]) / 2 * 10) / 10, note: c[3] }));
  // Best carbonation row for a style name (a recipe name, a style name, or whatever the brewer typed)
  D.carbFor = function (style) {
    const n = String(style || '').toLowerCase(); if (!n) return null;
    const pick = k => D.CARBONATION.find(c => c.name.startsWith(k));
    const rules = [
      [/gueuze|geuze|kriek|fruit lambic/, 'Gueuze'], [/lambic/, 'Lambic'], [/flanders|oud bruin/, 'Flanders'],
      [/berliner|gose|grodzisk|lichtenhain/, 'Berliner'], [/hefe|dunkelweizen|weizenbock|weissbier|weizen|roggen|dampf/, 'German wheat'],
      [/\bwit|american wheat|wheat/, 'Witbier'], [/tripel|golden strong|saison|grisette|bi[eè]re de garde/, 'Tripel'],
      [/belgian|dubbel|abbey|trappist|quad/, 'Belgian abbey'], [/barleywine|barley wine|old ale|imperial|eisbock|adambier|braggot/, 'Barleywine'],
      [/scottish|scotch|wee heavy/, 'Scottish'], [/stout|porter/, 'Porter and stout'], [/bitter|esb|mild|english brown|golden ale|english ipa|irish red/, 'British bitter'],
      [/light lager|cream ale/, 'Light lager'], [/bock|dunkel|schwarz|rauch|vienna|m[aä]rzen|oktoberfest|czech dark/, 'Bock'],
      [/\balt(bier)?\b|california common|steam|kentucky common/, 'Altbier'], [/lager|pils|helles|k[oö]lsch|export|festbier|keller/, 'Lager'],
      [/amber|brown/, 'Amber'], [/sahti|kvass|chicha|sikaru|heqet|tella|chang|umqombothi|sorghum|malt[oø]l|raw ale|gotlands|gruit|monastic|small beer|mumme|steinbier/, 'Farmhouse'],
      [/ipa|pale ale|blonde|american|session/, 'American ale']
    ];
    for (const [re, key] of rules) if (re.test(n)) return pick(key);
    return null;
  };

  // The forms hops are sold in, for the reference screen. The recipe form offers the first five.
  D.HOP_FORM_NOTES = [
    ['Pellet (T-90)', 'The standard. Whole hops milled and pressed; keeps well, easy to measure, and gives a little more bitterness than cones.', 'Use the weight in the recipe as written.', 'Counted as pellets.'],
    ['Whole leaf / cone', 'Dried cones as picked. Makes a natural filter bed, soaks up wort, and stales faster once open.', 'Same weight as pellets, or 10% more. Allow about a cup of lost wort per ounce.', 'Counted as cones: fewer oxidized alpha acids form in the kettle, so slightly fewer IBUs.'],
    ['Cryo, LupuLN2, Lupomax (lupulin-enriched pellets)', 'The leafy matter is sieved off cold, leaving the resin and oil. About twice the alpha and oil of the same hop as T-90, with less grassy flavour and less wort lost.', 'About half the weight of T-90. Best in the whirlpool and dry hop; nothing to gain at 60 minutes.', 'Counted as pellets with half the polyphenols. Enter the alpha from the pack.'],
    ['CO2 extract / resin (hop shot)', 'Pure hop resin in a syringe or tin, 55 to 65% alpha. Clean bittering with no plant matter, so more wort ends up in the fermenter.', 'Bittering additions only. Roughly 1 mL per 10 IBU in 5 gallons at 60 minutes; warm the syringe so it flows.', 'Enter grams as ounces (1 mL is about 1 g) and the alpha on the label. Counted with no polyphenols.'],
    ['Wet / fresh hops', 'Cones straight off the bine, used within a day or two of picking. Grassy, green and seasonal.', 'Five to six times the dried weight, because they are about 80% water.', 'Enter the normal dried alpha for the variety; the app counts a fifth of it.'],
    ['Isomerized extract (iso-alpha, tetra, hexa)', 'Bitterness already isomerized, dosed by the drop into finished beer. The way to fix a beer that came out under-bittered.', 'Dose to taste in a measured glass first, then scale up to the keg.', 'Not in the recipe form: it adds IBUs directly, with no kettle model needed.'],
    ['Flowable aroma extracts (Incognito, Spectrum, Salvo and similar)', 'Liquid whirlpool and dry hop products that replace part of the pellet charge to save wort. Mostly a professional product, slowly reaching homebrew shops.', 'Replace a third to a half of the whirlpool or dry hop charge, following the maker\'s rate.', 'Not in the recipe form: aroma only, negligible bitterness.'],
    ['Hop hash, plugs, BBC pellets', 'Hash is the resin scraped from pelletizing equipment, strong and inconsistent. Plugs are whole hops pressed into half-ounce discs. BBC pellets are gently processed T-90.', 'Hash: treat as a very high alpha pellet and use it late. Plugs: as leaf. BBC: as pellets.', 'Choose pellet or leaf as appropriate.']
  ].map(f => ({ name: f[0], what: f[1], use: f[2], app: f[3] }));

  // Starting waters for brewers without a report. Typical of the type, not of any one town.
  D.WATER_SOURCES = [
    ['Distilled or reverse osmosis', 0, 0, 0, 0, 0, 0, 'A blank slate. RO from a store machine is close enough to zero.'],
    ['Very soft (mountain and rain-fed supplies)', 8, 2, 6, 6, 6, 25, 'Pacific Northwest, New York City, Scotland, much of Scandinavia'],
    ['Soft', 25, 5, 12, 15, 20, 60, 'Many surface-water supplies'],
    ['Moderately hard', 45, 10, 20, 30, 40, 120, 'A typical mixed supply'],
    ['Hard and alkaline (limestone country)', 75, 20, 25, 45, 50, 250, 'Central Texas, the Midwest, Florida, southern England'],
    ['Very hard', 110, 30, 40, 60, 110, 320, 'Deep wells and chalk aquifers']
  ].map(w => ({ name: w[0], Ca: w[1], Mg: w[2], Na: w[3], Cl: w[4], SO4: w[5], HCO3: w[6], note: w[7] }));
  D.WATER_REPORT_HELP = [
    'In the US every utility publishes a yearly water quality report (a Consumer Confidence Report). Search your utility name plus "water quality report". Many also post a fuller mineral analysis, or will email one if you ask for "calcium, magnesium, sodium, chloride, sulfate and total alkalinity".',
    'Reports give ranges. Use the average, and expect it to move with the season, especially where a city blends river and well water.',
    'Hardness and alkalinity are usually given "as CaCO3". The calculator converts them. If sulfate is given "as S" or "SO4-S", multiply by 3.',
    'No report? A pool or aquarium test kit for total hardness (GH) and alkalinity (KH) gets you most of the way, because those two numbers decide how much acid or dilution you need.',
    'On a private well, or if you want certainty, a brewing water test from a lab costs about the same as a sack of malt and gives all six ions.',
    'When in doubt, dilute. Cutting hard tap water with RO or distilled water is simpler and more repeatable than trying to correct it with salts, and chloramine needs half a Campden tablet per 10 gallons either way.',
    'A household water softener swaps calcium for sodium. Do not brew with softened water; use the bypass tap.'
  ];

  // Quick process notes for brew day. The brewer can add their own in the app.
  D.PROCESS_CHIPS = ['Whirlfloc or Irish moss', 'Campden tablet for chlorine', 'Yeast nutrient', 'Recirculated the mash', 'No recirculation (overnight mash)', 'Rice hulls', 'Acid or pH adjustment', 'Tap water chill only', 'Ice bath or pre-chiller', 'Oxygenated or aerated', 'Stirred the mash'];

  D.PROCESS = {
    'Brew day': ['Heat strike water to the calculated temperature, allowing for a cold tun.', 'Mash in, stir, and check the temperature in three places; record the actual number, not the target.', 'Mash 60 minutes; iodine test if you want proof of conversion.', 'Sparge below 170F. Stop collecting when the runnings fall below about 1.010 or the pH rises above 6.', 'Boil 60 to 90 minutes, uncovered, watching for boilover in the first ten minutes.', 'Hops on the schedule; note the actual times.', 'Chill fast to pitching temperature, then transfer off the trub.', 'Take and record OG, aerate, pitch, seal, set temperature control.'],
    'Fermentation': ['Hold the first 72 hours at the low end of the strain range; that is when off-flavours form.', 'Free rise afterwards, or give a diacetyl rest for lagers and cold-fermented ales.', 'Take gravity readings, not calendar days: the same number twice, three days apart, means done.', 'Dry hop after active fermentation; warm, brief, and with as little oxygen as possible.', 'Cold crash before packaging if you want it clear.'],
    'Packaging': ['Sanitise everything that touches beer after the boil.', 'Bottles: priming sugar dissolved in boiled water, gently mixed, two weeks at room temperature.', 'Kegs: purge with CO2, fill through a closed transfer, set the pressure from the carbonation chart.', 'Label and date everything, including gravity and any changes from the recipe.'],
    'Cleaning': ['PBW or oxygen cleaner for soak and scrub; it removes the soil sanitiser cannot work through.', 'Star San is a no-rinse acid sanitiser; foam is fine, contact time is about 60 seconds.', 'Replace scratched plastic and old tubing; that is where infections live.', 'Never use scouring pads on plastic or stainless that touches beer.']
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = D; else root.BrewData = D;
})(typeof window !== 'undefined' ? window : globalThis);
