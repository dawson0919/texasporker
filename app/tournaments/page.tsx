"use client";

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Fixed daily tournament schedule (hours in 24h format)
const TOURNAMENT_SCHEDULE = [
    { id: 'morning-frenzy', name: '晨間狂熱賽', hour: 10, minute: 0, icon: 'wb_sunny', color: 'from-orange-600 to-orange-800', gtd: 5000, buyIn: 20, fee: 2, maxPlayers: 200, blindLevel: '8 分鐘', type: 'NLH 常規', aiPlayers: ['龍王', '賭神高進'] },
    { id: 'noon-blitz', name: '午間閃電賽', hour: 12, minute: 30, icon: 'bolt', color: 'from-yellow-600 to-yellow-800', gtd: 8000, buyIn: 50, fee: 5, maxPlayers: 300, blindLevel: '5 分鐘', type: 'NLH 極速', aiPlayers: ['撲克女王', '全下王'] },
    { id: 'afternoon-classic', name: '午後經典賽', hour: 14, minute: 0, icon: 'playing_cards', color: 'from-green-700 to-green-900', gtd: 15000, buyIn: 100, fee: 10, maxPlayers: 500, blindLevel: '10 分鐘', type: 'NLH 深籌碼', aiPlayers: ['夜鷹', '小刀'] },
    { id: 'happy-hour', name: '歡樂時光賽', hour: 17, minute: 0, icon: 'celebration', color: 'from-pink-600 to-pink-800', gtd: 10000, buyIn: 30, fee: 3, maxPlayers: 400, blindLevel: '6 分鐘', type: 'NLH 常規', aiPlayers: ['幸運星', '阿星'] },
    { id: 'prime-time', name: '黃金時段大賽', hour: 20, minute: 0, icon: 'local_fire_department', color: 'from-red-700 to-red-900', gtd: 50000, buyIn: 200, fee: 20, maxPlayers: 1000, blindLevel: '12 分鐘', type: 'NLH 深籌碼', aiPlayers: ['Dragon88', '賭神高進', '撲克女王'] },
    { id: 'night-turbo', name: '深夜極速賽', hour: 22, minute: 0, icon: 'speed', color: 'from-blue-700 to-blue-900', gtd: 20000, buyIn: 80, fee: 8, maxPlayers: 500, blindLevel: '3 分鐘', type: 'NLH 極速', aiPlayers: ['夜鷹', '全下王'] },
    { id: 'midnight-special', name: '午夜特別賽', hour: 0, minute: 0, icon: 'dark_mode', color: 'from-purple-700 to-purple-900', gtd: 30000, buyIn: 150, fee: 15, maxPlayers: 300, blindLevel: '10 分鐘', type: 'NLH 常規', aiPlayers: ['龍王', '小刀', '幸運星'] },
];

// 10 AI players with stats for leaderboard
const AI_TOURNAMENT_PLAYERS = [
    { name: 'Dragon88', wins: 42, earnings: 385000, avatar: 'D8' },
    { name: '賭神高進', wins: 38, earnings: 320000, avatar: 'GJ' },
    { name: '撲克女王', wins: 35, earnings: 295000, avatar: 'PQ' },
    { name: '全下王', wins: 28, earnings: 210000, avatar: 'AI' },
    { name: '夜鷹', wins: 25, earnings: 185000, avatar: 'NH' },
    { name: '龍王', wins: 22, earnings: 168000, avatar: 'LW' },
    { name: '小刀', wins: 19, earnings: 142000, avatar: 'XD' },
    { name: '幸運星', wins: 17, earnings: 128000, avatar: 'LK' },
    { name: '阿星', wins: 15, earnings: 105000, avatar: 'AX' },
    { name: '高手', wins: 12, earnings: 88000, avatar: 'GS' },
];

type TournamentStatus = 'upcoming' | 'registering' | 'starting' | 'in_progress' | 'completed';

function getNextOccurrence(hour: number, minute: number): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
}

function getTimeDiff(target: Date): { hours: number; minutes: number; seconds: number; totalMs: number } {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
    return {
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        totalMs: diff,
    };
}

function getStatus(nextTime: Date): TournamentStatus {
    const diff = nextTime.getTime() - Date.now();
    if (diff <= 0) return 'in_progress';
    if (diff <= 60000) return 'starting'; // 1 min
    if (diff <= 1800000) return 'registering'; // 30 min
    return 'upcoming';
}

