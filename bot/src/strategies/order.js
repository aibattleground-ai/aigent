/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AIGENT — Universal Order Executor (Hyperliquid)
 * File: bot/src/strategies/order.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PACKAGES ALREADY INSTALLED (from grid bot setup):
 *   npm install hyperliquid ethers
 *
 * REQUIRED .env VARIABLES:
 *   HL_PRIVATE_KEY=0x...       ← Hyperliquid wallet private key
 *   HL_WALLET_ADDRESS=0x...    ← Hyperliquid wallet address (public)
 *   HL_TESTNET=true            ← Set to false for mainnet (CAUTION!)
 *
 * SUPPORTED INTENT FIELDS:
 *   asset      {string}  — e.g. "BTC", "ETH", "SOL", "ARB"
 *   action     {string}  — "buy" or "sell"
 *   type       {string}  — "market" or "limit"
 *   size_usd   {number}  — Notional value in USD (e.g. 500)
 *   leverage   {number}  — Leverage multiplier (1–50, default 1)
 *   limit_px   {number}  — Required if type = "limit"
 *
 * HOW SIZE IS CALCULATED:
 *   1. Fetch current mark price from Hyperliquid (public API)
 *   2. contract_size = (size_usd × leverage) / mark_price
 *   3. Round to 5 decimal places (HL precision)
 *
 * MARKET ORDER IMPLEMENTATION:
 *   Hyperliquid has no native "market" order type via SDK.
 *   We emulate it with an aggressive IOC (Immediate-Or-Cancel) limit order:
 *   - Buy  → limit at markPrice × 1.005  (+0.5% slippage buffer)
 *   - Sell → limit at markPrice × 0.995  (-0.5% slippage buffer)
 *   This guarantees near-instant fill while avoiding manipulation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Hyperliquid } from 'hyperliquid';
import { ethers } from 'ethers';

// ── Constants ──────────────────────────────────────────────────────────────────
const MARKET_SLIPPAGE = 0.005;   // 0.5% slippage for market order emulation
const MAX_LEVERAGE = 50;
const MIN_SIZE_USD = 10;      // Hyperliquid minimum notional
const PRICE_DECIMALS = 2;
const SIZE_DECIMALS = 5;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n, d) => parseFloat(n.toFixed(d));

/**
 * Initializes an authenticated Hyperliquid SDK instance.
 * Priority: userPrivateKey (per-user from DB) → HL_PRIVATE_KEY (.env fallback)
 *
 * @param {string} [userPrivateKey] - Optional per-user private key from DB
 */
function initSDK(userPrivateKey) {
    const privateKey = userPrivateKey || process.env.HL_PRIVATE_KEY;

    if (!privateKey || privateKey === 'your_private_key_here') {
        throw new Error(
            'No private key available.\n' +
            'Complete onboarding via /start, or set HL_PRIVATE_KEY in .env.'
        );
    }

    // Validate private key format (ethers will throw if invalid)
    try {
        new ethers.Wallet(privateKey);
    } catch {
        throw new Error('Private key is invalid. Ensure it is a valid 32-byte hex string (0x...).');
    }

    const isTestnet = process.env.HL_TESTNET !== 'false';
    const sdk = new Hyperliquid(privateKey, isTestnet);

    return { sdk, isTestnet };
}

/**
 * Fetches the current mark price for an asset.
 * Tries allMids first, falls back to L2 book mid-price.
 *
 * @param {Hyperliquid} sdk
 * @param {string} asset
 * @returns {Promise<number>}
 */
