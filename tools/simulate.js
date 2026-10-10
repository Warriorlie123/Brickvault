#!/usr/bin/env node
/**
 * simulate.js — Monte Carlo analysis of the crate economy.
 * Reproduces the numbers quoted in docs/probability.md.
 *
 *   node tools/simulate.js [crate_id] [runs]
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const ctx = {};
new Function('ctx', src + '\nctx.C = CRATES; ctx.M = MINIFIG_DATABASE;')(ctx);
const { C: CRATES, M: FIGS } = ctx;

const crateId = process.argv[2] || 'cmf_001';
const RUNS = parseInt(process.argv[3] || '20000', 10);
const START = 550, GOAL = 75000;
const TIERS = ['common', 'rare', 'epic', 'legendary'];

const crate = CRATES.find(c => c.id === crateId);
if (!crate) { console.error('Unknown crate ' + crateId); process.exit(1); }
const figs = crate.pool.map(id => FIGS.find(f => f.id === id));
const byTier = Object.fromEntries(TIERS.map(t => [t, figs.filter(f => f.rarity.toLowerCase() === t)]));
const wsum = TIERS.reduce((a, t) => a + (byTier[t].length ? crate.weights[t] : 0), 0);

function pull() {
    let r = Math.random() * wsum;
    for (const t of TIERS) {
        if (!byTier[t].length) continue;
        if ((r -= crate.weights[t]) < 0) return byTier[t][Math.floor(Math.random() * byTier[t].length)];
    }
    return figs[0];
}

const ev = TIERS.reduce((a, t) => a + (byTier[t].length
    ? crate.weights[t] / wsum * byTier[t].reduce((s, f) => s + f.value, 0) / byTier[t].length : 0), 0);
const pLeg = byTier.legendary.length ? crate.weights.legendary / wsum : 0;

// 1) Gambler's ruin: open + instantly sell until broke or goal
let busts = 0, wins = 0; const lifetimes = [];
for (let s = 0; s < RUNS; s++) {
    let money = START, n = 0;
    while (money >= crate.cost && money < GOAL && n < 1e5) { money += pull().value - crate.cost; n++; }
    if (money >= GOAL) wins++; else { busts++; lifetimes.push(n); }
}
lifetimes.sort((a, b) => a - b);

// 2) Net result of exactly 100 openings
const nets = [];
for (let s = 0; s < RUNS; s++) { let m = 0; for (let i = 0; i < 100; i++) m += pull().value - crate.cost; nets.push(m); }
nets.sort((a, b) => a - b);

const pct = x => (x * 100).toFixed(1) + '%';
console.log(`\nCrate ${crate.id} — ${crate.name}`);
console.log(`  cost $${crate.cost} | expected value $${ev.toFixed(2)} | house edge ${pct(1 - ev / crate.cost)}`);
console.log(`\nOpen-and-sell from $${START} (${RUNS} runs):`);
console.log(`  went broke: ${pct(busts / RUNS)} | reached $${GOAL}: ${pct(wins / RUNS)} | median openings before broke: ${lifetimes[lifetimes.length >> 1] ?? '-'}`);
console.log(`\n100 openings: median net $${nets[RUNS >> 1]} | mean net $${(nets.reduce((a, b) => a + b, 0) / RUNS).toFixed(0)} | profitable: ${pct(nets.filter(x => x > 0).length / RUNS)}`);
if (pLeg) {
    console.log(`\nChance of at least one Legendary (p = ${pct(pLeg)} per opening):`);
    for (const k of [50, 100, 250, 500, 1000]) console.log(`  ${String(k).padStart(4)} openings: ${pct(1 - Math.pow(1 - pLeg, k))}`);
    console.log(`  median wait: ${Math.ceil(Math.log(0.5) / Math.log(1 - pLeg))} openings | mean wait: ${Math.round(1 / pLeg)}`);
}
