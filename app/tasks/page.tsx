"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

type RewardDay = {
    day: number;
    amount: number;
    claimed: boolean;
    available: boolean;
};

type StreakData = {
    currentStreak: number;
    cycleDay: number;
    cycleClaimed: number[];
    rewards: RewardDay[];
    totalLoginDays: number;
};

const DAY_ICONS = ['monetization_on', 'monetization_on', 'monetization_on', 'card_giftcard', 'card_giftcard', 'workspace_premium', 'emoji_events'];

export default function TasksPage() {
    const { user: clerkUser } = useUser();
    const [streakData, setStreakData] = useState<StreakData | null>(null);
    const [claiming, setClaiming] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/user/tasks')
            .then((r) => r.json())
            .then((data) => {
                setStreakData(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const claimDayReward = async (day: number) => {
        setClaiming(day);
        setMessage('');
        try {
            const res = await fetch('/api/user/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(`成功領取第 ${day} 天獎勵 $${data.amount.toLocaleString()}！`);
                // Re-fetch updated data
                const updated = await fetch('/api/user/tasks').then((r) => r.json());
                setStreakData(updated);
            } else {
                setMessage(data.error || '領取失敗');
            }
        } catch {
            setMessage('網路錯誤，請稍後重試');
        }
        setClaiming(null);
    };

    return (
        <div className="bg-[#1a160a] min-h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC']">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-primary/20 bg-surface-darker/90 backdrop-blur-md px-6 py-3 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <Link
                        href="/lobby"
                        className="flex items-center justify-center size-10 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div>
                        <h2 className="text-xl font-bold leading-tight bg-gradient-to-b from-[#FCEda4] via-[#C9A25D] to-[#AA823C] bg-clip-text text-transparent">
                            澳門皇家撲克
                        </h2>
                        <p className="text-xs text-primary/80 uppercase tracking-widest font-semibold">每日任務</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div
                        className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-accent-gold/50 shadow-md"
                        style={{
                            backgroundImage: `url('${clerkUser?.imageUrl || "https://ui-avatars.com/api/?name=Me&background=random"}')`,
                        }}
                    />
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Page Title */}
                    <div className="flex items-center gap-3 mb-2">
                        <span className="material-symbols-outlined text-3xl text-accent-gold">assignment</span>
                        <h1 className="text-2xl font-bold text-white">每日任務</h1>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-slate-400">載入中...</div>
                    ) : streakData ? (
                        <>
                            {/* Streak Banner */}
                            <div className="rounded-2xl p-6 bg-gradient-to-br from-orange-900/30 to-red-900/20 border border-orange-500/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
                                <div className="flex items-center gap-4 relative">
                                    <div className="size-16 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                                        <span className="material-symbols-outlined text-4xl text-orange-400">local_fire_department</span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-orange-300/80 font-medium">連續登入</p>
                                        <p className="text-4xl font-bold text-white">
                                            {streakData.currentStreak}{' '}
                                            <span className="text-lg text-orange-300/60 font-normal">天</span>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            累計登入 {streakData.totalLoginDays} 天
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 7-Day Reward Grid */}
                            <div className="rounded-2xl p-5 bg-surface-dark/80 backdrop-blur-sm shadow-xl border border-white/10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-accent-gold text-xl">calendar_month</span>
                                        7日登入獎勵
                                    </h3>
                                    <span className="text-xs text-slate-400">
                                        第 {streakData.cycleDay}/7 天
                                    </span>
                                </div>

                                <div className="grid grid-cols-7 gap-1.5 sm:gap-2 md:gap-3">
                                    {streakData.rewards.map((reward) => {
                                        const isClaimed = reward.claimed;
                                        const isAvailable = reward.available;
                                        const isLocked = !isClaimed && !isAvailable;
                                        const isClaiming = claiming === reward.day;

                                        return (
                                            <button
                                                key={reward.day}
                                                disabled={!isAvailable || isClaiming}
                                                onClick={() => isAvailable && claimDayReward(reward.day)}
                                                className={`relative rounded-xl p-2 sm:p-3 flex flex-col items-center text-center border transition-all ${
                                                    isClaimed
                                                        ? 'bg-emerald-900/20 border-emerald-500/30'
                                                        : isAvailable
                                                          ? 'bg-yellow-500/10 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.15)] hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.25)] cursor-pointer'
                                                          : 'bg-surface-dark/60 border-white/5 opacity-40'
                                                }`}
                                            >
                                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                    Day {reward.day}
                                                </span>
                                                <div
                                                    className={`size-8 sm:size-10 rounded-full flex items-center justify-center mb-1.5 ${
                                                        isClaimed
                                                            ? 'bg-emerald-500/20'
                                                            : isAvailable
                                                              ? 'bg-yellow-500/20'
                                                              : 'bg-white/5'
                                                    }`}
                                                >
                                                    <span
                                                        className={`material-symbols-outlined text-lg sm:text-xl ${
                                                            isClaimed
                                                                ? 'text-emerald-400'
                                                                : isAvailable
                                                                  ? 'text-yellow-400'
                                                                  : 'text-slate-600'
                                                        }`}
                                                    >
                                                        {isClaimed
                                                            ? 'check_circle'
                                                            : isLocked
                                                              ? 'lock'
                                                              : DAY_ICONS[reward.day - 1]}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`text-[10px] sm:text-sm font-bold ${
                                                        isClaimed
                                                            ? 'text-emerald-400'
                                                            : isAvailable
                                                              ? 'text-yellow-400'
                                                              : 'text-slate-500'
                                                    }`}
                                                >
                                                    ${reward.amount >= 1000 ? `${reward.amount / 1000}K` : reward.amount}
                                                </span>
                                                {isAvailable && !isClaimed && (
                                                    <span className="mt-0.5 text-[8px] sm:text-[9px] text-yellow-400 font-bold animate-pulse">
                                                        {isClaiming ? '...' : '可領取'}
                                                    </span>
                                                )}
                                                {isClaimed && (
                                                    <span className="mt-0.5 text-[8px] sm:text-[9px] text-emerald-400/60">
                                                        已領取
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Cycle total info */}
                                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-xs text-slate-400">7天總獎勵</span>
                                    <span className="text-sm font-bold text-yellow-400">$51,000</span>
                                </div>
                            </div>

                            {/* Message */}
                            {message && (
                                <div
                                    className={`rounded-xl p-4 text-center text-sm font-medium ${
                                        message.includes('成功')
                                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                    }`}
                                >
                                    {message}
                                </div>
                            )}

                            {/* Rules */}
                            <div className="rounded-2xl p-5 bg-surface-dark/40 border border-white/5">
                                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-400 text-lg">info</span>
                                    活動規則
                                </h3>
                                <ul className="space-y-2 text-xs text-slate-400">
                                    <li className="flex items-start gap-2">
                                        <span className="text-accent-gold mt-0.5">•</span>
                                        每天登入即可累計連續登入天數
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-accent-gold mt-0.5">•</span>
                                        連續登入天數越多，獎勵越豐厚
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-accent-gold mt-0.5">•</span>
                                        中斷登入將重置連續天數與獎勵週期
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-accent-gold mt-0.5">•</span>
                                        完成7天週期後自動開始新一輪
                                    </li>
                                </ul>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12 text-slate-400">載入失敗，請重新整理頁面</div>
                    )}
                </div>
            </main>

            {/* Bottom Nav */}
            <nav className="sticky bottom-0 z-50 w-full bg-surface-darker/95 backdrop-blur-md border-t border-white/10 px-6 py-3">
                <div className="max-w-[1440px] mx-auto flex items-center justify-between md:justify-center gap-2 md:gap-12">
                    <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/lobby">
                        <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">home</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">首頁</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/welfare">
                        <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">redeem</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">福利</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-1 text-primary transition-colors group" href="/tasks">
                        <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">assignment</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">任務</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/leaderboard">
                        <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">leaderboard</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">排行榜</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/lobby">
                        <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">settings</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">設置</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
