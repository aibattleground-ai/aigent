/**
 * AIGENT — Hyperliquid L1 Bridge Deposit
 * File: bot/src/hlbridge.js
 *
 * Deposits USDC from the user's Arbitrum wallet into Hyperliquid exchange
 * via the official HL L1 bridge contract on Arbitrum One.
 *
 * Flow:
 *   1. Check ARB USDC balance (via axios eth_call — no ethers Provider needed)
 *   2. Approve bridge to spend USDC (ERC-20 approve)
 *   3. Call bridge.deposit(amount) to move USDC into HL
 *
 * Contract (Arbitrum One):
 *   - USDC:   0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 *   - Bridge: 0x2Df1c51E09aECF9d8C4e3A049c9CE9E4E1b6A6a
 */

import { ethers } from 'ethers';

// ── Constants ──────────────────────────────────────────────────────────────────

// Official Arbitrum Native USDC (Circle)
const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

// Hyperliquid L1 bridge on Arbitrum One
const HL_BRIDGE_ADDRESS = '0x2Df1c51E09aECF9d8C4e3A049c9CE9E4E1b6A6a';

// USDC has 6 decimals
const USDC_DECIMALS = 6;

// ABI fragments — only what we need
const USDC_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
];

const BRIDGE_ABI = [
    'function deposit(uint64 amount) external',
];

