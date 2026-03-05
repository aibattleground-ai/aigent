/**
 * AIGENT - Claude AI Intent Parser
 * Handles both simple trade intents and advanced strategy intents (grid, DCA, etc.)
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * System prompt instructing Claude to parse both simple trades AND advanced strategies.
 * Returns ONLY valid JSON — no explanations, no markdown.
 */
const SYSTEM_PROMPT = `You are a financial intent parser for a crypto trading agent called AIGENT.
Your job is to extract structured trading parameters from natural language. You must understand multiple languages, especially Korean and English.

You can parse TWO types of trading intents:

━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPE 1: Simple Trade
━━━━━━━━━━━━━━━━━━━━━━━━━━
Fields to extract:
- "strategy": "simple"
- "action": "buy" or "sell"
- "asset": crypto ticker (e.g. "BTC", "ETH", "SOL"). Translate: 비트코인→BTC, 이더리움→ETH, 솔라나→SOL
- "amount": numeric USD value (e.g. 500)
- "condition": trigger condition as a string (e.g. "price drops below $70,000", "immediately")

Example input: "Buy $100 of ETH if it drops 5%"
Example output: {"strategy":"simple","action":"buy","asset":"ETH","amount":100,"condition":"price drops 5%"}

Example input (Korean): "500달러치 비트코인 7만불 아래로 떨어지면 매수해줘"
Example output: {"strategy":"simple","action":"buy","asset":"BTC","amount":500,"condition":"price drops below $70000"}

━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPE 2: Grid Bot Strategy
━━━━━━━━━━━━━━━━━━━━━━━━━━
Triggered when user mentions: grid, 그리드, range trading, 레인지, 구간 매매, grid bot, 그리드봇
Fields to extract:
- "strategy": "grid"
- "asset": crypto ticker
- "lower_price": lower bound of grid range (number, USD)
- "upper_price": upper bound of grid range (number, USD)
- "grid_count": number of grid levels (integer, default 10 if not specified)
- "total_usdc": total USDC capital to deploy (number)

Example input: "Set up a grid on ETH between $2800 and $3200 with 20 grids using $1000"
Example output: {"strategy":"grid","asset":"ETH","lower_price":2800,"upper_price":3200,"grid_count":20,"total_usdc":1000}

Example input (Korean): "이더리움 2800달러에서 3200달러 사이 그리드봇 20개 격자로 1000달러 운용해줘"
Example output: {"strategy":"grid","asset":"ETH","lower_price":2800,"upper_price":3200,"grid_count":20,"total_usdc":1000}

Example input (Korean): "BTC 6만에서 7만 사이 그리드 10개 500불"
Example output: {"strategy":"grid","asset":"BTC","lower_price":60000,"upper_price":70000,"grid_count":10,"total_usdc":500}

━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES:
- Return ONLY valid JSON. No markdown, no explanation, no code blocks.
- If you cannot parse the intent, return: {"error": "Could not parse intent"}
- Always include the "strategy" field in your response.
- For grid intents, never include "action" or "condition" fields.
- For simple trade intents, never include grid fields.`;

/**
 * Parses natural language text into a structured trading intent JSON.
 * @param {string} userMessage - The raw user message from Telegram.
 * @returns {Promise<Object>} - Parsed intent object or an error object.
 */
export async function parseIntent(userMessage) {
    try {
        const message = await client.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
            max_tokens: 512,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: userMessage },
            ],
        });

        const raw = message.content[0].text.trim();

        try {
            return JSON.parse(raw);
        } catch (parseErr) {
            // Fallback: extract JSON from markdown or mixed text
            console.log('[LLM] Parsing raw text failed, attempting regex extraction:', raw);
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            } else {
                return { error: 'Claude failed to return structured data. Raw output: ' + raw };
            }
        }
    } catch (err) {
        console.error('[LLM] Error parsing intent:', err.message || err);
        return { error: 'Claude parsing failed. Please try again. Detail: ' + (err.message || 'Unknown error') };
    }
}
