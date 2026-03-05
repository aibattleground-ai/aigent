/**
 * AIGENT — Per-User Wallet Manager
 * File: bot/src/users.js
 *
 * Handles per-user EVM wallet generation and encrypted private key retrieval.
 * Each Telegram user gets a unique, HD-derived EVM wallet on first onboarding.
 *
 * SECURITY MODEL:
 *   - Private keys are AES-256 encrypted with WALLET_ENCRYPTION_KEY from .env
 *   - Encrypted ciphertext is stored in the SQLite users table
 *   - Plaintext private key is NEVER logged or stored in cleartext
 *   - In-memory decryption only at order execution time
 *
 * REQUIRED .env:
 *   WALLET_ENCRYPTION_KEY=<any-long-random-string>   ← min 32 chars recommended
 *
 * Note: For a production system beyond this MVP, use a Hardware Security Module
 * (HSM) or a KMS (e.g. AWS KMS) instead of AES+env key.
 */

import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import { getUser, createUser, setUserLang, saveUserWallet } from './db.js';

// ── Encryption helpers ─────────────────────────────────────────────────────────

function getEncryptionKey() {
    const key = process.env.WALLET_ENCRYPTION_KEY;
    if (!key || key.length < 16) {
        throw new Error(
            'WALLET_ENCRYPTION_KEY is missing or too short in .env.\n' +
            'Add: WALLET_ENCRYPTION_KEY=<any-long-random-secret-string>'
        );
    }
    return key;
}

/**
 * AES-encrypts a plaintext string.
 * @param {string} plaintext
 * @returns {string} Ciphertext string
 */
function encrypt(plaintext) {
    return CryptoJS.AES.encrypt(plaintext, getEncryptionKey()).toString();
}

/**
 * AES-decrypts a ciphertext string.
 * @param {string} ciphertext
 * @returns {string} Plaintext string
 */
function decrypt(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, getEncryptionKey());
    return bytes.toString(CryptoJS.enc.Utf8);
}

// ── Wallet Generation ──────────────────────────────────────────────────────────

/**
 * Generates a new random EVM wallet using ethers.js.
 * Returns address and AES-encrypted private key.
 *
 * @returns {{ address: string, encryptedPk: string }}
 */
function generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        encryptedPk: encrypt(wallet.privateKey),
    };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Full onboarding flow for a new user:
 * 1. Creates user record in DB with selected language
 * 2. Generates a fresh EVM wallet
 * 3. Saves encrypted private key to DB
 *
 * Idempotent: if user already exists and has a wallet, returns existing wallet address.
 *
 * @param {string} telegramId
 * @param {string} lang - "en" | "ko" | "es" | "zh"
 * @returns {Promise<{ walletAddress: string, isNew: boolean }>}
 */
export async function onboardUser(telegramId, lang) {
    const id = String(telegramId);

    // Create DB record if not exists
    createUser(id, lang);

    // Check if wallet already exists
    const existing = getUser(id);
    if (existing?.wallet_address) {
        // Just update language if they re-selected
        setUserLang(id, lang);
        return { walletAddress: existing.wallet_address, isNew: false };
    }

    // Generate new wallet (synchronous, ~2ms)
    const { address, encryptedPk } = generateWallet();
    saveUserWallet(id, address, encryptedPk);

    console.log(`[USERS] New wallet generated for ${id}: ${address}`);
    return { walletAddress: address, isNew: true };
}

/**
 * Updates a user's language preference without re-generating wallet.
 * @param {string} telegramId
 * @param {string} lang
 */
export function updateLanguage(telegramId, lang) {
    setUserLang(String(telegramId), lang);
}

/**
 * Returns the user's language preference, or "en" as default.
 * @param {string} telegramId
 * @returns {string}
 */
export function getUserLang(telegramId) {
    const user = getUser(String(telegramId));
    return user?.lang || 'en';
}

/**
 * Returns the user's wallet address, or null if not onboarded.
 * @param {string} telegramId
 * @returns {string | null}
 */
export function getUserWallet(telegramId) {
    const user = getUser(String(telegramId));
    return user?.wallet_address || null;
}

/**
 * Decrypts and returns the user's private key for Hyperliquid signing.
 * Called only at order-execution time — never stored in memory long-term.
 *
 * @param {string} telegramId
 * @returns {string} - Raw private key (0x...)
 * @throws if user not found or wallet not generated
 */
export function getUserPrivateKey(telegramId) {
    const user = getUser(String(telegramId));

    if (!user) {
        throw new Error('User not found. Please /start the bot first.');
    }
    if (!user.encrypted_pk) {
        throw new Error('No wallet found for this user. Please /start to generate your wallet.');
    }

    const pk = decrypt(user.encrypted_pk);
    if (!pk || pk.length < 32) {
        throw new Error('Wallet decryption failed. WALLET_ENCRYPTION_KEY may have changed.');
    }
    return pk;
}