// RPCs in priority order (official first, no Alchemy demo — avoids 429)
const RPC_LIST = [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.llamarpc.com',
    'https://1rpc.io/arb',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns a working JsonRpcProvider, trying each RPC in sequence.
 * Catches 429 (rate-limit) explicitly and moves to the next endpoint.
 */
async function getProvider() {
    for (const url of RPC_LIST) {
        try {
            const provider = new ethers.providers.JsonRpcProvider(url);
            // 5s timeout on the connectivity check itself
            await Promise.race([
                provider.getBlockNumber(),
                new Promise((_, rej) =>
                    setTimeout(() => rej(new Error('connect timeout')), 5_000)
                ),
            ]);
            return provider;
        } catch (err) {
            const msg = err?.message ?? '';
            const is429 = msg.includes('429') || msg.includes('rate') || msg.includes('Too Many');
            console.warn(`[HLBRIDGE] RPC ${url} failed${is429 ? ' (429)' : ''}: ${msg}`);
            // continue to next RPC
        }
    }
    throw new Error(
        '❌ 네트워크 지연 발생\n\n' +
        '블록체인 네트워크 혼잡으로 잔고를 확인할 수 없습니다.\n' +
        '잠시 후 다시 시도해 주세요.'
    );
}

/** Formats USDC raw BigNumber to a readable string */
function fmtUsdc(raw) {
    const n = Number(ethers.BigNumber.from(raw)) / 10 ** USDC_DECIMALS;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Executes an HL bridge deposit.
 *
 * @param {string} privateKey - User's decrypted EVM private key
 * @param {Object} opts
 * @param {number} [opts.amountUsdc]   - Specific USDC amount. If omitted → use full balance
 * @param {Function} [opts.onProgress] - Called with status string updates during execution
 *
 * @returns {Promise<{
 *   success: boolean,
 *   depositedUsdc: string,   // formatted e.g. "123.45"
 *   approveTxHash: string,
 *   depositTxHash: string,
 *   error?: string,
 * }>}
 */
export async function depositToHyperliquid(privateKey, opts = {}) {
    const { amountUsdc, onProgress = () => { } } = opts;

    onProgress('🔌 Connecting to Arbitrum network...');

    const provider = await getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    const address = wallet.address;

    // ── Step 1: Check USDC balance ─────────────────────────────────────────────
    onProgress('🔍 Checking vault USDC balance...');

    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
    const rawBalance = await usdc.balanceOf(address);
    const usdcBalance = Number(rawBalance) / 10 ** USDC_DECIMALS;

    if (usdcBalance < MIN_DEPOSIT_USDC) {
        return {
            success: false,
            error: `Insufficient balance: $${usdcBalance.toFixed(2)} USDC (minimum $${MIN_DEPOSIT_USDC})`,
        };
    }

    // ── Step 1.5: Pre-flight ETH gas check (ABORT on failure) ────────────────
    // If this fails we MUST abort — proceeding with 0 ETH hangs the tx forever.
    onProgress('⛽ Checking gas (ETH) balance...');

    try {
        const ethRaw = await Promise.race([
            provider.getBalance(address),
            new Promise((_, rej) => setTimeout(() => rej(new Error('ETH balance check timeout')), 5_000)),
        ]);
        const ethBalance = Number(ethers.utils.formatEther(ethRaw));
        const MIN_GAS_ETH = 0.00015; // ~2 txs on Arbitrum at normal gas

        if (ethBalance < MIN_GAS_ETH) {
            return {
                success: false,
                error:
                    `⛽ 가스비(ETH) 부족\n\n` +
                    `송금을 위한 네트워크 수수료가 없습니다.\n` +
                    `귀하의 금고 주소로 소량의 *Arbitrum 기반 ETH (약 $1~2)*를 입금해 주세요.\n\n` +
                    `_(현재 ETH 잔고: ${ethBalance.toFixed(6)} ETH)_`,
            };
        }
    } catch (err) {
        // 429, timeout, or any network error — ABORT immediately, don't proceed
        console.error('[HLBRIDGE] ETH balance check ABORTED:', err.message);
        return {
            success: false,
            error:
                `❌ 네트워크 지연 발생\n\n` +
                `블록체인 네트워크 혼잡으로 잔고를 확인할 수 없습니다.\n` +
                `잠시 후 다시 시도해 주세요.`,
        };
    }

    const depositAmt = amountUsdc ? Math.min(amountUsdc, usdcBalance) : usdcBalance;
    const rawDepositAmt = ethers.BigNumber.from(
        Math.floor(depositAmt * 10 ** USDC_DECIMALS)
    );

    onProgress(`💵 Preparing to deposit $${depositAmt.toFixed(2)} USDC → Hyperliquid...`);

    // ── Step 2: Approve bridge to spend USDC ──────────────────────────────────
    onProgress('✍️ Signing Approval transaction (1/2)...');

    const currentAllowance = await usdc.allowance(address, HL_BRIDGE_ADDRESS);

    let approveTxHash = '(already approved)';
    if (currentAllowance.lt(rawDepositAmt)) {
        const approveTx = await usdc.approve(HL_BRIDGE_ADDRESS, rawDepositAmt, {
            gasLimit: 100_000,
        });
        onProgress('⏳ Approval tx broadcast — waiting for confirmation...');
        const approveReceipt = await approveTx.wait(1);
        if (approveReceipt.status !== 1) {
            return { success: false, error: 'Approval transaction reverted.' };
        }
        approveTxHash = approveTx.hash;
        onProgress(`✅ Approved! Tx: ${approveTxHash.slice(0, 10)}...`);
    } else {
        onProgress('✅ Bridge already approved for this amount. Skipping approval.');
    }

    // ── Step 3: Call bridge.deposit(amount) ───────────────────────────────────
    onProgress('🚀 Signing Deposit transaction (2/2)...');

    const bridge = new ethers.Contract(HL_BRIDGE_ADDRESS, BRIDGE_ABI, wallet);

    // Bridge takes uint64 = USDC in raw units (6 decimals)
    const rawUint64 = rawDepositAmt.toNumber(); // safe: max USDC << 2^64

    const depositTx = await bridge.deposit(rawUint64, {
        gasLimit: 200_000,
    });

    onProgress('⏳ Deposit tx broadcast — waiting for confirmation...');
    const depositReceipt = await depositTx.wait(1);

    if (depositReceipt.status !== 1) {
        return { success: false, error: 'Deposit transaction reverted.', approveTxHash };
    }

    return {
        success: true,
        depositedUsdc: depositAmt.toFixed(2),
        approveTxHash,
        depositTxHash: depositTx.hash,
    };
}
