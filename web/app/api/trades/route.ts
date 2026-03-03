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

export async function GET() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            return NextResponse.json({
                trades: [],
                message: 'No trades yet. Start the bot and send a trade command on Telegram!',
            });
        }

        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const db = JSON.parse(raw);

        // Return trades sorted newest first
        const trades = [...(db.trades || [])].reverse().slice(0, 100);

        return NextResponse.json({ trades });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[API] Error fetching trades:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
