const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

const RARITY_MAP = {
    "1": "COMMON",
    "2": "RARE",
    "3": "EPIC",
    "4": "LEGENDARY"
};

// Finds the closing ']' that actually matches the given opening bracket,
// tracking nesting depth and ignoring brackets inside string literals.
function findMatchingClosingBracket(content, openBracketIndex) {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = openBracketIndex; i < content.length; i++) {
        const char = content[i];

        // Track whether we're inside a string literal so brackets inside quotes are ignored
        if ((char === '"' || char === "'" || char === '`') && content[i - 1] !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }

        if (!inString) {
            if (char === '[') {
                depth++;
            } else if (char === ']') {
                depth--;
                if (depth === 0) {
                    return i; // Found the matching closing bracket
                }
            }
        }
    }
    return -1;
}

// Prompts for an image source: either a URL or a local file under images/
async function getImagePath(promptText) {
    console.log(`\n${promptText}`);
    console.log("  1) İnternet URL'si (http/https)");
    console.log("  2) Lokal images/ klasöründen dosya adı");
    const choice = await askQuestion("Görsel Seçimi (1 veya 2): ");

    if (choice.trim() === "2") {
        const fileName = await askQuestion("images/ içindeki dosya adı (Örn: crate_adventurers2.png): ");
        return `images/${fileName.trim()}`;
    } else {
        const url = await askQuestion("Görsel URL'si (Örn: https://...): ");
        return url.trim();
    }
}

async function startBuilder() {
    console.log("\n=============================================");
    console.log("    LEGO DATABASE BUILDER (KUTU & KARAKTER)   ");
    console.log("=============================================\n");

    console.log("Ne yapmak istiyorsun?");
    console.log("  1) Sıfırdan YENİ KUTU (Crate) Oluştur");
    console.log("  2) Var Olan Kutunun İçine KARAKTER Ekle");

    const mode = await askQuestion("Seçimin (1 veya 2): ");

    if (mode.trim() === "1") {
        await createNewCrate();
    } else {
        await addMinifigsToCrate();
    }

    rl.close();
}

// Appends a new crate to a theme's crates array
async function createNewCrate() {
    console.log("\n--- YENİ KUTU (CRATE) OLUŞTURMA ---");
    const theme = await askQuestion("Hangi Temaya Eklenecek? (Örn: Adventurers, Ninjago, Star Wars): ");
    const crateId = await askQuestion("Kutu ID'si ne olsun? (Örn: crate-adventurers-v2): ");
    const crateName = await askQuestion("Kutu Adı: (Örn: Adventurers Desert Series 2): ");
    const cost = parseFloat(await askQuestion("Açılış Fiyatı ($): ")) || 15;

    const crateImage = await getImagePath("Kutu Görseli Tipi:");

    const filePath = './data.js';
    let fileContent = fs.readFileSync(filePath, 'utf-8');

    const themeIndex = fileContent.indexOf(`"${theme.trim()}":`);
    if (themeIndex === -1) {
        console.log(`\n❌ HATA: [${theme}] teması data.js içinde bulunamadı!`);
        return;
    }

    const cratesIndex = fileContent.indexOf('crates: [', themeIndex);
    if (cratesIndex === -1) {
        console.log(`\n❌ HATA: [${theme}] temasına ait crates dizisi bulunamadı!`);
        return;
    }

    const openBracketIndex = cratesIndex + 'crates: '.length;
    const closingBracketIndex = findMatchingClosingBracket(fileContent, openBracketIndex);

    if (closingBracketIndex === -1) {
        console.log(`\n❌ HATA: crates dizisinin gerçek kapanış parantezi bulunamadı!`);
        return;
    }

    const crateString =
        `            {
                id: "${crateId.trim()}",
                name: "${crateName.trim()}",
                cost: ${cost},
                image: "${crateImage}",
                weights: { common: 65, rare: 25, epic: 8, legendary: 2 },
                minifigs: []
            }`;

    const contentBeforeClosing = fileContent.slice(openBracketIndex + 1, closingBracketIndex).trimEnd();
    const needsComma = contentBeforeClosing.trim().length > 0;

    let updatedContent = "";
    if (needsComma) {
        updatedContent = fileContent.slice(0, openBracketIndex + 1) +
            contentBeforeClosing + ",\n" +
            crateString + "\n        " +
            fileContent.slice(closingBracketIndex);
    } else {
        updatedContent = fileContent.slice(0, openBracketIndex + 1) +
            "\n" + crateString + "\n        " +
            fileContent.slice(closingBracketIndex);
    }

    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    console.log(`\n✅ Başarılı! [${theme}] temasına tam simetrik ve güvenli yeni kutu eklendi: ID -> ${crateId}`);
}

