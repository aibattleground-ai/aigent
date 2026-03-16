/**
 * AIGENT — SQLite Database Layer
 * File: bot/src/db.js
 *
 * INSTALLATION:
 *   npm install better-sqlite3
 *
 * Tables:
 *   users  — Telegram users with language preference and auto-generated EVM wallet
 *   trades — Trade log (simple / grid / order)
 *   links  — Sync code ↔ chatId mapping for web dashboard
 *
 * Why better-sqlite3?
 *   - Synchronous API — no callback/promise hell
 *   - No native module build issues (pre-compiled binaries)
 *   - 10x faster than node-sqlite3 for this use-case
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'aigent.db');

// ── Singleton connection ───────────────────────────────────────────────────────
let _db = null;

function getDB() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');   // safer concurrent writes
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

// ── Schema Init ───────────────────────────────────────────────────────────────

/**
 * Creates all tables if they don't exist.
 * Safe to call multiple times (idempotent).
 *
 * SQL that creates the tables:
 *
 * CREATE TABLE IF NOT EXISTS users (
 *   telegram_id    TEXT PRIMARY KEY,
 *   lang           TEXT NOT NULL DEFAULT 'en',
 *   wallet_address TEXT UNIQUE,
 *   encrypted_pk   TEXT,             -- AES-encrypted private key
 *   created_at     TEXT NOT NULL DEFAULT (datetime('now'))
 * );
 *
 * CREATE TABLE IF NOT EXISTS trades (
 *   id         INTEGER PRIMARY KEY AUTOINCREMENT,
 *   chat_id    TEXT NOT NULL,
 *   action     TEXT NOT NULL,
 *   asset      TEXT NOT NULL,
 *   amount     REAL,
 *   condition  TEXT,
 *   status     TEXT NOT NULL DEFAULT 'executed',
 *   created_at TEXT NOT NULL DEFAULT (datetime('now'))
 * );
 *
 * CREATE TABLE IF NOT EXISTS links (
 *   code       TEXT PRIMARY KEY,
 *   chat_id    TEXT NOT NULL,
 *   expires_at INTEGER NOT NULL
 * );
 */
export function initDB() {
  const db = getDB();

  db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            telegram_id    TEXT PRIMARY KEY,
            lang           TEXT NOT NULL DEFAULT 'en',
            wallet_address TEXT UNIQUE,
            encrypted_pk   TEXT,
            referral_code  TEXT UNIQUE,
            created_at     TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS trades (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id    TEXT NOT NULL,
            action     TEXT NOT NULL,
            asset      TEXT NOT NULL,
            amount     REAL,
            condition  TEXT,
            status     TEXT NOT NULL DEFAULT 'executed',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS links (
            code       TEXT PRIMARY KEY,
            chat_id    TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS referrals (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_chat_id TEXT NOT NULL,
            referee_chat_id  TEXT NOT NULL UNIQUE,
            created_at       TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `);

  // ── Migration: add referral_code column to existing users tables ──────────
  // Safe to run even if column already exists (SQLite swallows duplicate-column errors)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;`);
  } catch { /* column already exists — OK */ }

  console.log(`[DB] SQLite initialized at: ${DB_PATH}`);
}

// ── User CRUD ──────────────────────────────────────────────────────────────────

/**
 * Returns a user record by Telegram ID, or null if not found.
 * @param {string} telegramId
 * @returns {{ telegram_id, lang, wallet_address, encrypted_pk, created_at } | null}
 */
export function getUser(telegramId) {
  return getDB().prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId)) || null;
}

/**
 * Returns all registered users (used for boot-time HL scan when no session file exists).
 * @returns {Array<{ telegram_id, lang, wallet_address, encrypted_pk, created_at }>}
 */
export function getAllUsers() {
  return getDB().prepare('SELECT * FROM users WHERE encrypted_pk IS NOT NULL').all();
}

/**
 * Creates a new user with the given language preference.
 * No-op if user already exists (INSERT OR IGNORE).
 * @param {string} telegramId
 * @param {string} lang - "en" | "ko" | "es" | "zh"
 */
export function createUser(telegramId, lang = 'en') {
  getDB().prepare(`
        INSERT OR IGNORE INTO users (telegram_id, lang) VALUES (?, ?)
    `).run(String(telegramId), lang);
}

/**
 * Updates a user's language preference.
 * @param {string} telegramId
 * @param {string} lang
 */
export function setUserLang(telegramId, lang) {
  getDB().prepare('UPDATE users SET lang = ? WHERE telegram_id = ?').run(lang, String(telegramId));
}

/**
 * Stores the generated wallet address and AES-encrypted private key for a user.
 * @param {string} telegramId
 * @param {string} walletAddress - EVM address (0x...)
 * @param {string} encryptedPk   - AES-encrypted private key string
 */
