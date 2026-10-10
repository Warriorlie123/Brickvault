# Adding figures

1. Open `figs.csv` in Excel / Google Sheets.
2. Add one row per figure. Only 3 columns are required:
   `crate_id, bricklink_id, value`
   - `name`   – optional (recommended)
   - `rarity` – leave EMPTY: assigned automatically by value rank (1 Legendary / 3 Epic / 5 Rare / 7 Common per 16)
   - `image`  – leave EMPTY: built from the BrickLink ID
   - `game_id` – leave EMPTY for new figures
3. New crate? Add a row to `crates.csv`. Leave `cost` empty and it is computed as expected value × 1.2.
   Leave `image` empty and the crate uses its most valuable figure as its picture.
4. Run from the project folder:
       node tools/build-data.js --check   # validate only
       node tools/build-data.js           # regenerate data.js

## How values were set

Raw prices are in `sources/` (approximate BrickLink "new" values via Brickset,
Oct 2026; "used" when no new value exists). Game value per figure:

- Common / Rare: real new price, rounded
- Epic (ranks 2–4): real price × 4
- Legendary (rank 1): real price × 20
- Series 11+ and all non-CMF themes: Epic clamped to $40–400, Legendary to $300–1,200
- Mr. Gold: fixed at $1,525 (approximate real used price)

Follow the same rule for new series to keep crates balanced.
