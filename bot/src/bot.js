/**
 * AIGENT - Telegraf Bot
 * Handles incoming messages, routes to Claude AI, and triggers mock execution.
 */
import { Telegraf } from 'telegraf';
import { parseIntent } from './llm.js';
import { executeMockTrade } from './executor.js';

/**
 * Initializes and launches the Telegram bot.
 */
export function startBot() {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // ── /start command ────────────────────────────────────────────────────────
    bot.command('start', (ctx) => {
        const name = ctx.from.first_name || 'Trader';
        ctx.reply(
            `👋 Welcome to *AIGENT*, ${name}!\n\n` +
            `I'm your AI-powered crypto trading agent. Tell me what you want to do in plain English.\n\n` +
            `*Examples:*\n` +
            `• "Buy $100 of ETH if it drops 5%"\n` +
            `• "Sell $200 of BTC when price hits $70,000"\n` +
            `• "Buy $50 of SOL immediately"\n\n` +
            `Type /help for more info.`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /help command ─────────────────────────────────────────────────────────
    bot.command('help', (ctx) => {
        ctx.reply(
            `📖 *AIGENT Help*\n\n` +
            `Simply describe your trade in natural language. I'll parse your intent using Claude AI and configure a mock trade agent.\n\n` +
            `*Supported actions:* buy / sell\n` +
            `*Supported assets:* BTC, ETH, SOL, and more\n\n` +
            `*Commands:*\n` +
            `/start — Welcome message\n` +
            `/help — This help menu\n` +
            `/history — View your recent mock trades\n` +
            `/connect — Link your Telegram to the Web Dashboard`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /connect command ──────────────────────────────────────────────────────
    bot.command('connect', async (ctx) => {
        const { generateSyncCode } = await import('./db.js');
        const code = generateSyncCode(String(ctx.chat.id));
        ctx.reply(
            `🔗 *AIGENT Account Link*\n\n` +
            `Your Sync Code is: \`${code}\`\n\n` +
            `Go to the AIGENT Web Dashboard, click **Connect Telegram**, and enter this code to see your personal trades. (Valid for 1 hour)`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /history command ───────────────────────────────────────────────────────
    bot.command('history', async (ctx) => {
        const { getTradesByChatId } = await import('./db.js');
        const trades = getTradesByChatId(String(ctx.chat.id));

        if (trades.length === 0) {
            return ctx.reply('📭 No mock trades found. Send me a trade instruction to get started!');
        }

        const lines = trades.slice(0, 10).map((t) =>
            `• [#${t.id}] ${t.action.toUpperCase()} $${t.amount} of ${t.asset} — ${t.condition} (${t.created_at})`
        );

        ctx.reply(
            `📊 *Your Recent Mock Trades:*\n\n${lines.join('\n')}`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── Main message handler ───────────────────────────────────────────────────
    bot.on('text', async (ctx) => {
        const userText = ctx.message.text;

        // Ignore commands from being parsed as natural language
        if (userText.startsWith('/')) return;

        const thinkingMsg = await ctx.reply('🧠 Claude AI is analyzing your intent...');

        try {
            // Step 1: Parse intent via Claude AI
            const intent = await parseIntent(userText);

            if (intent.error) {
                await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(
                    `❌ *Could not parse intent.*\n\n${intent.error}\n\nPlease try again with a clearer instruction.`,
                    { parse_mode: 'Markdown' }
                );
            }

            const { action, asset, amount, condition } = intent;
            if (!action || !asset || !amount || !condition) {
                await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(
                    `⚠️ *Incomplete Intent Detected.*\n\nI need: action, asset, amount, and condition.\n\nExample: "Buy $100 of ETH if it drops 5%"`,
                    { parse_mode: 'Markdown' }
                );
            }

            // Step 2: Execute mock trade
            const { tradeId, summary } = executeMockTrade(String(ctx.chat.id), intent);

            await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => { });

            // Step 3: Reply with confirmation
            await ctx.reply(
                `✅ *AIGENT Configured!*\n\n` +
                `🤖 *Parsed Intent (Claude AI):*\n` +
                `\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\`\n\n` +
                `🚀 *Mock Trade Executed:*\n${summary}\n\n` +
                `_Use /history to view all trades._`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.error('[BOT] Error handling message:', err);
            await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => { });
            ctx.reply('❌ An unexpected error occurred. Please try again later.');
        }
    });

    // ── Launch with auto-retry on 409 conflict ────────────────────────────────
    const launch = async (retries = 10) => {
        try {
            await bot.launch({ dropPendingUpdates: true });
            console.log('🤖 AIGENT Telegram bot started successfully.');
        } catch (err) {
            if (err.response?.error_code === 409 && retries > 0) {
                console.log(`⏳ Telegram 409 conflict — waiting 10s and retrying... (${retries} left)`);
                await new Promise((r) => setTimeout(r, 10000));
                return launch(retries - 1);
            }
            throw err;
        }
    };

    launch().catch((err) => {
        console.error('❌ Bot failed to start:', err.message);
        process.exit(1);
    });

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
