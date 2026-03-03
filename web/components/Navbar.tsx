/**
 * NexusSphere - Navbar Component
 */
import Link from 'next/link';
import { WalletConnectButton } from './WalletConnectButton';

export function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-dark-border card-bg">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
                        <span className="text-dark-bg font-black text-sm">N</span>
                    </div>
                    <span className="font-bold text-lg text-white">
                        Nexus<span className="text-neon-cyan">Sphere</span>
                    </span>
                </Link>

                {/* Nav links */}
                <div className="hidden md:flex items-center gap-8">
                    <Link href="/#features" className="text-slate-400 hover:text-neon-cyan transition-colors text-sm">
                        Features
                    </Link>
                    <Link href="/#how-it-works" className="text-slate-400 hover:text-neon-cyan transition-colors text-sm">
                        How It Works
                    </Link>
                    <Link href="/dashboard" className="text-slate-400 hover:text-neon-cyan transition-colors text-sm">
                        Dashboard
                    </Link>
                </div>

                {/* Wallet Connect */}
                <WalletConnectButton />
            </div>
        </nav>
    );
}
