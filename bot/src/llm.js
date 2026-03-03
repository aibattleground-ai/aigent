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
Your job is to extract structured trading parameters from natural language.

Extract the following fields:
- "action": must be "buy" or "sell"
- "asset": the crypto ticker symbol (e.g., "BTC", "ETH", "SOL")
- "amount": a numeric value in USD (e.g., 100)
- "condition": the trigger condition as a string (e.g., "price drops 5%", "immediately", "price reaches $50000")

Return ONLY a valid JSON object with these exact keys. Do not include any explanation, markdown, or extra text.
If you cannot parse a valid intent, return: {"error": "Could not parse intent"}

Example input: "Buy $100 of ETH if it drops 5%"
Example output: {"action":"buy","asset":"ETH","amount":100,"condition":"price drops 5%"}`;

/**
 * Parses natural language text into a structured trading intent JSON.
 * @param {string} userMessage - The raw user message from Telegram.
 * @returns {Promise<Object>} - Parsed intent object or an error object.
 */
export async function parseIntent(userMessage) {
    try {
        const message = await client.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 256,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: userMessage },
            ],
        });

        const raw = message.content[0].text.trim();

        // Safely parse the JSON response
        const parsed = JSON.parse(raw);
        return parsed;
    } catch (err) {
        console.error('[LLM] Error parsing intent:', err.message);
        return { error: 'Claude parsing failed. Please try again.' };
    }
}
