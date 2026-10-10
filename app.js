// ==========================================
// APP LOGIC (3 SAVE SLOTS, LORE EMAILS, PC APP & BANK SYSTEM)
// ==========================================
const STARTING_COINS = 550; // Starting balance - change only here
let currentSlot = null;
let userCoins = STARTING_COINS;
let selectedCrate = null;
let isSpinning = false;
let userVault = [];
let readEmails = [];
let slotCreatedDate = null;

// Bank / multi-loan system state
let activeLoans = [];

// Collector offers (random buy requests) system
let activeOffers = [];
let activeMultiOffers = [];
let vaultAddCounter = 0;
const OFFERS_REFRESH_INTERVAL = 20; // Offers refresh every 20 vault additions (crate/bundle pulls)
const ACTIVE_OFFERS_COUNT = 5;
const ACTIVE_MULTI_OFFERS_COUNT = 3;
// Daily login / streak system
let dailyStreak = {
    currentStreak: 0,
    longestStreak: 0,
    lastClaimDateUTC: null,   // "YYYY-MM-DD", trusted UTC date fetched from a time server
    lastClaimTimestamp: 0     // Epoch ms equivalent of the trusted timestamp
};
const DAILY_CLOCK_TOLERANCE_MS = 5 * 60 * 1000; // Tolerate up to 5 minutes of clock drift
const COLLECTOR_NAMES = ["Marcus", "Elena", "Jonas", "Priya", "Old Joe", "Whiskers", "Dana", "Theo", "Nour", "Sam"];

// Achievements / badges system
const ACHIEVEMENTS = [
    { id: 'first_spin', name: 'First Steps', desc: 'Open your first case.', icon: '📦', reward: 20 },
    { id: 'first_legendary', name: 'First Legendary', desc: 'Pull your first Legendary minifigure.', icon: '🌟', reward: 200 },
    { id: 'crates_50', name: 'Case Veteran', desc: 'Open 50 cases.', icon: '🎯', reward: 150 },
    { id: 'crates_100_no_bankrupt', name: 'Steady Hands', desc: 'Open 100 cases without ever going bankrupt.', icon: '🛡️', reward: 400 },
    { id: 'theme_master', name: 'Theme Master', desc: 'Complete every figure in an entire theme for the first time.', icon: '🧩', reward: 150 },
    { id: 'first_offer', name: 'Deal Maker', desc: 'Fulfill your first Collector Offer.', icon: '🤝', reward: 50 },
    { id: 'first_multi_offer', name: 'Set Complete', desc: 'Fulfill your first Multi-Figure Offer.', icon: '🧩', reward: 100 },
    { id: 'streak_7', name: 'Weekly Regular', desc: 'Reach a 7-day login streak.', icon: '🔥', reward: 100 },
    { id: 'vault_10k', name: 'High Roller', desc: "Your vault's current value reaches $10,000.", icon: '💎', reward: 250 },
    { id: 'master_salesman', name: 'Master Salesman', desc: 'Sell an item at BrickBid Live for 30%+ above market value.', icon: '💰', reward: 300 }
];

let unlockedAchievements = [];

// Theme Mastery system: owning every figure in a theme grants that theme's
// figures a permanent value bonus.
let completedThemeBonuses = {}; // { "themeName (lowercase)": true } - which themes are fully completed
let themeBoostedBaseValues = {}; // { figId: new permanent base value }, overrides the original value
let hasCompletedAnyTheme = false; // Used to unlock the 'theme_master' achievement
const THEME_COMPLETION_BONUS = 0.10; // 10% permanent value increase
let totalCratesOpened = 0;
let hasGoneBankrupt = false;
let offersFulfilledCount = 0;
let multiOffersFulfilledCount = 0;

// Showcase system: cosmetic, non-sellable display, unlimited slots
let showcaseItems = []; // List of minifig ids

// BrickBid Live auction system
const AUCTION_EXCLUSIVE_ITEMS = [
    { id: 'auction-moc-001', name: 'Custom MOC: Golden Falcon Pilot', theme: 'Exclusive', rarity: 'Legendary', value: 1800, image: 'https://img.bricklink.com/ItemImage/MN/0/sw0158.png' },
    { id: 'auction-proto-001', name: 'Ultra Rare Prototype: Chrome Vader', theme: 'Exclusive', rarity: 'Legendary', value: 2200, image: 'https://img.bricklink.com/ItemImage/MN/0/sw1112.png' },
    { id: 'auction-moc-002', name: 'Custom MOC: Neon Ninja Kai', theme: 'Exclusive', rarity: 'Legendary', value: 1500, image: 'https://img.bricklink.com/ItemImage/MN/0/njo0007.png' }
];

const AUCTION_BOT_DEFS = [
    { id: 'brickbaron99', name: 'BrickBaron99', type: 'smart_whale' },
    { id: 'dealseeker', name: 'DealSeeker', type: 'bargain_hunter' },
    { id: 'latecomer', name: 'LateComer', type: 'soft_sniper' },
    { id: 'themeenthusiast', name: 'ThemeEnthusiast', type: 'collector' },
    { id: 'hypecollector', name: 'HypeCollector', type: 'emotional' },
    { id: 'bigstep', name: 'BigStep', type: 'intimidator' },
    { id: 'quantscollector', name: 'QuantsCollector', type: 'rational' },
    { id: 'flipmaster', name: 'FlipMaster', type: 'reseller' },
    { id: 'cautiouscam', name: 'CautiousCam', type: 'hesitant' },
    { id: 'luckydice', name: 'LuckyDice', type: 'wildcard' }
];

const AUCTION_TRIGGER_MIN = 25;
const AUCTION_TRIGGER_MAX = 30;
const AUCTION_INVITE_WINDOW_MS = 2 * 60 * 1000; // 2 real-time minutes
const AUCTION_ROUND_SECONDS = 20;
const AUCTION_ANTISNIPE_THRESHOLD = 3;
const AUCTION_ANTISNIPE_EXTENSION = 3;

function randomAuctionThreshold() {
    return AUCTION_TRIGGER_MIN + Math.floor(Math.random() * (AUCTION_TRIGGER_MAX - AUCTION_TRIGGER_MIN + 1));
}

let auctionAddCounter = 0;
let auctionTriggerThreshold = randomAuctionThreshold();
let pendingAuctionInvite = null; // { item, expiresAt }
let currentAuction = null;
let auctionTickInterval = null;
let inviteCountdownInterval = null;
let auctionSellSelectedItem = null;
let bestAuctionSaleMultiplier = 0;

// Collector Market (price fluctuation) system
let marketMultipliers = {}; // { minifigId: multiplier } applied to base value, 1.0 = normal price
let marketAddCounter = 0;
const MARKET_TICK_INTERVAL = 15; // Market updates every 15 vault additions
const MARKET_MIN_MULTIPLIER = 0.55;
const MARKET_MAX_MULTIPLIER = 2.2;

// Market state machine - each theme tracks its own current state.
// upChance: probability the price moves up on a given tick.
// magnitude: [min, max] range for the size of the move (e.g. 0.03 = 3%).
const MARKET_STATES = {
    bullish: { upChance: 0.70, magnitude: [0.04, 0.07] },   // Uptrend
    bearish: { upChance: 0.30, magnitude: [0.04, 0.07] },   // Downtrend
    stable: { upChance: 0.50, magnitude: [0.015, 0.03] },   // Flat, low volatility
    volatile: { upChance: 0.50, magnitude: [0.12, 0.20] }   // Choppy, large swings
};

// How many ticks a state lasts, rolled once when the state begins.
// volatile runs short (an intense but temporary swing), stable runs longer
// (a calmer stretch).
const MARKET_STATE_DURATIONS = {
    bullish: [4, 7],
    bearish: [4, 7],
    stable: [5, 9],
    volatile: [2, 4]
};

// Supply/demand pressure - the player's own buy/sell behavior affects price.
// Selling a figure repeatedly (oversupply) pushes its price down; acquiring
// and holding it (scarcity/demand) pushes its price up.
let itemSupplyPressure = {}; // { figId: pressure value (+ sell pressure, - scarcity pressure) }
const SUPPLY_PRESSURE_PER_UNIT_SOLD = 1.0;
const SUPPLY_PRESSURE_PER_UNIT_ACQUIRED = -0.4;
const SUPPLY_PRESSURE_CLAMP = 12;
const SUPPLY_PRESSURE_IMPACT_PER_UNIT = 0.015; // ~1.5% impact per tick per unit of pressure
const SUPPLY_PRESSURE_DECAY = 0.85; // Pressure decays 15% per tick, gradually returning to normal

let themeMarketStates = {}; // { themeKeyLowercase: { state, ticksInState, duration } }
let hasSentMarketIntroEmail = false; // One-time intro email sent the first time the market activates

function pickRandomMarketState() {
    const keys = Object.keys(MARKET_STATES);
    return keys[Math.floor(Math.random() * keys.length)];
}

