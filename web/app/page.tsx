/**
 * AIGENT — Institutional Landing Page
 * Ultra-Premium Quant / DeepTech Aesthetic
 */
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

/* ─── Data ─────────────────────────────────────────────────────── */

const architectureLayers = [
    {
        id: 'L-01',
        label: 'Intent Parsing Layer',
        modules: [
            {
                name: 'Neural Sentiment Analysis Engine',
                tag: 'NLP · TRANSFORMER',
                desc: 'Transformer-based language model fine-tuned on 47M on-chain transaction annotations, cross-market sentiment signals, and regulatory corpus data. Achieves 94.3% intent classification accuracy across 180+ distinct trade strategy archetypes with sub-280ms median inference latency.',
            },
            {
                name: 'ZK-Intent Verification (ZK-Intent™)',
                tag: 'zk-SNARKs · GROTH16',
                desc: 'Zero-Knowledge Intent Verification leverages zk-SNARK proofs to cryptographically commit user trade intents on-chain prior to execution. Eliminates front-running vectors and preserves full intent confidentiality from third-party observers, including validator nodes.',
            },
        ],
    },
    {
        id: 'L-02',
        label: 'Routing & Execution Layer',
        modules: [
            {
                name: 'MEV-Protected Execution Router',
                tag: 'FLASHBOTS · bloXroute',
                desc: 'Proprietary transaction bundling and private mempool relay infrastructure shielding executed orders from Miner/Validator Extractable Value (MEV) attacks. Integrates with Flashbots Protect, bloXroute, and private relay infrastructure across 14 EVM-compatible networks.',
            },
            {
                name: 'Cross-Chain Liquidity Aggregator',
                tag: 'SPLIT-ROUTING · 14 DEXs',
                desc: 'Real-time aggregation across 14+ decentralized exchanges executing optimal split-routing algorithms (Dijkstra-variant, price-impact weighted) to minimize slippage while maximizing throughput for institutional-size order flows with atomic settlement guarantees.',
            },
        ],
    },
    {
        id: 'L-03',
        label: 'Risk & Settlement Layer',
        modules: [
            {
                name: 'Adaptive Risk Scoring Matrix',
                tag: 'VaR · CVaR · MONTE CARLO',
                desc: 'Monte Carlo simulation engine computing real-time Value-at-Risk (VaR) and Conditional Value-at-Risk (CVaR) for every pending trade intent. Dynamic position sizing constraints enforced at smart contract level through on-chain risk parameter oracles updated every 12 seconds.',
            },
            {
                name: 'Atomic Settlement Engine',
                tag: 'ERC-4337 · SINGLE BLOCK',
                desc: 'All trade settlements execute atomically via audited smart contracts. Partial fills are automatically refunded. No counterparty risk is introduced at any pipeline stage. Settlement finality confirmed within a single block proposition cycle — no optimistic assumptions.',
            },
        ],
    },
];

const revenueAllocation = [
    { pct: '30%', label: 'Buyback & Burn', desc: 'Permanently acquired from open market and burned via deflationary treasury contract. Supply reduction is monotonically correlated with protocol volume.', icon: '▼' },
    { pct: '40%', label: 'Staker Yield', desc: 'Distributed pro-rata to $AIGENT stakers maintaining ≥90-day lock commitments. Fully on-chain audit trail via Merkle-proof distribution.', icon: '◆' },
    { pct: '30%', label: 'Protocol Reserve', desc: 'Multi-sig treasury allocation for R&D, security audits, ecosystem grants, and AI model infrastructure. Subject to DAO governance approval.', icon: '■' },
];

