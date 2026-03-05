/**
 * AIGENT Bot - Entry Point
 * Initializes the database and starts the Telegram bot.
 */
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

import { initDB } from './db.js';
import { startBot } from './bot.js';

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'ANTHROPIC_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize JSON database, then start the bot
initDB();
startBot();

console.log('🚀 AIGENT is online...');
