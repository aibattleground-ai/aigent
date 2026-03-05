/**
 * AIGENT - Telegraf Bot
 * Handles incoming messages, routes to Claude AI, executes strategies.
 * Supports: /dashboard, grid bot (Hyperliquid), universal order (market/limit), simple trades.
 */
import { Telegraf } from 'telegraf';
import { parseIntent } from './llm.js';
import { executeMockTrade } from './executor.js';
import { startDashboard, killdDashboard, getSession, getActiveSessions } from './dashboard.js';

// ── In-memory grid session store ──────────────────────────────────────────────
// chatId → { asset, stats }  (set after a successful grid bot run)
const activeGridSessions = new Map();

/**
 * Initializes and launches the Telegram bot.
 */
export function startBot() {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // ── /start ────────────────────────────────────────────────────────────────
    bot.command('start', (ctx) => {
        const name = ctx.from.first_name || 'Trader';
        ctx.reply(
            `*AIGENT PROTOCOL ${name.toUpperCase()}*\n` +
            `_Autonomous AI Liquidity Engine — LIVE_\n\n` +
            `*Commands:*\n` +
            `/dashboard — Live terminal dashboard\n` +
            `/cancelgrid — Stop active grid session\n` +
            `/history — Recent trades\n` +
            `/help — Full help\n\n` +
            `*Natural Language:*\n` +
            `• "ETH 그리드봇 2800-3200 20개 $1000"\n` +
            `• "Buy $200 of BTC if it drops 5%"`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /help ─────────────────────────────────────────────────────────────────
    bot.command('help', (ctx) => {
        ctx.reply(
            `*AIGENT — Command Reference*\n\n` +
            `*Dashboard:*\n` +
            `/dashboard [ASSET] — Live terminal (default: ETH)\n` +
            `  Example: /dashboard BTC\n\n` +
            `*Grid Bot (Hyperliquid):*\n` +
            `"Set up ETH grid $2800–$3200, 20 grids, $1000"\n` +
            `"이더리움 2800-3200 그리드봇 20개 1000달러"\n\n` +
            `*Simple Trade:*\n` +
            `"Buy $100 ETH if drops 5%"\n\n` +
            `*Session Control:*\n` +
            `/cancelgrid — Stop active grid\n` +
            `/history — Trade history\n` +
            `/connect — Link web dashboard`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /dashboard ────────────────────────────────────────────────────────────
    bot.command('dashboard', async (ctx) => {
        const chatId = String(ctx.chat.id);

        // Parse optional asset argument: /dashboard BTC
        const args = ctx.message.text.split(/\s+/).slice(1);
        const requestedAsset = args[0]?.toUpperCase() || null;

        // Determine session context
        const gridSession = activeGridSessions.get(chatId);
        const asset = requestedAsset || gridSession?.stats?.asset || 'ETH';
        const gridCount = gridSession?.stats?.gridCount || 0;
        const totalUsdc = gridSession?.stats?.totalUsdc || 0;
        const lowerPrice = gridSession?.stats?.lowerPrice || 0;
        const upperPrice = gridSession?.stats?.upperPrice || 0;

        // Confirm to user (brief message before dashboard appears)
        await ctx.reply(
            `*AIGENT Dashboard* — Initializing ${asset}/USDC terminal...\n_Fetching live data..._`,
            { parse_mode: 'Markdown' }
        );

        // Start (or restart) dashboard
        await startDashboard(bot, chatId, {
            asset, gridCount, totalUsdc, lowerPrice, upperPrice,
        });
    });

    // ── /connect ──────────────────────────────────────────────────────────────
    bot.command('connect', async (ctx) => {
        const { generateSyncCode } = await import('./db.js');
        const code = generateSyncCode(String(ctx.chat.id));
        ctx.reply(
            `*AIGENT Account Link*\n\n` +
            `Sync Code: \`${code}\`\n\n` +
            `Enter this code in the AIGENT Web Dashboard to link your account. (Valid 1 hour)`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /history ──────────────────────────────────────────────────────────────
    bot.command('history', async (ctx) => {
        const { getTradesByChatId } = await import('./db.js');
        const trades = getTradesByChatId(String(ctx.chat.id));

        if (trades.length === 0) {
            return ctx.reply('No trades found. Send a trade instruction to begin.');
        }

        const lines = trades.slice(0, 10).map((t) =>
            `[#${t.id}] ${t.action.toUpperCase()} $${t.amount} ${t.asset} — ${t.condition}`
        );

        ctx.reply(
            `*Recent Trades:*\n\`\`\`\n${lines.join('\n')}\n\`\`\``,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /cancelgrid ───────────────────────────────────────────────────────────
    bot.command('cancelgrid', async (ctx) => {
        const chatId = String(ctx.chat.id);
        const session = activeGridSessions.get(chatId);

        // Also kill any running dashboard for this user
        killdDashboard(chatId);

        if (!session) {
            return ctx.reply('No active grid session found.');
        }

        activeGridSessions.delete(chatId);
        ctx.reply(
            `*Grid Session Stopped*\n\n` +
            `Asset: ${session.stats?.asset || 'N/A'}\n\n` +
            `_Note: Open orders on Hyperliquid must be cancelled via the exchange UI or API._`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── /stopdashboard ────────────────────────────────────────────────────────
    bot.command('stopdashboard', (ctx) => {
        const chatId = String(ctx.chat.id);
        killdDashboard(chatId);
        ctx.reply('Dashboard stopped. Use /dashboard to restart.');
    });

    // ── Main NL message handler ───────────────────────────────────────────────
    bot.on('text', async (ctx) => {
        const userText = ctx.message.text;
        if (userText.startsWith('/')) return;

        const chatId = String(ctx.chat.id);
        const thinkingMsg = await ctx.reply('_Parsing intent via Claude AI..._', { parse_mode: 'Markdown' });

        try {
            // Step 1: Parse intent
            const intent = await parseIntent(userText);

            if (intent.error) {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(
                    `*Parse Error:* ${intent.error}\n\nTry: "ETH grid 2800-3200 20 grids $1000"`,
                    { parse_mode: 'Markdown' }
                );
            }

            const strategy = intent.strategy || 'simple';

            // ── GRID STRATEGY ─────────────────────────────────────────────────
            if (strategy === 'grid') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });

                await ctx.reply(
                    `*Intent Parsed:*\n\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\`\n` +
                    `Placing ${intent.grid_count || '?'} grid orders on Hyperliquid...`,
                    { parse_mode: 'Markdown' }
                );

                const { runGridBot } = await import('./strategies/grid.js');
                const result = await runGridBot(intent, chatId);

                if (result.success) {
                    // Store grid session
                    activeGridSessions.set(chatId, { asset: intent.asset, stats: result.stats });
                    await ctx.reply(result.summary, { parse_mode: 'Markdown' });

                    // Auto-launch dashboard after successful grid setup
                    await ctx.reply(
                        `_Launching live dashboard for ${intent.asset}/USDC..._`,
                        { parse_mode: 'Markdown' }
                    );
                    await startDashboard(bot, chatId, {
                        asset: result.stats.asset,
                        gridCount: result.stats.gridCount,
                        totalUsdc: result.stats.totalUsdc,
                        lowerPrice: result.stats.lowerPrice,
                        upperPrice: result.stats.upperPrice,
                    });
                } else {
                    await ctx.reply(result.error, { parse_mode: 'Markdown' });
                }

                return;
            }

            // ── UNIVERSAL ORDER STRATEGY ──────────────────────────────────────
            if (strategy === 'order') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });

                await ctx.reply(
                    `*Intent Parsed:*\n\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\`\n` +
                    `_Executing ${intent.type || 'market'} order on Hyperliquid..._`,
                    { parse_mode: 'Markdown' }
                );

                const { executeUniversalOrder } = await import('./strategies/order.js');
                const result = await executeUniversalOrder(intent);

                if (result.success) {
                    await ctx.reply(result.summary, { parse_mode: 'Markdown' });

                    // Auto-launch dashboard for the traded asset
                    await ctx.reply(
                        `_Launching ${result.details.asset}/USDC terminal..._`,
                        { parse_mode: 'Markdown' }
                    );
                    await startDashboard(bot, chatId, {
                        asset: result.details.asset,
                        gridCount: 0,
                        totalUsdc: result.details.sizeUsd,
                        lowerPrice: 0,
                        upperPrice: 0,
                    });
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
                    `*Incomplete intent.* Provide: action, asset, amount, condition.\n` +
                    `Example: "Buy $100 of ETH if drops 5%"`,
                    { parse_mode: 'Markdown' }
                );
            }

            const { tradeId, summary } = executeMockTrade(chatId, intent);
            await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });

            await ctx.reply(
                `*Trade Configured [#${tradeId}]*\n` +
                `\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\`\n` +
                `${summary}`,
                { parse_mode: 'Markdown' }
            );

        } catch (err) {
            console.error('[BOT] Unhandled error:', err);
            await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
            ctx.reply(`*Error:* \`${err.message || 'Unknown error'}\``, { parse_mode: 'Markdown' });
        }
    });

    // ── Log active sessions periodically (opt) ────────────────────────────────
    setInterval(() => {
        const count = getActiveSessions();
        if (count > 0) console.log(`[BOT] Active dashboard sessions: ${count}`);
    }, 300_000); // every 5 min

    // ── Launch ────────────────────────────────────────────────────────────────
    const launch = async (retries = 10) => {
        try {
            await bot.launch({ dropPendingUpdates: true });
            console.log('AIGENT bot started. Dashboard engine active.');
        } catch (err) {
            if (err.response?.error_code === 409 && retries > 0) {
                console.log(`Telegram 409 conflict — retrying in 10s... (${retries} left)`);
                await new Promise((r) => setTimeout(r, 10000));
                return launch(retries - 1);
            }
            throw err;
        }
    };

    launch().catch((err) => {
        console.error('Bot failed to start:', err.message);
        process.exit(1);
    });

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
