"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';

type UserRecord = {
    id: string;
    auth_id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    chip_balance: number;
    last_refill_time: string | null;
    created_at: string;
};

export default function AdminPage() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [addAmount, setAddAmount] = useState(10000);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.status === 403) {
                setError('無權限訪問管理面板。僅限管理員使用。');
                setLoading(false);
                return;
            }
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setUsers(data.users || []);
        } catch {
            setError('無法載入用戶列表');
        }
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleAddChips = async (userId: string, amount: number) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, amount, action: 'add' }),
            });
            const data = await res.json();
            if (res.ok) {
                setActionMsg(`成功增加 $${amount.toLocaleString()} 籌碼！新餘額: $${data.newBalance.toLocaleString()}`);
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, chip_balance: data.newBalance } : u));
                setEditingUser(null);
            } else {
                setActionMsg(`錯誤: ${data.error}`);
            }
        } catch {
            setActionMsg('操作失敗');
        }
        setTimeout(() => setActionMsg(null), 3000);
    };

    const handleSetBalance = async (userId: string, amount: number) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, amount, action: 'set' }),
            });
            const data = await res.json();
            if (res.ok) {
                setActionMsg(`餘額已設定為 $${data.newBalance.toLocaleString()}`);
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, chip_balance: data.newBalance } : u));
                setEditingUser(null);
            } else {
                setActionMsg(`錯誤: ${data.error}`);
            }
        } catch {
            setActionMsg('操作失敗');
        }
        setTimeout(() => setActionMsg(null), 3000);
    };

    if (loading) {
        return (
            <div className="bg-[#1a160a] h-screen flex items-center justify-center text-white font-['Noto_Sans_TC']">
                <div className="text-center">
                    <span className="material-symbols-outlined animate-spin text-4xl text-accent-gold block mb-3">progress_activity</span>
                    <p className="text-slate-400">載入管理面板...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-[#1a160a] h-screen flex items-center justify-center text-white font-['Noto_Sans_TC']">
                <div className="text-center max-w-md">
                    <span className="material-symbols-outlined text-5xl text-red-500 block mb-4">gpp_bad</span>
                    <h2 className="text-xl font-bold mb-2">{error}</h2>
                    <p className="text-slate-400 text-sm mb-6">請使用管理員帳號登入</p>
                    <Link href="/lobby" className="bg-primary hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">返回大廳</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-red-500/30 bg-[#1a0505]/95 backdrop-blur-md px-6 py-3 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 text-white shadow-lg">
                        <span className="material-symbols-outlined">admin_panel_settings</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-red-400">管理員面板</h2>
                        <p className="text-[10px] text-red-300/60 uppercase tracking-widest font-bold">Admin Control Panel</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-xs text-slate-400 bg-black/40 px-3 py-1.5 rounded border border-white/5">
                        <span className="text-slate-500">在線用戶:</span> <span className="text-white font-bold">{users.length}</span>
                    </div>
                    <Link href="/lobby" className="bg-surface-dark hover:bg-white/10 border border-white/10 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                        返回大廳
                    </Link>
                </div>
            </header>

            {/* Action message toast */}
            {actionMsg && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-green-500/90 text-white text-sm font-bold px-6 py-2 rounded-lg shadow-lg animate-fade-in-up">
                    {actionMsg}
                </div>
            )}

            {/* Main content */}
            <main className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-3 shrink-0">
                    <div className="rounded-xl p-3 bg-surface-dark/60 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">總用戶數</p>
                        <p className="text-2xl font-bold text-white">{users.length}</p>
                    </div>
                    <div className="rounded-xl p-3 bg-surface-dark/60 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">總籌碼流通</p>
                        <p className="text-2xl font-bold text-accent-gold">${users.reduce((s, u) => s + u.chip_balance, 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl p-3 bg-surface-dark/60 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">最高餘額</p>
                        <p className="text-2xl font-bold text-emerald-400">${Math.max(...users.map(u => u.chip_balance), 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl p-3 bg-surface-dark/60 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">平均餘額</p>
                        <p className="text-2xl font-bold text-blue-400">${users.length > 0 ? Math.floor(users.reduce((s, u) => s + u.chip_balance, 0) / users.length).toLocaleString() : '0'}</p>
                    </div>
                </div>

                {/* Users Table */}
                <div className="flex-1 rounded-xl bg-surface-dark/40 border border-white/5 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center shrink-0 bg-surface-dark/50">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-red-400">group</span>
                            用戶管理
                        </h3>
                        <button onClick={fetchUsers} className="text-[10px] text-slate-400 hover:text-white bg-black/30 px-3 py-1 rounded border border-white/5 transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">refresh</span> 刷新
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="text-[10px] text-slate-500 uppercase bg-black/30 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2 font-bold text-left">用戶</th>
                                    <th className="px-4 py-2 font-bold text-left">Email</th>
                                    <th className="px-4 py-2 font-bold text-right">籌碼餘額</th>
                                    <th className="px-4 py-2 font-bold text-left">註冊時間</th>
                                    <th className="px-4 py-2 font-bold text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="size-8 rounded-full bg-slate-700 bg-cover bg-center border border-white/10" style={{ backgroundImage: `url('${user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=random`}')` }}></div>
                                                <span className="font-medium text-white">{user.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 text-xs">{user.email}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-bold font-mono text-accent-gold">${user.chip_balance.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-TW') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {editingUser === user.id ? (
                                                <div className="flex items-center gap-2 justify-center">
                                                    <input
                                                        type="number"
                                                        value={addAmount}
                                                        onChange={e => setAddAmount(Number(e.target.value))}
                                                        className="w-24 bg-black/50 border border-accent-gold/30 text-white text-xs px-2 py-1 rounded text-right font-mono focus:outline-none focus:border-accent-gold"
                                                    />
                                                    <button
                                                        onClick={() => handleAddChips(user.id, addAmount)}
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                                                    >
                                                        +增加
                                                    </button>
                                                    <button
                                                        onClick={() => handleSetBalance(user.id, addAmount)}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                                                    >
                                                        設定
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingUser(null)}
                                                        className="bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setEditingUser(user.id); setAddAmount(10000); }}
                                                    className="bg-accent-gold/10 hover:bg-accent-gold/20 border border-accent-gold/30 text-accent-gold text-[10px] font-bold px-3 py-1 rounded transition-colors"
                                                >
                                                    調整籌碼
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-500">暫無用戶紀錄</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
