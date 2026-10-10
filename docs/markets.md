# Markets: prices are a moving target

Opening crates is pure chance. **Selling** is where decisions matter.
BrickVault simulates a small collector market in which every figure has a base
value and a live price that moves.

## Market regimes

Each theme is always in one of four states. Each state lasts a random number of
"ticks" (one tick = 15 new items entering your vault):

| State    | Chance a price moves up | Size of each move | Lasts       |
|----------|------------------------:|-------------------|-------------|
| Bullish  | 70 %                    | 4–7 %             | 4–7 ticks   |
| Bearish  | 30 %                    | 4–7 %             | 4–7 ticks   |
| Stable   | 50 %                    | 1.5–3 %           | 5–9 ticks   |
| Volatile | 50 %                    | 12–20 %           | 2–4 ticks   |

Prices are clamped between **0.55×** and **2.2×** base value.

This is a simple **regime-switching model**, the same basic idea economists use to
describe real markets that move between calm and turbulent periods. When a regime
ends, the next one is picked at random, so neither a crash nor a boom lasts forever.

## Supply and demand

Your own actions move prices too:

- **Selling** a figure adds supply pressure. Dump ten copies of the same Common and
  its price falls.
- **Acquiring and holding** a figure adds scarcity pressure, which pushes its price up.
- Pressure fades by 15 % every tick, so the market slowly forgets.

So selling everything at once has a cost. Real traders call this **market impact**:
large sell orders move the price against the seller.

## Other ways to sell

| Channel              | How it works                                                       |
|----------------------|--------------------------------------------------------------------|
| Instant sell         | Current market price, no waiting                                   |
| Collector offers     | NPC buyers pay 1.4–2.2× base value for specific figures, and 1.6–2.5× for multi-figure sets |
| BrickBid Live        | Real-time auctions against bots, with anti-sniping extensions      |
| Theme completion     | Owning every figure in a theme permanently raises its values by 10 % |

The same figure can be worth very different amounts depending on **when** and
**where** you sell it. This is the core lesson of the market: an asset's price is
whatever someone is willing to pay *right now*.

## Debt

The bank offers loans of $500, $1,200 and $2,500 at 15–40 % interest, due within a
fixed number of openings. Borrowing to open more negative-EV crates only makes
losses bigger. Borrowing to *hold* items through a bearish phase can work, but
only if the recovery comes before the loan is due. That is **leverage**: it
multiplies both your gains and your mistakes. Late payments add penalties.

## Takeaways

1. Price is not value. The market price moves around the base value.
2. Selling in bulk pushes your own price down.
3. Leverage makes a good bet better and a bad bet worse. It does not change which one it is.
