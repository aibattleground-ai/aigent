/**
 * AIGENT — Multi-Language, Multi-User Telegram Bot
 * Features: Command Menu, Reply Keyboard, /withdraw, /export_key
 * Supports: EN / KO / ES / ZH
 */
import { Telegraf } from 'telegraf';
import { parseIntent } from './llm.js';
import { executeMockTrade } from './executor.js';
import { startDashboard, killdDashboard, getActiveSessions } from './dashboard.js';
import { initDB, insertTrade, getTradesByChatId, generateSyncCode } from './db.js';
import { onboardUser, updateLanguage, getUserLang, getUserWallet, getUserPrivateKey } from './users.js';
import { t, LANGUAGES } from './i18n.js';

// ── In-memory state ────────────────────────────────────────────────────────────
const gridSessions = new Map();    // chatId → { asset, stats }
const exportConfirm = new Set();   // chatIds awaiting key export confirmation

// ── UI Keyboards ───────────────────────────────────────────────────────────────

/** Inline keyboard for language selection */
const LANG_KEYBOARD = {
    inline_keyboard: [[
        { text: '🇬🇧 English', callback_data: 'lang:en' },
        { text: '🇰🇷 한국어', callback_data: 'lang:ko' },
    ], [
        { text: '🇪🇸 Español', callback_data: 'lang:es' },
        { text: '🇨🇳 中文', callback_data: 'lang:zh' },
    ], [
        { text: '🇯🇵 日本語', callback_data: 'lang:ja' },
    ]],
};

/** Cyberpunk/AI GIF shown before the onboarding welcome message */
const ONBOARDING_GIF = 'https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif';

/**
 * Builds the persistent bottom Reply Keyboard in the user's language.
 * resize_keyboard=true → fits the screen size automatically.
 * one_time_keyboard=false → stays visible, user can hide/show via arrow.
 */
