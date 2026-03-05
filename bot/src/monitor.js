/**
 * AIGENT — Live Position Monitor & Smart Alerts
 * File: bot/src/monitor.js
 *
 * Tracks open Hyperliquid positions in real-time:
 *   - Every 60s: edits the LIVE POSITION message silently (no new spam)
 *   - On milestone crossings: fires a push notification
 *   - On position close or zero equity: clears the interval (no memory leak)
 *
 * Profit milestones:  +10%, +20%, +50%, +100%
 * Loss milestones:    -20%, -50%
 */

// ── Session Store (per chatId) ─────────────────────────────────────────────────
const monitors = new Map();
/*
  monitors.get(chatId) = {
    intervalId:        NodeJS.Timeout,
    messageId:         number,         // Telegram message ID of the LIVE card
    asset:             string,         // 'ETH', 'BTC', etc.
    walletAddress:     string,
    triggeredMilestones: Set<number>,  // e.g. { 10, 20 } = already notified
    lastRoe:           number,         // last known ROE (for display)
    lastUpnl:          number,
    bot:               Telegraf,
    lang:              string,
  }
*/

// ── Constants ──────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000;          // 1 minute
const FETCH_TIMEOUT_MS = 5_000;

const PROFIT_MILESTONES = [10, 20, 50, 100];  // percentage ROE
const LOSS_MILESTONES = [-20, -50];          // percentage ROE

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
function timeStr() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Fetches position data from HL clearinghouseState.
 * Returns { position, equity } or null on failure.
 */
async function fetchHlPosition(walletAddress, asset) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: walletAddress }),
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) return null;
        const data = await res.json();

        const equity = parseFloat(data?.marginSummary?.accountValue ?? '0');
        const positions = data?.assetPositions ?? [];
        const pos = positions.find(p => p?.position?.coin === asset);

        if (!pos) return { equity, position: null };

        const p = pos.position;
        return {
            equity,
            position: {
                coin: p.coin,
                size: parseFloat(p.szi ?? '0'),
                entryPx: parseFloat(p.entryPx ?? '0'),
                unrealizedPnl: parseFloat(p.unrealizedPnl ?? '0'),
                roe: parseFloat(p.returnOnEquity ?? '0'),  // fraction e.g. 0.12
                leverage: parseFloat(p.leverage?.value ?? '1'),
                side: parseFloat(p.szi ?? '0') > 0 ? 'LONG' : 'SHORT',
            },
        };
    } catch {
        clearTimeout(timer);
        return null;
    }
}

/** Builds the LIVE POSITION card text */
function buildLiveCard(session, state) {
    const { asset } = session;
    const { position, equity } = state;

    const equityStr = `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (!position) {
        return (
            `🏁 *POSITION CLOSED*\n\n` +
            `🪙 Asset: *${asset}/USDC*\n` +
            `🏦 HL Exchange Balance: *${equityStr}*\n\n` +
            `_Position monitor stopped._\n` +
            `🔄 Last Check: \`${timeStr()}\``
        );
    }

    const { side, size, entryPx, unrealizedPnl, roe, leverage } = position;
    const roePct = (roe * 100).toFixed(2);
    const pnlSign = unrealizedPnl >= 0 ? '+' : '';
    const pnlEmoji = unrealizedPnl >= 0 ? '🟢' : '🔴';
    const sideEmoji = side === 'LONG' ? '🔼' : '🔽';

    return (
        `🔴 *LIVE POSITION — ${asset}/USDC*\n\n` +
        `${sideEmoji} Direction: *${side}* ${leverage}x\n` +
        `📐 Size: *${Math.abs(size).toFixed(4)} ${asset}*\n` +
        `🎯 Entry: *$${entryPx.toLocaleString('en-US', { minimumFractionDigits: 2 })}*\n\n` +
        `${pnlEmoji} Unrealized PnL: *${pnlSign}$${Math.abs(unrealizedPnl).toFixed(2)}*\n` +
        `🚀 ROE: *${pnlSign}${roePct}%*\n\n` +
        `🏦 HL Balance: *${equityStr}*\n` +
        `🔄 Last Sync: \`${timeStr()}\``
    );
}

/** Returns the first triggered profit or loss milestone, or null */
function checkMilestone(roe, triggeredSet) {
    const roePct = roe * 100;

    for (const m of PROFIT_MILESTONES) {
        if (roePct >= m && !triggeredSet.has(m)) return m;
    }
    for (const m of LOSS_MILESTONES) {
        if (roePct <= m && !triggeredSet.has(m)) return m;
    }
    return null;
}

