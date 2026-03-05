/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AIGENT — Hyperliquid Grid Bot Strategy
 * File: bot/src/strategies/grid.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * INSTALLATION (run from the /NexusSphere root or /NexusSphere/bot):
 *   npm install hyperliquid ethers
 *
 * REQUIRED .env VARIABLES (add to NexusSphere/.env):
 *   HL_PRIVATE_KEY=0x...          ← Your Hyperliquid wallet private key
 *   HL_WALLET_ADDRESS=0x...       ← Your Hyperliquid wallet address (public)
 *   HL_TESTNET=true               ← Set to false for mainnet (CAUTION!)
 *
 * HOW IT WORKS:
 *   1. Fetches the current mark price from Hyperliquid's public API.
 *   2. Divides [lower_price, upper_price] into `grid_count` equal bands.
 *   3. Prices BELOW mark price → Limit BUY orders  (catching dips)
 *   4. Prices ABOVE mark price → Limit SELL orders (taking profits)
 *   5. Places all orders concurrently via Hyperliquid's signed order API.
 *   6. Returns a structured result object for Telegram reply formatting.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Hyperliquid } from 'hyperliquid';
import { ethers } from 'ethers';

// ── Constants ──────────────────────────────────────────────────────────────────
const DELAY_MS = 120;          // Throttle between order submissions (ms)
const MAX_RETRIES = 3;         // Per-order retry attempts on transient failures
const RETRY_DELAY_MS = 2000;   // Delay between retries (ms)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sleeps for `ms` milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Rounds a number to `decimals` significant decimal places.
 * @param {number} n
 * @param {number} decimals
 */
const round = (n, decimals = 6) => parseFloat(n.toFixed(decimals));

/**
 * Retries an async function up to `maxRetries` times on failure.
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries
 * @param {number} delayMs
 */
async function withRetry(fn, maxRetries = MAX_RETRIES, delayMs = RETRY_DELAY_MS) {
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries) {
                const msg = err?.message || String(err);
                console.warn(`[GRID] Attempt ${attempt}/${maxRetries} failed: ${msg}. Retrying in ${delayMs}ms...`);
                await sleep(delayMs);
            }
        }
    }
    throw lastErr;
}

// ── SDK Initialization ────────────────────────────────────────────────────────

/**
 * Builds and returns an authenticated Hyperliquid SDK instance.
 * Priority: userPrivateKey (per-user from DB) → HL_PRIVATE_KEY (.env)
 *
 * @param {string} [userPrivateKey] - Optional per-user private key from DB
 * @returns {{ sdk: Hyperliquid, wallet: ethers.Wallet, isTestnet: boolean }}
 */
function initHyperliquid(userPrivateKey) {
    const privateKey = userPrivateKey || process.env.HL_PRIVATE_KEY;

    if (!privateKey || privateKey === 'your_private_key_here') {
        throw new Error(
            'No private key available.\n' +
            'Complete onboarding via /start, or set HL_PRIVATE_KEY in .env.'
        );
    }

    // ethers.Wallet validates the private key format immediately
    const wallet = new ethers.Wallet(privateKey);
    const isTestnet = process.env.HL_TESTNET !== 'false'; // default = testnet for safety
    const sdk = new Hyperliquid(privateKey, isTestnet);

    return { sdk, wallet, walletAddress: wallet.address, isTestnet };
}

// ── Grid Calculation ──────────────────────────────────────────────────────────

/**
 * Computes the array of grid price levels and per-level order size.
 *
 * Grid band structure:
 *   Level i represents price: lower + i * step  (i = 0 … grid_count-1)
 *
 * Capital allocation:
 *   Each grid level receives equal USDC allocation = total_usdc / grid_count.
 *   Order size (contracts) = usdc_per_level / grid_price.
 *
 * @param {number} lowerPrice  - Bottom of the grid range
 * @param {number} upperPrice  - Top of the grid range
 * @param {number} gridCount   - Number of grid levels
 * @param {number} totalUsdc   - Total USDC capital to deploy
 * @param {number} markPrice   - Current market price (determines buy/sell side)
 * @returns {Array<{ price: number, size: number, side: 'buy' | 'sell' }>}
 */
