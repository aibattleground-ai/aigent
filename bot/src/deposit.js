/**
 * AIGENT — Arbitrum USDC Deposit Monitor (24/7 CCTV)
 * File: bot/src/deposit.js
 *
 * Watches all registered user wallets on Arbitrum for incoming USDC transfers
 * and fires an instant Telegram push notification on detection.
 *
 * REQUIRED .env:
 *   ARB_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
 *   (Free key at https://alchemy.com — choose Arbitrum One)
 *
 * HOW IT WORKS:
 *   1. Reads all wallet addresses from SQLite DB
 *   2. Registers an ethers.js Transfer event filter on the USDC contract
 *   3. On matching Transfer event → looks up the Telegram user → sends push
 *   4. Reconnects automatically every 4 hours (WebSocket stability)
 */

import { ethers } from 'ethers';
import { getAllUsers } from './db.js';

// ── Constants ──────────────────────────────────────────────────────────────────

// USDC on Arbitrum One (official Circle contract)
const USDC_ADDRESS_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

// Minimal ERC-20 ABI — only what we need for Transfer events
const ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// USDC has 6 decimals
const USDC_DECIMALS = 6;

// Reconnect WebSocket every 4 hours to avoid stale connections
const RECONNECT_MS = 4 * 60 * 60 * 1000;

// ── Watcher State ──────────────────────────────────────────────────────────────
let _provider = null;
let _contract = null;
let _reconnectTimer = null;
let _bot = null;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Formats a raw USDC uint256 amount (6 decimals) to a human-readable string */
function formatUsdc(rawAmount) {
    return (Number(rawAmount) / 10 ** USDC_DECIMALS).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/** Builds the deposit notification text for a given language */
function depositMessage(amountStr, lang = 'en') {
    const msgs = {
        ko:
            `🚨 *입금 확인됨*\n\n` +
            `✅ *+${amountStr} USDC*가 귀하의 금고에 도착했습니다.\n\n` +
            `⚡️ 총알 장전 완료. 매매 명령을 하달하십시오!`,
        en:
            `🚨 *DEPOSIT CONFIRMED*\n\n` +
            `✅ *+${amountStr} USDC* has arrived in your vault.\n\n` +
            `⚡️ Funds loaded. Issue your trading command now!`,
        es:
            `🚨 *DEPÓSITO CONFIRMADO*\n\n` +
            `✅ *+${amountStr} USDC* han llegado a tu bóveda.\n\n` +
            `⚡️ Fondos cargados. ¡Emite tu comando de trading ahora!`,
        zh:
            `🚨 *入金确认*\n\n` +
            `✅ *+${amountStr} USDC* 已到达您的金库。\n\n` +
            `⚡️ 弹药装填完毕。请立即下达交易指令！`,
        ja:
            `🚨 *入金確認*\n\n` +
            `✅ *+${amountStr} USDC* があなたの金庫に届きました。\n\n` +
            `⚡️ 弾薬装填完了。取引命令を下してください！`,
    };
    return msgs[lang] || msgs.en;
}

// ── Core Watcher ───────────────────────────────────────────────────────────────

/**
 * Builds a lowercase address → { chatId, lang } lookup map from all DB users.
 * Re-called on each reconnect to pick up newly registered users.
 */
function buildWalletMap() {
    const users = getAllUsers();
    const map = new Map();
    for (const u of users) {
        if (u.wallet_address) {
            map.set(u.wallet_address.toLowerCase(), {
                chatId: u.telegram_id,
                lang: u.lang || 'en',
            });
        }
    }
    console.log(`[DEPOSIT] Watching ${map.size} wallet(s) for USDC transfers on Arbitrum.`);
    return map;
}

/**
 * Attaches a Transfer event listener to the USDC contract.
 * On any incoming transfer matching a registered wallet, fires a Telegram push.
 */
async function attachListener() {
    const walletMap = buildWalletMap();
    if (walletMap.size === 0) {
        console.log('[DEPOSIT] No wallets registered yet — watcher idle.');
        return;
    }

    const usdc = new ethers.Contract(USDC_ADDRESS_ARB, ERC20_ABI, _provider);
    _contract = usdc;

    usdc.on('Transfer', async (from, to, value) => {
        const toAddr = to.toLowerCase();
        if (!walletMap.has(toAddr)) return; // not one of our wallets

        const { chatId, lang } = walletMap.get(toAddr);
        const amountStr = formatUsdc(value);

        console.log(`[DEPOSIT] 🚨 ${amountStr} USDC → ${toAddr} (user: ${chatId})`);

        try {
            await _bot.telegram.sendMessage(
                chatId,
                depositMessage(amountStr, lang),
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.error(`[DEPOSIT] Failed to notify ${chatId}:`, err.message);
        }
    });

    console.log('[DEPOSIT] Transfer listener active.');
}

function cleanup() {
    if (_contract) {
        _contract.removeAllListeners();
        _contract = null;
    }
    if (_provider) {
        _provider.destroy?.();
        _provider = null;
    }
    if (_reconnectTimer) {
        clearTimeout(_reconnectTimer);
        _reconnectTimer = null;
    }
}

async function connect() {
    cleanup();

    const rpcUrl = process.env.ARB_RPC_URL;
    if (!rpcUrl || rpcUrl.includes('YOUR_KEY')) {
        console.warn(
            '[DEPOSIT] ARB_RPC_URL not configured — deposit monitoring disabled.\n' +
            '  Add to .env: ARB_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY'
        );
        return;
    }

    try {
        // Use WebSocket for real-time events if URL starts with wss://, else JsonRpc polling
        if (rpcUrl.startsWith('wss://')) {
            _provider = new ethers.providers.WebSocketProvider(rpcUrl);
        } else {
            _provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        }

        // Verify connection
        await _provider.getBlockNumber();
        console.log('[DEPOSIT] Connected to Arbitrum RPC.');

        await attachListener();

        // Schedule reconnect to keep WebSocket alive
        _reconnectTimer = setTimeout(() => {
            console.log('[DEPOSIT] Scheduled reconnect...');
            connect();
        }, RECONNECT_MS);

    } catch (err) {
        console.error('[DEPOSIT] Connection failed:', err.message);
        // Retry in 60 seconds
        _reconnectTimer = setTimeout(connect, 60_000);
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Starts the 24/7 deposit monitor.
 * Call once from bot startup (in startBot() or index.js).
 *
 * @param {import('telegraf').Telegraf} bot - Telegraf instance (for sendMessage)
 */
export async function startDepositMonitor(bot) {
    _bot = bot;
    console.log('[DEPOSIT] Starting Arbitrum USDC deposit monitor...');
    await connect();
}

/** Gracefully stops the deposit monitor */
export function stopDepositMonitor() {
    cleanup();
    console.log('[DEPOSIT] Monitor stopped.');
}