// Adds one or more figures to an existing crate
async function addMinifigsToCrate() {
    console.log("\n--- KUTUYA KARAKTER EKLEME ---");
    const crateId = await askQuestion("Ekleme yapılacak KUTU (Crate) ID'sini girin (Örn: crate-adventurers-v1): ");

    console.log("\nGiriş Yöntemi:");
    console.log("  1) Adım Adım (Tek Tek Sor)");
    console.log("  2) Hızlı / Toplu Giriş (Tek Satırda Formatlı Giriş)");
    const entryMethod = await askQuestion("Seçimin (1 veya 2): ");

    if (entryMethod.trim() === "2") {
        await addBatchMinifigs(crateId.trim());
    } else {
        await addSingleMinifigs(crateId.trim());
    }
}

// Single-entry mode: prompts for each field one at a time
async function addSingleMinifigs(crateId) {
    console.log(`\nHedef Kutu: [${crateId}] | Karakter Giriş Döngüsü Başladı (Çıkış için 'q' yazın)\n`);

    while (true) {
        console.log("--------------------------------------------------");
        const name = await askQuestion("Karakter İsmi (Çıkış için 'q'): ");
        if (name.toLowerCase() === 'q') break;

        const customId = await askQuestion("Karakter ID (Örn: adv-019): ");

        console.log("Rarity Seçin:\n  1) Common\n  2) Rare\n  3) Epic\n  4) Legendary");
        const rarityChoice = await askQuestion("Seçiminiz (1-4): ");
        const rarityKey = RARITY_MAP[rarityChoice.trim()] || "COMMON";

        const valueInput = await askQuestion("Fiyat ($): ");
        const value = parseFloat(valueInput) || 0;

        const imageUrl = await getImagePath("Karakter Görseli Tipi:");

        const success = appendToCrate(crateId, customId.trim(), name.trim(), rarityKey, value, imageUrl);
        if (success) {
            console.log(`\n✅ [${crateId}] kutusuna eklendi: ${name} (${customId})`);
        } else {
            console.log(`\n❌ HATA: [${crateId}] ID'li kutu bulunamadı!`);
            break;
        }
    }
}

// Batch mode: parses comma-separated lines for faster entry
async function addBatchMinifigs(crateId) {
    console.log(`\n--- TOPLU KARAKTER GİRİŞİ: [${crateId}] ---`);
    console.log("Format: İsim, ID, Rarity(1-4), Fiyat, Görsel(URL veya dosya adı)");
    console.log("Örnek: Johnny Thunder, adv-020, 1, 15, adv_020.png\n");

    while (true) {
        console.log("--------------------------------------------------");
        const rawInput = await askQuestion("Veri Girin (veya 'q'): ");
        if (rawInput.trim().toLowerCase() === 'q') break;

        const parts = rawInput.split(',').map(p => p.trim());

        if (parts.length < 5) {
            console.log("❌ Eksik veri girdiniz! Lütfen 5 parametreyi de virgülle ayırarak girin.");
            continue;
        }

        const [name, customId, rarityNum, valStr, imgStr] = parts;

        const rarityKey = RARITY_MAP[rarityNum] || "COMMON";
        const value = parseFloat(valStr) || 0;

        let finalImage = imgStr;
        if (!imgStr.startsWith("http://") && !imgStr.startsWith("https://") && !imgStr.startsWith("images/")) {
            finalImage = `images/${imgStr}`;
        }

        const success = appendToCrate(crateId, customId, name, rarityKey, value, finalImage);
        if (success) {
            console.log(`✅ Eklendi: ${name} (${customId}) -> ${rarityKey} | $${value}`);
        } else {
            console.log(`❌ HATA: [${crateId}] ID'li kutu bulunamadı!`);
            break;
        }
    }
}

// Shared insertion logic: locates the target crate's minifigs array and appends an entry
function appendToCrate(targetCrateId, id, name, rarityKey, value, image) {
    const filePath = './data.js';
    if (!fs.existsSync(filePath)) return false;

    let fileContent = fs.readFileSync(filePath, 'utf-8');

    const crateIndex = fileContent.indexOf(`id: "${targetCrateId}"`);
    if (crateIndex === -1) return false;

    const minifigsIndex = fileContent.indexOf('minifigs: [', crateIndex);
    if (minifigsIndex === -1) return false;

    const openBracketIndex = minifigsIndex + 'minifigs: '.length;
    const closingBracketIndex = findMatchingClosingBracket(fileContent, openBracketIndex);

    if (closingBracketIndex === -1) return false;

    const entryString = `{ id: "${id}", name: "${name}", rarity: RARITIES.${rarityKey}.name, value: ${value}, image: "${image}" }`;

    const contentBeforeClosing = fileContent.slice(openBracketIndex + 1, closingBracketIndex).trimEnd();
    const needsComma = contentBeforeClosing.trim().length > 0;

    let updatedContent = "";
    if (needsComma) {
        updatedContent = fileContent.slice(0, openBracketIndex + 1) +
            contentBeforeClosing + ",\n" +
            '                    ' + entryString + "\n                " +
            fileContent.slice(closingBracketIndex);
    } else {
        updatedContent = fileContent.slice(0, openBracketIndex + 1) +
            "\n                    " + entryString + "\n                " +
            fileContent.slice(closingBracketIndex);
    }

    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    return true;
}

startBuilder();