'use client';
import Link from 'next/link';
import { WalletConnectButton } from './WalletConnectButton';
import { useState, useEffect } from 'react';

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handler);
        return () => window.removeEventListener('scroll', handler);
    }, []);

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
                    ? 'glass border-b border-white/[0.06] py-3'
                    : 'bg-transparent py-5'
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                {/* ── Logo ─────────────────────────────────────────────────────── */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="relative w-9 h-9">
                        {/* Spinning ring */}
                        <div className="absolute inset-0 rounded-xl border border-ai-cyan/30 animate-spin-slow" />
                        <div className="absolute inset-1 rounded-lg bg-gradient-to-br from-ai-cyan/20 to-ai-purple/20 flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#00f0ff" strokeWidth="1.5" strokeLinejoin="round" />
                                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#00f0ff" strokeWidth="1.5" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                    <span className="font-display font-800 text-xl text-white tracking-tight">
                        AI<span className="text-gradient-cyan">GENT</span>
                    </span>
                </Link>

                {/* ── Nav links ─────────────────────────────────────────────────── */}
                <div className="hidden md:flex items-center gap-8">
                    {[
                        { label: 'Features', href: '/#features' },
                        { label: 'How It Works', href: '/#how' },
                        { label: 'Dashboard', href: '/dashboard' },
                    ].map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="text-sm text-white/50 hover:text-white transition-colors duration-200 tracking-wide"
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* ── CTA ──────────────────────────────────────────────────────── */}
                <div className="flex items-center gap-3">
                    <WalletConnectButton />
                </div>
            </div>
        </nav>
    );
}
