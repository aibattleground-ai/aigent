/**
 * AIGENT Bot — Entry Point
 */
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

// ── Global Error Handlers ──────────────────────────────────────────────────────
// Must be registered BEFORE any async code runs so no crash goes silent.
process.on('uncaughtException', (err) => {
  console.error('');
  console.error('💥 ══════════════════════════════════════════');
  console.error('💥 UNCAUGHT EXCEPTION — Bot will exit');
  console.error('💥 ══════════════════════════════════════════');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('');
  console.error('💥 ══════════════════════════════════════════');
  console.error('💥 UNHANDLED PROMISE REJECTION — Bot will exit');
  console.error('💥 ══════════════════════════════════════════');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

// Validate required environment variables
const REQUIRED = ['TELEGRAM_BOT_TOKEN', 'ANTHROPIC_API_KEY'];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('');
  console.error('❌ ══════════════════════════════════════════');
  console.error('❌  Missing required environment variables:');
  missing.forEach((k) => console.error(`   • ${k}`));
  console.error('❌  Check your .env file and try again.');
  console.error('❌ ══════════════════════════════════════════');
  process.exit(1);
}

console.log('🚀 AIGENT starting...');

// Dynamic import AFTER dotenv runs so all env vars are loaded in time
const { startBot } = await import('./bot.js');

// await keeps the Node process alive until Telegraf's polling loop takes over
await startBot();
