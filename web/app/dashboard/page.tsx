'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

interface Trade {
    id: number;
    chat_id: string;
    action: string;
    asset: string;
    amount: number;
    condition: string;
    status: string;
    created_at: string;
}

interface ApiResponse {
    trades?: Trade[];
    message?: string;
    error?: string;
}

function ActionPill({ action }: { action: string }) {
    const isBuy = action.toLowerCase() === 'buy';
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${isBuy
            ? 'bg-ai-cyan/10 border border-ai-cyan/25 text-ai-cyan'
            : 'bg-ai-pink/10 border border-ai-pink/25 text-ai-pink'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isBuy ? 'bg-ai-cyan' : 'bg-ai-pink'}`} />
            {action}
        </span>
    );
}

function StatusPill({ status }: { status: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {status}
        </span>
    );
}

export default function DashboardPage() {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchTrades = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/trades', { cache: 'no-store' });
            const json: ApiResponse = await res.json();
            setData(json);
            setLastUpdated(new Date());
        } catch {
            setData({ error: 'Could not connect to the database.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrades();
        const interval = setInterval(fetchTrades, 15000);
        return () => clearInterval(interval);
    }, []);

    const trades = data?.trades ?? [];
    const totalVolume = trades.reduce((s, t) => s + t.amount, 0);
    const buyCount = trades.filter((t) => t.action === 'buy').length;
    const sellCount = trades.filter((t) => t.action === 'sell').length;
    const assets = Array.from(new Set(trades.map((t) => t.asset))).length;

    const stats = [
        { label: 'Total Trades', value: trades.length, icon: '📋', color: 'cyan' },
        { label: 'Buy Orders', value: buyCount, icon: '📈', color: 'green' },
        { label: 'Sell Orders', value: sellCount, icon: '📉', color: 'pink' },
        { label: 'Assets Tracked', value: assets, icon: '🪙', color: 'purple' },
        { label: 'Total Volume', value: `$${totalVolume.toLocaleString()}`, icon: '💰', color: 'cyan' },
    ];

    return (
        <main className="min-h-screen bg-ai-bg">
            <Navbar />

            {/* Ambient orbs */}
            <div className="fixed top-32 right-0 w-96 h-96 bg-ai-purple/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-80 h-80 bg-ai-cyan/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 pt-28 pb-20 relative z-10">
                {/* ── Header ───────────────────────────────────────────────────── */}
                <div className="flex items-start justify-between mb-10">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-ai-cyan/50 mb-2">AIGENT</p>
                        <h1 className="font-display text-3xl md:text-4xl font-700 text-white">
                            Agent Dashboard
                        </h1>
                        <p className="text-white/30 text-sm mt-1">
                            {lastUpdated
                                ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                                : 'Loading trade history...'}
                        </p>
                    </div>
                    <button
                        onClick={fetchTrades}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-bright text-sm text-white/60 hover:text-white transition-all duration-300 disabled:opacity-40 border border-white/[0.06]"
                    >
                        <span className={loading ? 'animate-spin' : ''}>↻</span>
                        {loading ? 'Refreshing' : 'Refresh'}
                    </button>
                </div>

                {/* ── Stats ────────────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    {stats.map((s) => (
                        <div key={s.label} className="glass-bright rounded-2xl p-5 group hover:bg-white/[0.05] transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xl">{s.icon}</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${s.color === 'cyan' ? 'bg-ai-cyan' :
                                    s.color === 'purple' ? 'bg-ai-purple' :
                                        s.color === 'pink' ? 'bg-ai-pink' :
                                            s.color === 'green' ? 'bg-green-400' : 'bg-white/30'
                                    }`} />
                            </div>
                            <p className="text-2xl font-display font-700 text-white">{s.value}</p>
                            <p className="text-xs text-white/30 uppercase tracking-wide mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* ── Trade History Table ──────────────────────────────────────── */}
                <div className="glass-bright rounded-2xl overflow-hidden border border-white/[0.05]">
                    <div className="px-6 py-5 border-b border-white/[0.05] flex items-center justify-between">
                        <div>
                            <h2 className="font-display font-600 text-white">Trade History</h2>
                            <p className="text-xs text-white/30 mt-0.5">Auto-refreshes every 15 seconds</p>
                        </div>
                        {trades.length > 0 && (
                            <span className="px-3 py-1 rounded-full glass text-xs text-ai-cyan border border-ai-cyan/20">
                                {trades.length} trades
                            </span>
                        )}
                    </div>

                    {/* Loading */}
                    {loading && trades.length === 0 && (
                        <div className="py-20 flex flex-col items-center gap-4">
                            <div className="relative w-10 h-10">
                                <div className="absolute inset-0 rounded-full border-2 border-ai-cyan/20 animate-spin-slow" />
                                <div className="absolute inset-2 rounded-full border border-ai-cyan/60 animate-spin" style={{ animationDuration: '1s' }} />
                            </div>
                            <p className="text-white/30 text-sm">Fetching trades...</p>
                        </div>
                    )}

                    {/* Error */}
                    {data?.error && (
                        <div className="py-16 text-center">
                            <p className="text-red-400/80 text-sm">⚠️ {data.error}</p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !data?.error && trades.length === 0 && (
                        <div className="py-24 flex flex-col items-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-ai-cyan/10 rounded-full blur-xl" />
                                <div className="relative text-6xl">🤖</div>
                            </div>
                            <div className="text-center">
                                <h3 className="font-display font-600 text-white text-lg mb-2">No trades yet</h3>
                                <p className="text-white/30 text-sm max-w-xs mx-auto">
                                    {data?.message || 'Start the Telegram bot and send a trade command to see activity here.'}
                                </p>
                            </div>
                            <a
                                href="https://t.me/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-shimmer px-6 py-3 rounded-xl text-sm font-semibold text-ai-bg"
                            >
                                Open Telegram Bot →
                            </a>
                        </div>
                    )}

                    {/* Table */}
                    {trades.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/[0.04]">
                                        {['#', 'Action', 'Asset', 'Amount', 'Condition', 'Status', 'Time'].map((h) => (
                                            <th key={h} className="px-6 py-4 text-left text-xs font-medium text-white/25 uppercase tracking-widest">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {trades.map((t, i) => (
                                        <tr
                                            key={t.id}
                                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150"
                                            style={{ animationDelay: `${i * 0.03}s` }}
                                        >
                                            <td className="px-6 py-4 font-mono text-white/20 text-xs">#{t.id}</td>
                                            <td className="px-6 py-4"><ActionPill action={t.action} /></td>
                                            <td className="px-6 py-4 font-display font-600 text-white">{t.asset}</td>
                                            <td className="px-6 py-4 font-mono text-ai-cyan">${t.amount.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-white/40 max-w-xs truncate text-xs">{t.condition}</td>
                                            <td className="px-6 py-4"><StatusPill status={t.status} /></td>
                                            <td className="px-6 py-4 font-mono text-white/20 text-xs">{t.created_at}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <Link href="/" className="text-sm text-white/20 hover:text-white/50 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>

            <style jsx>{`
        .font-700 { font-weight: 700; }
        .font-600 { font-weight: 600; }
      `}</style>
        </main>
    );
}
