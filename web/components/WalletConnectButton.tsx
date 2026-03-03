'use client';

/**
 * NexusSphere - Connect Wallet Button
 * Thin wrapper around RainbowKit's ConnectButton with custom styling.
 */
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletConnectButton() {
    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
            }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus || authenticationStatus === 'authenticated');

                return (
                    <div
                        {...(!ready && {
                            'aria-hidden': true,
                            style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        className="px-6 py-3 rounded-lg font-semibold text-sm border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-dark-bg transition-all duration-300 border-glow-cyan"
                                    >
                                        Connect Wallet
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        className="px-6 py-3 rounded-lg font-semibold text-sm border border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300"
                                    >
                                        Wrong Network
                                    </button>
                                );
                            }

                            return (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={openChainModal}
                                        className="px-4 py-2 rounded-lg text-xs font-medium border border-dark-border text-slate-400 hover:border-neon-cyan hover:text-neon-cyan transition-all duration-300"
                                    >
                                        {chain.hasIcon && chain.iconUrl && (
                                            <img
                                                alt={chain.name ?? 'Chain icon'}
                                                src={chain.iconUrl}
                                                className="w-4 h-4 inline mr-1"
                                            />
                                        )}
                                        {chain.name}
                                    </button>

                                    <button
                                        onClick={openAccountModal}
                                        className="px-6 py-2 rounded-lg text-sm font-semibold border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-dark-bg transition-all duration-300"
                                    >
                                        {account.displayName}
                                        {account.displayBalance ? ` (${account.displayBalance})` : ''}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}
