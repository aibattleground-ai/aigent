/**
 * AIGENT — Hyperliquid L1 Bridge Deposit
 * File: bot/src/hlbridge.js
 *
 * Uses Hyperliquid "Deposit Bridge 2" on Arbitrum One.
 * Real ABI confirmed from on-chain txs: batchedDepositWithPermit (0xb30b5bce)
 *   Signature: batchedDepositWithPermit((address,uint64,uint64,(uint256,uint256,uint8))[])
 *
 * ALL reads: axios JSON-RPC with browser headers (bypass Cloudflare WAF).
 * Signing: ethers offline (zero network) + axios eth_sendRawTransaction.
 */

import { ethers } from 'ethers';

// ── Constants ──────────────────────────────────────────────────────────────────

const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const HL_BRIDGE_ADDRESS = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7';
const USDC_DECIMALS = 6;
const ARB_CHAIN_ID = 42161;
const MIN_DEPOSIT_USDC = 5.0;
const MIN_GAS_ETH = 0.00015;
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 90_000;

// Confirmed from Blockscout: selector 0xb30b5bce
// Tuple: (address token, uint64 amount, uint64 deadline, (uint256 r, uint256 s, uint8 v) sig)
const BRIDGE_IFACE = new ethers.utils.Interface([
    'function batchedDepositWithPermit((address token, uint64 amount, uint64 deadline, (uint256 r, uint256 s, uint8 v) signature)[] deposits)',
]);

// EIP-2612 USDC permit domain (verified from chain: name="USD Coin", version="2")
const USDC_PERMIT_NAME = 'USD Coin';
const USDC_PERMIT_VERSION = '2';

const READ_RPCS = [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.llamarpc.com',
    'https://1rpc.io/arb',
];

const BROWSER_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Origin': 'https://arbiscan.io',
    'Referer': 'https://arbiscan.io/',
};

// ── Axios helpers ──────────────────────────────────────────────────────────────

let _axios = null;
async function getAxios() {
    if (!_axios) _axios = (await import('axios')).default;
    return _axios;
}

async function rpcCall(payload) {
    const axios = await getAxios();
    for (const rpc of READ_RPCS) {
        try {
            const res = await axios.post(rpc, payload, { headers: BROWSER_HEADERS, timeout: 8_000 });
            if (res.data?.error) {
                console.error(`[HLBRIDGE] RPC error from ${rpc}:`, JSON.stringify(res.data.error));
                continue;
            }
            if (res.data?.result !== undefined) return res.data.result;
        } catch (err) {
            console.error(`[HLBRIDGE] axios error [${rpc}]:`, err.response?.data ?? err.message);
        }
    }
    throw new Error(`[HLBRIDGE] All RPCs failed: ${payload.method}`);
}

async function sendRawTx(signedHex) {
    const axios = await getAxios();
    for (const rpc of READ_RPCS) {
        try {
            const res = await axios.post(rpc, {
                jsonrpc: '2.0', id: 99, method: 'eth_sendRawTransaction', params: [signedHex],
            }, { headers: BROWSER_HEADERS, timeout: 15_000 });
            if (res.data?.error) {
                console.error(`[HLBRIDGE] sendRawTx error from ${rpc}:`, JSON.stringify(res.data.error));
                continue;
            }
            const txHash = res.data?.result;
            if (txHash) { console.log(`[HLBRIDGE] sendRawTx OK via ${rpc}: ${txHash}`); return txHash; }
        } catch (err) {
            console.error(`[HLBRIDGE] sendRawTx axios error [${rpc}]:`, err.response?.data ?? err.message);
        }
    }
    throw new Error('[HLBRIDGE] All RPCs rejected sendRawTransaction');
}

async function waitForReceipt(txHash) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const rec = await rpcCall({ jsonrpc: '2.0', id: 88, method: 'eth_getTransactionReceipt', params: [txHash] });
        if (rec) return rec;
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(`TIMEOUT: receipt for ${txHash.slice(0, 10)}... after ${POLL_TIMEOUT_MS / 1000}s`);
}

// ── Read helpers ───────────────────────────────────────────────────────────────

