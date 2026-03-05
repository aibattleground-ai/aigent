import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `You are a financial intent parser for a crypto trading agent called AIGENT.
Your job is to extract structured trading parameters from natural language. You must understand multiple languages, especially Korean and English.

Extract the following fields:
- "action": must be "buy" or "sell"
- "asset": the crypto ticker symbol (e.g., "BTC", "ETH", "SOL", "DOGE"). Translate common names to tickers.
- "amount": a numeric value in USD (e.g., 500) OR a string representing percentage of portfolio (e.g., "30% of wallet USDT")
- "condition": the trigger condition as a string (e.g., "price drops below $70,000", "immediately", "when Elon Musk tweets keyword $DOGE on Twitter")

Return ONLY a valid JSON object with these exact keys. Do not include any explanation.
If you cannot parse a valid intent, return: {"error": "Could not parse intent"}`;

export async function parseIntent(userMessage: string) {
    if (!process.env.ANTHROPIC_API_KEY) {
        return { error: 'ANTHROPIC_API_KEY is not configured on the server.' };
    }

    try {
        const message = await client.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-latest',
            max_tokens: 256,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: userMessage },
            ],
        });

        const textBlock = message.content.find(c => c.type === 'text');
        const raw = textBlock?.type === 'text' ? textBlock.text.trim() : '';

        try {
            return JSON.parse(raw);
        } catch (parseErr) {
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            } else {
                return { error: 'Claude failed to return structured data. Raw output: ' + raw };
            }
        }
    } catch (err: any) {
        console.error('[LLM] Error parsing intent:', err.message || err);
        return { error: 'Claude parsing failed. Detail: ' + (err.message || 'Unknown error') };
    }
}
