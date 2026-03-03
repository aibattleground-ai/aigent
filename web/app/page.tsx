/**
 * NexusSphere - Landing Page
 * Dark-mode, cyberpunk-styled hero page with features and CTA sections.
 */
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export default function HomePage() {
    return (
        <main className="min-h-screen bg-dark-bg grid-bg">
            <Navbar />

            {/* ── Hero Section ─────────────────────────────────────────────────── */}
            <section className="relative pt-32 pb-24 px-6 overflow-hidden">
                {/* Background orbs */}
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-neon-cyan/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute top-1/3 -right-32 w-96 h-96 bg-neon-purple/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan text-xs font-medium mb-8">
                        <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
                        Powered by GPT-4o · Intent-Centric Trading
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
                        Trade Crypto With{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple text-glow-cyan">
                            Natural Language
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                        NexusSphere is your AI-powered on-chain agent. Simply tell it what to do —
                        &ldquo;Buy $100 of ETH if it drops 5%&rdquo; — and it handles the rest.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href="/dashboard"
                            className="px-8 py-4 rounded-xl font-bold text-dark-bg bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 transition-all duration-300 shadow-lg shadow-neon-cyan/20 hover:shadow-neon-cyan/40 hover:-translate-y-0.5"
                        >
                            🚀 Launch Dashboard
                        </Link>
                        <a
                            href="https://t.me/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-4 rounded-xl font-bold text-neon-cyan border border-neon-cyan/50 hover:border-neon-cyan hover:bg-neon-cyan/10 transition-all duration-300"
                        >
                            📱 Open Telegram Bot
                        </a>
                    </div>

                    {/* Live preview ticker */}
                    <div className="mt-16 p-4 md:p-6 rounded-2xl border border-dark-border card-bg max-w-xl mx-auto text-left font-mono text-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-slate-500 ml-2 text-xs">nexussphere-agent</span>
                        </div>
                        <p className="text-slate-400">
                            <span className="text-neon-cyan">user@nexus</span>
                            <span className="text-slate-500">:~$</span>{' '}
                            <span className="text-white">Buy $100 of ETH if it drops 5%</span>
                        </p>
                        <p className="text-slate-500 mt-1">🧠 Parsing intent...</p>
                        <div className="mt-2 p-3 rounded-lg bg-green-950/30 border border-green-800/30 text-green-400 text-xs">
                            ✅ Intent parsed: {`{"action":"buy","asset":"ETH","amount":100,"condition":"price drops 5%"}`}
                        </div>
                        <p className="text-neon-cyan mt-2">✅ NexusSphere Agent configured. Mock trade executed.</p>
                    </div>
                </div>
            </section>

            {/* ── Features Section ─────────────────────────────────────────────── */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            The Future of{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple">
                                On-Chain Trading
                            </span>
                        </h2>
                        <p className="text-slate-400 max-w-xl mx-auto">
                            Stop wrestling with complex trading UIs. Just describe your strategy in plain English.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: '🧠',
                                title: 'AI Intent Engine',
                                desc: 'GPT-4o understands your trading intent and converts it into precise, executable parameters.',
                                color: 'neon-cyan',
                            },
                            {
                                icon: '📱',
                                title: 'Telegram Native',
                                desc: 'Manage your entire portfolio through a familiar chat interface. No new apps to learn.',
                                color: 'neon-purple',
                            },
                            {
                                icon: '🔐',
                                title: 'Non-Custodial',
                                desc: 'Connect your own wallet. NexusSphere never holds your keys or controls your funds.',
                                color: 'neon-cyan',
                            },
                            {
                                icon: '⚡',
                                title: 'Conditional Orders',
                                desc: 'Set triggers based on price movements, time, or market conditions. NexusSphere watches 24/7.',
                                color: 'neon-purple',
                            },
                            {
                                icon: '📊',
                                title: 'Real-Time Dashboard',
                                desc: 'Track all your configured agents and trade history in a beautiful, live dashboard.',
                                color: 'neon-cyan',
                            },
                            {
                                icon: '🌐',
                                title: 'Multi-Chain',
                                desc: 'Works across Ethereum, Polygon, Arbitrum, and Base with unified liquidity access.',
                                color: 'neon-purple',
                            },
                        ].map((feature) => (
                            <div
                                key={feature.title}
                                className={`p-6 rounded-2xl border border-dark-border card-bg hover:border-${feature.color}/50 transition-all duration-300 group`}
                            >
                                <div className="text-4xl mb-4">{feature.icon}</div>
                                <h3 className={`text-lg font-bold text-white mb-2 group-hover:text-${feature.color} transition-colors`}>
                                    {feature.title}
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How It Works ─────────────────────────────────────────────────── */}
            <section id="how-it-works" className="py-24 px-6 border-t border-dark-border">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-16">
                        How It Works
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'Describe Your Intent', desc: 'Type your trade in plain English in Telegram or on the dashboard.' },
                            { step: '02', title: 'AI Parses & Configures', desc: 'GPT-4o extracts action, asset, amount, and conditions from your message.' },
                            { step: '03', title: 'Agent Executes', desc: 'Your NexusSphere agent monitors markets and executes when conditions are met.' },
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className="w-16 h-16 rounded-full border-2 border-neon-cyan bg-neon-cyan/10 flex items-center justify-center text-neon-cyan font-black text-lg mb-4 border-glow-cyan">
                                    {item.step}
                                </div>
                                <h3 className="font-bold text-white text-lg mb-2">{item.title}</h3>
                                <p className="text-slate-400 text-sm">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────────────────────── */}
            <footer className="border-t border-dark-border py-10 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-neon-cyan to-neon-purple" />
                        <span className="font-bold text-white">
                            Nexus<span className="text-neon-cyan">Sphere</span>
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm">
                        © 2026 NexusSphere. Built for the decentralized future.
                    </p>
                    <div className="flex items-center gap-4 text-slate-400 text-sm">
                        <span>MVP · Paper Trading Only</span>
                    </div>
                </div>
            </footer>
        </main>
    );
}