async function getUsdcBalance(address) {
    const padded = address.replace('0x', '').toLowerCase().padStart(64, '0');
    const hex = await rpcCall({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: USDC_ADDRESS, data: `0x70a08231${padded}` }, 'latest'] });
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 10 ** USDC_DECIMALS;
}

async function getEthBalance(address) {
    const hex = await rpcCall({ jsonrpc: '2.0', id: 2, method: 'eth_getBalance', params: [address, 'latest'] });
    if (!hex || hex === '0x') return 0;
    return Number(BigInt(hex)) / 1e18;
}

async function getNonce(address) {
    const hex = await rpcCall({ jsonrpc: '2.0', id: 4, method: 'eth_getTransactionCount', params: [address, 'latest'] });
    return ethers.BigNumber.from(hex).toNumber();
}

async function getUsdcPermitNonce(address) {
    const padded = address.replace('0x', '').toLowerCase().padStart(64, '0');
    const hex = await rpcCall({ jsonrpc: '2.0', id: 6, method: 'eth_call', params: [{ to: USDC_ADDRESS, data: `0x7ecebe00${padded}` }, 'latest'] });
    return hex ? ethers.BigNumber.from(hex).toNumber() : 0;
}

async function getGasPrice() {
    const hex = await rpcCall({ jsonrpc: '2.0', id: 5, method: 'eth_gasPrice', params: [] });
    const base = ethers.BigNumber.from(hex);
    if (base.isZero()) throw new Error('eth_gasPrice returned 0');
    const buffered = base.mul(120).div(100);
    console.log('[HLBRIDGE] gasPrice (wei):', buffered.toString());
    return { gasPrice: buffered };
}

// ── EIP-2612 Permit signing (offline) ─────────────────────────────────────────

async function signUsdcPermit(wallet, spender, amount, usdcNonce) {
    // deadline must fit in uint64 — use 1 hour from now
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const domain = {
        name: USDC_PERMIT_NAME,
        version: USDC_PERMIT_VERSION,
        chainId: ARB_CHAIN_ID,
        verifyingContract: USDC_ADDRESS,
    };
    const types = {
        Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    };
    const message = {
        owner: wallet.address,
        spender,
        value: amount,   // BigNumber
        nonce: usdcNonce,
        deadline,
    };

    const sig = await wallet._signTypedData(domain, types, message);
    const { v, r, s } = ethers.utils.splitSignature(sig);
    console.log(`[HLBRIDGE] Permit signed: v=${v} usdcNonce=${usdcNonce} deadline=${deadline}`);
    return { v, r, s, deadline };
}

// ── Main Export ────────────────────────────────────────────────────────────────

