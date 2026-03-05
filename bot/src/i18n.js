/**
 * AIGENT — Internationalization (i18n) Dictionary
 * File: bot/src/i18n.js
 * Supports: English (en), Korean (ko), Spanish (es), Chinese (zh)
 */

export const LANGUAGES = {
    en: { flag: '🇬🇧', label: 'English' },
    ko: { flag: '🇰🇷', label: '한국어' },
    es: { flag: '🇪🇸', label: 'Español' },
    zh: { flag: '🇨🇳', label: '中文' },
};

/**
 * Returns the full localized string for a given key and language.
 * Falls back to English if the key or language is missing.
 *
 * @param {string} lang - Language code: "en" | "ko" | "es" | "zh"
 * @param {string} key  - Message key
 * @param {Object} [vars] - Template variables to interpolate
 * @returns {string}
 */
export function t(lang, key, vars = {}) {
    const dict = MESSAGES[lang] || MESSAGES.en;
    let msg = dict[key] || MESSAGES.en[key] || `[MISSING: ${key}]`;
    for (const [k, v] of Object.entries(vars)) {
        msg = msg.replaceAll(`{{${k}}}`, v);
    }
    return msg;
}

// ── Message Dictionary ─────────────────────────────────────────────────────────
const MESSAGES = {

    // ── English ────────────────────────────────────────────────────────────────
    en: {
        select_language:
            `*Welcome to AIGENT Protocol.*\n\n` +
            `The world's first intent-centric AI liquidity engine.\n\n` +
            `Please select your language to continue:`,

        generating_wallet:
            `⚙️ *Initializing your account...*\n\n` +
            `Generating your dedicated trading wallet. This takes just a moment.`,

        welcome:
            `🤖 *Welcome to AIGENT!*\n` +
            `_The fastest AI-powered Intent Trading engine, live._\n\n` +
            `🏦 *Your dedicated AIGENT trading wallet:*\n` +
            `\`{{wallet}}\`\n` +
            `_(Tap to copy)_\n\n` +
            `⚡️ *Quick Start Guide:*\n` +
            `1️⃣ Deposit USDC to the address above via *Arbitrum* network.\n` +
            `   _(Required for Hyperliquid DEX engine integration)_\n` +
            `2️⃣ Once deposited, type your strategy in plain English.\n\n` +
            `💬 *Example commands:*\n` +
            `• _"Long BTC $500 at 10x leverage if it breaks $100K"_\n` +
            `• _"Set up ETH grid between $2,800–$3,200, 20 levels, $1,000 USDC"_\n` +
            `• _"Market buy $300 SOL at 5x"_\n\n` +
            `📊 /dashboard — Live terminal\n` +
            `📖 /help — All commands\n\n` +
            `⚠️ *Security:* This wallet is used exclusively for AIGENT trading. You can withdraw to your personal wallet at any time.`,

        help:
            `📖 *AIGENT Command Reference*\n\n` +
            `*/dashboard [ASSET]* — Live Bloomberg terminal\n` +
            `*/history* — Recent trade log\n` +
            `*/wallet* — View your wallet address\n` +
            `*/cancelgrid* — Stop active grid session\n` +
            `*/language* — Change language\n\n` +
            `*Natural language trading:*\n` +
            `• "Market buy ETH $500 10x leverage"\n` +
            `• "ETH grid $2800–$3200, 20 grids, $1000"\n` +
            `• "Buy $100 BTC if drops 5%"`,

        wallet_header: `🏦 *Your AIGENT Wallet:*\n\`{{wallet}}\``,
        error_no_user: `⚠️ Account not found. Please use /start to set up your account.`,
        error_generic: `❌ An error occurred. Please try again.`,
        parse_error: `❌ *Could not parse intent.*\n\n{{error}}\n\nTry: _"Buy $200 ETH at 10x leverage"_`,
        trade_configured: `✅ *Trade Configured [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *Incomplete intent.* Please provide: action, asset, amount, and condition.\n\nExample: _"Buy $100 of ETH if it drops 5%"_`,
        stop_dashboard: `Dashboard stopped. Use /dashboard to restart.`,
        no_grid: `No active grid session found.`,
        grid_cancelled: `🛑 *Grid Stopped*\n\nAsset: *{{asset}}*\n\n_Open orders must be cancelled via Hyperliquid UI._`,

        // Navigation keyboard labels
        btn_dashboard: `📊 Dashboard`,
        btn_withdraw: `💸 Withdraw`,
        btn_settings: `⚙️ Settings & Key`,

        // /withdraw
        withdraw_title: `💸 *Withdraw Funds*`,
        withdraw_body:
            `Your AIGENT wallet holds funds on Arbitrum / Hyperliquid.\n\n` +
            `*Wallet address:* \`{{wallet}}\`\n\n` +
            `To withdraw:\n` +
            `1. Open the [Hyperliquid App](https://app.hyperliquid.xyz)\n` +
            `2. Connect this wallet address\n` +
            `3. Use Withdraw → Arbitrum to move USDC to any address\n\n` +
            `_Native in-bot withdrawals coming in v3.0._`,

        // /export_key
        export_key_title: `🔑 *Private Key Backup*`,
        export_key_warning:
            `⚠️ *Security Warning*\n\n` +
            `Your private key grants *full access* to your wallet.\n` +
            `*Never share it with anyone.*\n\n` +
            `Tap the button below to reveal your key. It will auto-delete in 60 seconds.`,
        export_key_confirm: `[ Reveal My Private Key ]`,
        export_key_value:
            `🔑 *Your Private Key*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ Import this into MetaMask or any EVM wallet.\n` +
            `_This message will self-delete in 60 seconds._`,
    },

    // ── Korean ─────────────────────────────────────────────────────────────────
    ko: {
        select_language:
            `*AIGENT 프로토콜에 오신 것을 환영합니다.*\n\n` +
            `세계 최초 Intent 기반 AI 유동성 엔진입니다.\n\n` +
            `계속하려면 언어를 선택해 주세요:`,

        generating_wallet:
            `⚙️ *계정을 초기화 중입니다...*\n\n` +
            `전용 트레이딩 지갑을 생성하고 있습니다. 잠시만 기다려 주세요.`,

        welcome:
            `🤖 *AIGENT에 오신 것을 환영합니다!*\n` +
            `_가장 빠르고 지능적인 AI 기반 Intent 트레이딩을 시작하세요._\n\n` +
            `🏦 *귀하의 AIGENT 전용 트레이딩 지갑:*\n` +
            `\`{{wallet}}\`\n` +
            `_(탭하여 복사)_\n\n` +
            `⚡️ *시작 안내:*\n` +
            `1️⃣ 위 주소로 *Arbitrum 네트워크*를 통해 USDC를 입금하세요.\n` +
            `   _(Hyperliquid DEX 엔진 연동을 위한 필수 사항입니다)_\n` +
            `2️⃣ 입금 확인 후, 채팅창에 자연어로 매매 전략을 입력하세요.\n\n` +
            `💬 *명령어 예시:*\n` +
            `• _"비트코인 10만불 돌파 시 500달러 10배 롱"_\n` +
            `• _"이더리움 2800~3200 그리드봇 20개 격자 1000달러"_\n` +
            `• _"솔라나 300달러 5배 시장가 매수"_\n\n` +
            `📊 /dashboard — 실시간 터미널\n` +
            `📖 /help — 전체 명령어\n\n` +
            `⚠️ *보안 안내:* 이 지갑은 AIGENT 전용 트레이딩에만 사용됩니다. 언제든지 개인 지갑으로 출금 가능합니다.`,

        help:
            `📖 *AIGENT 명령어 목록*\n\n` +
            `*/dashboard [자산]* — 실시간 터미널 대시보드\n` +
            `*/history* — 최근 거래 내역\n` +
            `*/wallet* — 내 지갑 주소 확인\n` +
            `*/cancelgrid* — 그리드봇 중지\n` +
            `*/language* — 언어 변경\n\n` +
            `*자연어 트레이딩 예시:*\n` +
            `• "ETH 500달러 10배 시장가 매수"\n` +
            `• "이더 2800~3200 그리드봇 20개 1000달러"\n` +
            `• "BTC 5% 떨어지면 100달러 매수"`,

        wallet_header: `🏦 *내 AIGENT 지갑:*\n\`{{wallet}}\``,
        error_no_user: `⚠️ 계정을 찾을 수 없습니다. /start 명령어로 계정을 다시 설정해 주세요.`,
        error_generic: `❌ 오류가 발생했습니다. 다시 시도해 주세요.`,
        parse_error: `❌ *의도를 파악할 수 없습니다.*\n\n{{error}}\n\n예시: _"ETH 200달러 10배 시장가 매수"_`,
        trade_configured: `✅ *주문 설정 완료 [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *정보가 부족합니다.* 행동, 자산, 금액, 조건을 입력해 주세요.\n\n예시: _"ETH 5% 하락 시 100달러 매수"_`,
        stop_dashboard: `대시보드를 중지했습니다. /dashboard 로 재시작할 수 있습니다.`,
        no_grid: `활성화된 그리드 세션이 없습니다.`,
        grid_cancelled: `🛑 *그리드봇 중지됨*\n\n자산: *{{asset}}*\n\n_미체결 주문은 Hyperliquid UI에서 직접 취소해 주세요._`,

        btn_dashboard: `📊 대시보드`,
        btn_withdraw: `💸 출금하기`,
        btn_settings: `⚙️ 세팅 및 키 백업`,

        withdraw_title: `💸 *출금하기*`,
        withdraw_body:
            `AIGENT 지갑의 자금은 Arbitrum / Hyperliquid에 있습니다.\n\n` +
            `*지갑 주소:* \`{{wallet}}\`\n\n` +
            `출금 방법:\n` +
            `1. [Hyperliquid 앱](https://app.hyperliquid.xyz)을 여세요\n` +
            `2. 위 지갑 주소를 연결하세요\n` +
            `3. Withdraw → Arbitrum으로 원하는 주소에 USDC를 전송하세요\n\n` +
            `_인봇 출금 기능은 v3.0에서 지원 예정입니다._`,

        export_key_title: `🔑 *프라이빗 키 백업*`,
        export_key_warning:
            `⚠️ *보안 경고*\n\n` +
            `프라이빗 키는 지갑의 *모든 자산에 대한 완전한 접근 권한*을 부여합니다.\n` +
            `*절대 타인과 공유하지 마세요.*\n\n` +
            `아래 버튼을 눌러 키를 확인하세요. 60초 후 자동 삭제됩니다.`,
        export_key_confirm: `[ 프라이빗 키 확인 ]`,
        export_key_value:
            `🔑 *프라이빗 키*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ MetaMask 또는 EVM 지갑에 가져오세요.\n` +
            `_이 메시지는 60초 후 자동 삭제됩니다._`,
    },

    // ── Spanish ────────────────────────────────────────────────────────────────
    es: {
        select_language:
            `*Bienvenido al Protocolo AIGENT.*\n\n` +
            `El primer motor de liquidez de IA basado en intención del mundo.\n\n` +
            `Por favor, selecciona tu idioma para continuar:`,

        generating_wallet:
            `⚙️ *Inicializando tu cuenta...*\n\n` +
            `Generando tu billetera de trading exclusiva. Espera un momento.`,

        welcome:
            `🤖 *¡Bienvenido a AIGENT!*\n` +
            `_El motor de trading por intención de IA más rápido y avanzado._\n\n` +
            `🏦 *Tu billetera de trading AIGENT exclusiva:*\n` +
            `\`{{wallet}}\`\n` +
            `_(Toca para copiar)_\n\n` +
            `⚡️ *Guía de inicio rápido:*\n` +
            `1️⃣ Deposita USDC en la dirección anterior a través de la red *Arbitrum*.\n` +
            `   _(Necesario para la integración con el motor Hyperliquid DEX)_\n` +
            `2️⃣ Una vez depositado, escribe tu estrategia en lenguaje natural.\n\n` +
            `💬 *Ejemplos de comandos:*\n` +
            `• _"Comprar $500 en BTC con apalancamiento 10x si supera $100K"_\n` +
            `• _"Configurar grid de ETH entre $2.800–$3.200, 20 niveles, $1.000 USDC"_\n` +
            `• _"Comprar SOL $300 al mercado con 5x"_\n\n` +
            `📊 /dashboard — Terminal en vivo\n` +
            `📖 /help — Todos los comandos\n\n` +
            `⚠️ *Seguridad:* Esta billetera se usa exclusivamente para el trading de AIGENT. Puedes retirar a tu billetera personal en cualquier momento.`,

        help:
            `📖 *Referencia de comandos AIGENT*\n\n` +
            `*/dashboard [ACTIVO]* — Terminal Bloomberg en vivo\n` +
            `*/history* — Registro de operaciones recientes\n` +
            `*/wallet* — Ver tu dirección de billetera\n` +
            `*/cancelgrid* — Detener sesión de grid activa\n` +
            `*/language* — Cambiar idioma\n\n` +
            `*Trading en lenguaje natural:*\n` +
            `• "Comprar ETH $500 con apalancamiento 10x al mercado"\n` +
            `• "Grid ETH $2800–$3200, 20 niveles, $1000"\n` +
            `• "Comprar BTC $100 si cae 5%"`,

        wallet_header: `🏦 *Tu Billetera AIGENT:*\n\`{{wallet}}\``,
        error_no_user: `⚠️ Cuenta no encontrada. Usa /start para configurar tu cuenta.`,
        error_generic: `❌ Ocurrió un error. Por favor, inténtalo de nuevo.`,
        parse_error: `❌ *No se pudo interpretar la intención.*\n\n{{error}}\n\nIntenta: _"Comprar $200 ETH con apalancamiento 10x"_`,
        trade_configured: `✅ *Operación configurada [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *Intención incompleta.* Proporciona: acción, activo, monto y condición.\n\nEjemplo: _"Comprar $100 ETH si cae 5%"_`,
        stop_dashboard: `Panel detenido. Usa /dashboard para reiniciar.`,
        no_grid: `No se encontró ninguna sesión de grid activa.`,
        grid_cancelled: `🛑 *Grid Detenido*\n\nActivo: *{{asset}}*\n\n_Las órdenes abiertas deben cancelarse en la interfaz de Hyperliquid._`,

        btn_dashboard: `📊 Panel en Vivo`,
        btn_withdraw: `💸 Retirar`,
        btn_settings: `⚙️ Config & Clave`,

        withdraw_title: `💸 *Retirar Fondos*`,
        withdraw_body:
            `Tu billetera AIGENT tiene fondos en Arbitrum / Hyperliquid.\n\n` +
            `*Dirección:* \`{{wallet}}\`\n\n` +
            `Para retirar:\n` +
            `1. Abre la [App de Hyperliquid](https://app.hyperliquid.xyz)\n` +
            `2. Conecta esta dirección de billetera\n` +
            `3. Usa Retirar → Arbitrum para mover USDC a cualquier dirección\n\n` +
            `_Retiros dentro del bot disponibles en v3.0._`,

        export_key_title: `🔑 *Copia de Seguridad de Clave Privada*`,
        export_key_warning:
            `⚠️ *Advertencia de Seguridad*\n\n` +
            `Tu clave privada otorga *acceso total* a tu billetera.\n` +
            `*Nunca la compartas con nadie.*\n\n` +
            `Toca el botón para revelarla. Se eliminará automáticamente en 60 segundos.`,
        export_key_confirm: `[ Revelar Mi Clave Privada ]`,
        export_key_value:
            `🔑 *Tu Clave Privada*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ Impórtala a MetaMask o cualquier billetera EVM.\n` +
            `_Este mensaje se eliminará en 60 segundos._`,
    },

    // ── Chinese ────────────────────────────────────────────────────────────────
    zh: {
        select_language:
            `*欢迎来到 AIGENT 协议。*\n\n` +
            `全球首个基于意图的 AI 流动性引擎。\n\n` +
            `请选择您的语言以继续：`,

        generating_wallet:
            `⚙️ *正在初始化您的账户...*\n\n` +
            `正在生成您的专属交易钱包，请稍候。`,

        welcome:
            `🤖 *欢迎使用 AIGENT！*\n` +
            `_全球最快、最智能的 AI 意图交易引擎，实时在线。_\n\n` +
            `🏦 *您的 AIGENT 专属交易钱包：*\n` +
            `\`{{wallet}}\`\n` +
            `_(点击复制)_\n\n` +
            `⚡️ *快速入门指南：*\n` +
            `1️⃣ 请通过 *Arbitrum 网络* 将 USDC 充值到上方地址。\n` +
            `   _(这是连接 Hyperliquid DEX 引擎的必要步骤)_\n` +
            `2️⃣ 充值确认后，在聊天框中用自然语言输入您的交易策略。\n\n` +
            `💬 *指令示例：*\n` +
            `• _"比特币突破 10 万美元时开 500 美元 10 倍多单"_\n` +
            `• _"以太坊 2800–3200 美元区间设置 20 格网格，资金 1000 USDC"_\n` +
            `• _"市价买入 SOL 300 美元，5 倍杠杆"_\n\n` +
            `📊 /dashboard — 实时终端\n` +
            `📖 /help — 所有指令\n\n` +
            `⚠️ *安全提示：* 此钱包仅用于 AIGENT 专属交易。您可随时提款至个人钱包。`,

        help:
            `📖 *AIGENT 指令参考*\n\n` +
            `*/dashboard [标的]* — 实时彭博终端\n` +
            `*/history* — 近期交易记录\n` +
            `*/wallet* — 查看钱包地址\n` +
            `*/cancelgrid* — 停止当前网格策略\n` +
            `*/language* — 更改语言\n\n` +
            `*自然语言交易示例：*\n` +
            `• "市价买入 ETH 500 美元，10 倍杠杆"\n` +
            `• "ETH 2800–3200 网格，20 格，1000 美元"\n` +
            `• "如果 BTC 下跌 5% 则买入 100 美元"`,

        wallet_header: `🏦 *您的 AIGENT 钱包：*\n\`{{wallet}}\``,
        error_no_user: `⚠️ 未找到账户。请使用 /start 指令设置您的账户。`,
        error_generic: `❌ 发生错误，请重试。`,
        parse_error: `❌ *无法解析意图。*\n\n{{error}}\n\n请尝试：_"市价买入 ETH 200 美元，10 倍杠杆"_`,
        trade_configured: `✅ *交易已配置 [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *意图不完整。* 请提供：操作、标的、金额和条件。\n\n示例：_"如果 ETH 下跌 5% 则买入 100 美元"_`,
        stop_dashboard: `终端已停止。使用 /dashboard 重新启动。`,
        no_grid: `未找到活跃的网格会话。`,
        grid_cancelled: `🛑 *网格已停止*\n\n标的：*{{asset}}*\n\n_未成交订单需在 Hyperliquid 界面手动取消。_`,

        btn_dashboard: `📊 实时终端`,
        btn_withdraw: `💸 提款`,
        btn_settings: `⚙️ 设置和密钥`,

        withdraw_title: `💸 *提款*`,
        withdraw_body:
            `您的 AIGENT 钱包资金存放在 Arbitrum / Hyperliquid 上。\n\n` +
            `*钱包地址：* \`{{wallet}}\`\n\n` +
            `提款方法：\n` +
            `1. 打开 [Hyperliquid 应用](https://app.hyperliquid.xyz)\n` +
            `2. 连接上方钱包地址\n` +
            `3. 使用提款 → Arbitrum 将 USDC 转至任意地址\n\n` +
            `_机器人内提款功能将在 v3.0 版本上线。_`,

        export_key_title: `🔑 *私钥备份*`,
        export_key_warning:
            `⚠️ *安全警告*\n\n` +
            `私钥可完全控制您的钱包中的所有资产。\n` +
            `*切勿与任何人共享。*\n\n` +
            `点击下方按钮查看您的私钥。60 秒后将自动删除。`,
        export_key_confirm: `[ 查看我的私钥 ]`,
        export_key_value:
            `🔑 *您的私钥*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ 将其导入 MetaMask 或任何 EVM 钱包。\n` +
            `_此消息将在 60 秒后自动删除。_`,
    },
};
