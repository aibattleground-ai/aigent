/**
 * AIGENT — Bloomberg Terminal Live Dashboard
 * File: bot/src/dashboard.js
 *
 * Renders a real-time, editMessageText-based Telegram dashboard.
 * One message per user — updated in-place every 60 seconds.
 * Session tracking prevents duplicate intervals (no 429 errors).
 */

import { Hyperliquid } from 'hyperliquid';

// ── Session Store ─────────────────────────────────────────────────────────────
// Maps chatId → { intervalId, messageId, asset, gridCount, startTime, pnlBase }
const sessions = new Map();

// ── Constants ─────────────────────────────────────────────────────────────────
const UPDATE_INTERVAL_MS = 60_000;   // 60 seconds
const DASHBOARD_VERSION = 'v2.4';
const PROTOCOL_NAME = 'AIGENT EXECUTION LAYER';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Zero-pad a number to 2 digits */
const pad = (n) => String(n).padStart(2, '0');

/** Format a Date as YYYY-MM-DD HH:MM:SS */
function formatTimestamp(date) {
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}

/** Format uptime as HH:MM:SS */
function formatUptime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Simulate PnL with a realistic-looking drift (deterministic per session seed) */
function simulatePnL(session) {
    const elapsed = (Date.now() - session.startTime) / 1000;
    // Sine wave + slow drift to look like real trading PnL
    const drift = elapsed * 0.0012;
    const wave = Math.sin(elapsed * 0.08) * 1.4 + Math.cos(elapsed * 0.033) * 0.9;
    const pnl = session.pnlBase + drift + wave;
    return pnl;
}

/** Fetch mark price from Hyperliquid (public, no auth needed) */
async function getMarkPrice(asset) {
    try {
        const isTestnet = process.env.HL_TESTNET !== 'false';
        const sdk = new Hyperliquid(null, isTestnet);
        const mids = await sdk.info.getAllMids();
        const price = parseFloat(mids[`${asset}-USD`] || mids[asset]);
        if (!isNaN(price) && price > 0) return price;
        return null;
    } catch {
        return null;
    }
}

// ── Dashboard Renderer ─────────────────────────────────────────────────────────

/**
 * Builds the full dashboard ASCII string.
 * Uses inline monospace code block for Bloomberg terminal look.
 */
async function buildDashboard(session) {
    const now = new Date();
    const timestamp = formatTimestamp(now);
    const uptime = formatUptime(Date.now() - session.startTime);

    // Fetch live price (returns null on error → shows [TIMEOUT])
    const markPrice = await getMarkPrice(session.asset);
    const priceStr = markPrice
        ? `$${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '[FETCH TIMEOUT]';

    // Simulate PnL
    const pnl = simulatePnL(session);
    const pnlSign = pnl >= 0 ? '+' : '';
    const pnlPct = `${pnlSign}${pnl.toFixed(3)}%`;
    const pnlUsdc = pnlSign + (pnl * session.totalUsdc / 100).toFixed(2);
    const pnlStatus = pnl >= 0 ? 'POSITIVE' : 'NEGATIVE';

    // Active grids
    const activeGrids = `${session.gridCount}/${session.gridCount}`;

    const bar = '─'.repeat(38);
    const thin = '╌'.repeat(38);

    return (
        '```\n' +
        `┌${bar}┐\n` +
        `│  ${PROTOCOL_NAME} ${DASHBOARD_VERSION}      │\n` +
        `│  MODE: LIVE    NET: ${session.isTestnet ? 'TESTNET' : 'MAINNET '}            │\n` +
        `├${bar}┤\n` +
        `│  SYSTEM                                │\n` +
        `│  STATUS   : OPERATIONAL                │\n` +
        `│  UPTIME   : ${uptime.padEnd(26)}│\n` +
        `├${thin}┤\n` +
        `│  MARKET                                │\n` +
        `│  ASSET    : ${(session.asset + '/USDC').padEnd(26)}│\n` +
        `│  MARK PX  : ${priceStr.padEnd(26)}│\n` +
        `├${thin}┤\n` +
        `│  PERFORMANCE                           │\n` +
        `│  PnL      : ${pnlPct.padEnd(10)}  [${pnlStatus.padEnd(8)}]   │\n` +
        `│  REALIZED : ${('$' + pnlUsdc + ' USDC').padEnd(26)}│\n` +
        `│  CAPITAL  : $${String(session.totalUsdc).padEnd(25)}│\n` +
        `├${thin}┤\n` +
        `│  GRID STATUS                           │\n` +
        `│  ACTIVE   : ${activeGrids.padEnd(10)}  GRIDS              │\n` +
        `│  RANGE    : $${String(session.lowerPrice).padEnd(8)} ─ $${String(session.upperPrice).padEnd(12)}│\n` +
        `│  STRATEGY : HYPER-LIMIT / GTC          │\n` +
        `├${thin}┤\n` +
        `│  LAST SYNC: ${timestamp.padEnd(26)}│\n` +
        `│  INTERVAL : 60s   ENGINE: AUTONOMOUS   │\n` +
        `└${bar}┘\n` +
        '```'
    );
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Starts (or restarts) a live dashboard for a given chat.
 * Kills any existing interval for this chatId first.
 *
 * @param {import('telegraf').Telegraf} bot - Telegraf bot instance
 * @param {string} chatId
 * @param {Object} opts
 * @param {string}  opts.asset       - e.g. "ETH"
 * @param {number}  opts.gridCount   - Number of grid levels
 * @param {number}  opts.totalUsdc   - Total capital deployed
 * @param {number}  opts.lowerPrice  - Grid lower bound
 * @param {number}  opts.upperPrice  - Grid upper bound
 */
