#!/usr/bin/env node
/**
 * AIGENT Bot - Self-restarting launcher
 * Handles Telegram's 409 conflict by restarting the process automatically.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 12000;

let retries = 0;

function startBot() {
    const child = spawn('node', [path.join(__dirname, 'index.js')], {
        stdio: 'inherit',
        env: process.env,
    });

    child.on('exit', (code, signal) => {
        if (signal === 'SIGINT' || signal === 'SIGTERM') {
            console.log('\n👋 AIGENT Bot stopped.');
            process.exit(0);
        }

        if (retries < MAX_RETRIES) {
            retries++;
            console.log(`\n⏳ Bot exited (code ${code}). Restarting in ${RETRY_DELAY_MS / 1000}s... (attempt ${retries}/${MAX_RETRIES})`);
            setTimeout(startBot, RETRY_DELAY_MS);
        } else {
            console.error('❌ Max retries reached. Bot is not starting. Check your config.');
            process.exit(1);
        }
    });

    process.once('SIGINT', () => { child.kill('SIGINT'); });
    process.once('SIGTERM', () => { child.kill('SIGTERM'); });
}

console.log('🚀 AIGENT Bot Launcher starting...');
startBot();
