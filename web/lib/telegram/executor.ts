import { insertTrade } from './db';
import { placeMarketOrder } from './hyperliquid';

export async function executeMockTrade(chatId: string, intent: any) {
    const { action, asset, amount, condition } = intent;

    let executeStatus = 'simulated';
    let errorMessage = '';

    // Attempt Live Trade on Hyperliquid if LIVE_TRADING is active or HYPERLIQUID_PRIVATE_KEY exists
    if (process.env.LIVE_TRADING === 'true' || process.env.HYPERLIQUID_PRIVATE_KEY) {
        try {
            const isBuy = action.toLowerCase() === 'buy';
            // Parse percentage amounts (e.g. "30% of wallet USDT") - FOR NOW we just assume numeric amount.
            // In a full prod app we would fetch the wallet balance and calc %. Here we just parse number.
            const amountUsd = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.]/g, '')) || 50;

            await placeMarketOrder(asset, amountUsd, isBuy);
            executeStatus = 'executed (LIVE)';
        } catch (err: any) {
            console.error('[EXECUTOR] Hyperliquid error:', err.message);
            executeStatus = 'failed (LIVE)';
            errorMessage = err.message;
        }
    }

    // Persist the trade
    const tradeId = await insertTrade({ chatId, action, asset, amount, condition });

    let summary = `[#${tradeId}] ${action.toUpperCase()} $${amount} of ${asset.toUpperCase()} — Trigger: "${condition}"\nStatus: ${executeStatus}`;
    if (errorMessage) {
        summary += `\nError: ${errorMessage}`;
    }

    console.log(`[EXECUTOR] Trade logged: ${summary} (Chat: ${chatId})`);

    return { tradeId, summary };
}
