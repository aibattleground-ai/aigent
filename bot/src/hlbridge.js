/**
 * AIGENT — Hyperliquid L1 Bridge Deposit
 * File: bot/src/hlbridge.js
 *
 * All READ-ONLY blockchain calls use axios JSON-RPC to bypass Cloudflare WAF.
 * ethers.js is used ONLY for transaction signing (Wallet + Contract.connect).
 *
 * Flow:
 *   1. [axios] Check ARB USDC balance
 *   2. [axios] Check native ETH balance (gas pre-flight)
 *   3. [ethers Wallet] Approve USDC spend
 *   4. [ethers Wallet] Deposit via HL bridge
 */

import { ethers } from 'ethers';

// ── Constants ──────────────────────────────────────────────────────────────────

const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // Arbitrum Native USDC
const HL_BRIDGE_ADDRESS = '0x2Df1c51E09aECF9d8C4e3A049c9CE9E4E1b6A6a';
const USDC_DECIMALS = 6;
const MIN_DEPOSIT_USDC = 1.0;
const MIN_GAS_ETH = 0.00015; // ~2 Arbitrum txs

// ABI fragments for signing only
const USDC_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
];
const BRIDGE_ABI = ['function deposit(uint64 amount) external'];

// Official Arbitrum One RPC — used for tx signing (signed txs bypass WAF)
const SIGNING_RPC = 'https://arb1.arbitrum.io/rpc';

// RPC endpoints for axios read-only calls (WAF bypass via browser headers)
const READ_RPCS = [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.llamarpc.com',
    'https://1rpc.io/arb',
];

// Cloudflare-bypass headers that mimic a real browser
const BROWSER_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Origin': 'https://arbiscan.io',
    'Referer': 'https://arbiscan.io/',
};

// ── Axios JSON-RPC helpers ─────────────────────────────────────────────────────

async function axiosPost(payload) {
    const { default: axios } = await import('axios');
    for (const rpc of READ_RPCS) {
        try {
            const res = await axios.post(rpc, payload, {
                headers: BROWSER_HEADERS,
                timeout: 5_000,
            });
            if (res.data?.result !== undefined) return res.data.result;
        } catch (err) {
            console.warn(`[HLBRIDGE] read RPC ${rpc} failed: ${err.message}`);
        }
    }
    throw new Error('All read RPCs failed');
}

/** Returns USDC balance as a number (e.g. 1234.56). */
async function getUsdcBalance(address) {
    const padded = address.replace('0x', '').toLowerCase().padStart(64, '0');
    const hex = await axiosPost({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: USDC_ADDRESS, data: `0x70a08231${padded}` }, 'latest'],
    });
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 10 ** USDC_DECIMALS;
}

/** Returns native ETH balance as a number. */
async function getEthBalance(address) {
    const hex = await axiosPost({
        jsonrpc: '2.0', id: 2, method: 'eth_getBalance',
        params: [address, 'latest'],
    });
    if (!hex || hex === '0x') return 0;
    return Number(BigInt(hex)) / 1e18;
}

/** Returns current USDC allowance for the bridge as a BigNumber string. */
async function getAllowance(owner) {
    // allowance(address,address) = 0xdd62ed3e + owner 32B + spender 32B
    const ownerPad = owner.replace('0x', '').toLowerCase().padStart(64, '0');
    const spenderPad = HL_BRIDGE_ADDRESS.replace('0x', '').toLowerCase().padStart(64, '0');
    const hex = await axiosPost({
        jsonrpc: '2.0', id: 3, method: 'eth_call',
        params: [{ to: USDC_ADDRESS, data: `0xdd62ed3e${ownerPad}${spenderPad}` }, 'latest'],
    });
    if (!hex || hex === '0x') return ethers.BigNumber.from(0);
    return ethers.BigNumber.from(hex);
}

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Executes an HL bridge deposit.
 *
 * @param {string} privateKey - User's decrypted EVM private key
 * @param {Object} opts
 * @param {number} [opts.amountUsdc]   - Specific USDC amount. If omitted → full balance
 * @param {Function} [opts.onProgress] - Called with status strings during execution
 */
