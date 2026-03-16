/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AIGENT — Copy Trading Engine (Mirror Execution)
 * File: bot/src/copytrading.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW IT WORKS:
 *   1. User selects a trader via the Telegram UI (copy_lv → ct: → ct_start:)
 *   2. startCopyTrading() begins polling that trader's clearinghouseState every 1s
 *   3. trackOnce() diffs the current vs previous position snapshot:
 *      - NEW position detected   → mirrorOpen()  (market buy/sell)
 *      - Position CLOSED         → mirrorClose() (reduce-only close)
 *      - Size CHANGED            → logged (partial fill, ignored for now)
 *   4. executeUniversalOrder() (from strategies/order.js) executes the mirrored trade
 *   5. Telegram notification sent after every executed order
 *
 * SESSION LIFECYCLE:
 *   startCopyTrading(chatId, ...)  → registers session in copyActiveSessions Map
 *   stopCopyTrading(chatId)        → clears interval + removes session
 *   Sessions are in-memory only — bot restart will stop all active sessions.
 *
 * MIRROR SIZING:
 *   Fixed $20 USD per mirrored trade (configurable via COPY_TRADE_SIZE_USD env).
 *   Leverage: taken from the user's selected level (levelMeta.leverage string → parsed).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { executeUniversalOrder } from './strategies/order.js';
import { ethers } from 'ethers';

// ── Constants ──────────────────────────────────────────────────────────────────
const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
const POLL_INTERVAL_MS = 1_000;   // 1-second position polling
const COPY_SIZE_USD = Number(process.env.COPY_TRADE_SIZE_USD) || 20;
const REQUEST_TIMEOUT_MS = 4_000;

// ── In-memory session store ────────────────────────────────────────────────────
// chatId (string) → { traderAddr, traderName, levelMeta, intervalId, prevPositions }
const copyActiveSessions = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Parse leverage string "10x" | "3~5x" | "50x+" → numeric value */
function parseLeverage(leverageStr) {
    const digits = (leverageStr ?? '1x').match(/\d+/g) ?? ['1'];
    return parseInt(digits[digits.length - 1], 10) || 1;
}

/**
 * Normalize an Ethereum address to EIP-55 checksum format.
 * Hyperliquid API requires checksum addresses — lowercase may return 422.
 */
function toChecksumAddr(addr) {
    try {
        return ethers.utils.getAddress(addr);
    } catch {
        console.warn(`[COPY] ⚠️ Invalid address format, using raw: ${addr}`);
        return addr;
    }
}

/** Fetch a trader's open positions from Hyperliquid */
async function fetchTraderPositions(rawAddr) {
    // ── Normalize to EIP-55 checksum (fixes 422 from lowercase addresses) ──
    const traderAddr = toChecksumAddr(rawAddr);
    const payload = { type: 'clearinghouseState', user: traderAddr };

    // ── Debug: log exact payload sent to HL API ─────────────────────────────
    console.log(`[COPY] 🔍 HL API request → POST ${HL_INFO_URL}`);
    console.log(`[COPY] 🔍 Payload:`, JSON.stringify(payload));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(HL_INFO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
        });
        clearTimeout(timer);

        console.log(`[COPY] 🔍 HL API response status: ${res.status}`);

        if (res.status === 422) {
            // 422 = Unprocessable Entity — address invalid/private or wrong format
            const body = await res.text().catch(() => '(body unreadable)');
            console.error(`[COPY] ❌ HL API 422 — payload was:`, JSON.stringify(payload));
            console.error(`[COPY] ❌ HL API 422 — response body:`, body);
            throw new Error(
                'PRIVATE_OR_INVALID:트레이더 주소가 존재하지 않거나 API에서 조회 불가한 상태예요. ' +
                '다른 트레이더를 선택하거나 잠시 후 다시 시도해봐요.'
            );
        }
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(`[COPY] ❌ HL API ${res.status} error:`, body);
            throw new Error(`API_ERROR:HL API 응답 이상함 (${res.status}). 잠깐 기다렸다 다시 눌러봐.`);
        }

        const data = await res.json();

        // Build a normalized position map: coin → { szi, entryPx, coin }
        const positions = {};
        for (const p of data?.assetPositions ?? []) {
            const pos = p?.position;
            if (!pos) continue;
            const szi = parseFloat(pos.szi ?? '0');
            if (szi === 0) continue;  // skip closed/empty
            positions[pos.coin] = {
                coin: pos.coin,
                szi,
                entryPx: parseFloat(pos.entryPx ?? '0'),
            };
        }
        console.log(`[COPY] ✅ Positions fetched for ${traderAddr}: ${Object.keys(positions).length} open`);
        return positions;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error('TIMEOUT:HL API 응답 없음. 잠깐 기다렸다 다시 시도해봐.');
        }
        throw err;
    }
}

