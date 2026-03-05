import { NextResponse } from 'next/server';
import { getAllTrades } from '@/lib/telegram/db';
import { getCurrentPrice, placeMarketOrder } from '@/lib/telegram/hyperliquid';
// A complete implementation would require updating the db as well, so we simulate that for now.
import { kv } from '@vercel/kv';

export const maxDuration = 60; // Max execution time for Pro tier on Vercel
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Quick security check: Vercel Cron sends a secure auth header
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all trades. In a real system you'd want `getPendingTrades(limit=100)`
        const trades = await getAllTrades(100);
        const pendingTrades = trades.filter((t: any) => t.status === 'pending');

        if (pendingTrades.length === 0) {
            return NextResponse.json({ ok: true, message: 'No pending trades to monitor' });
        }

        let executedCount = 0;

        for (const trade of pendingTrades) {
            // Very naive condition parser for MVP: "price drops below $70000"
            const match = trade.condition.match(/below \$?([0-9,]+)/i);

            if (match) {
                const targetPrice = parseFloat(match[1].replace(/,/g, ''));
                try {
                    const currentPrice = await getCurrentPrice(trade.asset);
                    if (currentPrice < targetPrice) {
                        // Condition Met! Execute.
                        if (process.env.LIVE_TRADING === 'true' || process.env.HYPERLIQUID_PRIVATE_KEY) {
                            const isBuy = trade.action.toLowerCase() === 'buy';
                            const amountUsd = parseFloat(String(trade.amount).replace(/[^0-9.]/g, '')) || 50;
                            await placeMarketOrder(trade.asset, amountUsd, isBuy);
                        }

                        // Update Database (rough pseudo-code for KV)
                        if (process.env.KV_REST_API_URL) {
                            const dbData: any = await kv.get('aigent_db');
                            if (dbData && dbData.trades) {
                                const idx = dbData.trades.findIndex((t: any) => t.id === trade.id);
                                if (idx > -1) {
                                    dbData.trades[idx].status = 'executed';
                                    await kv.set('aigent_db', dbData);
                                }
                            }
                        }
                        executedCount++;
                        console.log(`[CRON] Executed trade #${trade.id} for ${trade.asset}`);
                    }
                } catch (err: any) {
                    console.error(`[CRON] Failed to monitor/execute trade #${trade.id}:`, err.message);
                }
            } else {
                console.log(`[CRON] Ignored complex condition on trade #${trade.id}: ${trade.condition}`);
            }
        }

        return NextResponse.json({ ok: true, executedCount });
    } catch (error: any) {
        console.error('[CRON] Error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
