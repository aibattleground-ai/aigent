import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
    title: 'AIGENT — AI-Powered Crypto Trading Agent',
    description: 'Trade crypto with natural language. AIGENT is an intent-centric AI financial agent powered by Claude AI.',
    keywords: ['AI trading', 'crypto', 'DeFi', 'blockchain', 'intent trading', 'Claude AI'],
    openGraph: {
        title: 'AIGENT — AI-Powered Crypto Trading Agent',
        description: 'Trade crypto with natural language, powered by Claude AI.',
        type: 'website',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
