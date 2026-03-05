'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { useAccount } from 'wagmi';

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
    globalTrades: Trade[];
    personalTrades: Trade[];
    isLinked: boolean;
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
    const { address, isConnected } = useAccount();
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [activeTab, setActiveTab] = useState<'global' | 'personal'>('global');

    // Link modal state
    const [showModal, setShowModal] = useState(false);
    const [syncCode, setSyncCode] = useState('');
    const [linkState, setLinkState] = useState<{ loading: boolean, error?: string, success?: boolean }>({ loading: false });

    const fetchTrades = async () => {
        setLoading(true);
        try {
            const url = address ? `/api/trades?address=${address}` : '/api/trades';
            const res = await fetch(url, { cache: 'no-store' });
            const json: ApiResponse = await res.json();
            setData(json);
            setLastUpdated(new Date());

            // Auto-switch to personal the first time they fetch as connected
            if (activeTab === 'global' && json.isLinked) {
                // Keep it global if user chose it, but it's nice to default to personal if linked
            }
        } catch {
            setData({
                globalTrades: [], personalTrades: [], isLinked: false,
                error: 'Could not connect to the database.'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrades();
        const interval = setInterval(fetchTrades, 15000);
        return () => clearInterval(interval);
    }, [address]);

    const handleLinkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLinkState({ loading: true });
        try {
            const res = await fetch('/api/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: syncCode, address }),
            });
            const resJson = await res.json();
            if (!res.ok) throw new Error(resJson.error || 'Failed to link');

            setLinkState({ loading: false, success: true });
            setTimeout(() => {
                setShowModal(false);
                setLinkState({ loading: false });
                setSyncCode('');
                setActiveTab('personal');
                fetchTrades();
            }, 1500);
        } catch (err: any) {
            setLinkState({ loading: false, error: err.message });
        }
    };

    const isLinked = data?.isLinked || false;
    const trades = activeTab === 'global' ? (data?.globalTrades || []) : (data?.personalTrades || []);
    const totalVolume = trades.reduce((s, t) => s + t.amount, 0);
    const buyCount = trades.filter((t) => t.action === 'buy').length;
    const sellCount = trades.filter((t) => t.action === 'sell').length;
    const assetsTracked = Array.from(new Set(trades.map((t) => t.asset))).length;

    const stats = [
        { label: activeTab === 'global' ? 'Total Trades' : 'My Trades', value: trades.length, icon: '📋', color: 'cyan' },
        { label: 'Buy Orders', value: buyCount, icon: '📈', color: 'green' },
        { label: 'Sell Orders', value: sellCount, icon: '📉', color: 'pink' },
        { label: 'Assets Traded', value: assetsTracked, icon: '🪙', color: 'purple' },
        { label: 'Total Volume', value: `$${totalVolume.toLocaleString()}`, icon: '💰', color: 'cyan' },
    ];

    return (
        <main className="min-h-screen bg-ai-bg relative overflow-x-hidden">
            <Navbar />

            {/* Ambient orbs */}
            <div className="fixed top-32 right-0 w-96 h-96 bg-ai-purple/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-80 h-80 bg-ai-cyan/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Link Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ai-bg/80 backdrop-blur-sm">
                    <div className="glass-bright rounded-2xl w-full max-w-md p-6 border border-white/10 relative">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
                        <h3 className="text-xl font-display font-600 text-white mb-2">Link Telegram</h3>
                        <p className="text-sm text-white/50 mb-6">Type <code className="bg-white/10 px-1.5 py-0.5 rounded text-ai-cyan">/connect</code> in the AIGENT Telegram bot and enter your 6-digit Sync Code below.</p>

                        <form onSubmit={handleLinkSubmit} className="space-y-4">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Enter 6-digit Code (e.g. A1B2C3)"
                                    value={syncCode}
                                    onChange={e => setSyncCode(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/[0.08] text-white rounded-xl px-4 py-3 placeholder-white/30 focus:outline-none focus:border-ai-cyan/50 uppercase tracking-widest text-center"
                                    maxLength={6}
                                />
                            </div>
                            {linkState.error && <p className="text-ai-pink text-xs text-center">{linkState.error}</p>}
                            {linkState.success && <p className="text-green-400 text-xs text-center">✅ Successfully Connected!</p>}
                            <button
                                type="submit"
                                disabled={linkState.loading || syncCode.length < 5 || linkState.success}
                                className="w-full btn-shimmer py-3 rounded-xl font-semibold text-ai-bg disabled:opacity-50"
                            >
                                {linkState.loading ? 'Connecting...' : 'Connect Wallet to Telegram'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 pt-28 pb-20 relative z-10">
                {/* ── Header ───────────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-start justify-between mb-10 gap-6">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-ai-cyan/50 mb-2">AIGENT</p>
                        <h1 className="font-display text-3xl md:text-4xl font-700 text-white flex items-center gap-3">
                            Agent Dashboard
                            {isLinked && <span className="text-xs px-2 py-0.5 rounded border border-green-500/20 bg-green-500/10 text-green-400 font-medium tracking-wide">LINKED ✓</span>}
                        </h1>
                        <p className="text-white/30 text-sm mt-1">
                            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading history...'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {!isLinked && isConnected && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ai-cyan/10 text-ai-cyan text-sm font-semibold hover:bg-ai-cyan/20 border border-ai-cyan/20 transition-all duration-300"
                            >
                                🔗 Link Telegram
                            </button>
                        )}
                        {!isConnected && (
                            <div className="px-5 py-2.5 rounded-xl border border-white/10 glass text-white/50 text-sm">
                                Connect wallet to link your Telegram account
                            </div>
                        )}
                        <button
                            onClick={fetchTrades}
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-bright text-sm text-white/60 hover:text-white transition-all duration-300 disabled:opacity-40 border border-white/[0.06]"
                        >
                            <span className={loading ? 'animate-spin' : ''}>↻</span> Refresh
                        </button>
                    </div>
                </div>

                {/* ── Tabs ──────────────────────────────────────────────────────── */}
                <div className="flex gap-2 mb-6 border-b border-white/5 pb-1">
                    <button
                        onClick={() => setActiveTab('global')}
                        className={`px-4 py-2 font-display font-600 text-sm transition-all duration-300 border-b-2 ${activeTab === 'global' ? 'text-white border-ai-cyan' : 'text-white/40 border-transparent hover:text-white/70'}`}
                    >
                        🌐 Global Feed
                    </button>
                    <button
                        onClick={() => {
                            if (!isConnected) {
                                // If they aren't connected, we can't link, so we trigger modal which will tell them to connect
                                // Or we could just alert them
                                alert("Please connect your Web3 Wallet first (top right button) to link your Telegram account.");
                            } else if (!isLinked) {
                                setShowModal(true);
                            } else {
                                setActiveTab('personal');
                            }
                        }}
                        className={`px-4 py-2 font-display font-600 text-sm transition-all duration-300 border-b-2 ${activeTab === 'personal' ? 'text-white border-ai-cyan' : 'text-white/40 border-transparent hover:text-white/70'}`}
                    >
                        👤 My Trades
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
                            <h2 className="font-display font-600 text-white">
                                {activeTab === 'global' ? 'Global Activity' : 'My Personal Activity'}
                            </h2>
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
                            <p className="text-white/30 text-sm">Fetching block data...</p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && trades.length === 0 && (
                        <div className="py-24 flex flex-col items-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-ai-cyan/10 rounded-full blur-xl" />
                                <div className="relative text-6xl">🤖</div>
                            </div>
                            <div className="text-center">
                                <h3 className="font-display font-600 text-white text-lg mb-2">No trades found</h3>
                                <p className="text-white/30 text-sm max-w-xs mx-auto">
                                    {activeTab === 'global' ? 'Network is quiet. Start the bot and send a trade command!' : 'You have not executed any trades yet.'}
                                </p>
                            </div>
                            <a
                                href="https://t.me/ddjaigentbot"
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