export default function TournamentsPage() {
    const router = useRouter();
    const [now, setNow] = useState(Date.now());
    const [activeTab, setActiveTab] = useState<'today' | 'leaderboard'>('today');

    // Update clock every second
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Auto-redirect when a tournament starts (status = 'starting' and <10s left)
    const checkAutoStart = useCallback(() => {
        for (const t of TOURNAMENT_SCHEDULE) {
            const nextTime = getNextOccurrence(t.hour, t.minute);
            const diff = nextTime.getTime() - Date.now();
            if (diff <= 0 && diff > -5000) {
                router.push('/tournaments/play');
                return;
            }
        }
    }, [router]);

    useEffect(() => {
        const interval = setInterval(checkAutoStart, 3000);
        return () => clearInterval(interval);
    }, [checkAutoStart]);

    const tournaments = TOURNAMENT_SCHEDULE.map(t => {
        const nextTime = getNextOccurrence(t.hour, t.minute);
        const countdown = getTimeDiff(nextTime);
        const status = getStatus(nextTime);
        const fakeRegistered = Math.floor(t.maxPlayers * (0.2 + Math.random() * 0.5));
        return { ...t, nextTime, countdown, status, registered: fakeRegistered + t.aiPlayers.length };
    });

    return (
        <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-primary/20 bg-surface-darker/90 backdrop-blur-md px-6 py-3 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-primary to-red-900 text-white shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">emoji_events</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold leading-tight bg-gradient-to-b from-[#FCEda4] via-[#C9A25D] to-[#AA823C] bg-clip-text text-transparent">錦標賽中心</h2>
                        <p className="text-xs text-primary/80 uppercase tracking-widest font-semibold">每日固定賽程</p>
                    </div>
                </div>
                <div className="flex flex-1 justify-end gap-6 items-center">
                    <nav className="hidden md:flex items-center gap-8 mr-4">
                        <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/lobby">大廳</Link>
                        <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/">牌桌</Link>
                        <span className="text-accent-gold text-sm font-bold border-b-2 border-accent-gold pb-0.5">錦標賽</span>
                        <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/leaderboard">排行榜</Link>
                        <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/history">歷史紀錄</Link>
                    </nav>
                    <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                        <div className="text-xs text-slate-400 bg-black/40 px-3 py-1.5 rounded border border-white/5 font-mono">
                            {new Date(now).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-accent-gold/50 shadow-md" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=You&background=random')` }}></div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-6 px-6 pt-3 shrink-0 border-b border-white/5">
                <button
                    onClick={() => setActiveTab('today')}
                    className={`pb-2 text-sm font-bold transition-colors relative ${activeTab === 'today' ? 'text-accent-gold' : 'text-slate-400 hover:text-white'}`}
                >
                    今日賽程
                    {activeTab === 'today' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-gold"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('leaderboard')}
                    className={`pb-2 text-sm font-bold transition-colors relative ${activeTab === 'leaderboard' ? 'text-accent-gold' : 'text-slate-400 hover:text-white'}`}
                >
                    錦標賽排行榜
                    {activeTab === 'leaderboard' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-gold"></div>}
                </button>
            </div>

            {/* Main */}
            <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'today' ? (
                    <div className="max-w-[1200px] mx-auto space-y-3">
                        {tournaments.map(t => {
                            const statusConfig = {
                                upcoming: { label: '等待中', bg: 'bg-slate-700/40', text: 'text-slate-300', border: 'border-slate-600/40' },
                                registering: { label: '報名中', bg: 'bg-green-900/40', text: 'text-green-400', border: 'border-green-700/40' },
                                starting: { label: '即將開始！', bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-600/50' },
                                in_progress: { label: '進行中', bg: 'bg-red-900/40', text: 'text-red-400', border: 'border-red-700/40' },
                                completed: { label: '已結束', bg: 'bg-slate-800/40', text: 'text-slate-500', border: 'border-slate-700/40' },
                            }[t.status];

                            return (
                                <div key={t.id} className={`rounded-xl border ${t.status === 'starting' ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]' : 'border-white/5'} bg-surface-dark/60 p-4 flex items-center gap-4 hover:bg-white/5 transition-colors group`}>
                                    {/* Icon */}
                                    <div className={`size-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shadow-lg shrink-0`}>
                                        <span className="material-symbols-outlined text-white text-xl">{t.icon}</span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-bold text-white text-base truncate group-hover:text-accent-gold transition-colors">{t.name}</h3>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                                                {(t.status === 'registering' || t.status === 'starting') && <span className="size-1.5 rounded-full bg-current animate-pulse"></span>}
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] text-slate-400">
                                            <span>{t.type}</span>
                                            <span>盲注: {t.blindLevel}</span>
                                            <span>開賽: {String(t.hour).padStart(2, '0')}:{String(t.minute).padStart(2, '0')}</span>
                                            <span className="text-slate-500">AI: {t.aiPlayers.join(', ')}</span>
                                        </div>
                                    </div>

                                    {/* GTD & Buy-in */}
                                    <div className="text-right shrink-0 w-24">
                                        <div className="font-mono font-bold text-accent-gold text-sm">${t.gtd.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-500">GTD</div>
                                    </div>
                                    <div className="text-right shrink-0 w-20">
                                        <div className="font-mono font-bold text-white text-sm">${t.buyIn}+${t.fee}</div>
                                        <div className="text-[10px] text-slate-500">買入</div>
                                    </div>

                                    {/* Players */}
                                    <div className="text-center shrink-0 w-20">
                                        <div className="text-sm font-medium text-white">{t.registered}<span className="text-slate-500 text-xs">/{t.maxPlayers}</span></div>
                                        <div className="w-full bg-black/30 rounded-full h-1 mt-1 overflow-hidden">
                                            <div className="bg-primary h-full rounded-full" style={{ width: `${(t.registered / t.maxPlayers) * 100}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Countdown */}
                                    <div className="text-center shrink-0 w-28">
                                        {t.status === 'in_progress' ? (
                                            <span className="text-red-400 font-bold text-sm animate-pulse">進行中</span>
                                        ) : (
                                            <div className="font-mono text-sm">
                                                <span className={`font-bold ${t.countdown.totalMs < 1800000 ? 'text-yellow-300' : 'text-white'}`}>
                                                    {String(t.countdown.hours).padStart(2, '0')}:{String(t.countdown.minutes).padStart(2, '0')}:{String(t.countdown.seconds).padStart(2, '0')}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action */}
                                    <div className="shrink-0">
                                        {t.status === 'in_progress' ? (
                                            <button onClick={() => router.push('/tournaments/play')} className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                                                觀戰
                                            </button>
                                        ) : t.status === 'starting' ? (
                                            <button onClick={() => router.push('/tournaments/play')} className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold px-4 py-2 rounded-lg transition-colors animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                                                進入
                                            </button>
                                        ) : (
                                            <button onClick={() => router.push('/tournaments/play')} className="bg-surface-dark hover:bg-primary hover:text-black border border-primary/50 text-primary text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                                                報名
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Leaderboard Tab */
                    <div className="max-w-[800px] mx-auto">
                        <div className="rounded-xl bg-surface-dark/60 border border-white/5 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/5 bg-surface-dark/50 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base text-accent-gold">leaderboard</span>
                                    錦標賽總排行 (含 AI 選手)
                                </h3>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">本季排名</span>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="text-[10px] text-slate-500 uppercase bg-black/20">
                                    <tr>
                                        <th className="px-4 py-2 font-bold text-left w-12">#</th>
                                        <th className="px-4 py-2 font-bold text-left">選手</th>
                                        <th className="px-4 py-2 font-bold text-center">冠軍次數</th>
                                        <th className="px-4 py-2 font-bold text-right">總獎金</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {AI_TOURNAMENT_PLAYERS.map((player, idx) => (
                                        <tr key={player.name} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`font-bold text-sm ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white border border-white/10 bg-cover bg-center" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=${player.avatar}&background=random')` }}></div>
                                                    <div>
                                                        <span className="font-medium text-white">{player.name}</span>
                                                        <span className="ml-2 text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold">AI</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-bold text-accent-gold">{player.wins}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-bold font-mono text-emerald-400">${player.earnings.toLocaleString()}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
                    <Link className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-primary transition-colors" href="/history">
                        <span className="material-symbols-outlined text-lg">history</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide">歷史</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