// Picks a random duration (in ticks) from MARKET_STATE_DURATIONS for the given state.
function pickStateDuration(state) {
    const range = MARKET_STATE_DURATIONS[state] || [4, 7];
    return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

function addSupplyPressure(figId, amount) {
    if (!figId) return;
    itemSupplyPressure[figId] = (itemSupplyPressure[figId] || 0) + amount;
}

function getSupplyPressureModifier(figId) {
    const pressure = itemSupplyPressure[figId] || 0;
    const clamped = Math.max(-SUPPLY_PRESSURE_CLAMP, Math.min(SUPPLY_PRESSURE_CLAMP, pressure));
    return -clamped * SUPPLY_PRESSURE_IMPACT_PER_UNIT;
}

const LOAN_OPTIONS = [
    { id: 'short', name: 'Short Term', duration: 10, principal: 500, interestRate: 0.15 },
    { id: 'medium', name: 'Mid Term', duration: 20, principal: 1200, interestRate: 0.25 },
    { id: 'long', name: 'Long Term', duration: 40, principal: 2500, interestRate: 0.40 }
];

// MARKETPLACE MYSTERY BUNDLE TANIMLARI
// Mystery bundle pricing. EV/price ratio increases with pack size (0.82 at
// 3-figure up to 0.87 at 30-figure), so larger packs are a genuinely better
// deal, while every tier still keeps a house edge (EV stays below price).
const MYSTERY_BUNDLES = [
    { id: 'bundle_3', name: '3-Figure Mystery Pack', count: 3, price: 65 },
    { id: 'bundle_5', name: '5-Figure Mystery Pack', count: 5, price: 105 },
    { id: 'bundle_10', name: '10-Figure Mystery Pack', count: 10, price: 210 },
    { id: 'bundle_15', name: '15-Figure Mystery Pack', count: 15, price: 310 },
    { id: 'bundle_20', name: '20-Figure Mystery Pack', count: 20, price: 410 },
    { id: 'bundle_30', name: '30-Figure Mystery Pack', count: 30, price: 610 }
];

// Inventory sort state
let currentSortMode = 'collecting';

const rarityWeights = {
    'legendary': 4,
    'epic': 3,
    'rare': 2,
    'common': 1
};

// Determines the reveal order for pack openings: most common first,
// rarest (legendary) last, for a classic "suspense" build-up.
const RARITY_REVEAL_ORDER = { 'common': 0, 'rare': 1, 'epic': 2, 'legendary': 3 };

// GAME LORE EMAILS
const GAME_EMAILS = [
    {
        id: "email_welcome",
        sender: "Uncle Bricks",
        email: "bricks.uncle@minifigvault.com",
        subject: "Welcome to the Collector's World!",
        body: `Kid,\n\nWelcome to your new Minifigure Vault! I heard you've decided to step into the world of rare minifigure trading.\n\nHere's $${STARTING_COINS} to get you started. Buy blind boxes, collect rare figures, and sell what you don't need to rebuild your capital. But beware: letting your overdue loans accumulate will drive you straight into bankruptcy!\n\nGood luck,\nUncle Bricks`
    },
    {
        id: "email_rumors",
        sender: "Collector Network",
        email: "news@collectorsnet.org",
        subject: "Market Intel: Rare Drop Rates",
        body: `Attention Collector,\n\nWe've received reports that certain blind boxes hold legendary minifigures with drop chances as low as 2%. \n\nIf you land a Legendary or Epic figure, holding onto it increases your overall Vault value dramatically. However, selling them early can give you the financial boost needed to sweep through whole cases.\n\nChoose your investments wisely!`
    }
];

// Silinemeyen temel maillerin ID'leri
const PROTECTED_EMAIL_IDS = ["email_welcome", "email_rumors", "email_milestone_25k", "email_milestone_50k", "email_milestone_75k"];

function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- LOCALSTORAGE SAVE & LOAD SYSTEM ---

function getSlotKey(slotNum) {
    return `sw_cmf_slot_${slotNum || currentSlot}`;
}

function saveGameData() {
    if (!currentSlot) return;

    const gameData = {
        coins: userCoins,
        vault: userVault,
        readEmails: readEmails,
        createdDate: slotCreatedDate,
        activeLoans: activeLoans,
        gameEmails: GAME_EMAILS,
        offers: activeOffers,
        multiOffers: activeMultiOffers,
        vaultAddCounter: vaultAddCounter,
        marketMultipliers: marketMultipliers,
        themeMarketStates: themeMarketStates,
        hasSentMarketIntroEmail: hasSentMarketIntroEmail,
        itemSupplyPressure: itemSupplyPressure,
        marketAddCounter: marketAddCounter,
        dailyStreak: dailyStreak,
        unlockedAchievements: unlockedAchievements,
        totalCratesOpened: totalCratesOpened,
        hasGoneBankrupt: hasGoneBankrupt,
        offersFulfilledCount: offersFulfilledCount,
        multiOffersFulfilledCount: multiOffersFulfilledCount,
        showcaseSlots: showcaseItems,
        auctionAddCounter: auctionAddCounter,
        auctionTriggerThreshold: auctionTriggerThreshold,
        pendingAuctionInvite: pendingAuctionInvite,
        bestAuctionSaleMultiplier: bestAuctionSaleMultiplier,
        currentAuction: currentAuction,
        completedThemeBonuses: completedThemeBonuses,
        themeBoostedBaseValues: themeBoostedBaseValues,
        hasCompletedAnyTheme: hasCompletedAnyTheme
    };
    localStorage.setItem(getSlotKey(currentSlot), JSON.stringify(gameData));
    updateSlotUI();
    updateNotepadGoalUI();
}

function getSlotData(slotNum) {
    const savedData = localStorage.getItem(getSlotKey(slotNum));
    if (savedData) {
        try {
            return JSON.parse(savedData);
        } catch (e) {
            console.error("Slot verisi ayrıştırılamadı:", e);
        }
    }
    return { coins: STARTING_COINS, vault: [], readEmails: [], createdDate: getTodayDateString(), activeLoans: [], gameEmails: null, offers: [], multiOffers: [], vaultAddCounter: 0, marketMultipliers: {}, themeMarketStates: {}, itemSupplyPressure: {}, hasSentMarketIntroEmail: false, marketAddCounter: 0, dailyStreak: { currentStreak: 0, longestStreak: 0, lastClaimDateUTC: null, lastClaimTimestamp: 0 }, unlockedAchievements: [], totalCratesOpened: 0, hasGoneBankrupt: false, offersFulfilledCount: 0, multiOffersFulfilledCount: 0, showcaseSlots: [], auctionAddCounter: 0, auctionTriggerThreshold: null, pendingAuctionInvite: null, bestAuctionSaleMultiplier: 0, currentAuction: null, completedThemeBonuses: {}, themeBoostedBaseValues: {}, hasCompletedAnyTheme: false };
}

function loadGameData(slotNum) {
    const data = getSlotData(slotNum);
    userCoins = typeof data.coins === 'number' ? data.coins : STARTING_COINS;
    userVault = Array.isArray(data.vault) ? data.vault : [];
    readEmails = Array.isArray(data.readEmails) ? data.readEmails : [];
    slotCreatedDate = data.createdDate || getTodayDateString();

    GAME_EMAILS.length = 0;
    GAME_EMAILS.push(
        {
            id: "email_welcome",
            sender: "Uncle Bricks",
            email: "bricks.uncle@minifigvault.com",
            subject: "Welcome to the Collector's World!",
            body: `Kid,\n\nWelcome to your new Minifigure Vault! I heard you've decided to step into the world of rare minifigure trading.\n\nHere's $${STARTING_COINS} to get you started. Buy blind boxes, collect rare figures, and sell what you don't need to rebuild your capital. But beware: letting your overdue loans accumulate will drive you straight into bankruptcy!\n\nGood luck,\nUncle Bricks`
        },
        {
            id: "email_rumors",
            sender: "Collector Network",
            email: "news@collectorsnet.org",
            subject: "Market Intel: Rare Drop Rates",
            body: `Attention Collector,\n\nWe've received reports that certain blind boxes hold legendary minifigures with drop chances as low as 2%. \n\nIf you land a Legendary or Epic figure, holding onto it increases your overall Vault value dramatically. However, selling them early can give you the financial boost needed to sweep through whole cases.\n\nChoose your investments wisely!`
        }
    );

    if (Array.isArray(data.gameEmails)) {
        data.gameEmails.forEach(savedMail => {
            if (savedMail.id !== "email_welcome" && !GAME_EMAILS.some(e => e.id === savedMail.id)) {
                GAME_EMAILS.push(savedMail);
            }
        });
    }

    if (Array.isArray(data.activeLoans)) {
        activeLoans = data.activeLoans;
    } else if (data.activeLoan) {
        activeLoans = [data.activeLoan];
    } else {
        activeLoans = [];
    }

    activeOffers = Array.isArray(data.offers) ? data.offers : [];
    activeMultiOffers = Array.isArray(data.multiOffers) ? data.multiOffers : [];
    vaultAddCounter = typeof data.vaultAddCounter === 'number' ? data.vaultAddCounter : 0;
    if (activeOffers.length === 0) {
        activeOffers = generateOffers();
    }
    if (activeMultiOffers.length === 0) {
        activeMultiOffers = generateMultiOffers();
    }
    renderOffersApp();
    renderMultiOffersApp();

    marketMultipliers = (data.marketMultipliers && typeof data.marketMultipliers === 'object') ? data.marketMultipliers : {};
    themeMarketStates = (data.themeMarketStates && typeof data.themeMarketStates === 'object') ? data.themeMarketStates : {};
    itemSupplyPressure = (data.itemSupplyPressure && typeof data.itemSupplyPressure === 'object') ? data.itemSupplyPressure : {};
    hasSentMarketIntroEmail = !!data.hasSentMarketIntroEmail;
    marketAddCounter = typeof data.marketAddCounter === 'number' ? data.marketAddCounter : 0;
    initMarketMultipliers();
    renderMarketApp();

    dailyStreak = (data.dailyStreak && typeof data.dailyStreak === 'object') ? {
        currentStreak: data.dailyStreak.currentStreak || 0,
        longestStreak: data.dailyStreak.longestStreak || 0,
        lastClaimDateUTC: data.dailyStreak.lastClaimDateUTC || null,
        lastClaimTimestamp: data.dailyStreak.lastClaimTimestamp || 0
    } : { currentStreak: 0, longestStreak: 0, lastClaimDateUTC: null, lastClaimTimestamp: 0 };

    unlockedAchievements = Array.isArray(data.unlockedAchievements) ? data.unlockedAchievements : [];
    totalCratesOpened = typeof data.totalCratesOpened === 'number' ? data.totalCratesOpened : 0;
    hasGoneBankrupt = !!data.hasGoneBankrupt;
    offersFulfilledCount = typeof data.offersFulfilledCount === 'number' ? data.offersFulfilledCount : 0;
    multiOffersFulfilledCount = typeof data.multiOffersFulfilledCount === 'number' ? data.multiOffersFulfilledCount : 0;
    renderAchievementsApp();

    if (Array.isArray(data.showcaseSlots)) {
        // Legacy saves used a fixed 6-slot array padded with nulls;
        // filter those out into a plain list.
        showcaseItems = data.showcaseSlots.filter(id => !!id);
    } else {
        showcaseItems = [];
    }
    renderShowcaseApp();

    auctionAddCounter = typeof data.auctionAddCounter === 'number' ? data.auctionAddCounter : 0;
    auctionTriggerThreshold = typeof data.auctionTriggerThreshold === 'number' ? data.auctionTriggerThreshold : randomAuctionThreshold();
    pendingAuctionInvite = (data.pendingAuctionInvite && data.pendingAuctionInvite.expiresAt > Date.now()) ? data.pendingAuctionInvite : null;
    bestAuctionSaleMultiplier = typeof data.bestAuctionSaleMultiplier === 'number' ? data.bestAuctionSaleMultiplier : 0;

    // If a live SELL auction was mid-flight when the game closed, return
    // the escrowed item safely to the vault so it isn't lost.
    if (data.currentAuction && data.currentAuction.mode === 'sell' && data.currentAuction.item) {
        addToVault({ ...data.currentAuction.item }, false);
    }
    currentAuction = null; // Live auction state is never restored; always reset on load
    renderAuctionApp();

    completedThemeBonuses = (data.completedThemeBonuses && typeof data.completedThemeBonuses === 'object') ? data.completedThemeBonuses : {};
    themeBoostedBaseValues = (data.themeBoostedBaseValues && typeof data.themeBoostedBaseValues === 'object') ? data.themeBoostedBaseValues : {};
    hasCompletedAnyTheme = !!data.hasCompletedAnyTheme;

    updateNotepadGoalUI();
    renderStatisticsApp();
}

// $75k win condition and the "Finish Game" button on the Notepad app
function updateNotepadGoalUI() {
    const progressText = document.getElementById('goal-progress-text');
    const progressBar = document.getElementById('goal-progress-bar');
    if (!progressText || !progressBar) return;

    const currentBalance = userCoins;
    const target = 75000;

    let percentage = (currentBalance / target) * 100;
    if (percentage > 100) percentage = 100;
    if (percentage < 0) percentage = 0;

    progressText.textContent = `$${currentBalance.toLocaleString()} / $75,000`;
    progressBar.style.width = `${percentage}%`;

    let finishGameBtn = document.getElementById('notepad-finish-game-btn');
    const notepadContainer = progressText.closest('.notepad-container') || progressText.parentElement;

    if (!finishGameBtn && notepadContainer) {
        finishGameBtn = document.createElement('button');
        finishGameBtn.id = 'notepad-finish-game-btn';
        finishGameBtn.textContent = 'Purchase all needed things and make your Mom happy!!!';
        finishGameBtn.style.cssText = 'width: 100%; margin-top: 15px; padding: 12px; font-weight: bold; border-radius: 8px; border: none; transition: all 0.3s; font-size: 0.95rem;';
        notepadContainer.appendChild(finishGameBtn);
    }

    if (finishGameBtn) {
        finishGameBtn.onclick = triggerWinGame;

        if (currentBalance >= target) {
            finishGameBtn.disabled = false;
            finishGameBtn.removeAttribute('disabled');
            finishGameBtn.style.opacity = '1';
            finishGameBtn.style.cursor = 'pointer';
            finishGameBtn.style.background = '#2ecc71';
            finishGameBtn.style.color = '#ffffff';
        } else {
            finishGameBtn.disabled = true;
            finishGameBtn.setAttribute('disabled', 'true');
            finishGameBtn.style.opacity = '0.5';
            finishGameBtn.style.cursor = 'not-allowed';
            finishGameBtn.style.background = '#64748b';
            finishGameBtn.style.color = '#cbd5e1';
        }
    }
}

function triggerWinGame() {
    if (userCoins < 75000) return;

    if (activeLoans && activeLoans.length > 0) {
        const totalDebt = activeLoans.reduce((sum, loan) => sum + loan.totalRepay, 0);

        showGameAlert(
            "The debt has not been paid!",
            `To buy the things you want, you need to pay off your debts first!<br><br>Total Remaning Debt: <strong>$${totalDebt}</strong><br><br>Please pay your bills through the Bank app.`
        );

        const bankTabBtn = document.querySelector('[data-app="bank-app"]');
        if (bankTabBtn) bankTabBtn.click();

        return;
    }

    // Play the win jingle
    playSound(sounds.gameWin);

    const pcModal = document.getElementById('pc-modal');
    if (pcModal) pcModal.style.display = 'none';

    const winModal = document.getElementById('win-modal');
    if (winModal) {
        const winTitle = winModal.querySelector('.win-title');
        const winText = winModal.querySelector('p');
        if (winTitle) winTitle.textContent = "YOU HAVE SUCCEEDED!!!";
        if (winText) winText.textContent = "Congratulations! You’ve successfully saved $75,000 without going into debt. Now you can pay for your mom’s surgery, send her on vacation, and help her open the bookstore of her dreams!";

        winModal.style.display = 'flex';
    }
}

// --- In-game custom alert and confirm modals (replacing native browser dialogs) ---

function showGameAlert(title, message, titleColor = '#e74c3c') {
    let alertModal = document.getElementById('game-custom-alert-modal');

    if (!alertModal) {
        alertModal = document.createElement('div');
        alertModal.id = 'game-custom-alert-modal';
        alertModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
            display: flex; justify-content: center; align-items: center; z-index: 9999;
        `;

        alertModal.innerHTML = `
            <div style="background: #1e293b; border: 1px solid rgba(255,255,255,0.15); padding: 25px; border-radius: 12px; width: 380px; max-height: 85vh; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); color: #f8fafc; display: flex; flex-direction: column; box-sizing: border-box;">
                <h3 id="custom-alert-title" style="margin-top: 0; margin-bottom: 12px; font-size: 1.2rem; flex-shrink: 0;"></h3>
                <p id="custom-alert-text" style="font-size: 0.95rem; line-height: 1.5; color: #cbd5e1; margin-bottom: 20px; overflow-y: auto; flex: 1 1 auto; min-height: 0;"></p>
                <button id="custom-alert-close-btn" class="btn btn-primary" style="width: 100%; padding: 10px; font-weight: bold; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; flex-shrink: 0;">Okay</button>
            </div>
        `;
        document.body.appendChild(alertModal);

        document.getElementById('custom-alert-close-btn').addEventListener('click', () => {
            alertModal.style.display = 'none';
        });
    }

    const titleEl = document.getElementById('custom-alert-title');
    titleEl.textContent = title;
    titleEl.style.color = titleColor;

    document.getElementById('custom-alert-text').innerHTML = message;
    alertModal.style.display = 'flex';
}

function showGameConfirm(title, message, onConfirm) {
    let confirmModal = document.getElementById('game-custom-confirm-modal');

    if (!confirmModal) {
        confirmModal = document.createElement('div');
        confirmModal.id = 'game-custom-confirm-modal';
        confirmModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
            display: flex; justify-content: center; align-items: center; z-index: 9999;
        `;

        confirmModal.innerHTML = `
            <div style="background: #1e293b; border: 1px solid rgba(255,255,255,0.15); padding: 25px; border-radius: 12px; width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); color: #f8fafc;">
                <h3 id="custom-confirm-title" style="margin-top: 0; margin-bottom: 12px; font-size: 1.2rem; color: #f1c40f;"></h3>
                <p id="custom-confirm-text" style="font-size: 0.95rem; line-height: 1.5; color: #cbd5e1; margin-bottom: 20px;"></p>
                <div style="display: flex; gap: 10px;">
                    <button id="custom-confirm-cancel-btn" style="flex: 1; padding: 10px; font-weight: bold; background: #64748b; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button id="custom-confirm-ok-btn" style="flex: 1; padding: 10px; font-weight: bold; background: #e74c3c; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Okay</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);
    }

    document.getElementById('custom-confirm-title').textContent = title;
    document.getElementById('custom-confirm-text').innerHTML = message;

    const okBtn = document.getElementById('custom-confirm-ok-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

    const handleOk = () => {
        confirmModal.style.display = 'none';
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        if (onConfirm) onConfirm();
    };

    const handleCancel = () => {
        confirmModal.style.display = 'none';
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);

    confirmModal.style.display = 'flex';
}

function updateSlotUI() {
    for (let i = 1; i <= 3; i++) {
        const data = getSlotData(i);
        const infoEl = document.getElementById(`slot-${i}-info`);
        if (infoEl) {
            const slotThemeBoosts = (data.themeBoostedBaseValues && typeof data.themeBoostedBaseValues === 'object') ? data.themeBoostedBaseValues : {};
            const vaultVal = (data.vault || []).reduce((acc, item) => {
                const effectiveValue = (slotThemeBoosts[item.id] !== undefined) ? slotThemeBoosts[item.id] : item.value;
                return acc + (effectiveValue * item.count);
            }, 0);
            infoEl.innerHTML = `
                <p>Coins: <strong>$${data.coins}</strong></p>
                <p>Vault Value: <strong>$${vaultVal}</strong></p>
                <p>Items: <strong>${(data.vault || []).reduce((acc, item) => acc + item.count, 0)}</strong></p>
            `;
        }
    }
}

function selectSaveSlot(slotNum) {
    currentSlot = slotNum;
    loadGameData(currentSlot);
    saveGameData();

    const slotModal = document.getElementById('slot-modal');
    if (slotModal) slotModal.style.display = 'none';

    updateVaultUI();
    checkSpinButton();
    renderEmailList();
    updateEmailBadge();
    renderBankApp();
    updateNotepadGoalUI();

    if (typeof CRATES !== 'undefined' && CRATES.length > 0) {
        selectCrate(CRATES[0]);
    }

    checkGameState();

    // The daily login reward is only checked here, once the player has
    // actually opened a save slot to play (not during management flows
    // like deleting or importing a save).
    checkDailyLoginReward();
}

function deleteSaveSlot(slotNum) {
    showGameConfirm(
        "Deleting Current Save",
        `Are you sure you want to clear the data stored in slot ${slotNum}? This action cannot be undone!`,
        () => {
            localStorage.removeItem(getSlotKey(slotNum));
            updateSlotUI();
            if (currentSlot === slotNum) {
                loadGameData(slotNum);
                updateVaultUI();
                checkSpinButton();
                renderEmailList();
                updateEmailBadge();
                renderBankApp();
                updateNotepadGoalUI();
            }
        }
    );
}

// --- Save export / import (reduces reliance on localStorage) ---

let pendingImportSlot = null;

function exportSaveSlot(slotNum) {
    const raw = localStorage.getItem(getSlotKey(slotNum));
    if (!raw) {
        showGameAlert("Nothing to Export", `Slot ${slotNum} is empty, there's no save data to export yet.`);
        return;
    }

    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cmf_save_slot${slotNum}_${getTodayDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function triggerImportSlot(slotNum) {
    pendingImportSlot = slotNum;
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.value = ''; // Reset so the same file can be reselected
        fileInput.click();
    }
}

function handleImportFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    const targetSlot = pendingImportSlot;
    pendingImportSlot = null;

    if (!file || !targetSlot) return;

    const reader = new FileReader();
    reader.onload = () => {
        let parsed;
        try {
            parsed = JSON.parse(reader.result);
        } catch (e) {
            showGameAlert("Invalid File", "This doesn't look like a valid save file (not valid JSON).");
            return;
        }

        // Minimal validation: the core fields we expect must be present
        if (typeof parsed.coins !== 'number' || !Array.isArray(parsed.vault)) {
            showGameAlert("Invalid Save File", "This file doesn't match the expected save format.");
            return;
        }

        showGameConfirm(
            "Overwrite Save Slot?",
            `This will completely overwrite the current data in Slot ${targetSlot}. This cannot be undone. Continue?`,
            () => {
                localStorage.setItem(getSlotKey(targetSlot), JSON.stringify(parsed));
                updateSlotUI();

                if (currentSlot === targetSlot) {
                    loadGameData(targetSlot);
                    updateVaultUI();
                    checkSpinButton();
                    renderEmailList();
                    updateEmailBadge();
                    renderBankApp();
                    updateNotepadGoalUI();
                    checkGameState();
                }

                showGameAlert("Import Successful", `Slot ${targetSlot} has been restored from the imported file.`);
            }
        );
    };
    reader.onerror = () => {
        showGameAlert("Read Error", "The selected file could not be read.");
    };
    reader.readAsText(file);
}

function returnToSlotSelection() {
    currentSlot = null;
    const winModal = document.getElementById('win-modal');
    const gameOverModal = document.getElementById('game-over-modal');
    if (winModal) winModal.style.display = 'none';
    if (gameOverModal) gameOverModal.style.display = 'none';

    updateSlotUI();
    const slotModal = document.getElementById('slot-modal');
    if (slotModal) slotModal.style.display = 'flex';
}

function resetCurrentSlot() {
    if (currentSlot) {
        localStorage.removeItem(getSlotKey(currentSlot));
        selectSaveSlot(currentSlot);
        const gameOverModal = document.getElementById('game-over-modal');
        if (gameOverModal) gameOverModal.style.display = 'none';
    }
}


// --- MARKETPLACE MYSTERY BUNDLE LOGIC  ---

function buyMysteryBundle(bundleId) {
    const bundle = MYSTERY_BUNDLES.find(b => b.id === bundleId);
    if (!bundle) return;

    if (userCoins < bundle.price) {
        showGameAlert("Insufficient Funds", `You need $${bundle.price} to buy this mystery bundle!`);
        return;
    }

    if (typeof MINIFIG_DATABASE === 'undefined' || MINIFIG_DATABASE.length === 0) {
        showGameAlert("Error", "Minifigure database not found!");
        return;
    }

    userCoins -= bundle.price;

    const marketplaceWeights = { 'common': 70, 'rare': 22, 'epic': 7.6, 'legendary': 0.4 };

    const wonMinifigs = [];
    for (let i = 0; i < bundle.count; i++) {
        const randomFig = pickWeightedMinifig(MINIFIG_DATABASE, marketplaceWeights);
        wonMinifigs.push(randomFig);
        addToVault(randomFig, false);
    }

    processLoanVaultTick();
    saveGameData();
    updateVaultUI();
    checkSpinButton();
    checkGameState();

    // Compute the total value of the pulled minifigures and the net profit
    const totalValue = wonMinifigs.reduce((sum, f) => sum + getEffectiveBaseValue(f), 0);
    const netProfit = totalValue - bundle.price;

    // For suspense, sort from most common to rarest so the best
    // pull is revealed last.
    const sortedForReveal = [...wonMinifigs].sort((a, b) => {
        const orderA = RARITY_REVEAL_ORDER[a.rarity.toLowerCase()] ?? 0;
        const orderB = RARITY_REVEAL_ORDER[b.rarity.toLowerCase()] ?? 0;
        return orderA - orderB;
    });

    startBundleRevealSequence(bundle.name, sortedForReveal, bundle.price, totalValue, netProfit);
}

function startBundleRevealSequence(bundleName, sortedMinifigs, pricePaid, totalValue, netProfit) {
    const modal = document.getElementById('bundle-reveal-modal');
    const progressEl = document.getElementById('bundle-reveal-progress');
    const cardEl = document.getElementById('bundle-reveal-card');
    const imgEl = document.getElementById('bundle-reveal-img');
    const nameEl = document.getElementById('bundle-reveal-name');
    const rarityEl = document.getElementById('bundle-reveal-rarity');
    const valueEl = document.getElementById('bundle-reveal-value');
    const autoBtn = document.getElementById('bundle-reveal-auto-btn');
    const hintEl = document.getElementById('bundle-reveal-hint');

    const singleView = document.getElementById('bundle-reveal-single-view');
    const overviewView = document.getElementById('bundle-reveal-overview-view');
    const overviewGrid = document.getElementById('bundle-reveal-overview-grid');
    const continueBtn = document.getElementById('bundle-reveal-continue-btn');
    const overviewBox = document.getElementById('bundle-reveal-box');

    if (!modal || sortedMinifigs.length === 0) {
        // Fall back to the old behavior if the modal isn't found, so the flow isn't interrupted.
        showBundleResultModal(bundleName, sortedMinifigs, pricePaid, totalValue, netProfit);
        return;
    }

    let index = 0;
    let revealTimer = null;
    let isAutoMode = false;
    let revealFinished = false;
    const stepDelay = 850;

    function updateAutoBtn() {
        autoBtn.textContent = isAutoMode ? '⏸ Stop Auto Open' : '▶ Auto Open';
        hintEl.textContent = isAutoMode ? 'Opening automatically...' : 'Click to reveal the next one';
    }

    function renderStep() {
        const fig = sortedMinifigs[index];
        const rarityLower = fig.rarity.toLowerCase();

        progressEl.textContent = `${index + 1} / ${sortedMinifigs.length}`;

        cardEl.className = `minifig-card bundle-reveal-card rarity-${rarityLower}`;
        // Reset the animation via a reflow trick so the same class can retrigger it
        void cardEl.offsetWidth;
        cardEl.classList.add('pop-in');

        imgEl.src = fig.image;
        imgEl.alt = fig.name;
        nameEl.textContent = fig.name;
        rarityEl.textContent = fig.rarity;
        rarityEl.className = `rarity-badge rarity-${rarityLower}`;
        valueEl.textContent = `$${getEffectiveBaseValue(fig)}`;

        playWinSoundByRarity(fig.rarity);

        // If auto mode is on, automatically advance to the next figure
        if (isAutoMode && index < sortedMinifigs.length - 1) {
            revealTimer = setTimeout(advance, stepDelay);
        }
    }

    function blockSpaceKey(e) {
        if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
            e.preventDefault();
        }
    }

    // While the modal is open, prevent the spacebar from scrolling the
    // page or re-triggering a click on the focused button.
    document.addEventListener('keydown', blockSpaceKey);

    function closeAndCleanup() {
        modal.style.display = 'none';
        modal.onclick = null;
        autoBtn.onclick = null;
        continueBtn.onclick = null;
        overviewGrid.onclick = null;
        document.removeEventListener('keydown', blockSpaceKey);
    }

    function showOverview() {
        revealFinished = true;
        clearTimeout(revealTimer);

        // In the overview, sort rarest-first so the best pulls appear up top.
        const sortedForOverview = [...sortedMinifigs].sort((a, b) => {
            const orderA = RARITY_REVEAL_ORDER[a.rarity.toLowerCase()] ?? 0;
            const orderB = RARITY_REVEAL_ORDER[b.rarity.toLowerCase()] ?? 0;
            return orderB - orderA;
        });

        const count = sortedForOverview.length;

        // Column count and modal width scale with the item count, so a
        // crowded result (e.g. a 10-pack) still fits proportionally on
        // one screen.
        let columns, boxWidth, isCompact;
        if (count <= 4) {
            columns = count;
            boxWidth = 380;
            isCompact = false;
        } else if (count <= 6) {
            columns = 3;
            boxWidth = 420;
            isCompact = false;
        } else if (count <= 12) {
            columns = 4;
            boxWidth = 520;
            isCompact = true;
        } else {
            // Larger packs (15/20/30) use more columns; the grid also scrolls
            // vertically as a safeguard against overflow (see index.html / style.css).
            columns = 5;
            boxWidth = 600;
            isCompact = true;
        }

        overviewGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        overviewBox.style.width = `${boxWidth}px`;

        overviewGrid.innerHTML = sortedForOverview.map(fig => {
            const rarityLower = fig.rarity.toLowerCase();
            const compactClass = isCompact ? ' compact' : '';
            return `
                <div class="minifig-card bundle-overview-card${compactClass} rarity-${rarityLower}" data-fig-id="${fig.id}">
                    <img src="${fig.image}" alt="${fig.name}">
                    <div class="name">${fig.name}</div>
                    <div class="overview-value">$${getEffectiveBaseValue(fig)}</div>
                </div>
            `;
        }).join('');

        // Reuses the same inspect modal as regular vault minifigures, so the
        // player can click any figure here to see its detail/sell screen.
        overviewGrid.onclick = (e) => {
            e.stopPropagation();
            const card = e.target.closest('.bundle-overview-card');
            if (!card) return;
            const figId = card.dataset.figId;
            const vaultItem = userVault.find(v => v.id === figId);
            if (vaultItem) {
                openInspectModal(vaultItem, true);
            }
        };

        singleView.style.display = 'none';
        overviewView.style.display = 'block';
    }

    function advance() {
        clearTimeout(revealTimer);
        index++;
        if (index >= sortedMinifigs.length) {
            showOverview();
            return;
        }
        renderStep();
    }

    // Clicking the card/modal reveals the next figure (manual reveal is the
    // default). Once the overview screen is shown, stray clicks should do
    // nothing; only the "Continue" button advances the flow.
    modal.onclick = () => {
        if (!revealFinished) advance();
    };

    continueBtn.onclick = (e) => {
        e.stopPropagation();
        continueBtn.blur();
        closeAndCleanup();
        showBundleResultModal(bundleName, sortedMinifigs, pricePaid, totalValue, netProfit);
    };

    // Auto-reveal toggle button; stop propagation so it doesn't also
    // trigger the modal's own click handler (manual advance).
    autoBtn.onclick = (e) => {
        e.stopPropagation();
        isAutoMode = !isAutoMode;
        updateAutoBtn();
        if (isAutoMode && index < sortedMinifigs.length - 1) {
            clearTimeout(revealTimer);
            revealTimer = setTimeout(advance, stepDelay);
        } else {
            clearTimeout(revealTimer);
        }
        // If the button stayed focused, pressing spacebar could re-trigger
        // a click and toggle the mode unintentionally. Blur it to prevent that.
        autoBtn.blur();
    };

    singleView.style.display = 'block';
    overviewView.style.display = 'none';
    overviewBox.style.width = '380px';
    modal.style.display = 'flex';
    index = 0;
    isAutoMode = false;
    revealFinished = false;
    updateAutoBtn();
    renderStep();
}

