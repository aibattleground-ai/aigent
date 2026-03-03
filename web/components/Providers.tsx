'use client';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, polygon, arbitrum, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const config = getDefaultConfig({
    appName: 'AIGENT',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'aigent-demo',
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
                        accentColor: '#00f0ff',
                        accentColorForeground: '#04040a',
                        borderRadius: 'large',
                        fontStack: 'system',
                        overlayBlur: 'small',
                    })}
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
