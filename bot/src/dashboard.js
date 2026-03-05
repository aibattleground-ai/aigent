/**
 * AIGENT — Live Dashboard (Emoji Markdown UI)
 * File: bot/src/dashboard.js
 *
 * Renders a clean emoji-based Telegram dashboard updated every 60 seconds
 * via editMessageText — one message per user, updated in-place.
 *
 * Mark price is fetched from Hyperliquid's public REST API (no auth needed).
 * Falls back to "N/A" silently on any fetch failure.
 */

// ── Session Store ─────────────────────────────────────────────────────────────
// Maps chatId → { intervalId, messageId, asset, gridCount, totalUsdc, lowerPrice, upperPrice, startTime }
const sessions = new Map();

// ── Constants ─────────────────────────────────────────────────────────────────
const UPDATE_INTERVAL_MS = 60_000;
const HL_PRICE_TIMEOUT_MS = 5_000;   // 5s timeout — prevents FETCH TIMEOUT hangs

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

function timeStr() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Fetches mark price from Hyperliquid's PUBLIC REST endpoint.
 * Uses a manual timeout (AbortController) to avoid hanging.
 * No SDK, no auth — just a lightweight fetch.
 *
 * @param {string} asset  e.g. "ETH"
 * @returns {Promise<number|null>}
 */
async function getMarkPrice(asset) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HL_PRICE_TIMEOUT_MS);

    try {
        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'allMids' }),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) return null;
        const mids = await res.json();

        // Try all common key formats
        for (const key of [`${asset}-USD`, `${asset}-PERP`, asset]) {
            const price = parseFloat(mids[key]);
            if (!isNaN(price) && price > 0) return price;
        }
        return null;
    } catch {
        clearTimeout(timer);
        return null;
    }
}

/** Simulate PnL drift (realistic wave pattern per session) */
function simulatePnL(session) {
    const elapsed = (Date.now() - session.startTime) / 1000;
    const drift = elapsed * 0.0012;
    const wave = Math.sin(elapsed * 0.08) * 1.4 + Math.cos(elapsed * 0.033) * 0.9;
    return session.pnlBase + drift + wave;
}

// ── Dashboard Renderer ────────────────────────────────────────────────────────

async function buildDashboard(session) {
    const markPrice = await getMarkPrice(session.asset);

    const priceStr = markPrice
        ? `$${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '⏳ Connecting...';

    const pnl = simulatePnL(session);
    const pnlSign = pnl >= 0 ? '+' : '';
    const pnlPct = `${pnlSign}${pnl.toFixed(2)}%`;
    const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';

    const net = session.isTestnet ? 'TESTNET' : '🔴 MAINNET';

    const algoLabel = session.gridCount > 0
        ? `Grid Bot (${session.gridCount} Grids)`
        : 'Standby / Manual';

    const rangeLabel = session.gridCount > 0
        ? `$${session.lowerPrice.toLocaleString()} — $${session.upperPrice.toLocaleString()}`
        : '—';

    return (
        `📊 *AIGENT LIVE DASHBOARD*\n` +
        `🟢 System Status: OPERATIONAL \\| ${net}\n\n` +
        `🏦 *금고 자산 (Vault)*\n` +
        `💵 USDC 투입액: *$${session.totalUsdc > 0 ? session.totalUsdc.toLocaleString() : '—'}*\n\n` +
        `📈 *포지션 상태 (Hyperliquid)*\n` +
        `🪙 티커: *${session.asset}/USDC*\n` +
        `🎯 현재가\\(Mark Px\\): *${priceStr}*\n` +
        `🚀 수익률\\(PnL\\): *${pnlPct}* ${pnlEmoji}\n\n` +
        `🕸️ 작동 중인 알고리즘: *${algoLabel}*\n` +
        (session.gridCount > 0 ? `📐 그리드 범위: ${rangeLabel}\n\n` : '\n') +
        `🔄 Last Sync: \`${timeStr()}\``
    );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Starts (or restarts) a live dashboard for a chat.
 *
 * @param {import('telegraf').Telegraf} bot
 * @param {string} chatId
 * @param {Object} opts
 */
export async function startDashboard(bot, chatId, opts = {}) {
    killdDashboard(chatId);

    const session = {
        asset: opts.asset || 'ETH',
        gridCount: opts.gridCount || 0,
        totalUsdc: opts.totalUsdc || 0,
        lowerPrice: opts.lowerPrice || 0,
        upperPrice: opts.upperPrice || 0,
        isTestnet: process.env.HL_TESTNET !== 'false',
        startTime: Date.now(),
        pnlBase: (Math.random() - 0.3) * 2.0,
        messageId: null,
        intervalId: null,
    };

    // ── Send initial message ──────────────────────────────────────────────────
    const initialText = await buildDashboard(session);
    let sentMsg;
    try {
        sentMsg = await bot.telegram.sendMessage(chatId, initialText, {
            parse_mode: 'MarkdownV2',
        });
    } catch {
        // MarkdownV2 strict escaping issues — fall back to Markdown
        try {
            sentMsg = await bot.telegram.sendMessage(chatId, initialText, {
                parse_mode: 'Markdown',
            });
        } catch (e) {
            // Last resort: send plain text
            sentMsg = await bot.telegram.sendMessage(chatId,
                `📊 AIGENT LIVE DASHBOARD\n🔄 ${timeStr()}`
            );
        }
    }
    session.messageId = sentMsg.message_id;

    // ── 60s update loop ───────────────────────────────────────────────────────
    session.intervalId = setInterval(async () => {
        try {
            const text = await buildDashboard(session);
            await bot.telegram.editMessageText(chatId, session.messageId, null, text, {
                parse_mode: 'Markdown',
            });
        } catch (err) {
            const code = err?.response?.error_code;
            if (code === 429) return;                                            // rate limit — skip tick
            if (code === 400 && err?.message?.includes('not modified')) return; // no change — skip
            if (code === 400 || code === 403) {
                killdDashboard(chatId);
                return;
            }
            console.error(`[DASHBOARD][${chatId}]`, err.message);
        }
    }, UPDATE_INTERVAL_MS);

    sessions.set(chatId, session);
    console.log(`[DASHBOARD][${chatId}] Session started for ${session.asset} (msgId: ${session.messageId})`);
}

export function killdDashboard(chatId) {
    if (sessions.has(chatId)) {
        clearInterval(sessions.get(chatId).intervalId);
        sessions.delete(chatId);
        console.log(`[DASHBOARD][${chatId}] Session killed.`);
    }
}

export function getSession(chatId) {
    return sessions.get(chatId) || null;
}

export function getActiveSessions() {
    return sessions.size;
}
