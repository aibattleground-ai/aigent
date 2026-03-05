/**
 * AIGENT - Multi-Language, Multi-User Telegram Bot
 * Supports: EN / KO / ES / ZH
 * Per-user wallet generation + Hyperliquid signing
 */
import { Telegraf } from 'telegraf';
import { parseIntent } from './llm.js';
import { executeMockTrade } from './executor.js';
import { startDashboard, killdDashboard, getActiveSessions } from './dashboard.js';
import { initDB, insertTrade, getTradesByChatId, generateSyncCode } from './db.js';
import { onboardUser, updateLanguage, getUserLang, getUserWallet, getUserPrivateKey } from './users.js';
import { t, LANGUAGES } from './i18n.js';

// ── Active grid sessions (in-memory) ──────────────────────────────────────────
const gridSessions = new Map(); // chatId → { asset, stats }

// ── Language selection keyboard ───────────────────────────────────────────────
const LANG_KEYBOARD = {
    inline_keyboard: [[
        { text: '🇬🇧 English', callback_data: 'lang:en' },
        { text: '🇰🇷 한국어', callback_data: 'lang:ko' },
    ], [
        { text: '🇪🇸 Español', callback_data: 'lang:es' },
        { text: '🇨🇳 中文', callback_data: 'lang:zh' },
    ]],
};

// ── Helper: get user's lang from DB ──────────────────────────────────────────
function lang(chatId) {
    return getUserLang(String(chatId));
}

// ── Helper: route strategies to HL using per-user private key ─────────────────
async function getPerUserPrivateKey(chatId) {
    return getUserPrivateKey(String(chatId));
}

