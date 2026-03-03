/**
 * NexusSphere - LLM Intent Parser
 * Uses OpenAI to extract structured trading intents from natural language.
 */
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * System prompt instructing the LLM to act as a financial intent parser.
 * It must return ONLY valid JSON — no explanations, no markdown.
 */
const SYSTEM_PROMPT = `You are a financial intent parser for a crypto trading agent called NexusSphere.
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
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            temperature: 0, // deterministic output
            max_tokens: 256,
        });

        const raw = response.choices[0].message.content.trim();

        // Safely parse the JSON response
        const parsed = JSON.parse(raw);
        return parsed;
    } catch (err) {
        console.error('[LLM] Error parsing intent:', err.message);
        return { error: 'LLM parsing failed. Please try again.' };
    }
}
