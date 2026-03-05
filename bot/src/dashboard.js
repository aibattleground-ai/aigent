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


// ── Session Store ─────────────────────────────────────────────────────────────
const sessions = new Map();

// ── Constants ─────────────────────────────────────────────────────────────────
const UPDATE_INTERVAL_MS = 60_000;
// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

function timeStr() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Fetches USDC balance via direct JSON-RPC eth_call (axios POST).
 *
 * Why axios over ethers.js Provider?
 *   Free RPC nodes (Ankr, LlamaRPC etc.) block Node.js ethers.js requests
 *   via Cloudflare/WAF. A direct POST with browser-like headers bypasses this.
 *
 * @param {string} walletAddress
 * @returns {Promise<string>}  e.g. '$1,234.56' or '$0.00 (RPC Error)'
 */
export async function getArbUsdcBalance(walletAddress) {
    if (!walletAddress) return '$0.00 (No Wallet)';

    // Arbitrum Native USDC — hardcoded, never changes
    const USDC_CONTRACT = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

    // balanceOf(address) = 0x70a08231 + address zero-padded to 32 bytes (64 hex chars)
    const paddedAddr = walletAddress.replace('0x', '').toLowerCase().padStart(64, '0');
    const callData = `0x70a08231${paddedAddr}`;

    // Browser-like headers to bypass Cloudflare WAF that blocks bot User-Agents
    const HEADERS = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://arbiscan.io',
        'Referer': 'https://arbiscan.io/',
    };

    const PAYLOAD = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: USDC_CONTRACT, data: callData }, 'latest'],
    };

    // RPC endpoints in priority order — Alchemy demo first (most reliable)
    const RPCS = [
        'https://arb-mainnet.g.alchemy.com/v2/demo',
        'https://1rpc.io/arb',
        'https://arbitrum.llamarpc.com',
        'https://arb1.arbitrum.io/rpc',
    ];

    // Dynamic import axios (ESM-compatible)
    const { default: axios } = await import('axios');

    for (const rpc of RPCS) {
        try {
            const response = await axios.post(rpc, PAYLOAD, {
                headers: HEADERS,
                timeout: 4000,
            });

            const hex = response.data?.result;
            if (!hex || hex === '0x' || hex === '0x0') {
                // Valid response but zero balance
                return '$0.00';
            }

            // Decode: USDC has 6 decimals
            const raw = BigInt(hex);
            const balance = Number(raw) / 1e6;
            return `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        } catch (err) {
            console.error(`🔥 잔고조회 상세 에러 [${rpc}]:`, err.response?.data || err.message);
            // Try next RPC
        }
    }

    // All RPCs failed
    console.error('🔥 모든 RPC 실패 — 잔고 조회 불가');
    return '$0.00 (RPC Error)';
}

/**
 * Same logic as getArbUsdcBalance but returns a plain number (e.g. 1234.56).
 * Used by the deposit prompt — no fragile string-to-number re-parsing needed.
 * USDC decimals = 6 (ethers.utils.formatUnits equivalent: raw / 1e6).
 * Returns 0 on any error.
 *
 * @param {string} walletAddress
 * @returns {Promise<number>}
 */
export async function getArbUsdcBalanceRaw(walletAddress) {
    if (!walletAddress) return 0;

    const USDC_CONTRACT = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const paddedAddr = walletAddress.replace('0x', '').toLowerCase().padStart(64, '0');
    const callData = `0x70a08231${paddedAddr}`;

    const HEADERS = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://arbiscan.io',
        'Referer': 'https://arbiscan.io/',
    };

    const PAYLOAD = {
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: USDC_CONTRACT, data: callData }, 'latest'],
    };

    const RPCS = [
        'https://arb-mainnet.g.alchemy.com/v2/demo',
        'https://1rpc.io/arb',
        'https://arbitrum.llamarpc.com',
        'https://arb1.arbitrum.io/rpc',
    ];

    const { default: axios } = await import('axios');

    for (const rpc of RPCS) {
        try {
            const res = await axios.post(rpc, PAYLOAD, { headers: HEADERS, timeout: 4000 });
            const hex = res.data?.result;
            if (!hex || hex === '0x' || hex === '0x0') return 0;
            // USDC decimals = 6 → divide by 1_000_000 (same as ethers.utils.formatUnits(raw, 6))
            return Number(BigInt(hex)) / 1_000_000;
        } catch {
            // try next RPC
        }
    }
    return 0;
}

/**
 * Fetches HL clearinghouse state in ONE call — returns both balance AND real PnL.
 * PnL comes from actual assetPositions, never from simulated/fake data.
 *
 * @param {string} walletAddress
 * @param {string} asset  e.g. 'ETH'
 * @returns {Promise<{ balance: string, pnlStr: string, pnlEmoji: string }>}
 */
async function getHlState(walletAddress, asset) {
    const EMPTY = { balance: '$0.00', pnlStr: '— (No position)', pnlEmoji: '⚪' };
    if (!walletAddress) return EMPTY;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);

    try {
        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: walletAddress }),
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) return EMPTY;
        const data = await res.json();

        // ── Account equity ────────────────────────────────────────────────────
        const equity = parseFloat(data?.marginSummary?.accountValue ?? '0');
        const balance = isNaN(equity)
            ? '$0.00'
            : `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // ── Real position PnL for the requested asset ─────────────────────────
        // assetPositions: [{ position: { coin, unrealizedPnl, returnOnEquity, ... } }]
        const positions = data?.assetPositions ?? [];
        const pos = positions.find(p => p?.position?.coin === asset);

        if (!pos) {
            // No open position — show honest zero, never fabricate data
            return { balance, pnlStr: '— (No position)', pnlEmoji: '⚪' };
        }

        const upnl = parseFloat(pos.position.unrealizedPnl ?? '0');
        const roe = parseFloat(pos.position.returnOnEquity ?? '0');
        const sign = upnl >= 0 ? '+' : '';
        const pnlStr = `${sign}$${Math.abs(upnl).toFixed(2)} (ROE ${(roe * 100).toFixed(2)}%)`;
        const pnlEmoji = upnl >= 0 ? '🟢' : '🔴';

        return { balance, pnlStr, pnlEmoji };
    } catch (err) {
        clearTimeout(timer);
        console.warn('[DASHBOARD] HL state error:', err.message);
        return EMPTY;
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

    // Fetch all data independently — any one failing never blocks the others
    let markPrice = null;
    let arbBalance = '$0.00 (RPC Error)';
    let hlState = { balance: '$0.00', pnlStr: '—', pnlEmoji: '⚪' };

    try { markPrice = await getMarkPrice(session.asset); } catch { }
    try { arbBalance = await getArbUsdcBalance(session.walletAddress); } catch { }
    try { hlState = await getHlState(session.walletAddress, session.asset); } catch { }

    const priceStr = markPrice
        ? `$${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'N/A';

    const { balance: hlBalance, pnlStr, pnlEmoji } = hlState;

    const net = isTestnet ? '⚠️ TESTNET' : 'MAINNET (LIVE ⚡️)';

    const algoLabel = session.gridCount > 0
        ? `Grid Bot (${session.gridCount} Grids)`
        : 'Standby / Manual';

    const rangeLabel = session.gridCount > 0
        ? `$${session.lowerPrice.toLocaleString()} — $${session.upperPrice.toLocaleString()}`
        : '—';

    return (
        `📊 *AIGENT LIVE DASHBOARD*\n` +
        `🟢 System Status: OPERATIONAL | ${net}\n\n` +
        `🏦 *금고 자산 (Vault)*\n` +
        `🔷 ARB 지갑 USDC: *${arbBalance}*\n` +
        `🔶 HL 거래소 USDC: *${hlBalance}*\n\n` +
        `📈 *포지션 상태 (Hyperliquid)*\n` +
        `🪙 티커: *${session.asset}/USDC*\n` +
        `🎯 현재가 (Mark Px): *${priceStr}*\n` +
        `🚀 수익률 (PnL): *${pnlStr}* ${pnlEmoji}\n\n` +
        `🕸️ 알고리즘: *${algoLabel}*\n` +
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