export function startBot() {
    initDB();
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // ── /start ────────────────────────────────────────────────────────────────
    bot.command('start', async (ctx) => {
        const chatId = String(ctx.chat.id);
        const existingLang = lang(chatId);
        const existingWallet = getUserWallet(chatId);

        // If already onboarded, skip language selection and show dashboard hint
        if (existingWallet) {
            return ctx.reply(
                t(existingLang, 'wallet_header', { wallet: existingWallet }) + '\n\n' +
                `📊 /dashboard   📖 /help   🌐 /language`,
                { parse_mode: 'Markdown' }
            );
        }

        // First time — show language selector
        await ctx.reply(
            t('en', 'select_language'),
            { parse_mode: 'Markdown', reply_markup: LANG_KEYBOARD }
        );
    });

    // ── /language — re-select language ─────────────────────────────────────────
    bot.command('language', async (ctx) => {
        await ctx.reply(
            t(lang(ctx.chat.id), 'select_language'),
            { parse_mode: 'Markdown', reply_markup: LANG_KEYBOARD }
        );
    });

    // ── Language callback handler ─────────────────────────────────────────────
    bot.action(/^lang:(.+)$/, async (ctx) => {
        const chatId = String(ctx.chat.id);
        const selectedLang = ctx.match[1]; // "en" | "ko" | "es" | "zh"

        if (!LANGUAGES[selectedLang]) return ctx.answerCbQuery('Invalid language.');

        // Acknowledge button press
        await ctx.answerCbQuery(`${LANGUAGES[selectedLang].flag} ${LANGUAGES[selectedLang].label}`);
        await ctx.editMessageReplyMarkup({}); // Remove keyboard

        // Show "generating wallet..." message
        const genMsg = await ctx.reply(
            t(selectedLang, 'generating_wallet'),
            { parse_mode: 'Markdown' }
        );

        try {
            // Onboard user (creates DB record + generates wallet if needed)
            const { walletAddress } = await onboardUser(chatId, selectedLang);
            updateLanguage(chatId, selectedLang);

            // Delete spinner message
            await ctx.telegram.deleteMessage(chatId, genMsg.message_id).catch(() => { });

            // Send full welcome message
            await ctx.reply(
                t(selectedLang, 'welcome', { wallet: walletAddress }),
                { parse_mode: 'Markdown' }
            );

        } catch (err) {
            console.error('[BOT] Onboarding error:', err);
            await ctx.telegram.deleteMessage(chatId, genMsg.message_id).catch(() => { });
            await ctx.reply(t(selectedLang, 'error_generic'), { parse_mode: 'Markdown' });
        }
    });

    // ── /wallet ───────────────────────────────────────────────────────────────
    bot.command('wallet', async (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        const wallet = getUserWallet(chatId);
        if (!wallet) return ctx.reply(t(l, 'error_no_user'), { parse_mode: 'Markdown' });
        ctx.reply(t(l, 'wallet_header', { wallet }), { parse_mode: 'Markdown' });
    });

    // ── /help ─────────────────────────────────────────────────────────────────
    bot.command('help', (ctx) => {
        ctx.reply(t(lang(ctx.chat.id), 'help'), { parse_mode: 'Markdown' });
    });

    // ── /dashboard ────────────────────────────────────────────────────────────
    bot.command('dashboard', async (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);

        const args = ctx.message.text.split(/\s+/).slice(1);
        const requestedAsset = args[0]?.toUpperCase() || null;
        const gs = gridSessions.get(chatId);
        const asset = requestedAsset || gs?.stats?.asset || 'ETH';

        await ctx.reply(
            `_Initializing ${asset}/USDC terminal..._`,
            { parse_mode: 'Markdown' }
        );

        await startDashboard(bot, chatId, {
            asset,
            gridCount: gs?.stats?.gridCount || 0,
            totalUsdc: gs?.stats?.totalUsdc || 0,
            lowerPrice: gs?.stats?.lowerPrice || 0,
            upperPrice: gs?.stats?.upperPrice || 0,
        });
    });

    // ── /stopdashboard ────────────────────────────────────────────────────────
    bot.command('stopdashboard', (ctx) => {
        killdDashboard(String(ctx.chat.id));
        ctx.reply(t(lang(ctx.chat.id), 'stop_dashboard'));
    });

    // ── /cancelgrid ───────────────────────────────────────────────────────────
    bot.command('cancelgrid', (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        const gs = gridSessions.get(chatId);
        killdDashboard(chatId);
        if (!gs) return ctx.reply(t(l, 'no_grid'));
        gridSessions.delete(chatId);
        ctx.reply(t(l, 'grid_cancelled', { asset: gs.stats?.asset || 'N/A' }), { parse_mode: 'Markdown' });
    });

    // ── /history ──────────────────────────────────────────────────────────────
    bot.command('history', async (ctx) => {
        const chatId = String(ctx.chat.id);
        const trades = getTradesByChatId(chatId);
        if (trades.length === 0) return ctx.reply('No trades found.');
        const lines = trades.slice(0, 10).map(
            (t) => `[#${t.id}] ${t.action.toUpperCase()} $${t.amount} ${t.asset}`
        );
        ctx.reply(`*Recent Trades:*\n\`\`\`\n${lines.join('\n')}\n\`\`\``, { parse_mode: 'Markdown' });
    });

    // ── /connect (web dashboard sync) ─────────────────────────────────────────
    bot.command('connect', (ctx) => {
        const chatId = String(ctx.chat.id);
        const code = generateSyncCode(chatId);
        ctx.reply(
            `*AIGENT Account Link*\n\nSync Code: \`${code}\`\n\n_(Valid for 1 hour)_`,
            { parse_mode: 'Markdown' }
        );
    });

    // ── Main NL message handler ───────────────────────────────────────────────
    bot.on('text', async (ctx) => {
        const userText = ctx.message.text;
        if (userText.startsWith('/')) return;

        const chatId = String(ctx.chat.id);
        const l = lang(chatId);

        // Gate: require onboarding
        const wallet = getUserWallet(chatId);
        if (!wallet) {
            return ctx.reply(
                t(l, 'error_no_user'),
                { parse_mode: 'Markdown', reply_markup: LANG_KEYBOARD }
            );
        }

        const thinkingMsg = await ctx.reply('_Analyzing intent..._', { parse_mode: 'Markdown' });

        try {
            const intent = await parseIntent(userText);

            if (intent.error) {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(
                    t(l, 'parse_error', { error: intent.error }),
                    { parse_mode: 'Markdown' }
                );
            }

            const strategy = intent.strategy || 'simple';

            // ── GRID ──────────────────────────────────────────────────────────
            if (strategy === 'grid') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                await ctx.reply(
                    `*Intent:*\n\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\`\n` +
                    `_Placing ${intent.grid_count || '?'} grid orders on Hyperliquid..._`,
                    { parse_mode: 'Markdown' }
                );

                // Inject per-user private key
                let userPk;
                try { userPk = getPerUserPrivateKey(chatId); } catch (e) {
                    return ctx.reply(`❌ ${e.message}`, { parse_mode: 'Markdown' });
                }

                const { runGridBot } = await import('./strategies/grid.js');
                const result = await runGridBot(intent, chatId, userPk);

                if (result.success) {
                    gridSessions.set(chatId, { asset: intent.asset, stats: result.stats });
                    await ctx.reply(result.summary, { parse_mode: 'Markdown' });
                    await ctx.reply(`_Launching ${intent.asset}/USDC terminal..._`, { parse_mode: 'Markdown' });
                    await startDashboard(bot, chatId, {
                        asset: result.stats.asset, gridCount: result.stats.gridCount,
                        totalUsdc: result.stats.totalUsdc, lowerPrice: result.stats.lowerPrice,
                        upperPrice: result.stats.upperPrice,
                    });
                } else {
                    await ctx.reply(result.error, { parse_mode: 'Markdown' });
                }
                return;
            }

            // ── UNIVERSAL ORDER ───────────────────────────────────────────────
            if (strategy === 'order') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                await ctx.reply(
                    `*Intent:*\n\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\`\n` +
                    `_Executing ${intent.type || 'market'} order on Hyperliquid..._`,
                    { parse_mode: 'Markdown' }
                );

                let userPk;
                try { userPk = getPerUserPrivateKey(chatId); } catch (e) {
                    return ctx.reply(`❌ ${e.message}`, { parse_mode: 'Markdown' });
                }

                const { executeUniversalOrder } = await import('./strategies/order.js');
                const result = await executeUniversalOrder(intent, userPk);

                if (result.success) {
                    await ctx.reply(result.summary, { parse_mode: 'Markdown' });
                    await ctx.reply(`_Launching ${result.details.asset}/USDC terminal..._`, { parse_mode: 'Markdown' });
                    await startDashboard(bot, chatId, {
                        asset: result.details.asset, gridCount: 0,
                        totalUsdc: result.details.sizeUsd, lowerPrice: 0, upperPrice: 0,
                    });
                } else {
                    await ctx.reply(result.error, { parse_mode: 'Markdown' });
                }
                return;
            }

            // ── SIMPLE TRADE ──────────────────────────────────────────────────
            const { action, asset, amount, condition } = intent;
            if (!action || !asset || !amount || !condition) {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(t(l, 'incomplete_intent'), { parse_mode: 'Markdown' });
            }

            const tradeId = insertTrade({ chatId, action, asset, amount, condition });
            await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
            await ctx.reply(
                t(l, 'trade_configured', {
                    id: tradeId,
                    summary: `${action.toUpperCase()} $${amount} ${asset} — ${condition}`,
                }),
                { parse_mode: 'Markdown' }
            );

        } catch (err) {
            console.error('[BOT] Error:', err);
            await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
            ctx.reply(t(lang(chatId), 'error_generic'), { parse_mode: 'Markdown' });
        }
    });

    // ── Session logger ────────────────────────────────────────────────────────
    setInterval(() => {
        const n = getActiveSessions();
        if (n > 0) console.log(`[BOT] Active dashboard sessions: ${n}`);
    }, 300_000);

    // ── Launch ────────────────────────────────────────────────────────────────
    const launch = async (retries = 10) => {
        try {
            await bot.launch({ dropPendingUpdates: true });
            console.log('AIGENT multi-lang bot started.');
        } catch (err) {
            if (err.response?.error_code === 409 && retries > 0) {
                console.log(`Telegram 409 conflict — retrying in 10s... (${retries} left)`);
                await new Promise((r) => setTimeout(r, 10_000));
                return launch(retries - 1);
            }
            throw err;
        }
    };

    launch().catch((err) => { console.error('Bot failed to start:', err.message); process.exit(1); });
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
