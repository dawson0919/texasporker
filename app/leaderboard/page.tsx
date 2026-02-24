"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Modal } from '../components/Modal';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  profit: number;
  games: number;
  vip: string;
}

interface MyStats {
  rank: number;
  profit: number;
  games: number;
  vip: string;
}

export default function LeaderboardPage() {
  const { user: clerkUser } = useUser();
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'friends' | 'weekly'>('global');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyBoard, setWeeklyBoard] = useState<LeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<MyStats>({ rank: 0, profit: 0, games: 0, vip: '普通' });
  const [weeklyMyStats, setWeeklyMyStats] = useState<MyStats>({ rank: 0, profit: 0, games: 0, vip: '普通' });
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [globalRes, weeklyRes] = await Promise.all([
          fetch('/api/leaderboard?mode=global'),
          fetch('/api/leaderboard?mode=weekly'),
        ]);
        if (globalRes.ok) {
          const data = await globalRes.json();
          setLeaderboard(data.leaderboard || []);
          setMyStats(data.me);
          setTotalPlayers(data.totalPlayers);
        }
        if (weeklyRes.ok) {
          const data = await weeklyRes.json();
          setWeeklyBoard(data.leaderboard || []);
          setWeeklyMyStats(data.me);
        }
      } catch { /* offline */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  const currentBoard = activeTab === 'weekly' ? weeklyBoard : leaderboard;
  const currentMyStats = activeTab === 'weekly' ? weeklyMyStats : myStats;
  const top3 = currentBoard.slice(0, 3);
  const rest = currentBoard.slice(3);

  const avatarFor = (entry: LeaderboardEntry) =>
    entry.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name.slice(0, 2))}&background=random`;

  const formatProfit = (p: number) => {
    if (Math.abs(p) >= 1000000) return `$${(p / 1000000).toFixed(1)}M`;
    if (Math.abs(p) >= 1000) return `$${(p / 1000).toFixed(1)}K`;
    return `$${p.toLocaleString()}`;
  };

  const vipStyle = (vip: string) => {
    if (vip.includes('鑽石')) return 'bg-cyan-900/30 text-cyan-200 border-cyan-700/50';
    if (vip.includes('白金')) return 'bg-purple-900/30 text-purple-200 border-purple-700/50';
    if (vip.includes('黃金')) return 'bg-yellow-900/30 text-yellow-200 border-yellow-700/50';
    if (vip.includes('白銀')) return 'bg-slate-700/30 text-slate-200 border-slate-500/50';
    if (vip.includes('青銅')) return 'bg-orange-900/30 text-orange-200 border-orange-700/50';
    return 'bg-slate-800 text-slate-300 border-slate-600';
  };

  return (
    <div className="bg-[#1a160a] min-h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-x-hidden">
      <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-[#493f22] bg-surface-dark/95 backdrop-blur-md px-10 py-3 shadow-lg">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4 text-primary">
            <div className="size-8 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl">playing_cards</span>
            </div>
            <h2 className="text-white text-xl font-bold leading-tight tracking-[-0.015em]">皇家德州撲克</h2>
          </div>
          <nav className="hidden lg:flex items-center gap-9">
            <Link className="text-white/80 hover:text-primary transition-colors text-sm font-medium leading-normal" href="/lobby">大廳</Link>
            <Link className="text-white/80 hover:text-primary transition-colors text-sm font-medium leading-normal" href="/">牌桌</Link>
            <Link className="text-primary text-sm font-bold leading-normal relative after:content-[''] after:absolute after:-bottom-5 after:left-0 after:w-full after:h-0.5 after:bg-primary" href="/leaderboard">排行榜</Link>
            <Link className="text-white/80 hover:text-primary transition-colors text-sm font-medium leading-normal" href="/tournaments">錦標賽</Link>
            <button onClick={() => setIsComingSoonModalOpen(true)} className="text-white/80 hover:text-primary transition-colors text-sm font-medium leading-normal">VIP 俱樂部</button>
          </nav>
        </div>
        <div className="flex flex-1 justify-end gap-6 items-center">
          <div className="flex gap-3">
            <button className="flex items-center justify-center rounded-xl size-10 bg-[#2a2415] hover:bg-[#3d341f] text-white transition-colors border border-[#493f22]">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            <div className="relative group cursor-pointer">
              <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-primary" style={{ backgroundImage: `url('${clerkUser?.imageUrl || 'https://ui-avatars.com/api/?name=Me&background=random'}')` }}></div>
              <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-[#1a160a]"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col relative w-full max-w-[1440px] mx-auto px-4 md:px-8 py-8">
        <div className="fixed inset-0 z-[-2] bg-background-dark"></div>

        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 mb-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-primary tracking-tight">排行榜</h1>
            <p className="text-gold-accent text-lg">
              {activeTab === 'weekly' ? '本週盈利排名' : '全球盈利排名'} | 共 {totalPlayers} 名玩家
            </p>
          </div>
          <div className="flex gap-3 bg-surface-dark/50 p-1.5 rounded-xl border border-[#493f22]">
            <button onClick={() => setActiveTab('global')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'global' ? 'bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:scale-105' : 'text-gold-accent hover:text-white hover:bg-white/5'}`}>全球排行</button>
            <button onClick={() => setActiveTab('friends')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'friends' ? 'bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:scale-105' : 'text-gold-accent hover:text-white hover:bg-white/5'}`}>好友</button>
            <button onClick={() => setActiveTab('weekly')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'weekly' ? 'bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:scale-105' : 'text-gold-accent hover:text-white hover:bg-white/5'}`}>每週排行</button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-500">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
            <p>載入排行榜中...</p>
          </div>
        ) : activeTab === 'friends' ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 min-h-[500px]">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">group_off</span>
            <p>目前沒有好友資料，邀請好友一起遊玩吧！</p>
            <button className="mt-6 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-bold tracking-widest border border-white/20">邀請好友</button>
          </div>
        ) : currentBoard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 min-h-[500px]">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">leaderboard</span>
            <p>{activeTab === 'weekly' ? '本週還沒有遊戲記錄' : '目前還沒有遊戲記錄'}</p>
            <Link href="/" className="mt-6 px-8 py-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors font-bold border border-primary/30">去玩一局</Link>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length >= 3 && (
              <div className="relative w-full mb-12">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
                <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 min-h-[420px] pb-8">
                  {/* 2nd place */}
                  <div className="order-2 md:order-1 flex flex-col items-center w-full max-w-[280px] relative group">
                    <div className="relative z-10 mb-4 transform group-hover:-translate-y-2 transition-transform duration-300">
                      <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-slate-300 p-1 bg-gradient-to-b from-slate-200 to-slate-400 shadow-[0_0_20px_rgba(203,213,225,0.3)]">
                        <div className="w-full h-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url('${avatarFor(top3[1])}')` }}></div>
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-900 font-bold px-3 py-0.5 rounded-full text-sm shadow-lg border border-white">第 2 名</div>
                    </div>
                    <div className="w-full bg-card-gradient border border-white/10 rounded-t-2xl p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden h-64 justify-end">
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-500/10 to-transparent pointer-events-none"></div>
                      <h3 className="text-xl font-bold text-white mb-1">{top3[1].name}</h3>
                      <div className="flex items-center gap-1 mb-3 text-sm text-gold-accent">
                        <span className="material-symbols-outlined text-sm">diamond</span>
                        <span>{top3[1].vip}</span>
                      </div>
                      <p className="text-2xl font-mono text-primary font-bold tracking-tight">{formatProfit(top3[1].profit)}</p>
                      <p className="text-xs text-white/40 mt-1">{top3[1].games.toLocaleString()} 局</p>
                    </div>
                  </div>

                  {/* 1st place */}
                  <div className="order-1 md:order-2 flex flex-col items-center w-full max-w-[320px] relative z-20 -mt-12 md:-mt-0 group">
                    <div className="absolute -top-16 text-primary animate-bounce">
                      <span className="material-symbols-outlined text-5xl drop-shadow-[0_0_15px_rgba(244,196,52,0.6)]">crown</span>
                    </div>
                    <div className="relative z-10 mb-4 transform group-hover:-translate-y-2 transition-transform duration-300">
                      <div className="w-36 h-36 md:w-44 md:h-44 rounded-full border-4 border-primary p-1 bg-gradient-to-b from-[#fcd34d] to-[#b45309] shadow-[0_0_30px_rgba(244,196,52,0.4)]">
                        <div className="w-full h-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url('${avatarFor(top3[0])}')` }}></div>
                      </div>
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-primary text-black font-bold px-4 py-1 rounded-full text-base shadow-lg border-2 border-[#fff7ed] min-w-[3rem] text-center">第 1 名</div>
                    </div>
                    <div className="w-full bg-gradient-to-b from-[#3a311c] to-[#1a160a] border border-primary/30 rounded-t-2xl p-8 flex flex-col items-center text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden h-80 justify-end">
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                      <h3 className="text-2xl font-bold text-white mb-1">{top3[0].name}</h3>
                      <div className="flex items-center gap-1 mb-4 text-sm text-primary">
                        <span className="material-symbols-outlined text-sm">workspace_premium</span>
                        <span>{top3[0].vip}</span>
                      </div>
                      <p className="text-3xl md:text-4xl font-mono text-primary font-black tracking-tighter drop-shadow-md">{formatProfit(top3[0].profit)}</p>
                      <p className="text-xs text-white/40 mt-1">{top3[0].games.toLocaleString()} 局</p>
                    </div>
                  </div>

                  {/* 3rd place */}
                  <div className="order-3 flex flex-col items-center w-full max-w-[280px] relative group">
                    <div className="relative z-10 mb-4 transform group-hover:-translate-y-2 transition-transform duration-300">
                      <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-orange-300 p-1 bg-gradient-to-b from-orange-200 to-orange-700 shadow-[0_0_20px_rgba(194,65,12,0.3)]">
                        <div className="w-full h-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url('${avatarFor(top3[2])}')` }}></div>
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-400 text-white font-bold px-3 py-0.5 rounded-full text-sm shadow-lg border border-orange-200">第 3 名</div>
                    </div>
                    <div className="w-full bg-card-gradient border border-white/10 rounded-t-2xl p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden h-56 justify-end">
                      <div className="absolute inset-0 bg-gradient-to-t from-orange-900/10 to-transparent pointer-events-none"></div>
                      <h3 className="text-xl font-bold text-white mb-1">{top3[2].name}</h3>
                      <div className="flex items-center gap-1 mb-3 text-sm text-gold-accent">
                        <span className="material-symbols-outlined text-sm">stars</span>
                        <span>{top3[2].vip}</span>
                      </div>
                      <p className="text-2xl font-mono text-primary font-bold tracking-tight">{formatProfit(top3[2].profit)}</p>
                      <p className="text-xs text-white/40 mt-1">{top3[2].games.toLocaleString()} 局</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If fewer than 3, show simple list for top entries */}
            {top3.length > 0 && top3.length < 3 && (
              <div className="w-full mb-8">
                <div className="flex flex-wrap justify-center gap-6">
                  {top3.map((entry, idx) => (
                    <div key={entry.userId} className="bg-surface-dark/60 border border-primary/30 rounded-2xl p-6 flex flex-col items-center min-w-[200px]">
                      <div className="w-20 h-20 rounded-full border-3 border-primary bg-cover bg-center mb-3" style={{ backgroundImage: `url('${avatarFor(entry)}')` }}></div>
                      <div className="text-primary font-bold text-lg">第 {idx + 1} 名</div>
                      <div className="text-white font-bold">{entry.name}</div>
                      <div className="text-gold-accent text-sm">{entry.vip}</div>
                      <div className="text-primary font-mono font-bold text-xl mt-2">{formatProfit(entry.profit)}</div>
                      <div className="text-white/40 text-xs">{entry.games.toLocaleString()} 局</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table for 4th+ */}
            {rest.length > 0 && (
              <div className="w-full bg-surface-dark/40 backdrop-blur-sm rounded-3xl border border-[#493f22] overflow-hidden flex flex-col shadow-2xl mb-24">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#493f22] bg-[#1a160a]/50 text-xs font-bold text-gold-accent uppercase tracking-wider">
                  <div className="col-span-2 md:col-span-1 text-center">排名</div>
                  <div className="col-span-6 md:col-span-5">玩家名稱</div>
                  <div className="hidden md:block col-span-3 text-center">VIP 等級</div>
                  <div className="col-span-4 md:col-span-3 text-right pr-4">總盈利</div>
                </div>
                <div className="divide-y divide-[#493f22]/50">
                  {rest.map((entry) => (
                    <div key={entry.userId} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors group">
                      <div className="col-span-2 md:col-span-1 text-center text-white/60 font-mono font-medium text-lg">{entry.rank}</div>
                      <div className="col-span-6 md:col-span-5 flex items-center gap-4">
                        <div className="size-10 rounded-full bg-cover bg-center border border-[#493f22]" style={{ backgroundImage: `url('${avatarFor(entry)}')` }}></div>
                        <div className="flex flex-col">
                          <span className="text-white font-bold group-hover:text-primary transition-colors">{entry.name}</span>
                          <span className="text-white/40 text-xs">{entry.games.toLocaleString()} 局</span>
                        </div>
                      </div>
                      <div className="hidden md:block col-span-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${vipStyle(entry.vip)}`}>
                          {entry.vip}
                        </span>
                      </div>
                      <div className={`col-span-4 md:col-span-3 text-right pr-4 font-mono font-medium ${entry.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.profit >= 0 ? '+' : ''}{formatProfit(entry.profit)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom bar - my stats */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a160a] border-t border-primary/40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-10 py-3">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-2 md:col-span-1 text-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase text-white/40 tracking-wider">我的排名</span>
                <span className="text-white font-mono font-bold text-xl">{currentMyStats.rank > 0 ? currentMyStats.rank : '--'}</span>
              </div>
            </div>
            <div className="col-span-6 md:col-span-5 flex items-center gap-4">
              <div className="relative">
                <div className="size-12 rounded-full bg-cover bg-center border-2 border-primary" style={{ backgroundImage: `url('${clerkUser?.imageUrl || 'https://ui-avatars.com/api/?name=Me&background=random'}')` }}></div>
                <div className="absolute -bottom-1 -right-1 bg-primary text-[#1a160a] rounded-full p-0.5 border border-[#1a160a]">
                  <span className="material-symbols-outlined text-[14px] block">check</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg">{clerkUser?.firstName || '你'}</span>
                <span className="text-gold-accent text-xs">
                  {currentMyStats.rank > 0 && totalPlayers > 0
                    ? `前 ${Math.max(1, Math.round((currentMyStats.rank / totalPlayers) * 100))}% 玩家`
                    : `${currentMyStats.games} 局`}
                </span>
              </div>
            </div>
            <div className="hidden md:block col-span-3 text-center">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${vipStyle(currentMyStats.vip)}`}>
                {currentMyStats.vip}
              </span>
            </div>
            <div className="col-span-4 md:col-span-3 text-right pr-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-white/40 tracking-wider">總盈利</span>
                <span className={`font-mono font-bold text-xl ${currentMyStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {currentMyStats.profit >= 0 ? '+' : ''}{formatProfit(currentMyStats.profit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isComingSoonModalOpen}
        onClose={() => setIsComingSoonModalOpen(false)}
        title="敬請期待"
        icon="construction"
      >
        <div className="flex flex-col items-center py-6 text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-surface-dark flex items-center justify-center border border-white/10 mb-2">
            <span className="material-symbols-outlined text-4xl text-gray-400">hourglass_empty</span>
          </div>
          <div>
            <h4 className="text-lg font-bold text-white mb-2">功能開發中</h4>
            <p className="text-gray-400 text-sm">此功能目前正在開發中，將在未來的版本更新中推出。感謝您的耐心等候！</p>
          </div>
          <button
            onClick={() => setIsComingSoonModalOpen(false)}
            className="w-full mt-4 bg-surface-dark border border-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/5 transition"
          >
            我知道了
          </button>
        </div>
      </Modal>
    </div>
  );
}
