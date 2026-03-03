'use client';

/**
 * NexusSphere - Dashboard Page
 * Displays mock trade history fetched from the local SQLite database via API.
 */
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

// ── Status badge colors ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-950/50 border border-green-800/50 text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {status}
        </span>
    );
}

// ── Action badge ───────────────────────────────────────────────────────────
function ActionBadge({ action }: { action: string }) {
    const isBuy = action.toLowerCase() === 'buy';
    return (
        <span
            className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase ${isBuy
                    ? 'bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan'
                    : 'bg-red-950/30 border border-red-800/40 text-red-400'
                }`}
        >
            {action}
        </span>
    );
}

// ── Main dashboard component ───────────────────────────────────────────────
export default function DashboardPage() {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTrades = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/trades', { cache: 'no-store' });
            const json: ApiResponse = await res.json();
            setData(json);
        } catch {
            setData({ error: 'Failed to connect to the database.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrades();
        // Auto-refresh every 15 seconds
        const interval = setInterval(fetchTrades, 15000);
        return () => clearInterval(interval);
    }, []);

    const trades = data?.trades ?? [];
    const totalBuy = trades.filter((t) => t.action === 'buy').length;
    const totalSell = trades.filter((t) => t.action === 'sell').length;
    const totalVolume = trades.reduce((sum, t) => sum + t.amount, 0);

    return (
        <main className="min-h-screen bg-dark-bg grid-bg">
            <Navbar />

            <div className="max-w-7xl mx-auto px-6 pt-28 pb-20">
                {/* ── Page header ───────────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-1">
                            Agent <span className="text-neon-cyan">Dashboard</span>
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Real-time view of all mock trades executed by NexusSphere agents.
                        </p>
                    </div>
                    <button
                        onClick={fetchTrades}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10 transition-all duration-300 disabled:opacity-50"
                    >
                        {loading ? '⏳ Loading...' : '🔄 Refresh'}
                    </button>
                </div>

                {/* ── Stats cards ───────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Total Trades', value: trades.length, icon: '📋', color: 'neon-cyan' },
                        { label: 'Buy Orders', value: totalBuy, icon: '📈', color: 'green-400' },
                        { label: 'Total Volume', value: `$${totalVolume.toLocaleString()}`, icon: '💰', color: 'neon-purple' },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="p-5 rounded-2xl border border-dark-border card-bg flex items-center gap-4"
                        >
                            <div className="text-3xl">{stat.icon}</div>
                            <div>
                                <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">{stat.label}</p>
                                <p className="text-2xl font-black text-white">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Trades table ──────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-dark-border card-bg overflow-hidden">
                    <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between">
                        <h2 className="font-bold text-white text-sm">Trade History</h2>
                        <span className="text-xs text-slate-500">Auto-refreshes every 15s</span>
                    </div>

                    {/* Loading state */}
                    {loading && trades.length === 0 && (
                        <div className="p-16 text-center">
                            <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-slate-400 text-sm">Fetching trade history...</p>
                        </div>
                    )}

                    {/* Error state */}
                    {data?.error && (
                        <div className="p-10 text-center">
                            <p className="text-red-400 text-sm">❌ {data.error}</p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !data?.error && trades.length === 0 && (
                        <div className="p-16 text-center">
                            <div className="text-5xl mb-4">🤖</div>
                            <p className="text-white font-semibold mb-2">No trades yet</p>
                            <p className="text-slate-400 text-sm mb-6">
                                {data?.message || 'Start the Telegram bot and send a trade command to populate this table.'}
                            </p>
                            <a
                                href="https://t.me/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 rounded-lg text-sm font-semibold border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-dark-bg transition-all duration-300"
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
                                    <tr className="border-b border-dark-border">
                                        {['ID', 'Action', 'Asset', 'Amount (USD)', 'Condition', 'Status', 'Timestamp'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {trades.map((trade) => (
                                        <tr
                                            key={trade.id}
                                            className="hover:bg-white/[0.02] transition-colors duration-150"
                                        >
                                            <td className="px-6 py-4 text-slate-500 font-mono">#{trade.id}</td>
                                            <td className="px-6 py-4">
                                                <ActionBadge action={trade.action} />
                                            </td>
                                            <td className="px-6 py-4 font-bold text-white">{trade.asset}</td>
                                            <td className="px-6 py-4 text-neon-cyan font-mono">
                                                ${trade.amount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300 max-w-xs truncate">{trade.condition}</td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={trade.status} />
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">{trade.created_at}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Back link ─────────────────────────────────────────────────── */}
                <div className="mt-8 text-center">
                    <Link href="/" className="text-slate-500 hover:text-neon-cyan text-sm transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </main>
    );
}