async function fetchMarkPrice(sdk, asset) {
    const mids = await sdk.info.getAllMids();

    // Try with and without -USD suffix
    const candidates = [`${asset}-USD`, `${asset}-PERP`, asset];
    for (const key of candidates) {
        const price = parseFloat(mids[key]);
        if (!isNaN(price) && price > 0) return price;
    }

    // L2 book fallback
    try {
        const book = await sdk.info.getL2Book({ coin: asset, nSigFigs: 5 });
        if (book?.levels?.[0]?.length && book?.levels?.[1]?.length) {
            const bid = parseFloat(book.levels[0][0].px);
            const ask = parseFloat(book.levels[1][0].px);
            return round((bid + ask) / 2, PRICE_DECIMALS);
        }
    } catch { /* fall through */ }

    throw new Error(
        `Asset "${asset}" not found on Hyperliquid.\n` +
        `Common tickers: BTC, ETH, SOL, ARB, AVAX, MATIC, DOGE.\n` +
        `Check the exact ticker at https://app.hyperliquid.xyz/trade`
    );
}

/**
 * Sets leverage for an asset on Hyperliquid.
 * Silently ignores if leverage is already set (idempotent).
 *
 * @param {Hyperliquid} sdk
 * @param {string} asset
 * @param {number} leverage
 */
async function setLeverage(sdk, asset, leverage) {
    try {
        await sdk.exchange.updateLeverage({
            coin: asset,
            is_cross: true,        // cross-margin (safer default)
            leverage: Math.round(leverage),
        });
    } catch (err) {
        // Non-fatal: leverage might already be set, or asset uses isolated margin
        console.warn(`[ORDER] Leverage set skipped for ${asset}: ${err?.message}`);
    }
}

/**
 * Retries an async function with exponential backoff.
 */
async function withRetry(fn, attempts = RETRY_ATTEMPTS) {
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
        try { return await fn(); } catch (err) {
            lastErr = err;
            if (i < attempts) await sleep(RETRY_DELAY_MS * i);
        }
    }
    throw lastErr;
}

// ── Order Classification ───────────────────────────────────────────────────────

/**
 * Classifies an error message into a human-readable Telegram reply.
 * @param {Error} err
 * @param {Object} intent
 * @returns {string}
 */
function classifyError(err, intent) {
    const msg = (err?.message || String(err)).toLowerCase();

    if (msg.includes('margin') || msg.includes('insufficient') || msg.includes('balance')) {
        return (
            `*Insufficient Margin / Balance*\n\n` +
            `You do not have enough USDC margin to place this order.\n\n` +
            `Requested: $${intent.size_usd} × ${intent.leverage}x = ~$${(intent.size_usd * (intent.leverage || 1)).toFixed(0)} notional\n\n` +
            `Deposit USDC on Hyperliquid and try again.`
        );
    }
    if (msg.includes('leverage') || msg.includes('max_leverage')) {
        return (
            `*Leverage Limit Exceeded*\n\n` +
            `Requested leverage: ${intent.leverage}x\n` +
            `Maximum allowed for ${intent.asset}: check Hyperliquid docs.\n\n` +
            `Try reducing leverage (e.g. \`leverage: 10\`).`
        );
    }
    if (msg.includes('not found') || msg.includes('unknown coin') || msg.includes('asset')) {
        return (
            `*Unsupported Asset: ${intent.asset}*\n\n` +
            `This ticker is not listed on Hyperliquid perps.\n` +
            `Check available markets at https://app.hyperliquid.xyz`
        );
    }
    if (msg.includes('private_key') || msg.includes('wallet')) {
        return (
            `*Wallet Configuration Error*\n\n` +
            `${err.message}\n\n` +
            `Set HL_PRIVATE_KEY and HL_WALLET_ADDRESS in your .env file.`
        );
    }
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused')) {
        return (
            `*Network / API Error*\n\n` +
            `Could not connect to Hyperliquid API.\n` +
            `Check your internet connection or try again in a few seconds.`
        );
    }
    if (msg.includes('reduce_only') || msg.includes('position')) {
        return (
            `*Position Error*\n\n` +
            `This order conflicts with your current open position.\n` +
            `Close or reduce your existing ${intent.asset} position first.`
        );
    }

    // Generic fallback
    return (
        `*Order Execution Error*\n\n` +
        `\`${err.message || 'Unknown error'}\`\n\n` +
        `Asset: ${intent.asset} | Action: ${intent.action} | Type: ${intent.type}`
    );
}

// ── Main Executor ──────────────────────────────────────────────────────────────

