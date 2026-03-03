/**
 * NexusSphere Bot - Entry Point
 * Initializes the database and starts the Telegram bot.
 */
import 'dotenv/config';
import { initDB } from './db.js';
import { startBot } from './bot.js';

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize SQLite database, then start the bot
initDB();
startBot();

console.log('🚀 NexusSphere Agent is online...');