const stakingTiers = [
    {
        tier: 'OBSERVER',
        amount: '500',
        model: 'Claude Haiku',
        perks: ['Basic intent parsing', '5 concurrent agents', 'Standard execution queue', 'Community governance'],
    },
    {
        tier: 'OPERATOR',
        amount: '5,000',
        model: 'Claude Sonnet',
        perks: ['Advanced strategy library', '25 concurrent agents', 'Priority execution queue', '30% fee discount', 'Enhanced risk analytics'],
        featured: false,
    },
    {
        tier: 'ARCHITECT',
        amount: '25,000',
        model: 'Claude Opus',
        perks: ['Full inference access', 'Unlimited agents', 'Private mempool access', '70% fee discount', 'Real-time VaR dashboard', 'Governance ×3'],
        featured: true,
    },
    {
        tier: 'SOVEREIGN',
        amount: '100,000',
        model: 'Claude Opus — Dedicated',
        perks: ['Dedicated inference cluster', 'Custom fine-tuning', 'Direct protocol API', 'Institutional SLA', 'Treasury advisory seat', 'Early protocol access'],
    },
];

const securityItems = [
    { label: 'Non-Custodial Smart Contracts', code: 'ERC-4337', desc: 'All authorizations are scoped, revocable session keys. AIGENT takes zero custody of user assets at any point in the execution pipeline.' },
    { label: 'Multi-Sig Treasury', code: '7-of-11', desc: 'Protocol treasury and upgrade authority governed by 7-of-11 multi-signature scheme across geographically separated hardware security modules (HSMs).' },
    { label: 'Real-Time On-Chain Risk Management', code: 'CHAINLINK ORACLES', desc: 'Continuous block-level risk scoring published via Chainlink aggregators. VaR threshold breaches trigger automatic de-risking routines at contract level.' },
    { label: 'Formal Verification', code: 'K FRAMEWORK', desc: 'Core smart contract logic formally verified using the K Framework — machine-checkable proofs of correctness for all critical execution paths.' },
    { label: 'Immunefi Bug Bounty', code: '$1,000,000 USDC', desc: 'Ongoing bug bounty program offering up to $1M USDC for critical vulnerability disclosures. Demonstrates commitment to highest security posture.' },
    { label: 'Insurance Reserve Fund', code: '5% REVENUE', desc: 'Protocol-controlled insurance fund seeded at 5% of all revenue, providing first-loss coverage against exploits, oracle manipulation, and liquidation cascades.' },
];

const roadmapPhases = [
    {
        phase: 'PHASE I',
        title: 'Foundation Protocol',
        period: 'Q1–Q2 2026',
        status: 'LIVE',
        items: [
            'Intent-to-trade parsing via Claude AI inference cluster',
            'EVM non-custodial execution engine (Ethereum, Arbitrum, Base)',
            'ZK-Intent proof generation & on-chain commitment',
            'MEV-Protected Execution Router v1',
            '$AIGENT TGE & initial staking module',
            'Trail of Bits + Spearbit security audit',
        ],
    },
    {
        phase: 'PHASE II',
        title: 'Cross-Chain AI Arbitrage',
        period: 'Q3–Q4 2026',
        status: 'UPCOMING',
        items: [
            'Cross-chain routing: Solana, Sui, Cosmos IBC integration',
            'Neural Sentiment Engine v2 with social/news signal ingestion',
            'AI-driven cross-chain arbitrage with atomic execution',
            'Institutional API gateway (FIX-compatible, sub-100ms SLA)',
            'Buyback & Burn treasury contract deployment',
            'Tier 3–4 staking unlock — Claude Opus access',
        ],
    },
    {
        phase: 'PHASE III',
        title: 'Decentralized AI Node Network',
        period: 'Q1–Q2 2027',
        status: 'PLANNED',
        items: [
            'Permissionless AI inference node onboarding ($AIGENT collateral)',
            'Distributed model serving with verifiable computation proofs',
            'On-chain model registry + slashing for inference failure',
            'Cross-chain AI oracle network for real-time alpha signals',
            'DAO-controlled model versioning and upgrade governance',
        ],
    },
    {
        phase: 'PHASE IV',
        title: 'Sovereign AI Financial Ecosystem',
        period: 'Q3 2027+',
        status: 'VISION',
        items: [
            'AIGENT L2 rollup — purpose-built EVM chain for AI-native DeFi',
            'AI-managed on-chain hedge fund with tokenized LP shares',
            'Institutional prime brokerage partnerships + regulated custody',
            'Fully autonomous AI treasury management for partner protocols',
            'Cross-protocol strategy marketplace with composable revenue-sharing',
        ],
    },
];