export async function depositToHyperliquid(privateKey, opts = {}) {
    const { amountUsdc, onProgress = () => { } } = opts;

    const wallet = new ethers.Wallet(privateKey); // no provider — offline only
    const address = wallet.address;

    // ── Step 1: USDC balance ─────────────────────────────────────────────────
    onProgress('🔍 Checking vault USDC balance...');
    let usdcBalance;
    try {
        usdcBalance = await getUsdcBalance(address);
    } catch (err) {
        console.error('[HLBRIDGE] USDC balance failed:', err.message);
        return { success: false, error: '❌ 잔고 조회 실패\n잠시 후 다시 시도해 주세요.' };
    }
    if (usdcBalance < MIN_DEPOSIT_USDC) {
        return {
            success: false,
            error: `잔고 부족: $${usdcBalance.toFixed(2)} USDC\n(최소 $${MIN_DEPOSIT_USDC} 이상 필요)`,
        };
    }

    // ── Step 2: ETH gas pre-flight ───────────────────────────────────────────
    onProgress('⛽ Checking gas (ETH) balance...');
    try {
        const ethBalance = await getEthBalance(address);
        if (ethBalance < MIN_GAS_ETH) {
            return {
                success: false,
                error: `⛽ 가스비(ETH) 부족\n\n귀하의 금고 주소로 소량의 *Arbitrum ETH (약 $1~2)*를 먼저 입금해 주세요.\n_(현재: ${ethBalance.toFixed(6)} ETH)_`,
            };
        }
    } catch (err) {
        console.error('[HLBRIDGE] ETH balance failed:', err.message);
        return { success: false, error: '❌ 가스비 조회 실패\n잠시 후 다시 시도해 주세요.' };
    }

    const depositAmt = amountUsdc ? Math.min(amountUsdc, usdcBalance) : usdcBalance;
    // amount fits in uint64 (6 decimals, max ~18 trillion USDC — safe)
    const rawAmt = ethers.BigNumber.from(Math.floor(depositAmt * 10 ** USDC_DECIMALS));

    onProgress(`💵 Preparing $${depositAmt.toFixed(2)} USDC…`);

    // ── Step 3: Fetch nonces + gas ───────────────────────────────────────────
    onProgress('📡 Fetching nonce & gas price...');
    let txNonce, usdcNonce, gasFees;
    try {
        [txNonce, usdcNonce, gasFees] = await Promise.all([
            getNonce(address),
            getUsdcPermitNonce(address),
            getGasPrice(),
        ]);
        console.log(`[HLBRIDGE] txNonce=${txNonce} usdcNonce=${usdcNonce}`);
    } catch (err) {
        console.error('[HLBRIDGE] nonce/gas fetch failed:', err.message);
        return { success: false, error: '❌ 네트워크 조회 실패\n잠시 후 다시 시도해 주세요.' };
    }

    // ── Step 4: Sign EIP-2612 permit (offline) ───────────────────────────────
    onProgress('✍️ Signing permit...');
    let permit;
    try {
        permit = await signUsdcPermit(wallet, HL_BRIDGE_ADDRESS, rawAmt, usdcNonce);
    } catch (err) {
        console.error('[HLBRIDGE] Permit sign failed:', err.message);
        return { success: false, error: `Permit 서명 실패: ${err.message}` };
    }

    // ── Step 5: Build batchedDepositWithPermit calldata ─────────────────────
    onProgress('🚀 Signing Deposit transaction...');
    let depositTxHash;
    try {
        // deadline must fit uint64 — already guaranteed (< 2^64)
        const depositData = BRIDGE_IFACE.encodeFunctionData('batchedDepositWithPermit', [[
            {
                token: USDC_ADDRESS,
                amount: rawAmt,        // uint64 — safe for USDC amounts
                deadline: permit.deadline,
                signature: {
                    r: permit.r,
                    s: permit.s,
                    v: permit.v,
                },
            },
        ]]);
        console.log('[HLBRIDGE] calldata selector:', depositData.slice(0, 10));

        const txParams = {
            chainId: ARB_CHAIN_ID,
            nonce: txNonce,
            to: HL_BRIDGE_ADDRESS,
            data: depositData,
            value: 0,
            gasLimit: 400_000,
            ...gasFees,
        };

        const signedHex = await wallet.signTransaction(txParams);
        depositTxHash = await sendRawTx(signedHex);
        console.log('[HLBRIDGE] Deposit tx:', depositTxHash);
        onProgress(`⏳ TX sent (${depositTxHash.slice(0, 10)}…) — polling...`);

        const rec = await waitForReceipt(depositTxHash);
        console.log('[HLBRIDGE] status:', rec.status, 'gasUsed:', parseInt(rec.gasUsed, 16));

        if (parseInt(rec.status, 16) !== 1) {
            console.error('[HLBRIDGE] Deposit reverted. Receipt:', JSON.stringify(rec));
            return { success: false, error: 'Deposit tx reverted (see server log).' };
        }

    } catch (err) {
        const msg = (err?.message || '').toLowerCase();
        console.error('[HLBRIDGE] Deposit error. Raw:', err.response?.data ?? err.message);
        if (msg.includes('timeout')) {
            return { success: false, error: '❌ 블록체인 응답 없음 (90초 초과)\n귀하의 자금은 안전합니다. 잠시 후 다시 시도해주세요.' };
        }
        if (msg.includes('insufficient funds') || msg.includes('intrinsic gas')) {
            return { success: false, error: '⛽ 가스비(ETH) 부족\nArbitrum ETH $1~2 를 먼저 입금해 주세요.' };
        }
        return { success: false, error: `Deposit 실패: ${err.message}` };
    }

    return { success: true, depositedUsdc: depositAmt.toFixed(2), depositTxHash };
}
