"use client";

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

type Tournament = {
    id: string;
    name: string;
    status: string;
    max_players: number;
    buy_in: number;
    prize_1st: string | null;
    prize_2nd: string | null;
    prize_3rd: string | null;
    start_time: string;
    entry_count: number;
};

const ICON_MAP: Record<number, { icon: string; color: string }> = {
    0: { icon: 'local_fire_department', color: 'from-red-700 to-red-900' },
    1: { icon: 'bolt', color: 'from-yellow-600 to-yellow-800' },
    2: { icon: 'playing_cards', color: 'from-green-700 to-green-900' },
    3: { icon: 'emoji_events', color: 'from-purple-700 to-purple-900' },
    4: { icon: 'celebration', color: 'from-pink-600 to-pink-800' },
    5: { icon: 'wb_sunny', color: 'from-orange-600 to-orange-800' },
    6: { icon: 'dark_mode', color: 'from-blue-700 to-blue-900' },
};

export default function TournamentsPage() {
    const { user: clerkUser } = useUser();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    const [registering, setRegistering] = useState<string | null>(null);
    const [registered, setRegistered] = useState<Set<string>>(new Set());
    const [chipBalance, setChipBalance] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/tournaments').then(r => r.json()).then(d => { setTournaments(d.tournaments || []); setLoading(false); }).catch(() => setLoading(false));
        fetch('/api/user/balance').then(r => r.json()).then(d => setChipBalance(d.balance)).catch(() => {});
    }, []);

    // Update clock every second
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const getCountdown = useCallback((startTime: string) => {
        const diff = new Date(startTime).getTime() - now;
        if (diff <= 0) return '即將開始';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, [now]);

    const handleRegister = useCallback(async (tournamentId: string) => {
        if (registering) return;
        setRegistering(tournamentId);
        try {
            const res = await fetch('/api/tournaments/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tournamentId }),
            });
            const data = await res.json();
            if (res.ok) {
                setRegistered(prev => new Set(prev).add(tournamentId));
                if (data.newBalance !== undefined) setChipBalance(data.newBalance);
                setTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, entry_count: t.entry_count + 1 } : t));
            } else {
                alert(data.error || '報名失敗');
            }
        } catch { alert('網路錯誤'); }
        setRegistering(null);
    }, [registering]);

    const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
        upcoming: { label: '即將開始', bg: 'bg-blue-900/40', text: 'text-blue-400', border: 'border-blue-700/40' },
        registering: { label: '報名中', bg: 'bg-green-900/40', text: 'text-green-400', border: 'border-green-700/40' },
        in_progress: { label: '進行中', bg: 'bg-red-900/40', text: 'text-red-400', border: 'border-red-700/40' },
        completed: { label: '已結束', bg: 'bg-slate-800/40', text: 'text-slate-500', border: 'border-slate-700/40' },
        cancelled: { label: '已取消', bg: 'bg-slate-800/40', text: 'text-slate-500', border: 'border-slate-700/40' },
    };

    return (
        <div className="bg-[#1a160a] min-h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC']">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-primary/20 bg-surface-darker/90 backdrop-blur-md px-6 py-3 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-primary to-red-900 text-white shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">emoji_events</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold leading-tight bg-gradient-to-b from-[#FCEda4] via-[#C9A25D] to-[#AA823C] bg-clip-text text-transparent">錦標賽中心</h2>
                        <p className="text-xs text-primary/80 uppercase tracking-widest font-semibold">Tournament Center</p>
                    </div>
                </div>
                <div className="flex flex-1 justify-end gap-6 items-center">
                    <nav className="hidden md:flex items-center gap-8 mr-4">
                        <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/lobby">大廳</Link>
                        <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/">牌桌</Link>
                        <span className="text-accent-gold text-sm font-bold border-b-2 border-accent-gold pb-0.5">錦標賽</span>
                        <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/leaderboard">排行榜</Link>
                    </nav>
                    <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                        {chipBalance !== null && (
                            <div className="flex items-center gap-1.5 bg-black/40 rounded px-3 py-1.5 border border-accent-gold/30">
                                <span className="text-accent-gold text-xs font-bold">$</span>
                                <span className="text-white text-xs font-bold font-mono">{chipBalance.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-accent-gold/50 shadow-md" style={{ backgroundImage: `url('${clerkUser?.imageUrl || 'https://ui-avatars.com/api/?name=Me&background=random'}')` }}></div>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <span className="material-symbols-outlined animate-spin text-3xl text-accent-gold">progress_activity</span>
                    </div>
                ) : tournaments.length === 0 ? (
                    <div className="text-center py-20">
                        <span className="material-symbols-outlined text-5xl text-slate-600 block mb-4">emoji_events</span>
                        <h3 className="text-xl font-bold text-slate-400 mb-2">暫無錦標賽</h3>
                        <p className="text-slate-500 text-sm">管理員尚未建立錦標賽，請稍後再來查看。</p>
                        <Link href="/lobby" className="inline-block mt-6 bg-primary hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                            返回大廳
                        </Link>
                    </div>
                ) : (
                    <div className="max-w-[1200px] mx-auto space-y-3">
                        {tournaments.map((t, idx) => {
                            const style = ICON_MAP[idx % 7];
                            const sc = statusConfig[t.status] || statusConfig.upcoming;
                            const countdown = getCountdown(t.start_time);
                            const diff = new Date(t.start_time).getTime() - now;
                            const isRegistered = registered.has(t.id);
                            const canRegister = (t.status === 'upcoming' || t.status === 'registering') && !isRegistered;

                            return (
                                <div key={t.id} className={`rounded-xl border ${diff <= 60000 && diff > 0 ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]' : 'border-white/5'} bg-surface-dark/60 p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-white/5 transition-colors group`}>
                                    {/* Icon */}
                                    <div className={`size-12 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center shadow-lg shrink-0`}>
                                        <span className="material-symbols-outlined text-white text-xl">{style.icon}</span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-bold text-white text-base truncate group-hover:text-accent-gold transition-colors">{t.name}</h3>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${sc.bg} ${sc.text} border ${sc.border}`}>
                                                {(t.status === 'registering' || t.status === 'in_progress') && <span className="size-1.5 rounded-full bg-current animate-pulse"></span>}
                                                {sc.label}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                                            <span>開賽: {new Date(t.start_time).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            {t.buy_in > 0 && <span>報名費: ${t.buy_in.toLocaleString()}</span>}
                                            {t.prize_1st && <span className="text-accent-gold">冠軍: {t.prize_1st}</span>}
                                        </div>
                                        {/* Prize details */}
                                        {(t.prize_1st || t.prize_2nd || t.prize_3rd) && (
                                            <div className="flex gap-3 mt-1 text-[10px]">
                                                {t.prize_1st && <span className="text-yellow-400">1st: {t.prize_1st}</span>}
                                                {t.prize_2nd && <span className="text-gray-300">2nd: {t.prize_2nd}</span>}
                                                {t.prize_3rd && <span className="text-amber-600">3rd: {t.prize_3rd}</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Players */}
                                    <div className="text-center shrink-0 w-20">
                                        <div className="text-sm font-medium text-white">{t.entry_count}<span className="text-slate-500 text-xs">/{t.max_players}</span></div>
                                        <div className="w-full bg-black/30 rounded-full h-1 mt-1 overflow-hidden">
                                            <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, (t.entry_count / t.max_players) * 100)}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Countdown */}
                                    <div className="text-center shrink-0 w-28">
                                        {t.status === 'in_progress' ? (
                                            <span className="text-red-400 font-bold text-sm animate-pulse">進行中</span>
                                        ) : (
                                            <div className="font-mono text-sm">
                                                <span className={`font-bold ${diff < 1800000 ? 'text-yellow-300' : 'text-white'}`}>
                                                    {countdown}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action */}
                                    <div className="shrink-0">
                                        {canRegister ? (
                                            <button
                                                onClick={() => handleRegister(t.id)}
                                                disabled={registering === t.id}
                                                className="bg-surface-dark hover:bg-primary hover:text-black border border-primary/50 text-primary text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {registering === t.id ? '報名中...' : '報名'}
                                            </button>
                                        ) : isRegistered ? (
                                            <span className="bg-green-900/30 border border-green-500/30 text-green-400 text-xs font-bold px-4 py-2 rounded-lg">已報名</span>
                                        ) : t.status === 'in_progress' ? (
                                            <span className="text-slate-500 text-xs font-bold px-4 py-2">進行中</span>
                                        ) : (
                                            <span className="text-slate-500 text-xs font-bold px-4 py-2">已截止</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="bg-surface-darker/95 backdrop-blur-md border-t border-white/10 px-6 py-2 shrink-0">
                <div className="max-w-[1440px] mx-auto flex items-center justify-center gap-12">
                    <Link className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-primary transition-colors" href="/lobby">
                        <span className="material-symbols-outlined text-lg">home</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide">大廳</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-primary transition-colors" href="/">
                        <span className="material-symbols-outlined text-lg">poker_chip</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide">牌桌</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-0.5 text-accent-gold" href="/tournaments">
                        <span className="material-symbols-outlined text-lg">emoji_events</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide">錦標賽</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-primary transition-colors" href="/leaderboard">
                        <span className="material-symbols-outlined text-lg">leaderboard</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide">排行榜</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
