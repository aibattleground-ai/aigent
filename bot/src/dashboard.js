/**
 * AIGENT — Live Dashboard (Emoji Markdown UI)
 * File: bot/src/dashboard.js
 *
 * Renders a clean emoji-based Telegram dashboard updated every 60 seconds
 * via editMessageText — one message per user, updated in-place.
 *
 * USDC balance: fetched live from chain via ethers.js balanceOf
 * Mark price:   fetched from Hyperliquid public REST API with 5s timeout
 */

import { ethers } from 'ethers';

// ── Session Store ─────────────────────────────────────────────────────────────
const sessions = new Map();

// ── Constants ─────────────────────────────────────────────────────────────────
const UPDATE_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 5_000;

// USDC contract addresses
const USDC = {
    mainnet: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum One
    testnet: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',  // Arbitrum Sepolia
};

// Public RPC fallbacks (used when ARB_RPC_URL not set, or as backup)
const RPC = {
    mainnet: 'https://arb1.arbitrum.io/rpc',
    testnet: 'https://sepolia-rollup.arbitrum.io/rpc',
};

// Minimal ERC-20 ABI for balanceOf
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

function timeStr() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getProvider(isTestnet) {
    // Prefer configured ARB_RPC_URL on mainnet; use public RPC otherwise
    const envUrl = process.env.ARB_RPC_URL;
    const rpcUrl = (!isTestnet && envUrl && !envUrl.includes('YOUR_KEY'))
        ? envUrl
        : (isTestnet ? RPC.testnet : RPC.mainnet);

    return new ethers.providers.JsonRpcProvider(rpcUrl);
}

/**
 * Fetches live USDC balance for a wallet address.
 * @param {string} walletAddress
 * @param {boolean} isTestnet
 * @returns {Promise<string>} Formatted balance e.g. "$1,234.56"
 */
async function getUsdcBalance(walletAddress, isTestnet) {
    if (!walletAddress) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const provider = getProvider(isTestnet);
        const usdcAddress = isTestnet ? USDC.testnet : USDC.mainnet;
        const contract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);

        // Add a manual timeout via Promise.race
        const rawBalance = await Promise.race([
            contract.balanceOf(walletAddress),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS)
            ),
        ]);

        clearTimeout(timer);

        // USDC has 6 decimals
        const balance = Number(rawBalance) / 1e6;
        return `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch {
        clearTimeout(timer);
        return null;
    }
}

/**
 * Fetches mark price from Hyperliquid's PUBLIC REST endpoint.
 * 5s AbortController timeout — never hangs.
 */
async function getMarkPrice(asset) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
    const isTestnet = session.isTestnet;

    // Fetch both in parallel for speed
    const [markPrice, usdcBalance] = await Promise.all([
        getMarkPrice(session.asset),
        getUsdcBalance(session.walletAddress, isTestnet),
    ]);

    const priceStr = markPrice
        ? `$${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '⏳ Fetching...';

    const balanceStr = usdcBalance || '⏳ Fetching...';

    const pnl = simulatePnL(session);
    const pnlSign = pnl >= 0 ? '+' : '';
    const pnlPct = `${pnlSign}${pnl.toFixed(2)}%`;
    const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';

    const net = isTestnet ? 'TESTNET' : 'MAINNET 🔴';

    const algoLabel = session.gridCount > 0
        ? `Grid Bot (${session.gridCount} Grids)`
        : 'Standby / Manual';

    const rangeLabel = session.gridCount > 0
        ? `$${session.lowerPrice.toLocaleString()} — $${session.upperPrice.toLocaleString()}`
        : '—';

    return (
        `📊 *AIGENT LIVE DASHBOARD*\n` +
        `🟢 System Status: OPERATIONAL | ${net}\n\n` +
        `🏦 *금고 자산 \\(Vault\\)*\n` +
        `💵 USDC 잔고: *${balanceStr}*\n\n` +
        `📈 *포지션 상태 \\(Hyperliquid\\)*\n` +
        `🪙 티커: *${session.asset}/USDC*\n` +
        `🎯 현재가\\(Mark Px\\): *${priceStr}*\n` +
        `🚀 수익률\\(PnL\\): *${pnlPct}* ${pnlEmoji}\n\n` +
        `🕸️ 작동 중인 알고리즘: *${algoLabel}*\n` +
        (session.gridCount > 0 ? `📐 그리드 범위: ${rangeLabel}\n\n` : '\n') +
        `🔄 Last Sync: \`${timeStr()}\``
    );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startDashboard(bot, chatId, opts = {}) {
    killdDashboard(chatId);

    const session = {
        asset: opts.asset || 'ETH',
        gridCount: opts.gridCount || 0,
        totalUsdc: opts.totalUsdc || 0,
        lowerPrice: opts.lowerPrice || 0,
        upperPrice: opts.upperPrice || 0,
        walletAddress: opts.walletAddress || null,
        isTestnet: process.env.HL_TESTNET !== 'false',
        startTime: Date.now(),
        pnlBase: (Math.random() - 0.3) * 2.0,
        messageId: null,
        intervalId: null,
    };

    // ── Send initial message ─────────────────────────────────────────────────
    const initialText = await buildDashboard(session);
    let sentMsg;
    try {
        sentMsg = await bot.telegram.sendMessage(chatId, initialText, {
            parse_mode: 'MarkdownV2',
        });
    } catch {
        try {
            sentMsg = await bot.telegram.sendMessage(chatId, initialText, {
                parse_mode: 'Markdown',
            });
        } catch {
            sentMsg = await bot.telegram.sendMessage(chatId, `📊 AIGENT LIVE DASHBOARD\n🔄 ${timeStr()}`);
        }
    }
    session.messageId = sentMsg.message_id;

    // ── 60s update loop ──────────────────────────────────────────────────────
    session.intervalId = setInterval(async () => {
        try {
            const text = await buildDashboard(session);
            await bot.telegram.editMessageText(chatId, session.messageId, null, text, {
                parse_mode: 'Markdown',
            });
        } catch (err) {
            const code = err?.response?.error_code;
            if (code === 429) return;
            if (code === 400 && err?.message?.includes('not modified')) return;
            if (code === 400 || code === 403) { killdDashboard(chatId); return; }
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
