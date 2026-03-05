'use client';
import Link from 'next/link';
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
            className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
            style={{
                background: scrolled ? 'rgba(8,8,9,0.92)' : 'transparent',
                borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
                backdropFilter: scrolled ? 'blur(12px)' : 'none',
                WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
                padding: '18px 0',
            }}
        >
            <div className="max-w-7xl mx-auto px-8 lg:px-16 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div
                        className="w-8 h-8 cut-corner-sm flex items-center justify-center"
                        style={{ border: '1px solid rgba(0,229,200,0.2)', background: 'rgba(0,229,200,0.06)' }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#00e5c8" strokeWidth="1.5" strokeLinejoin="round" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#00e5c8" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="font-display font-bold text-white tracking-tight">
                        AI<span style={{ color: 'var(--accent)' }}>GENT</span>
                    </span>
                    <span
                        className="font-mono-custom text-xs hidden sm:block"
                        style={{ color: 'var(--text-400)', letterSpacing: '0.1em' }}
                    >
                        // PROTOCOL
                    </span>
                </Link>

                {/* Nav links */}
                <div className="hidden md:flex items-center gap-8">
                    {[
                        { label: 'Architecture', href: '/#architecture' },
                        { label: 'Tokenomics', href: '/#tokenomics' },
                        { label: 'Security', href: '/#security' },
                        { label: 'Roadmap', href: '/#roadmap' },
                        { label: 'Dashboard', href: '/dashboard' },
                    ].map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="font-mono-custom text-xs tracking-widest uppercase transition-colors duration-200"
                            style={{ color: 'var(--text-400)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-200)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-400)')}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* CTA */}
                <button className="btn-primary" style={{ padding: '10px 22px', fontSize: '10px' }}>
                    Stake to Access Beta →
                </button>
            </div>
        </nav>
    );
}
