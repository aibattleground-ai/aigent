/**
 * AIGENT - Telegraf Bot
 * Handles incoming messages, routes to Claude AI, and triggers trade execution.
 * Supports: simple trades (mock) and grid bot strategies (Hyperliquid live).
 */
import { Telegraf } from 'telegraf';
import { parseIntent } from './llm.js';
import { executeMockTrade } from './executor.js';

// ── /cancelgrid state store (in-memory — replace with DB for persistence) ──────
const activeGridSessions = new Map(); // chatId → { levels, asset }

/**
 * Initializes and launches the Telegram bot.
 */
export function startBot() {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // ── /start ────────────────────────────────────────────────────────────────
    bot.command('start', (ctx) => {
        const name = ctx.from.first_name || 'Trader';
        ctx.reply(
            `👋 Welcome to *AIGENT*, ${name}!\n\n` +
            `I'm your AI-powered crypto trading agent. Tell me what you want to do in plain English or Korean.\n\n` +
            `*Simple Trade Examples:*\n` +
            `• "Buy $100 of ETH if it drops 5%"\n` +
            `• "이더리움 5% 떨어지면 100달러 매수"\n\n` +
            `*Grid Bot Examples:*\n` +
            `• "Set up a grid on ETH between $2800–$3200 with 20 grids, $1000 USDC"\n` +
            `• "이더리움 2800-3200 그리드봇 20개 격자 1000달러"\n\n` +
            `Type /help for more commands.`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /help ─────────────────────────────────────────────────────────────────
    bot.command('help', (ctx) => {
        ctx.reply(
            `📖 *AIGENT Help*\n\n` +
            `*Supported Strategies:*\n` +
            `• *Simple Trade* — Buy/sell on price condition\n` +
            `• *Grid Bot* — Place limit buy/sell grid on Hyperliquid\n\n` +
            `*Commands:*\n` +
            `/start — Welcome message\n` +
            `/help — This help menu\n` +
            `/history — View recent trades\n` +
            `/cancelgrid — Cancel active grid session\n` +
            `/connect — Link to Web Dashboard\n\n` +
            `*Grid Bot Keywords:* grid, 그리드, 그리드봇, range trading`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /connect ──────────────────────────────────────────────────────────────
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

    // ── /history ──────────────────────────────────────────────────────────────
    bot.command('history', async (ctx) => {
        const { getTradesByChatId } = await import('./db.js');
        const trades = getTradesByChatId(String(ctx.chat.id));

        if (trades.length === 0) {
            return ctx.reply('📭 No trades found. Send me a trade instruction to get started!');
        }

        const lines = trades.slice(0, 10).map((t) =>
            `• [#${t.id}] ${t.action.toUpperCase()} $${t.amount} of ${t.asset} — ${t.condition} (${t.created_at})`
        );

        ctx.reply(
            `📊 *Your Recent Trades:*\n\n${lines.join('\n')}`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /cancelgrid ───────────────────────────────────────────────────────────
    bot.command('cancelgrid', async (ctx) => {
        const chatId = String(ctx.chat.id);
        if (!activeGridSessions.has(chatId)) {
            return ctx.reply('⚠️ No active grid session found for your account.');
        }

        const session = activeGridSessions.get(chatId);
        activeGridSessions.delete(chatId);

        // Note: Cancelling open orders on Hyperliquid requires calling sdk.exchange.cancelAll()
        // This is a placeholder — full cancel logic can be added when order IDs are stored.
        ctx.reply(
            `🛑 *Grid Session Cancelled*\n\n` +
            `Asset: *${session.asset}*\n\n` +
            `⚠️ Note: Open orders on Hyperliquid must be manually cancelled via the exchange interface, or add /cancelorders command with order ID tracking.`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── Main message handler ───────────────────────────────────────────────────
    bot.on('text', async (ctx) => {
        const userText = ctx.message.text;
        if (userText.startsWith('/')) return;

        const thinkingMsg = await ctx.reply('🧠 Claude AI is analyzing your intent...');
        const chatId = String(ctx.chat.id);

        try {
            // ── STEP 1: Parse intent via Claude ──────────────────────────────────
            const intent = await parseIntent(userText);

            if (intent.error) {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(
                    `❌ *Could not parse intent.*\n\n${intent.error}\n\nPlease try again with a clearer instruction.`,
                    { parse_mode: 'Markdown' }
                );
            }

            // ── STEP 2: Route by strategy ─────────────────────────────────────
            const strategy = intent.strategy || 'simple';

            // ── GRID BOT STRATEGY ─────────────────────────────────────────────
            if (strategy === 'grid') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });

                // Show parsed intent immediately
                await ctx.reply(
                    `🧠 *Claude AI Parsed Intent:*\n` +
                    `\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\`\n\n` +
                    `⚙️ *Initializing Hyperliquid Grid Bot...*\n` +
                    `Fetching mark price and placing ${intent.grid_count || '?'} grid orders. This may take up to 30 seconds.`,
                    { parse_mode: 'Markdown' }
                );

                // Dynamically import grid module (avoids loading SDK if not needed)
                const { runGridBot } = await import('./strategies/grid.js');
                const result = await runGridBot(intent, chatId);

                if (result.success) {
                    // Store active session in memory
                    activeGridSessions.set(chatId, { asset: intent.asset, stats: result.stats });
                    await ctx.reply(result.summary, { parse_mode: 'Markdown' });
                } else {
                    await ctx.reply(result.error, { parse_mode: 'Markdown' });
                }

                return;
            }

            // ── SIMPLE TRADE (default) ────────────────────────────────────────
            const { action, asset, amount, condition } = intent;

            if (!action || !asset || !amount || !condition) {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(
                    `⚠️ *Incomplete Intent Detected.*\n\nI need: action, asset, amount, and condition.\n\n` +
                    `Example: "Buy $100 of ETH if it drops 5%"\n` +
                    `Example (grid): "ETH 그리드봇 2800-3200달러 20개 1000달러"`,
                    { parse_mode: 'Markdown' }
                );
            }

            const { tradeId, summary } = executeMockTrade(chatId, intent);

            await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });

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
            await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
            ctx.reply(
                `❌ *Unexpected Error*\n\n\`${err.message || 'Unknown error'}\`\n\nPlease try again later.`,
                { parse_mode: 'Markdown' }
            );
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