/** Builds the milestone push alert text */
function buildMilestoneAlert(asset, side, roePct, milestone, lang = 'en') {
    const isProfit = milestone > 0;
    const sign = isProfit ? '+' : '';
    const ALERTS = {
        ko: isProfit
            ? `🚀 *JACKPOT!*\n\n현재 *${asset}* ${side} 포지션 수익률이 *${sign}${milestone}%*를 돌파했습니다!\n💰 현재 ROE: *${sign}${roePct.toFixed(2)}%*\n\n_포지션을 계속 홀드하거나 부분 익절을 고려하세요._`
            : `⚠️ *WARNING!*\n\n현재 *${asset}* ${side} 포지션 손실이 *${milestone}%*에 도달했습니다.\n📉 현재 ROE: *${roePct.toFixed(2)}%*\n\n_물타기(DCA)를 진행하시겠습니까? 아니면 손절하시겠습니까?_`,
        en: isProfit
            ? `🚀 *JACKPOT!*\n\n*${asset}* ${side} position ROE just crossed *${sign}${milestone}%*!\n💰 Current ROE: *${sign}${roePct.toFixed(2)}%*\n\n_Consider holding or taking partial profits._`
            : `⚠️ *WARNING!*\n\n*${asset}* ${side} position loss reached *${milestone}%*.\n📉 Current ROE: *${roePct.toFixed(2)}%*\n\n_Consider DCA or cutting your losses._`,
    };
    return ALERTS[lang] || ALERTS.en;
}

// ── Core Poll Loop ────────────────────────────────────────────────────────────

async function tick(chatId) {
    const session = monitors.get(chatId);
    if (!session) return;

    const { bot, asset, walletAddress, triggeredMilestones, lang } = session;

    const state = await fetchHlPosition(walletAddress, asset);
    if (!state) return; // network error — skip tick, try next minute

    // ── Update live card (silent edit) ──────────────────────────────────────
    const cardText = buildLiveCard(session, state);
    try {
        await bot.telegram.editMessageText(
            chatId, session.messageId, null,
            cardText,
            { parse_mode: 'Markdown' }
        );
    } catch (err) {
        const code = err?.response?.error_code;
        if (code === 400 && err.message.includes('not modified')) {
            // same content — harmless
        } else if (code === 400 || code === 403) {
            // message deleted or bot kicked
            stopPositionMonitor(chatId);
            return;
        }
    }

    // ── Position closed? ─────────────────────────────────────────────────────
    if (!state.position || Math.abs(state.equity) < 0.01) {
        await bot.telegram.sendMessage(
            chatId,
            lang === 'ko'
                ? `🏁 *포지션 종료*\n_${asset}/USDC 포지션이 종료됐습니다. 모니터를 멈춥니다._`
                : `🏁 *Position Closed*\n_${asset}/USDC position closed. Monitor stopped._`,
            { parse_mode: 'Markdown' }
        );
        stopPositionMonitor(chatId);
        return;
    }

    // ── Milestone check ──────────────────────────────────────────────────────
    const { roe, side } = state.position;
    const milestone = checkMilestone(roe, triggeredMilestones);

    if (milestone !== null) {
        triggeredMilestones.add(milestone);
        session.lastRoe = roe;
        session.lastUpnl = state.position.unrealizedPnl;

        try {
            await bot.telegram.sendMessage(
                chatId,
                buildMilestoneAlert(asset, side, roe * 100, milestone, lang),
                { parse_mode: 'Markdown' }
            );
        } catch { }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Starts the live position monitor for a user.
 *
 * @param {import('telegraf').Telegraf} bot
 * @param {string} chatId
 * @param {string} walletAddress
 * @param {string} asset            - e.g. 'ETH'
 * @param {string} [lang='en']      - i18n key
 * @returns {Promise<void>}
 */
export async function startPositionMonitor(bot, chatId, walletAddress, asset, lang = 'en') {
    // Stop any existing monitor first
    stopPositionMonitor(chatId);

    // Send the initial LIVE POSITION card
    const state = await fetchHlPosition(walletAddress, asset);
    const session = {
        bot,
        asset,
        walletAddress,
        lang,
        triggeredMilestones: new Set(),
        lastRoe: state?.position?.roe ?? 0,
        lastUpnl: state?.position?.unrealizedPnl ?? 0,
        messageId: null,
        intervalId: null,
    };

    const initialText = state
        ? buildLiveCard(session, state)
        : `🔴 *LIVE POSITION — ${asset}/USDC*\n\n_Connecting to Hyperliquid..._`;

    const msg = await bot.telegram.sendMessage(chatId, initialText, { parse_mode: 'Markdown' });
    session.messageId = msg.message_id;

    // Start poll interval
    session.intervalId = setInterval(() => tick(chatId), POLL_INTERVAL_MS);

    monitors.set(chatId, session);
    console.log(`[MONITOR][${chatId}] Started for ${asset}. msgId: ${msg.message_id}`);
}

/**
 * Stops the position monitor and clears memory.
 * @param {string} chatId
 */
export function stopPositionMonitor(chatId) {
    const session = monitors.get(chatId);
    if (!session) return;

    clearInterval(session.intervalId);
    monitors.delete(chatId);
    console.log(`[MONITOR][${chatId}] Stopped. Memory freed.`);
}

/** Returns number of active monitors (for diagnostics) */
export function getActiveMonitors() {
    return monitors.size;
}

/** Returns true if chatId has an active monitor */
export function hasActiveMonitor(chatId) {
    return monitors.has(chatId);
}