function showBundleResultModal(bundleName, minifigs, cost, totalValue, netProfit) {
    // List of pulled figures
    let summaryText = minifigs.map(f => `<b style="color:#38ef7d;">${f.name}</b> (${f.rarity} - $${f.value})`).join('<br>');

    // Pick color and sign based on profit/loss
    const profitColor = netProfit >= 0 ? '#2ecc71' : '#e74c3c';
    const profitSign = netProfit >= 0 ? '+' : '-';
    const profitAbs = Math.abs(netProfit);

    const financialSummaryHTML = `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; margin-top: 15px; text-align: left; font-size: 0.9rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #cbd5e1;">
                <span>Pack Price:</span> <strong>$${cost}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #cbd5e1;">
                <span>Total Value:</span> <strong style="color: #38ef7d;">$${totalValue}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-weight: bold;">
                <span>Profit / Loss:</span> <span style="color: ${profitColor};">${profitSign}$${profitAbs}</span>
            </div>
        </div>
    `;

    showGameAlert(
        `${bundleName} Opened!`,
        `The following minifigures have been added to your Vault:<br><br>${summaryText}${financialSummaryHTML}`,
        netProfit >= 0 ? '#2ecc71' : '#f1c40f'
    );
}

// --- Bank / loan app logic ---

function renderBankApp() {
    const bankContainer = document.getElementById('bank-app-content');
    if (!bankContainer) return;

    let html = '';

    const currentLoans = activeLoans.filter(l => !l.isOverdue && l.remainingVaults > 0);
    const overdueLoans = activeLoans.filter(l => l.isOverdue || l.remainingVaults <= 0);

    const currentDebtTotal = currentLoans.reduce((sum, loan) => sum + loan.totalRepay, 0);
    const overdueDebtTotal = overdueLoans.reduce((sum, loan) => sum + loan.totalRepay, 0);

    if (activeLoans.length > 0) {
        html += `
            <div class="bank-status-card" style="margin-bottom: 24px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); padding: 18px; border-radius: 12px; width: 100%; box-sizing: border-box;">
                <h3 style="margin-bottom: 12px; font-size: 1.1rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">Active Loan Summary</h3>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 15px;">
                    <div style="background: rgba(241, 196, 15, 0.08); padding: 14px; border-radius: 8px; border: 1px solid rgba(241, 196, 15, 0.3);">
                        <small style="color: #f1c40f; font-weight: 600; text-transform: uppercase;">Active Debt</small>
                        <h2 style="color:#f1c40f; margin: 5px 0 0 0; font-size: 1.6rem;">$${currentDebtTotal}</h2>
                    </div>
                    <div style="background: rgba(231, 76, 60, 0.08); padding: 14px; border-radius: 8px; border: 1px solid rgba(231, 76, 60, 0.3);">
                        <small style="color: #e74c3c; font-weight: 600; text-transform: uppercase;">Overdue Debt (Max $6000)</small>
                        <h2 style="color:#e74c3c; margin: 5px 0 0 0; font-size: 1.6rem;">$${overdueDebtTotal} <span style="font-size: 0.9rem; color: #888;">/ $6000</span></h2>
                    </div>
                </div>

                <div class="active-loans-list">
        `;

        overdueLoans.forEach(loan => {
            const canAfford = userCoins >= loan.totalRepay;
            html += `
                <div class="bank-loan-item" style="background: rgba(231, 76, 60, 0.15); border: 1px solid #e74c3c; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <strong style="color: #e74c3c; font-size: 0.95rem;">[OVERDUE] ${loan.name}</strong>
                        <div style="font-size: 0.85rem; margin-top: 2px;">Principal: $${loan.amount} | Repayment: <strong style="color: #fff;">$${loan.totalRepay}</strong></div>
                        <small style="color: #ff7675; display: block; margin-top: 2px;">Delay: ${loan.overdueVaultCount || 0} Vault (+10% interest active)</small>
                    </div>
                    <button class="btn ${canAfford ? 'btn-primary' : 'btn-disabled'}" 
                            style="${!canAfford ? 'opacity:0.5; cursor:not-allowed;' : ''}" 
                            onclick="repayLoan('${loan.loanInstanceId}')">Pay Off ($${loan.totalRepay})</button>
                </div>
            `;
        });

        currentLoans.forEach(loan => {
            const canAfford = userCoins >= loan.totalRepay;
            html += `
                <div class="bank-loan-item" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <strong style="color: #38ef7d; font-size: 0.95rem;">[ACTIVE] ${loan.name}</strong>
                        <div style="font-size: 0.85rem; margin-top: 2px;">Principal: $${loan.amount} | Repayment: <strong style="color: #fff;">$${loan.totalRepay}</strong></div>
                        <small style="color: #f1c40f; display: block; margin-top: 2px;">Remaining: ${loan.remainingVaults} Vaults</small>
                    </div>
                    <button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary'}" 
                            style="${!canAfford ? 'opacity:0.6; cursor:not-allowed;' : ''}" 
                            onclick="repayLoan('${loan.loanInstanceId}')">Pay Off ($${loan.totalRepay})</button>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    html += '<h3 style="margin-bottom: 14px; font-size: 1.1rem; color: #f8fafc;">Available Loan Options</h3>';
    html += '<div class="bank-options-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px;">';

    LOAN_OPTIONS.forEach(option => {
        const totalRepay = Math.round(option.principal * (1 + option.interestRate));
        const activeCount = activeLoans.filter(l => l.id === option.id).length;

        html += `
            <div class="bank-loan-card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                        <h4 style="margin: 0; font-size: 1.05rem; color: #fff;">${option.name}</h4>
                        ${activeCount > 0 ? `<span style="background: rgba(241,196,15,0.2); color:#f1c40f; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Active (${activeCount})</span>` : ''}
                    </div>
                    <div style="font-size: 0.9rem; line-height: 1.6; color: #cbd5e1;">
                        <div style="display:flex; justify-content:space-between;"><span>Principal:</span> <strong style="color:#38ef7d;">+$${option.principal}</strong></div>
                        <div style="display:flex; justify-content:space-between;"><span>Repayment:</span> <strong style="color:#e74c3c;">$${totalRepay}</strong></div>
                        <div style="display:flex; justify-content:space-between;"><span>Duration:</span> <strong>${option.duration} Vaults</strong></div>
                        <div style="display:flex; justify-content:space-between;"><span>Interest Rate:</span> <strong>%${Math.round(option.interestRate * 100)}</strong></div>
                    </div>
                </div>
                <button class="btn btn-success" style="width: 100%; margin-top: 5px; background: #2ecc71; color: #fff; border: none; padding: 8px; border-radius: 6px; cursor: pointer;" onclick="takeLoan('${option.id}')">Take Loan</button>
            </div>
        `;
    });
    html += '</div>';

    bankContainer.innerHTML = html;
}

function takeLoan(loanId) {
    const option = LOAN_OPTIONS.find(l => l.id === loanId);
    if (!option) return;

    const totalRepay = Math.round(option.principal * (1 + option.interestRate));

    const newLoan = {
        loanInstanceId: 'loan_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        id: option.id,
        name: option.name,
        amount: option.principal,
        totalRepay: totalRepay,
        remainingVaults: option.duration,
        initialDuration: option.duration,
        isOverdue: false,
        overdueVaultCount: 0,
        warningSent: false
    };

    activeLoans.push(newLoan);
    userCoins += option.principal;

    saveGameData();
    updateVaultUI();
    checkSpinButton();
    renderBankApp();
    showGameAlert("Loan Approved", `The ${option.name} loan in the amount of $${option.principal} has been transferred to your account!`, '#2ecc71');
}

function repayLoan(loanInstanceId) {
    const index = activeLoans.findIndex(l => l.loanInstanceId === loanInstanceId);
    if (index === -1) return;

    const loan = activeLoans[index];

    if (userCoins < loan.totalRepay) {
        showGameAlert("Insufficient Balance", `You don't have enough funds to pay this bill! Required: $${loan.totalRepay}`);
        return;
    }

    userCoins -= loan.totalRepay;
    playSound(sounds.sell);
    activeLoans.splice(index, 1);

    saveGameData();
    updateVaultUI();
    checkSpinButton();
    renderBankApp();
    checkGameState();
    showGameAlert("The Debt Has Been Paid", "The selected loan has been successfully paid off!", '#2ecc71');
}

function processLoanVaultTick() {
    if (activeLoans.length === 0) return;

    activeLoans.forEach(loan => {
        if (!loan.isOverdue) {
            loan.remainingVaults -= 1;

            if (loan.remainingVaults === 5 && !loan.warningSent) {
                loan.warningSent = true;
                sendLoanWarningEmail(loan.name, loan.totalRepay, loan.remainingVaults);
            }

            if (loan.remainingVaults <= 0) {
                loan.isOverdue = true;
                loan.overdueVaultCount = 0;
            }
        } else {
            loan.overdueVaultCount += 1;

            if (loan.overdueVaultCount % 5 === 0) {
                const penalty = Math.round(loan.totalRepay * 0.10);
                loan.totalRepay += penalty;
                sendPenaltyEmail(loan.name, penalty, loan.totalRepay, loan.overdueVaultCount);
            }
        }
    });

    saveGameData();
    renderBankApp();
}

function sendLoanWarningEmail(loanName, amount, remaining) {
    const emailId = `loan_warning_${Date.now()}_${Math.random()}`;
    const warningEmail = {
        id: emailId,
        sender: "First National Brick Bank",
        email: "collections@brickbank.com",
        subject: `IMPORTANT: ${loanName} Loan Payment Reminder`,
        body: `Dear Customer,\n\n${loanName} There are only ${remaining} Vaults left until your loan matures!\n\nAmount to be repaid: $${amount}.\n\nFirst National Brick Bank`
    };

    addGameEmail(warningEmail, 'notification');
}

function sendPenaltyEmail(loanName, penaltyAmount, newTotal, overdueVaults) {
    const emailId = `loan_penalty_${Date.now()}_${Math.random()}`;
    const penaltyEmail = {
        id: emailId,
        sender: "First National Brick Bank",
        email: "collections@brickbank.com",
        subject: `NOTICE OF DEMAND: ${loanName} Notice of Late Payment Interest!`,
        body: `Dear Customer,\n\nYour unpaid ${loanName} loan has been overdue for ${overdueVaults} vaults. A 10% late payment interest (+$${penaltyAmount}) has been added to your debt.\nCurrent Balance: $${newTotal}.`
    };

    addGameEmail(penaltyEmail, 'notification');
}

// --- Milestone emails from Mom (25k / 50k / 75k) ---

const MILESTONE_EMAILS = [
    {
        id: "email_milestone_25k",
        amount: 25000,
        subject: "I wasn't supposed to see this, was I?",
        body: `Hey you,\n\nI wasn't going to say anything, but I saw the number on your screen the other day and I haven't been able to stop thinking about it.\n\n$25,000. From little plastic figures. I still don't fully understand how you do it, but I understand why. You don't have to keep doing this for me, you know that, right? But I also know you're going to keep going anyway, because that's exactly who you are.\n\nFor what it's worth: even just knowing you're trying this hard already means more to me than any trip could.\n\nLove you,\nMom`
    },
    {
        id: "email_milestone_50k",
        amount: 50000,
        subject: "I looked into it today",
        body: `Sweetheart,\n\nI did something today I've been putting off for a long time. I finally called and asked about the surgery. Actually asked, instead of just wondering "someday."\n\n$50,000 in your little vault, and here I am filling out real paperwork because of it. I had to stop halfway through the call because my hands were shaking a bit. Good shaking, I think.\n\nI don't say this enough, but I'm proud of you. Not just for the money. For not giving up on something most people would've quit after the first bad week.\n\nWe're getting close now.\n\nAll my love,\nMom`
    },
    {
        id: "email_milestone_75k",
        amount: 75000,
        requiresDebtFree: true, // Reaching 75k while still in debt isn't enough; wait until debt is cleared
        subject: "We actually did it",
        body: `My dear,\n\nI keep reading the number again just to make sure it's real. $75,000. The trip, the surgery, even a real shot at opening the little shop I used to only talk about at the kitchen table, all of it, because you sat there patiently trading tiny plastic figures until a dream became a plan.\n\nI want you to know something: no matter how this next chapter goes, what you did to get us here already changed something in me. You showed up for this family in a way I never expected and will never forget.\n\nThank you for believing this was possible before I did.\n\nWith everything I have,\nMom`
    }
];

function checkMilestoneEmails() {
    MILESTONE_EMAILS.forEach(milestone => {
        const alreadySent = GAME_EMAILS.some(e => e.id === milestone.id);
        if (alreadySent) return;
        if (userCoins < milestone.amount) return;

        if (milestone.requiresDebtFree) {
            const totalDebt = (activeLoans || []).reduce((sum, loan) => sum + loan.totalRepay, 0);
            if (totalDebt > 0) return; // Don't send this milestone email until debt is paid off
        }

        addGameEmail({
            id: milestone.id,
            sender: "Mom",
            email: "mom@family.com",
            subject: milestone.subject,
            body: milestone.body
        }, 'lore');
    });
}

// --- EMAIL APP SYSTEM ---

function updateEmailBadge() {
    const unreadCount = GAME_EMAILS.filter(e => !readEmails.includes(e.id)).length;
    const badgeEl = document.getElementById('email-unread-badge');
    const pcBadgeEl = document.getElementById('pc-mail-badge');

    if (badgeEl) {
        badgeEl.textContent = unreadCount;
        badgeEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    if (pcBadgeEl) {
        pcBadgeEl.textContent = unreadCount;
        pcBadgeEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
}

function renderEmailList() {
    const listEl = document.getElementById('email-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const mailDate = slotCreatedDate || getTodayDateString();

    GAME_EMAILS.forEach(email => {
        const isRead = readEmails.includes(email.id);
        const isProtected = PROTECTED_EMAIL_IDS.includes(email.id);

        const item = document.createElement('div');
        item.className = `email-item ${isRead ? 'read' : 'unread'}`;
        item.setAttribute('data-email-id', email.id);

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;">
                <div style="flex: 1; cursor: pointer; min-width: 0;" onclick="openEmailById('${email.id}')">
                    <div class="email-item-sender" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${email.sender}</div>
                    <div class="email-item-subject" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${email.subject}</div>
                    <div class="email-item-date">${mailDate}</div>
                </div>
                ${!isProtected ? `<button title="Delete Email" onclick="deleteSingleEmail(event, '${email.id}')" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #aaa; border-radius: 4px; cursor: pointer; font-size: 14px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s;" onmouseover="this.style.background='#e74c3c';this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#aaa';">&times;</button>` : ''}
            </div>
        `;
        listEl.appendChild(item);
    });
}

function openEmailById(emailId) {
    const email = GAME_EMAILS.find(e => e.id === emailId);
    if (email) openEmail(email);
}

function deleteSingleEmail(event, emailId) {
    event.stopPropagation();
    if (PROTECTED_EMAIL_IDS.includes(emailId)) return;

    const index = GAME_EMAILS.findIndex(e => e.id === emailId);
    if (index !== -1) {
        GAME_EMAILS.splice(index, 1);

        const readIdx = readEmails.indexOf(emailId);
        if (readIdx !== -1) readEmails.splice(readIdx, 1);

        saveGameData();
        updateEmailBadge();
        renderEmailList();

        const readerEl = document.getElementById('email-reader');
        if (readerEl) readerEl.innerHTML = '<div class="email-empty-state">Select an email to read</div>';
    }
}

function deleteAllCustomEmails() {
    const protectedEmails = GAME_EMAILS.filter(e => PROTECTED_EMAIL_IDS.includes(e.id));

    if (GAME_EMAILS.length === protectedEmails.length) {
        showGameAlert("Inbox", "There are no additional emails to delete.", "#3b82f6");
        return;
    }

    showGameConfirm(
        "Clean Inbox",
        "Are you sure you want to delete your entire inbox, except for essential emails?",
        () => {
            GAME_EMAILS.length = 0;
            Array.prototype.push.apply(GAME_EMAILS, protectedEmails);

            readEmails = readEmails.filter(id => PROTECTED_EMAIL_IDS.includes(id));

            saveGameData();
            updateEmailBadge();
            renderEmailList();

            const readerEl = document.getElementById('email-reader');
            if (readerEl) readerEl.innerHTML = '<div class="email-empty-state">Select an email to read</div>';
        }
    );
}

function openEmail(email) {
    if (!readEmails.includes(email.id)) {
        readEmails.push(email.id);
        saveGameData();
        updateEmailBadge();
        renderEmailList();
    }

    document.querySelectorAll('.email-item').forEach(el => el.classList.remove('selected'));
    const selectedEl = document.querySelector(`[data-email-id="${email.id}"]`);
    if (selectedEl) selectedEl.classList.add('selected');

    const mailDate = slotCreatedDate || getTodayDateString();

    const readerEl = document.getElementById('email-reader');
    if (readerEl) {
        readerEl.innerHTML = `
            <div class="email-header">
                <h3>${email.subject}</h3>
                <div class="email-meta">
                    <span><strong>From:</strong> ${email.sender} &lt;${email.email}&gt;</span>
                    <span>${mailDate}</span>
                </div>
            </div>
            <div class="email-body">${email.body.replace(/\n/g, '<br>')}</div>
        `;
    }
}

// --- GAME OVER & WIN CONDITIONS ---
function checkGameState() {
    if (!currentSlot) return;

    const totalOverdueDebt = activeLoans
        .filter(l => l.isOverdue || l.remainingVaults <= 0)
        .reduce((sum, loan) => sum + loan.totalRepay, 0);

    if (totalOverdueDebt >= 6000) {
        hasGoneBankrupt = true;
        saveGameData();
        playSound(sounds.gameOver);

        const gameOverModal = document.getElementById('game-over-modal');
        if (gameOverModal) {
            const gameOverText = gameOverModal.querySelector('p');
            if (gameOverText) {
                gameOverText.textContent = `BANKRUPT! Your overdue debt has reached $${totalOverdueDebt} and exceeded the limit ($6000)! You are now facing legal actions from the bank.`;
            }
            gameOverModal.style.display = 'flex';
        }
        return;
    }
}

// GLOBAL AUDIO CONTEXT
let sharedAudioCtx = null;

function getAudioContext() {
    if (!sharedAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            sharedAudioCtx = new AudioCtx();
        }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
}

const soundFiles = {
    sell: 'sounds/sell.mp3',
    winCommon: 'sounds/win-common.mp3',
    winRare: 'sounds/win-rare.mp3',
    winEpic: 'sounds/win-epic.mp3',
    winLegendary: 'sounds/win-legendary.mp3',
    gameWin: 'sounds/win.mp3',
    gameOver: 'sounds/gameover.mp3',
    emailNotify: 'sounds/email-notify.mp3',
    emailLore: 'sounds/email-lore.mp3'
};

const sounds = {};

Object.keys(soundFiles).forEach(key => {
    const audio = new Audio(soundFiles[key]);
    audio.preload = 'auto';
    sounds[key] = audio;
});

function playClickSound() {
    try {
        if (appSettings.muted) return;

        const audioCtx = getAudioContext();
        if (!audioCtx) return;

        const volumeScale = (appSettings.volume ?? 70) / 100;
        const peakGain = 0.15 * volumeScale;
        const tailGain = Math.max(0.0001, 0.01 * volumeScale);

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.03);

        gain.gain.setValueAtTime(peakGain, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(tailGain, audioCtx.currentTime + 0.03);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.03);
    } catch (e) { }
}

function playSound(audio) {
    if (!audio) return;
    try {
        audio.pause();
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => { });
        }
    } catch (e) { }
}

function playWinSoundByRarity(rarity) {
    const r = (rarity || '').toLowerCase();
    if (r === 'legendary') playSound(sounds.winLegendary);
    else if (r === 'epic') playSound(sounds.winEpic);
    else if (r === 'rare') playSound(sounds.winRare);
    else playSound(sounds.winCommon);
}

// --- Mail notification sounds ---
// 'lore'-type emails (story emails from Mom) play a different sound
// than regular notification emails (bank alerts, etc.).
function playEmailSound(type) {
    if (type === 'lore') {
        playSound(sounds.emailLore);
    } else {
        playSound(sounds.emailNotify);
    }
}

// Shared helper for adding a new email: appends it to the list, updates
// the badge/UI, saves, and plays the appropriate notification sound.
function addGameEmail(emailObj, type = 'notification') {
    GAME_EMAILS.unshift(emailObj);
    updateEmailBadge();
    renderEmailList();
    saveGameData();
    playEmailSound(type);
}

// --- App settings (save-independent, persist per browser) ---

const APP_SETTINGS_KEY = 'sw_cmf_app_settings';

let appSettings = {
    volume: 70,
    muted: false,
    reduceMotion: false
};

function loadAppSettings() {
    try {
        const raw = localStorage.getItem(APP_SETTINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            appSettings.volume = typeof parsed.volume === 'number' ? parsed.volume : 70;
            appSettings.muted = !!parsed.muted;
            appSettings.reduceMotion = !!parsed.reduceMotion;
        }
    } catch (e) {
        console.error("Ayarlar okunamadı:", e);
    }
    applyAppSettings();
}

function saveAppSettings() {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings));
}

function applyAppSettings() {
    // Apply the volume level to all preloaded sounds
    const effectiveVolume = appSettings.muted ? 0 : appSettings.volume / 100;
    Object.values(sounds).forEach(audio => {
        audio.volume = effectiveVolume;
    });

    // Reduced motion: toggled via a class on <body> that disables CSS animations
    document.body.classList.toggle('reduce-motion', appSettings.reduceMotion);

    // Sync UI controls with the current settings (if the Settings tab is open)
    const volumeSlider = document.getElementById('settings-volume-slider');
    const volumeValueEl = document.getElementById('settings-volume-value');
    const muteToggle = document.getElementById('settings-mute-toggle');
    const reduceMotionToggle = document.getElementById('settings-reduce-motion-toggle');

    if (volumeSlider) volumeSlider.value = appSettings.volume;
    if (volumeValueEl) volumeValueEl.textContent = `${appSettings.volume}%`;
    if (muteToggle) muteToggle.checked = appSettings.muted;
    if (reduceMotionToggle) reduceMotionToggle.checked = appSettings.reduceMotion;
}

function initSettingsUI() {
    const volumeSlider = document.getElementById('settings-volume-slider');
    const volumeValueEl = document.getElementById('settings-volume-value');
    const muteToggle = document.getElementById('settings-mute-toggle');
    const reduceMotionToggle = document.getElementById('settings-reduce-motion-toggle');

    if (volumeSlider) {
        volumeSlider.addEventListener('input', () => {
            appSettings.volume = parseInt(volumeSlider.value) || 0;
            if (volumeValueEl) volumeValueEl.textContent = `${appSettings.volume}%`;
            applyAppSettings();
            saveAppSettings();
        });
    }

    if (muteToggle) {
        muteToggle.addEventListener('change', () => {
            appSettings.muted = muteToggle.checked;
            applyAppSettings();
            saveAppSettings();
        });
    }

    if (reduceMotionToggle) {
        reduceMotionToggle.addEventListener('change', () => {
            appSettings.reduceMotion = reduceMotionToggle.checked;
            applyAppSettings();
            saveAppSettings();
        });
    }
}

// "Current Save" shortcuts in the Settings tab, operating on the active slot
function exportCurrentSlot() {
    if (!currentSlot) {
        showGameAlert("No Active Save", "There's no save slot currently loaded.");
        return;
    }
    exportSaveSlot(currentSlot);
}

function importCurrentSlot() {
    if (!currentSlot) {
        showGameAlert("No Active Save", "There's no save slot currently loaded.");
        return;
    }
    triggerImportSlot(currentSlot);
}

loadAppSettings();

// DOM ELEMANLARI
const coinsEl = document.getElementById('user-coins');
const vaultValueEl = document.getElementById('vault-value');
const cratesListEl = document.getElementById('crates-list');
let activeCrateThemeTab = null; // Currently selected theme tab, remembered across renderCrates() calls
const crateTitleEl = document.getElementById('selected-crate-title');
const crateCostEl = document.getElementById('crate-cost');
const spinBtn = document.getElementById('spin-btn');
const rouletteStrip = document.getElementById('roulette-strip');
const vaultGridEl = document.getElementById('vault-grid');
const sellAllBtn = document.getElementById('sell-all-btn');
const vaultCountBadge = document.getElementById('vault-count-badge');

document.addEventListener('DOMContentLoaded', () => {
    updateSlotUI();
    setupTabs();
    renderCrates();
    initSettingsUI();
    applyAppSettings();

    const slotModal = document.getElementById('slot-modal');
    if (slotModal) slotModal.style.display = 'flex';

    spinBtn.addEventListener('click', spinRoulette);
    sellAllBtn.addEventListener('click', sellAllItems);

    const pcBtn = document.getElementById('pc-btn');
    const pcModal = document.getElementById('pc-modal');
    const closePcModalBtn = document.getElementById('close-pc-modal-btn');

    if (pcBtn) {
        pcBtn.addEventListener('click', () => {
            if (pcModal) pcModal.style.display = 'flex';
        });
    }
    if (closePcModalBtn) {
        closePcModalBtn.addEventListener('click', () => {
            if (pcModal) pcModal.style.display = 'none';
        });
    }

    const dailyRewardModal = document.getElementById('daily-reward-modal');
    const dailyRewardCloseBtn = document.getElementById('daily-reward-close-btn');
    if (dailyRewardCloseBtn && dailyRewardModal) {
        dailyRewardCloseBtn.addEventListener('click', () => {
            dailyRewardModal.style.display = 'none';
        });
        dailyRewardModal.addEventListener('click', (e) => {
            if (e.target === dailyRewardModal) dailyRewardModal.style.display = 'none';
        });
    }

    document.body.addEventListener('click', () => {
        getAudioContext();
    }, { once: true });

    const closeModalBtn = document.getElementById('close-modal-btn');
    const modal = document.getElementById('inspect-modal');

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    }
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
        if (e.target === pcModal) pcModal.style.display = 'none';
    });
});

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Computes the actual drop rates shown on card hover.
// Uses the SAME weighting logic as getRandomMinifig, so the displayed
// percentages always match the real pull odds exactly.
function calculateCrateDropRates(crate) {
    const poolMinifigs = MINIFIG_DATABASE.filter(fig => crate.pool.includes(fig.id));
    const defaultWeights = { 'common': 70, 'rare': 22, 'epic': 7.6, 'legendary': 0.4 };
    const crateWeights = crate.weights || defaultWeights;

    const rarityCounts = {};
    poolMinifigs.forEach(fig => {
        const r = fig.rarity.toLowerCase();
        rarityCounts[r] = (rarityCounts[r] || 0) + 1;
    });

    let totalWeight = 0;
    const rarityWeightTotals = {};
    Object.keys(rarityCounts).forEach(r => {
        const rarityWeight = crateWeights[r] || 10;
        rarityWeightTotals[r] = rarityWeight;
        totalWeight += rarityWeight;
    });

    const percentages = {};
    Object.keys(rarityWeightTotals).forEach(r => {
        percentages[r] = totalWeight > 0 ? (rarityWeightTotals[r] / totalWeight) * 100 : 0;
    });

    return percentages; // e.g. { common: 70, rare: 22, epic: 7.6, legendary: 0.4 }
}

function renderCrates() {
    if (typeof CRATES === 'undefined') return;
    cratesListEl.innerHTML = '';

    const rarityOrder = ['common', 'rare', 'epic', 'legendary'];

    // Group crates by theme. Object key order preserves first-seen order,
    // so theme order always matches data.js (a new theme automatically
    // lands last and gets its own tab).
    const groupedByTheme = {};
    CRATES.forEach(crate => {
        const themeKey = crate.theme || 'Other';
        if (!groupedByTheme[themeKey]) groupedByTheme[themeKey] = [];
        groupedByTheme[themeKey].push(crate);
    });

    const themeKeys = Object.keys(groupedByTheme);
    if (themeKeys.length === 0) return;

    // Fall back to the first theme if the previously selected tab no longer exists or none was chosen yet.
    if (!activeCrateThemeTab || !groupedByTheme[activeCrateThemeTab]) {
        activeCrateThemeTab = themeKeys[0];
    }

    // Tab bar
    const tabBarEl = document.createElement('div');
    tabBarEl.classList.add('crate-theme-tabs');
    themeKeys.forEach(themeKey => {
        const tabBtn = document.createElement('button');
        tabBtn.classList.add('crate-theme-tab');
        if (themeKey === activeCrateThemeTab) tabBtn.classList.add('active');
        tabBtn.textContent = themeKey;
        tabBtn.addEventListener('click', () => {
            activeCrateThemeTab = themeKey;
            renderCrates();
        });
        tabBarEl.appendChild(tabBtn);
    });
    cratesListEl.appendChild(tabBarEl);

    // Only the active theme's crates - rendered as a "folder panel" beneath the tabs.
    const panelEl = document.createElement('div');
    panelEl.classList.add('crate-tab-panel');

    const gridEl = document.createElement('div');
    gridEl.classList.add('crates-grid');

    groupedByTheme[activeCrateThemeTab].forEach(crate => {
        const card = document.createElement('div');
        card.classList.add('crate-card');
        card.setAttribute('data-id', crate.id);

        card.innerHTML = `
      <img src="${crate.image}" alt="${crate.name}">
      <div class="crate-name">${crate.name}</div>
      <div class="crate-price">$${crate.cost}</div>
    `;
        card.addEventListener('click', () => selectCrate(crate));

        const dropRates = calculateCrateDropRates(crate);
        const tooltipRows = rarityOrder
            .filter(r => dropRates[r] !== undefined)
            .map(r => `
                <div class="crate-tooltip-row">
                    <span class="rarity-badge rarity-${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</span>
                    <span class="crate-tooltip-pct">${dropRates[r].toFixed(1)}%</span>
                </div>
            `).join('');
        const tooltipHtml = `<div class="crate-tooltip-title">Drop Rates</div>${tooltipRows}`;

        card.addEventListener('mouseenter', () => showCrateTooltip(card, tooltipHtml));
        card.addEventListener('mouseleave', hideCrateTooltip);

        gridEl.appendChild(card);
    });

    panelEl.appendChild(gridEl);
    cratesListEl.appendChild(panelEl);
}

// A single shared tooltip element is used for all crate cards (appended
// to <body>). Its position is computed in JS and clamped to the viewport
// so it never renders off-screen for edge cards.
function getCrateTooltipEl() {
    let tooltip = document.getElementById('crate-drop-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'crate-drop-tooltip';
        tooltip.className = 'crate-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function showCrateTooltip(cardEl, innerHtml) {
    const tooltip = getCrateTooltipEl();
    tooltip.innerHTML = innerHtml;
    tooltip.style.display = 'block';

    const margin = 10;
    const cardRect = cardEl.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = cardRect.left + cardRect.width / 2 - tooltipRect.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));

    let top = cardRect.top - tooltipRect.height - 10;
    if (top < margin) {
        // Show below the card if there isn't enough room above
        top = cardRect.bottom + 10;
    }

    const uiZoom = parseFloat(document.documentElement.style.zoom) || 1;
    tooltip.style.left = `${left / uiZoom}px`;
    tooltip.style.top = `${top / uiZoom}px`;

    // Add the visibility class on the next frame so the fade-in transition runs
    requestAnimationFrame(() => tooltip.classList.add('visible'));
}

function hideCrateTooltip() {
    const tooltip = document.getElementById('crate-drop-tooltip');
    if (!tooltip) return;
    tooltip.classList.remove('visible');
    tooltip.style.display = 'none';
}

function selectCrate(crate) {
    if (isSpinning) return;
    selectedCrate = crate;

    document.querySelectorAll('.crate-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.querySelector(`[data-id="${crate.id}"]`);
    if (activeCard) activeCard.classList.add('active');

    crateTitleEl.textContent = crate.name;
    crateCostEl.textContent = crate.cost;

    checkSpinButton();
    renderCrateContents(crate);
    populateInitialRoulette(crate);
}

function renderCrateContents(crate) {
    const contentsListEl = document.getElementById('crate-contents-list');
    if (!contentsListEl || typeof MINIFIG_DATABASE === 'undefined') return;
    contentsListEl.innerHTML = '';

    let poolMinifigs = MINIFIG_DATABASE.filter(fig => crate.pool.includes(fig.id));
    poolMinifigs.sort((a, b) => getEffectiveBaseValue(a) - getEffectiveBaseValue(b));

    poolMinifigs.forEach(fig => {
        const card = document.createElement('div');
        card.classList.add('content-card', `rarity-${fig.rarity.toLowerCase()}`);
        card.innerHTML = `
      <img src="${fig.image}" alt="${fig.name}">
      <div class="name">${fig.name}</div>
      <div class="price" style="color: #2ecc71; font-weight: bold; margin-top: 5px;">$${getEffectiveBaseValue(fig)}</div>
    `;
        card.addEventListener('click', () => openInspectModal(fig, false));
        contentsListEl.appendChild(card);
    });
}

function populateInitialRoulette(crate) {
    rouletteStrip.style.transition = 'none';
    rouletteStrip.style.transform = 'translateX(0px)';
    rouletteStrip.innerHTML = '';

    const poolMinifigs = MINIFIG_DATABASE.filter(fig => crate.pool.includes(fig.id));
    if (poolMinifigs.length === 0) return;

    for (let i = 0; i < 30; i++) {
        const item = poolMinifigs[i % poolMinifigs.length];
        const card = document.createElement('div');
        card.classList.add('minifig-card', `rarity-${item.rarity.toLowerCase()}`);
        card.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="name">${item.name}</div>
    `;
        rouletteStrip.appendChild(card);
    }
}

function checkSpinButton() {
    if (!selectedCrate || !currentSlot) {
        spinBtn.disabled = true;
        return;
    }
    spinBtn.disabled = !(userCoins >= selectedCrate.cost && !isSpinning);
}

// Shared rarity-weighted picker. Selects a random figure from an item
// pool (a crate's pool or the full MINIFIG_DATABASE) according to the
// given rarity weights. Regardless of how many items share a rarity,
// that rarity's TOTAL chance always equals the given weight
// (e.g. legendary: 0.4%).
function pickWeightedMinifig(pool, weights) {
    if (!pool || pool.length === 0) return null;

    const rarityCounts = {};
    pool.forEach(fig => {
        const r = fig.rarity.toLowerCase();
        rarityCounts[r] = (rarityCounts[r] || 0) + 1;
    });

    let totalWeight = 0;
    const weightedPool = pool.map(fig => {
        const r = fig.rarity.toLowerCase();
        const rarityWeight = weights[r] || 10;
        const weight = rarityWeight / rarityCounts[r];
        totalWeight += weight;
        return { fig, weight };
    });

    let randomNum = Math.random() * totalWeight;
    for (const item of weightedPool) {
        if (randomNum < item.weight) {
            return item.fig;
        }
        randomNum -= item.weight;
    }

    return pool[0];
}

function getRandomMinifig(crate) {
    const poolMinifigs = MINIFIG_DATABASE.filter(fig => crate.pool.includes(fig.id));
    const defaultWeights = { 'common': 70, 'rare': 22, 'epic': 7.6, 'legendary': 0.4 };
    const crateWeights = crate.weights || defaultWeights;
    return pickWeightedMinifig(poolMinifigs, crateWeights);
}

function spinRoulette() {
    if (isSpinning || !selectedCrate || userCoins < selectedCrate.cost) return;
    if (!selectedCrate.pool || selectedCrate.pool.length === 0) {
        showGameAlert('Empty Crate', 'This crate has no minifigures yet.');
        return;
    }

    getAudioContext();

    userCoins -= selectedCrate.cost;
    coinsEl.textContent = `$${userCoins}`;

    processLoanVaultTick();

    saveGameData();
    isSpinning = true;
    spinBtn.disabled = true;

    const wonMinifig = getRandomMinifig(selectedCrate);

    rouletteStrip.style.transition = 'none';
    rouletteStrip.style.transform = 'translateX(0px)';
    rouletteStrip.innerHTML = '';

    const totalCards = 80;
    const winningIndex = 65;

    for (let i = 0; i < totalCards; i++) {
        let item = (i === winningIndex) ? wonMinifig : getRandomMinifig(selectedCrate);
        const card = document.createElement('div');
        card.classList.add('minifig-card', `rarity-${item.rarity.toLowerCase()}`);
        card.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="name">${item.name}</div>
    `;
        rouletteStrip.appendChild(card);
    }

    const totalTicks = 32;
    const duration = 4800;
    for (let i = 0; i < totalTicks; i++) {
        const progress = i / totalTicks;
        const delay = Math.pow(progress, 2.8) * duration;
        setTimeout(() => {
            if (isSpinning) playClickSound();
        }, delay);
    }

    requestAnimationFrame(() => {
        const cards = rouletteStrip.querySelectorAll('.minifig-card');
        const targetCard = cards[winningIndex];
        const wrapper = document.querySelector('.roulette-wrapper');

        if (targetCard && wrapper) {
            const cardOffsetLeft = targetCard.offsetLeft;
            const cardWidth = targetCard.offsetWidth;
            const wrapperWidth = wrapper.offsetWidth;
            const targetOffset = cardOffsetLeft - (wrapperWidth / 2) + (cardWidth / 2);

            const animDuration = 5000;
            const startTime = performance.now();

            function easeOutQuart(x) {
                return 1 - Math.pow(1 - x, 4);
            }

            function animateRoulette(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / animDuration, 1);
                const easeProgress = easeOutQuart(progress);

                const currentX = targetOffset * easeProgress;
                rouletteStrip.style.transform = `translateX(-${currentX}px)`;

                if (progress < 1) {
                    requestAnimationFrame(animateRoulette);
                }
            }

            requestAnimationFrame(animateRoulette);
        }
    });

    setTimeout(() => {
        isSpinning = false;
        playWinSoundByRarity(wonMinifig.rarity);
        totalCratesOpened++;
        addToVault(wonMinifig);
        checkSpinButton();
        openInspectModal(wonMinifig, false);
        checkGameState();
    }, 5300);

}

function addToVault(minifig, countTowardCycles = true) {
    const existingIndex = userVault.findIndex(item => item.id === minifig.id);
    if (existingIndex !== -1) {
        userVault[existingIndex].count += 1;
    } else {
        userVault.push({ ...minifig, count: 1 });
    }

    // Acquiring a figure (crate, bundle, daily reward, auction win, etc.)
    // creates slight scarcity/demand pressure on the market, nudging its price up.
    addSupplyPressure(minifig.id, SUPPLY_PRESSURE_PER_UNIT_ACQUIRED);

    // Collector Offers refreshing every 20 pulls AND the Market updating
    // every 15 pulls should only count SINGLE crate openings (roulette
    // spins); marketplace bundles (3/5/10/etc.)
    // ikisine de dahil edilmiyor.
    if (countTowardCycles) {
        vaultAddCounter++;
        if (vaultAddCounter >= OFFERS_REFRESH_INTERVAL) {
            activeOffers = generateOffers();
            activeMultiOffers = generateMultiOffers();
            vaultAddCounter = 0;
        }

        marketAddCounter++;
        if (marketAddCounter >= MARKET_TICK_INTERVAL) {
            tickMarket();
            marketAddCounter = 0;
        }

        auctionAddCounter++;
        if (auctionAddCounter >= auctionTriggerThreshold && !pendingAuctionInvite && !currentAuction) {
            triggerAuctionInvite();
            auctionAddCounter = 0;
            auctionTriggerThreshold = randomAuctionThreshold();
        }
    }

    updateVaultUI();
    saveGameData();
}

function changeSortOrder(newMode) {
    currentSortMode = newMode;
    updateVaultUI();
}

function updateVaultUI() {
    coinsEl.textContent = `$${userCoins}`;
    const totalValue = userVault.reduce((acc, item) => acc + (getCurrentMinifigValue(item) * item.count), 0);
    const totalCount = userVault.reduce((acc, item) => acc + item.count, 0);

    vaultValueEl.textContent = `$${totalValue}`;
    vaultCountBadge.textContent = totalCount;
    sellAllBtn.disabled = userVault.length === 0 || userVault.every(item => getSellableCount(item) <= 0);

    vaultGridEl.innerHTML = '';

    if (userVault.length === 0) {
        vaultGridEl.innerHTML = '<p style="color:#888; grid-column: 1/-1; text-align:center;">Vault is empty. Open cases to gather minifigs!</p>';
        updateNotepadGoalUI();
        renderOffersApp();
        renderMultiOffersApp();
        renderMarketApp();
        renderAuctionApp();
        renderStatisticsApp();
        checkMilestoneEmails();
        checkThemeMastery();
        checkAchievements();
        return;
    }

    let sortedVault = [...userVault];

    sortedVault.sort((a, b) => {
        if (currentSortMode === 'rarity') {
            return (rarityWeights[b.rarity.toLowerCase()] || 0) - (rarityWeights[a.rarity.toLowerCase()] || 0);
        } else if (currentSortMode === 'value-desc') {
            return getCurrentMinifigValue(b) - getCurrentMinifigValue(a);
        } else if (currentSortMode === 'value-asc') {
            return getCurrentMinifigValue(a) - getCurrentMinifigValue(b);
        } else if (currentSortMode === 'collecting') {
            return userVault.indexOf(a) - userVault.indexOf(b);
        }
    });

    sortedVault.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('vault-card', `rarity-${item.rarity.toLowerCase()}`);
        const badgeHTML = item.count > 1 ? `<div class="stack-badge">x${item.count}</div>` : '';
        const currentValue = getCurrentMinifigValue(item);

        card.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="name">${item.name}</div>
      <div class="price">$${currentValue}</div>
      ${badgeHTML}
    `;

        card.addEventListener('click', () => openInspectModal(item, true));
        vaultGridEl.appendChild(card);
    });
    updateNotepadGoalUI();
    renderOffersApp();
    renderMultiOffersApp();
    renderMarketApp();
    renderAuctionApp();
    renderStatisticsApp();
    checkMilestoneEmails();
    checkThemeMastery();
    checkAchievements();
}

// --- Collector Offers system ---

function getOfferQuantityForRarity(rarityLower) {
    switch (rarityLower) {
        case 'legendary':
            return 1;
        case 'epic':
            return 1 + Math.floor(Math.random() * 2); // 1-2
        case 'rare':
            return 1 + Math.floor(Math.random() * 3); // 1-3
        default:
            return 2 + Math.floor(Math.random() * 3); // 2-4 (common)
    }
}

function generateOffers() {
    if (typeof MINIFIG_DATABASE === 'undefined' || MINIFIG_DATABASE.length === 0) return [];

    const shuffled = [...MINIFIG_DATABASE].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, Math.min(ACTIVE_OFFERS_COUNT, shuffled.length));

    return chosen.map((fig, i) => {
        const rarityLower = fig.rarity.toLowerCase();
        const quantity = getOfferQuantityForRarity(rarityLower);
        // Offer price sits above market value as an incentive to sell
        const bonusMultiplier = 1.4 + Math.random() * 0.8; // 1.4x - 2.2x
        const totalPrice = Math.round(getEffectiveBaseValue(fig) * quantity * bonusMultiplier);
        const collectorName = COLLECTOR_NAMES[Math.floor(Math.random() * COLLECTOR_NAMES.length)];

        return {
            id: `offer_${Date.now()}_${i}_${Math.floor(Math.random() * 10000)}`,
            minifigId: fig.id,
            quantity,
            totalPrice,
            collectorName,
            theme: fig.theme
        };
    });
}

function renderOffersApp() {
    const container = document.getElementById('offers-app-list');
    const progressEl = document.getElementById('offers-refresh-progress');
    if (!container) return;

    if (progressEl) {
        const remaining = Math.max(0, OFFERS_REFRESH_INTERVAL - vaultAddCounter);
        progressEl.textContent = `New batch in ${remaining} more pull${remaining === 1 ? '' : 's'}`;
    }

    if (!activeOffers || activeOffers.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem; text-align:center; padding: 24px 0;">No active offers right now. A new batch of collectors will show up soon.</p>`;
        return;
    }

    container.innerHTML = activeOffers.map(offer => {
        const fig = MINIFIG_DATABASE.find(f => f.id === offer.minifigId);
        if (!fig) return '';

        const rarityLower = fig.rarity.toLowerCase();
        const vaultItem = userVault.find(v => v.id === fig.id);
        const owned = vaultItem ? vaultItem.count : 0;
        const canFulfill = owned >= offer.quantity;

        return `
            <div class="offer-card rarity-${rarityLower}">
                <img src="${fig.image}" alt="${fig.name}">
                <div class="offer-info">
                    <div class="offer-collector">${offer.collectorName} is looking for:</div>
                    <div class="offer-fig-name">${fig.name}</div>
                    <span class="rarity-badge rarity-${rarityLower}">${fig.rarity}</span>
                    <div class="offer-flavor">Completing their ${offer.theme} collection</div>
                    <div class="offer-need">Need: ${offer.quantity}x &nbsp;•&nbsp; You have: ${owned}x</div>
                </div>
                <div class="offer-action">
                    <div class="offer-price">$${offer.totalPrice}</div>
                    <button class="offer-fulfill-btn" ${canFulfill ? '' : 'disabled'} onclick="fulfillOffer('${offer.id}')">
                        ${canFulfill ? 'Fulfill' : 'Not Enough'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function fulfillOffer(offerId) {
    const offer = activeOffers.find(o => o.id === offerId);
    if (!offer) return;

    const vaultIndex = userVault.findIndex(v => v.id === offer.minifigId);
    const ownedCount = vaultIndex !== -1 ? userVault[vaultIndex].count : 0;

    if (ownedCount < offer.quantity) {
        showGameAlert("Not Enough Figures", `You need ${offer.quantity}x this figure to fulfill this offer, but you only have ${ownedCount}x.`);
        return;
    }

    userVault[vaultIndex].count -= offer.quantity;
    if (userVault[vaultIndex].count <= 0) {
        userVault.splice(vaultIndex, 1);
    }

    userCoins += offer.totalPrice;
    activeOffers = activeOffers.filter(o => o.id !== offerId);
    offersFulfilledCount++;
    addSupplyPressure(offer.minifigId, offer.quantity * SUPPLY_PRESSURE_PER_UNIT_SOLD);

    playSound(sounds.sell);
    updateVaultUI();
    saveGameData();

    showGameAlert("Offer Fulfilled!", `${offer.collectorName} paid you $${offer.totalPrice} for the trade. Thanks for helping complete their collection!`);
}

// --- Multi-item collector offers ---
// Unlike single offers, one offer requests several DIFFERENT figures at once;
// payment only happens once all are supplied, in exchange for a higher bulk bonus.

function switchOffersSubtab(tab) {
    const singleBtn = document.getElementById('offers-subtab-single-btn');
    const multiBtn = document.getElementById('offers-subtab-multi-btn');
    const singleView = document.getElementById('offers-single-view');
    const multiView = document.getElementById('offers-multi-view');
    if (!singleBtn || !multiBtn || !singleView || !multiView) return;

    const isSingle = tab === 'single';
    singleBtn.classList.toggle('active', isSingle);
    multiBtn.classList.toggle('active', !isSingle);
    singleView.style.display = isSingle ? 'block' : 'none';
    multiView.style.display = isSingle ? 'none' : 'block';
}

function generateMultiOffers() {
    if (typeof MINIFIG_DATABASE === 'undefined' || MINIFIG_DATABASE.length < 2) return [];

    const offers = [];
    for (let i = 0; i < ACTIVE_MULTI_OFFERS_COUNT; i++) {
        const itemCount = 2 + Math.floor(Math.random() * 3); // 2-4 distinct figures
        const shuffled = [...MINIFIG_DATABASE].sort(() => Math.random() - 0.5);
        const chosenFigs = shuffled.slice(0, Math.min(itemCount, shuffled.length));

        const requirements = chosenFigs.map(fig => ({
            minifigId: fig.id,
            quantity: getOfferQuantityForRarity(fig.rarity.toLowerCase())
        }));

        const baseValue = requirements.reduce((sum, req) => {
            const fig = MINIFIG_DATABASE.find(f => f.id === req.minifigId);
            return sum + (fig ? getEffectiveBaseValue(fig) * req.quantity : 0);
        }, 0);

        // Slightly higher bonus than single offers since this is a bundled (set) offer
        const bonusMultiplier = 1.6 + Math.random() * 0.9; // 1.6x - 2.5x
        const totalPrice = Math.round(baseValue * bonusMultiplier);
        const collectorName = COLLECTOR_NAMES[Math.floor(Math.random() * COLLECTOR_NAMES.length)];

        const themes = [...new Set(chosenFigs.map(f => f.theme))];
        const themeLabel = themes.length === 1 ? themes[0] : 'a mixed';

        offers.push({
            id: `multi_${Date.now()}_${i}_${Math.floor(Math.random() * 10000)}`,
            collectorName,
            requirements,
            totalPrice,
            themeLabel
        });
    }
    return offers;
}

function renderMultiOffersApp() {
    const container = document.getElementById('offers-app-multi-list');
    if (!container) return;

    if (!activeMultiOffers || activeMultiOffers.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem; text-align:center; padding: 24px 0;">No active multi-figure requests right now. A new batch arrives with the next offer refresh.</p>`;
        return;
    }

    container.innerHTML = activeMultiOffers.map(offer => {
        const reqRows = offer.requirements.map(req => {
            const fig = MINIFIG_DATABASE.find(f => f.id === req.minifigId);
            if (!fig) return '';

            const rarityLower = fig.rarity.toLowerCase();
            const vaultItem = userVault.find(v => v.id === fig.id);
            const owned = vaultItem ? vaultItem.count : 0;
            const met = owned >= req.quantity;

            return `
                <div class="offer-multi-req-row" style="${met ? '' : 'opacity:0.65;'}">
                    <img src="${fig.image}" alt="${fig.name}">
                    <span class="rarity-badge rarity-${rarityLower}" style="font-size:0.62rem;">${fig.rarity}</span>
                    <span class="offer-multi-req-name">${fig.name}</span>
                    <span class="offer-multi-req-count" style="color: ${met ? '#38ef7d' : '#e74c3c'};">${owned}/${req.quantity}</span>
                </div>
            `;
        }).join('');

        const canFulfill = offer.requirements.every(req => {
            const vaultItem = userVault.find(v => v.id === req.minifigId);
            return vaultItem && vaultItem.count >= req.quantity;
        });

        return `
            <div class="offer-card offer-card-multi">
                <div style="flex: 1; min-width: 0;">
                    <div class="offer-collector">${offer.collectorName} needs a full set (${offer.themeLabel}):</div>
                    <div style="margin-top: 6px;">${reqRows}</div>
                </div>
                <div class="offer-action">
                    <div class="offer-price">$${offer.totalPrice}</div>
                    <button class="offer-fulfill-btn" ${canFulfill ? '' : 'disabled'} onclick="fulfillMultiOffer('${offer.id}')">
                        ${canFulfill ? 'Fulfill' : 'Not Enough'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// --- Collector Market (price fluctuation) system ---

function initMarketMultipliers() {
    if (typeof MINIFIG_DATABASE === 'undefined') return;
    MINIFIG_DATABASE.forEach(fig => {
        if (typeof marketMultipliers[fig.id] !== 'number') {
            marketMultipliers[fig.id] = 1.0;
        }
    });
}

// Returns a figure's current market value (base value * multiplier).
// Returns a figure's "effective" base value: the permanently boosted
// value if its Theme Mastery bonus has triggered, otherwise the original
// value from data.js. This should be used anywhere "base value" is
// displayed - never read fig.value directly.
function getEffectiveBaseValue(fig) {
    if (!fig) return 0;
    return (themeBoostedBaseValues[fig.id] !== undefined) ? themeBoostedBaseValues[fig.id] : fig.value;
}

function getCurrentMinifigValue(fig) {
    if (!fig) return 0;

    // Once a figure's Theme Mastery bonus triggers, its old base value is
    // permanently REPLACED by the new +10% value. That new value is then
    // treated as the base value going forward (market fluctuation is
    // computed on top of it).
    const baseValue = getEffectiveBaseValue(fig);

    const marketMultiplier = marketMultipliers[fig.id] ?? 1.0;
    let value = Math.round(baseValue * marketMultiplier);

    // On cheap items (e.g. $10), a small percentage market move (2-3%) could
    // vanish entirely when rounded to a whole number ($0.2 difference -> $0).
    // If the market multiplier is meaningfully different from 1.0, enforce at least a $1
    // bir fark garanti ediyoruz.
    const marketDiff = marketMultiplier - 1.0;
    if (Math.abs(marketDiff) > 0.02 && value === baseValue) {
        value += marketDiff > 0 ? 1 : -1;
    }

    return Math.max(1, value);
}

function tickMarket() {
    if (typeof MINIFIG_DATABASE === 'undefined') return;

    if (!hasSentMarketIntroEmail) {
        sendMarketIntroEmail();
        hasSentMarketIntroEmail = true;
    }

    const groups = getThemeGroups();
    const changedThemes = [];

    Object.keys(groups).forEach(themeKey => {
        // 1) If this theme has no state yet, start it in a random state (and assign a duration).
        if (!themeMarketStates[themeKey]) {
            const initialState = pickRandomMarketState();
            themeMarketStates[themeKey] = { state: initialState, ticksInState: 0, duration: pickStateDuration(initialState) };
        }
        const themeState = themeMarketStates[themeKey];

        // Older saves may not have a duration field yet;
        // assign one here for backward compatibility.
        if (!themeState.duration) {
            themeState.duration = pickStateDuration(themeState.state);
        }

        themeState.ticksInState++;

        // 2) State transition: no per-tick coin flip. A state changes once
        //    its assigned duration runs out.
        if (themeState.ticksInState >= themeState.duration) {
            const otherStates = Object.keys(MARKET_STATES).filter(s => s !== themeState.state);
            const newState = otherStates[Math.floor(Math.random() * otherStates.length)];
            changedThemes.push({ themeKey, newState });
            themeState.state = newState;
            themeState.ticksInState = 0;
            themeState.duration = pickStateDuration(newState);
        }

        // 3) Apply a price move to every figure in this theme, based on the current state.
        const stateConfig = MARKET_STATES[themeState.state];
        groups[themeKey].forEach(fig => {
            const current = marketMultipliers[fig.id] ?? 1.0;
            const isUp = Math.random() < stateConfig.upChance;
            const magnitude = stateConfig.magnitude[0] + Math.random() * (stateConfig.magnitude[1] - stateConfig.magnitude[0]);
            let delta = isUp ? magnitude : -magnitude;

            // Supply/demand pressure from the player's own buy/sell activity.
            delta += getSupplyPressureModifier(fig.id);

            let next = current + delta;
            next = Math.max(MARKET_MIN_MULTIPLIER, Math.min(MARKET_MAX_MULTIPLIER, next));
            marketMultipliers[fig.id] = next;
        });
    });

    // 4) Gradually decay supply/demand pressure toward zero, so a temporary
    //    selling spree doesn't have a permanent effect.
    Object.keys(itemSupplyPressure).forEach(figId => {
        itemSupplyPressure[figId] *= SUPPLY_PRESSURE_DECAY;
        if (Math.abs(itemSupplyPressure[figId]) < 0.05) delete itemSupplyPressure[figId];
    });

    // 5) Announce only ONE of the themes that changed state
    //    (emailing every theme separately would be spammy).
    if (changedThemes.length > 0) {
        const announce = changedThemes[Math.floor(Math.random() * changedThemes.length)];
        sendMarketStateChangeEmail(formatThemeLabel(announce.themeKey), announce.newState);
    }

    renderMarketApp();
    saveGameData();
}

function sendMarketIntroEmail() {
    addGameEmail({
        id: `market_intro_${Date.now()}`,
        sender: "The Collector Times",
        email: "news@collectortimes.com",
        subject: "Understanding the Collector Market",
        body: `Collector News Wire\n\nEver wonder why figure prices keep moving? Every theme in the market cycles through one of four conditions:\n\nBullish: demand is climbing, prices trend upward.\nBearish: interest is cooling, prices trend downward.\nStable: a quiet market, small movements either way.\nVolatile: wild swings, big risk and big reward.\n\nThese conditions can shift over time, so keep an eye on the Market tab to see what each theme is doing right now.\n\nOne more thing: your own trading habits matter too. Dump a bunch of the same figure at once and you'll flood the market, dragging its price down. Hold onto something everyone wants, and scarcity can push its value up.\n\nTrade wisely.\n\nThe Collector Times`
    }, 'lore');
}

function sendMarketStateChangeEmail(themeLabel, newState) {
    const templates = {
        bullish: {
            subject: `${themeLabel} Market Turns Bullish!`,
            body: `Collector News Wire\n\nDemand for ${themeLabel} figures is climbing fast. Prices are trending upward, might be a good time to hold onto what you have.\n\nThe Collector Times`
        },
        bearish: {
            subject: `${themeLabel} Market Cools Off`,
            body: `Collector News Wire\n\nInterest in ${themeLabel} figures has softened. Prices are trending downward for now, might not be the best time to sell.\n\nThe Collector Times`
        },
        stable: {
            subject: `${themeLabel} Market Settles Down`,
            body: `Collector News Wire\n\nThe ${themeLabel} market has calmed down after recent swings. Expect steadier price movement for a while.\n\nThe Collector Times`
        },
        volatile: {
            subject: `${themeLabel} Market Goes Wild`,
            body: `Collector News Wire\n\nSomething has traders on edge, ${themeLabel} prices are swinging hard in both directions. High risk, high reward right now.\n\nThe Collector Times`
        }
    };

    const chosen = templates[newState];
    if (!chosen) return;

    addGameEmail({
        id: `market_state_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        sender: "The Collector Times",
        email: "news@collectortimes.com",
        subject: chosen.subject,
        body: chosen.body
    }, 'notification');
}

function renderMarketApp() {
    const gainersEl = document.getElementById('market-gainers-list');
    const losersEl = document.getElementById('market-losers-list');
    const progressEl = document.getElementById('market-refresh-progress');

    if (progressEl) {
        const remaining = Math.max(0, MARKET_TICK_INTERVAL - marketAddCounter);
        progressEl.textContent = `Next shift in ${remaining} more pull${remaining === 1 ? '' : 's'}`;
    }

    if (!gainersEl || !losersEl || typeof MINIFIG_DATABASE === 'undefined') return;

    const ranked = MINIFIG_DATABASE.map(fig => {
        const multiplier = marketMultipliers[fig.id] ?? 1.0;
        const changePct = (multiplier - 1.0) * 100;
        return { fig, changePct, currentValue: getCurrentMinifigValue(fig) };
    }).sort((a, b) => b.changePct - a.changePct);

    const gainers = ranked.slice(0, 5);
    const losers = ranked.slice(-5).reverse();

    function renderRow(entry) {
        const rarityLower = entry.fig.rarity.toLowerCase();
        const isUp = entry.changePct >= 0;
        const arrow = isUp ? '▲' : '▼';
        const color = isUp ? '#2ecc71' : '#e74c3c';
        return `
            <div class="market-row" onclick="inspectMarketFigure('${entry.fig.id}')">
                <img src="${entry.fig.image}" alt="${entry.fig.name}">
                <div class="market-row-info">
                    <div class="market-row-name">${entry.fig.name}</div>
                    <span class="rarity-badge rarity-${rarityLower}">${entry.fig.rarity}</span>
                </div>
                <div class="market-row-value">
                    <div>$${entry.currentValue}</div>
                    <div style="color:${color}; font-size:0.72rem; font-weight:bold;">${arrow} ${Math.abs(entry.changePct).toFixed(1)}%</div>
                </div>
            </div>
        `;
    }

    gainersEl.innerHTML = gainers.map(renderRow).join('');
    losersEl.innerHTML = losers.map(renderRow).join('');

    renderMarketConditionsPanel();
}

function renderMarketConditionsPanel() {
    const container = document.getElementById('market-conditions-panel');
    if (!container) return;

    const groups = getThemeGroups();
    const themeKeys = Object.keys(groups).sort();

    if (themeKeys.length === 0) {
        container.innerHTML = '';
        return;
    }

    const stateMeta = {
        bullish: { label: 'Bullish', color: '#2ecc71', arrow: '▲' },
        bearish: { label: 'Bearish', color: '#e74c3c', arrow: '▼' },
        stable: { label: 'Stable', color: '#94a3b8', arrow: '─' },
        volatile: { label: 'Volatile', color: '#f39c12', arrow: '~' }
    };

    const cards = themeKeys.map(themeKey => {
        const themeState = themeMarketStates[themeKey];
        const state = themeState ? themeState.state : 'stable';
        const meta = stateMeta[state] || stateMeta.stable;
        const label = formatThemeLabel(themeKey);

        return `
            <div class="market-condition-card">
                <span class="market-condition-theme">${label}</span>
                <span class="market-condition-badge" style="color:${meta.color}; border-color:${meta.color};">${meta.arrow} ${meta.label}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `<h4 style="color:#fff; font-size:0.85rem; margin:0 0 8px 0;">Market Conditions</h4>${cards}`;
}

// Opens the inspect modal when a figure in the Market is clicked.
// Shows the vault entry (with sell controls) if owned, otherwise just
// the figure itself for reference.
function inspectMarketFigure(figId) {
    if (typeof MINIFIG_DATABASE === 'undefined') return;
    const fig = MINIFIG_DATABASE.find(f => f.id === figId);
    if (!fig) return;

    const vaultItem = userVault.find(v => v.id === figId);
    if (vaultItem) {
        openInspectModal(vaultItem, true);
    } else {
        openInspectModal(fig, false);
    }
}

function fulfillMultiOffer(offerId) {
    const offer = activeMultiOffers.find(o => o.id === offerId);
    if (!offer) return;

    const allMet = offer.requirements.every(req => {
        const vaultItem = userVault.find(v => v.id === req.minifigId);
        return vaultItem && vaultItem.count >= req.quantity;
    });

    if (!allMet) {
        showGameAlert("Not Enough Figures", "You don't have all the required figures in the needed quantities yet.");
        return;
    }

    offer.requirements.forEach(req => {
        const vaultIndex = userVault.findIndex(v => v.id === req.minifigId);
        if (vaultIndex !== -1) {
            userVault[vaultIndex].count -= req.quantity;
            if (userVault[vaultIndex].count <= 0) {
                userVault.splice(vaultIndex, 1);
            }
        }
        addSupplyPressure(req.minifigId, req.quantity * SUPPLY_PRESSURE_PER_UNIT_SOLD);
    });

    userCoins += offer.totalPrice;
    activeMultiOffers = activeMultiOffers.filter(o => o.id !== offerId);
    multiOffersFulfilledCount++;

    playSound(sounds.sell);
    updateVaultUI();
    saveGameData();

    showGameAlert("Offer Fulfilled!", `${offer.collectorName} paid you $${offer.totalPrice} for the full set. Great trade!`);
}

// --- Daily login / streak system ---
// Guards against clock manipulation (fast-forwarding the device clock to
// fake a "new day", a common exploit in games like this): instead of
// trusting the device clock, we fetch the REAL UTC time from a server.
// If offline, we fall back to the device clock (the only option for
// offline play), but if the clock appears to have moved BACKWARD (older
// than the last claim time), no reward is given - this blocks the simple
// "rewind, then fast-forward" exploit
// engelliyor.

async function getTrustedNowTimestamp() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('Zaman servisi yanıt vermedi');
        const data = await response.json();
        if (typeof data.unixtime === 'number') {
            return { timestamp: data.unixtime * 1000, trusted: true };
        }
        throw new Error('unixtime alanı bulunamadı');
    } catch (e) {
        // Offline / service unreachable: fall back to the device clock,
        // but flag it as UNVERIFIED.
        return { timestamp: Date.now(), trusted: false };
    }
}

function utcMidnight(ms) {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function toUTCDateString(ms) {
    return new Date(ms).toISOString().split('T')[0];
}

// A single 14-day cycle: gradually increasing coin rewards, interspersed
// with random Rare/Epic item rewards, and a large coin jackpot on day 14.
// WHICH item drops isn't predetermined - it's picked randomly from
// MINIFIG_DATABASE for that rarity once the day is reached.
const DAILY_REWARD_SCHEDULE = [
    { type: 'coins', amount: 50 },
    { type: 'coins', amount: 65 },
    { type: 'item', rarity: 'rare' },
    { type: 'coins', amount: 90 },
    { type: 'coins', amount: 110 },
    { type: 'item', rarity: 'epic' },
    { type: 'coins', amount: 150 },
    { type: 'coins', amount: 180 },
    { type: 'item', rarity: 'rare' },
    { type: 'coins', amount: 220 },
    { type: 'coins', amount: 270 },
    { type: 'item', rarity: 'epic' },
    { type: 'coins', amount: 330 },
    { type: 'coins', amount: 1500, isBig: true }
];

function getDailyRewardForStreakDay(day) {
    const cycleDay = ((day - 1) % DAILY_REWARD_SCHEDULE.length) + 1;
    return { ...DAILY_REWARD_SCHEDULE[cycleDay - 1], cycleDay };
}

function pickRandomItemByRarity(rarity) {
    if (typeof MINIFIG_DATABASE === 'undefined') return null;
    const pool = MINIFIG_DATABASE.filter(f => f.rarity.toLowerCase() === rarity);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

async function checkDailyLoginReward() {
    if (!currentSlot) return;

    const { timestamp: trustedNow, trusted } = await getTrustedNowTimestamp();

    // If the device/service time appears OLDER than the last claim,
    // the clock may have been rewound - silently bail out.
    if (dailyStreak.lastClaimTimestamp && trustedNow < dailyStreak.lastClaimTimestamp - DAILY_CLOCK_TOLERANCE_MS) {
        return;
    }

    const todayStr = toUTCDateString(trustedNow);

    if (dailyStreak.lastClaimDateUTC === todayStr) {
        // Already claimed today.
        return;
    }

    let daysDiff = null;
    if (dailyStreak.lastClaimTimestamp) {
        daysDiff = Math.round((utcMidnight(trustedNow) - utcMidnight(dailyStreak.lastClaimTimestamp)) / 86400000);
    }

    if (daysDiff === 1) {
        dailyStreak.currentStreak += 1;
    } else {
        // First login ever, or missed a day (daysDiff > 1) - restart the streak at 1.
        dailyStreak.currentStreak = 1;
    }

    dailyStreak.longestStreak = Math.max(dailyStreak.longestStreak, dailyStreak.currentStreak);
    dailyStreak.lastClaimDateUTC = todayStr;
    dailyStreak.lastClaimTimestamp = trustedNow;

    const reward = getDailyRewardForStreakDay(dailyStreak.currentStreak);
    let grantedItem = null;

    if (reward.type === 'item') {
        grantedItem = pickRandomItemByRarity(reward.rarity);
        if (grantedItem) {
            // false: daily reward items shouldn't advance the Collector
            // Offers/Market cycle counters (same rule as bundle items).
            addToVault(grantedItem, false);
        } else {
            // If no item exists for that rarity (incomplete database), fall back to coins.
            userCoins += 100;
        }
    } else {
        userCoins += reward.amount;
    }

    updateVaultUI();
    saveGameData();
    showDailyRewardModal(dailyStreak.currentStreak, reward, trusted, grantedItem);
}

function buildDailyRewardCalendarHtml(currentStreakDay) {
    const totalDaysToShow = 14;
    let html = '';

    for (let day = 1; day <= totalDaysToShow; day++) {
        const reward = getDailyRewardForStreakDay(day);
        const isClaimed = day <= currentStreakDay;
        const isToday = day === currentStreakDay;

        let classes = 'daily-calendar-cell';
        if (reward.isBig) classes += ' jackpot';
        if (reward.type === 'item') classes += ` item-${reward.rarity}`;
        if (isClaimed) classes += ' claimed';
        if (isToday) classes += ' today';
        if (!isClaimed) classes += ' future';

        let rewardLabel;
        if (reward.type === 'item') {
            const rarityLabel = reward.rarity.charAt(0).toUpperCase() + reward.rarity.slice(1);
            rewardLabel = rarityLabel;
        } else {
            rewardLabel = `$${reward.amount}`;
        }

        html += `
            <div class="${classes}">
                <div class="daily-calendar-day">Day ${day}</div>
                <div class="daily-calendar-reward">${rewardLabel}</div>
                ${isClaimed ? '<div class="daily-calendar-check">✓</div>' : ''}
            </div>
        `;
    }

    return html;
}

function showDailyRewardModal(streakDay, reward, timeWasTrusted, grantedItem) {
    const modal = document.getElementById('daily-reward-modal');
    if (!modal) return;

    document.getElementById('daily-reward-icon').textContent = '';
    document.getElementById('daily-reward-title').textContent = reward.isBig ? 'Weekly Streak Jackpot!' : 'Daily Login Bonus';

    const subtitle = `Day ${streakDay} streak. Come back every day for bigger rewards!`;
    document.getElementById('daily-reward-subtitle').textContent = timeWasTrusted ? subtitle : `${subtitle} (offline, using device time)`;

    const amountEl = document.getElementById('daily-reward-amount');
    if (reward.type === 'item' && grantedItem) {
        const rarityLower = grantedItem.rarity.toLowerCase();
        amountEl.innerHTML = `<span class="rarity-badge rarity-${rarityLower}" style="font-size:1.15rem; padding:8px 20px;">${grantedItem.rarity}</span><div style="margin-top:10px; font-size:1.3rem;">${grantedItem.name}</div>`;
        amountEl.style.color = '#fff';
    } else {
        amountEl.textContent = `+$${reward.amount}`;
        amountEl.style.color = reward.isBig ? '#ffd700' : '#38ef7d';
    }

    document.getElementById('daily-reward-calendar').innerHTML = buildDailyRewardCalendarHtml(streakDay);

    modal.style.display = 'flex';
}

// --- Achievements / badges system ---

function checkAchievements() {
    let anyNewlyUnlocked = false;

    function unlock(id) {
        if (unlockedAchievements.includes(id)) return;
        unlockedAchievements.push(id);
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) {
            userCoins += ach.reward;
            showAchievementUnlockedModal(ach);
        }
        anyNewlyUnlocked = true;
    }

    if (totalCratesOpened >= 1) unlock('first_spin');
    if (totalCratesOpened >= 50) unlock('crates_50');
    if (totalCratesOpened >= 100 && !hasGoneBankrupt) unlock('crates_100_no_bankrupt');

    if (userVault.some(item => item.rarity.toLowerCase() === 'legendary')) unlock('first_legendary');

    if (hasCompletedAnyTheme) unlock('theme_master');

    if (offersFulfilledCount >= 1) unlock('first_offer');
    if (multiOffersFulfilledCount >= 1) unlock('first_multi_offer');

    if (dailyStreak.currentStreak >= 7) unlock('streak_7');

    const vaultTotal = userVault.reduce((acc, item) => acc + (getCurrentMinifigValue(item) * item.count), 0);
    if (vaultTotal >= 10000) unlock('vault_10k');

    if (bestAuctionSaleMultiplier >= 1.3) unlock('master_salesman');

    if (anyNewlyUnlocked) {
        renderAchievementsApp();
        saveGameData();
    }
}

function showAchievementUnlockedModal(ach) {
    const bodyHtml = `
        <div style="font-size:3rem; margin:10px 0;">${ach.icon}</div>
        <div style="font-size:1.15rem; font-weight:bold; color:#ffd700;">${ach.name}</div>
        <div style="font-size:0.85rem; color:#94a3b8; margin-top:6px;">${ach.desc}</div>
        ${ach.reward > 0 ? `<div style="margin-top:14px; font-size:1.3rem; font-weight:bold; color:#38ef7d;">+$${ach.reward}</div>` : ''}
    `;
    showGameAlert("Achievement Unlocked!", bodyHtml, '#ffd700');
}

function renderAchievementsApp() {
    const grid = document.getElementById('achievements-grid');
    const progressEl = document.getElementById('achievements-progress');
    if (!grid) return;

    if (progressEl) {
        progressEl.textContent = `${unlockedAchievements.length} / ${ACHIEVEMENTS.length} unlocked`;
    }

    grid.innerHTML = ACHIEVEMENTS.map(ach => {
        const isUnlocked = unlockedAchievements.includes(ach.id);
        return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                ${!isUnlocked ? '<div class="achievement-lock"></div>' : ''}
                <div class="achievement-icon">${ach.icon}</div>
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-desc">${ach.desc}</div>
                ${ach.reward > 0 ? `<div class="achievement-reward">+$${ach.reward}</div>` : ''}
            </div>
        `;
    }).join('');
}

// How many units of a vault item are sellable? 1 unit is reserved if it's on Showcase.
function getSellableCount(item) {
    if (!item) return 0;
    const isShowcased = showcaseItems.includes(item.id);
    return isShowcased ? Math.max(0, item.count - 1) : item.count;
}

// --- Showcase system ---
// Purely cosmetic: placing a figure on Showcase sets aside 1 copy of it
// as non-sellable. No other effect on the economy.
// Any number of figures can be displayed - no upper limit.

function toggleShowcaseFromInspect(figId) {
    const idx = showcaseItems.indexOf(figId);
    if (idx !== -1) {
        showcaseItems.splice(idx, 1);
    } else {
        showcaseItems.push(figId);
    }
    renderShowcaseApp();
    updateVaultUI();
    saveGameData();
}

function removeFromShowcase(figId) {
    const idx = showcaseItems.indexOf(figId);
    if (idx !== -1) {
        showcaseItems.splice(idx, 1);
    }
    renderShowcaseApp();
    updateVaultUI();
    saveGameData();
}

function openShowcasePicker() {
    const modal = document.getElementById('showcase-picker-modal');
    const list = document.getElementById('showcase-picker-list');
    if (!modal || !list) return;

    const eligibleItems = userVault.filter(item => !showcaseItems.includes(item.id));

    if (eligibleItems.length === 0) {
        list.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem; text-align:center; padding:20px 0;">No eligible figures to showcase. Either your vault is empty or everything is already on display.</p>`;
    } else {
        list.innerHTML = eligibleItems.map(item => {
            const rarityLower = item.rarity.toLowerCase();
            return `
                <div class="showcase-picker-item" onclick="assignToShowcase('${item.id}')">
                    <img src="${item.image}" alt="${item.name}">
                    <span class="name">${item.name}</span>
                    <span class="rarity-badge rarity-${rarityLower}" style="font-size:0.65rem;">${item.rarity}</span>
                </div>
            `;
        }).join('');
    }

    modal.style.display = 'flex';
}

function closeShowcasePicker() {
    const modal = document.getElementById('showcase-picker-modal');
    if (modal) modal.style.display = 'none';
}

function assignToShowcase(figId) {
    if (!showcaseItems.includes(figId)) {
        showcaseItems.push(figId);
    }
    closeShowcasePicker();
    renderShowcaseApp();
    updateVaultUI();
    saveGameData();
}

let showcaseSortMode = 'collecting';

function changeShowcaseSortMode(mode) {
    showcaseSortMode = mode;
    renderShowcaseApp();
}

function getSortedShowcaseFigs() {
    const withFig = showcaseItems.map(figId => {
        const fig = (typeof MINIFIG_DATABASE !== 'undefined') ? MINIFIG_DATABASE.find(f => f.id === figId) : null;
        return { figId, fig };
    }).filter(entry => entry.fig);

    if (showcaseSortMode === 'rarity') {
        withFig.sort((a, b) => (rarityWeights[b.fig.rarity.toLowerCase()] || 0) - (rarityWeights[a.fig.rarity.toLowerCase()] || 0));
    } else if (showcaseSortMode === 'value-desc') {
        withFig.sort((a, b) => getCurrentMinifigValue(b.fig) - getCurrentMinifigValue(a.fig));
    } else if (showcaseSortMode === 'value-asc') {
        withFig.sort((a, b) => getCurrentMinifigValue(a.fig) - getCurrentMinifigValue(b.fig));
    }
    // 'collecting' (default): insertion order is preserved, no extra sorting applied.

    return withFig;
}

// Opens the inspect modal when a Showcase figure is clicked (sell controls
// stay hidden automatically while it's on display, since getSellableCount returns 0).
function inspectShowcaseFigure(figId) {
    const vaultItem = userVault.find(v => v.id === figId);
    if (vaultItem) {
        openInspectModal(vaultItem, true);
        return;
    }
    // Safety net: still show info even if it somehow dropped out of the vault entirely.
    const fig = (typeof MINIFIG_DATABASE !== 'undefined') ? MINIFIG_DATABASE.find(f => f.id === figId) : null;
    if (fig) openInspectModal(fig, false);
}

// --- Theme Mastery system ---

// Grouped by lowercased theme name to stay resilient to casing
// inconsistencies in theme names (e.g. "Adv" vs "adv").
function getThemeGroups() {
    if (typeof MINIFIG_DATABASE === 'undefined') return {};
    const groups = {};
    MINIFIG_DATABASE.forEach(fig => {
        if (!fig.theme) return;
        const key = fig.theme.trim().toLowerCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(fig);
    });
    return groups;
}

function formatThemeLabel(key) {
    // Prefer the original spelling from the data (e.g. "CMF", "Monster Fighters")
    if (typeof LEGO_DATABASE !== 'undefined') {
        const match = Object.values(LEGO_DATABASE).find(t => t.themeName.trim().toLowerCase() === key);
        if (match) return match.themeName;
    }
    return key.replace(/\b\w/g, c => c.toUpperCase());
}

function checkThemeMastery() {
    const groups = getThemeGroups();
    let anyNewlyCompleted = false;

    Object.keys(groups).forEach(themeKey => {
        if (completedThemeBonuses[themeKey]) return; // Already completed

        const items = groups[themeKey];
        if (items.length === 0) return;

        const allOwned = items.every(fig => userVault.some(v => v.id === fig.id));
        if (allOwned) {
            // Permanently replace each figure's old base value with the
            // new +10% value - this becomes the figure's new base value.
            items.forEach(fig => {
                const oldBase = (themeBoostedBaseValues[fig.id] !== undefined) ? themeBoostedBaseValues[fig.id] : fig.value;
                themeBoostedBaseValues[fig.id] = Math.round(oldBase * (1 + THEME_COMPLETION_BONUS));
            });

            completedThemeBonuses[themeKey] = true;
            hasCompletedAnyTheme = true;
            anyNewlyCompleted = true;
            showThemeMasteryModal(formatThemeLabel(themeKey), items.length);
        }
    });

    if (anyNewlyCompleted) {
        renderShowcaseApp();
        saveGameData();
    }
}

function showThemeMasteryModal(themeLabel, itemCount) {
    const bodyHtml = `
        <div style="font-size:3rem; margin:10px 0;"></div>
        <div style="font-size:1.15rem; font-weight:bold; color:#ffd700;">${themeLabel} Set Complete!</div>
        <div style="font-size:0.85rem; color:#94a3b8; margin-top:6px;">You own all ${itemCount} figures in this theme.</div>
        <div style="margin-top:14px; font-size:1.1rem; font-weight:bold; color:#38ef7d;">+10% permanent value bonus on all ${themeLabel} figures</div>
    `;
    showGameAlert("Theme Mastery Unlocked!", bodyHtml, '#ffd700');
}

function renderThemeMasteryPanel() {
    const container = document.getElementById('theme-mastery-panel');
    if (!container) return;

    const groups = getThemeGroups();
    const themeKeys = Object.keys(groups).sort();

    if (themeKeys.length === 0) {
        container.innerHTML = '';
        return;
    }

    const header = `<h4 style="color:#fff; font-size:0.9rem; margin:0 0 10px 0;">Theme Mastery</h4>`;

    const cards = themeKeys.map(themeKey => {
        const items = groups[themeKey];
        const ownedCount = items.filter(fig => userVault.some(v => v.id === fig.id)).length;
        const total = items.length;
        const isDone = !!completedThemeBonuses[themeKey];
        const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
        const label = formatThemeLabel(themeKey);

        return `
            <div class="theme-mastery-card ${isDone ? 'completed' : ''}">
                <div class="theme-mastery-header">
                    <span class="theme-mastery-name">${label}</span>
                    <span class="theme-mastery-status ${isDone ? 'done' : 'progress'}">${isDone ? '+10% value' : `${ownedCount}/${total}`}</span>
                </div>
                <div class="theme-mastery-bar-track">
                    <div class="theme-mastery-bar-fill" style="width:${pct}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = header + cards;
}

// --- Statistics app ---

function getRarestOwnedItem() {
    if (userVault.length === 0) return null;
    let rarest = null;
    let rarestWeight = -1;

    userVault.forEach(item => {
        const w = rarityWeights[item.rarity.toLowerCase()] || 0;
        if (w > rarestWeight) {
            rarest = item;
            rarestWeight = w;
        } else if (w === rarestWeight && rarest && getCurrentMinifigValue(item) > getCurrentMinifigValue(rarest)) {
            rarest = item;
        }
    });

    return rarest;
}

function renderStatisticsApp() {
    const container = document.getElementById('statistics-app-content');
    if (!container) return;

    const totalVaultItems = userVault.reduce((acc, item) => acc + item.count, 0);
    const totalVaultValue = userVault.reduce((acc, item) => acc + (getCurrentMinifigValue(item) * item.count), 0);
    const rarest = getRarestOwnedItem();
    const themesCompletedCount = Object.keys(completedThemeBonuses).length;
    const totalThemesCount = Object.keys(getThemeGroups()).length;
    const goalPct = Math.min(100, Math.max(0, Math.round((userCoins / 75000) * 100)));

    const stats = [
        { icon: '', label: 'Current Coins', value: `$${userCoins}` },
        { icon: '', label: 'Goal Progress', value: `${goalPct}% of $75,000` },
        { icon: '', label: 'Cases Opened', value: totalCratesOpened },
        { icon: '', label: 'Current Streak', value: `${dailyStreak.currentStreak} day${dailyStreak.currentStreak === 1 ? '' : 's'}` },
        { icon: '', label: 'Longest Streak', value: `${dailyStreak.longestStreak} day${dailyStreak.longestStreak === 1 ? '' : 's'}` },
        { icon: '', label: 'Achievements', value: `${unlockedAchievements.length} / ${ACHIEVEMENTS.length}` },
        { icon: '', label: 'Themes Mastered', value: `${themesCompletedCount} / ${totalThemesCount}` },
        { icon: '', label: 'Vault Items', value: totalVaultItems },
        { icon: '', label: 'Vault Value', value: `$${totalVaultValue}` },
        { icon: '', label: 'Rarest Owned', value: rarest ? rarest.name : 'N/A' },
        { icon: '', label: 'Offers Fulfilled', value: offersFulfilledCount + multiOffersFulfilledCount },
        { icon: '', label: 'Best Auction Sale', value: bestAuctionSaleMultiplier > 0 ? `${Math.round(bestAuctionSaleMultiplier * 100)}% of value` : 'N/A' },
        { icon: '', label: 'On Display', value: `${showcaseItems.length} figure${showcaseItems.length === 1 ? '' : 's'}` },
        { icon: '', label: 'Bankruptcy Record', value: hasGoneBankrupt ? 'Went bankrupt once' : 'Clean record' },
        { icon: '', label: 'Playing Since', value: slotCreatedDate || '----' }
    ];

    container.innerHTML = `
        <h3 style="color:#fff; font-size:1.05rem; margin:0 0 14px 0;">Statistics</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap:12px;">
            ${stats.map(s => `
                <div class="stat-card">
                    <div class="stat-icon">${s.icon}</div>
                    <div class="stat-label">${s.label}</div>
                    <div class="stat-value" title="${s.value}">${s.value}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderShowcaseApp() {
    const grid = document.getElementById('showcase-slots-grid');
    const progressEl = document.getElementById('showcase-progress');
    if (!grid) return;

    renderThemeMasteryPanel();

    if (progressEl) {
        progressEl.textContent = `${showcaseItems.length} figure${showcaseItems.length === 1 ? '' : 's'} on display`;
    }

    const sortedFigs = getSortedShowcaseFigs();

    const itemCards = sortedFigs.map(({ figId, fig }) => {
        const rarityLower = fig.rarity.toLowerCase();
        const currentValue = getCurrentMinifigValue(fig);
        return `
            <div class="showcase-slot-card" onclick="inspectShowcaseFigure('${figId}')">
                <img src="${fig.image}" alt="${fig.name}">
                <div class="name">${fig.name}</div>
                <span class="rarity-badge rarity-${rarityLower}" style="font-size:0.62rem;">${fig.rarity}</span>
                <div style="font-size:0.72rem; color:#38ef7d; font-weight:bold;">$${currentValue}</div>
                <button class="showcase-remove-btn" onclick="event.stopPropagation(); removeFromShowcase('${figId}')">Remove</button>
            </div>
        `;
    }).join('');

    const addCard = `
        <div class="showcase-slot-card empty" onclick="openShowcasePicker()">
            <div style="font-size:1.6rem;">+</div>
            <div>Add Figure</div>
        </div>
    `;

    grid.innerHTML = itemCards + addCard;
}

// --- BrickBid Live (auction) system ---

function formatAuctionTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function triggerAuctionInvite() {
    const pool = [...AUCTION_EXCLUSIVE_ITEMS];
    if (typeof MINIFIG_DATABASE !== 'undefined') {
        const legendaries = MINIFIG_DATABASE.filter(f => f.rarity.toLowerCase() === 'legendary' && f.name && f.image);
        pool.push(...legendaries);
    }
    if (pool.length === 0) return;

    const chosenItem = pool[Math.floor(Math.random() * pool.length)];
    const expiresAt = Date.now() + AUCTION_INVITE_WINDOW_MS;
    pendingAuctionInvite = { item: chosenItem, expiresAt };

    addGameEmail({
        id: `brickbid_invite_${Date.now()}`,
        sender: "BrickBid Live",
        email: "auctions@brickbid.live",
        subject: "LIVE: Rare LEGO Collection Auction Starting! (2:00 remaining)",
        body: `A rare item just went up for live auction:\n\n"${chosenItem.name}"\n\nOpen BrickBid Live on your computer within the next 2 minutes to join the bidding before it's gone!`
    }, 'notification');

    saveGameData();
    renderAuctionApp();
}

function initAuctionBots(config) {
    const marketValue = config.marketValue;
    const isBullish = !!config.isBullish;

    const themes = (typeof MINIFIG_DATABASE !== 'undefined') ? [...new Set(MINIFIG_DATABASE.map(f => f.theme))] : ['Star Wars'];
    const themeEnthusiastTheme = themes.length > 0 ? themes[Math.floor(Math.random() * themes.length)] : null;

    return AUCTION_BOT_DEFS.map(def => {
        let budgetCap;
        switch (def.type) {
            case 'smart_whale': budgetCap = marketValue * 1.25; break;
            case 'bargain_hunter': budgetCap = marketValue * 1.0; break;
            case 'soft_sniper': budgetCap = marketValue * 1.0; break;
            case 'collector': budgetCap = marketValue * 1.2; break;
            case 'emotional': budgetCap = marketValue * 1.0; break;
            case 'intimidator': budgetCap = marketValue * 1.10; break;
            case 'rational': budgetCap = marketValue * 1.05; break;
            case 'reseller': budgetCap = marketValue * 0.85; break;
            case 'hesitant': budgetCap = marketValue * 1.0; break;
            case 'wildcard': budgetCap = marketValue * (Math.random() < 0.5 ? 0 : 1.15); break;
            default: budgetCap = marketValue;
        }

        if (isBullish && def.type !== 'reseller' && def.type !== 'bargain_hunter' && Math.random() < 0.65) {
            budgetCap = marketValue * (1.3 + Math.random() * 0.2);
        }

        return {
            ...def,
            budgetCap,
            hasDropped: false,
            hasFiredSnipe: false,
            favoriteTheme: def.type === 'collector' ? themeEnthusiastTheme : null,
            waitingSinceSeconds: 0
        };
    });
}

function evaluateBotBid(bot) {
    if (!currentAuction || bot.hasDropped) return null;
    if (currentAuction.highestBidderName === bot.name) return null;
    if (bot.type === 'collector' && currentAuction.itemTheme !== bot.favoriteTheme) return null;
    if (bot.type === 'wildcard' && bot.budgetCap <= 0) return null;

    const marketValue = currentAuction.marketValue;
    const currentBid = currentAuction.currentBid;
    const secondsLeft = currentAuction.timeRemaining;

    let shouldBid = false;
    let bidAmount = 0;

    switch (bot.type) {
        case 'smart_whale': {
            const nextBid = currentBid + 50 + Math.floor(Math.random() * 100);
            if (nextBid <= bot.budgetCap && Math.random() < 0.20) { shouldBid = true; bidAmount = nextBid; }
            break;
        }
        case 'bargain_hunter': {
            if (currentBid >= marketValue) { bot.hasDropped = true; break; }
            if (currentBid < marketValue * 0.9 && Math.random() < 0.32) {
                const nextBid = Math.min(currentBid + 30 + Math.floor(Math.random() * 40), Math.floor(marketValue * 0.99));
                shouldBid = true; bidAmount = nextBid;
            }
            break;
        }
        case 'soft_sniper': {
            if (secondsLeft <= 5 && !bot.hasFiredSnipe) {
                const nextBid = currentBid + 20 + Math.floor(Math.random() * 60);
                if (nextBid <= bot.budgetCap) { shouldBid = true; bidAmount = nextBid; }
                bot.hasFiredSnipe = true;
                bot.hasDropped = true;
            }
            break;
        }
        case 'collector': {
            const nextBid = currentBid + 40 + Math.floor(Math.random() * 80);
            if (nextBid <= bot.budgetCap && Math.random() < 0.22) { shouldBid = true; bidAmount = nextBid; }
            break;
        }
        case 'emotional': {
            const battleStreak = currentAuction.battleStreak || 0;
            const effectiveCap = battleStreak > 3 ? marketValue * 1.15 : bot.budgetCap;
            const chance = battleStreak > 3 ? 0.35 : 0.09;
            const nextBid = currentBid + 50 + Math.floor(Math.random() * 100);
            if (nextBid <= effectiveCap && Math.random() < chance) { shouldBid = true; bidAmount = nextBid; }
            break;
        }
        case 'intimidator': {
            const nextBid = currentBid + 300;
            if (nextBid <= bot.budgetCap && Math.random() < 0.15) { shouldBid = true; bidAmount = nextBid; }
            break;
        }
        case 'rational': {
            const cap = Math.floor(marketValue * 1.05);
            const nextBid = Math.min(currentBid + 30 + Math.floor(Math.random() * 30), cap);
            if (nextBid > currentBid && nextBid <= cap && Math.random() < 0.22) { shouldBid = true; bidAmount = nextBid; }
            break;
        }
        case 'reseller': {
            const cap = Math.floor(marketValue * 0.85);
            if (currentBid >= cap) { bot.hasDropped = true; break; }
            const nextBid = Math.min(currentBid + 20 + Math.floor(Math.random() * 30), cap);
            if (Math.random() < 0.20) { shouldBid = true; bidAmount = nextBid; }
            break;
        }
        case 'hesitant': {
            bot.waitingSinceSeconds = (bot.waitingSinceSeconds || 0) + 1;
            if (bot.waitingSinceSeconds >= 3 + Math.floor(Math.random() * 2)) {
                const nextBid = currentBid + 20 + Math.floor(Math.random() * 30);
                if (nextBid <= bot.budgetCap) { shouldBid = true; bidAmount = nextBid; }
                bot.waitingSinceSeconds = 0;
            }
            break;
        }
        case 'wildcard': {
            const nextBid = currentBid + 30 + Math.floor(Math.random() * 120);
            if (nextBid <= bot.budgetCap && Math.random() < 0.22) { shouldBid = true; bidAmount = nextBid; }
            break;
        }
    }

    if (shouldBid && bidAmount > currentAuction.currentBid) {
        return { bot, bidAmount };
    }
    return null;
}

function placeBotBid(bot, amount) {
    const wasPlayer = currentAuction.highestBidderName === 'You';
    currentAuction.currentBid = amount;
    currentAuction.highestBidderName = bot.name;
    currentAuction.bidHistory.push({ bidderName: bot.name, amount, timestamp: Date.now() });

    if (currentAuction.timeRemaining < AUCTION_ANTISNIPE_THRESHOLD) {
        currentAuction.timeRemaining += AUCTION_ANTISNIPE_EXTENSION;
    }

    currentAuction.battleStreak = wasPlayer ? (currentAuction.battleStreak || 0) + 1 : 0;
    // renderAuctionApp() isn't called here - auctionTick() already renders
    // once at the end of every tick, avoiding a duplicate render.
}

function placePlayerBid(increment) {
    if (!currentAuction) return;
    const nextBid = currentAuction.currentBid + increment;

    if (nextBid > userCoins) {
        showGameAlert("Not Enough Funds", "You don't have enough coins to bid $${nextBid}.");
        return;
    }

    const wasBot = currentAuction.highestBidderName && currentAuction.highestBidderName !== 'You';
    currentAuction.currentBid = nextBid;
    currentAuction.highestBidderName = 'You';
    currentAuction.bidHistory.push({ bidderName: 'You', amount: nextBid, timestamp: Date.now() });

    if (currentAuction.timeRemaining < AUCTION_ANTISNIPE_THRESHOLD) {
        currentAuction.timeRemaining += AUCTION_ANTISNIPE_EXTENSION;
    }

    currentAuction.battleStreak = wasBot ? (currentAuction.battleStreak || 0) + 1 : 0;

    renderAuctionApp();
}

function placeCustomPlayerBid() {
    const input = document.getElementById('auction-custom-bid-input');
    if (!input) return;
    const increment = parseInt(input.value);
    if (!increment || increment <= 0) {
        showGameAlert("Invalid Bid", "Enter a valid amount to increase your bid by.");
        return;
    }
    placePlayerBid(increment);
    input.value = '';
    resumeAuctionAfterInput();
}

// Pauses the auction (bots + countdown) while typing in the custom bid
// box, so the price doesn't run away while you type. Doesn't redraw the
// DOM - only stops/starts the interval, preserving the input's value.
function pauseAuctionForInput() {
    if (!currentAuction) return;
    if (auctionTickInterval) {
        clearInterval(auctionTickInterval);
        auctionTickInterval = null;
    }
    const indicator = document.getElementById('auction-pause-indicator');
    if (indicator) indicator.style.display = 'inline';
}

function resumeAuctionAfterInput() {
    if (!currentAuction) return;
    if (!auctionTickInterval) {
        auctionTickInterval = setInterval(auctionTick, 1000);
    }
    const indicator = document.getElementById('auction-pause-indicator');
    if (indicator) indicator.style.display = 'none';
}

function auctionTick() {
    if (!currentAuction) return;

    currentAuction.timeRemaining -= 1;

    // At most 1 bot can bid per second (tick); among the eligible bots,
    // one is picked at random. This gives offers a more natural, readable
    // pace instead of piling up and overflowing.
    const candidates = currentAuction.bots
        .map(bot => evaluateBotBid(bot))
        .filter(c => c !== null);

    if (candidates.length > 0) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        placeBotBid(chosen.bot, chosen.bidAmount);
    }

    if (currentAuction.timeRemaining <= 0) {
        resolveAuction();
        return;
    }

    renderAuctionApp();
}

function resolveAuction() {
    clearInterval(auctionTickInterval);
    auctionTickInterval = null;

    const auction = currentAuction;
    const playerWon = auction.highestBidderName === 'You';

    if (auction.mode === 'buy') {
        if (playerWon) {
            userCoins -= auction.currentBid;
            addToVault({ ...auction.item }, false);
            showGameAlert("Auction Won!", `You won "${auction.item.name}" for $${auction.currentBid}!`, '#2ecc71');
        } else if (auction.highestBidderName) {
            showGameAlert("Auction Ended", `${auction.highestBidderName} won "${auction.item.name}" for $${auction.currentBid}. Better luck next time!`, '#e74c3c');
        } else {
            showGameAlert("Auction Ended", `No one bid on "${auction.item.name}". It's gone for now.`, '#94a3b8');
        }
    } else {
        const finalPrice = auction.currentBid;
        const metReserve = !auction.reservePrice || finalPrice >= auction.reservePrice;

        if (!auction.highestBidderName) {
            showGameAlert("No Sale", "No one placed a bid. Your item is returned, but the listing fee was not refunded.", '#e74c3c');
            addToVault({ ...auction.item }, false);
        } else if (!metReserve) {
            showGameAlert("Reserve Not Met", "The highest bid ($${finalPrice}) didn't meet your reserve price. Your item is returned, but the listing fee was not refunded.", '#e74c3c');
            addToVault({ ...auction.item }, false);
        } else {
            const commission = Math.round(finalPrice * 0.05);
            const payout = finalPrice - commission;
            userCoins += payout;
            addSupplyPressure(auction.item.id, SUPPLY_PRESSURE_PER_UNIT_SOLD);

            const saleMultiplier = finalPrice / auction.marketValue;
            if (saleMultiplier > bestAuctionSaleMultiplier) {
                bestAuctionSaleMultiplier = saleMultiplier;
            }

            showGameAlert("Item Sold!", `${auction.highestBidderName} won your "${auction.item.name}" for $${finalPrice}!<br><br>Payout after 5% commission: <strong style="color:#38ef7d;">$${payout}</strong>`, '#2ecc71');
        }
    }

    if (auction.mode === 'buy') {
        pendingAuctionInvite = null;
    }

    currentAuction = null;
    updateVaultUI();
    saveGameData();
    renderAuctionApp();
    checkAchievements();
}

function joinPendingAuction() {
    if (!pendingAuctionInvite || pendingAuctionInvite.expiresAt <= Date.now()) {
        showGameAlert("Too Late", "This auction invite has expired.");
        pendingAuctionInvite = null;
        saveGameData();
        renderAuctionApp();
        return;
    }

    const item = pendingAuctionInvite.item;
    const marketValue = getEffectiveBaseValue(item);

    currentAuction = {
        mode: 'buy',
        item,
        itemTheme: item.theme,
        marketValue,
        startingPrice: Math.round(marketValue * 0.5),
        currentBid: Math.round(marketValue * 0.5),
        highestBidderName: null,
        reservePrice: null,
        listingFee: 0,
        timeRemaining: AUCTION_ROUND_SECONDS,
        bidHistory: [],
        battleStreak: 0,
        bots: initAuctionBots({ marketValue, isBullish: false })
    };

    saveGameData();
    renderAuctionApp();
    auctionTickInterval = setInterval(auctionTick, 1000);
}

function openAuctionSellPicker() {
    auctionSellSelectedItem = null;
    const modal = document.getElementById('auction-sell-modal');
    const body = document.getElementById('auction-sell-modal-body');
    if (!modal || !body) return;

    const eligibleItems = userVault.filter(item =>
        (item.rarity.toLowerCase() === 'legendary' || item.theme === 'Exclusive') && getSellableCount(item) > 0
    );

    if (eligibleItems.length === 0) {
        body.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem; text-align:center; padding:20px 0;">You don't have any eligible figures (Legendary, not on display in your Showcase) to list for auction.</p>`;
    } else {
        body.innerHTML = `
            <p style="color:#94a3b8; font-size:0.8rem; margin:0 0 12px 0;">Choose a figure to list:</p>
            ${eligibleItems.map(item => {
            const rarityLower = item.rarity.toLowerCase();
            return `
                    <div class="showcase-picker-item" onclick="selectAuctionSellItem('${item.id}')">
                        <img src="${item.image}" alt="${item.name}">
                        <span class="name">${item.name}</span>
                        <span class="rarity-badge rarity-${rarityLower}" style="font-size:0.65rem;">${item.rarity}</span>
                    </div>
                `;
        }).join('')}
        `;
    }

    modal.style.display = 'flex';
}

function selectAuctionSellItem(figId) {
    const item = userVault.find(v => v.id === figId);
    if (!item) return;
    auctionSellSelectedItem = item;

    const marketValue = getCurrentMinifigValue(item);
    const body = document.getElementById('auction-sell-modal-body');
    if (!body) return;

    body.dataset.startingPricePct = "50";
    body.innerHTML = `
        <div style="text-align:center; margin-bottom:14px;">
            <img src="${item.image}" alt="${item.name}" style="width:70px; height:70px; object-fit:contain;">
            <div style="font-weight:bold; margin-top:6px;">${item.name}</div>
            <div style="font-size:0.78rem; color:#94a3b8;">Market Value: $${marketValue}</div>
        </div>

        <label style="font-size:0.8rem; color:#cbd5e1;">Starting Price</label>
        <div style="display:flex; gap:8px; margin:6px 0 14px 0;">
            <button type="button" class="auction-price-preset-btn" onclick="setAuctionStartingPricePct(30)">Low (30%)</button>
            <button type="button" class="auction-price-preset-btn" onclick="setAuctionStartingPricePct(50)">Mid (50%)</button>
            <button type="button" class="auction-price-preset-btn" onclick="setAuctionStartingPricePct(70)">Safe (70%)</button>
        </div>
        <div id="auction-starting-price-display" style="text-align:center; font-size:1.1rem; font-weight:bold; color:#38ef7d; margin-bottom:14px;">$${Math.round(marketValue * 0.5)}</div>

        <label style="font-size:0.8rem; color:#cbd5e1;">Reserve Price (optional)</label>
        <input type="number" id="auction-reserve-price-input" placeholder="No reserve" style="width:100%; padding:8px; margin:6px 0 14px 0; border-radius:6px; border:1px solid #444; background:#1e1e1e; color:#fff; box-sizing:border-box;">

        <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:14px;">Listing Fee: <strong style="color:#e74c3c;">$${Math.round(marketValue * 0.02)}</strong> (charged upfront, non-refundable)</div>

        <button type="button" onclick="confirmStartSellAuction()" style="width:100%; padding:12px; border:none; border-radius:8px; background:#2ecc71; color:#06210f; font-weight:bold; cursor:pointer;">Start Auction</button>
    `;
}

function setAuctionStartingPricePct(pct) {
    const body = document.getElementById('auction-sell-modal-body');
    if (!body || !auctionSellSelectedItem) return;
    body.dataset.startingPricePct = pct.toString();
    const marketValue = getCurrentMinifigValue(auctionSellSelectedItem);
    const display = document.getElementById('auction-starting-price-display');
    if (display) display.textContent = `$${Math.round(marketValue * (pct / 100))}`;
}

function confirmStartSellAuction() {
    if (!auctionSellSelectedItem) return;
    const body = document.getElementById('auction-sell-modal-body');
    const pct = parseInt(body.dataset.startingPricePct || "50");
    const marketValue = getCurrentMinifigValue(auctionSellSelectedItem);
    const startingPrice = Math.round(marketValue * (pct / 100));
    const reserveInput = document.getElementById('auction-reserve-price-input');
    const reservePrice = reserveInput && reserveInput.value ? parseInt(reserveInput.value) : null;
    const figId = auctionSellSelectedItem.id;

    document.getElementById('auction-sell-modal').style.display = 'none';
    startSellAuction(figId, startingPrice, reservePrice);
    auctionSellSelectedItem = null;
}

function closeAuctionSellModal() {
    const modal = document.getElementById('auction-sell-modal');
    if (modal) modal.style.display = 'none';
    auctionSellSelectedItem = null;
}

function startSellAuction(figId, startingPrice, reservePrice) {
    const vaultIndex = userVault.findIndex(v => v.id === figId);
    if (vaultIndex === -1) return;

    const item = userVault[vaultIndex];
    const sellable = getSellableCount(item);
    if (sellable <= 0) {
        showGameAlert("Item Unavailable", "This figure is on display in your Showcase and can't be listed for auction.");
        return;
    }

    const marketValue = getCurrentMinifigValue(item);
    const listingFee = Math.round(marketValue * 0.02);

    if (listingFee > userCoins) {
        showGameAlert("Not Enough Funds", "You need $${listingFee} to cover the listing fee.");
        return;
    }

    userCoins -= listingFee;

    if (item.count > 1) {
        userVault[vaultIndex].count -= 1;
    } else {
        userVault.splice(vaultIndex, 1);
    }

    const isBullish = (marketMultipliers[item.id] ?? 1.0) > 1.15;

    currentAuction = {
        mode: 'sell',
        item: { id: item.id, name: item.name, image: item.image, rarity: item.rarity, theme: item.theme, value: item.value },
        itemTheme: item.theme,
        marketValue,
        startingPrice,
        currentBid: startingPrice,
        highestBidderName: null,
        reservePrice: reservePrice || null,
        listingFee,
        timeRemaining: AUCTION_ROUND_SECONDS,
        bidHistory: [],
        battleStreak: 0,
        bots: initAuctionBots({ marketValue, isBullish })
    };

    updateVaultUI();
    saveGameData();
    renderAuctionApp();
    auctionTickInterval = setInterval(auctionTick, 1000);
}

function renderAuctionApp() {
    const container = document.getElementById('auction-app-content');
    if (!container) return;

    if (inviteCountdownInterval) {
        clearInterval(inviteCountdownInterval);
        inviteCountdownInterval = null;
    }

    if (currentAuction) {
        renderLiveAuctionView(container);
        return;
    }

    if (pendingAuctionInvite && pendingAuctionInvite.expiresAt > Date.now()) {
        renderAuctionInviteView(container);
        inviteCountdownInterval = setInterval(() => {
            if (!pendingAuctionInvite || pendingAuctionInvite.expiresAt <= Date.now()) {
                pendingAuctionInvite = null;
                clearInterval(inviteCountdownInterval);
                inviteCountdownInterval = null;
                saveGameData();
                renderAuctionApp();
                return;
            }
            const el = document.getElementById('auction-invite-timer');
            if (el) el.textContent = formatAuctionTime(pendingAuctionInvite.expiresAt - Date.now());
        }, 1000);
        return;
    }

    if (pendingAuctionInvite) {
        pendingAuctionInvite = null;
        saveGameData();
    }

    renderAuctionIdleView(container);
}

function renderAuctionIdleView(container) {
    const eligibleItems = userVault.filter(item =>
        (item.rarity.toLowerCase() === 'legendary' || item.theme === 'Exclusive') && getSellableCount(item) > 0
    );

    container.innerHTML = `
        <div style="text-align:center; padding:40px 20px;">
            <div style="font-size:3rem; margin-bottom:10px;"></div>
            <h3 style="margin:0 0 8px 0;">No Live Auction Right Now</h3>
            <p style="color:#94a3b8; font-size:0.85rem; max-width:400px; margin:0 auto 20px auto;">Rare items occasionally go up for auction. Keep an eye on your inbox. You can also list your own Legendary figures for sale.</p>
            <button type="button" onclick="openAuctionSellPicker()" style="padding:12px 24px; border:none; border-radius:8px; background:#2ecc71; color:#06210f; font-weight:bold; cursor:pointer;" ${eligibleItems.length === 0 ? 'disabled' : ''}>
                Sell an Item at Auction
            </button>
            ${eligibleItems.length === 0 ? '<p style="color:#64748b; font-size:0.75rem; margin-top:10px;">You need a Legendary figure (not on display in your Showcase) to list one.</p>' : ''}
        </div>
    `;
}

function renderAuctionInviteView(container) {
    const item = pendingAuctionInvite.item;
    const rarityLower = item.rarity.toLowerCase();
    container.innerHTML = `
        <div style="text-align:center; padding:30px 20px;">
            <div style="font-size:0.8rem; color:#ffd700; font-weight:bold; margin-bottom:10px;">LIVE AUCTION STARTING</div>
            <img src="${item.image}" alt="${item.name}" style="width:100px; height:100px; object-fit:contain; margin-bottom:10px;">
            <h3 style="margin:0 0 6px 0;">${item.name}</h3>
            <span class="rarity-badge rarity-${rarityLower}">${item.rarity}</span>
            <div style="margin-top:16px; font-size:0.85rem; color:#94a3b8;">Time left to join:</div>
            <div id="auction-invite-timer" style="font-size:2rem; font-weight:bold; color:#e74c3c;">${formatAuctionTime(pendingAuctionInvite.expiresAt - Date.now())}</div>
            <button type="button" onclick="joinPendingAuction()" style="margin-top:20px; padding:12px 28px; border:none; border-radius:8px; background:#ffd700; color:#1a1200; font-weight:bold; cursor:pointer;">Join Auction</button>
        </div>
    `;
}

function renderLiveAuctionView(container) {
    const auction = currentAuction;
    const rarityLower = auction.item.rarity.toLowerCase();
    const isPlayerHighest = auction.highestBidderName === 'You';

    const feedHtml = auction.bidHistory.slice(-8).reverse().map(bid => `
        <div class="auction-feed-entry ${bid.bidderName === 'You' ? 'you' : ''}">
            <strong>${bid.bidderName}</strong> bid <span style="color:#38ef7d;">$${bid.amount}</span>
        </div>
    `).join('') || '<p style="color:#64748b; font-size:0.8rem; text-align:center; padding-top:20px;">No bids yet, be the first!</p>';

    container.innerHTML = `
        <div style="text-align:center; margin-bottom:14px;">
            <div style="font-size:0.75rem; color:#94a3b8;">TIME REMAINING <span id="auction-pause-indicator" style="display:none; color:#ffd700;">⏸ Paused</span></div>
            <div style="font-size:2.2rem; font-weight:bold; color:${auction.timeRemaining <= 5 ? '#e74c3c' : '#ffd700'};">${auction.timeRemaining}s</div>
        </div>

        <div style="display:flex; gap:16px; height:calc(100% - 80px);">
            <div style="flex:1.1; background:#181b22; border-radius:10px; padding:16px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                <img src="${auction.item.image}" alt="${auction.item.name}" style="width:120px; height:120px; object-fit:contain; margin-bottom:10px;">
                <h3 style="margin:0 0 6px 0; font-size:1rem;">${auction.item.name}</h3>
                <span class="rarity-badge rarity-${rarityLower}">${auction.item.rarity}</span>
                <div style="margin-top:10px; font-size:0.78rem; color:#94a3b8;">Market Value</div>
                <div style="font-size:1.1rem; font-weight:bold;">$${auction.marketValue}</div>
                ${auction.mode === 'sell' ? '<div style="margin-top:8px; font-size:0.7rem; color:#ffd700;">You are selling this item</div>' : ''}
            </div>

            <div style="flex:1.2; background:#181b22; border-radius:10px; padding:16px; display:flex; flex-direction:column;">
                <div style="font-size:0.8rem; color:#94a3b8; margin-bottom:8px;">Live Bid Feed</div>
                <div style="flex:1; overflow:hidden;">${feedHtml}</div>
            </div>

            <div style="flex:1; background:#181b22; border-radius:10px; padding:16px; display:flex; flex-direction:column; align-items:center;">
                <div style="font-size:0.78rem; color:#94a3b8;">Current Bid</div>
                <div style="font-size:1.6rem; font-weight:bold; color:${isPlayerHighest ? '#38ef7d' : '#fff'};">$${auction.currentBid}</div>
                <div style="font-size:0.75rem; color:${isPlayerHighest ? '#38ef7d' : '#94a3b8'}; margin-bottom:14px;">${auction.highestBidderName ? `Leading: ${auction.highestBidderName}` : 'No bids yet'}</div>

                <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                    <button type="button" onclick="placePlayerBid(50)" class="auction-bid-btn">+$50</button>
                    <button type="button" onclick="placePlayerBid(100)" class="auction-bid-btn">+$100</button>
                    <button type="button" onclick="placePlayerBid(1000)" class="auction-bid-btn">+$1,000</button>
                    <div style="display:flex; gap:6px; margin-top:6px;">
                        <input type="number" id="auction-custom-bid-input" placeholder="Custom +$"
                            onfocus="pauseAuctionForInput()"
                            onblur="resumeAuctionAfterInput()"
                            onkeydown="if(event.key==='Enter'){placeCustomPlayerBid();}"
                            style="flex:1; width:0; padding:8px; border-radius:6px; border:1px solid #444; background:#1e1e1e; color:#fff;">
                        <button type="button" onclick="placeCustomPlayerBid()" class="auction-bid-btn" style="width:auto; padding:8px 12px;">Bid</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function sellQuantityItem(minifigId, quantity) {
    const index = userVault.findIndex(item => item.id === minifigId);
    if (index !== -1) {
        const item = userVault[index];
        const sellableMax = getSellableCount(item);

        if (sellableMax <= 0) {
            showGameAlert("On Display", "This figure is on display in your Showcase and can't be sold. Remove it from the Showcase first.");
            return;
        }

        const amountToSell = Math.min(Math.max(1, quantity), sellableMax);
        const unitValue = getCurrentMinifigValue(item);

        userCoins += unitValue * amountToSell;
        playSound(sounds.sell);
        addSupplyPressure(minifigId, amountToSell * SUPPLY_PRESSURE_PER_UNIT_SOLD);

        if (item.count > amountToSell) {
            userVault[index].count -= amountToSell;
        } else {
            userVault.splice(index, 1);
        }

        updateVaultUI();
        saveGameData();
        checkSpinButton();
        checkGameState();
    }
}

function sellAllStack(minifigId) {
    const index = userVault.findIndex(item => item.id === minifigId);
    if (index !== -1) {
        const item = userVault[index];
        const sellable = getSellableCount(item);

        if (sellable <= 0) {
            showGameAlert("On Display", "This figure is on display in your Showcase and can't be sold. Remove it from the Showcase first.");
            return;
        }

        userCoins += getCurrentMinifigValue(item) * sellable;
        playSound(sounds.sell);
        addSupplyPressure(minifigId, sellable * SUPPLY_PRESSURE_PER_UNIT_SOLD);

        const remainingCount = item.count - sellable;
        if (remainingCount > 0) {
            userVault[index].count = remainingCount;
        } else {
            userVault.splice(index, 1);
        }

        updateVaultUI();
        saveGameData();
        checkSpinButton();
        checkGameState();
    }
}

function sellAllItems() {
    if (userVault.length === 0) return;

    let totalEarned = 0;
    const remainingVault = [];

    userVault.forEach(item => {
        const sellable = getSellableCount(item);
        if (sellable > 0) {
            totalEarned += getCurrentMinifigValue(item) * sellable;
            addSupplyPressure(item.id, sellable * SUPPLY_PRESSURE_PER_UNIT_SOLD);
        }
        const remainingCount = item.count - sellable;
        if (remainingCount > 0) {
            remainingVault.push({ ...item, count: remainingCount });
        }
    });

    if (totalEarned === 0) {
        showGameAlert("Nothing to Sell", "Everything in your vault is currently on display in the Showcase.");
        return;
    }

    userCoins += totalEarned;
    userVault = remainingVault;
    playSound(sounds.sell);
    updateVaultUI();
    saveGameData();
    checkSpinButton();
    checkGameState();
}

function openInspectModal(fig, isFromVault = false) {
    const modal = document.getElementById('inspect-modal');
    document.getElementById('modal-img').src = fig.image;
    document.getElementById('modal-title').textContent = fig.name;

    const rarityBadge = document.getElementById('modal-rarity');
    rarityBadge.textContent = fig.rarity;
    rarityBadge.className = `rarity-badge rarity-${fig.rarity.toLowerCase()}`;

    let crateName = "";
    if (typeof CRATES !== 'undefined') {
        const parentCrate = CRATES.find(crate => crate.pool && crate.pool.includes(fig.id));
        if (parentCrate) {
            crateName = parentCrate.name;
        }
    }

    document.getElementById('modal-series').textContent = crateName || fig.series || fig.theme || "Collection";

    // Base Value now reflects a figure's NEW permanent value if its Theme
    // Mastery bonus has triggered (not the original, unchanged data.js value).
    const effectiveBaseValue = (themeBoostedBaseValues[fig.id] !== undefined) ? themeBoostedBaseValues[fig.id] : fig.value;
    document.getElementById('modal-value').textContent = `$${effectiveBaseValue}`;

    const currentValue = getCurrentMinifigValue(fig);
    const multiplier = marketMultipliers[fig.id] ?? 1.0;
    const changePct = (multiplier - 1.0) * 100;

    document.getElementById('modal-current-value').textContent = `$${currentValue}`;
    const changeEl = document.getElementById('modal-market-change');
    if (changeEl) {
        if (Math.abs(changePct) < 0.5) {
            changeEl.textContent = '';
        } else {
            const isUp = changePct >= 0;
            changeEl.textContent = `${isUp ? '▲' : '▼'} ${Math.abs(changePct).toFixed(1)}%`;
            changeEl.style.color = isUp ? '#2ecc71' : '#e74c3c';
            changeEl.style.fontWeight = 'bold';
            changeEl.style.fontSize = '0.85rem';
        }
    }

    const countContainer = document.getElementById('modal-count-container');
    const sellControls = document.getElementById('modal-sell-controls');
    const quantityInput = document.getElementById('sell-quantity-input');
    const customSellPrice = document.getElementById('custom-sell-price');
    const sellCustomBtn = document.getElementById('modal-sell-custom-btn');
    const sellAllStackBtn = document.getElementById('modal-sell-all-btn');
    const showcaseBtn = document.getElementById('modal-showcase-btn');
    const showcaseNote = document.getElementById('modal-showcase-note');

    if (isFromVault) {
        countContainer.style.display = 'block';
        document.getElementById('modal-count').textContent = `x${fig.count}`;

        const isShowcased = showcaseItems.includes(fig.id);
        showcaseBtn.style.display = 'block';
        showcaseBtn.textContent = isShowcased ? 'Remove from Showcase' : 'Add to Showcase';
        showcaseBtn.onclick = () => {
            toggleShowcaseFromInspect(fig.id);
            openInspectModal(fig, true); // Repopulate the modal so its state stays up to date
        };
        showcaseNote.style.display = isShowcased ? 'block' : 'none';

        const sellableMax = getSellableCount(fig);

        if (sellableMax <= 0) {
            sellControls.style.display = 'none';
        } else {
            sellControls.style.display = 'flex';

            quantityInput.max = sellableMax;
            quantityInput.min = 1;
            quantityInput.value = 1;

            const updatePriceLabel = () => {
                let qty = parseInt(quantityInput.value) || 1;
                if (qty > sellableMax) {
                    qty = sellableMax;
                    quantityInput.value = sellableMax;
                } else if (qty < 1) {
                    qty = 1;
                    quantityInput.value = 1;
                }
                customSellPrice.textContent = (qty * currentValue).toString();
            };

            updatePriceLabel();

            quantityInput.oninput = updatePriceLabel;

            sellCustomBtn.onclick = () => {
                const qty = parseInt(quantityInput.value) || 1;
                sellQuantityItem(fig.id, qty);
                modal.style.display = 'none';
            };

            sellAllStackBtn.onclick = () => {
                sellAllStack(fig.id);
                modal.style.display = 'none';
            };
        }
    } else {
        countContainer.style.display = 'none';
        sellControls.style.display = 'none';
        showcaseBtn.style.display = 'none';
        showcaseNote.style.display = 'none';
    }

    modal.style.display = 'flex';
}