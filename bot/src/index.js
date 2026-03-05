/**
 * AIGENT Bot — Entry Point
 */
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

// Validate required environment variables
const REQUIRED = ['TELEGRAM_BOT_TOKEN', 'ANTHROPIC_API_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

console.log('🚀 AIGENT starting...');

// Dynamic import AFTER dotenv runs so all env vars are loaded in time
const { startBot } = await import('./bot.js');

// await keeps the Node process alive until Telegraf's polling loop takes over
await startBot();
