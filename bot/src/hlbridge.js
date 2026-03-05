/**
 * AIGENT — Hyperliquid L1 Bridge Deposit
 * File: bot/src/hlbridge.js
 *
 * ALL network calls (reads AND writes) use axios JSON-RPC with browser-like headers
 * to bypass Cloudflare WAF on Arbitrum public nodes.
 *
 * Flow:
 *   1. [axios] Check ARB USDC balance (eth_call)
 *   2. [axios] Check native ETH balance (eth_getBalance)
 *   3. [axios] Get nonce + gas price (eth_getTransactionCount, eth_gasPrice)
 *   4. [ethers offline] Sign approve tx (no network touch)
 *   5. [axios] Broadcast approve (eth_sendRawTransaction)
 *   6. [axios] Poll for approve receipt (eth_getTransactionReceipt)
 *   7. [ethers offline] Sign deposit tx (no network touch)
 *   8. [axios] Broadcast deposit (eth_sendRawTransaction)
 *   9. [axios] Poll for deposit receipt
 */

import { ethers } from 'ethers';

// ── Constants ──────────────────────────────────────────────────────────────────

const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const HL_BRIDGE_ADDRESS = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7';
const USDC_DECIMALS = 6;
const ARB_CHAIN_ID = 42161;        // Arbitrum One
const MIN_DEPOSIT_USDC = 1.0;
const MIN_GAS_ETH = 0.00015;      // ~2 Arb txs
const POLL_INTERVAL_MS = 3_000;        // receipt poll every 3s
const POLL_TIMEOUT_MS = 60_000;       // give up after 60s

// Arbitrum Interface encoders (no provider needed)
const USDC_IFACE = new ethers.utils.Interface([
    'function approve(address spender, uint256 amount) returns (bool)',
]);
const BRIDGE_IFACE = new ethers.utils.Interface([
    'function deposit(uint64 amount) external',
]);

// RPC endpoints — all calls go through these with browser headers
const READ_RPCS = [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.llamarpc.com',
    'https://1rpc.io/arb',
];

// Browser-like headers to bypass Cloudflare WAF
const BROWSER_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Origin': 'https://arbiscan.io',
    'Referer': 'https://arbiscan.io/',
};

// ── Axios JSON-RPC core ────────────────────────────────────────────────────────

let _axios = null;
async function getAxios() {
    if (!_axios) _axios = (await import('axios')).default;
    return _axios;
}

/**
 * Sends a JSON-RPC payload to each RPC in order until one succeeds.
 * On error logs the FULL raw response so bugs are visible.
 * @returns {*} result field value
 */
async function rpcCall(payload) {
    const axios = await getAxios();
    for (const rpc of READ_RPCS) {
        try {
            const res = await axios.post(rpc, payload, {
                headers: BROWSER_HEADERS,
                timeout: 8_000,
            });
            if (res.data?.error) {
                // RPC returned a JSON-RPC error — log raw and try next
                console.error(`[HLBRIDGE] rpcCall RPC error from ${rpc}:`, JSON.stringify(res.data.error));
                continue;
            }
            if (res.data?.result !== undefined) return res.data.result;
        } catch (err) {
            // Log the FULL axios error response for debugging
            console.error(`[HLBRIDGE] rpcCall axios error [${rpc}]:`,
                err.response?.data ?? err.message
            );
        }
    }
    throw new Error('[HLBRIDGE] All RPCs failed for payload: ' + payload.method);
}

/**
 * Sends a raw signed transaction and returns the tx hash.
 * Also logs the complete raw RPC response on failure.
 */
async function sendRawTx(signedHex) {
    const axios = await getAxios();
    for (const rpc of READ_RPCS) {
        try {
            const res = await axios.post(rpc, {
                jsonrpc: '2.0', id: 99, method: 'eth_sendRawTransaction',
                params: [signedHex],
            }, { headers: BROWSER_HEADERS, timeout: 15_000 });

            if (res.data?.error) {
                console.error(`[HLBRIDGE] sendRawTx RPC error from ${rpc}:`, JSON.stringify(res.data.error));
                continue;
            }
            const txHash = res.data?.result;
            if (txHash) {
                console.log(`[HLBRIDGE] sendRawTx OK via ${rpc}: ${txHash}`);
                return txHash;
            }
        } catch (err) {
            console.error(`[HLBRIDGE] sendRawTx axios error [${rpc}]:`,
                err.response?.data ?? err.message
            );
        }
    }
    throw new Error('[HLBRIDGE] All RPCs rejected sendRawTransaction');
}

