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
            `/history — View your recent mock trades`,
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

    // ── Launch ────────────────────────────────────────────────────────────────
    bot.launch({ dropPendingUpdates: true });
    console.log('🤖 AIGENT Telegram bot started successfully.');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
