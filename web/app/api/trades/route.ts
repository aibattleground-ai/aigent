/**
 * NexusSphere - Trades API Route
 * Reads the JSON database file created by the bot and returns trade history.
 */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH =
    process.env.DB_PATH ||
    path.join(process.cwd(), '..', 'bot', 'nexussphere-db.json');

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const address = searchParams.get('address')?.toLowerCase();

        if (!fs.existsSync(DB_PATH)) {
            return NextResponse.json({
                globalTrades: [],
                personalTrades: [],
                message: 'No trades yet. Start the bot and send a trade command on Telegram!',
            });
        }

        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const db = JSON.parse(raw);
        if (!db.wallets) db.wallets = {};

        // All trades sorted newest first
        const allTrades = [...(db.trades || [])].reverse();

        // Global is just the top 100 recent
        const globalTrades = allTrades.slice(0, 100);

        // Personal
        let personalTrades: any[] = [];
        const linkedChatId = address ? db.wallets[address] : null;

        if (linkedChatId) {
            personalTrades = allTrades.filter(t => t.chat_id === linkedChatId).slice(0, 50);
        }

        return NextResponse.json({ globalTrades, personalTrades, isLinked: !!linkedChatId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[API] Error fetching trades:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