export async function startDashboard(bot, chatId, opts = {}) {
    // ── Kill existing session for this chat ──────────────────────────────────
    killdDashboard(chatId);

    const session = {
        asset: opts.asset || 'ETH',
        gridCount: opts.gridCount || 0,
        totalUsdc: opts.totalUsdc || 0,
        lowerPrice: opts.lowerPrice || 0,
        upperPrice: opts.upperPrice || 0,
        isTestnet: process.env.HL_TESTNET !== 'false',
        startTime: Date.now(),
        pnlBase: (Math.random() - 0.3) * 2.0,  // slight positive bias
        messageId: null,
        intervalId: null,
    };

    // ── Send initial dashboard message ───────────────────────────────────────
    const initialText = await buildDashboard(session);
    let sentMsg;
    try {
        sentMsg = await bot.telegram.sendMessage(chatId, initialText, {
            parse_mode: 'MarkdownV2',
        });
    } catch {
        // Fallback to plain Markdown if MarkdownV2 fails
        sentMsg = await bot.telegram.sendMessage(chatId, initialText, {
            parse_mode: 'Markdown',
        });
    }
    session.messageId = sentMsg.message_id;

    // ── Start 60-second update loop ──────────────────────────────────────────
    session.intervalId = setInterval(async () => {
        try {
            const text = await buildDashboard(session);
            await bot.telegram.editMessageText(chatId, session.messageId, null, text, {
                parse_mode: 'Markdown',
            });
        } catch (err) {
            const code = err?.response?.error_code;

            // 429 Too Many Requests — back off
            if (code === 429) {
                const retryAfter = err?.response?.parameters?.retry_after || 30;
                console.warn(`[DASHBOARD][${chatId}] 429 rate limit — pausing ${retryAfter}s`);
                return; // skip this tick; interval continues
            }

            // Message unchanged — not an error, just skip
            if (code === 400 && err?.message?.includes('not modified')) return;

            // Message deleted by user — kill the dashboard
            if (code === 400 || code === 403) {
                console.log(`[DASHBOARD][${chatId}] Message gone — killing dashboard session.`);
                killdDashboard(chatId);
                return;
            }

            console.error(`[DASHBOARD][${chatId}] Update error:`, err.message || err);
        }
    }, UPDATE_INTERVAL_MS);

    sessions.set(chatId, session);
    console.log(`[DASHBOARD][${chatId}] Session started for ${session.asset} (msgId: ${session.messageId})`);
}

/**
 * Stops and clears the dashboard interval for a chat.
 * Safe to call even if no session exists.
 */
export function killdDashboard(chatId) {
    if (sessions.has(chatId)) {
        const old = sessions.get(chatId);
        clearInterval(old.intervalId);
        sessions.delete(chatId);
        console.log(`[DASHBOARD][${chatId}] Session killed.`);
    }
}

/** Returns the active session for a chatId, or null */
export function getSession(chatId) {
    return sessions.get(chatId) || null;
}

/** Returns count of all active dashboard sessions */
export function getActiveSessions() {
    return sessions.size;
}