export async function depositToHyperliquid(privateKey, opts = {}) {
    const { amountUsdc, onProgress = () => { } } = opts;

    // ── Step 1: Check USDC balance (axios) ────────────────────────────────────
    onProgress('🔍 Checking vault USDC balance...');

    let usdcBalance;
    try {
        usdcBalance = await getUsdcBalance(
            new ethers.Wallet(privateKey).address
        );
    } catch (err) {
        console.error('[HLBRIDGE] USDC balance check failed:', err.message);
        return {
            success: false,
            error: '❌ 네트워크 지연 발생\n\n블록체인 네트워크 혼잡으로 잔고를 확인할 수 없습니다.\n잠시 후 다시 시도해 주세요.',
        };
    }

    if (usdcBalance < MIN_DEPOSIT_USDC) {
        return {
            success: false,
            error: `잔고 부족: $${usdcBalance.toFixed(2)} USDC (최소 $${MIN_DEPOSIT_USDC} 이상)`,
        };
    }

    const wallet = new ethers.Wallet(privateKey, new ethers.providers.JsonRpcProvider(SIGNING_RPC));
    const address = wallet.address;

    // ── Step 2: ETH gas pre-flight (axios) ────────────────────────────────────
    onProgress('⛽ Checking gas (ETH) balance...');

    try {
        const ethBalance = await getEthBalance(address);
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
        // ETH check failed — abort (don't proceed with potentially zero gas)
        console.error('[HLBRIDGE] ETH balance check ABORTED:', err.message);
        return {
            success: false,
            error: '❌ 네트워크 지연 발생\n\n블록체인 네트워크 혼잡으로 잔고를 확인할 수 없습니다.\n잠시 후 다시 시도해 주세요.',
        };
    }

    const depositAmt = amountUsdc ? Math.min(amountUsdc, usdcBalance) : usdcBalance;
    const rawDepositAmt = ethers.BigNumber.from(Math.floor(depositAmt * 10 ** USDC_DECIMALS));

    onProgress(`💵 Preparing to deposit $${depositAmt.toFixed(2)} USDC → Hyperliquid...`);

    // ── Step 3: Approve bridge (ethers signer — signed tx bypasses WAF) ────────
    onProgress('✍️ Signing Approval transaction (1/2)...');

    try {
        const currentAllowance = await getAllowance(address);

        let approveTxHash = '(already approved)';
        if (currentAllowance.lt(rawDepositAmt)) {
            const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
            const approveTx = await usdc.approve(HL_BRIDGE_ADDRESS, rawDepositAmt, { gasLimit: 100_000 });
            onProgress('⏳ Approval tx broadcast — waiting for confirmation...');
            const rec = await approveTx.wait(1);
            if (rec.status !== 1) return { success: false, error: 'Approval transaction reverted.' };
            approveTxHash = approveTx.hash;
            onProgress(`✅ Approved! Tx: ${approveTxHash.slice(0, 10)}...`);
        } else {
            onProgress('✅ Bridge already approved. Skipping approval.');
        }

        // ── Step 4: Deposit (ethers signer) ───────────────────────────────────
        onProgress('🚀 Signing Deposit transaction (2/2)...');

        const bridge = new ethers.Contract(HL_BRIDGE_ADDRESS, BRIDGE_ABI, wallet);
        const depositTx = await bridge.deposit(rawDepositAmt.toNumber(), { gasLimit: 200_000 });
        onProgress('⏳ Deposit tx broadcast — waiting for confirmation...');
        const depositRec = await depositTx.wait(1);

        if (depositRec.status !== 1) {
            return { success: false, error: 'Deposit transaction reverted.', approveTxHash };
        }

        return {
            success: true,
            depositedUsdc: depositAmt.toFixed(2),
            approveTxHash,
            depositTxHash: depositTx.hash,
        };

    } catch (err) {
        console.error('[HLBRIDGE] Tx failed:', err.message);
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('insufficient funds') || msg.includes('intrinsic gas') ||
            msg.includes('insufficient_funds')) {
            return {
                success: false,
                error:
                    `⛽ 가스비(ETH) 부족\n\n` +
                    `트랜잭션을 처리할 ETH 가스비가 없습니다.\n` +
                    `귀하의 금고 주소로 소량의 *Arbitrum 기반 ETH (약 $1~2)*를 입금해 주세요.`,
            };
        }
        return { success: false, error: `Transaction failed: ${err.message}` };
    }
}
