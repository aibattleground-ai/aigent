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
import { startDepositMonitor } from './deposit.js';
import { depositToHyperliquid } from './hlbridge.js';
import { startPositionMonitor, stopPositionMonitor, hasActiveMonitor } from './monitor.js';

// ── In-memory state ────────────────────────────────────────────────────────────
const gridSessions = new Map();   // chatId → { asset, stats }
const exportConfirm = new Set();   // chatIds awaiting key export confirmation
const depositPending = new Map();   // chatId → { usdcBalance, promptMsgId }

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
        keyboard: [
            [
                { text: t(l, 'btn_dashboard') },
                { text: t(l, 'btn_withdraw') },
            ],
            [
                { text: t(l, 'btn_deposit') },
                { text: t(l, 'btn_settings') },
            ],
        ],
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
        { command: 'deposit', description: '📥 ARB USDC → Hyperliquid 취로 입금' },
        { command: 'withdraw', description: '💸 지갑 자금 출금 안내' },
        { command: 'export_key', description: '🔑 프라이빗 키 백업 (MetaMask)' },
        { command: 'wallet', description: '🏦 내 지갑 주소 확인' },
        { command: 'history', description: '📋 최근 거래 내역' },
        { command: 'close', description: '🏁 포지션 모니터 중지' },
        { command: 'cancelgrid', description: '🛑 그리드봇 중지' },
        { command: 'language', description: '🌐 언어 변경' },
        { command: 'help', description: '📖 봇 사용 가이드' },
    ]);
    console.log('[BOT] Telegram command menu registered.');
}