function calculateGridLevels(lowerPrice, upperPrice, gridCount, totalUsdc, markPrice) {
    if (upperPrice <= lowerPrice) {
        throw new Error(`upper_price (${upperPrice}) must be greater than lower_price (${lowerPrice}).`);
    }
    if (gridCount < 2) {
        throw new Error('grid_count must be at least 2.');
    }
    if (totalUsdc <= 0) {
        throw new Error('total_usdc must be positive.');
    }

    const step = (upperPrice - lowerPrice) / (gridCount - 1);
    const usdcPerLevel = totalUsdc / gridCount;
    const levels = [];

    for (let i = 0; i < gridCount; i++) {
        const price = round(lowerPrice + i * step, 2);

        // Skip placing an order exactly at mark price (no edge - would fill immediately as wrong side)
        if (Math.abs(price - markPrice) / markPrice < 0.0005) continue;

        const side = price < markPrice ? 'buy' : 'sell';
        const size = round(usdcPerLevel / price, 6);

        if (size <= 0) continue;

        levels.push({ price, size, side });
    }

    return levels;
}

// ── Fetch Mark Price ──────────────────────────────────────────────────────────

/**
 * Fetches the current oracle/mark price for an asset via Hyperliquid's public info API.
 * Falls back to mid-price from L2 order book if mark price is unavailable.
 *
 * @param {Hyperliquid} sdk
 * @param {string} asset - e.g. "ETH"
 * @returns {Promise<number>} Mark price in USD
 */
async function fetchMarkPrice(sdk, asset) {
    return withRetry(async () => {
        // Attempt 1: allMids (oracle mark prices for all assets)
        const mids = await sdk.info.getAllMids();
        const ticker = `${asset}-USD`;

        if (mids[ticker]) {
            const price = parseFloat(mids[ticker]);
            if (!isNaN(price) && price > 0) return price;
        }

        // Attempt 2: direct asset lookup (no -USD suffix)
        if (mids[asset]) {
            const price = parseFloat(mids[asset]);
            if (!isNaN(price) && price > 0) return price;
        }

        // Fallback: L2 order book mid-price
        const book = await sdk.info.getL2Book({ coin: asset, nSigFigs: 5 });
        if (book?.levels?.[0]?.length && book?.levels?.[1]?.length) {
            const bestBid = parseFloat(book.levels[0][0].px);
            const bestAsk = parseFloat(book.levels[1][0].px);
            return round((bestBid + bestAsk) / 2, 2);
        }

        throw new Error(`Could not fetch mark price for ${asset}. Check asset name (e.g. "ETH", "BTC").`);
    });
}

// ── Place Single Order ─────────────────────────────────────────────────────────

/**
 * Places a single limit order on Hyperliquid, with retry logic.
 *
 * @param {Hyperliquid} sdk
 * @param {string} asset
 * @param {'buy'|'sell'} side
 * @param {number} price
 * @param {number} size
 * @returns {Promise<Object>} API response
 */
async function placeLimitOrder(sdk, asset, side, price, size) {
    return withRetry(async () => {
        const isBuy = side === 'buy';

        const orderRequest = {
            coin: asset,
            is_buy: isBuy,
            sz: size,
            limit_px: price,
            order_type: {
                limit: {
                    tif: 'Gtc', // Good-Til-Cancelled — stays open until filled or cancelled
                },
            },
            reduce_only: false,
        };

        const result = await sdk.exchange.order(orderRequest, 'na');
        return result;
    });
}

// ── Main Grid Bot Runner ───────────────────────────────────────────────────────

