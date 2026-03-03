/**
 * NexusSphere Web - Root Layout
 * Sets up global providers: wagmi, RainbowKit, React Query.
 */
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
    title: 'NexusSphere — AI On-Chain Agent',
    description: 'Intent-Centric AI Financial Agent. Trade crypto with natural language powered by GPT-4.',
    keywords: ['crypto', 'AI trading', 'DeFi', 'blockchain', 'intent trading'],
    openGraph: {
        title: 'NexusSphere — AI On-Chain Agent',
        description: 'Intent-Centric AI Financial Agent',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
