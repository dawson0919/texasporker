"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

type GameRecord = {
  id: string;
  game_type: string;
  stake: string;
  profit_loss: number;
  stage_reached: string;
  created_at: string;
};

export default function HistoryPage() {
  const { user: clerkUser } = useUser();
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'all'>('30days');
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/game/history');
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        }
      } catch {
        // Offline
      }
      setLoading(false);
    };
    fetchHistory();
  }, []);

  const filteredHistory = history.filter(h => {
    if (timeRange === 'all') return true;
    const days = timeRange === '7days' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(h.created_at) >= cutoff;
  });

  const totalHands = filteredHistory.length;
  const netProfit = filteredHistory.reduce((sum, h) => sum + (h.profit_loss || 0), 0);
  const wins = filteredHistory.filter(h => h.profit_loss > 0).length;
  const winRate = totalHands > 0 ? ((wins / totalHands) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-hidden">
      {/* Header - matches lobby */}
      <header className="flex items-center justify-between border-b border-primary/20 bg-surface-darker/90 backdrop-blur-md px-6 py-3 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-primary to-red-900 text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">casino</span>
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight bg-gradient-to-b from-[#FCEda4] via-[#C9A25D] to-[#AA823C] bg-clip-text text-transparent">澳門皇家撲克</h2>
            <p className="text-xs text-primary/80 uppercase tracking-widest font-semibold">歷史紀錄</p>
          </div>
        </div>
        <div className="flex flex-1 justify-end gap-6 items-center">
          <nav className="hidden md:flex items-center gap-8 mr-4">
            <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/lobby">大廳</Link>
            <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/">牌桌</Link>
            <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/tournaments">錦標賽</Link>
            <Link className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium" href="/leaderboard">排行榜</Link>
            <span className="text-accent-gold text-sm font-bold border-b-2 border-accent-gold pb-0.5">歷史紀錄</span>
          </nav>
          <div className="flex items-center gap-3 border-l border-white/10 pl-6">
            <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-accent-gold/50 shadow-md" style={{ backgroundImage: `url('${clerkUser?.imageUrl || 'https://ui-avatars.com/api/?name=Me&background=random'}')` }}></div>
          </div>
        </div>
      </header>

      {/* Main Content - fits viewport */}
      <main className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
        {/* Top: Title + Time Filter */}
        <div className="flex items-center justify-between shrink-0">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-accent-gold">analytics</span>
            遊戲數據分析
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex bg-surface-dark rounded-lg p-0.5 border border-white/5">
              {(['7days', '30days', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${timeRange === range ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30' : 'text-slate-400 hover:text-white border border-transparent'}`}
                >
                  {range === '7days' ? '7天' : range === '30days' ? '30天' : '全部'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <div className="rounded-xl p-3 bg-surface-dark/80 border border-white/5 shadow-lg">
            <div className="flex justify-between items-center mb-1">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">總手數</p>
              <span className="material-symbols-outlined text-primary/60 text-base">playing_cards</span>
            </div>
            <p className="text-xl font-bold text-white">{totalHands.toLocaleString()}</p>
            <p className="text-emerald-400 text-[10px] font-medium">{loading ? '...' : `${winRate}% 勝率`}</p>
          </div>
          <div className="rounded-xl p-3 bg-surface-dark/80 border border-white/5 shadow-lg">
            <div className="flex justify-between items-center mb-1">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">淨利潤</p>
              <span className="material-symbols-outlined text-accent-gold/60 text-base">attach_money</span>
            </div>
            <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${netProfit.toLocaleString()}</p>
            <p className={`${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'} text-[10px] font-medium`}>{netProfit >= 0 ? '+' : ''}{totalHands > 0 ? (netProfit / totalHands).toFixed(0) : 0}/局</p>
          </div>
          <div className="rounded-xl p-3 bg-surface-dark/80 border border-white/5 shadow-lg">
            <div className="flex justify-between items-center mb-1">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">最佳手牌</p>
              <span className="material-symbols-outlined text-yellow-500/60 text-base">emoji_events</span>
            </div>
            <p className="text-lg font-bold text-white">Royal Flush</p>
            <p className="text-accent-gold/60 text-[10px] font-medium">皇家同花順</p>
          </div>
          <div className="rounded-xl p-3 bg-surface-dark/80 border border-white/5 shadow-lg">
            <div className="flex justify-between items-center mb-1">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">VPIP</p>
              <span className="material-symbols-outlined text-purple-400/60 text-base">query_stats</span>
            </div>
            <p className="text-xl font-bold text-white">24.5%</p>
            <p className="text-purple-400 text-[10px] font-medium">緊凶型</p>
          </div>
        </div>

        {/* Bottom: History Table + Analytics Side-by-Side */}
        <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden min-h-0">
          {/* Left: Hand History */}
          <div className="col-span-7 flex flex-col rounded-xl bg-surface-dark/60 border border-white/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5 flex justify-between items-center shrink-0 bg-surface-dark/50">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">history</span>
                最近手牌紀錄
              </h3>
              <span className="text-accent-gold/60 text-[10px] font-bold uppercase tracking-wider">{filteredHistory.length} 筆紀錄</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="text-[10px] text-slate-500 uppercase bg-black/20 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-bold text-left">時間</th>
                    <th className="px-3 py-2 font-bold text-left">牌桌</th>
                    <th className="px-3 py-2 font-bold text-left">階段</th>
                    <th className="px-3 py-2 font-bold text-right">損益</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500 text-xs">
                      <span className="material-symbols-outlined animate-spin text-lg block mb-1">progress_activity</span>載入中...
                    </td></tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500 text-xs">
                      <span className="material-symbols-outlined text-2xl block mb-2 text-slate-600">search_off</span>
                      暫無遊戲紀錄<br /><span className="text-primary">快去牌桌開始遊戲吧！</span>
                    </td></tr>
                  ) : (
                    filteredHistory.slice(0, 30).map((record, i) => {
                      const date = new Date(record.created_at);
                      const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                      const isWin = record.profit_loss > 0;
                      return (
                        <tr key={record.id || i} className="hover:bg-white/5 transition-colors cursor-pointer group">
                          <td className="px-3 py-2 whitespace-nowrap text-slate-400">{dateStr}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="font-medium text-white">{record.game_type || 'CASH'}</span>
                            <span className="text-slate-500 ml-1">{record.stake || '50/100'}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              record.stage_reached === 'SHOWDOWN' ? 'bg-primary/10 text-primary' :
                              record.stage_reached === 'RIVER' ? 'bg-blue-500/10 text-blue-400' :
                              'bg-white/5 text-slate-400'
                            }`}>{record.stage_reached || 'SHOWDOWN'}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">
                            <span className={`font-bold ${isWin ? 'text-emerald-400' : record.profit_loss < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                              {isWin ? '+' : ''}{record.profit_loss === 0 ? '$0' : `$${record.profit_loss.toLocaleString()}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Analytics */}
          <div className="col-span-5 flex flex-col gap-3 overflow-hidden">
            {/* Win Rate */}
            <div className="rounded-xl p-4 bg-surface-dark/60 border border-white/5 shrink-0">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-accent-gold">pie_chart</span>
                位置勝率
              </h3>
              <div className="flex items-center gap-4">
                <div className="relative size-20 rounded-full shrink-0" style={{ background: `conic-gradient(#c5a059 0% ${Number(winRate)}%, #2a2a2a ${Number(winRate)}% 100%)` }}>
                  <div className="absolute inset-2 rounded-full bg-surface-dark flex items-center justify-center flex-col">
                    <span className="text-lg font-bold text-accent-gold">{winRate}%</span>
                    <span className="text-[8px] text-slate-500 uppercase">勝率</span>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  {[
                    { pos: 'BTN', rate: '62%', color: 'bg-accent-gold' },
                    { pos: 'CO', rate: '54%', color: 'bg-accent-gold/60' },
                    { pos: 'SB', rate: '41%', color: 'bg-accent-gold/30' },
                    { pos: 'EP', rate: '38%', color: 'bg-slate-600' },
                  ].map(item => (
                    <div key={item.pos} className="flex items-center gap-1.5">
                      <div className={`size-1.5 rounded-full ${item.color}`}></div>
                      <span className="text-[10px] text-slate-400">{item.pos}</span>
                      <span className="text-[10px] font-bold text-white ml-auto">{item.rate}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Heatmap */}
              <div className="grid grid-cols-6 gap-1 mt-3 h-7">
                {[
                  { label: 'SB', opacity: 'bg-primary/20 text-primary/60' },
                  { label: 'BB', opacity: 'bg-primary/10 text-primary/40' },
                  { label: 'UTG', opacity: 'bg-primary/30 text-primary/70' },
                  { label: 'MP', opacity: 'bg-primary/50 text-primary/80' },
                  { label: 'CO', opacity: 'bg-primary text-white' },
                  { label: 'BTN', opacity: 'bg-primary/80 text-white' },
                ].map(item => (
                  <div key={item.label} className={`${item.opacity} rounded flex items-center justify-center text-[9px] font-bold`}>{item.label}</div>
                ))}
              </div>
            </div>

            {/* Play Style DNA */}
            <div className="rounded-xl p-4 bg-surface-dark/60 border border-white/5 flex-1 min-h-0 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-purple-400">psychology</span>
                  風格分析
                </h3>
                <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[9px] font-bold">Aggressive</span>
              </div>
              <div className="space-y-3 flex-1">
                {[
                  { label: 'Pre-flop Raise (PFR)', value: '18%', width: '18%' },
                  { label: '3-Bet %', value: '8.2%', width: '8.2%' },
                  { label: 'C-Bet', value: '65%', width: '65%' },
                  { label: 'WTSD', value: '32%', width: '32%' },
                ].map(stat => (
                  <div key={stat.label}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">{stat.label}</span>
                      <span className="text-white font-bold">{stat.value}</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-accent-gold to-primary rounded-full transition-all" style={{ width: stat.width }}></div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Radar mini */}
              <div className="relative h-28 flex items-center justify-center mt-2 shrink-0">
                <div className="absolute inset-0 m-auto size-24 border border-white/5 rounded-full"></div>
                <div className="absolute inset-0 m-auto size-16 border border-white/5 rounded-full"></div>
                <div className="absolute inset-0 m-auto size-8 border border-white/5 rounded-full"></div>
                <div className="absolute inset-0 m-auto size-24 bg-accent-gold/10 border border-accent-gold/30 rounded-full" style={{ clipPath: `polygon(50% 12%, 88% 38%, 75% 82%, 25% 82%, 12% 38%)` }}></div>
                <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] text-slate-500 font-bold">AGG</span>
                <span className="absolute bottom-2 right-4 text-[8px] text-slate-500 font-bold">VPIP</span>
                <span className="absolute bottom-2 left-4 text-[8px] text-slate-500 font-bold">PFR</span>
                <span className="absolute top-6 right-1 text-[8px] text-slate-500 font-bold">3B</span>
                <span className="absolute top-6 left-1 text-[8px] text-slate-500 font-bold">CB</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation - matches lobby */}
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
          <Link className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-primary transition-colors" href="/tournaments">
            <span className="material-symbols-outlined text-lg">emoji_events</span>
            <span className="text-[9px] font-medium uppercase tracking-wide">錦標賽</span>
          </Link>
          <Link className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-primary transition-colors" href="/leaderboard">
            <span className="material-symbols-outlined text-lg">leaderboard</span>
            <span className="text-[9px] font-medium uppercase tracking-wide">排行榜</span>
          </Link>
          <Link className="flex flex-col items-center gap-0.5 text-accent-gold transition-colors" href="/history">
            <span className="material-symbols-outlined text-lg">history</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">歷史</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
