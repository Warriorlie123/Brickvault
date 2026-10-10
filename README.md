# BrickVault: Minifigure Collecting Simulator

A browser game about collecting LEGO® Collectible Minifigures. Under the hood it is
a small simulation of **probability, markets and patience**.

> **Just for fun.** No real money, no purchases, no prizes. BrickVault is not affiliated
> with the LEGO Group. See [DISCLAIMER.md](DISCLAIMER.md).

**▶ Play:** [warriorlie123.github.io/brickvault](https://warriorlie123.github.io/brickvault/)

<!-- Add a screenshot or GIF here: ![BrickVault gameplay](docs/screenshot.gif) -->

---

## What it is

You start with $550 of play money. Open blind-box crates, build a collection, and
trade it in a living market. The goal is to reach **$75,000 debt-free**.

- **66 crates, 996 real minifigures across 10 LEGO themes:** every numbered
  Collectible Minifigures series (1–29, including the 1-of-5,000 Mr. Gold), plus Ninjago,
  Castle, Pirates, Space, City/Town, Friends, Adventurers, Atlantis and Monster Fighters.
  Each non-CMF crate is one official subtheme (e.g. *Ninjago: Rise of the Snakes*,
  *Castle: Forestmen, Black Knights & Wolfpack*), and every figure is checked against
  Brickset's subtheme listing.
- **Weighted drops** with four rarity tiers and published odds shown on every crate.
- **Regime-switching market:** each theme moves between bullish, bearish, stable and volatile states.
- **Supply & demand:** your own selling pushes prices down, and holding pushes them up.
- **Collector offers, live auctions against AI bidders, mystery bundles.**
- **Bank loans** with interest and late penalties.
- Achievements, daily streaks, an in-game email inbox, 3 save slots with import and export.

No frameworks, no build step, no server. Plain HTML, CSS and JavaScript.

## The ideas behind it

The game uses the same mechanics as loot boxes and trading apps, and then explains them.

| Essay | Question |
|---|---|
| [Probability](docs/probability.md) | What is a crate actually worth, and why does everyone who keeps opening go broke? |
| [Markets](docs/markets.md) | How do regime switching, supply pressure and leverage shape prices? |
| [Patience](docs/patience.md) | Where can a player gain an edge at all? |

Key result (20,000-run Monte Carlo, `node tools/simulate.js cmf_001`):

| Metric | Value |
|---|---|
| Series 1 crate price / expected value | $23 / $19.07 (house edge ≈ 17 %) |
| Median net result after 100 openings | –$611 |
| Players using "open and sell" who go broke | 100 % |
| Median openings until the first Legendary | 173 |

## Project structure

```
index.html            UI shell
style.css             styles
app.js                game logic: drops, market, offers, auctions, bank, saves
data.js               GENERATED: crates and minifigures
content/
  crates.csv          one row per crate
  figs.csv            one row per minifigure
  sources/            raw market data used for values
tools/
  build-data.js       CSV -> data.js (auto rarity + auto pricing + validation)
  simulate.js         Monte Carlo analysis of any crate
docs/                 essays on probability, markets and patience
```

### Data pipeline

The data is written as CSV and compiled into `data.js`:

```bash
node tools/build-data.js --check   # validate only
node tools/build-data.js           # regenerate data.js
```

For each figure, the build step:

1. builds the image URL from the BrickLink ID,
2. ranks figures by value inside their crate and assigns rarity
   (1 Legendary / 3 Epic / 5 Rare / 7 Common per 16),
3. prices each crate at `expected value × 1.2`, so the house edge is the same everywhere,
4. rejects duplicate IDs, unknown crates, invalid values and empty crates.

Adding a new series takes one CSV row per figure. See
[content/HOW_TO_ADD_DATA.md](content/HOW_TO_ADD_DATA.md).

## Running locally

Open `index.html` in any modern browser. Node.js is only needed for the tools.

## Data sources

Figure names, BrickLink IDs and approximate values come from
[Brickset](https://brickset.com/minifigs/category-Collectible-Minifigures) and the
[BrickLink](https://www.bricklink.com) catalog (collected October 2026).
Common and Rare values match approximate market prices for a new figure. Epic (×4) and
Legendary (×20) values are boosted for gameplay (for Series 11+ and the other themes these are
clamped to $40–400 and $300–1,200). Mr. Gold uses his approximate real used price.
Raw values and the page each one came from are in `content/sources/`.

## License

Code and documentation: [MIT](LICENSE). The license does not cover LEGO® trademarks,
minifigure images or price data; see the scope note in [LICENSE](LICENSE).

## Disclaimer

LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse
this project. All in-game currency is fictional. Full text: [DISCLAIMER.md](DISCLAIMER.md).