const marqueeItems = [
    'Neural Sentiment Engine', 'ZK-Intent Verified', 'MEV-Protected', 'Non-Custodial',
    '14-Chain Support', '$AIGENT Protocol', 'Buyback & Burn', 'Formal Verification',
    'Institutional Grade', 'Claude Opus Access', 'Monte Carlo VaR', 'Atomic Settlement',
];

/* ─── Component ───────────────────────────────────────────────── */

export default function HomePage() {
    return (
        <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
            <Navbar />

            {/* ════════════════════════════════════════════════════════════ */}
            {/*  SECTION 1 — HERO                                           */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section className="relative min-h-screen flex flex-col justify-center px-8 lg:px-16 pt-28 pb-20 overflow-hidden">
                {/* Micro-grid background */}
                <div className="absolute inset-0 micro-grid grid-drift opacity-100 pointer-events-none" />
                {/* Very subtle radial vignette */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, var(--bg) 100%)' }} />

                <div className="max-w-7xl mx-auto w-full relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                        {/* Left column — copy */}
                        <div>
                            {/* System label */}
                            <div className="flex items-center gap-3 mb-10">
                                <span className="inline-flex items-center gap-2 mono-label" style={{ color: 'var(--accent)' }}>
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-none" style={{ background: 'var(--accent)', opacity: 0.7 }} />
                                        <span className="relative inline-flex h-1.5 w-1.5" style={{ background: 'var(--accent)' }} />
                                    </span>
                                    AIGENT // PROTOCOL v2.4 // BETA ACCESS
                                </span>
                            </div>

                            {/* Headline */}
                            <h1 className="font-display font-bold text-white leading-[1.0] tracking-tight mb-8" style={{ fontSize: 'clamp(2.8rem, 5vw, 5rem)' }}>
                                The First<br />
                                <span className="text-gradient">Intent-Centric</span><br />
                                AI Liquidity<br />
                                Protocol
                            </h1>

                            <p className="text-sm leading-loose mb-4" style={{ color: 'var(--text-300)', maxWidth: '42ch' }}>
                                AIGENT is a cryptographically verifiable, non-custodial AI execution layer that translates natural language trade intents into MEV-protected, cross-chain liquidity operations — autonomously, at institutional grade.
                            </p>
                            <p className="font-mono-custom text-xs mb-12" style={{ color: 'var(--text-400)', letterSpacing: '0.04em' }}>
                                Neural Sentiment Analysis · ZK-Intent Proofs · MEV-Protected Routing · $AIGENT Token Economics
                            </p>

                            {/* CTAs */}
                            <div className="flex flex-wrap gap-4 mb-16">
                                <button className="btn-primary">Stake to Access Beta →</button>
                                <button className="btn-secondary">Read Technical Litepaper ↗</button>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x" style={{ borderColor: 'var(--border)', border: '1px solid var(--border)' }}>
                                {[
                                    { v: '$284M+', l: 'Total Volume' },
                                    { v: '14', l: 'Chains' },
                                    { v: '94.3%', l: 'Intent Accuracy' },
                                    { v: '<280ms', l: 'Execution' },
                                ].map((m, i) => (
                                    <div key={i} className="p-4 text-center" style={{ borderColor: 'var(--border)' }}>
                                        <div className="stat-num text-xl mb-1">{m.v}</div>
                                        <div className="mono-label" style={{ color: 'var(--text-400)' }}>{m.l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right column — terminal */}
                        <div className="terminal-wrap panel cut-corner" style={{ borderColor: 'var(--border-hi)' }}>
                            {/* Terminal header */}
                            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
                                <div className="mono-label">aigent://intent-engine · v2.4.1</div>
                                <div className="flex items-center gap-2 mono-label" style={{ color: 'var(--accent)' }}>
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full" style={{ background: 'var(--accent)', opacity: 0.7 }} />
                                        <span className="relative inline-flex h-1.5 w-1.5" style={{ background: 'var(--accent)' }} />
                                    </span>
                                    LIVE
                                </div>
                            </div>

                            {/* Terminal body */}
                            <div className="p-6 font-mono-custom text-xs space-y-4" style={{ lineHeight: '1.7' }}>
                                <div style={{ color: 'var(--text-400)' }}>// ZK-Intent parsing pipeline — block #21,847,392</div>

                                <div className="flex items-start gap-3">
                                    <span style={{ color: 'var(--accent)' }}>›</span>
                                    <span style={{ color: 'var(--text-100)' }}>
                                        {'"Allocate 15% of portfolio to ETH if RSI(14) < 32 AND BTC dominance > 54%"'}
                                    </span>
                                </div>

                                <div style={{ color: 'var(--text-400)' }}>
                                    ⠿ Neural Sentiment Engine parsing...&nbsp;&nbsp;[proof_gen: 84ms]
                                </div>

                                <div className="panel-accent cut-corner-sm p-4">
                                    <div className="mb-2" style={{ color: 'var(--text-400)' }}>// Parsed ZK-Intent commitment — SNARK verified ✓</div>
                                    <pre style={{ color: 'var(--accent)', lineHeight: '1.8' }}>{`{
  "intent_id":    "0x7f3a...c91e",
  "action":       "portfolio_rebalance",
  "asset":        "ETH",
  "allocation":   "0.15",
  "trigger": {
    "rsi_14":     "< 32",
    "btc_dom":    "> 0.54",
    "operator":   "AND"
  },
  "mev_shield":   true,
  "zk_verified":  true,
  "expires_at":   "block + 2160"
}`}
                                    </pre>
                                </div>

                                <div style={{ color: '#4ade80', fontSize: '11px' }}>
                                    ✓ ZK-Intent committed on-chain.&nbsp;MEV Router queued.&nbsp;Agent monitoring 24/7.
                                </div>

                                <div className="flex items-center gap-2" style={{ color: 'var(--text-400)' }}>
                                    <span>›</span>
                                    <span className="animate-blink" style={{ color: 'var(--accent)' }}>_</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Divider + Marquee */}
            <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} className="py-4 overflow-hidden">
                <div className="animate-marquee">
                    {[...marqueeItems, ...marqueeItems].map((t, i) => (
                        <span key={i} className="mono-label shrink-0 px-8" style={{ color: 'var(--text-400)' }}>
              // {t}
                        </span>
                    ))}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════ */}
            {/*  SECTION 2 — PROTOCOL ARCHITECTURE                          */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section id="architecture" className="py-40 px-8 lg:px-16 relative">
                <div className="absolute inset-0 micro-grid-lg opacity-40 pointer-events-none" />
                <div className="divider mb-0" />

                <div className="max-w-7xl mx-auto relative z-10">
                    {/* Section header */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-24 pt-16">
                        <div className="lg:col-span-1">
                            <div className="mono-label mb-4">Section 02</div>
                            <h2 className="font-display font-bold text-white text-4xl lg:text-5xl leading-tight">
                                Protocol<br />Architecture
                            </h2>
                        </div>
                        <div className="lg:col-span-2 flex items-end">
                            <p style={{ color: 'var(--text-300)', maxWidth: '60ch', lineHeight: '1.85', fontSize: '14px' }}>
                                AIGENT's three-layer protocol architecture ensures cryptographic intent integrity, optimal liquidity routing, and atomic settlement — from natural language input to on-chain execution. Each layer operates as an independent, formally verified module with well-defined interfaces and failure modes.
                            </p>
                        </div>
                    </div>

                    {/* Layers */}
                    <div className="space-y-3">
                        {architectureLayers.map((layer, li) => (
                            <div key={li} className="panel cut-corner" style={{ borderColor: 'var(--border)' }}>
                                {/* Layer bar */}
                                <div className="flex items-center gap-5 px-7 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <span className="font-mono-custom font-semibold text-xs tracking-widest" style={{ color: 'var(--accent)' }}>
                                        {layer.id}
                                    </span>
                                    <div style={{ width: '1px', height: '12px', background: 'var(--border-hi)' }} />
                                    <span className="font-display font-semibold text-white text-sm tracking-wide">{layer.label}</span>
                                    <div className="flex-1" style={{ height: '1px', background: 'var(--border)' }} />
                                    <span className="mono-label" style={{ color: 'var(--text-400)' }}>2 MODULES</span>
                                </div>

                                {/* Modules */}
                                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: 'var(--border)' }}>
                                    {layer.modules.map((mod, mi) => (
                                        <div key={mi} className="p-8 group" style={{ transition: 'background 0.2s' }}>
                                            <div className="border-l-accent pl-4 mb-5">
                                                <div className="mono-label mb-2" style={{ color: 'var(--accent)' }}>{mod.tag}</div>
                                                <h3 className="font-display font-semibold text-white text-base">{mod.name}</h3>
                                            </div>
                                            <p style={{ color: 'var(--text-300)', fontSize: '13px', lineHeight: '1.85' }}>{mod.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Data flow strip */}
                    <div className="mt-8 panel cut-corner-sm p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <span className="mono-label">Data Flow</span>
                            <div className="flex-1" style={{ height: '1px', background: 'var(--border)' }} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 font-mono-custom text-xs">
                            {[
                                'Natural Language Input',
                                '→ Neural Sentiment Engine',
                                '→ ZK-Intent Proof',
                                '→ On-chain Commitment',
                                '→ MEV-Protected Router',
                                '→ Liquidity Aggregation',
                                '→ Atomic Settlement',
                            ].map((node, i) => (
                                <span key={i} style={{ color: i % 2 === 0 ? 'var(--text-200)' : 'var(--text-400)', letterSpacing: '0.04em' }}>{node}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Divider */}
            <div className="divider" />

            {/* ════════════════════════════════════════════════════════════ */}
            {/*  SECTION 3 — TOKENOMICS & REVENUE MODEL                     */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section id="tokenomics" className="py-40 px-8 lg:px-16 relative">
                <div className="max-w-7xl mx-auto">

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-24">
                        <div className="lg:col-span-1">
                            <div className="mono-label mb-4">Section 03</div>
                            <h2 className="font-display font-bold text-white text-4xl lg:text-5xl leading-tight">
                                $AIGENT<br />Token<br />Economics
                            </h2>
                        </div>
                        <div className="lg:col-span-2 flex items-end">
                            <p style={{ color: 'var(--text-300)', maxWidth: '60ch', lineHeight: '1.85', fontSize: '14px' }}>
                                $AIGENT is a deflationary utility token with embedded revenue-sharing mechanics. 30% of all gross trading revenue generated by active AIGENT agents is directed to an autonomous on-chain treasury that executes market buybacks and permanently destroys acquired tokens, creating a supply curve inversely correlated with protocol usage volume.
                            </p>
                        </div>
                    </div>

                    {/* Revenue allocation */}
                    <div className="panel cut-corner mb-6 p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <span className="mono-label">Protocol Revenue Distribution</span>
                            <div className="flex-1" style={{ height: '1px', background: 'var(--border)' }} />
                            <span className="mono-label" style={{ color: 'var(--text-400)' }}>AUTOMATED · ON-CHAIN · NO HUMAN DISCRETION</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {revenueAllocation.map((r, i) => (
                                <div key={i} className="p-7 cut-corner-sm" style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)' }}>
                                    <div className="font-mono-custom font-semibold mb-1" style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '0.15em' }}>{r.icon}&nbsp;&nbsp;{r.label}</div>
                                    <div className="font-display font-black text-white my-3" style={{ fontSize: '3.5rem', lineHeight: 1 }}>{r.pct}</div>
                                    <p style={{ color: 'var(--text-300)', fontSize: '12px', lineHeight: '1.75' }}>{r.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Staking tiers */}
                    <div className="mb-3">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="mono-label">VIP Staking Tiers — AI Model Access</span>
                            <div className="flex-1" style={{ height: '1px', background: 'var(--border)' }} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            {stakingTiers.map((tier, i) => (
                                <div
                                    key={i}
                                    className="relative p-7 cut-corner flex flex-col"
                                    style={{
                                        background: tier.featured ? 'var(--accent-dim)' : 'var(--surface)',
                                        border: `1px solid ${tier.featured ? 'var(--accent-border)' : 'var(--border)'}`,
                                    }}
                                >
                                    {tier.featured && (
                                        <div className="mono-label mb-4" style={{ color: 'var(--accent)' }}>◆ MOST POPULAR</div>
                                    )}
                                    <div className="font-mono-custom font-semibold text-xs tracking-widest mb-1" style={{ color: tier.featured ? 'var(--accent)' : 'var(--text-400)' }}>
                                        {tier.tier}
                                    </div>
                                    <div className="font-mono-custom text-white font-semibold mb-1" style={{ fontSize: '1.5rem' }}>
                                        {tier.amount}
                                    </div>
                                    <div className="mono-label mb-5" style={{ color: 'var(--text-400)' }}>$AIGENT STAKED</div>

                                    <div className="py-2 px-3 mb-6 cut-corner-sm" style={{ background: 'var(--surface-hi)', border: '1px solid var(--border-hi)' }}>
                                        <span className="mono-label" style={{ color: tier.featured ? 'var(--accent)' : 'var(--text-300)' }}>AI: {tier.model}</span>
                                    </div>

                                    <ul className="space-y-2.5 flex-1 mb-7">
                                        {tier.perks.map((perk, j) => (
                                            <li key={j} className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--text-300)', fontFamily: 'var(--font-mono)' }}>
                                                <span style={{ color: tier.featured ? 'var(--accent)' : 'var(--text-400)', marginTop: '2px' }}>›</span>
                                                {perk}
                                            </li>
                                        ))}
                                    </ul>

                                    {tier.featured ? (
                                        <button className="btn-primary w-full justify-center">Stake Now →</button>
                                    ) : (
                                        <button className="btn-secondary w-full justify-center">Learn More</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <div className="divider" />

            {/* ════════════════════════════════════════════════════════════ */}
            {/*  SECTION 4 — INSTITUTIONAL SECURITY                         */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section id="security" className="py-40 px-8 lg:px-16 relative">
                <div className="absolute inset-0 micro-grid opacity-30 pointer-events-none" />
                <div className="max-w-7xl mx-auto relative z-10">

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-24">
                        <div className="lg:col-span-1">
                            <div className="mono-label mb-4">Section 04</div>
                            <h2 className="font-display font-bold text-white text-4xl lg:text-5xl leading-tight">
                                Security<br />Framework
                            </h2>
                        </div>
                        <div className="lg:col-span-2 flex items-end">
                            <p style={{ color: 'var(--text-300)', maxWidth: '60ch', lineHeight: '1.85', fontSize: '14px' }}>
                                AIGENT's security posture is designed to institutional custodial standards, incorporating formal verification, on-chain risk management, and multi-layered operational controls that exceed conventional DeFi security benchmarks by multiple standard deviations.
                            </p>
                        </div>
                    </div>

                    {/* Security grid */}
                    <div className="space-y-px" style={{ border: '1px solid var(--border)' }}>
                        {securityItems.map((item, i) => (
                            <div
                                key={i}
                                className="hover-row grid grid-cols-1 md:grid-cols-12 gap-6 px-7 py-6"
                                style={{ borderBottom: i < securityItems.length - 1 ? '1px solid var(--border)' : 'none', margin: 0 }}
                            >
                                <div className="md:col-span-4">
                                    <div className="mono-label mb-1.5">{item.code}</div>
                                    <div className="font-display font-semibold text-white text-sm">{item.label}</div>
                                </div>
                                <div className="md:col-span-8">
                                    <p style={{ color: 'var(--text-300)', fontSize: '13px', lineHeight: '1.8' }}>{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Audit badges */}
                    <div className="mt-6 panel cut-corner-sm p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <span className="mono-label">Security Certifications</span>
                            <div className="flex-1" style={{ height: '1px', background: 'var(--border)' }} />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {[
                                'Trail of Bits — Smart Contract Audit',
                                'Spearbit — Security Review',
                                'OpenZeppelin — Contract Standards',
                                'Chainalysis — Compliance',
                                'Immunefi — $1M Bug Bounty',
                                'CertiK — On-chain Monitoring',
                            ].map((auditor, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-2 px-4 py-2 font-mono-custom text-xs cut-corner-sm"
                                    style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', color: 'var(--text-300)' }}
                                >
                                    <span style={{ color: 'var(--accent)' }}>✓</span>
                                    {auditor}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <div className="divider" />

            {/* ════════════════════════════════════════════════════════════ */}
            {/*  SECTION 5 — ROADMAP                                        */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section id="roadmap" className="py-40 px-8 lg:px-16">
                <div className="max-w-7xl mx-auto">

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-24">
                        <div className="lg:col-span-1">
                            <div className="mono-label mb-4">Section 05</div>
                            <h2 className="font-display font-bold text-white text-4xl lg:text-5xl leading-tight">
                                Strategic<br />Roadmap
                            </h2>
                        </div>
                        <div className="lg:col-span-2 flex items-end">
                            <p style={{ color: 'var(--text-300)', maxWidth: '60ch', lineHeight: '1.85', fontSize: '14px' }}>
                                AIGENT's development trajectory is structured across four sequential protocol maturity phases. Each phase builds upon verifiable on-chain milestones before proceeding, ensuring protocol integrity and investor accountability are maintained at every stage of the development cycle.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {roadmapPhases.map((phase, i) => {
                            const statusStyle: Record<string, { color: string; bg: string; border: string }> = {
                                'LIVE': { color: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.15)' },
                                'UPCOMING': { color: 'var(--accent)', bg: 'var(--accent-dim)', border: 'var(--accent-border)' },
                                'PLANNED': { color: 'var(--text-300)', bg: 'var(--surface)', border: 'var(--border)' },
                                'VISION': { color: 'var(--text-400)', bg: 'transparent', border: 'var(--border)' },
                            };
                            const s = statusStyle[phase.status];
                            return (
                                <div
                                    key={i}
                                    className="panel cut-corner p-8"
                                    style={{ borderColor: i === 0 ? 'var(--accent-border)' : 'var(--border)' }}
                                >
                                    <div className="flex items-start justify-between mb-7">
                                        <div>
                                            <div className="mono-label mb-1.5">{phase.phase}</div>
                                            <h3 className="font-display font-bold text-white text-xl leading-tight">{phase.title}</h3>
                                            <div className="font-mono-custom text-xs mt-2" style={{ color: 'var(--text-400)' }}>{phase.period}</div>
                                        </div>
                                        <div
                                            className="font-mono-custom text-xs font-semibold px-3 py-1 cut-corner-sm tracking-widest"
                                            style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
                                        >
                                            {phase.status === 'LIVE' && '● '}{phase.status}
                                        </div>
                                    </div>

                                    <ul className="space-y-3">
                                        {phase.items.map((item, j) => (
                                            <li key={j} className="flex items-start gap-3 font-mono-custom text-xs" style={{ color: 'var(--text-300)', lineHeight: '1.7' }}>
                                                <span style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-400)', marginTop: '2px', flexShrink: 0 }}>›</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <div className="divider" />

            {/* ════════════════════════════════════════════════════════════ */}
            {/*  FINAL CTA                                                   */}
            {/* ════════════════════════════════════════════════════════════ */}
            <section className="py-48 px-8 lg:px-16 relative overflow-hidden">
                <div className="absolute inset-0 micro-grid-lg opacity-40 pointer-events-none" />
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="mono-label mb-8" style={{ color: 'var(--accent)' }}>
                        <span className="relative inline-flex h-1.5 w-1.5 mr-2 align-middle">
                            <span className="animate-ping absolute inline-flex h-full w-full" style={{ background: 'var(--accent)', opacity: 0.6 }} />
                            <span className="relative inline-flex h-1.5 w-1.5" style={{ background: 'var(--accent)' }} />
                        </span>
                        BETA ACCESS NOW OPEN — LIMITED ALLOCATION
                    </div>

                    <h2 className="font-display font-bold text-white leading-tight mb-8" style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}>
                        The Future of<br />
                        <span className="text-gradient">Autonomous Finance</span>
                    </h2>

                    <p style={{ color: 'var(--text-300)', fontSize: '15px', lineHeight: '1.85', maxWidth: '54ch', margin: '0 auto 3rem' }}>
                        Stake $AIGENT to unlock beta access and position yourself at the frontier of intent-centric, AI-native decentralized finance. Early stakers receive priority queue access, elevated governance weight, and enhanced yield distribution for the protocol's inaugural epoch.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
                        <button className="btn-primary" style={{ fontSize: '11px', padding: '15px 36px' }}>
                            Stake to Access Beta →
                        </button>
                        <button className="btn-secondary" style={{ fontSize: '11px', padding: '14px 36px' }}>
                            Read Technical Litepaper ↗
                        </button>
                    </div>

                    <p className="font-mono-custom text-xs" style={{ color: 'var(--text-400)', letterSpacing: '0.06em' }}>
                        Non-custodial · ZK-Intent Verified · Audited by Trail of Bits & Spearbit · Not financial advice
                    </p>
                </div>
            </section>

            {/* ── FOOTER ──── */}
            <footer style={{ borderTop: '1px solid var(--border)' }} className="py-14 px-8 lg:px-16">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
                        {/* Brand */}
                        <div>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-7 h-7 cut-corner-sm flex items-center justify-center" style={{ border: '1px solid var(--accent-border)', background: 'var(--accent-dim)' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <span className="font-display font-bold text-white">AI<span style={{ color: 'var(--accent)' }}>GENT</span></span>
                            </div>
                            <p className="font-mono-custom text-xs leading-relaxed" style={{ color: 'var(--text-400)' }}>
                                The First Intent-Centric<br />AI Liquidity Protocol.<br />Non-custodial. ZK-verified.
                            </p>
                        </div>

                        {/* Links */}
                        {[
                            { heading: 'Protocol', links: ['Architecture', 'Tokenomics', 'Security', 'Roadmap'] },
                            { heading: 'Resources', links: ['Technical Litepaper', 'Audit Reports', 'API Documentation', 'Bug Bounty'] },
                            { heading: 'Community', links: ['Telegram', 'Discord', 'Twitter/X', 'GitHub'] },
                        ].map((col, i) => (
                            <div key={i}>
                                <div className="mono-label mb-5" style={{ color: 'var(--text-400)' }}>{col.heading}</div>
                                <ul className="space-y-3">
                                    {col.links.map((l, j) => (
                                        <li key={j}>
                                            <a href="#" className="footer-link">
                                                {l}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)' }} className="pt-8 flex flex-col md:flex-row items-center justify-between gap-3">
                        <p className="font-mono-custom text-xs" style={{ color: 'var(--text-400)' }}>© 2026 AIGENT Protocol. All rights reserved.</p>
                        <p className="font-mono-custom text-xs" style={{ color: 'var(--text-500)' }}>Powered by Anthropic Claude · Experimental software · Not financial advice</p>
                    </div>
                </div>
            </footer>
        </main>
    );
}