// ── Main Bot Start ─────────────────────────────────────────────────────────────
export async function startBot() {
    initDB();
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // ── /start ────────────────────────────────────────────────────────────────
    bot.command('start', async (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        const wallet = getUserWallet(chatId);

        if (wallet) {
            // Already onboarded — show GIF + full welcome message again
            await ctx.telegram.sendAnimation(chatId, ONBOARDING_GIF).catch(() => { });
            return ctx.reply(
                t(l, 'welcome', { wallet }),
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

        // Parse asset only if it looks like a real ticker (2–6 uppercase letters, e.g. ETH, BTC)
        // Ignore button labels like '대시보드', 'Dashboard', '📊 대시보드', etc.
        const rawText = ctx.message?.text || '';
        const args = rawText.split(/\s+/).slice(1);
        const candidateAsset = args[0]?.toUpperCase() || '';
        const isValidTicker = /^[A-Z]{2,6}$/.test(candidateAsset);

        const gs = gridSessions.get(chatId);
        // Priority: explicit valid ticker > active grid asset > default ETH
        const asset = isValidTicker ? candidateAsset : (gs?.stats?.asset || 'ETH');

        await ctx.reply(`_Initializing ${asset}/USDC terminal..._`, { parse_mode: 'Markdown' });

        await startDashboard(bot, chatId, {
            asset,
            gridCount: gs?.stats?.gridCount || 0,
            totalUsdc: gs?.stats?.totalUsdc || 0,
            lowerPrice: gs?.stats?.lowerPrice || 0,
            upperPrice: gs?.stats?.upperPrice || 0,
            walletAddress: getUserWallet(chatId),
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

    // ── /close — stop position monitor ───────────────────────────────────────────────────
    bot.command('close', (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        if (hasActiveMonitor(chatId)) {
            stopPositionMonitor(chatId);
            ctx.reply(
                l === 'ko'
                    ? '🏁 *포지션 모니터 중지*\n\n_라이브 더 업데이트 중지. 대시보드를 다시 열려면 하단 버튼을 눌러주세요._'
                    : '🏁 *Position Monitor Stopped*\n\n_Live updates paused. Press the dashboard button to resume._',
                { parse_mode: 'Markdown' }
            );
        } else {
            ctx.reply(
                l === 'ko'
                    ? 'ℹ️ 활성화된 포지션 모니터가 없습니다.'
                    : 'ℹ️ No active position monitor running.',
                { parse_mode: 'Markdown' }
            );
        }
    });

    // ── 📥 Deposit → Hyperliquid (Interactive Prompt) ─────────────────────────────

    /**
     * Step 1: Shows balance + 25/50/100%/Cancel inline keyboard.
     * Does NOT execute any transaction yet.
     */
    const handleDeposit = async (ctx) => {
        const chatId = String(ctx.chat.id);
        const l = lang(chatId);
        if (!await requireWallet(ctx)) return;

        const statusMsg = await ctx.reply(
            l === 'ko' ? '_ARB 지갑 잔고 확인 중..._' : '_Checking ARB wallet balance..._',
            { parse_mode: 'Markdown' }
        );

        // Fetch ARB USDC balance using the same axios eth_call function from dashboard.js
        let usdcBalance = 0;
        try {
            const { getArbUsdcBalance } = await import('./dashboard.js');
            const raw = await getArbUsdcBalance(getUserWallet(chatId));
            usdcBalance = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
        } catch { usdcBalance = 0; }

        await ctx.telegram.deleteMessage(chatId, statusMsg.message_id).catch(() => { });

        const balStr = `$${usdcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const promptText =
            `\ud83c\udfe6 *\uc0b4\uc804 \uc7a5\uc804 (Deposit)*\n\n` +
            `\ud83d\udcb5 \uad80\ud558\uc758 \uc544\ube44\ud2b8\ub7fc \uc9c0\uac11 \uc794\uace0: *${balStr} USDC*\n\n` +
            `\ud83d\udc47 \ud558\uc774\ud37c\ub9ac\ud034\ub4dc \uc5d4\uc9c4\uc73c\ub85c \uc1a1\uae08\ud560 \uae08\uc561\uc744 \uc120\ud0dd\ud558\uac70\ub098\n` +
            `\ucc44\ud305\ucc3d\uc5d0 *\uc22b\uc790*\ub97c \uc785\ub825\ud558\uc138\uc694. _(\uc608: 500)_`;

        const promptMsg = await ctx.reply(promptText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '25%', callback_data: 'deposit_pct:25' },
                    { text: '50%', callback_data: 'deposit_pct:50' },
                    { text: '100% (MAX)', callback_data: 'deposit_pct:100' },
                    { text: '\u274c \ucde8\uc18c', callback_data: 'deposit_cancel' },
                ]],
            },
        });

        // Store pending state so the text handler and callback handler can pick it up
        depositPending.set(chatId, { usdcBalance, promptMsgId: promptMsg.message_id });
    };
    bot.command('deposit', handleDeposit);
    bot.hears(/^\ud83d\udce5/, handleDeposit);

    // ── Deposit: % button callback ────────────────────────────────────────────
    bot.action(/^deposit_pct:(\d+)$/, async (ctx) => {
        const chatId = String(ctx.chat.id);
        const pending = depositPending.get(chatId);
        await ctx.answerCbQuery();
        if (!pending) return ctx.reply(lang(chatId) === 'ko' ? '\u274c \uc138\uc158\uc774 \ub9cc\ub8cc\ub410\uc2b5\ub2c8\ub2e4. \uc1a1\uae08 \ubc84\ud2bc\uc744 \ub2e4\uc2dc \ub208\ub7ec\uc8fc\uc138\uc694.' : '\u274c Session expired. Please press the deposit button again.');

        const pct = parseInt(ctx.match[1], 10);
        const amount = +(pending.usdcBalance * pct / 100).toFixed(6);
        depositPending.delete(chatId);

        // Remove inline keyboard from prompt
        await ctx.telegram.editMessageReplyMarkup(chatId, pending.promptMsgId, null, { inline_keyboard: [] }).catch(() => { });

        await runDepositFlow(ctx, chatId, amount);
    });

    // ── Deposit: cancel button ────────────────────────────────────────────────
    bot.action('deposit_cancel', async (ctx) => {
        const chatId = String(ctx.chat.id);
        depositPending.delete(chatId);
        await ctx.answerCbQuery();
        await ctx.telegram.editMessageReplyMarkup(chatId, ctx.callbackQuery.message.message_id, null, { inline_keyboard: [] }).catch(() => { });
        await ctx.reply(lang(chatId) === 'ko' ? '\ud83d\uded1 \uc1a1\uae08\uc774 \ucde8\uc18c\ub418\uc5c8\uc2b5\ub2c8\ub2e4.' : '\ud83d\uded1 Deposit cancelled.');
    });

    /**
     * Step 2: Executes the actual deposit transaction.
     * Called from both the % buttons and text input path.
     */
    const runDepositFlow = async (ctx, chatId, amountUsdc) => {
        const l = lang(chatId);

        if (amountUsdc < 1) {
            return ctx.reply('\u274c \ucd5c\uc18c \uc1a1\uae08\uc561\uc740 $1 USDC\uc785\ub2c8\ub2e4.', { parse_mode: 'Markdown' });
        }

        const loadingMsg = await ctx.reply(
            t(l, 'deposit_loading') + `\n\n_\ud1a0\ud0c8 \uae08\uc561: *$${amountUsdc.toFixed(2)} USDC*_`,
            { parse_mode: 'Markdown', disable_web_page_preview: true }
        );

        const editProgress = async (text) => {
            try {
                await ctx.telegram.editMessageText(
                    chatId, loadingMsg.message_id, null,
                    t(l, 'deposit_loading') + `\n\n_\ud1a0\ud0c8: $${amountUsdc.toFixed(2)} USDC_\n\u23f1\ufe0f _${text}_`,
                    { parse_mode: 'Markdown', disable_web_page_preview: true }
                );
            } catch { /* unchanged — ignore */ }
        };

        try {
            const privateKey = getUserPrivateKey(chatId);
            const result = await depositToHyperliquid(privateKey, { amountUsdc, onProgress: editProgress });

            if (result.success) {
                await ctx.telegram.editMessageText(
                    chatId, loadingMsg.message_id, null,
                    t(l, 'deposit_success', { amount: result.depositedUsdc, txHash: result.depositTxHash }),
                    { parse_mode: 'Markdown', disable_web_page_preview: true }
                );
                setTimeout(() => handleDashboard(ctx), 3_000);
            } else {
                await ctx.telegram.editMessageText(
                    chatId, loadingMsg.message_id, null,
                    t(l, 'deposit_error', { error: result.error }),
                    { parse_mode: 'Markdown' }
                );
            }
        } catch (err) {
            console.error('[DEPOSIT] runDepositFlow error:', err.message);
            await ctx.telegram.editMessageText(
                chatId, loadingMsg.message_id, null,
                t(l, 'deposit_error', { error: err.message }),
                { parse_mode: 'Markdown' }
            ).catch(() => { });
        }
    };

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
        const userText = ctx.message.text.trim();
        if (userText.startsWith('/')) return;

        // ── Absolute button-text firewall ───────────────────────────────────────
        // Covers all 5 languages. ANY message containing these substrings is
        // routed immediately and NEVER reaches Claude NLP.
        const DASHBOARD_KEYWORDS = ['대시보드', 'Dashboard', 'Panel en Vivo', '실시간', 'ダッシュボード', '终端', '📊'];
        const WITHDRAW_KEYWORDS = ['출금', 'Withdraw', 'Retirar', '提款', '出金', '💸'];
        const SETTINGS_KEYWORDS = ['세팅', 'Settings', 'Config', '设置', '設定', '⚙'];

        if (DASHBOARD_KEYWORDS.some(k => userText.includes(k))) return handleDashboard(ctx);
        if (WITHDRAW_KEYWORDS.some(k => userText.includes(k))) return handleWithdraw(ctx);
        if (SETTINGS_KEYWORDS.some(k => userText.includes(k))) return handleExportKey(ctx);
        const DEPOSIT_KEYWORDS = ['거래소로 송금', 'Fund Exchange', 'Enviar al Exchange', '转入交易所', '取引所へ入金', '📥'];
        if (DEPOSIT_KEYWORDS.some(k => userText.includes(k))) return handleDeposit(ctx);

        // ── Deposit: custom amount text input ──────────────────────────────────
        // If the user has an active deposit prompt and types a number, use it as the amount.
        const chatIdEarly = String(ctx.chat.id);
        if (depositPending.has(chatIdEarly)) {
            const numVal = parseFloat(userText.replace(/,/g, '').trim());
            if (!isNaN(numVal) && numVal > 0) {
                const pending = depositPending.get(chatIdEarly);
                depositPending.delete(chatIdEarly);
                // Remove inline keyboard from original prompt
                await ctx.telegram.editMessageReplyMarkup(chatIdEarly, pending.promptMsgId, null, { inline_keyboard: [] }).catch(() => { });
                return runDepositFlow(ctx, chatIdEarly, numVal);
            }
        }

        const chatId = chatIdEarly;
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
                    // 🟥 Auto-start live position monitor
                    const wallet = getUserWallet(chatId);
                    if (wallet) {
                        startPositionMonitor(bot, chatId, wallet, result.details.asset, lang(chatId))
                            .catch(e => console.error('[MONITOR] start error:', e.message));
                    }
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
            // Start 24/7 deposit monitor (silently skips if ARB_RPC_URL not set)
            startDepositMonitor(bot).catch((e) => console.error('[DEPOSIT] Start error:', e.message));
        } catch (err) {
            if (err.response?.error_code === 409 && retries > 0) {
                console.log(`Telegram 409 conflict — retrying in 10s... (${retries} left)`);
                await new Promise((r) => setTimeout(r, 10_000));
                return launch(retries - 1);
            }
            throw err;
        }
    };

    await launch();
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    // Telegraf v4 bot.launch() resolves immediately once polling is registered.
    // Without this, startBot() returns, index.js finishes, and Node.js exits.
    // This never-resolving Promise keeps the event loop alive until SIGINT/SIGTERM.
    await new Promise(() => { });
}
