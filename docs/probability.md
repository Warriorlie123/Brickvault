# Probability: why the house always wins

Every crate in BrickVault is a small probability experiment. You pay a fixed price
and draw one figure from a weighted distribution:

| Rarity    | Chance per opening | Figures per 16-figure series |
|-----------|-------------------:|-----------------------------:|
| Common    | 70 %               | 7                            |
| Rare      | 22 %               | 5                            |
| Epic      | 7.6 %              | 3                            |
| Legendary | 0.4 %              | 1                            |

The chance of a *tier* is fixed; inside a tier every figure is equally likely.
So in Series 1, each of the 7 Commons has a 10 % chance and the single Legendary
(the Forestman) has 0.4 %.

## Expected value

The **expected value (EV)** of a crate is the average value you get per opening
if you opened it forever:

```
EV = Σ  P(tier) × average value of figures in that tier
```

For Series 1:

```
EV = 0.70 × $8.4 + 0.22 × $17.8 + 0.076 × $77 + 0.004 × $850  ≈  $19.07
```

The crate costs **$23**. On average you lose about **$3.93 per opening**, a
**house edge of ~17 %**. Every crate in the game is priced at roughly
`EV × 1.2` by the build script, so every crate has an edge of about 16–19 %.

## What that looks like in practice

These numbers come from `node tools/simulate.js cmf_001`, a 20,000-run
Monte Carlo simulation:

- **100 openings:** median result is **–$611**. Only about **1 in 4** runs ends in profit,
  and almost all of those are runs where the Legendary dropped.
- **Open-and-sell strategy from the $550 starting balance:** **100 %** of simulated
  players go broke. The median player lasts **77 openings**.

The averages don't care about streaks, "feeling lucky" or how close the last spin
came. A negative-EV game played long enough always converges toward its EV.
This is the law of large numbers.

## The Legendary trap

A 0.4 % chance feels like it should arrive "eventually". It does, but slowly:

| Openings | Chance of ≥ 1 Legendary |
|---------:|------------------------:|
| 50       | 18 %                    |
| 100      | 33 %                    |
| 173      | 50 % (the median wait)  |
| 250      | 63 % (the mean wait)    |
| 500      | 87 %                    |
| 1000     | 98 %                    |

Each opening is **independent**. The game has no memory, so 200 dry openings do not
make the next one more likely to hit. Believing otherwise is the
**gambler's fallacy**. At $23 a crate, the *average* cost of chasing one Legendary
is about $5,750, far more than the figure is worth.

## Takeaways

1. Know the EV before you pay. If price > EV, you are paying for entertainment, not investing.
2. Rare wins are what keep people playing. They are real, but they are already counted in the EV.
3. Small edges compound. 17 % per opening wipes out a bankroll in under a hundred openings.

See [markets.md](markets.md) for the parts of the game where skill *does* matter,
and [patience.md](patience.md) for how to use them.
