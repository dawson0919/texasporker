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
    created_at: string;
};

export default function AdminPage() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [addAmount, setAddAmount] = useState(10000);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    // Tournament state
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newT, setNewT] = useState({ name: '', start_time: '', max_players: 100, buy_in: 500, prize_1st: '', prize_2nd: '', prize_3rd: '' });
    const [creatingT, setCreatingT] = useState(false);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [entryUsers, setEntryUsers] = useState<Array<{ user_id: string; display_name: string }>>([]);
    const [winners, setWinners] = useState<{ first: string; second: string; third: string }>({ first: '', second: '', third: '' });

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

    const fetchTournaments = async () => {
        try {
            const res = await fetch('/api/admin/tournaments');
            if (res.ok) {
                const data = await res.json();
                setTournaments(data.tournaments || []);
            }
        } catch { /* ignore */ }
    };

    const createTournament = async () => {
        if (!newT.name || !newT.start_time) { setActionMsg('請填寫名稱和開始時間'); setTimeout(() => setActionMsg(null), 3000); return; }
        setCreatingT(true);
        try {
            const res = await fetch('/api/admin/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newT),
            });
            if (res.ok) {
                setActionMsg('錦標賽已建立！');
                setShowCreateForm(false);
                setNewT({ name: '', start_time: '', max_players: 100, buy_in: 500, prize_1st: '', prize_2nd: '', prize_3rd: '' });
                fetchTournaments();
            } else {
                const d = await res.json();
                setActionMsg(`錯誤: ${d.error}`);
            }
        } catch { setActionMsg('建立失敗'); }
        setCreatingT(false);
        setTimeout(() => setActionMsg(null), 3000);
    };

    const cancelTournament = async (id: string) => {
        try {
            const res = await fetch('/api/admin/tournaments/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tournamentId: id }),
            });
            if (res.ok) { setActionMsg('已取消'); fetchTournaments(); }
        } catch { setActionMsg('操作失敗'); }
        setTimeout(() => setActionMsg(null), 3000);
    };

    const openComplete = async (t: Tournament) => {
        setCompletingId(t.id);
        setWinners({ first: '', second: '', third: '' });
        // Fetch entry users for this tournament
        try {
            const res = await fetch(`/api/admin/tournaments?entries=${t.id}`);
            // We'll use the users list to match - for simplicity, map from users state
            setEntryUsers(users.map(u => ({ user_id: u.id, display_name: u.name || u.email })));
        } catch { /* ignore */ }
    };

    const completeTournament = async () => {
        if (!completingId) return;
        const tournament = tournaments.find(t => t.id === completingId);
        const winnersList: Array<{ userId: string; placement: number; prize: string }> = [];
        if (winners.first) winnersList.push({ userId: winners.first, placement: 1, prize: tournament?.prize_1st || '冠軍' });
        if (winners.second) winnersList.push({ userId: winners.second, placement: 2, prize: tournament?.prize_2nd || '亞軍' });
        if (winners.third) winnersList.push({ userId: winners.third, placement: 3, prize: tournament?.prize_3rd || '季軍' });

        try {
            const res = await fetch('/api/admin/tournaments/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tournamentId: completingId, winners: winnersList }),
            });
            if (res.ok) {
                setActionMsg('錦標賽已完成！');
                setCompletingId(null);
                fetchTournaments();
            } else { setActionMsg('操作失敗'); }
        } catch { setActionMsg('操作失敗'); }
        setTimeout(() => setActionMsg(null), 3000);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchTournaments(); }, []);

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
        <div className="bg-[#1a160a] min-h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC']">
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
            <main className="flex-1 p-4 flex flex-col gap-4">
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

                {/* Tournament Management */}
                <div className="rounded-xl bg-surface-dark/40 border border-white/5 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center shrink-0 bg-surface-dark/50">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-accent-gold">emoji_events</span>
                            錦標賽管理
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={fetchTournaments} className="text-[10px] text-slate-400 hover:text-white bg-black/30 px-3 py-1 rounded border border-white/5 transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">refresh</span> 刷新
                            </button>
                            <button onClick={() => setShowCreateForm(!showCreateForm)} className="text-[10px] text-accent-gold hover:text-yellow-300 bg-accent-gold/10 px-3 py-1 rounded border border-accent-gold/30 transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">add</span> 新增錦標賽
                            </button>
                        </div>
                    </div>

                    {/* Create form */}
                    {showCreateForm && (
                        <div className="px-4 py-4 border-b border-white/5 bg-black/20">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">名稱 *</label>
                                    <input type="text" value={newT.name} onChange={e => setNewT(p => ({ ...p, name: e.target.value }))} placeholder="例: 龍之盃錦標賽" className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">開始時間 *</label>
                                    <input type="datetime-local" value={newT.start_time} onChange={e => setNewT(p => ({ ...p, start_time: e.target.value }))} className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">報名上限</label>
                                    <input type="number" value={newT.max_players} onChange={e => setNewT(p => ({ ...p, max_players: Number(e.target.value) }))} className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">報名費 (籌碼)</label>
                                    <input type="number" value={newT.buy_in} onChange={e => setNewT(p => ({ ...p, buy_in: Number(e.target.value) }))} className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">冠軍獎品</label>
                                    <input type="text" value={newT.prize_1st} onChange={e => setNewT(p => ({ ...p, prize_1st: e.target.value }))} placeholder="例: $50,000 籌碼" className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">亞軍獎品</label>
                                    <input type="text" value={newT.prize_2nd} onChange={e => setNewT(p => ({ ...p, prize_2nd: e.target.value }))} placeholder="例: $20,000 籌碼" className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">季軍獎品</label>
                                    <input type="text" value={newT.prize_3rd} onChange={e => setNewT(p => ({ ...p, prize_3rd: e.target.value }))} placeholder="例: $10,000 籌碼" className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={createTournament} disabled={creatingT} className="bg-accent-gold hover:bg-yellow-500 text-black text-xs font-bold px-4 py-2 rounded transition-colors disabled:opacity-50">
                                    {creatingT ? '建立中...' : '建立錦標賽'}
                                </button>
                                <button onClick={() => setShowCreateForm(false)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-4 py-2 rounded transition-colors">
                                    取消
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Complete tournament modal */}
                    {completingId && (
                        <div className="px-4 py-4 border-b border-white/5 bg-emerald-900/20">
                            <h4 className="text-xs font-bold text-emerald-400 mb-3">選擇前三名得獎者</h4>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">冠軍</label>
                                    <select value={winners.first} onChange={e => setWinners(p => ({ ...p, first: e.target.value }))} className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold">
                                        <option value="">-- 選擇 --</option>
                                        {entryUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">亞軍</label>
                                    <select value={winners.second} onChange={e => setWinners(p => ({ ...p, second: e.target.value }))} className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold">
                                        <option value="">-- 選擇 --</option>
                                        {entryUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">季軍</label>
                                    <select value={winners.third} onChange={e => setWinners(p => ({ ...p, third: e.target.value }))} className="w-full bg-black/50 border border-white/10 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-accent-gold">
                                        <option value="">-- 選擇 --</option>
                                        {entryUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={completeTournament} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded transition-colors">
                                    確認完成
                                </button>
                                <button onClick={() => setCompletingId(null)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-4 py-2 rounded transition-colors">
                                    取消
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tournament list */}
                    <div className="overflow-y-auto max-h-[400px]">
                        <table className="w-full text-sm">
                            <thead className="text-[10px] text-slate-500 uppercase bg-black/30 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2 font-bold text-left">名稱</th>
                                    <th className="px-4 py-2 font-bold text-center">狀態</th>
                                    <th className="px-4 py-2 font-bold text-left">開始時間</th>
                                    <th className="px-4 py-2 font-bold text-right">報名費</th>
                                    <th className="px-4 py-2 font-bold text-center">報名人數</th>
                                    <th className="px-4 py-2 font-bold text-left">獎品</th>
                                    <th className="px-4 py-2 font-bold text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {tournaments.map(t => (
                                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                t.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                t.status === 'registering' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                t.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                t.status === 'completed' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' :
                                                'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                                {t.status === 'upcoming' ? '即將開始' : t.status === 'registering' ? '報名中' : t.status === 'in_progress' ? '進行中' : t.status === 'completed' ? '已完成' : '已取消'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(t.start_time).toLocaleString('zh-TW')}</td>
                                        <td className="px-4 py-3 text-right font-mono text-accent-gold text-xs">${t.buy_in.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center text-xs">{t.entry_count}/{t.max_players}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">{[t.prize_1st, t.prize_2nd, t.prize_3rd].filter(Boolean).join(' / ') || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            {(t.status === 'upcoming' || t.status === 'registering' || t.status === 'in_progress') && (
                                                <div className="flex gap-1 justify-center">
                                                    <button onClick={() => openComplete(t)} className="bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors">
                                                        完成
                                                    </button>
                                                    <button onClick={() => cancelTournament(t.id)} className="bg-red-600/80 hover:bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors">
                                                        取消
                                                    </button>
                                                </div>
                                            )}
                                            {t.status === 'completed' && <span className="text-slate-500 text-[10px]">已結束</span>}
                                            {t.status === 'cancelled' && <span className="text-slate-500 text-[10px]">已取消</span>}
                                        </td>
                                    </tr>
                                ))}
                                {tournaments.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">尚未建立錦標賽</td>
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
