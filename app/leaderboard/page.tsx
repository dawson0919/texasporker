"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';

interface LeaderboardEntry {
  rank: number;
  name: string;
  winnings: number;
  games: number;
  vip: string;
  isUser?: boolean;
}

const AI_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: 'DragonMaster88', winnings: 88000000, games: 12450, vip: '鑽石 VIP' },
  { rank: 2, name: 'MacauKing', winnings: 72500000, games: 9820, vip: '白金 VIP' },
  { rank: 3, name: 'PokerFace_J', winnings: 54200000, games: 8100, vip: '黃金 VIP' },
  { rank: 4, name: 'LadyLuck99', winnings: 42105000, games: 7200, vip: '白金 VIP' },
  { rank: 5, name: 'AceHunter', winnings: 38920400, games: 6500, vip: '黃金 VIP' },
  { rank: 6, name: 'RiverRat_X', winnings: 25600000, games: 5400, vip: '白銀 VIP' },
  { rank: 7, name: 'HighRoller007', winnings: 21450100, games: 4800, vip: '白金 VIP' },
  { rank: 8, name: 'BluffKing', winnings: 18300000, games: 4200, vip: '黃金 VIP' },
  { rank: 9, name: 'SharkAttack', winnings: 15800000, games: 3900, vip: '白銀 VIP' },
  { rank: 10, name: 'NightOwl', winnings: 12500000, games: 3100, vip: '白銀 VIP' },
];

