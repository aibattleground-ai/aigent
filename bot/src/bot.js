/**
 * AIGENT — Multi-Language, Multi-User Telegram Bot
 * Features: Command Menu, Reply Keyboard, /withdraw, /export_key
 * Supports: EN / KO / ES / ZH
 */
import { Telegraf } from 'telegraf';
import { parseIntent } from './llm.js';
import { executeMockTrade } from './executor.js';
import { startDashboard, killdDashboard, getActiveSessions } from './dashboard.js';
import {
    initDB, insertTrade, getTradesByChatId, generateSyncCode, getAllUsers,
    ensureReferralCode, applyReferralCode, getReferralStats
} from './db.js';
import { onboardUser, updateLanguage, getUserLang, getUserWallet, getUserPrivateKey } from './users.js';
import { t, LANGUAGES } from './i18n.js';
import { startDepositMonitor } from './deposit.js';
import { depositToHyperliquid } from './hlbridge.js';
import { startPositionMonitor, stopPositionMonitor, hasActiveMonitor } from './monitor.js';
import { startScalping, stopScalping, isScalping, loadSession } from './strategies/scalping.js';
import { startCopyTrading, stopCopyTrading, getCopySession } from './copytrading.js';

// ── In-memory state ────────────────────────────────────────────────────────────
const gridSessions = new Map();   // chatId → { asset, stats }
const exportConfirm = new Set();   // chatIds awaiting key export confirmation
const depositPending = new Map();   // chatId → { usdcBalance, promptMsgId }
const traderCache = new Map();   // addrSuffix → trader object (for ct: callback)

// ── Global constants ───────────────────────────────────────────────────────────
const MIN_DEPOSIT_USDC = 5;         // Hyperliquid minimum deposit (USDC)

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