/**
 * Executes a universal order on Hyperliquid.
 *
 * Handles market orders (IOC emulation) and limit orders (GTC).
 * Dynamically calculates contract size from USD notional + leverage.
 *
 * @param {Object} intentData
 * @param {string} intentData.asset       — Ticker (e.g. "ETH", "BTC")
 * @param {string} intentData.action      — "buy" or "sell"
 * @param {string} intentData.type        — "market" or "limit"
 * @param {number} intentData.size_usd    — USD notional (e.g. 500)
 * @param {number} [intentData.leverage]  — Leverage (1–50, default 1)
 * @param {number} [intentData.limit_px]  — Required if type = "limit"
 *
 * @returns {Promise<{
 *   success: boolean,
 *   summary: string | null,
 *   error:   string | null,
 *   details: Object | null
 * }>}
 */
export async function executeUniversalOrder(intentData, userPrivateKey = null) {
    // ── 1. Validate inputs ─────────────────────────────────────────────────
    const {
        asset,
        action,
        type = 'market',
        size_usd,
        leverage = 1,
        limit_px,
    } = intentData;

    const REQUIRED = { asset, action, size_usd };
    const missing = Object.entries(REQUIRED).filter(([, v]) => v == null).map(([k]) => k);
    if (missing.length > 0) {
        return {
            success: false,
            summary: null,
            error: `*Missing Parameters:* \`${missing.join(', ')}\`\n\nExample: "Buy $500 of ETH at 10x leverage"`,
            details: null,
        };
    }

    const assetUpper = String(asset).toUpperCase().trim();
    const actionLower = String(action).toLowerCase().trim();
    const typeLower = String(type).toLowerCase().trim();
    const sizeUsd = Number(size_usd);
    const lev = Math.min(Math.max(Number(leverage) || 1, 1), MAX_LEVERAGE);

    if (!['buy', 'sell'].includes(actionLower)) {
        return { success: false, summary: null, error: `*Invalid action:* \`${action}\`\nUse "buy" or "sell".`, details: null };
    }
    if (!['market', 'limit'].includes(typeLower)) {
        return { success: false, summary: null, error: `*Invalid order type:* \`${type}\`\nUse "market" or "limit".`, details: null };
    }
    if (isNaN(sizeUsd) || sizeUsd < MIN_SIZE_USD) {
        return { success: false, summary: null, error: `*Invalid size:* Minimum order is $${MIN_SIZE_USD} USD.`, details: null };
    }
    if (typeLower === 'limit' && !limit_px) {
        return { success: false, summary: null, error: `*Limit price required.*\nSpecify a price for limit orders.\nExample: "Buy $500 ETH limit at $3,200"`, details: null };
    }

    console.log(`[ORDER] ${actionLower.toUpperCase()} ${assetUpper} | type=${typeLower} | $${sizeUsd} | ${lev}x leverage`);

    // ── 2. Initialize SDK ──────────────────────────────────────────────────
    let sdk, isTestnet;
    try {
        ({ sdk, isTestnet } = initSDK(userPrivateKey));
    } catch (err) {
        return { success: false, summary: null, error: classifyError(err, intentData), details: null };
    }

    // ── 3. Fetch mark price ────────────────────────────────────────────────
    let markPrice;
    try {
        markPrice = await withRetry(() => fetchMarkPrice(sdk, assetUpper));
        console.log(`[ORDER] Mark price for ${assetUpper}: $${markPrice}`);
    } catch (err) {
        return { success: false, summary: null, error: classifyError(err, intentData), details: null };
    }

    // ── 4. Calculate contract size ─────────────────────────────────────────
    //   size_usd × leverage = total notional
    //   contracts = notional / mark_price
    const notional = sizeUsd * lev;
    const contractSize = round(notional / markPrice, SIZE_DECIMALS);

    if (contractSize <= 0) {
        return { success: false, summary: null, error: `*Calculated size is zero.*\nTry increasing size_usd or reducing leverage.`, details: null };
    }

    // ── 5. Set leverage (non-fatal) ─────────────────────────────────────────
    if (lev > 1) {
        await setLeverage(sdk, assetUpper, lev);
    }

    // ── 6. Build order request ─────────────────────────────────────────────
    const isBuy = actionLower === 'buy';

    let orderPrice;
    let orderType;

    if (typeLower === 'market') {
        // IOC emulation: aggressive limit with slippage buffer
        orderPrice = isBuy
            ? round(markPrice * (1 + MARKET_SLIPPAGE), PRICE_DECIMALS)
            : round(markPrice * (1 - MARKET_SLIPPAGE), PRICE_DECIMALS);
        orderType = { limit: { tif: 'Ioc' } };   // Immediate-Or-Cancel
    } else {
        // Standard GTC limit order
        orderPrice = round(Number(limit_px), PRICE_DECIMALS);
        orderType = { limit: { tif: 'Gtc' } };   // Good-Til-Cancelled
    }

    const orderRequest = {
        coin: assetUpper,
        is_buy: isBuy,
        sz: contractSize,
        limit_px: orderPrice,
        order_type: orderType,
        reduce_only: false,
    };

    console.log(`[ORDER] Submitting:`, JSON.stringify(orderRequest));

    // ── 7. Submit order (with retry) ───────────────────────────────────────
    let response;
    try {
        response = await withRetry(() => sdk.exchange.order(orderRequest, 'na'));
        console.log(`[ORDER] Response:`, JSON.stringify(response));
    } catch (err) {
        return { success: false, summary: null, error: classifyError(err, intentData), details: null };
    }

    // ── 8. Parse response status ───────────────────────────────────────────
    //   HL SDK returns { statuses: [{ filled | resting | error }] }
    const statuses = response?.response?.data?.statuses || [];
    const firstStatus = statuses[0] || {};

    if (firstStatus.error) {
        const syntheticErr = new Error(firstStatus.error);
        return { success: false, summary: null, error: classifyError(syntheticErr, intentData), details: firstStatus };
    }

    const isFilled = !!firstStatus.filled;
    const isResting = !!firstStatus.resting;
    const orderId = firstStatus.filled?.oid || firstStatus.resting?.oid || 'N/A';
    const avgFillPx = firstStatus.filled?.avgPx ? `$${parseFloat(firstStatus.filled.avgPx).toLocaleString()}` : 'Pending';

    // ── 9. Build Telegram summary ──────────────────────────────────────────
    const statusLine = isFilled ? '✓ FILLED' : isResting ? '◆ RESTING (GTC)' : '◆ SUBMITTED';
    const network = isTestnet ? 'TESTNET' : '⚠️ MAINNET';

    const summary =
        `*Order Executed — ${network}*\n\n` +
        `\`\`\`\n` +
        `ASSET    : ${assetUpper}/USDC\n` +
        `ACTION   : ${actionLower.toUpperCase()}\n` +
        `TYPE     : ${typeLower.toUpperCase()} ${typeLower === 'market' ? '(IOC)' : '(GTC)'}\n` +
        `SIZE     : ${contractSize} contracts\n` +
        `NOTIONAL : $${notional.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD\n` +
        `LEVERAGE : ${lev}x\n` +
        `MARK PX  : $${markPrice.toLocaleString()}\n` +
        `ORDER PX : $${orderPrice.toLocaleString()}\n` +
        `AVG FILL : ${avgFillPx}\n` +
        `ORDER ID : ${orderId}\n` +
        `STATUS   : ${statusLine}\n` +
        `\`\`\``;

    const details = {
        asset: assetUpper,
        action: actionLower,
        type: typeLower,
        sizeUsd,
        leverage: lev,
        notional,
        contractSize,
        markPrice,
        orderPrice,
        orderId,
        status: isFilled ? 'filled' : 'resting',
        isTestnet,
        raw: response,
    };

    console.log(`[ORDER] SUCCESS: ${actionLower} ${contractSize} ${assetUpper} @ $${orderPrice} (id: ${orderId})`);
    return { success: true, summary, error: null, details };
}
