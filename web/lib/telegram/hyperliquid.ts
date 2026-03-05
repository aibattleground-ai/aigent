import { Hyperliquid } from 'hyperliquid';

const IS_PROD = process.env.NODE_ENV === 'production';
const PRIVATE_KEY = process.env.HYPERLIQUID_PRIVATE_KEY || '';

let sdk: Hyperliquid | null = null;

if (PRIVATE_KEY) {
    try {
        sdk = new Hyperliquid({
            privateKey: PRIVATE_KEY,
            testnet: !IS_PROD // Use testnet if not in production
        });
        // We do not await sdk.connect() here at module level to avoid top-level await issues,
        // but connect() is recommended depending on SDK config. We will just use REST API via methods.
        console.log(`✅ Hyperliquid SDK initialized in ${IS_PROD ? 'mainnet' : 'testnet'} mode`);
    } catch (err: any) {
        console.error('❌ Failed to initialize Hyperliquid SDK:', err.message);
    }
}

/**
 * Places a market order on Hyperliquid.
 * @param asset The ticker (e.g., "BTC")
 * @param amountUsd The amount in USD to buy/sell
 * @param isBuy True for buy, false for sell
 */
export async function placeMarketOrder(asset: string, amountUsd: number, isBuy: boolean) {
    if (!sdk) {
        throw new Error('Hyperliquid Exchange Client is not initialized (missing HYPERLIQUID_PRIVATE_KEY).');
    }

    // Step 1: Get the exact token details (szDecimals) and current price
    const metaResponses = await sdk.info.perpetuals.getMetaAndAssetCtxs();
    const assetMeta = metaResponses[0].universe.find((a: any) => a.name === asset);
    const assetCtx = metaResponses[1].find((c: any) => c.coin === asset);

    if (!assetMeta || !assetCtx) {
        throw new Error(`Asset ${asset} not found on Hyperliquid.`);
    }

    const currentPrice = parseFloat(assetCtx.midPx || assetCtx.markPx);
    if (!currentPrice || currentPrice <= 0) {
        throw new Error(`Could not determine current price for ${asset}.`);
    }

    // Step 2: Calculate size in tokens
    let size = amountUsd / currentPrice;

    // Apply the SZ_DECIMALS formatting
    const szDecimals = assetMeta.szDecimals;
    size = Number(size.toFixed(szDecimals));

    // Place the market order using the CustomOperations helper wrapper
    const result = await sdk.custom.marketOpen(asset, isBuy, size, currentPrice, 0.05); // 5% slippage
    return result;
}

export async function getCurrentPrice(asset: string): Promise<number> {
    // If SDK is not fully init, we can still fetch info by temporary instance
    const tempSdk = sdk || new Hyperliquid();
    const metaResponses = await tempSdk.info.perpetuals.getMetaAndAssetCtxs();
    const assetCtx = metaResponses[1].find((c: any) => c.coin === asset);
    if (!assetCtx) throw new Error(`Asset ${asset} not found.`);
    return parseFloat(assetCtx.midPx || assetCtx.markPx);
}
