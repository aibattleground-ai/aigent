'use client';

/**
 * NexusSphere - Web3 Providers
 * Wraps children in WagmiProvider, QueryClientProvider, and RainbowKitProvider.
 */
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, polygon, arbitrum, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    RainbowKitProvider,
    getDefaultConfig,
    darkTheme,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const config = getDefaultConfig({
    appName: 'NexusSphere',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'nexussphere-demo',
    chains: [mainnet, polygon, arbitrum, base],
    transports: {
        [mainnet.id]: http(),
        [polygon.id]: http(),
        [arbitrum.id]: http(),
        [base.id]: http(),
    },
    ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#00f5ff',
                        accentColorForeground: '#0a0a0f',
                        borderRadius: 'medium',
                    })}
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
