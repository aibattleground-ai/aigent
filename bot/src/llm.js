/**
 * AIGENT - Claude AI Intent Parser
 * Uses Anthropic Claude to extract structured trading intents from natural language.
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * System prompt instructing Claude to act as a financial intent parser.
 * Returns ONLY valid JSON — no explanations, no markdown.
 */
const SYSTEM_PROMPT = `You are a financial intent parser for a crypto trading agent called AIGENT.
Your job is to extract structured trading parameters from natural language. You must understand multiple languages, especially Korean and English.

Extract the following fields:
- "action": must be "buy" or "sell"
- "asset": the crypto ticker symbol (e.g., "BTC", "ETH", "SOL"). Translate common names like "비트코인" to "BTC", "이더리움" to "ETH".
- "amount": a numeric value in USD (e.g., 500)
- "condition": the trigger condition as a string (e.g., "price drops below $70,000", "immediately", "7만불 아래로 떨어지면")

Return ONLY a valid JSON object with these exact keys. Do not include any explanation, markdown formatting blocks (like \`\`\`json), or extra text.
If you cannot parse a valid intent, return: {"error": "Could not parse intent"}

Example input (English): "Buy $100 of ETH if it drops 5%"
Example output: {"action":"buy","asset":"ETH","amount":100,"condition":"price drops 5%"}

Example input (Korean): "500달러치 비트코인 7만불 아래로 떨어지면 매수해줘"
Example output: {"action":"buy","asset":"BTC","amount":500,"condition":"price drops below $70000"}`;

/**
 * Parses natural language text into a structured trading intent JSON.
 * @param {string} userMessage - The raw user message from Telegram.
 * @returns {Promise<Object>} - Parsed intent object or an error object.
 */
export async function parseIntent(userMessage) {
    try {
        const message = await client.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
            max_tokens: 256,
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