export function saveUserWallet(telegramId, walletAddress, encryptedPk) {
  getDB().prepare(`
        UPDATE users SET wallet_address = ?, encrypted_pk = ? WHERE telegram_id = ?
    `).run(walletAddress, encryptedPk, String(telegramId));
}

// ── Trade CRUD ─────────────────────────────────────────────────────────────────

/**
 * Inserts a trade record and returns the new rowid.
 * @param {{ chatId, action, asset, amount, condition }} trade
 * @returns {number}
 */
export function insertTrade({ chatId, action, asset, amount, condition }) {
  const result = getDB().prepare(`
        INSERT INTO trades (chat_id, action, asset, amount, condition)
        VALUES (?, ?, ?, ?, ?)
    `).run(String(chatId), action, asset, amount, condition);
  return result.lastInsertRowid;
}

/**
 * Returns all trades for a chat ID, most recent first.
 * @param {string} chatId
 * @param {number} [limit=20]
 */
export function getTradesByChatId(chatId, limit = 20) {
  return getDB().prepare(`
        SELECT * FROM trades WHERE chat_id = ? ORDER BY id DESC LIMIT ?
    `).all(String(chatId), limit);
}

/** Returns all trades (for web dashboard). */
export function getAllTrades(limit = 100) {
  return getDB().prepare('SELECT * FROM trades ORDER BY id DESC LIMIT ?').all(limit);
}


// ── Sync Code (Web Dashboard) ──────────────────────────────────────────────────

/** Generates and stores a 6-char sync code for the web dashboard link flow. */
export function generateSyncCode(chatId) {
  const db = getDB();
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour
  db.prepare('INSERT OR REPLACE INTO links (code, chat_id, expires_at) VALUES (?, ?, ?)').run(code, String(chatId), expires);
  return code;
}

/** Claims a sync code and returns the chatId if valid, or null. */
export function claimSyncCode(code) {
  const db = getDB();
  const row = db.prepare('SELECT * FROM links WHERE code = ?').get(code?.toUpperCase());
  if (!row || Date.now() > row.expires_at) return null;
  db.prepare('DELETE FROM links WHERE code = ?').run(code.toUpperCase());
  return row.chat_id;
}
// ── Referral System ────────────────────────────────────────────────────────────

/**
 * Ensures a user has a unique referral code; creates one if missing.
 * Returns the referral code string.
 * @param {string} telegramId
 * @returns {string}
 */
export function ensureReferralCode(telegramId) {
  const db = getDB();
  const existing = db.prepare('SELECT referral_code FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (existing?.referral_code) return existing.referral_code;

  // Generate a unique 6-char alphanumeric code
  let code;
  let attempts = 0;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    attempts++;
    if (attempts > 20) throw new Error('Failed to generate unique referral code');
  } while (db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code));

  db.prepare('UPDATE users SET referral_code = ? WHERE telegram_id = ?').run(code, String(telegramId));
  return code;
}

/**
 * Applies a referral code: records the referrer→referee relationship.
 * No-op if referee already has a referrer or the code is their own.
 * @param {string} refereeChatId  - the new user's telegram_id
 * @param {string} code           - referral code entered (e.g. "AB12CD")
 * @returns {'ok'|'self'|'already'|'invalid'}
 */
export function applyReferralCode(refereeChatId, code) {
  const db = getDB();
  const referrer = db.prepare('SELECT telegram_id FROM users WHERE referral_code = ?').get(code?.toUpperCase());
  if (!referrer) return 'invalid';
  if (referrer.telegram_id === String(refereeChatId)) return 'self';

  const alreadyReferred = db.prepare('SELECT 1 FROM referrals WHERE referee_chat_id = ?').get(String(refereeChatId));
  if (alreadyReferred) return 'already';

  db.prepare('INSERT OR IGNORE INTO referrals (referrer_chat_id, referee_chat_id) VALUES (?, ?)').run(
    referrer.telegram_id, String(refereeChatId)
  );
  return 'ok';
}

/**
 * Returns referral stats for a user.
 * @param {string} telegramId
 * @returns {{ code: string, count: number, referees: Array<{referee_chat_id, created_at}> }}
 */
export function getReferralStats(telegramId) {
  const db = getDB();
  const user = db.prepare('SELECT referral_code FROM users WHERE telegram_id = ?').get(String(telegramId));
  const code = user?.referral_code ?? null;
  const rows = code
    ? db.prepare('SELECT referee_chat_id, created_at FROM referrals WHERE referrer_chat_id = ? ORDER BY id DESC').all(String(telegramId))
    : [];
  return { code, count: rows.length, referees: rows };
}