/** Send a Telegram notification to the user */
async function notify(bot, chatId, text) {
    try {
        await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error(`[COPY] Telegram notify failed for ${chatId}:`, err.message);
    }
}

// ── Mirror Order Execution ─────────────────────────────────────────────────────

/**
 * Mirrors a new position opening from the tracked trader.
 * @param {object} params
 */
async function mirrorOpen({ chatId, coin, szi, leverage, level, privKey, traderName, bot }) {
    const isBuy = szi > 0;
    const action = isBuy ? 'buy' : 'sell';
    const dir = isBuy ? '📈 Long' : '📉 Short';
    const emoji = isBuy ? '🟢' : '🔴';

    console.log(`[COPY] mirrorOpen → ${action} ${coin} | lev=${leverage}x | lv=${level} | chatId=${chatId}`);

    const result = await executeUniversalOrder(
        { asset: coin, action, type: 'market', size_usd: COPY_SIZE_USD, leverage, level },
        privKey
    );

    if (result.success) {
        const d = result.details ?? {};
        const fillPx = d.orderPrice ? `$${d.orderPrice.toLocaleString()}` : '—';
        const markPx = d.markPrice ? `$${d.markPrice.toLocaleString()}` : '—';
        const notional = d.notional ? `$${d.notional.toFixed(2)}` : `$${COPY_SIZE_USD}`;
        await notify(bot, chatId,
            `${emoji} *[${traderName}] 진입 미러 완료*\n` +
            `\`\`\`\n` +
            `COIN    : ${coin}\n` +
            `DIR     : ${isBuy ? 'LONG' : 'SHORT'} ${leverage}x\n` +
            `MARK    : ${markPx}\n` +
            `FILL    : ${fillPx}\n` +
            `SIZE    : ${notional} USD\n` +
            `OID     : ${d.orderId ?? 'N/A'}\n` +
            `\`\`\`\n` +
            `_포지션 변화 발생 시 자동 청산 미러링._`
        );
    } else {
        await notify(bot, chatId,
            `⚠️ *[${traderName}] 미러 주문 실패*\n\n` +
            `📌 \`${coin}\` ${dir}\n` +
            `오류: ${result.error}`
        );
    }
    return result;
}

/**
 * Mirrors a position close (reduce-only market order).
 * @param {object} params
 */
async function mirrorClose({ chatId, coin, szi, leverage, level, entryPx, privKey, traderName, bot }) {
    // To close: reverse the direction
    const wasLong = szi > 0;
    const closeAction = wasLong ? 'sell' : 'buy';
    const dir = wasLong ? 'LONG' : 'SHORT';

    console.log(`[COPY] mirrorClose → ${closeAction} ${coin} | lv=${level} | chatId=${chatId}`);

    const result = await executeUniversalOrder(
        { asset: coin, action: closeAction, type: 'market', size_usd: COPY_SIZE_USD, leverage, level },
        privKey
    );

    if (result.success) {
        const d = result.details ?? {};
        // Realized PnL estimate: (fillPx - entryPx) / entryPx × size_usd × leverage × direction
        let pnlStr = '—';
        if (entryPx && d.orderPrice) {
            const pct = ((d.orderPrice - entryPx) / entryPx) * (wasLong ? 1 : -1) * leverage * 100;
            const usd = pct / 100 * COPY_SIZE_USD;
            pnlStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% (${usd >= 0 ? '+' : ''}$${usd.toFixed(2)})`;
        }
        await notify(bot, chatId,
            `🏁 *[${traderName}] 청산 미러 완료*\n` +
            `\`\`\`\n` +
            `COIN    : ${coin}\n` +
            `DIR     : ${dir} 종료\n` +
            `ENTRY   : ${entryPx ? '$' + entryPx.toLocaleString() : '—'}\n` +
            `EXIT    : $${d.orderPrice?.toLocaleString() ?? '—'}\n` +
            `PnL     : ${pnlStr}\n` +
            `\`\`\`\n` +
            `_트레이더가 포지션을 닫아 자동 청산 완료._`
        );
    } else {
        await notify(bot, chatId,
            `⚠️ *[${traderName}] 청산 미러 실패*\n\n` +
            `📌 \`${coin}\` ${dir}\n` +
            `오류: ${result.error}`
        );
    }
    return result;
}

// ── Core Tracking Loop ─────────────────────────────────────────────────────────

/**
 * Called every POLL_INTERVAL_MS. Compares current vs previous positions,
 * executes mirror orders where needed, and updates the session snapshot.
 */
