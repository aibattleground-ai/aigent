/**
 * NexusSphere - JSON File Database Layer
 * Simple, zero-dependency storage for mock trades.
 * Stores all trades in nexussphere-db.json next to this file.
 * No native binaries required — works on all Node.js versions.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.join(__dirname, '..', 'nexussphere-db.json');

/** @typedef {{ id: number, chat_id: string, action: string, asset: string, amount: number, condition: string, status: string, created_at: string }} Trade */

/**
 * Reads the JSON database from disk.
 * @returns {{ trades: Trade[], nextId: number }}
 */
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { trades: [], nextId: 1, links: {}, wallets: {} };
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!db.links) db.links = {};
    if (!db.wallets) db.wallets = {};
    return db;
  } catch {
    return { trades: [], nextId: 1, links: {}, wallets: {} };
  }
}

/**
 * Writes the full database object to disk atomically.
 * @param {{ trades: Trade[], nextId: number }} data
 */
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Initializes the database file if it doesn't exist.
 */
export function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    writeDB({ trades: [], nextId: 1, links: {}, wallets: {} });
    console.log(`✅ Database initialized at: ${DB_PATH}`);
  } else {
    console.log(`✅ Database loaded from: ${DB_PATH}`);
  }
}

/**
 * Inserts a new mock trade record.
 * @param {{ chatId: string, action: string, asset: string, amount: number, condition: string }} trade
 * @returns {number} The new trade's ID
 */
export function insertTrade({ chatId, action, asset, amount, condition }) {
  const db = readDB();
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
  writeDB(db);
  return id;
}

/**
 * Returns all trades ordered by most recent first.
 * @param {number} [limit=100]
 * @returns {Trade[]}
 */
export function getAllTrades(limit = 100) {
  const db = readDB();
  return [...db.trades].reverse().slice(0, limit);
}

/**
 * Returns trades for a specific chat ID.
 * @param {string} chatId
 * @returns {Trade[]}
 */
export function getTradesByChatId(chatId) {
  const db = readDB();
  return [...db.trades].reverse().filter((t) => t.chat_id === chatId);
}

/**
 * Generates a 6-character sync code for a Telegram chat.
 */
export function generateSyncCode(chatId) {
  const db = readDB();
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  db.links[code] = { chatId, expires: Date.now() + 1000 * 60 * 60 }; // 1hr expiry
  writeDB(db);
  return code;
}

/**
 * Claims a sync code and links it to a wallet address.
 */
export function claimSyncCode(code, walletAddress) {
  const db = readDB();
  const link = db.links[code.toUpperCase()];
  if (!link || Date.now() > link.expires) return false;

  db.wallets[walletAddress.toLowerCase()] = link.chatId;
  delete db.links[code.toUpperCase()];
  writeDB(db);
  return true;
}

/**
 * Looks up the Telegram Chat ID linked to a wallet address.
 */
export function getChatIdByAddress(walletAddress) {
  const db = readDB();
  return db.wallets[walletAddress?.toLowerCase()] || null;
}