/**
 * Polls eth_getTransactionReceipt until mined or timeout.
 */
async function waitForReceipt(txHash) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const rec = await rpcCall({
            jsonrpc: '2.0', id: 88, method: 'eth_getTransactionReceipt',
            params: [txHash],
        });
        if (rec) return rec; // null means still pending
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(`TIMEOUT: receipt not found for ${txHash} after ${POLL_TIMEOUT_MS / 1000}s`);
}

// ── Read helpers (all via rpcCall) ─────────────────────────────────────────────

async function getUsdcBalance(address) {
    const padded = address.replace('0x', '').toLowerCase().padStart(64, '0');
    const hex = await rpcCall({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: USDC_ADDRESS, data: `0x70a08231${padded}` }, 'latest'],
    });
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 10 ** USDC_DECIMALS;
}

async function getEthBalance(address) {
    const hex = await rpcCall({
        jsonrpc: '2.0', id: 2, method: 'eth_getBalance',
        params: [address, 'latest'],
    });
    if (!hex || hex === '0x') return 0;
    return Number(BigInt(hex)) / 1e18;
}

async function getAllowanceRaw(owner) {
    const ownerPad = owner.replace('0x', '').toLowerCase().padStart(64, '0');
    const spenderPad = HL_BRIDGE_ADDRESS.replace('0x', '').toLowerCase().padStart(64, '0');
    const hex = await rpcCall({
        jsonrpc: '2.0', id: 3, method: 'eth_call',
        params: [{ to: USDC_ADDRESS, data: `0xdd62ed3e${ownerPad}${spenderPad}` }, 'latest'],
    });
    if (!hex || hex === '0x') return ethers.BigNumber.from(0);
    return ethers.BigNumber.from(hex);
}

async function getNonce(address) {
    const hex = await rpcCall({
        jsonrpc: '2.0', id: 4, method: 'eth_getTransactionCount',
        params: [address, 'latest'],
    });
    return ethers.BigNumber.from(hex).toNumber();
}

async function getGasPrice() {
    // Arbitrum: eth_maxPriorityFeePerGas returns 0x00, so use eth_gasPrice + 20% buffer
    const gasPriceHex = await rpcCall({
        jsonrpc: '2.0', id: 5, method: 'eth_gasPrice', params: [],
    });
    const base = ethers.BigNumber.from(gasPriceHex);
    if (base.isZero()) throw new Error('eth_gasPrice returned 0');
    const buffered = base.mul(120).div(100); // +20% buffer
    console.log('[HLBRIDGE] gasPrice (wei):', buffered.toString());
    return { gasPrice: buffered };
}

// ── Offline Sign + axios broadcast ────────────────────────────────────────────

/**
 * Signs a tx offline (no network needed) and broadcasts it via axios.
 * Returns { txHash }.
 */
async function signAndSend(wallet, txParams) {
    const populated = {
        chainId: ARB_CHAIN_ID,
        nonce: txParams.nonce,
        to: txParams.to,
        data: txParams.data,
        value: txParams.value ?? 0,
        gasLimit: txParams.gasLimit,
        ...txParams.gasFees,
    };
    // ethers offline sign — zero network calls
    const signedHex = await wallet.signTransaction(populated);
    const txHash = await sendRawTx(signedHex);
    return txHash;
}

// ── Main Export ────────────────────────────────────────────────────────────────