export default function LeaderboardPage() {
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'friends' | 'weekly'>('global');
  const [userStats, setUserStats] = useState<{ totalWinnings: number; totalGames: number } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/game/history');
        if (res.ok) {
          const data = await res.json();
          const history = data.history || [];
          const totalWinnings = history.reduce((s: number, h: any) => s + (h.profit_loss || 0), 0);
          setUserStats({ totalWinnings, totalGames: history.length });
        }
      } catch { /* offline */ }
    };
    fetchStats();
  }, []);

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
          <div className="hidden md:flex w-full max-w-xs items-center rounded-xl bg-[#131007] border border-[#493f22] focus-within:border-primary transition-colors">
            <div className="text-gold-accent pl-3 pr-2 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input className="w-full bg-transparent border-none text-white placeholder:text-gold-accent/50 focus:ring-0 text-sm py-2.5" placeholder="搜尋玩家..." />
          </div>
          <div className="flex gap-3">
            <button className="flex items-center justify-center rounded-xl size-10 bg-[#2a2415] hover:bg-[#3d341f] text-white transition-colors border border-[#493f22]">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            <button className="flex items-center justify-center rounded-xl size-10 bg-[#2a2415] hover:bg-[#3d341f] text-white transition-colors border border-[#493f22]">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
            <div className="relative group cursor-pointer">
              <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-primary" data-alt="User profile avatar showing a man in a suit" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=You&background=random')` }}></div>
              <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-[#1a160a]"></div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-grow flex flex-col relative w-full max-w-[1440px] mx-auto px-4 md:px-8 py-8">
        <div className="fixed inset-0 z-[-1] opacity-20 pointer-events-none" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDdrjxPkcwDPERm82UCyW95AOwvMhoqSk0il2PiV5lVFpynSL5UcaSlClgFJkfbL5VCiPxnt-QHdgFql9EcE_-2QO0Hwz0wck6COgTEf9DQVk7e_GkBtEEm4HGXcoMm9K6otlqimTTnvKCIkiBPFYGnZJY_AnvkquQM4kksKzNzCkeejzJ5gdFKE_ihM19FttFmxBDJbf0MoPpmKyC8ZFNSxVuTApgaRUq-BIZeq5PW7GKpyOb6665e71Mxs6Vj8u1003C2fPu6YzPD')` }}></div>
        <div className="fixed inset-0 z-[-2] bg-background-dark"></div>
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 mb-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-primary tracking-tight">全球與好友排行榜</h1>
            <p className="text-gold-accent text-lg">澳門頂級精英圈 | 共 {AI_LEADERBOARD.length + 1} 名玩家</p>
          </div>
          <div className="flex gap-3 bg-surface-dark/50 p-1.5 rounded-xl border border-[#493f22]">
            <button onClick={() => setActiveTab('global')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'global' ? 'bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:scale-105' : 'text-gold-accent hover:text-white hover:bg-white/5'}`}>全球菁英</button>
            <button onClick={() => setActiveTab('friends')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'friends' ? 'bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:scale-105' : 'text-gold-accent hover:text-white hover:bg-white/5'}`}>好友</button>
            <button onClick={() => setActiveTab('weekly')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'weekly' ? 'bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:scale-105' : 'text-gold-accent hover:text-white hover:bg-white/5'}`}>每週排行</button>
          </div>
        </div>
        {activeTab === 'friends' ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 min-h-[500px]">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">group_off</span>
            <p>目前沒有好友資料，邀請好友一起遊玩吧！</p>
            <button className="mt-6 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-bold tracking-widest border border-white/20">邀請好友</button>
          </div>
        ) : (
          <>
            <div className="relative w-full mb-12">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 min-h-[420px] pb-8">
                <div className="order-2 md:order-1 flex flex-col items-center w-full max-w-[280px] relative group">
                  <div className="relative z-10 mb-4 transform group-hover:-translate-y-2 transition-transform duration-300">
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-slate-300 p-1 bg-gradient-to-b from-slate-200 to-slate-400 shadow-[0_0_20px_rgba(203,213,225,0.3)]">
                      <div className="w-full h-full rounded-full bg-cover bg-center" data-alt="Portrait of the second rank player" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=P2&background=random')` }}></div>
                    </div>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-900 font-bold px-3 py-0.5 rounded-full text-sm shadow-lg border border-white">第 2 名</div>
                  </div>
                  <div className="w-full bg-card-gradient border border-white/10 rounded-t-2xl p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden h-64 justify-end">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-500/10 to-transparent pointer-events-none"></div>
                    <h3 className="text-xl font-bold text-white mb-1">MacauKing</h3>
                    <div className="flex items-center gap-1 mb-3 text-sm text-gold-accent">
                      <span className="material-symbols-outlined text-sm">diamond</span>
                      <span>白金 VIP</span>
                    </div>
                    <p className="text-2xl font-mono text-primary font-bold tracking-tight">$72.5M</p>
                    <p className="text-xs text-white/40 mt-1">贏取籌碼</p>
                  </div>
                </div>
                <div className="order-1 md:order-2 flex flex-col items-center w-full max-w-[320px] relative z-20 -mt-12 md:-mt-0 group">
                  <div className="absolute -top-16 text-primary animate-bounce">
                    <span className="material-symbols-outlined text-5xl drop-shadow-[0_0_15px_rgba(244,196,52,0.6)]">crown</span>
                  </div>
                  <div className="relative z-10 mb-4 transform group-hover:-translate-y-2 transition-transform duration-300">
                    <div className="w-36 h-36 md:w-44 md:h-44 rounded-full border-4 border-primary p-1 bg-gradient-to-b from-[#fcd34d] to-[#b45309] shadow-[0_0_30px_rgba(244,196,52,0.4)]">
                      <div className="w-full h-full rounded-full bg-cover bg-center" data-alt="Portrait of the first rank player" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=P1&background=random')` }}></div>
                    </div>
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-primary text-black font-bold px-4 py-1 rounded-full text-base shadow-lg border-2 border-[#fff7ed] min-w-[3rem] text-center">第 1 名</div>
                  </div>
                  <div className="w-full bg-gradient-to-b from-[#3a311c] to-[#1a160a] border border-primary/30 rounded-t-2xl p-8 flex flex-col items-center text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden h-80 justify-end">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
                    <h3 className="text-2xl font-bold text-white mb-1">DragonMaster88</h3>
                    <div className="flex items-center gap-1 mb-4 text-sm text-primary">
                      <span className="material-symbols-outlined text-sm">workspace_premium</span>
                      <span>鑽石 VIP</span>
                    </div>
                    <p className="text-3xl md:text-4xl font-mono text-primary font-black tracking-tighter drop-shadow-md">$88.0M</p>
                    <p className="text-xs text-white/40 mt-1">總贏取籌碼</p>
                  </div>
                </div>
                <div className="order-3 flex flex-col items-center w-full max-w-[280px] relative group">
                  <div className="relative z-10 mb-4 transform group-hover:-translate-y-2 transition-transform duration-300">
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-orange-300 p-1 bg-gradient-to-b from-orange-200 to-orange-700 shadow-[0_0_20px_rgba(194,65,12,0.3)]">
                      <div className="w-full h-full rounded-full bg-cover bg-center" data-alt="Portrait of the third rank player" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=P3&background=random')` }}></div>
                    </div>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-400 text-white font-bold px-3 py-0.5 rounded-full text-sm shadow-lg border border-orange-200">第 3 名</div>
                  </div>
                  <div className="w-full bg-card-gradient border border-white/10 rounded-t-2xl p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden h-56 justify-end">
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-900/10 to-transparent pointer-events-none"></div>
                    <h3 className="text-xl font-bold text-white mb-1">PokerFace_J</h3>
                    <div className="flex items-center gap-1 mb-3 text-sm text-gold-accent">
                      <span className="material-symbols-outlined text-sm">stars</span>
                      <span>黃金 VIP</span>
                    </div>
                    <p className="text-2xl font-mono text-primary font-bold tracking-tight">$54.2M</p>
                    <p className="text-xs text-white/40 mt-1">贏取籌碼</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full bg-surface-dark/40 backdrop-blur-sm rounded-3xl border border-[#493f22] overflow-hidden flex flex-col shadow-2xl mb-24">
              <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#493f22] bg-[#1a160a]/50 text-xs font-bold text-gold-accent uppercase tracking-wider">
                <div className="col-span-2 md:col-span-1 text-center">排名</div>
                <div className="col-span-6 md:col-span-5">玩家名稱</div>
                <div className="hidden md:block col-span-3 text-center">VIP 等級</div>
                <div className="col-span-4 md:col-span-3 text-right pr-4">總贏取籌碼</div>
              </div>
              <div className="divide-y divide-[#493f22]/50">
                {AI_LEADERBOARD.slice(3).map((entry) => {
                  const vipStyle = entry.vip.includes('鑽石') ? 'bg-cyan-900/30 text-cyan-200 border-cyan-700/50'
                    : entry.vip.includes('白金') ? 'bg-purple-900/30 text-purple-200 border-purple-700/50'
                    : entry.vip.includes('黃金') ? 'bg-yellow-900/30 text-yellow-200 border-yellow-700/50'
                    : 'bg-slate-800 text-slate-300 border-slate-600';
                  return (
                    <div key={entry.rank} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors group">
                      <div className="col-span-2 md:col-span-1 text-center text-white/60 font-mono font-medium text-lg">{entry.rank}</div>
                      <div className="col-span-6 md:col-span-5 flex items-center gap-4">
                        <div className="size-10 rounded-full bg-cover bg-center border border-[#493f22]" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name.slice(0,2))}&background=random')` }}></div>
                        <div className="flex flex-col">
                          <span className="text-white font-bold group-hover:text-primary transition-colors">{entry.name}</span>
                          <span className="text-white/40 text-xs">{entry.games.toLocaleString()} 局</span>
                        </div>
                      </div>
                      <div className="hidden md:block col-span-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${vipStyle}`}>
                          {entry.vip}
                        </span>
                      </div>
                      <div className="col-span-4 md:col-span-3 text-right pr-4 font-mono text-gold-accent font-medium">${entry.winnings.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 flex justify-center border-t border-[#493f22] bg-[#1a160a]/30">
                <button className="text-xs font-bold text-primary hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors">
                  查看完整排行榜
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>
            </div>
          </>
        )}
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a160a] border-t border-primary/40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-10 py-3">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-2 md:col-span-1 text-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase text-white/40 tracking-wider">我的排名</span>
                <span className="text-white font-mono font-bold text-xl">42</span>
              </div>
            </div>
            <div className="col-span-6 md:col-span-5 flex items-center gap-4">
              <div className="relative">
                <div className="size-12 rounded-full bg-cover bg-center border-2 border-primary" data-alt="Current user avatar" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=You&background=random')` }}></div>
                <div className="absolute -bottom-1 -right-1 bg-primary text-[#1a160a] rounded-full p-0.5 border border-[#1a160a]">
                  <span className="material-symbols-outlined text-[14px] block">check</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg">你</span>
                <span className="text-gold-accent text-xs">前 5% 玩家</span>
              </div>
            </div>
            <div className="hidden md:block col-span-3 text-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-primary text-[#1a160a]">
                白銀 VIP
              </span>
            </div>
            <div className="col-span-4 md:col-span-3 text-right pr-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-white/40 tracking-wider">總贏取籌碼</span>
                <span className="text-primary font-mono font-bold text-xl">${userStats ? userStats.totalWinnings.toLocaleString() : '---'}</span>
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