async function trackOnce(session) {
    const { chatId, traderAddr, traderName, levelMeta, privKey, bot } = session;
    const leverage = parseLeverage(levelMeta?.leverage);

    let currentPositions;
    try {
        currentPositions = await fetchTraderPositions(traderAddr);
    } catch (err) {
        const msg = err.message ?? '';
        if (msg.startsWith('PRIVATE_OR_INVALID:') || msg.startsWith('API_ERROR:')) {
            // Fatal — stop session and notify user
            const friendlyMsg = msg.split(':').slice(1).join(':');
            stopCopyTrading(chatId);
            await notify(bot, chatId,
                `🚫 *[${traderName}] 카피 감시 자동 종료*\n\n` +
                `${friendlyMsg}\n\n` +
                `_다른 트레이더를 선택하거나 /start 로 다시 시작해._`
            );
        } else {
            // Transient network error — skip this tick, keep loop running
            console.warn(`[COPY] Poll hiccup for ${traderAddr}: ${msg}`);
        }
        return;
    }

    const prev = session.prevPositions;

    // ── Detect NEW positions ─────────────────────────────────────────────────
    for (const [coin, cur] of Object.entries(currentPositions)) {
        if (!prev[coin]) {
            // Brand new coin appeared → mirror open
            await mirrorOpen({ chatId, coin, szi: cur.szi, leverage, level: session.level, privKey, traderName, bot });
        } else if (Math.sign(cur.szi) !== Math.sign(prev[coin].szi)) {
            // Direction flipped (e.g. long → short) → close old, open new
            await mirrorClose({ chatId, coin, szi: prev[coin].szi, leverage, level: session.level, entryPx: prev[coin].entryPx, privKey, traderName, bot });
            await mirrorOpen({ chatId, coin, szi: cur.szi, leverage, level: session.level, privKey, traderName, bot });
        }
        // Size change only → log, skip re-entry for now
    }

    // ── Detect CLOSED positions ──────────────────────────────────────────────
    for (const [coin, prevPos] of Object.entries(prev)) {
        if (!currentPositions[coin]) {
            // Coin disappeared → mirror close
            await mirrorClose({ chatId, coin, szi: prevPos.szi, leverage, level: session.level, entryPx: prevPos.entryPx, privKey, traderName, bot });
        }
    }

    // Update snapshot
    session.prevPositions = currentPositions;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Starts copy trading session for a user.
 *
 * @param {string}  chatId       - Telegram chat ID
 * @param {string}  traderAddr   - Trader's Hyperliquid wallet address
 * @param {string}  traderName   - Display name (e.g. "GhostSniper")
 * @param {object}  levelMeta    - { leverage: '10x', risk: '...', emoji: '...' }
 * @param {string}  privKey      - User's decrypted private key
 * @param {object}  bot          - Telegraf bot instance (for notifications)
 */
export async function startCopyTrading({ chatId, traderAddr, traderName, levelMeta, privKey, bot }) {
    // Stop any existing session first
    stopCopyTrading(chatId);

    console.log(`[COPY] Starting session | chatId=${chatId} | trader=${traderAddr} | level=${levelMeta?.name}`);

    // Take initial snapshot
    let initialPositions;
    try {
        initialPositions = await fetchTraderPositions(traderAddr);
    } catch (err) {
        throw new Error(`트레이더 초기 상태 로딩 실패: ${err.message}`);
    }

    const session = {
        chatId,
        traderAddr,
        traderName,
        levelMeta,
        privKey,
        bot,
        prevPositions: initialPositions,
        startedAt: Date.now(),
        intervalId: null,
    };

    // Start polling loop
    session.intervalId = setInterval(async () => {
        // Safety: stop if session was removed externally
        if (!copyActiveSessions.has(chatId)) return;
        await trackOnce(session);
    }, POLL_INTERVAL_MS);

    copyActiveSessions.set(chatId, session);

    const posCount = Object.keys(initialPositions).length;
    console.log(`[COPY] Session active | ${posCount} initial positions tracked for ${traderAddr}`);
    return { posCount, initialPositions };
}

/**
 * Stops the copy trading session for a user.
 * @param {string} chatId
 * @returns {boolean} true if a session was active and stopped
 */
export function stopCopyTrading(chatId) {
    const session = copyActiveSessions.get(chatId);
    if (!session) return false;
    clearInterval(session.intervalId);
    copyActiveSessions.delete(chatId);
    console.log(`[COPY] Session stopped | chatId=${chatId}`);
    return true;
}

/**
 * Returns session info for a user, or null if not active.
 * @param {string} chatId
 * @returns {object|null}
 */
export function getCopySession(chatId) {
    const s = copyActiveSessions.get(chatId);
    if (!s) return null;
    return {
        traderName: s.traderName,
        traderAddr: s.traderAddr,
        levelMeta: s.levelMeta,
        startedAt: s.startedAt,
        currentPositions: Object.keys(s.prevPositions),
    };
}

/**
 * Returns all active session chatIds (for admin/debug use).
 * @returns {string[]}
 */
export function getActiveCopySessions() {
    return [...copyActiveSessions.keys()];
}
