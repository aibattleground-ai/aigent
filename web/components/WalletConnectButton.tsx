'use client';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletConnectButton() {
    return (
        <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

                return (
                    <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
                        {!connected ? (
                            <button
                                onClick={openConnectModal}
                                className="btn-shimmer px-5 py-2.5 rounded-full text-sm font-semibold text-ai-bg tracking-wide"
                            >
                                Connect Wallet
                            </button>
                        ) : chain?.unsupported ? (
                            <button
                                onClick={openChainModal}
                                className="px-5 py-2.5 rounded-full text-sm font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-all"
                            >
                                Wrong Network
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={openChainModal}
                                    className="px-3 py-2 rounded-full text-xs font-medium glass text-white/60 hover:text-white transition-all"
                                >
                                    {chain?.name}
                                </button>
                                <button
                                    onClick={openAccountModal}
                                    className="px-4 py-2 rounded-full text-sm font-semibold glass border border-ai-cyan/20 text-ai-cyan hover:border-ai-cyan/50 transition-all"
                                >
                                    {account.displayName}
                                </button>
                            </div>
                        )}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}
