import { kv } from '@vercel/kv';

export interface Trade {
    id: number;
    chat_id: string;
    action: string;
    asset: string;
    amount: number;
    condition: string;
    status: string;
    created_at: string;
}

interface DB {
    trades: Trade[];
    nextId: number;
    links: Record<string, { chatId: string; expires: number }>;
    wallets: Record<string, string>;
}

// Memory fallback if KV is not configured
let memDb: DB = { trades: [], nextId: 1, links: {}, wallets: {} };

async function readDB(): Promise<DB> {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const data = await kv.get<DB>('aigent_db');
        if (data) {
            if (!data.links) data.links = {};
            if (!data.wallets) data.wallets = {};
            return data;
        }
        return { trades: [], nextId: 1, links: {}, wallets: {} };
    }
    return memDb;
}

async function writeDB(data: DB): Promise<void> {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        await kv.set('aigent_db', data);
    } else {
        memDb = data;
    }
}

export async function insertTrade({ chatId, action, asset, amount, condition }: { chatId: string; action: string; asset: string; amount: number; condition: string }) {
    const db = await readDB();
    const id = db.nextId;

    db.trades.push({
        id,
        chat_id: chatId,
        action,
        asset,
        amount,
        condition,
        status: 'executed',
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    });

    db.nextId = id + 1;
    await writeDB(db);
    return id;
}

export async function getAllTrades(limit = 100): Promise<Trade[]> {
    const db = await readDB();
    return [...db.trades].reverse().slice(0, limit);
}

export async function getTradesByChatId(chatId: string): Promise<Trade[]> {
    const db = await readDB();
    return [...db.trades].reverse().filter((t) => t.chat_id === chatId);
}

export async function generateSyncCode(chatId: string): Promise<string> {
    const db = await readDB();
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.links[code] = { chatId, expires: Date.now() + 1000 * 60 * 60 };
    await writeDB(db);
    return code;
}

export async function claimSyncCode(code: string, walletAddress: string): Promise<boolean> {
    const db = await readDB();
    const link = db.links[code.toUpperCase()];
    if (!link || Date.now() > link.expires) return false;

    db.wallets[walletAddress.toLowerCase()] = link.chatId;
    delete db.links[code.toUpperCase()];
    await writeDB(db);
    return true;
}

export async function getChatIdByAddress(walletAddress: string): Promise<string | null> {
    if (!walletAddress) return null;
    const db = await readDB();
    return db.wallets[walletAddress.toLowerCase()] || null;
}
