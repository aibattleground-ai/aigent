import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), '..', 'bot', 'nexussphere-db.json');

function requireDB() {
    try {
        if (!fs.existsSync(DB_PATH)) return { trades: [], nextId: 1, links: {}, wallets: {} };
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const db = JSON.parse(raw);
        if (!db.links) db.links = {};
        if (!db.wallets) db.wallets = {};
        return db;
    } catch {
        return { trades: [], nextId: 1, links: {}, wallets: {} };
    }
}

function writeDB(data: any) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { code, address } = body;

        if (!code || !address) {
            return NextResponse.json({ error: 'Code and address are required' }, { status: 400 });
        }

        const db = requireDB();
        const upperCode = code.toUpperCase();
        const link = db.links[upperCode];

        if (!link || Date.now() > link.expires) {
            return NextResponse.json({ error: 'Invalid or expired sync code.' }, { status: 400 });
        }

        // Link them
        db.wallets[address.toLowerCase()] = link.chatId;
        delete db.links[upperCode]; // consume the code
        writeDB(db);

        return NextResponse.json({ success: true, message: 'Telegram connected successfully!' });
    } catch (err: unknown) {
        return NextResponse.json({ error: 'Failed to connect.' }, { status: 500 });
    }
}