export async function depositToHyperliquid(privateKey, opts = {}) {
    const { amountUsdc, onProgress = () => { } } = opts;

    const wallet = new ethers.Wallet(privateKey); // NO provider — offline only
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
        return { success: false, error: `잔고 부족: $${usdcBalance.toFixed(2)} USDC (최소 $${MIN_DEPOSIT_USDC})` };
    }

    // ── Step 2: ETH gas pre-flight ───────────────────────────────────────────
    onProgress('⛽ Checking gas (ETH) balance...');
    try {
        const ethBalance = await getEthBalance(address);
        if (ethBalance < MIN_GAS_ETH) {
            return {
                success: false,
                error: `⛽ 가스비(ETH) 부족\n\n송금을 위한 ETH 가스비가 없습니다.\n귀하의 금고 주소로 소량의 *Arbitrum ETH (약 $1~2)*를 먼저 입금해 주세요.\n\n_(현재: ${ethBalance.toFixed(6)} ETH)_`,
            };
        }
    } catch (err) {
        console.error('[HLBRIDGE] ETH balance failed:', err.message);
        return { success: false, error: '❌ 가스비 조회 실패\n잠시 후 다시 시도해 주세요.' };
    }

    const depositAmt = amountUsdc ? Math.min(amountUsdc, usdcBalance) : usdcBalance;
    const rawDepositAmt = ethers.BigNumber.from(Math.floor(depositAmt * 10 ** USDC_DECIMALS));

    onProgress(`💵 Preparing $${depositAmt.toFixed(2)} USDC deposit → Hyperliquid...`);

    // ── Step 3: Fetch nonce + gas price (both via axios) ─────────────────────
    onProgress('📡 Fetching nonce & gas price...');
    let nonce, gasFees;
    try {
        [nonce, gasFees] = await Promise.all([getNonce(address), getGasPrice()]);
        console.log(`[HLBRIDGE] nonce=${nonce} gasFees=${JSON.stringify(gasFees)}`);
    } catch (err) {
        console.error('[HLBRIDGE] nonce/gas fetch failed:', err.message);
        return { success: false, error: '❌ 가스 정보 조회 실패\n잠시 후 다시 시도해 주세요.' };
    }

    // ── Step 4: Approve (if needed) ──────────────────────────────────────────
    onProgress('✍️ Checking / signing Approval (1/2)...');
    let approveTxHash = '(skipped)';
    try {
        const allowance = await getAllowanceRaw(address);
        if (allowance.lt(rawDepositAmt)) {
            const approveData = USDC_IFACE.encodeFunctionData('approve', [
                HL_BRIDGE_ADDRESS, rawDepositAmt,
            ]);
            approveTxHash = await signAndSend(wallet, {
                nonce, to: USDC_ADDRESS, data: approveData,
                gasLimit: 200_000, gasFees,
            });
            console.log('[HLBRIDGE] Approve tx:', approveTxHash);
            onProgress(`⏳ Approve sent (${approveTxHash.slice(0, 10)}…) — polling receipt...`);

            const approveRec = await waitForReceipt(approveTxHash);
            if (parseInt(approveRec.status, 16) !== 1) {
                return { success: false, error: 'Approve tx reverted.' };
            }
            onProgress('✅ Approval confirmed!');
            nonce++; // increment nonce for next tx
        } else {
            onProgress('✅ Already approved. Skipping approval.');
        }
    } catch (err) {
        const msg = (err?.message || '').toLowerCase();
        console.error('[HLBRIDGE] Approve failed. Raw error:', err.response?.data ?? err.message);
        if (msg.includes('timeout')) {
            return { success: false, error: '❌ 블록체인 응답 없음 (60초 초과)\n귀하의 자금은 안전하며, 잠시 후 다시 시도해주세요.' };
        }
        if (msg.includes('insufficient funds') || msg.includes('intrinsic gas')) {
            return { success: false, error: '⛽ 가스비(ETH) 부족\nArbitrum ETH $1~2 를 먼저 입금해 주세요.' };
        }
        return { success: false, error: `Approve 실패: ${err.message}` };
    }

    // ── Step 5: Deposit ──────────────────────────────────────────────────────
    onProgress('🚀 Signing Deposit transaction (2/2)...');
    let depositTxHash;
    try {
        const depositData = BRIDGE_IFACE.encodeFunctionData('deposit', [
            rawDepositAmt.toNumber(),
        ]);
        depositTxHash = await signAndSend(wallet, {
            nonce, to: HL_BRIDGE_ADDRESS, data: depositData,
            gasLimit: 400_000, gasFees,
        });
        console.log('[HLBRIDGE] Deposit tx:', depositTxHash);
        onProgress(`⏳ Deposit sent (${depositTxHash.slice(0, 10)}…) — polling receipt...`);

        const depositRec = await waitForReceipt(depositTxHash);
        if (parseInt(depositRec.status, 16) !== 1) {
            return { success: false, error: 'Deposit tx reverted.', approveTxHash };
        }
    } catch (err) {
        const msg = (err?.message || '').toLowerCase();
        console.error('[HLBRIDGE] Deposit failed. Raw error:', err.response?.data ?? err.message);
        if (msg.includes('timeout')) {
            return { success: false, error: '❌ 블록체인 응답 없음 (60초 초과)\n귀하의 자금은 안전하며, 잠시 후 다시 시도해주세요.' };
        }
        if (msg.includes('insufficient funds') || msg.includes('intrinsic gas')) {
            return { success: false, error: '⛽ 가스비(ETH) 부족\nArbitrum ETH $1~2 를 먼저 입금해 주세요.' };
        }
        return { success: false, error: `Deposit 실패: ${err.message}` };
    }

    return {
        success: true,
        depositedUsdc: depositAmt.toFixed(2),
        approveTxHash,
        depositTxHash,
    };
}
