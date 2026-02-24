"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

type WelfareStatus = {
    firstLoginBonus: { claimed: boolean; amount: number };
};

export default function WelfarePage() {
    const { user: clerkUser } = useUser();
    const [status, setStatus] = useState<WelfareStatus | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/user/welfare')
            .then((r) => r.json())
            .then((data) => {
                setStatus(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const claimFirstLogin = async () => {
        setClaiming(true);
        setMessage('');
        try {
            const res = await fetch('/api/user/welfare', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage(`成功領取 $${data.amount.toLocaleString()} 籌碼！`);
                setStatus((prev) =>
                    prev ? { ...prev, firstLoginBonus: { ...prev.firstLoginBonus, claimed: true } } : prev
                );
            } else {
                setMessage(data.error || '領取失敗');
            }
        } catch {
            setMessage('網路錯誤，請稍後重試');
        }
        setClaiming(false);
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
                        <p className="text-xs text-primary/80 uppercase tracking-widest font-semibold">福利中心</p>
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
                        <span className="material-symbols-outlined text-3xl text-accent-gold">redeem</span>
                        <h1 className="text-2xl font-bold text-white">福利中心</h1>
                    </div>

                    {/* First Login Bonus Card */}
                    <div className="rounded-2xl p-6 bg-surface-dark/80 backdrop-blur-sm shadow-xl border border-accent-gold/30 relative overflow-hidden">
                        {/* Glow effect */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-500/5 rounded-full blur-3xl" />

                        <div className="flex items-center gap-4 mb-5 relative">
                            <div className="size-14 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 flex items-center justify-center border border-yellow-500/30">
                                <span className="material-symbols-outlined text-3xl text-yellow-400">savings</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">首次登入禮金</h3>
                                <p className="text-xs text-slate-400">歡迎加入澳門皇家！領取您的專屬新手禮金</p>
                            </div>
                        </div>

                        <div className="bg-black/40 border border-yellow-500/20 rounded-xl px-8 py-5 mb-5 text-center relative">
                            <p className="text-slate-400 text-sm mb-1">獎勵金額</p>
                            <p className="text-3xl font-mono font-bold text-yellow-400">
                                +${(5000).toLocaleString()}
                            </p>
                            <p className="text-yellow-500/60 text-xs mt-1">籌碼</p>
                        </div>

                        {loading ? (
                            <div className="w-full py-3 text-center text-slate-400">載入中...</div>
                        ) : (
                            <button
                                onClick={claimFirstLogin}
                                disabled={claiming || status?.firstLoginBonus.claimed}
                                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-700 text-black font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-yellow-900/30 hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-lg"
                            >
                                {status?.firstLoginBonus.claimed
                                    ? '✓ 已領取'
                                    : claiming
                                      ? '領取中...'
                                      : '立即領取'}
                            </button>
                        )}

                        {message && (
                            <p
                                className={`mt-3 text-center text-sm font-medium ${message.includes('成功') ? 'text-emerald-400' : 'text-red-400'}`}
                            >
                                {message}
                            </p>
                        )}
                    </div>

                    {/* Daily Reward Reminder */}
                    <div className="rounded-2xl p-5 bg-surface-dark/80 backdrop-blur-sm shadow-xl border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <span className="material-symbols-outlined text-2xl text-emerald-400">monetization_on</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-white">每日獎勵</h3>
                                <p className="text-xs text-slate-400">每天可在大廳領取 $10,000 籌碼</p>
                            </div>
                            <Link
                                href="/lobby"
                                className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition-colors border border-emerald-500/20"
                            >
                                前往領取
                            </Link>
                        </div>
                    </div>

                    {/* Tasks Shortcut */}
                    <div className="rounded-2xl p-5 bg-surface-dark/80 backdrop-blur-sm shadow-xl border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <span className="material-symbols-outlined text-2xl text-blue-400">assignment</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-white">連續登入獎勵</h3>
                                <p className="text-xs text-slate-400">每天登入領取遞增獎勵，7天最高 $20,000</p>
                            </div>
                            <Link
                                href="/tasks"
                                className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-bold hover:bg-blue-500/30 transition-colors border border-blue-500/20"
                            >
                                查看任務
                            </Link>
                        </div>
                    </div>

                    {/* Coming Soon */}
                    <div className="rounded-2xl p-5 bg-surface-dark/40 border border-white/5 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">auto_awesome</span>
                        <p className="text-slate-500 text-sm">更多福利即將推出</p>
                    </div>
                </div>
            </main>

            {/* Bottom Nav */}
            <nav className="sticky bottom-0 z-50 w-full bg-surface-darker/95 backdrop-blur-md border-t border-white/10 px-6 py-3">
                <div className="max-w-[1440px] mx-auto flex items-center justify-between md:justify-center gap-2 md:gap-12">
                    <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/lobby">
                        <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">home</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">首頁</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-1 text-primary transition-colors group" href="/welfare">
                        <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">redeem</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">福利</span>
                    </Link>
                    <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/tasks">
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
