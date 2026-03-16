/**
 * AIGENT — Live Dashboard (Emoji Markdown UI)
 * File: bot/src/dashboard.js
 *
 * Data sources:
 *   - Hyperliquid API: equity, PnL, mark price  (fetched every 60s with dashboard)
 *   - Arbitrum L1 USDC: fetched ONCE on session start, then every 5 min separately
 *     → prevents 429 rate-limit errors from public RPC nodes
 */

// ── Session Store ─────────────────────────────────────────────────────────────
const sessions = new Map();

// ── Constants ─────────────────────────────────────────────────────────────────
const UPDATE_INTERVAL_MS = 60_000;    // Dashboard refresh: every 60s
const ARB_CACHE_INTERVAL_MS = 300_000;   // ARB L1 balance cache TTL: 5 min
const FETCH_TIMEOUT_MS = 5_000;

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');

function timeStr() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── Arbitrum L1 USDC Balance (cached, polled slowly) ─────────────────────────

/**
 * Fetches Arbitrum native USDC balance via direct JSON-RPC eth_call.
 * Uses browser-like headers to bypass Cloudflare WAF.
 * Returns a formatted string like '$12.34' or '$0.00' on error.
 */
export async function getArbUsdcBalance(walletAddress) {
    if (!walletAddress) return '$0.00';

    const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const data = '0x70a08231' + walletAddress.replace('0x', '').toLowerCase().padStart(64, '0');

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://arbiscan.io',
        'Referer': 'https://arbiscan.io/',
    };

    // Only one reliable RPC — no flood of fallbacks
    const RPC = 'https://arb1.arbitrum.io/rpc';
    const { default: axios } = await import('axios');

    try {
        const res = await axios.post(RPC, {
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: USDC, data }, 'latest'],
        }, { headers, timeout: 4_000 });

        const hex = res.data?.result;
        if (!hex || hex === '0x' || hex === '0x0') return '$0.00';
        const balance = Number(BigInt(hex)) / 1e6;
        return `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch {
        return '$—'; // silent fallback — no console spam
    }
}

/**
 * Returns raw ARB USDC balance as a number. Returns 0 on error.
 */
export async function getArbUsdcBalanceRaw(walletAddress) {
    if (!walletAddress) return 0;

    const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const data = '0x70a08231' + walletAddress.replace('0x', '').toLowerCase().padStart(64, '0');
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 Chrome/122.0.0.0',
        'Origin': 'https://arbiscan.io',
    };
    const { default: axios } = await import('axios');
    try {
        const res = await axios.post('https://arb1.arbitrum.io/rpc', {
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: USDC, data }, 'latest'],
        }, { headers, timeout: 4_000 });
        const hex = res.data?.result;
        if (!hex || hex === '0x' || hex === '0x0') return 0;
        return Number(BigInt(hex)) / 1_000_000;
    } catch {
        return 0;
    }
}

// ── Background ARB balance refresher ─────────────────────────────────────────

/**
 * Starts a slow background timer that refreshes the ARB USDC balance
 * once every 5 minutes and stores it in session.arbBalance.
 * Also fires immediately on session start (initial cache warm-up).
 */
async function warmAndScheduleArbBalance(session) {
    const refresh = async () => {
        try {
            session.arbBalance = await getArbUsdcBalance(session.walletAddress);
        } catch {
            // keep last cached value
        }
    };

    // Initial fetch (non-blocking)
    refresh().catch(() => { });

    // Then every 5 minutes
    session.arbIntervalId = setInterval(() => {
        refresh().catch(() => { });
    }, ARB_CACHE_INTERVAL_MS);
}

// ── Hyperliquid Data Fetchers ─────────────────────────────────────────────────

/**
 * Fetches Hyperliquid clearinghouse state and returns equity + ALL active positions.
 * Returns:
 *   balance    — formatted string e.g. '$5.06'
 *   positions  — array of parsed position objects (all assets with szi !== 0)
 */
async function getHlState(walletAddress) {
    const EMPTY = { balance: '$0.00', positions: [] };

    // ── Hard guard: reject obviously invalid addresses ────────────────────────
    const PLACEHOLDERS = ['your_wallet_address_here', 'undefined', 'null', ''];
    if (!walletAddress || PLACEHOLDERS.includes(String(walletAddress).toLowerCase().trim())) {
        console.error(`[DASHBOARD] getHlState SKIPPED — walletAddress invalid: "${walletAddress}"`);
        console.error(`[DASHBOARD] Tip: ensure HL_PRIVATE_KEY is set correctly in .env`);
        return EMPTY;
    }

    // ── EIP-55 체크섬 정규화 (소문자 주소 → HL API 422/wrong data 방지) ──
    let checksumAddr = walletAddress;
    try {
        // ethers is available as a dependency
        const { ethers } = await import('ethers');
        checksumAddr = ethers.utils.getAddress(walletAddress);
    } catch {
        // ethers not available — use address as-is
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        console.log(`[DASHBOARD] getHlState → POST /info clearinghouseState user=${checksumAddr}`);

        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: checksumAddr }),
            signal: controller.signal,
        });
        clearTimeout(timer);

        console.log(`[DASHBOARD] getHlState ← status=${res.status}`);
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(`[DASHBOARD] getHlState error body:`, body);
            return EMPTY;
        }
        const data = await res.json();

        // ── Debug: log raw marginSummary to find exact field names ───────────
        console.log(`[DASHBOARD] marginSummary raw:`, JSON.stringify(data?.marginSummary ?? {}));

        // ── Try all known balance fields in priority order ────────────────────
        //   totalRawUsd = actual deposited margin (most reliable for small accounts)
        //   totalEquity = includes unrealized PnL (may be 0 if no positions)
        //   accountValue = legacy fallback
        const ms = data?.marginSummary ?? {};
        const candidates = [
            parseFloat(ms.totalRawUsd ?? 'NaN'),
            parseFloat(ms.totalEquity ?? 'NaN'),
            parseFloat(ms.accountValue ?? 'NaN'),
            parseFloat(ms.totalMargValue ?? 'NaN'),
        ];
        const equity = candidates.find(v => !isNaN(v) && v > 0) ?? 0;

        console.log(`[DASHBOARD] equity resolved: $${equity}`);

        const balance = `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // ── Loop over ALL positions — no index hardcoding ─────────────────────
        const rawPositions = data?.assetPositions ?? [];
        const positions = rawPositions
            .filter(p => Math.abs(parseFloat(p?.position?.szi ?? '0')) > 0)
            .map(p => {
                const pos = p.position;
                const coin = pos.coin;
                const szi = parseFloat(pos.szi ?? '0');
                const upnl = parseFloat(pos.unrealizedPnl ?? '0');
                const roe = parseFloat(pos.returnOnEquity ?? '0');

                const direction = szi >= 0 ? 'Long' : 'Short';
                const dirEmoji = szi >= 0 ? '📈' : '📉';
                const sizeAbs = Math.abs(szi);
                const sizeStr = Number.isInteger(sizeAbs)
                    ? String(sizeAbs)
                    : sizeAbs.toFixed(4).replace(/\.?0+$/, '');

                const pnlSign = upnl >= 0 ? '+' : '-';
                const roeSign = roe >= 0 ? '+' : '';
                const pnlStr = `${pnlSign}$${Math.abs(upnl).toFixed(2)} (ROE ${roeSign}${(roe * 100).toFixed(2)}%)`;
                const pnlEmoji = upnl >= 0 ? '🟢' : '🔴';

                return { coin, direction, dirEmoji, sizeStr, pnlStr, pnlEmoji };
            });

        return { balance, positions };
    } catch (err) {
        clearTimeout(timer);
        console.error(`[DASHBOARD] getHlState exception:`, err.message);
        return EMPTY;
    }
}


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