/**
 * Executes a full grid bot strategy on Hyperliquid.
 *
 * Called by bot.js when Claude AI parses a grid strategy intent.
 * Returns a structured result for Telegram reply or error messaging.
 *
 * @param {Object} intentData - Parsed intent from Claude AI
 * @param {string} intentData.asset        - "ETH", "BTC", "SOL", etc.
 * @param {number} intentData.lower_price  - Grid lower bound (USD)
 * @param {number} intentData.upper_price  - Grid upper bound (USD)
 * @param {number} intentData.grid_count   - Number of grid levels (min 2)
 * @param {number} intentData.total_usdc   - Total USDC capital to deploy
 * @param {string} [chatId]               - Telegram chat ID (for logging)
 *
 * @returns {Promise<{
 *   success: boolean,
 *   summary: string,
 *   stats: Object | null,
 *   error: string | null
 * }>}
 */
export async function runGridBot(intentData, chatId = 'unknown', userPrivateKey = null) {
    const { asset, lower_price, upper_price, grid_count, total_usdc } = intentData;

    // ── Input validation ──────────────────────────────────────────────────────
    const missingFields = ['asset', 'lower_price', 'upper_price', 'grid_count', 'total_usdc']
        .filter((f) => intentData[f] == null);

    if (missingFields.length > 0) {
        return {
            success: false,
            summary: null,
            stats: null,
            error: `❌ Missing required grid parameters: ${missingFields.join(', ')}.\n\nExample: "Set up a grid on ETH between $2800–$3200 with 20 grids and $1000 USDC"`,
        };
    }

    const lp = Number(lower_price);
    const up = Number(upper_price);
    const gc = Number(grid_count);
    const tu = Number(total_usdc);

    if (isNaN(lp) || isNaN(up) || isNaN(gc) || isNaN(tu)) {
        return { success: false, summary: null, stats: null, error: '❌ All grid parameters must be valid numbers.' };
    }

    console.log(`[GRID][${chatId}] Starting grid bot: ${asset} $${lp}–$${up} × ${gc} grids, $${tu} USDC`);

    // ── Initialize SDK ────────────────────────────────────────────────────────
    let sdk, isTestnet;
    try {
        ({ sdk, isTestnet } = initHyperliquid(userPrivateKey));
    } catch (err) {
        return {
            success: false,
            summary: null,
            stats: null,
            error: `❌ *Wallet/Key Configuration Error*\n\n${err.message}\n\nPlease set HL_PRIVATE_KEY and HL_WALLET_ADDRESS in your .env file.`,
        };
    }

    // ── Fetch mark price ──────────────────────────────────────────────────────
    let markPrice;
    try {
        markPrice = await fetchMarkPrice(sdk, asset);
        console.log(`[GRID][${chatId}] Current mark price for ${asset}: $${markPrice}`);
    } catch (err) {
        return {
            success: false,
            summary: null,
            stats: null,
            error: `❌ *Hyperliquid API Error*\n\nCould not fetch mark price for *${asset}*.\n\nDetails: ${err.message}\n\nCheck: Is the asset name correct? (e.g. ETH, BTC, SOL)`,
        };
    }

    // ── Validate mark price is inside the range ───────────────────────────────
    if (markPrice < lp || markPrice > up) {
        return {
            success: false,
            summary: null,
            stats: null,
            error: `⚠️ *Range Warning*\n\nCurrent ${asset} price ($${markPrice.toLocaleString()}) is outside your grid range ($${lp.toLocaleString()} – $${up.toLocaleString()}).\n\nA grid bot works best when price is within the range. Please adjust your range.`,
        };
    }

    // ── Calculate grid levels ─────────────────────────────────────────────────
    let levels;
    try {
        levels = calculateGridLevels(lp, up, gc, tu, markPrice);
        console.log(`[GRID][${chatId}] Computed ${levels.length} grid levels (${levels.filter(l => l.side === 'buy').length} buy, ${levels.filter(l => l.side === 'sell').length} sell)`);
    } catch (err) {
        return {
            success: false,
            summary: null,
            stats: null,
            error: `❌ *Grid Calculation Error*\n\n${err.message}`,
        };
    }

    // ── Place orders ──────────────────────────────────────────────────────────
    const results = { placed: [], failed: [] };

    for (const level of levels) {
        try {
            await sleep(DELAY_MS); // Rate limit protection
            const response = await placeLimitOrder(sdk, asset, level.side, level.price, level.size);
            results.placed.push({ ...level, response });
            console.log(`[GRID][${chatId}] ✓ ${level.side.toUpperCase()} ${level.size} ${asset} @ $${level.price}`);
        } catch (err) {
            const errMsg = err?.message || String(err);
            results.failed.push({ ...level, error: errMsg });
            console.error(`[GRID][${chatId}] ✗ FAILED ${level.side.toUpperCase()} @ $${level.price}: ${errMsg}`);

            // Hard stop on insufficient margin — no point continuing
            if (errMsg.toLowerCase().includes('margin') || errMsg.toLowerCase().includes('insufficient')) {
                console.error(`[GRID][${chatId}] Insufficient margin detected — halting grid placement.`);
                break;
            }
        }
    }

    // ── Build result summary ──────────────────────────────────────────────────
    const buyOrders = results.placed.filter((r) => r.side === 'buy');
    const sellOrders = results.placed.filter((r) => r.side === 'sell');
    const totalDeployed = results.placed.reduce((sum, r) => sum + r.price * r.size, 0);

    const stats = {
        asset,
        network: isTestnet ? 'Testnet' : '🔴 MAINNET',
        markPrice,
        lowerPrice: lp,
        upperPrice: up,
        gridCount: gc,
        totalUsdc: tu,
        levelsComputed: levels.length,
        ordersPlaced: results.placed.length,
        ordersFailed: results.failed.length,
        buyOrdersPlaced: buyOrders.length,
        sellOrdersPlaced: sellOrders.length,
        estimatedDeployedUsdc: round(totalDeployed, 2),
        usdcPerGrid: round(tu / gc, 2),
    };

    const hasErrors = results.failed.length > 0;

    if (results.placed.length === 0) {
        const failReason = results.failed[0]?.error || 'Unknown error';
        return {
            success: false,
            summary: null,
            stats,
            error: `❌ *Grid Bot: All Orders Failed*\n\nNo orders were placed successfully.\n\nFirst error: \`${failReason}\`\n\n*Possible causes:*\n• Insufficient margin/balance\n• Invalid asset name\n• API rate limiting\n• Network connectivity`,
        };
    }

    const summary =
        `✅ *Grid Bot Activated — ${asset} [${stats.network}]*\n\n` +
        `📊 *Grid Parameters:*\n` +
        `• Range: $${lp.toLocaleString()} – $${up.toLocaleString()}\n` +
        `• Grid Count: ${gc}\n` +
        `• Capital: $${tu.toLocaleString()} USDC (~$${stats.usdcPerGrid} per level)\n` +
        `• Mark Price: $${markPrice.toLocaleString()}\n\n` +
        `📈 *Orders Placed: ${results.placed.length}/${levels.length}*\n` +
        `• 🟢 Limit Buys:  ${buyOrders.length} orders (below $${markPrice.toLocaleString()})\n` +
        `• 🔴 Limit Sells: ${sellOrders.length} orders (above $${markPrice.toLocaleString()})\n` +
        `• 💵 Deployed: ~$${stats.estimatedDeployedUsdc.toLocaleString()} USDC\n` +
        (hasErrors ? `\n⚠️ *${results.failed.length} order(s) failed to place.* Check logs for details.\n` : '') +
        `\n_Grid is now running 24/7. Use /cancelgrid to stop._`;

    return {
        success: true,
        summary,
        stats,
        error: null,
        failedOrders: results.failed,
    };
}
