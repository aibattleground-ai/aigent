/**
 * AIGENT — Landing Page (Cutting-Edge Redesign)
 */
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

const features = [
    { icon: '⚡', t: 'Claude AI Engine', d: 'Powered by Anthropic\'s Claude — the most capable AI for understanding complex financial intent.', accent: 'cyan' },
    { icon: '📱', t: 'Telegram Native', d: 'Your entire portfolio, one chat. No apps to install, no dashboards to learn.', accent: 'purple' },
    { icon: '🔐', t: 'Non-Custodial', d: 'Your keys, your crypto. AIGENT never touches your funds.', accent: 'pink' },
    { icon: '⚙️', t: 'Conditional Orders', d: 'Trigger trades on price movements, time windows, or custom market conditions.', accent: 'cyan' },
    { icon: '📊', t: 'Live Dashboard', d: 'All your configured agents and trade history in a real-time unified view.', accent: 'purple' },
    { icon: '🌐', t: 'Multi-Chain', d: 'Unified access across Ethereum, Polygon, Arbitrum and Base.', accent: 'pink' },
];

const chain = [
    { n: '01', t: 'Express Intent', d: '"Buy $500 of ETH when it drops 8%" — just like typing a message to a friend.' },
    { n: '02', t: 'Claude Parses', d: 'Our Claude AI engine extracts action, asset, amount, and precise trigger conditions.' },
    { n: '03', t: 'Agent Executes', d: 'Your AIGENT monitors markets 24/7 and fires the trade the moment your condition is met.' },
];