/** Cyberpunk money-machine GIF shown on /start */
const ONBOARDING_GIF = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzZtcjY3MGpqaGx2ZXZtNTBqYXUxd2dtMzI2bzlwYm84OWFicjZ2biZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/077i6AULCXc0FKTj9s/giphy.gif';

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
        const wallet = getUserWallet(chatId);

        // Handle referral code passed as /start <code> (Telegram deep-link)
        const payload = ctx.message?.text?.split(' ')[1];
        if (payload && payload.length === 6) {
            const result = applyReferralCode(chatId, payload);
            if (result === 'ok') {
                await ctx.reply('🎁 레퍼럴 코드 적용 완료! 초대한 친구의 실적에 감사드립니다 🙏', { parse_mode: 'Markdown' });
            }
        }
        if (!wallet) {
            // First launch — language picker first, then onboarding
            return ctx.reply(t('en', 'select_language'), {
                parse_mode: 'Markdown',
                reply_markup: LANG_KEYBOARD,
            });
        }

        // Already onboarded — show AI-powered main menu
        await ctx.telegram.sendAnimation(chatId, ONBOARDING_GIF).catch(() => { });
        return ctx.reply(
            `\uD83E\uDD16 *[ AIGENT : \uC778\uAC04\uC758 \uD55C\uACC4\uB97C \uCD08\uC6D4\uD55C AI \uB3C8 \uBCF5\uC0AC\uAE30 ]*\n\n` +
            `\uC5B4\uC124\uD504\uAC8C \uCC28\uD2B8\uC5D0 \uC904 \uAE3B\uC9C0 \uB9D0\uACE0 \uC774\uC81C \uC9C4\uC9DC AI\uD55C\uD14C \uB9E1\uACA8\uB77C.\n` +
            `\uD478 \uC3FC - 24\uC2DC\uAC04 \uD53C\uB3C4 \uB208\uBB3C\uB3C4 \uC5C6\uC774 \uC2DC\uC7A5 \uB3C8 \uB0C4\uC0C8 \uB9A1\uC73C\uBA74\uC11C\n` +
            `\uB124 \uC9C0\uAC11\uC5D0 \uB2EC\uB7EC\uB97C \uAF3D\uC544 \uB123\uB294\uB2E4.\n\n` +
            `_\uC7A0\uC740 \uB124\uAC00 \uC790\uB77C. \uB3C8\uC740 AI\uAC00 \uBCA8\uC5B4\uC62C \uD14C\uB2C8\uAE4C._\n\n` +
            `\uC2E4\uC804\uC5D0\uC11C \uB099\uC911\uC744 \uADF8\uB9AC\uB294 '\uC778\uAC04 \uC9C0\uD45C'\uB97C \uCC3E\uC544 100% \uB3D9\uC77C\uD558\uAC8C \uBBF8\uB7EC\uB9C1\uD569\uB2C8\uB2E4.\n\n` +
            `\uD83D\uDC47 *[ \uC5B4\uB5BB\uAC8C \uBD80\uB824\uBA39\uC744\uC9C0 \uC120\uD0DD\uD558\uC138\uC694 ]* \uD83D\uDC47`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '\uD83D\uDCB8 AI \uD0C0\uC810 \uC2A4\uB098\uC774\uD551', callback_data: 'menu_copy_trade' },
                        { text: '\u2699\uFE0F \uCC57GPT\uAE09 \uCEE4\uC2A4\uD140 \uC138\uD305', callback_data: 'menu_custom_bot' },
                    ]],
                },
            }
        );
    });

    // ── Main Menu: Copy Trade ─────────────────────────────────────────────────
    bot.action('menu_copy_trade', async (ctx) => {
        await ctx.answerCbQuery();
        const menuText =
            `🔥 *[ 당신의 야수성을 선택하세요 ]* 🔥\n` +
            `감당할 수 있는 뚝배기(리스크)와 레버리지를 고르세요.\n\n` +
            `🥣 *Lv.1 [ 푹 고운 능이백숙형 ]*\n` +
            `수면매매 쌉가능, 원금 보존 1순위\n` +
            `리스크: 🟢 최하 | 레버리지: 1\~2x\n\n` +
            `🍲 *Lv.2 [ 든든한 뚝배기 국밥형 ]*\n` +
            `은행 적금 찢어버리는 낭낭한 복리 우상향\n` +
            `리스크: 🟡 하 | 레버리지: 3\~5x\n\n` +
            `👀 *Lv.3 [ 눈치백단 간잽이형 ]*\n` +
            `오를 놈만 얄밉게 골라 타는 트렌드 박쥐 매매\n` +
            `리스크: 🟠 중 | 레버리지: 10x\n\n` +
            `🏢 *Lv.4 [ 강남 건물주 되고싶은형 ]*\n` +
            `시드 100만 불 이상 찐 고래들 스마트머니 탑승\n` +
            `리스크: 🔴 상 | 레버리지: 20x\n\n` +
            `🌋 *Lv.5 [ 잃을 게 없는 상남자형 ]*\n` +
            `모 아니면 도\! 묻고 더블로 가\! 낭만의 풀악셀\n` +
            `리스크: 💀 극상 | 레버리지: 50x 이상`;

        await ctx.editMessageText(menuText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🥣 Lv.1 능이백숙 선택', callback_data: 'copy_lv1' }],
                    [{ text: '🍲 Lv.2 뚝배기국밥 선택', callback_data: 'copy_lv2' }],
                    [{ text: '👀 Lv.3 눈치간잽이 선택', callback_data: 'copy_lv3' }],
                    [{ text: '🏢 Lv.4 강남건물주 선택', callback_data: 'copy_lv4' }],
                    [{ text: '🌋 Lv.5 상남자가즈아 선택', callback_data: 'copy_lv5' }],
                    [{ text: '◀️ 뒤로', callback_data: 'menu_back_main' }],
                ],
            },
        }).catch(() => { });
    });

    // ── Main Menu: Custom Bot ─────────────────────────────────────────────────
    bot.action('menu_custom_bot', async (ctx) => {
        await ctx.answerCbQuery();
        const l = lang(String(ctx.chat.id));
        await ctx.editMessageText(
            `⚙️ *커스텀 봇 세팅*\n\n` +
            `채팅창에 매매 명령을 직접 입력하세요.\n\n` +
            `*예시:*\n` +
            `\`DOGE 10x 롱 $5 넣어\`\n` +
            `\`ETH 3x 숏 $10 진입\`\n` +
            `\`5x 그리드봇 SOL 범위 100~150 $20\`\n\n` +
            `AI가 의도를 파악해 자동으로 주문을 실행합니다. 🤖`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '◀️ 뒤로', callback_data: 'menu_back_main' }],
                    ],
                },
            }
        ).catch(() => { });
    });

    // ── Back to main ─────────────────────────────────────────────────────────
    bot.action('menu_back_main', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `\uD83E\uDD16 *[ AIGENT : 24\uC2DC\uAC04 \uBB34\uAC10\uC815 AI \uB69D\uBC30\uAE30 \uBCF4\uD638\uC18C ]*\n\n` +
            `\uAE8C\uC774\uC57C, \uC544\uC9C1\uB3C4 \uBC24\uC0C8\uC6B0\uBA74\uC11C \uC88F\uB3C4 \uBAA8\uB974\uB294 \uCC28\uD2B8\uC5D0 \uC904 \uAE3B\uACE0 \uC788\uB0D4?\n` +
            `_\uC7A0\uC740 \uB124\uAC00 \uC790\uB77C. \uB3C8\uC740 AI\uAC00 \uBCA8\uC5B4\uC62C \uD14C\uB2C8\uAE4C._\n\n` +
            `\uD83D\uDC47 *[ \uC778\uC0DD \uC5ED\uC804 \uBC84\uD2BC ]* \uD83D\uDC47`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '\uD83D\uDCB8 \uACE0\uC218 \uD0C0\uC810 \uC2A4\uB098\uC774\uD551', callback_data: 'menu_copy_trade' },
                        { text: '\u2699\uFE0F \uB0B4 \uAE38 \uAC04\uB2E4(\uCEE4\uC2A4\uD140)', callback_data: 'menu_custom_bot' },
                    ]],
                },
            }
        ).catch(() => { });
    });

    // ── Leaderboard fetcher ───────────────────────────────────────────────────
    // ── Leaderboard cache (refreshed every 5 min to avoid repeated API hits) ──
    let _leaderboardCache = null;   // { levels: Map<1-5, trader[]>, ts: number }
    const CACHE_TTL_MS = 5 * 60 * 1000;

    /**
     * PHASE 1 — Fetch + Filter real traders (Vault/MM 배제)
     *   ✅ Keep:  30D volume > $1,000,000
     *   ✅ Keep:  7-day 내 거래 활동 존재 (week vlm > 0)
     *   ❌ Drop:  나머지 (Vault, MM, 비활성 계정, 주소 없는 행)
     */
    async function fetchFilteredTraders() {
        console.log('[LB] Fetching Hyperliquid leaderboard for filter-based leveling...');
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 10_000);

        const res = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'leaderboard' }),
            signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Leaderboard API ${res.status}`);
        const data = await res.json();
        const rows = data?.leaderboardRows ?? [];
        console.log(`[LB] Total rows from API: ${rows.length}`);

        const getW = (r, win) => r.windowedStats?.find(w => w.window === win) ?? {};

        const MIN_MONTHLY_VLM = 1_000_000;  // $1M 30D volume
        const MIN_WEEKLY_VLM = 0;           // any activity in 7 days

        const filtered = rows.filter(r => {
            if (!r.ethAddress) return false;                          // 주소 없음 → 제거
            const month = getW(r, 'month');
            const week = getW(r, 'week');
            const monthVlm = parseFloat(month.vlm ?? '0');
            const weekVlm = parseFloat(week.vlm ?? '0');
            const weekPnl = parseFloat(week.pnl ?? '0');
            const hasMonthlyVlm = monthVlm > MIN_MONTHLY_VLM;    // 30D vol > $1M
            const hasWeeklyActivity = weekVlm > MIN_WEEKLY_VLM || weekPnl !== 0; // 7일 내 활동
            return hasMonthlyVlm && hasWeeklyActivity;
        });

        console.log(`[LB] After filter (vol>$1M + 7d active): ${filtered.length} real traders`);
        return { filtered, getW };
    }

    /**
     * PHASE 2 — Classify filtered traders into 5 risk levels
     *
     * Proxy metric: allTime ROI (소수점 기준, e.g. 1.0 = 100%)
     * 높은 ROI = 고레버리지 경향, 낮은 ROI = 저레버리지 경향
     *
     *   Lv1 (능이백숙): roi < 0.8       → BTC/ETH 위주 저레버 안정 수익
     *   Lv2 (뚝배기국밥): 0.8 ≤ roi < 2.0  → 복리 우상향 중저레버
     *   Lv3 (눈치간잽이): 2.0 ≤ roi < 6.0  → 혼합 레버 트렌드 매매사
     *   Lv4 (강남건물주): 6.0 ≤ roi < 15.0 → 스마트머니 고레버 고래
     *   Lv5 (상남자): roi ≥ 15.0       → 풀악셀 알트 극고레버
     *
     * Within each level → sort by 30D PnL descending (가장 많이 번 놈이 1위)
     */
    function classifyIntoLevels(filtered, getW) {
        const ROI_THRESHOLDS = [
            { level: 1, min: -Infinity, max: 0.8 },
            { level: 2, min: 0.8, max: 2.0 },
            { level: 3, min: 2.0, max: 6.0 },
            { level: 4, min: 6.0, max: 15.0 },
            { level: 5, min: 15.0, max: Infinity },
        ];

        const AI_BY_LEVEL = {
            1: ['블을 그으면서 MDD 관리하는 기계 고수. 원금 보존의 신입니다.', '리스크 제로급 등반 비할법의 무디스코 대공.', '슬라가불하고 공격적. 수비 공겹 차트 바이블 입니다.'],
            2: ['은행 적금 배리고 복리 후려치는 나의 문화.', '우상향 기기에 탈럼 없이 붙는 정배급 트레이더.', '걔 철학입니다. 올려 가면 가는 것.'],
            3: ['전형적인 간잽이. 하이퍼리퀴드 생태계 야금야금 복리로 불리는 귀신.', '트렌드 바뀌면 가장 먼저 후빠지는 바닥 확인자.', '오를 놈만 얄밉게 골라 타는 바수 매매사.'],
            4: ['시드 큰 고래들이 무비게 움직이는 방향을 파악하는 능력.', '스마트머니 흐름 연구생. 언제나 큰 매가 타기.', '별동 하지 않고 고래들 방향만 보는 고요한 스나이퍼.'],
            5: ['이 형은 빔 쓸 때 냄새 하나는 기막히게 맡음. 무지성 탑승 추천.', '풀악셀 낭만파. 잃을 것 없는 자만 이 문을 열.', '50배 레버리지로 시장 스캔하는 상남자 스타일.'],
        };

        const levels = new Map();
        for (let l = 1; l <= 5; l++) levels.set(l, []);

        for (const r of filtered) {
            const at = getW(r, 'allTime');
            const month = getW(r, 'month');
            const roi = parseFloat(at.roi ?? '0');
            const monthPnl = parseFloat(month.pnl ?? '0');
            const atPnl = parseFloat(at.pnl ?? '0');
            const atVlm = parseFloat(at.vlm ?? '0');
            const atRoi = parseFloat(at.roi ?? '0');

            const bucket = ROI_THRESHOLDS.find(t => roi >= t.min && roi < t.max);
            if (!bucket) continue;

            levels.get(bucket.level).push({
                _raw: r,
                _monthPnl: monthPnl,   // sort key
                addr: r.ethAddress,
                isReal: true,
                name: r.ethAddress.slice(0, 6) + '...' + r.ethAddress.slice(-4),
                pnl: (atPnl >= 0 ? '+' : '') + '$' + Math.abs(atPnl).toLocaleString('en-US', { maximumFractionDigits: 0 }),
                roe: (atRoi >= 0 ? '+' : '') + (atRoi * 100).toFixed(1),
                winRate: '—',
                mainCoin: atVlm > 10e6 ? 'BTC' : atVlm > 2e6 ? 'ETH' : 'ALT',
            });
        }

        // Sort each level by 30D PnL desc → take top 5
        for (const [lv, traders] of levels.entries()) {
            traders.sort((a, b) => b._monthPnl - a._monthPnl);
            const lvLines = AI_BY_LEVEL[lv];
            traders.forEach((t, i) => { t.comment = lvLines[i % lvLines.length]; });
            levels.set(lv, traders.slice(0, 5));
        }

        // Log summary per level
        for (const [lv, traders] of levels.entries()) {
            console.log(`[LB] Level ${lv}: ${traders.length} traders after classify`);
        }

        return levels;
    }

    /**
     * Returns top-5 traders for the requested level.
     * Uses 5-min in-memory cache to avoid hammering the API on every button press.
     */
    async function fetchLeaderboardForLevel(level) {
        // Character chart bar generator
        function makeChart(roe) {
            const r = parseFloat(roe);
            if (r > 100) return '[ ━━━📈━📊━📉━━ ] (폭발)';
            if (r > 30) return '[ ━━📈━━📊━━━ ] (우상향)';
            if (r > 0) return '[ ━━━📊━📈━━━ ] (안정적)';
            if (r > -20) return '[ ━📉━━📊━━📈━ ] (회복세)';
            return '[ ━📉━━📉━━📉━ ] (하락)';
        }

        // Fallback MOCK data (shown when API is unreachable or no traders in bucket)
        const MOCK = [
            { addr: null, isReal: false, name: 'GhostSniper', pnl: '+$38,210', roe: '+142', winRate: '72%', mainCoin: 'DOGE', comment: '이 형은 빔 쓸 때 냄새 하나는 기막히게 맡음. 무지성 탑승 추천.' },
            { addr: null, isReal: false, name: 'SilentWhale', pnl: '+$21,540', roe: '+89', winRate: '68%', mainCoin: 'ETH', comment: '전형적인 간잽이. 하이퍼리퀴드 생태계 야금야금 복리로 불리는 귀신.' },
            { addr: null, isReal: false, name: 'MoonOrDust', pnl: '+$14,080', roe: '+61', winRate: '59%', mainCoin: 'SOL', comment: '눈치 빠르기로 유명한 박쥐 매매사. 취슬하는 스타일.' },
            { addr: null, isReal: false, name: 'DeltaForce', pnl: '+$9,870', roe: '+44', winRate: '63%', mainCoin: 'BTC', comment: '불맰듯 캺다가 캺다가 정수리 하는 스나이퍼형.' },
            { addr: null, isReal: false, name: 'ChronoTrader', pnl: '+$7,320', roe: '+38', winRate: '61%', mainCoin: 'ARB', comment: '시간대 회전 무기 특급 타점 잘 잡는 조용한 스나이퍼.' },
        ];

        try {
            // ── Use cached result if still fresh ────────────────────────────
            const now = Date.now();
            if (_leaderboardCache && (now - _leaderboardCache.ts) < CACHE_TTL_MS) {
                console.log(`[LB] Cache hit (age ${Math.round((now - _leaderboardCache.ts) / 1000)}s) for level ${level}`);
                const traders = _leaderboardCache.levels.get(level) ?? [];
                if (traders.length > 0) return { traders, fromApi: true, makeChart };
                return { traders: MOCK, fromApi: false, makeChart };
            }

            // ── Fresh fetch + filter + classify ─────────────────────────────
            const { filtered, getW } = await fetchFilteredTraders();
            if (filtered.length === 0) return { traders: MOCK, fromApi: false, makeChart };

            const levels = classifyIntoLevels(filtered, getW);

            // Store cache
            _leaderboardCache = { levels, ts: Date.now() };

            const traders = levels.get(level) ?? [];
            if (traders.length === 0) {
                // Bucket empty (e.g. no extreme ROI traders right now) → adjacent bucket fallback
                console.warn(`[LB] Level ${level} bucket empty — trying adjacent levels`);
                for (let offset = 1; offset <= 4; offset++) {
                    const fallback = levels.get(level + offset) ?? levels.get(level - offset) ?? [];
                    if (fallback.length > 0) {
                        console.log(`[LB] Fallback level ${level + offset} has ${fallback.length} traders`);
                        return { traders: fallback.slice(0, 5), fromApi: true, makeChart };
                    }
                }
                return { traders: MOCK, fromApi: false, makeChart };
            }

            return { traders, fromApi: true, makeChart };

        } catch (err) {
            console.error('[LB] fetchLeaderboardForLevel error:', err.message);
            return { traders: MOCK, fromApi: false, makeChart };
        }
    }

    // ── Copy Trade Level Callbacks (Leaderboard API) ──────────────────────────
    const COPY_META = {
        copy_lv1: { emoji: '\uD83E\uDD63', name: '\uB2A5\uC774\uBC31\uC219\uD615', leverage: '1~2x', risk: '\uD83D\uDFE2 \uCD5C\uD558', level: 1 },
        copy_lv2: { emoji: '\uD83C\uDF72', name: '\uB69D\uBC30\uAE30\uAD6D\uBC25\uD615', leverage: '3~5x', risk: '\uD83D\uDFE1 \uD558', level: 2 },
        copy_lv3: { emoji: '\uD83D\uDC40', name: '\uB208\uCE58\uAC04\uC7BD\uC774\uD615', leverage: '10x', risk: '\uD83D\uDFE0 \uC911', level: 3 },
        copy_lv4: { emoji: '\uD83C\uDFE2', name: '\uAC15\uB0A8\uAC74\uBB3C\uC8FC\uD615', leverage: '20x', risk: '\uD83D\uDD34 \uC0C1', level: 4 },
        copy_lv5: { emoji: '\uD83C\uDF0B', name: '\uC0C1\uB0A8\uC790\uD615', leverage: '50x+', risk: '\uD83D\uDC80 \uADF9\uC0C1', level: 5 },
    };

    for (const [cbData, m] of Object.entries(COPY_META)) {
        bot.action(cbData, async (ctx) => {
            await ctx.answerCbQuery(`${m.emoji} ${m.name} \uC120\uD0DD!`);

            // Show loading state
            await ctx.editMessageText(
                `${m.emoji} *${m.name}* \uC120\uD0DD \uC644\uB8CC!\n` +
                `\uB808\uBC84\uB9AC\uC9C0: *${m.leverage}* | \uB9AC\uC2A4\uD06C: ${m.risk}\n\n` +
                `\uD83D\uDD04 _AI\uAC00 \uD558\uC774\uD37C\uB9AC\uD034\uB4DC \uB9AC\uB354\uBCF4\uB4DC TOP 5 \uC2A4\uCE94 \uC911..._`,
                { parse_mode: 'Markdown' }
            ).catch(() => { });

            const { traders, fromApi, makeChart } = await fetchLeaderboardForLevel(m.level);
            const RANK = ['\uD83C\uDFC6', '\uD83E\uDD48', '\uD83E\uDD49', '4\uC704', '5\uC704'];
            const sourceTag = fromApi
                ? '_\(Hyperliquid \uB9AC\uB354\uBCF4\uB4DC \uC2E4\uC2DC\uAC04\)_'
                : '_\(\uC0D8\uD50C \uB370\uC774\uD130 \u2014 API \uC5F0\uB3D9 \uC900\uBE44 \uC911\)_';

            const lines = traders.map((tr, i) =>
                `${RANK[i]} *Rank ${i + 1}: ${tr.name}*\n` +
                `   \uD83D\uDCC8 Trend: \`${makeChart(tr.roe)}\`\n` +
                `   \uD83D\uDCB0 PnL: \`${tr.pnl}\` | \uD83D\uDE80 ROE: \`${tr.roe}%\`\n` +
                `   \uD83C\uDFAF Win Rate: ${tr.winRate} | \uD83D\uDC8E Main: ${tr.mainCoin}\n` +
                `   \uD83E\uDD16 AI: _${tr.comment}_`
            ).join('\n\n');

            const text =
                `${m.emoji} *${m.name}* \u2014 TOP 5 \uD2B8\uB808\uC774\uB354\n` +
                `\uB808\uBC84\uB9AC\uC9C0: *${m.leverage}* | \uB9AC\uC2A4\uD06C: ${m.risk}\n` +
                sourceTag + `\n\n` + lines;

            // Cache for ct: callback
            traders.forEach(tr => traderCache.set(tr.addr.slice(-8), { ...tr, levelMeta: m }));

            const copyBtns = traders.map((tr, i) => ([
                { text: `\uD83C\uDFAF ${i + 1}\uC704 ${tr.name} \uCE74\uD53C`, callback_data: `ct:${tr.addr.slice(-8)}` },
            ]));

            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        ...copyBtns,
                        [
                            { text: '\uD83D\uDD04 \uC0C8\uB85C\uACE0\uCE68', callback_data: cbData },
                            { text: '\uD83C\uDFE0 \uBA54\uC778\uC73C\uB85C', callback_data: 'menu_back_main' },
                        ],
                        [{ text: '\u25C0\uFE0F \uB808\uBCA8 \uB2E4\uC2DC \uACE0\uB974\uAE30', callback_data: 'menu_copy_trade' }],
                    ],
                },
            }).catch(() => { });
        });
    }

    // ── Copy Trader: AI analysis confirmation screen ────────────────────────
    bot.action(/^ct:(.+)$/, async (ctx) => {
        const suffix = ctx.match[1];
        await ctx.answerCbQuery('\uD83E\uDD16 AI \uBD84\uC11D \uC911...');

        const tr = traderCache.get(suffix);
        if (!tr) {
            // Cache miss (bot restarted) — ask user to re-select level
            return ctx.editMessageText(
                '\u26A0\uFE0F \uC138\uC158\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.\n\uB808\uBCA8\uC744 \uB2E4\uC2DC \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.',
                {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '\uD83D\uDD04 \uB2E4\uC2DC \uC120\uD0DD', callback_data: 'menu_copy_trade' }]] },
                }
            ).catch(() => { });
        }

        const lm = tr.levelMeta;
        const CURATION = [
            `\uAE00\uB85C\uBC8C \uD0D1\uC2B9 \uD3EC\uC778\uD2B8 \uD3EC\uCC29 \uC18D\uB3C4 \uC5F4\uBC88 \uC911 \uC77C\uACF1 \uBC88\uC740 \uC815\uD655\uD568. \uB9C8\uCE58 \uCC28\uD2B8\uB97C \uBCF4\uB294 \uAC8C \uC544\uB2C8\uB77C \uB3C8 \uB0C4\uC0C8\uB97C \uB9A1\uB294 \uC720\uD615.`,
            `\uBE14\uB9AC\uB4DC \uC798 \uC694\uC6B4 \uD0C0\uC774\uBC0D\uACFC \uAD70\uBD80\uB300 \uAE09 \uD3EC\uC9C0\uC158 \uAD00\uB9AC\uB85C \uBBF8\uB2C8 \uCD08\uB85C\uB97C \uACA9\uD30C\uD558\uB294 \uD615\uC2DD.`,
            `\uC5B4\uB54C\uB3C8 \uC870\uC6A9\uD558\uACE0 \uD2B8\uB80C\uB4DC \uBC14\uB00C\uBA74 \uAC00\uC7A5 \uBA3C\uC800 \uBC14\uB2E5\uC744 \uCD94\uB294 \uACE0\uC694\uD55C \uACE0\uB798 \uC2A4\uD0C0\uC77C.`,
        ];
        const curation = CURATION[Math.floor(Math.random() * CURATION.length)];

        const text =
            `\uD83D\uDFE1 *AI \uD2B8\uB808\uC774\uB354 \uBD84\uC11D \uBCF4\uACE0\uC11C*\n\n` +
            `\uD2B8\uB808\uC774\uB354: *${tr.name}*\n` +
            `\uC8FC\uC885\uBAA9: ${tr.mainCoin} | \uC2B9\uB960: ${tr.winRate}\n` +
            `PnL: \`${tr.pnl}\` | ROE: \`${tr.roe}\`\n\n` +
            `\uD83E\uDD16 *AI \uBD84\uC11D:*\n_${tr.comment}_\n\n` +
            `\uD83D\uDCC8 *\uD22C\uC790 \uD050\uB808\uC774\uC158:*\n_${curation}_\n\n` +
            `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n` +
            `\uB808\uBC84\uB9AC\uC9C0: *${lm.leverage}* | \uB9AC\uC2A4\uD06C: ${lm.risk}\n\n` +
            `_\uD574\uB2F9 \uD2B8\uB808\uC774\uB354\uC758 \uBBF8\uCCB4\uACB0 \uD3EC\uC9C0\uC158\uC744 \uB3D9\uC77C \uBE44\uC728\uB85C \uBBF8\uB7EC\uB9C1\uD55C\uB2E4_`;

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '\uD83D\uDE80 \uCE74\uD53C \uC2DC\uC791 (\u767C\u5C04)', callback_data: `ct_start:${suffix}` }],
                    [{ text: '\u25C0\uFE0F \uB2E4\uB978 \uD2B8\uB808\uC774\uB354 \uBCF4\uAE30', callback_data: 'menu_copy_trade' }],
                    [{ text: '\uD83C\uDFE0 \uBA54\uC778\uC73C\uB85C', callback_data: 'menu_back_main' }],
                ],
            },
        }).catch(() => { });
    });

    // ── Copy Trader: Launch (발사) ───────────────────────────────────────────
    bot.action(/^ct_start:(.+)$/, async (ctx) => {
        const suffix = ctx.match[1];
        const chatId = String(ctx.chat.id);
        const tr = traderCache.get(suffix);
        await ctx.answerCbQuery('🚀 발사!');

        if (!tr) {
            return ctx.editMessageText(
                '⚠️ 세션 만료 — 레벨을 다시 선택해 주세요.',
                {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '🔄 다시 선택', callback_data: 'menu_copy_trade' }]] }
                }
            ).catch(() => { });
        }

        // Block copy trading for MOCK/sample traders (no real address)
        if (!tr.isReal || !tr.addr) {
            return ctx.editMessageText(
                `🚫 *야, 이 형은 샘플 데이터야.*\n\n` +
                `리더보드 API가 아직 응답 중이거나 연결이 끊겼어.\n` +
                `잠깐 기다렸다가 레벨 선택을 다시 눌러봐.\n\n` +
                `_실제 고래 지갑 주소가 로드되면 카피 가능해진다._`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 리더보드 새로고침', callback_data: 'menu_copy_trade' }],
                            [{ text: '🏠 메인으로', callback_data: 'menu_back_main' }],
                        ],
                    },
                }
            ).catch(() => { });
        }

        const lm = tr.levelMeta;
        const name = tr.name;

        // Show "starting" state
        await ctx.editMessageText(
            `🚀 *${name} 카피 연동 시작 중...*\n\n` +
            `레버리지: *${lm?.leverage ?? 'N/A'}* | 리스크: ${lm?.risk ?? 'N/A'}\n\n` +
            `🔄 _트레이더 포지션 초기 스캔 중..._`,
            { parse_mode: 'Markdown' }
        ).catch(() => { });

        // Retrieve user private key
        let privKey;
        try {
            privKey = getUserPrivateKey(chatId);
        } catch (err) {
            return ctx.editMessageText(
                `🔐 *지갑 오류*\n\n${err.message}\n\n/start 으로 지갑을 생성해 주세요.`,
                { parse_mode: 'Markdown' }
            ).catch(() => { });
        }

        // Start the copy trading engine
        try {
            const { posCount, initialPositions } = await startCopyTrading({
                chatId,
                traderAddr: tr.addr,
                traderName: name,
                levelMeta: lm,
                privKey,
                bot,
            });

            const posLines = Object.entries(initialPositions)
                .map(([c, p]) => `• \`${c}\` ${p.szi > 0 ? 'Long' : 'Short'} (${p.szi})`)
                .join('\n') || '_(현재 열린 포지션 없음 — 신규 포지션 감시 중)_';

            await ctx.editMessageText(
                `✅ *${name} 카피 실전 감시 시작\!*\n\n` +
                `레버리지: *${lm?.leverage ?? 'N/A'}* | 리스크: ${lm?.risk ?? 'N/A'}\n` +
                `강시 주기: *1초* | 미러 사이즈: *$${process.env.COPY_TRADE_SIZE_USD ?? 20}*\n\n` +
                `📊 현재 포지션 (${posCount}개)을 추적 중:\n${posLines}\n\n` +
                `_포지션 변화 발생 시 텔레그램으로 실시간 알림 발송._`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🛑 카피 중지', callback_data: `stop_copy:${chatId}` }],
                            [{ text: '🏠 메인으로', callback_data: 'menu_back_main' }],
                        ],
                    },
                }
            ).catch(() => { });

        } catch (err) {
            console.error('[COPY] startCopyTrading failed:', err);
            await ctx.editMessageText(
                `❌ *카피 시작 실패*\n\n${err.message}\n\n다시 시도해 주세요.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '🔄 다시 시도', callback_data: 'menu_copy_trade' }]] },
                }
            ).catch(() => { });
        }
    });

    // ── Stop copy trading ───────────────────────────────────────────────────
    bot.action(/^stop_copy:(.+)$/, async (ctx) => {
        const targetId = ctx.match[1];
        const chatId = String(ctx.chat.id);
        await ctx.answerCbQuery('🛑 카피 중지');
        // Only the owner can stop their own session
        if (targetId !== chatId) return;
        const stopped = stopCopyTrading(chatId);
        await ctx.editMessageText(
            stopped
                ? '🛑 *카피 트레이딩이 중지되었습니다.*\n\n_포지션 감시가 중단됐습니다. 다음 베팅은 직접 진행해주세요._'
                : '⚠️ 활성 카피 세션이 없습니다.',
            {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🏠 메인으로', callback_data: 'menu_back_main' }]] },
            }
        ).catch(() => { });
    });


    // ── Language callback ─────────────────────────────────────────────────────
    bot.action(/^lang:(.+)$/, async (ctx) => {
        const chatId = String(ctx.chat.id);
        const selectedLang = ctx.match[1];
        if (!LANGUAGES[selectedLang]) return ctx.answerCbQuery('Invalid.');

        const flag = LANGUAGES[selectedLang].flag;
        const label = LANGUAGES[selectedLang].label;
        await ctx.answerCbQuery(`${flag} ${label}`);

        const existingWallet = getUserWallet(chatId);

        if (existingWallet) {
            // ── EXISTING USER: silent language swap — NO session reset ────────
            updateLanguage(chatId, selectedLang);

            // Edit the language picker in-place (remove buttons, show confirmation)
            await ctx.editMessageText(
                `${flag} *언어가 ${label}(으)로 변경되었습니다.*\n_Language changed to ${label}._`,
                { parse_mode: 'Markdown' }
            ).catch(() => { });

            // Re-send the bottom keyboard in the new language (seamless refresh)
            await ctx.reply(
                `${flag} ${label} 설정 완료. 현재 화면에서 계속하세요.`,
                { parse_mode: 'Markdown', reply_markup: replyKeyboard(selectedLang) }
            );
        } else {
            // ── NEW USER: full onboarding ─────────────────────────────────────
            await ctx.editMessageReplyMarkup({});
            const genMsg = await ctx.reply(
                t(selectedLang, 'generating_wallet'), { parse_mode: 'Markdown' }
            );
            try {
                const { walletAddress } = await onboardUser(chatId, selectedLang);
                updateLanguage(chatId, selectedLang);
                await ctx.telegram.deleteMessage(chatId, genMsg.message_id).catch(() => { });
                await ctx.telegram.sendAnimation(chatId, ONBOARDING_GIF).catch(() => { });
                await ctx.reply(
                    t(selectedLang, 'welcome', { wallet: walletAddress }),
                    { parse_mode: 'Markdown', reply_markup: replyKeyboard(selectedLang) }
                );
            } catch (err) {
                console.error('[BOT] Onboarding error:', err);
                await ctx.telegram.deleteMessage(chatId, genMsg.message_id).catch(() => { });
                await ctx.reply(t(selectedLang, 'error_generic'), { parse_mode: 'Markdown' });
            }
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
        // Priority: explicit valid ticker > active grid asset > auto-detect from API (no BTC hardcoding)
        const asset = isValidTicker ? candidateAsset : (gs?.stats?.asset || null);

        await ctx.reply(`_Initializing${asset ? ` ${asset}/USDC` : ''} terminal..._`, { parse_mode: 'Markdown' });

        // HL_WALLET_ADDRESS(.env) = 유저의 실제 HL 거래 계좌
        // getUserWallet(chatId) = 봇 내부 생성 EVM 지갑 (다를 수 있음!)
        const hlWallet = process.env.HL_WALLET_ADDRESS || getUserWallet(chatId);

        await startDashboard(bot, chatId, {
            asset,
            gridCount: gs?.stats?.gridCount || 0,
            totalUsdc: gs?.stats?.totalUsdc || 0,
            lowerPrice: gs?.stats?.lowerPrice || 0,
            upperPrice: gs?.stats?.upperPrice || 0,
            walletAddress: hlWallet,
        });
    };
    bot.command('dashboard', handleDashboard);
    bot.hears(/^📊/, handleDashboard);                     // Korean: 📊 대시보드 / all langs

    // ── /referral ─────────────────────────────────────────────────────────────
    bot.command('referral', async (ctx) => {
        const chatId = String(ctx.chat.id);
        if (!await requireWallet(ctx)) return;

        const code = ensureReferralCode(chatId);
        const stats = getReferralStats(chatId);
        const botUsername = ctx.botInfo?.username ?? 'aigent_bot';
        const link = `https://t.me/${botUsername}?start=${code}`;

        const recentList = stats.referees.slice(0, 5)
            .map((r, i) => `  ${i + 1}. ID ${r.referee_chat_id.slice(-4)}•••  (${r.created_at.slice(0, 10)})`)
            .join('\n') || '  아직 초대한 유저 없음';

        await ctx.reply(
            `👥 *나의 레퍼럴 현황*

` +
            `\`\`\`
` +
            `코드   : ${code}
` +
            `링크   : ${link}
` +
            `초대수 : ${stats.count}명
` +
            `\`\`\`

` +
            `*최근 초대 유저:*
${recentList}

` +
            `_위 링크를 친구에게 공유하면 봇 진입 시 자동으로 연결됩니다._`,
            { parse_mode: 'Markdown' }
        );
    });
    bot.hears(/^👥/, async (ctx) => ctx.reply('/referral 을 입력해주세요.'));
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

        // Always clear any stale pending state before showing a fresh prompt
        depositPending.delete(chatId);

        try {
            const statusMsg = await ctx.reply(
                l === 'ko' ? '_ARB 지갑 잔고 확인 중..._' : '_Checking ARB wallet balance..._',
                { parse_mode: 'Markdown' }
            );

            let usdcBalance = 0;
            try {
                const { getArbUsdcBalanceRaw } = await import('./dashboard.js');
                usdcBalance = await getArbUsdcBalanceRaw(getUserWallet(chatId));
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

            depositPending.set(chatId, { usdcBalance, promptMsgId: promptMsg.message_id });
        } catch (err) {
            // Clear state so user can retry immediately without zombie session
            depositPending.delete(chatId);
            console.error('[DEPOSIT] handleDeposit error:', err.message);
            ctx.reply(l === 'ko'
                ? '❌ 잠시 통신 오류가 발생했습니다. 다시 눌러주세요.'
                : '❌ Network hiccup. Please try again.'
            ).catch(() => { });
        }
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

        // ── 상황 A: 최소 금액 미달 ────────────────────────────────────────────
        if (amountUsdc < MIN_DEPOSIT_USDC) {
            return ctx.reply(
                `❌ *송금 금액이 너무 적습니다.*\n\n` +
                `하이퍼리퀴드 거래소 규정상 최소 송금액은 *${MIN_DEPOSIT_USDC} USDC* 이상이어야 합니다.\n` +
                `더 큰 금액을 입력해 주세요.`,
                { parse_mode: 'Markdown' }
            );
        }

        const loadingMsg = await ctx.reply(
            t(l, 'deposit_loading') + `\n\n_토탈 금액: *$${amountUsdc.toFixed(2)} USDC*_`,
            { parse_mode: 'Markdown', disable_web_page_preview: true }
        );

        const editProgress = async (text) => {
            try {
                await ctx.telegram.editMessageText(
                    chatId, loadingMsg.message_id, null,
                    t(l, 'deposit_loading') + `\n\n_토탈: $${amountUsdc.toFixed(2)} USDC_\n⏱️ _${text}_`,
                    { parse_mode: 'Markdown', disable_web_page_preview: true }
                );
            } catch { /* unchanged — ignore */ }
        };

        /** Edits the loading msg with a friendly error (never shows raw system errors) */
        const showError = async (userMsg) => {
            await ctx.telegram.editMessageText(
                chatId, loadingMsg.message_id, null,
                userMsg,
                { parse_mode: 'Markdown' }
            ).catch(() => ctx.reply(userMsg, { parse_mode: 'Markdown' }));
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
                // ── Classify hlbridge.js errors into friendly messages ─────────
                const errText = result.error || '';

                if (errText.includes('Insufficient balance') || errText.includes('minimum')) {
                    // 상황 A variant from hlbridge (< $1)
                    await showError(
                        `❌ *송금 금액이 너무 적습니다.*\n\n` +
                        `하이퍼리퀴드 거래소 규정상 최소 송금액은 *1 USDC* 이상이어야 합니다.\n` +
                        `더 큰 금액을 입력해 주세요.`
                    );
                } else if (errText.includes('가스비') || errText.includes('ETH') || errText.includes('gas')) {
                    // Gas error — already friendly Korean from hlbridge.js, pass through
                    await showError(errText);
                } else if (errText.includes('네트워크') || errText.includes('RPC') || errText.includes('network') || errText.includes('지연')) {
                    // 상황 C: network/RPC error
                    await showError(
                        `❌ *일시적인 통신 오류가 발생했습니다.*\n\n` +
                        `블록체인 네트워크 혼잡으로 인해 처리가 지연되고 있습니다.\n` +
                        `귀하의 자금은 안전하며, 잠시 후 다시 시도해 주시기 바랍니다.`
                    );
                } else {
                    // Generic fallback — show friendly, log raw
                    console.error('[DEPOSIT] bridge error:', errText);
                    await showError(
                        `❌ *일시적인 통신 오류가 발생했습니다.*\n\n` +
                        `블록체인 네트워크 혼잡으로 인해 처리가 지연되고 있습니다.\n` +
                        `귀하의 자금은 안전하며, 잠시 후 다시 시도해 주시기 바랍니다.`
                    );
                }
            }
        } catch (err) {
            // ── 상황 C: unexpected system/code error ──────────────────────────
            // Always clear pending state so user can retry
            depositPending.delete(chatId);
            console.error('[DEPOSIT] runDepositFlow unhandled error:', err.message);
            const rawMsg = (err?.message || '').toLowerCase();
            if (rawMsg.includes('insufficient funds') || rawMsg.includes('insufficient_funds') ||
                rawMsg.includes('intrinsic gas') || (rawMsg.includes('gas') && rawMsg.includes('funds'))) {
                await showError(
                    `❌ *가스비(ETH) 부족!*\n\n` +
                    `송금 트랜잭션을 처리할 ETH 가스비가 없습니다.\n` +
                    `귀하의 금고 주소로 소량의 *Arbitrum 기반 ETH (약 $1~2)*를 입금해 주세요.`
                ).catch(() => { });
            } else {
                await showError(
                    `❌ *일시적인 통신 오류가 발생했습니다.*\n\n` +
                    `블록체인 네트워크 혼잡으로 인해 처리가 지연되고 있습니다.\n` +
                    `귀하의 자금은 안전하며, 잠시 후 다시 시도해 주시기 바랍니다.`
                ).catch(() => { });
            }
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

            // ── CHAT (general conversation / questions) ────────────────────────
            if (strategy === 'chat') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                return ctx.reply(intent.reply || '안녕하세요! 매매 명령을 내려주세요.', { parse_mode: 'Markdown' });
            }

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
                        walletAddress: process.env.HL_WALLET_ADDRESS || getUserWallet(chatId),
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
                        walletAddress: process.env.HL_WALLET_ADDRESS || getUserWallet(chatId),
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

            // ── SCALP ─────────────────────────────────────────────────────────
            if (strategy === 'scalp') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });

                if (isScalping(chatId)) {
                    return ctx.reply('⚠️ 이미 스캘핑이 실행 중입니다.\n중지하려면 *스캘핑 중지* 라고 말씀해 주세요.', { parse_mode: 'Markdown' });
                }

                let privateKey;
                try { privateKey = getUserPrivateKey(chatId); } catch (e) {
                    return ctx.reply(`❌ ${e.message}`, { parse_mode: 'Markdown' });
                }

                const asset = (intent.asset || '').toUpperCase() || null;
                const leverage = Number(intent.leverage) || 10;
                const gridSpacing = Number(intent.grid_spacing) || 0.5;
                const gridCount = Math.max(1, Math.min(10, Number(intent.grid_count) || 3));
                const seedUsdc = Number(intent.seed_usdc) || 5;

                await ctx.reply(
                    `🤖 *AI 스캘핑 파라미터 확인*\n\n` +
                    `\`\`\`\n` +
                    `종목:     ${asset}/USDC\n` +
                    `레버리지: ${leverage}x\n` +
                    `그리드 간격: ±${gridSpacing.toFixed(2)}%\n` +
                    `그리드 수:  ${gridCount}개\n` +
                    `시드:     $${seedUsdc} USDC\n` +
                    `\`\`\`\n` +
                    `_자동 매매 시작 중..._`,
                    { parse_mode: 'Markdown' }
                );

                const onFill = async (msg) => {
                    try { await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' }); } catch { /* ignore Telegram errors */ }
                };

                const { ok, alreadyRunning } = await startScalping({
                    privateKey, asset, leverage,
                    gridSpacing: intent.gridSpacing ?? 0.05,   // μSCALP default 0.05%
                    tpPct: intent.tpPct ?? 0.08,   // μSCALP default 0.08% TP
                    gridCount, seedUsdc, onFill, chatId,
                });

                if (!ok && alreadyRunning) {
                    await ctx.reply('⚠️ 이미 실행 중인 세션이 있습니다.', { parse_mode: 'Markdown' });
                }
                return;
            }

            // ── STOP SCALP ────────────────────────────────────────────────────
            if (strategy === 'stop_scalp') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                const { wasRunning, asset: stoppedAsset } = stopScalping(chatId);
                if (wasRunning) {
                    await ctx.reply(`⛔ *${stoppedAsset} 스캘핑 중지 완료*\n미체결 주문 모두 취소 중...`, { parse_mode: 'Markdown' });
                } else {
                    await ctx.reply('ℹ️ 실행 중인 스캘핑 세션이 없습니다.', { parse_mode: 'Markdown' });
                }
                return;
            }

            // ── CANCEL ALL ORDERS + CLOSE POSITION ───────────────────────────
            if (strategy === 'cancel_all') {
                await ctx.telegram.deleteMessage(chatId, thinkingMsg.message_id).catch(() => { });
                const pk = getUserPrivateKey(chatId);
                if (!pk) {
                    await ctx.reply('⚠️ 지갑 정보를 찾을 수 없습니다.', { parse_mode: 'Markdown' });
                    return;
                }
                // Stop scalping if running
                if (isScalping(chatId)) stopScalping(chatId);

                const cancelMsg = await ctx.reply('🔄 *전체 주문 취소 + 포지션 청산 중...*', { parse_mode: 'Markdown' });
                try {
                    const { Hyperliquid } = await import('hyperliquid');
                    const { ethers } = await import('ethers');
                    const testnet = process.env.HL_TESTNET === 'true';
                    const wallet = new ethers.Wallet(pk);
                    const sdk = new Hyperliquid({ privateKey: pk, testnet });
                    sdk.walletAddress = wallet.address;

                    // Cancel all open orders across all assets
                    const openOrders = await sdk.info.getUserOpenOrders(wallet.address).catch(() => []);
                    if (openOrders.length) {
                        await sdk.exchange.cancelOrder(openOrders.map(o => ({ coin: o.coin, oid: o.oid }))).catch(() => { });
                    }

                    // Close all perpetual positions via market
                    const chs = await sdk.info.perpetuals.getClearinghouseState(wallet.address).catch(() => null);
                    const positions = (chs?.assetPositions ?? []).filter(p => Math.abs(parseFloat(p?.position?.szi ?? '0')) > 0);
                    for (const p of positions) {
                        await sdk.custom.marketClose(p.position.coin).catch(() => { });
                    }

                    await ctx.telegram.editMessageText(chatId, cancelMsg.message_id, null,
                        `✅ *전체 취소 완료*\n• 취소된 주문: ${openOrders.length}개\n• 청산된 포지션: ${positions.length}개\n_거래소와 동기화 완료._`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => { });
                } catch (e) {
                    await ctx.reply(`❌ 취소 중 오류: ${e.message?.slice(0, 100)}`, { parse_mode: 'Markdown' });
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
            // Deposit monitor DISABLED — was polling Arbitrum L1 RPC and causing 429 spam
            // startDepositMonitor(bot).catch((e) => console.error('[DEPOSIT] Start error:', e.message));
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

    // ── AUTO-RESUME: restore last μSCALP session after bot restart ─────────────
    // v7.2: On boot, scan HL API to detect the ACTUAL active ticker (e.g. DOGE)
    //        instead of blindly trusting the potentially stale session file asset.
    try {
        const saved = loadSession();
        if (saved && saved.chatId && saved.privateKey) {
            console.log(`[BOT] Scanning HL API for active positions/orders...`);
            const resumeOnFill = async (msg) => {
                try { await bot.telegram.sendMessage(saved.chatId, msg, { parse_mode: 'Markdown' }); } catch { }
            };

            setTimeout(async () => {
                try {
                    // ── STEP 1: Query HL API to find real active ticker ──────────
                    const { Hyperliquid } = await import('hyperliquid');
                    const { ethers } = await import('ethers');
                    const testnet = process.env.HL_TESTNET === 'true';
                    const wallet = new ethers.Wallet(saved.privateKey);
                    const sdk = new Hyperliquid({ privateKey: saved.privateKey, testnet });

                    let detectedAsset = saved.asset || null; // may be null if session is stale

                    try {
                        // ── PRIORITY 1: Find coin with active position ──────────
                        const chs = await sdk.info.perpetuals.getClearinghouseState(wallet.address);
                        const positions = (chs?.assetPositions ?? [])
                            .filter(p => Math.abs(parseFloat(p?.position?.szi ?? '0')) > 0);

                        if (positions.length > 0) {
                            const biggest = positions.sort((a, b) =>
                                Math.abs(parseFloat(b.position.positionValue ?? '0')) -
                                Math.abs(parseFloat(a.position.positionValue ?? '0'))
                            )[0];
                            const coin = (biggest.position.coin ?? '').replace(/-PERP$/i, '');
                            if (coin) detectedAsset = coin;
                        }

                        // ── PRIORITY 2: If no position found, check open orders ──
                        if (!detectedAsset) {
                            const orders = await sdk.info.getUserOpenOrders(wallet.address).catch(() => []);
                            if (orders.length > 0) {
                                const coin = (orders[0].coin ?? '').replace(/-PERP$/i, '');
                                if (coin) detectedAsset = coin;
                            }
                        }
                    } catch (scanErr) {
                        console.warn('[BOT] HL scan failed:', scanErr.message?.slice(0, 60));
                    }

                    // ── ABSOLUTE FALLBACK: use session asset, or abort ──────────
                    if (!detectedAsset) {
                        console.warn('[BOT] No active ticker detected and no session asset — standby.');
                        await resumeOnFill('⚠️ 활성 포지션/주문 없음 — Standby 대기 중.').catch(() => { });
                        return;
                    }

                    console.log(`[BOT] Active ticker detected: ${detectedAsset} (session: ${saved.asset ?? 'none'})`);
                    console.log(`[BOT] Auto-resuming μSCALP: ${detectedAsset} for chatId ${saved.chatId}`);

                    // ── STEP 2: Start engine with detected ticker ────────────────
                    await startScalping({
                        privateKey: saved.privateKey,
                        asset: detectedAsset,
                        leverage: saved.leverage ?? 10,
                        gridSpacing: saved.gridSpacing ?? 0.05,
                        tpPct: saved.tpPct ?? 0.08,
                        gridCount: saved.gridCount ?? 3,
                        seedUsdc: saved.seedUsdc ?? 5,
                        onFill: resumeOnFill,
                        chatId: String(saved.chatId),
                    });

                    // After sync completes (~6s), push immediate status message
                    setTimeout(() => resumeOnFill(
                        `🔄 *[봇 재시작 완료 — 자동 동기화]*\n` +
                        `• 🟢 *${detectedAsset}-PERP* 거머리 스캘핑 ACTIVE\n` +
                        `• 거래소 포지션 & 미체결 주문 복구 완료\n` +
                        `_대시보드가 1분마다 자동 갱신됩니다._`
                    ).catch(() => { }), 6_000);

                } catch (e) {
                    console.error('[BOT] Auto-resume failed:', e.message);
                }
            }, 3_000);
        } else {
            // ── NO SESSION FILE: scan DB users for active HL positions ────────
            console.log('[BOT] No session file — scanning DB users for active HL state...');
            setTimeout(async () => {
                try {
                    const { Hyperliquid } = await import('hyperliquid');
                    const { ethers } = await import('ethers');
                    const testnet = process.env.HL_TESTNET === 'true';
                    const users = getAllUsers();  // all registered users with wallets
                    console.log(`[BOT] Scanning ${users.length} registered user(s)...`);

                    for (const user of users) {
                        const chatId = user.telegram_id;
                        const pk = getUserPrivateKey(chatId);
                        if (!pk) continue;

                        try {
                            const wallet = new ethers.Wallet(pk);
                            const sdk = new Hyperliquid({ privateKey: pk, testnet });

                            // Check positions
                            const chs = await sdk.info.perpetuals.getClearinghouseState(wallet.address);
                            const positions = (chs?.assetPositions ?? [])
                                .filter(p => Math.abs(parseFloat(p?.position?.szi ?? '0')) > 0);

                            let detectedAsset = null;
                            if (positions.length > 0) {
                                const biggest = positions.sort((a, b) =>
                                    Math.abs(parseFloat(b.position.positionValue ?? '0')) -
                                    Math.abs(parseFloat(a.position.positionValue ?? '0'))
                                )[0];
                                detectedAsset = (biggest.position.coin ?? '').replace(/-PERP$/i, '');
                            }
                            // Fallback: check open orders
                            if (!detectedAsset) {
                                const orders = await sdk.info.getUserOpenOrders(wallet.address).catch(() => []);
                                if (orders.length > 0) {
                                    detectedAsset = (orders[0].coin ?? '').replace(/-PERP$/i, '');
                                }
                            }

                            if (!detectedAsset) {
                                console.log(`[BOT] User ${chatId}: no active HL state.`);
                                continue;
                            }

                            console.log(`[BOT] User ${chatId}: found active ${detectedAsset} — auto-resuming!`);
                            const resumeOnFill = async (msg) => {
                                try { await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' }); } catch { }
                            };

                            await startScalping({
                                privateKey: pk, asset: detectedAsset,
                                leverage: 10, gridSpacing: 0.05, tpPct: 0.08,
                                gridCount: 3, seedUsdc: 5,
                                onFill: resumeOnFill, chatId: String(chatId),
                            });

                            setTimeout(() => resumeOnFill(
                                `🔄 *[봇 재시작 — DB 스캔 복구]*\n` +
                                `• 🟢 *${detectedAsset}-PERP* 거머리 스캘핑 ACTIVE\n` +
                                `• 세션 파일 없이 거래소 직접 탐지로 복구 완료\n` +
                                `_대시보드가 1분마다 자동 갱신됩니다._`
                            ).catch(() => { }), 6_000);

                            break; // stop after first active user found
                        } catch (userErr) {
                            console.warn(`[BOT] Scan error for ${chatId}:`, userErr.message?.slice(0, 60));
                        }
                    }
                } catch (e) {
                    console.error('[BOT] DB scan resume failed:', e.message);
                }
            }, 4_000);
        }
    } catch (e) {
        console.warn('[BOT] Auto-resume check error:', e.message);
    }

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    // Telegraf v4 bot.launch() resolves immediately once polling is registered.
    // Without this, startBot() returns, index.js finishes, and Node.js exits.
    // This never-resolving Promise keeps the event loop alive until SIGINT/SIGTERM.
    await new Promise(() => { });
}
