#!/usr/bin/env node
/**
 * build-data.js — generates data.js from two CSV files.
 *
 *   content/crates.csv : theme,crate_id,crate_name,image[,cost][,weights]
 *   content/figs.csv   : crate_id,bricklink_id,value[,name][,rarity][,image][,game_id]
 *   (game_id defaults to bricklink_id; set it only to keep old save files compatible)
 *
 * Only crate_id, bricklink_id and value are required per figure:
 *  - image  -> https://img.bricklink.com/ItemImage/MN/0/<bricklink_id>.png
 *  - rarity -> assigned by value rank inside the crate (1/3/5/7 per 16 figs)
 *  - cost   -> round(expected value * HOUSE_EDGE) if not given
 *
 * Usage:  node tools/build-data.js            (writes data.js)
 *         node tools/build-data.js --check    (validate only, print report)
 *         node tools/build-data.js --export   (dump current data.js to CSVs)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CRATES_CSV = path.join(ROOT, 'content', 'crates.csv');
const FIGS_CSV = path.join(ROOT, 'content', 'figs.csv');
const OUT = path.join(ROOT, 'data.js');

const HOUSE_EDGE = 1.2;

// Runtime adapter appended to every generated data.js (flattens LEGO_DATABASE for app.js)
const ADAPTER = "// ==========================================\n// Adapter: flattens LEGO_DATABASE (theme -> crate -> figure) into the\n// MINIFIG_DATABASE array and CRATES array that app.js consumes.\n// Keeps the authoring format (grouped by theme/crate) decoupled from the\n// runtime format the UI expects, without requiring changes anywhere else.\n// ==========================================\nconst MINIFIG_DATABASE = [];\nconst CRATES = [];\n\nObject.values(LEGO_DATABASE).forEach(theme => {\n    (theme.crates || []).forEach(crate => {\n        const pool = [];\n        (crate.minifigs || []).forEach(fig => {\n            if (!MINIFIG_DATABASE.some(f => f.id === fig.id)) {\n                MINIFIG_DATABASE.push({ ...fig, theme: theme.themeName });\n            }\n            pool.push(fig.id);\n        });\n\n        CRATES.push({\n            id: crate.id,\n            name: crate.name,\n            cost: crate.cost,\n            image: crate.image,\n            weights: crate.weights,\n            theme: theme.themeName,\n            pool\n        });\n    });\n});";
const DEFAULT_WEIGHTS = { common: 70, rare: 22, epic: 7.6, legendary: 0.4 };
const TIER_SHARE = { legendary: 1 / 16, epic: 3 / 16, rare: 5 / 16 }; // rest common
const TIERS = ['Common', 'Rare', 'Epic', 'Legendary'];

// ---------- CSV ----------
function parseCSV(text) {
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') q = false;
            else field += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.some(f => f.trim() !== '')) rows.push(row);
            row = [];
        } else field += c;
    }
    row.push(field);
    if (row.some(f => f.trim() !== '')) rows.push(row);
    const header = rows.shift().map(h => h.trim().toLowerCase().replace(/^﻿/, ''));
    return rows.map((r, idx) => {
        const o = { _line: idx + 2 };
        header.forEach((h, i) => (o[h] = (r[i] || '').trim()));
        return o;
    });
}
const csvCell = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

// ---------- helpers ----------
function assignRarities(figs) {
    const auto = figs.filter(f => !f.rarity);
    const n = figs.length;
    const want = {
        Legendary: Math.max(1, Math.round(n * TIER_SHARE.legendary)),
        Epic: Math.round(n * TIER_SHARE.epic),
        Rare: Math.round(n * TIER_SHARE.rare)
    };
    // manual overrides consume slots
    figs.filter(f => f.rarity).forEach(f => { if (want[f.rarity] > 0) want[f.rarity]--; });
    auto.sort((a, b) => b.value - a.value);
    let i = 0;
    for (const tier of ['Legendary', 'Epic', 'Rare'])
        for (let k = 0; k < want[tier] && i < auto.length; k++) auto[i++].rarity = tier;
    while (i < auto.length) auto[i++].rarity = 'Common';
}

function expectedValue(figs, weights) {
    let ev = 0, wsum = 0;
    for (const t of TIERS) {
        const tier = figs.filter(f => f.rarity === t);
        if (!tier.length) continue;
        const w = weights[t.toLowerCase()];
        ev += w * tier.reduce((a, f) => a + f.value, 0) / tier.length;
        wsum += w;
    }
    return wsum ? ev / wsum : 0;
}

function normRarity(r) {
    if (!r) return '';
    const m = TIERS.find(t => t.toLowerCase() === r.toLowerCase() || t[0].toLowerCase() === r.toLowerCase());
    return m || null;
}

function prettifyId(id) { return id; }

// ---------- export current data.js -> CSV ----------
function exportCurrent() {
    const src = fs.readFileSync(OUT, 'utf8');
    const ctx = {};
    new Function('ctx', src + '\nctx.DB = LEGO_DATABASE;')(ctx);
    const crateRows = [['theme', 'crate_id', 'crate_name', 'image', 'cost', 'weights']];
    const figRows = [['crate_id', 'bricklink_id', 'value', 'name', 'rarity', 'image', 'game_id']];
    for (const theme of Object.values(ctx.DB)) {
        for (const c of theme.crates) {
            const w = c.weights;
            crateRows.push([theme.themeName, c.id, c.name, c.image, c.cost, `${w.common}/${w.rare}/${w.epic}/${w.legendary}`]);
            for (const f of c.minifigs) {
                const m = /ItemImage\/MN\/0\/([^.]+)\.png$/.exec(f.image);
                const blId = m ? m[1] : '';
                const defaultImg = blId && f.image === `https://img.bricklink.com/ItemImage/MN/0/${blId}.png`;
                figRows.push([c.id, blId || f.id, f.value, f.name, f.rarity, defaultImg ? '' : f.image, f.id]);
            }
        }
    }
    fs.mkdirSync(path.dirname(CRATES_CSV), { recursive: true });
    fs.writeFileSync(CRATES_CSV, crateRows.map(r => r.map(csvCell).join(',')).join('\n') + '\n');
    fs.writeFileSync(FIGS_CSV, figRows.map(r => r.map(csvCell).join(',')).join('\n') + '\n');
    console.log(`Exported ${crateRows.length - 1} crates, ${figRows.length - 1} figures -> content/`);
}

// ---------- build ----------
function build(checkOnly) {
    const errors = [], warnings = [];
    const crates = parseCSV(fs.readFileSync(CRATES_CSV, 'utf8'));
    const figs = parseCSV(fs.readFileSync(FIGS_CSV, 'utf8'));

    const crateById = new Map();
    for (const c of crates) {
        if (!c.theme || !c.crate_id || !c.crate_name) { errors.push(`crates.csv:${c._line} missing theme/crate_id/crate_name`); continue; }
        if (crateById.has(c.crate_id)) errors.push(`crates.csv:${c._line} duplicate crate_id ${c.crate_id}`);
        let weights = DEFAULT_WEIGHTS;
        if (c.weights) {
            const p = c.weights.split('/').map(Number);
            if (p.length !== 4 || p.some(isNaN)) errors.push(`crates.csv:${c._line} weights must be common/rare/epic/legendary`);
            else weights = { common: p[0], rare: p[1], epic: p[2], legendary: p[3] };
        }
        crateById.set(c.crate_id, { ...c, weights, figs: [] });
    }

    const seenInCrate = new Set();
    const globalIds = new Map(); // bricklink_id -> value, to catch conflicting values
    for (const f of figs) {
        const where = `figs.csv:${f._line}`;
        const crate = crateById.get(f.crate_id);
        if (!crate) { errors.push(`${where} unknown crate_id "${f.crate_id}"`); continue; }
        if (!f.bricklink_id) { errors.push(`${where} missing bricklink_id`); continue; }
        const value = parseFloat(f.value);
        if (!(value > 0)) { errors.push(`${where} invalid value "${f.value}"`); continue; }
        const rarity = normRarity(f.rarity);
        if (rarity === null) { errors.push(`${where} bad rarity "${f.rarity}"`); continue; }
        const key = f.crate_id + '|' + f.bricklink_id;
        if (seenInCrate.has(key)) warnings.push(`${where} ${f.bricklink_id} listed twice in ${f.crate_id}`);
        seenInCrate.add(key);
        if (globalIds.has(f.bricklink_id) && globalIds.get(f.bricklink_id) !== value)
            warnings.push(`${where} ${f.bricklink_id} has different values across crates (${globalIds.get(f.bricklink_id)} vs ${value})`);
        globalIds.set(f.bricklink_id, value);
        const gameId = f.game_id || f.bricklink_id;
        crate.figs.push({
            gameId,
            blId: f.bricklink_id,
            name: f.name || prettifyId(f.bricklink_id),
            value,
            rarity,
            image: f.image || `https://img.bricklink.com/ItemImage/MN/0/${f.bricklink_id}.png`
        });
        if (!f.name) warnings.push(`${where} ${f.bricklink_id} has no name (ID will be shown)`);
    }

    // per-crate processing
    const themes = new Map();
    const report = [];
    for (const c of crateById.values()) {
        if (c.figs.length === 0) { warnings.push(`crate ${c.crate_id} is empty — skipped (would break the spinner)`); continue; }
        if (c.figs.length < 8) warnings.push(`crate ${c.crate_id} has only ${c.figs.length} figures`);
        assignRarities(c.figs);
        const ev = expectedValue(c.figs, c.weights);
        const cost = c.cost ? parseFloat(c.cost) : Math.max(1, Math.round(ev * HOUSE_EDGE));
        // no crate image given -> use the most valuable figure's image
        if (!c.image) c.image = [...c.figs].sort((a, b) => b.value - a.value)[0].image;
        report.push({ crate: c.crate_id, figs: c.figs.length, ev: ev.toFixed(2), cost, edge: ((cost / ev - 1) * 100).toFixed(0) + '%' });
        if (!themes.has(c.theme)) themes.set(c.theme, []);
        themes.get(c.theme).push({ ...c, cost });
    }

    // stable unique game IDs: reuse the BrickLink id (already globally unique)
    console.table(report);
    warnings.forEach(w => console.warn('⚠ ' + w));
    errors.forEach(e => console.error('✖ ' + e));
    const total = report.reduce((a, r) => a + r.figs, 0);
    console.log(`\n${themes.size} themes, ${report.length} crates, ${total} figure entries, ${globalIds.size} unique figures`);
    if (errors.length) { console.error(`\n${errors.length} error(s) — data.js NOT written.`); process.exit(1); }
    if (checkOnly) return;

    const js = JSON.stringify;
    let out = `// AUTO-GENERATED by tools/build-data.js from content/*.csv — do not edit by hand.\n`;
    out += `// Edit the CSV files, then run: node tools/build-data.js\n\n`;
    out += `const RARITIES = {\n    COMMON: { name: "Common", color: "#b0c3d9" },\n    RARE: { name: "Rare", color: "#4b69ff" },\n    EPIC: { name: "Epic", color: "#d32ce6" },\n    LEGENDARY: { name: "Legendary", color: "#ffd700" }\n};\n\n`;
    out += `const LEGO_DATABASE = {\n`;
    out += [...themes.entries()].map(([theme, cs]) =>
        `    ${js(theme)}: {\n        themeName: ${js(theme)},\n        crates: [\n` +
        cs.map(c =>
            `            {\n                id: ${js(c.crate_id)},\n                name: ${js(c.crate_name)},\n                cost: ${c.cost},\n                image: ${js(c.image)},\n                weights: ${js(c.weights).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ').replace('{', '{ ').replace('}', ' }')},\n                minifigs: [\n` +
            c.figs.map(f =>
                `                    { id: ${js(f.gameId)}, name: ${js(f.name)}, rarity: RARITIES.${f.rarity.toUpperCase()}.name, value: ${f.value}, image: ${js(f.image)} }`
            ).join(',\n') +
            `\n                ]\n            }`
        ).join(',\n') +
        `\n        ]\n    }`
    ).join(',\n');
    out += `\n};\n`;

    out += '\n' + ADAPTER;
    fs.writeFileSync(OUT, out);
    console.log(`\n✔ data.js written.`);
}

const arg = process.argv[2];
if (arg === '--export') exportCurrent();
else build(arg === '--check');
