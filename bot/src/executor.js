/**
 * NexusSphere - Mock Trade Executor
 * Simulates trade execution and persists results to a JSON file database.
 */
import { insertTrade } from './db.js';

/**
 * Executes a mock trade based on parsed intent.
 * Logs the trade to console and stores it in the database.
 *
 * @param {string} chatId - Telegram chat ID of the initiating user.
 * @param {Object} intent - Parsed intent from the LLM.
 * @param {string} intent.action   - "buy" or "sell"
 * @param {string} intent.asset    - Asset ticker (e.g., "ETH")
 * @param {number} intent.amount   - USD amount
 * @param {string} intent.condition - Trigger condition
 * @returns {{ tradeId: number, summary: string }} - Result with DB ID and human-readable summary.
 */
export function executeMockTrade(chatId, intent) {
    const { action, asset, amount, condition } = intent;

    // Persist the trade to SQLite
    const tradeId = insertTrade({ chatId, action, asset, amount, condition });

    const summary = `[#${tradeId}] ${action.toUpperCase()} $${amount} of ${asset.toUpperCase()} — Trigger: "${condition}"`;

    // Also log to console for developer visibility
    console.log(`[EXECUTOR] Mock trade executed: ${summary} (Chat: ${chatId})`);

    return { tradeId, summary };
}