export default function HomePage() {
    return (
        <main className="min-h-screen bg-ai-bg overflow-hidden">
            <Navbar />

            {/* ── HERO ──────────────────────────────────────────────────────────── */}
            <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
                {/* Animated grid */}
                <div className="absolute inset-0 grid-animated opacity-60 pointer-events-none" />

                {/* Orbs */}
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-ai-cyan/5 rounded-full blur-[120px] animate-orb-pulse pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-ai-purple/5 rounded-full blur-[100px] animate-orb-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

                {/* Floating geometric decorations */}
                <div className="absolute top-32 left-12 w-24 h-24 border border-ai-cyan/10 rounded-2xl rotate-12 animate-float pointer-events-none" />
                <div className="absolute top-48 right-16 w-16 h-16 border border-ai-purple/10 rounded-xl -rotate-6 animate-float pointer-events-none" style={{ animationDelay: '2s' }} />
                <div className="absolute bottom-32 left-20 w-12 h-12 border border-ai-pink/10 rounded-lg rotate-45 animate-float pointer-events-none" style={{ animationDelay: '4s' }} />

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    {/* BADGE */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-ai-cyan/20 text-xs font-medium text-ai-cyan mb-8 animate-fade-in">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ai-cyan opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-ai-cyan" />
                        </span>
                        Powered by Anthropic Claude · Intent-Centric Finance
                    </div>

                    {/* HEADLINE */}
                    <h1 className="font-display text-6xl md:text-8xl font-black text-white leading-[0.95] tracking-tight mb-8 animate-slide-up">
                        The AI Agent<br />
                        <span className="text-gradient-warm">
                            That Trades For You
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        Just tell AIGENT what you want in plain English.
                        It understands your intent, configures the strategy, and executes — automatically.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <Link
                            href="/dashboard"
                            className="btn-shimmer px-8 py-4 rounded-2xl font-semibold text-ai-bg text-base tracking-wide"
                        >
                            Launch Dashboard →
                        </Link>
                        <a
                            href="https://t.me/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-4 rounded-2xl font-semibold text-white/70 text-base glass hover:text-white hover:border-white/20 transition-all duration-300"
                        >
                            Open on Telegram
                        </a>
                    </div>

                    {/* TERMINAL DEMO CARD */}
                    <div className="relative mt-20 mx-auto max-w-2xl animate-fade-in" style={{ animationDelay: '0.5s' }}>
                        {/* Glow behind card */}
                        <div className="absolute inset-0 bg-gradient-to-r from-ai-cyan/10 via-ai-purple/10 to-ai-pink/10 blur-2xl rounded-3xl" />

                        <div className="relative glass rounded-2xl border border-white/[0.06] overflow-hidden">
                            {/* Terminal header */}
                            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.05] bg-white/[0.02]">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                                </div>
                                <span className="text-xs text-white/30 ml-2 font-mono">aigent — terminal</span>
                            </div>

                            {/* Terminal body */}
                            <div className="p-6 font-mono text-sm space-y-3">
                                <div className="flex items-start gap-2">
                                    <span className="text-ai-cyan">›</span>
                                    <span className="text-white">Buy $500 of ETH if it drops below $2,800</span>
                                </div>
                                <div className="text-white/30">
                                    ⠋ Claude AI parsing intent...
                                </div>
                                <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 text-left">
                                    <div className="text-white/30 text-xs mb-2">// parsed intent</div>
                                    <pre className="text-ai-cyan text-xs leading-relaxed">{`{
  "action":    "buy",
  "asset":     "ETH",
  "amount":    500,
  "condition": "price drops below $2,800"
}`}</pre>
                                </div>
                                <div className="flex items-start gap-2 text-green-400">
                                    <span>✓</span>
                                    <span>AIGENT configured. Agent is now monitoring the market.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SOCIAL PROOF STRIP ───────────────────────────────────────────── */}
            <div className="border-y border-white/[0.05] py-6 overflow-hidden">
                <div className="flex items-center gap-16 animate-marquee whitespace-nowrap px-8">
                    {['Ethereum', 'Polygon', 'Arbitrum', 'Base', 'Claude AI', 'Non-Custodial', 'Paper Trading', '24/7 Agents', 'Multi-Chain'].map((t, i) => (
                        <span key={i} className="text-sm text-white/25 font-medium tracking-widest uppercase shrink-0">
                            {t}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── FEATURES ─────────────────────────────────────────────────────── */}
            <section id="features" className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    {/* Section label */}
                    <div className="text-center mb-20">
                        <span className="text-xs font-semibold tracking-[0.3em] uppercase text-ai-cyan/60">Features</span>
                        <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 mb-5">
                            Built for the<br />
                            <span className="text-gradient-cyan">Next Generation</span>
                        </h2>
                        <p className="text-white/40 max-w-lg mx-auto">Everything you need to automate your crypto strategy — without writing a single line of code.</p>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {features.map((f, i) => (
                            <div
                                key={i}
                                className="group relative p-7 rounded-2xl glass-bright hover:bg-white/[0.05] transition-all duration-500 overflow-hidden"
                                style={{ animationDelay: `${i * 0.1}s` }}
                            >
                                {/* Gradient accent on hover */}
                                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${f.accent === 'cyan' ? 'from-ai-cyan/5' :
                                    f.accent === 'purple' ? 'from-ai-purple/5' : 'from-ai-pink/5'
                                    } to-transparent`} />

                                <div className="text-3xl mb-5">{f.icon}</div>
                                <h3 className="font-display font-semibold text-lg text-white mb-3 group-hover:text-ai-cyan transition-all">
                                    {f.t}
                                </h3>
                                <p className="text-white/40 text-sm leading-relaxed">{f.d}</p>

                                {/* Corner accent */}
                                <div className={`absolute top-0 right-0 w-16 h-16 ${f.accent === 'cyan' ? 'bg-ai-cyan/5' :
                                    f.accent === 'purple' ? 'bg-ai-purple/5' : 'bg-ai-pink/5'
                                    } rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
            <section id="how" className="py-32 px-6 relative">
                <div className="absolute inset-0 hex-bg opacity-30 pointer-events-none" />

                <div className="max-w-5xl mx-auto relative z-10">
                    <div className="text-center mb-20">
                        <span className="text-xs font-semibold tracking-[0.3em] uppercase text-ai-purple/60">How It Works</span>
                        <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4">
                            Three steps.<br />
                            <span className="text-gradient-warm">Infinite possibilities.</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                        {/* Connecting line */}
                        <div className="hidden md:block absolute top-16 left-[calc(16.67%+16px)] right-[calc(16.67%+16px)] h-px bg-gradient-to-r from-ai-cyan/30 via-ai-purple/30 to-ai-pink/30" />

                        {chain.map((step, i) => (
                            <div key={i} className="flex flex-col items-center text-center p-8">
                                {/* Step number circle */}
                                <div className={`relative w-14 h-14 rounded-full flex items-center justify-center mb-7 ${i === 0 ? 'bg-ai-cyan/10 border border-ai-cyan/30' :
                                    i === 1 ? 'bg-ai-purple/10 border border-ai-purple/30' :
                                        'bg-ai-pink/10 border border-ai-pink/30'
                                    }`}>
                                    {/* Ping ring */}
                                    <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${i === 0 ? 'bg-ai-cyan' : i === 1 ? 'bg-ai-purple' : 'bg-ai-pink'
                                        }`} style={{ animationDuration: `${3 + i}s` }} />
                                    <span className={`font-display font-bold text-sm ${i === 0 ? 'text-ai-cyan' : i === 1 ? 'text-ai-purple' : 'text-ai-pink'
                                        }`}>
                                        {step.n}
                                    </span>
                                </div>
                                <h3 className="font-display font-semibold text-white text-lg mb-3">{step.t}</h3>
                                <p className="text-white/40 text-sm leading-relaxed">{step.d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
            <section className="py-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="relative p-12 rounded-3xl overflow-hidden">
                        {/* Background glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-ai-cyan/10 via-ai-purple/10 to-ai-pink/10 rounded-3xl" />
                        <div className="absolute inset-px rounded-3xl border border-white/[0.08]" />

                        <div className="relative z-10">
                            <div className="text-5xl mb-6">🤖</div>
                            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-5">
                                Ready to let AI<br />
                                <span className="text-gradient-warm">trade for you?</span>
                            </h2>
                            <p className="text-white/40 mb-10 text-lg">
                                Connect your wallet, configure your intent, and let AIGENT handle the rest.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link href="/dashboard" className="btn-shimmer px-8 py-4 rounded-2xl font-semibold text-ai-bg text-base">
                                    Open Dashboard
                                </Link>
                                <Link href="/#how" className="px-8 py-4 rounded-2xl font-semibold glass text-white/60 hover:text-white transition-all">
                                    Learn More
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ────────────────────────────────────────────────────────── */}
            <footer className="border-t border-white/[0.05] py-10 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-ai-cyan/30 to-ai-purple/30 flex items-center justify-center border border-white/10">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#00f0ff" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#00f0ff" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span className="font-display font-bold text-white">AI<span className="text-ai-cyan">GENT</span></span>
                    </div>
                    <p className="text-white/20 text-sm">© 2026 AIGENT. Paper trading only. Not financial advice.</p>
                    <p className="text-white/20 text-xs">Powered by Claude AI · MVP</p>
                </div>
            </footer>
        </main>
    );
}
