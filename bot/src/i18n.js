/**
 * AIGENT — Internationalization (i18n) Dictionary
 * File: bot/src/i18n.js
 * Supports: English (en), Korean (ko), Spanish (es), Chinese (zh), Japanese (ja)
 */

export const LANGUAGES = {
    en: { flag: '🇬🇧', label: 'English' },
    ko: { flag: '🇰🇷', label: '한국어' },
    es: { flag: '🇪🇸', label: 'Español' },
    zh: { flag: '🇨🇳', label: '中文' },
    ja: { flag: '🇯🇵', label: '日本語' },
};

export function t(lang, key, vars = {}) {
    const dict = MESSAGES[lang] || MESSAGES.en;
    let msg = dict[key] || MESSAGES.en[key] || `[MISSING: ${key}]`;
    for (const [k, v] of Object.entries(vars)) {
        msg = msg.replaceAll(`{{${k}}}`, v);
    }
    return msg;
}

const MESSAGES = {

    // ── English ────────────────────────────────────────────────────────────────
    en: {
        select_language:
            `*AIGENT · The 1st AI Liquidity Engine*\n\n` +
            `Welcome. Select your language to activate your personal trading AI.`,

        generating_wallet:
            `⚙️ *Initializing your AI engine...*\n\n` +
            `Generating your exclusive non-custodial vault. One moment.`,

        welcome:
            `🧠 *AIGENT : The 1st AI Liquidity Engine*\n\n` +
            `🌃 While you sleep, eat, or live your life — AIGENT hunts the market's money _for you_.\n` +
            `No chart analysis. No all-night monitoring.\n` +
            `A single casual command from you is transformed — in under 1 second — into an *institutional-grade trading algorithm* by the world's most advanced AI engine.\n\n` +
            `⚙️ *How it works:*\n` +
            `[Your words] ➡️ [AI intent parsing] ➡️ [Hyperliquid DEX direct fire ⚡️]\n\n` +
            `💡 *Try commanding it like this:*\n\n` +
            `🍔 _"I'm going to grab lunch — set up 20 grid traps on ETH between $2,800 and $3,200 and bleed the market dry while I'm gone"_\n` +
            `👉 Grid bot configured. 20 orders placed. Automated.\n\n` +
            `🚀 _"The moment Bitcoin cracks $100K, dump 50% of my balance into a 10x long and ride it"_\n` +
            `👉 Price watcher armed. Breakout bot on standby.\n\n` +
            `🛡️ _"Market feels shaky. Every time SOL dumps below RSI 30, buy $100. Three times. DCA me in quietly"_\n` +
            `👉 Smart DCA bot activated.\n\n` +
            `🏦 *Your exclusive AI execution vault (100% non-custodial):*\n` +
            `\`{{wallet}}\`\n` +
            `_(Tap to copy)_\n\n` +
            `⚡️ *It's time to awaken your AI:*\n` +
            `1️⃣ Load USDC into the address above via the *Arbitrum* network.\n` +
            `2️⃣ Once funds are confirmed, issue your first command below.\n\n` +
            `⚠️ *Security:* This vault is under your control alone. Withdraw to any external wallet anytime via /withdraw.`,

        help:
            `📖 *AIGENT Command Reference*\n\n` +
            `*/dashboard [ASSET]* — Live Bloomberg terminal\n` +
            `*/withdraw* — Withdrawal guide\n` +
            `*/export_key* — Private key backup (MetaMask)\n` +
            `*/wallet* — Your wallet address\n` +
            `*/history* — Recent trades\n` +
            `*/cancelgrid* — Stop active grid\n` +
            `*/language* — Change language\n\n` +
            `*Examples:*\n` +
            `• "Market buy ETH $500 10x leverage"\n` +
            `• "ETH grid $2800–$3200, 20 grids, $1000"\n` +
            `• "Buy $100 BTC if drops 5%"`,

        wallet_header: `🏦 *Your AIGENT Vault:*\n\`{{wallet}}\``,
        error_no_user: `⚠️ Account not found. Use /start to activate your AI.`,
        error_generic: `❌ An error occurred. Please try again.`,
        parse_error: `❌ *Could not parse intent.*\n\n{{error}}\n\nTry: _"Market buy ETH $200 at 10x"_`,
        trade_configured: `✅ *Trade Configured [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *Incomplete intent.* Provide: action, asset, amount, condition.\n\nExample: _"Buy $100 ETH if it drops 5%"_`,
        stop_dashboard: `Dashboard stopped. Use /dashboard to restart.`,
        no_grid: `No active grid session found.`,
        grid_cancelled: `🛑 *Grid Stopped*\n\nAsset: *{{asset}}*\n\n_Open orders must be cancelled via Hyperliquid UI._`,

        btn_dashboard: `📊 Dashboard`,
        btn_withdraw: `💸 Withdraw`,
        btn_settings: `⚙️ Settings & Key`,

        withdraw_title: `💸 *Withdraw Funds*`,
        withdraw_body:
            `Your vault holds funds on Arbitrum / Hyperliquid.\n\n` +
            `*Vault address:* \`{{wallet}}\`\n\n` +
            `To withdraw:\n` +
            `1. Open the [Hyperliquid App](https://app.hyperliquid.xyz)\n` +
            `2. Connect this wallet address\n` +
            `3. Use Withdraw → Arbitrum to move USDC to any address\n\n` +
            `_Native in-bot withdrawals coming in v3.0._`,

        export_key_title: `🔑 *Private Key Backup*`,
        export_key_warning:
            `⚠️ *Security Warning*\n\n` +
            `Your private key grants *full access* to your vault.\n` +
            `*Never share it with anyone.*\n\n` +
            `Tap the button below to reveal. Auto-deletes in 60 seconds.`,
        export_key_confirm: `[ Reveal My Private Key ]`,
        export_key_value:
            `🔑 *Your Private Key*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ Import this into MetaMask or any EVM wallet.\n` +
            `_Self-destructs in 60 seconds._`,
    },

    // ── Korean ─────────────────────────────────────────────────────────────────
    ko: {
        select_language:
            `*AIGENT · The 1st AI Liquidity Engine*\n\n` +
            `당신의 AI 트레이딩 엔진을 활성화할 언어를 선택하세요.`,

        generating_wallet:
            `⚙️ *AI 엔진을 초기화하는 중...*\n\n` +
            `전용 Non-custodial 금고를 생성하고 있습니다. 잠시만요.`,

        welcome:
            `🧠 *AIGENT : The 1st AI Liquidity Engine*\n\n` +
            `🌃 당신이 잠든 새벽 3시에도, 밥을 먹는 순간에도 — AIGENT는 당신을 위해 시장의 돈을 사냥합니다.\n` +
            `복잡한 차트 분석과 밤샘 모니터링은 이제 AI에게 넘기십시오.\n` +
            `당신이 카톡 하듯 툭 던진 일상적인 명령이, 세계 최고 수준의 AI 엔진을 거쳐 *1초 만에 기관급 트레이딩 알고리즘*으로 변환됩니다.\n\n` +
            `⚙️ *어떻게 작동하나요?*\n` +
            `[당신의 한마디] ➡️ [AI의 완벽한 의도 파싱] ➡️ [Hyperliquid DEX 다이렉트 타격 ⚡️]\n\n` +
            `💡 *이렇게 명령해 보세요:*\n\n` +
            `🍔 _"나 점심 먹고 올 테니까, 이더리움 2800불에서 3200불 사이에 20개 그물 쳐서 알아서 발라먹고 있어"_\n` +
            `👉 그리드봇 설정 완료. 20개 주문 자동 발사. 끝.\n\n` +
            `🚀 _"비트코인 6만불 돌파하는 순간, 내 지갑 잔고 50% 털어서 10배 레버리지 롱으로 따라붙어"_\n` +
            `👉 가격 감시 시작. 돌파 매매 봇 대기 완료.\n\n` +
            `🛡️ _"장 안 좋아서 쫄리니까, 솔라나 RSI 30 밑으로 떡락할 때마다 100달러씩 3번 쪼개서 주워 담아줘"_\n` +
            `👉 스마트 분할매수(DCA) 봇 가동.\n\n` +
            `🏦 *당신의 전용 AI 실행 금고 (100% Non-custodial):*\n` +
            `\`{{wallet}}\`\n` +
            `_(탭하여 복사)_\n\n` +
            `⚡️ *자, 이제 당신만의 AI를 깨울 시간입니다:*\n` +
            `1️⃣ 위 주소로 *Arbitrum 네트워크*를 통해 USDC를 장전하십시오.\n` +
            `2️⃣ 총알이 확인되는 즉시, 채팅창에 명령을 하달하십시오.\n\n` +
            `⚠️ *보안 안내:* 본 금고는 오직 당신의 통제 하에 있습니다. /withdraw 버튼을 통해 언제든 외부 지갑으로 전액 출금이 가능합니다.`,

        help:
            `📖 *AIGENT 명령어 목록*\n\n` +
            `*/dashboard [자산]* — 실시간 터미널\n` +
            `*/withdraw* — 출금 안내\n` +
            `*/export_key* — 프라이빗 키 백업\n` +
            `*/wallet* — 내 금고 주소\n` +
            `*/history* — 최근 거래 내역\n` +
            `*/cancelgrid* — 그리드봇 중지\n` +
            `*/language* — 언어 변경\n\n` +
            `*명령 예시:*\n` +
            `• "ETH 500달러 10배 시장가 매수"\n` +
            `• "이더 2800~3200 그리드봇 20개 1000달러"\n` +
            `• "BTC 5% 빠지면 100달러 받아"`,

        wallet_header: `🏦 *내 AI 실행 금고:*\n\`{{wallet}}\``,
        error_no_user: `⚠️ 계정 없음. /start 로 AI를 먼저 활성화하세요.`,
        error_generic: `❌ 오류가 발생했습니다. 다시 시도해 주세요.`,
        parse_error: `❌ *명령을 파싱하지 못했습니다.*\n\n{{error}}\n\n예시: _"ETH 200달러 10배 시장가 매수"_`,
        trade_configured: `✅ *주문 설정 완료 [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *정보 부족.* 행동, 자산, 금액, 조건을 입력해 주세요.\n\n예시: _"ETH 5% 하락 시 100달러 매수"_`,
        stop_dashboard: `대시보드 중지. /dashboard 로 재시작 가능.`,
        no_grid: `활성화된 그리드 세션이 없습니다.`,
        grid_cancelled: `🛑 *그리드봇 중지됨*\n\n자산: *{{asset}}*\n\n_미체결 주문은 Hyperliquid UI에서 직접 취소해 주세요._`,

        btn_dashboard: `📊 대시보드`,
        btn_withdraw: `💸 출금하기`,
        btn_settings: `⚙️ 세팅 및 키 백업`,

        withdraw_title: `💸 *출금하기*`,
        withdraw_body:
            `AIGENT 금고의 자금은 Arbitrum / Hyperliquid에 있습니다.\n\n` +
            `*금고 주소:* \`{{wallet}}\`\n\n` +
            `출금 방법:\n` +
            `1. [Hyperliquid 앱](https://app.hyperliquid.xyz)을 여세요\n` +
            `2. 위 지갑 주소를 연결하세요\n` +
            `3. Withdraw → Arbitrum으로 원하는 주소에 USDC를 전송하세요\n\n` +
            `_인봇 출금 기능은 v3.0에서 지원 예정입니다._`,

        export_key_title: `🔑 *프라이빗 키 백업*`,
        export_key_warning:
            `⚠️ *보안 경고*\n\n` +
            `프라이빗 키는 금고의 *모든 자산에 대한 완전한 접근 권한*입니다.\n` +
            `*절대 타인과 공유하지 마세요.*\n\n` +
            `아래 버튼을 눌러 키를 확인하세요. 60초 후 자동 폭파됩니다.`,
        export_key_confirm: `[ 프라이빗 키 확인 ]`,
        export_key_value:
            `🔑 *프라이빗 키*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ MetaMask 또는 EVM 지갑에 가져오세요.\n` +
            `_이 메시지는 60초 후 자동 소멸됩니다._`,
    },

    // ── Spanish ────────────────────────────────────────────────────────────────
    es: {
        select_language:
            `*AIGENT · The 1st AI Liquidity Engine*\n\n` +
            `Selecciona tu idioma para activar tu IA de trading personal.`,

        generating_wallet:
            `⚙️ *Inicializando tu motor de IA...*\n\n` +
            `Generando tu bóveda de ejecución exclusiva. Un momento.`,

        welcome:
            `🧠 *AIGENT : The 1st AI Liquidity Engine*\n\n` +
            `🌃 A las 3 de la madrugada mientras duermes, mientras comes — AIGENT caza el dinero del mercado _para ti_.\n` +
            `Sin análisis de gráficos. Sin noches en vela.\n` +
            `Una orden casual tuya se transforma — en menos de 1 segundo — en un *algoritmo de trading institucional* mediante el motor de IA más avanzado del mundo.\n\n` +
            `⚙️ *¿Cómo funciona?*\n` +
            `[Tus palabras] ➡️ [Parsing de intención con IA] ➡️ [Ataque directo a Hyperliquid DEX ⚡️]\n\n` +
            `💡 *Intenta comandarlo así:*\n\n` +
            `🍔 _"Voy a almorzar — coloca 20 trampas de grid en ETH entre $2,800 y $3,200 y desangra el mercado mientras no estoy"_\n` +
            `👉 Grid bot configurado. 20 órdenes ejecutadas. Automático.\n\n` +
            `🚀 _"En el momento que Bitcoin supere los $100K, toma el 50% de mi balance y mete un long con 10x de apalancamiento"_\n` +
            `👉 Vigilante de precio armado. Bot de ruptura en espera.\n\n` +
            `🛡️ _"El mercado está inestable. Cada vez que SOL caiga bajo RSI 30, compra $100. Tres veces. DCA silencioso."_\n` +
            `👉 Bot DCA inteligente activado.\n\n` +
            `🏦 *Tu bóveda de ejecución IA exclusiva (100% non-custodial):*\n` +
            `\`{{wallet}}\`\n` +
            `_(Toca para copiar)_\n\n` +
            `⚡️ *Es hora de despertar tu IA:*\n` +
            `1️⃣ Carga USDC en la dirección de arriba via red *Arbitrum*.\n` +
            `2️⃣ Cuando los fondos estén confirmados, envía tu primer comando.\n\n` +
            `⚠️ *Seguridad:* Esta bóveda está bajo tu control exclusivo. Retira a cualquier billetera externa cuando quieras con /withdraw.`,

        help:
            `📖 *Referencia de comandos AIGENT*\n\n` +
            `*/dashboard [ACTIVO]* — Terminal en vivo\n` +
            `*/withdraw* — Guía de retiro\n` +
            `*/export_key* — Copia de clave privada\n` +
            `*/wallet* — Tu dirección de bóveda\n` +
            `*/history* — Operaciones recientes\n` +
            `*/cancelgrid* — Detener grid activo\n` +
            `*/language* — Cambiar idioma\n\n` +
            `*Ejemplos:*\n` +
            `• "Comprar ETH $500 con 10x al mercado"\n` +
            `• "Grid ETH $2800–$3200, 20 niveles, $1000"\n` +
            `• "Comprar BTC $100 si cae 5%"`,

        wallet_header: `🏦 *Tu Bóveda AIGENT:*\n\`{{wallet}}\``,
        error_no_user: `⚠️ Cuenta no encontrada. Usa /start para activar tu IA.`,
        error_generic: `❌ Ocurrió un error. Por favor, inténtalo de nuevo.`,
        parse_error: `❌ *No se pudo interpretar el comando.*\n\n{{error}}\n\nIntenta: _"Comprar ETH $200 con 10x al mercado"_`,
        trade_configured: `✅ *Operación configurada [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *Comando incompleto.* Proporciona: acción, activo, monto y condición.\n\nEjemplo: _"Comprar $100 ETH si cae 5%"_`,
        stop_dashboard: `Panel detenido. Usa /dashboard para reiniciar.`,
        no_grid: `No se encontró ninguna sesión de grid activa.`,
        grid_cancelled: `🛑 *Grid Detenido*\n\nActivo: *{{asset}}*\n\n_Las órdenes abiertas deben cancelarse en Hyperliquid._`,

        btn_dashboard: `📊 Panel en Vivo`,
        btn_withdraw: `💸 Retirar`,
        btn_settings: `⚙️ Config & Clave`,

        withdraw_title: `💸 *Retirar Fondos*`,
        withdraw_body:
            `Tu bóveda tiene fondos en Arbitrum / Hyperliquid.\n\n` +
            `*Dirección:* \`{{wallet}}\`\n\n` +
            `Para retirar:\n` +
            `1. Abre la [App de Hyperliquid](https://app.hyperliquid.xyz)\n` +
            `2. Conecta esta dirección\n` +
            `3. Usa Retirar → Arbitrum para mover USDC\n\n` +
            `_Retiros directos en v3.0._`,

        export_key_title: `🔑 *Copia de Seguridad de Clave Privada*`,
        export_key_warning:
            `⚠️ *Advertencia de Seguridad*\n\n` +
            `Tu clave privada otorga *acceso total* a tu bóveda.\n` +
            `*Nunca la compartas con nadie.*\n\n` +
            `Toca el botón para revelarla. Autodestrucción en 60 segundos.`,
        export_key_confirm: `[ Revelar Mi Clave Privada ]`,
        export_key_value:
            `🔑 *Tu Clave Privada*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ Impórtala a MetaMask o cualquier billetera EVM.\n` +
            `_Se autodestruirá en 60 segundos._`,
    },

    // ── Chinese ────────────────────────────────────────────────────────────────
    zh: {
        select_language:
            `*AIGENT · The 1st AI Liquidity Engine*\n\n` +
            `请选择语言以激活您的专属 AI 交易引擎。`,

        generating_wallet:
            `⚙️ *正在初始化您的 AI 引擎...*\n\n` +
            `正在生成您的专属非托管金库，请稍候。`,

        welcome:
            `🧠 *AIGENT : The 1st AI Liquidity Engine*\n\n` +
            `🌃 当你熟睡的凌晨三点，当你吃饭的那一刻 — AIGENT 正在为你猎取市场的财富。\n` +
            `无需复杂的图表分析，无需彻夜盯盘。\n` +
            `你随口一句命令，经过全球最先进的 AI 引擎，*不到 1 秒* 即转化为机构级交易算法。\n\n` +
            `⚙️ *运作方式：*\n` +
            `[你的话语] ➡️ [AI 意图解析] ➡️ [Hyperliquid DEX 直接执行 ⚡️]\n\n` +
            `💡 *试着这样下命令：*\n\n` +
            `🍔 _"我去吃个午饭，在以太坊 2800 到 3200 之间布 20 个网格陷阱，给我把钱捞回来"_\n` +
            `👉 网格机器人配置完成，20 笔订单自动执行。\n\n` +
            `🚀 _"比特币一破 10 万美元，立刻用我账户余额的 50% 开 10 倍多单追涨"_\n` +
            `👉 价格监控启动，突破交易机器人待命。\n\n` +
            `🛡️ _"行情不好有点慌，Solana 每次跌破 RSI 30，就帮我买 100 美元，分三次，悄悄买入"_\n` +
            `👉 智能分批定投机器人激活。\n\n` +
            `🏦 *您的专属 AI 执行金库（100% 非托管）：*\n` +
            `\`{{wallet}}\`\n` +
            `_(点击复制)_\n\n` +
            `⚡️ *是时候唤醒您的专属 AI 了：*\n` +
            `1️⃣ 通过 *Arbitrum 网络* 将 USDC 充入上方地址。\n` +
            `2️⃣ 资金确认后，在聊天框输入您的第一条命令。\n\n` +
            `⚠️ *安全提示：* 此金库完全由您掌控。随时可通过 /withdraw 提款至任意外部钱包。`,

        help:
            `📖 *AIGENT 指令参考*\n\n` +
            `*/dashboard [标的]* — 实时彭博终端\n` +
            `*/withdraw* — 提款指南\n` +
            `*/export_key* — 私钥备份\n` +
            `*/wallet* — 金库地址\n` +
            `*/history* — 近期交易\n` +
            `*/cancelgrid* — 停止网格策略\n` +
            `*/language* — 更改语言\n\n` +
            `*示例：*\n` +
            `• "市价买入 ETH 500 美元，10 倍杠杆"\n` +
            `• "ETH 2800–3200 网格，20 格，1000 美元"\n` +
            `• "如果 BTC 跌 5% 则买入 100 美元"`,

        wallet_header: `🏦 *您的 AIGENT 金库：*\n\`{{wallet}}\``,
        error_no_user: `⚠️ 未找到账户。请使用 /start 激活您的 AI。`,
        error_generic: `❌ 发生错误，请重试。`,
        parse_error: `❌ *无法解析意图。*\n\n{{error}}\n\n请尝试：_"市价买入 ETH 200 美元，10 倍杠杆"_`,
        trade_configured: `✅ *交易已配置 [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *指令不完整。* 请提供：操作、标的、金额和条件。\n\n示例：_"如果 ETH 跌 5% 则买入 100 美元"_`,
        stop_dashboard: `终端已停止。使用 /dashboard 重新启动。`,
        no_grid: `未找到活跃的网格会话。`,
        grid_cancelled: `🛑 *网格已停止*\n\n标的：*{{asset}}*\n\n_未成交订单需在 Hyperliquid 界面手动取消。_`,

        btn_dashboard: `📊 实时终端`,
        btn_withdraw: `💸 提款`,
        btn_settings: `⚙️ 设置和密钥`,

        withdraw_title: `💸 *提款*`,
        withdraw_body:
            `您的金库资金存放在 Arbitrum / Hyperliquid 上。\n\n` +
            `*金库地址：* \`{{wallet}}\`\n\n` +
            `提款方法：\n` +
            `1. 打开 [Hyperliquid 应用](https://app.hyperliquid.xyz)\n` +
            `2. 连接金库地址\n` +
            `3. 使用提款 → Arbitrum 转移 USDC\n\n` +
            `_机器人内提款功能将在 v3.0 上线。_`,

        export_key_title: `🔑 *私钥备份*`,
        export_key_warning:
            `⚠️ *安全警告*\n\n` +
            `私钥可完全控制您金库中的所有资产。\n` +
            `*切勿与任何人共享。*\n\n` +
            `点击下方按钮查看私钥。60 秒后自动销毁。`,
        export_key_confirm: `[ 查看我的私钥 ]`,
        export_key_value:
            `🔑 *您的私钥*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ 导入 MetaMask 或任何 EVM 钱包。\n` +
            `_此消息将在 60 秒后自动销毁。_`,
    },

    // ── Japanese ───────────────────────────────────────────────────────────────
    ja: {
        select_language:
            `*AIGENT · The 1st AI Liquidity Engine*\n\n` +
            `あなた専用のAIトレーディングエンジンを起動する言語を選択してください。`,

        generating_wallet:
            `⚙️ *AIエンジンを初期化中...*\n\n` +
            `専用の非カストディアル金庫を生成しています。少々お待ちください。`,

        welcome:
            `🧠 *AIGENT : The 1st AI Liquidity Engine*\n\n` +
            `🌃 あなたが眠る深夜3時も、食事をするその瞬間も — AGIENTはあなたのために市場のお金を狩り続けます。\n` +
            `複雑なチャート分析も、徹夜の監視も、もう必要ありません。\n` +
            `あなたの何気ない一言が、世界最高水準のAIエンジンを経由して、*1秒以内に機関投資家レベルのトレーディングアルゴリズム*へと変換されます。\n\n` +
            `⚙️ *仕組み：*\n` +
            `[あなたの言葉] ➡️ [AI意図解析] ➡️ [Hyperliquid DEX 直接実行 ⚡️]\n\n` +
            `💡 *こんな風に命令してみてください：*\n\n` +
            `🍔 _"昼食に行ってくるから、ETHを$2,800〜$3,200の間に20枚の罠を仕掛けて、利益を稼いでおいて"_\n` +
            `👉 グリッドボット設定完了。注文20件を自動発射。\n\n` +
            `🚀 _"ビットコインが$100Kを突破した瞬間、残高の50%で10倍ロングを仕掛けてついてこい"_\n` +
            `👉 価格監視起動。ブレイクアウトボット待機完了。\n\n` +
            `🛡️ _"相場が不安定で怖い。SOLがRSI 30を下回るたびに$100を3回に分けて静かに拾っておいて"_\n` +
            `👉 スマートDCAボット起動。\n\n` +
            `🏦 *あなた専用のAI実行金庫（100% 非カストディアル）：*\n` +
            `\`{{wallet}}\`\n` +
            `_(タップしてコピー)_\n\n` +
            `⚡️ *さあ、あなただけのAIを目覚めさせる時です：*\n` +
            `1️⃣ 上記アドレスへ *Arbitrumネットワーク* 経由でUSDCを装填してください。\n` +
            `2️⃣ 入金確認後、チャット欄に最初の命令を下してください。\n\n` +
            `⚠️ *セキュリティ：* この金庫はあなただけの管理下にあります。/withdraw でいつでも外部ウォレットへ全額出金できます。`,

        help:
            `📖 *AIGENTコマンド一覧*\n\n` +
            `*/dashboard [銘柄]* — リアルタイムターミナル\n` +
            `*/withdraw* — 出金ガイド\n` +
            `*/export_key* — 秘密鍵バックアップ\n` +
            `*/wallet* — 金庫アドレス確認\n` +
            `*/history* — 最近の取引\n` +
            `*/cancelgrid* — グリッド停止\n` +
            `*/language* — 言語変更\n\n` +
            `*コマンド例：*\n` +
            `• "ETHを$500、10倍でマーケット買い"\n` +
            `• "ETHグリッド $2800〜$3200、20本、$1000"\n` +
            `• "BTCが5%下落したら$100買い"`,

        wallet_header: `🏦 *あなたのAIGENT金庫：*\n\`{{wallet}}\``,
        error_no_user: `⚠️ アカウントが見つかりません。/start でAIを起動してください。`,
        error_generic: `❌ エラーが発生しました。もう一度お試しください。`,
        parse_error: `❌ *コマンドを解析できませんでした。*\n\n{{error}}\n\n例: _"ETHを$200、10倍でマーケット買い"_`,
        trade_configured: `✅ *注文設定完了 [#{{id}}]*\n{{summary}}`,
        incomplete_intent: `⚠️ *コマンドが不完全です。* アクション、銘柄、金額、条件を入力してください。\n\n例: _"ETHが5%下落したら$100買い"_`,
        stop_dashboard: `ダッシュボードを停止しました。/dashboard で再起動できます。`,
        no_grid: `アクティブなグリッドセッションが見つかりません。`,
        grid_cancelled: `🛑 *グリッド停止*\n\n銘柄: *{{asset}}*\n\n_未約定注文はHyperliquid UIから手動でキャンセルしてください。_`,

        btn_dashboard: `📊 ダッシュボード`,
        btn_withdraw: `💸 出金する`,
        btn_settings: `⚙️ 設定と鍵`,

        withdraw_title: `💸 *出金*`,
        withdraw_body:
            `あなたの金庫のUSDCはArbitrum / Hyperliquidにあります。\n\n` +
            `*金庫アドレス：* \`{{wallet}}\`\n\n` +
            `出金手順：\n` +
            `1. [Hyperliquidアプリ](https://app.hyperliquid.xyz)を開く\n` +
            `2. 上記アドレスで接続する\n` +
            `3. 出金 → Arbitrum でUSDCを任意のアドレスへ送金\n\n` +
            `_ボット内出金機能はv3.0で対応予定。_`,

        export_key_title: `🔑 *秘密鍵バックアップ*`,
        export_key_warning:
            `⚠️ *セキュリティ警告*\n\n` +
            `秘密鍵は金庫への*完全なアクセス権*を持ちます。\n` +
            `*絶対に他人と共有しないでください。*\n\n` +
            `下のボタンをタップして鍵を表示。60秒後に自動消滅します。`,
        export_key_confirm: `[ 秘密鍵を表示する ]`,
        export_key_value:
            `🔑 *あなたの秘密鍵*\n\n` +
            `\`{{pk}}\`\n\n` +
            `⚠️ MetaMaskまたは任意のEVMウォレットにインポートしてください。\n` +
            `_このメッセージは60秒後に自動消滅します。_`,
    },
};