function replyKeyboard(l) {
    return {
        keyboard: [[
            { text: t(l, 'btn_dashboard') },
            { text: t(l, 'btn_withdraw') },
            { text: t(l, 'btn_settings') },
        ]],
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true,
    };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const lang = (chatId) => getUserLang(String(chatId));

async function requireWallet(ctx) {
    const chatId = String(ctx.chat.id);
    const l = lang(chatId);
    if (!getUserWallet(chatId)) {
        await ctx.reply(t(l, 'error_no_user'), {
            parse_mode: 'Markdown',
            reply_markup: LANG_KEYBOARD,
        });
        return false;
    }
    return true;
}

// ── Bot Registration ───────────────────────────────────────────────────────────

/** Registers the official Telegram command list (Menu button in chat input bar) */
async function registerCommands(bot) {
    await bot.telegram.setMyCommands([
        { command: 'start', description: '🚀 시작 및 다국어 설정 / Get started' },
        { command: 'dashboard', description: '📊 실시간 자산/포지션 터미널' },
        { command: 'withdraw', description: '💸 지갑 자금 출금 안내' },
        { command: 'export_key', description: '🔑 프라이빗 키 백업 (MetaMask)' },
        { command: 'wallet', description: '🏦 내 지갑 주소 확인' },
        { command: 'history', description: '📋 최근 거래 내역' },
        { command: 'cancelgrid', description: '🛑 그리드봇 중지' },
        { command: 'language', description: '🌐 언어 변경' },
        { command: 'help', description: '📖 봇 사용 가이드' },
    ]);
    console.log('[BOT] Telegram command menu registered.');
}

// ── Main Bot Start ─────────────────────────────────────────────────────────────
export function startBot() {
    initDB();
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // ── /start ────────────────────────────────────────────────────────────────
    bot.command('start', async (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        const wallet = getUserWallet(chatId);

        if (wallet) {
            // Already onboarded — show wallet + bottom keyboard
            return ctx.reply(
                t(l, 'wallet_header', { wallet }) + '\n\n📊 /dashboard   📖 /help   🌐 /language',
                { parse_mode: 'Markdown', reply_markup: replyKeyboard(l) }
            );
        }

        // First launch — language picker
        await ctx.reply(t('en', 'select_language'), {
            parse_mode: 'Markdown',
            reply_markup: LANG_KEYBOARD,
        });
    });

    // ── Language callback ─────────────────────────────────────────────────────
    bot.action(/^lang:(.+)$/, async (ctx) => {
        const chatId = String(ctx.chat.id);
        const selectedLang = ctx.match[1];
        if (!LANGUAGES[selectedLang]) return ctx.answerCbQuery('Invalid.');

        await ctx.answerCbQuery(`${LANGUAGES[selectedLang].flag} ${LANGUAGES[selectedLang].label}`);
        await ctx.editMessageReplyMarkup({});

        const genMsg = await ctx.reply(t(selectedLang, 'generating_wallet'), { parse_mode: 'Markdown' });

        try {
            const { walletAddress } = await onboardUser(chatId, selectedLang);
            updateLanguage(chatId, selectedLang);
            await ctx.telegram.deleteMessage(chatId, genMsg.message_id).catch(() => { });

            // Send cyberpunk AI GIF first for visual impact
            await ctx.telegram.sendAnimation(chatId, ONBOARDING_GIF).catch(() => { });

            // Welcome + show persistent bottom keyboard
            await ctx.reply(
                t(selectedLang, 'welcome', { wallet: walletAddress }),
                { parse_mode: 'Markdown', reply_markup: replyKeyboard(selectedLang) }
            );
        } catch (err) {
            console.error('[BOT] Onboarding error:', err);
            await ctx.telegram.deleteMessage(chatId, genMsg.message_id).catch(() => { });
            await ctx.reply(t(selectedLang, 'error_generic'), { parse_mode: 'Markdown' });
        }
    });

    // ── /language ─────────────────────────────────────────────────────────────
    bot.command('language', async (ctx) => {
        await ctx.reply(t(lang(ctx.chat.id), 'select_language'), {
            parse_mode: 'Markdown',
            reply_markup: LANG_KEYBOARD,
        });
    });

    // ── /dashboard ────────────────────────────────────────────────────────────
    const handleDashboard = async (ctx) => {
        const chatId = String(ctx.chat.id);
        if (!await requireWallet(ctx)) return;

        const args = (ctx.message?.text || '').split(/\s+/).slice(1);
        const requestedAsset = args[0]?.toUpperCase() || null;
        const gs = gridSessions.get(chatId);
        const asset = requestedAsset || gs?.stats?.asset || 'ETH';

        await ctx.reply(`_Initializing ${asset}/USDC terminal..._`, { parse_mode: 'Markdown' });

        await startDashboard(bot, chatId, {
            asset,
            gridCount: gs?.stats?.gridCount || 0,
            totalUsdc: gs?.stats?.totalUsdc || 0,
            lowerPrice: gs?.stats?.lowerPrice || 0,
            upperPrice: gs?.stats?.upperPrice || 0,
        });
    };
    bot.command('dashboard', handleDashboard);
    bot.hears(/^📊/, handleDashboard);                     // Korean: 📊 대시보드 / all langs

    // ── /withdraw ─────────────────────────────────────────────────────────────
    const handleWithdraw = async (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        if (!await requireWallet(ctx)) return;
        const wallet = getUserWallet(chatId);

        await ctx.reply(
            t(l, 'withdraw_title') + '\n\n' + t(l, 'withdraw_body', { wallet }),
            { parse_mode: 'Markdown', disable_web_page_preview: true }
        );
    };
    bot.command('withdraw', handleWithdraw);
    bot.hears(/^💸/, handleWithdraw);

    // ── /export_key ───────────────────────────────────────────────────────────
    const handleExportKey = async (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        if (!await requireWallet(ctx)) return;

        // Step 1: Warning + confirmation inline button
        exportConfirm.add(chatId);
        await ctx.reply(
            t(l, 'export_key_title') + '\n\n' + t(l, 'export_key_warning'),
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: t(l, 'export_key_confirm'), callback_data: 'confirm_export_key' },
                    ]],
                },
            }
        );
    };
    bot.command('export_key', handleExportKey);
    bot.hears(/^⚙️/, handleExportKey);

    // ── Export Key Callback ───────────────────────────────────────────────────
    bot.action('confirm_export_key', async (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup({});

        if (!exportConfirm.has(chatId)) {
            return ctx.reply(t(l, 'error_generic'), { parse_mode: 'Markdown' });
        }
        exportConfirm.delete(chatId);

        let pk;
        try {
            pk = getUserPrivateKey(chatId);
        } catch (err) {
            return ctx.reply(`❌ ${err.message}`, { parse_mode: 'Markdown' });
        }

        // Send the key — then auto-delete after 60 seconds
        const keyMsg = await ctx.reply(
            t(l, 'export_key_value', { pk }),
            { parse_mode: 'Markdown' }
        );

        setTimeout(async () => {
            try {
                await bot.telegram.deleteMessage(chatId, keyMsg.message_id);
            } catch { /* already deleted */ }
        }, 60_000);
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
        if (!trades.length) return ctx.reply('No trades found.');
        const lines = trades.slice(0, 10).map((t) => `[#${t.id}] ${t.action.toUpperCase()} $${t.amount} ${t.asset}`);
        ctx.reply(`*Recent Trades:*\n\`\`\`\n${lines.join('\n')}\n\`\`\``, { parse_mode: 'Markdown' });
    });

    // ── /connect ──────────────────────────────────────────────────────────────
    bot.command('connect', (ctx) => {
        const code = generateSyncCode(String(ctx.chat.id));
        ctx.reply(`*AIGENT Account Link*\n\nSync Code: \`${code}\`\n\n_(Valid for 1 hour)_`, { parse_mode: 'Markdown' });
    });

    // ── Main NL Text Handler ──────────────────────────────────────────────────
    bot.on('text', async (ctx) => {
        const userText = ctx.message.text;
        if (userText.startsWith('/')) return;

        // Skip keyboard button texts (handled by bot.hears above)
        if (/^[📊💸⚙️]/.test(userText)) return;

        const chatId = String(ctx.chat.id);
        const l = lang(chatId);

        if (!getUserWallet(chatId)) {
            return ctx.reply(t(l, 'error_no_user'), {
                parse_mode: 'Markdown',
                reply_markup: LANG_KEYBOARD,
            });
        }

        const thinkingMsg = await ctx.reply('_Analyzing intent..._', { parse_mode: 'Markdown' });

        try {
            const intent = await parseIntent(userText);

            if (intent.error) {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(t(l, 'parse_error', { error: intent.error }), { parse_mode: 'Markdown' });
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

                let userPk;
                try { userPk = getUserPrivateKey(chatId); } catch (e) {
                    return ctx.reply(`❌ ${e.message}`, { parse_mode: 'Markdown' });
                }

                const { runGridBot } = await import('./strategies/grid.js');
                const result = await runGridBot(intent, chatId, userPk);

                if (result.success) {
                    gridSessions.set(chatId, { asset: intent.asset, stats: result.stats });
                    await ctx.reply(result.summary, { parse_mode: 'Markdown' });
                    await ctx.reply(`_Launching ${intent.asset}/USDC terminal..._`, { parse_mode: 'Markdown' });
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

            // ── UNIVERSAL ORDER ───────────────────────────────────────────────
            if (strategy === 'order') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                await ctx.reply(
                    `*Intent:*\n\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\`\n` +
                    `_Executing ${intent.type || 'market'} order on Hyperliquid..._`,
                    { parse_mode: 'Markdown' }
                );

                let userPk;
                try { userPk = getUserPrivateKey(chatId); } catch (e) {
                    return ctx.reply(`❌ ${e.message}`, { parse_mode: 'Markdown' });
                }

                const { executeUniversalOrder } = await import('./strategies/order.js');
                const result = await executeUniversalOrder(intent, userPk);

                if (result.success) {
                    await ctx.reply(result.summary, { parse_mode: 'Markdown' });
                    await ctx.reply(`_Launching ${result.details.asset}/USDC terminal..._`, { parse_mode: 'Markdown' });
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
        if (n > 0) console.log(`[BOT] Active sessions: ${n}`);
    }, 300_000);

    // ── Launch & register commands ─────────────────────────────────────────────
    const launch = async (retries = 10) => {
        try {
            await bot.launch({ dropPendingUpdates: true });
            console.log('AIGENT multi-lang bot started.');
            await registerCommands(bot);
        } catch (err) {
            if (err.response?.error_code === 409 && retries > 0) {
                console.log(`Telegram 409 conflict — retrying in 10s... (${retries} left)`);
                await new Promise((r) => setTimeout(r, 10_000));
                return launch(retries - 1);
            }
            throw err;
        }
    };

    launch().catch((err) => { console.error('Bot failed:', err.message); process.exit(1); });
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
