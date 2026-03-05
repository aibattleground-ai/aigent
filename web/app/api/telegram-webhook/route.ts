import { NextResponse } from 'next/server';
import { bot } from '@/lib/telegram/bot';

export const maxDuration = 60; // Max duration for Vercel Hobby is 10s, Pro is 60s
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not set' }, { status: 500 });
        }

        const body = await req.json();

        // Pass the request to Telegraf
        await bot.handleUpdate(body);

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