// ── Dashboard Renderer ────────────────────────────────────────────────────────

// Number emojis for position list index
const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

async function buildDashboard(session) {
    const isTestnet = session.isTestnet;

    let hlState = { balance: '$0.00', positions: [] };

    // HL data: always fresh (fast Hyperliquid API)
    try { hlState = await getHlState(session.walletAddress); } catch { }

    // Sync session.asset to first active position ticker (for mark price lookup)
    if (hlState.positions.length > 0 && hlState.positions[0].coin !== session.asset) {
        session.asset = hlState.positions[0].coin;
    }

    // Fetch mark price for the primary (first) active ticker
    let markPrice = null;
    if (session.asset) {
        try { markPrice = await getMarkPrice(session.asset); } catch { }
    }

    // ARB balance: use cached value (refreshed separately every 5 min)
    const arbBalance = session.arbBalance || '$...';

    const priceStr = markPrice
        ? `$${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'N/A';

    const { balance: hlBalance, positions } = hlState;
    const net = isTestnet ? '⚠️ TESTNET' : 'MAINNET (LIVE ⚡️)';

    const algoLabel = session.gridCount > 0
        ? `Grid Bot (${session.gridCount} Grids)`
        : 'Standby / Manual';

    const rangeLabel = session.gridCount > 0
        ? `$${session.lowerPrice.toLocaleString()} — $${session.upperPrice.toLocaleString()}`
        : '—';

    // ── Build position list block ──────────────────────────────────────────────
    let positionsBlock;
    if (positions.length === 0) {
        positionsBlock = `📭 *보유 포지션 없음*\n`;
    } else {
        const lines = positions.map((p, i) => {
            const idx = NUM_EMOJI[i] ?? `${i + 1}.`;
            return (
                `${idx} *${p.coin}/USDC*\n` +
                `   ${p.dirEmoji} 방향/사이즈: ${p.direction} (${p.sizeStr})\n` +
                `   💰 PnL: *${p.pnlStr}* ${p.pnlEmoji}`
            );
        });
        positionsBlock = `📊 *보유 포지션 목록*\n${lines.join('\n\n')}\n`;
    }

    // Primary ticker mark price line (only shown when holding ≥1 position)
    const markPriceLine = positions.length > 0
        ? `🎯 ${session.asset} 현재가 (Mark Px): *${priceStr}*\n\n`
        : '';

    return (
        `📊 *AIGENT LIVE DASHBOARD*\n` +
        `🟢 System Status: OPERATIONAL | ${net}\n\n` +
        `🏦 *금고 자산 (Vault)*\n` +
        `🔷 ARB 지갑 USDC: *${arbBalance}*\n` +
        `🔶 HL 거래소 Equity: *${hlBalance}*\n\n` +
        markPriceLine +
        positionsBlock +
        `\n🕸️ 알고리즘: *${algoLabel}*\n` +
        (session.gridCount > 0 ? `📐 그리드 범위: ${rangeLabel}\n\n` : '\n') +
        `🔄 Last Sync: \`${timeStr()}\` _(ARB 5분 갱신)_`
    );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startDashboard(bot, chatId, opts = {}) {
    killdDashboard(chatId);

    const session = {
        // ✅ Fix #1: no BTC/ETH hardcoding — start with provided asset or empty, API will detect actual ticker
        asset: opts.asset || 'USDC',
        gridCount: opts.gridCount || 0,
        totalUsdc: opts.totalUsdc || 0,
        lowerPrice: opts.lowerPrice || 0,
        upperPrice: opts.upperPrice || 0,
        walletAddress: opts.walletAddress || null,
        isTestnet: process.env.HL_TESTNET !== 'false',
        startTime: Date.now(),
        arbBalance: '$...', // populated async below
        messageId: null,
        intervalId: null,
        arbIntervalId: null,
    };

    // Start slow ARB balance background refresh (non-blocking)
    warmAndScheduleArbBalance(session).catch(() => { });

    const initialText = await buildDashboard(session);
    let sentMsg;
    try {
        sentMsg = await bot.telegram.sendMessage(chatId, initialText, { parse_mode: 'Markdown' });
    } catch {
        sentMsg = await bot.telegram.sendMessage(chatId, `📊 AIGENT LIVE DASHBOARD\n🔄 ${timeStr()}`);
    }
    session.messageId = sentMsg.message_id;

    // HL data refresh every 60s (Hyperliquid API — no rate limit issues)
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
    console.log(`[DASHBOARD][${chatId}] Started ${session.asset} (msgId: ${session.messageId})`);
}

export function killdDashboard(chatId) {
    const s = sessions.get(chatId);
    if (s) {
        clearInterval(s.intervalId);
        clearInterval(s.arbIntervalId);
        sessions.delete(chatId);
        console.log(`[DASHBOARD][${chatId}] Session killed.`);
    }
}

export function getSession(chatId) { return sessions.get(chatId) || null; }
export function getActiveSessions() { return sessions.size; }
