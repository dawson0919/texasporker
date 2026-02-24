"use client";

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Modal } from '../components/Modal';

export default function LobbyPage() {
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [chipBalance, setChipBalance] = useState<number | null>(null);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [rewardMsg, setRewardMsg] = useState('');
  const [stats, setStats] = useState<{ totalProfit: number; totalHands: number; title: string; vip: string; isTopPlayer: boolean; topWinners: { name: string; profit: number }[] } | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [liveTables, setLiveTables] = useState<Array<{ id: string; tableNumber: number; status: string; realPlayers: number; totalPlayers: number; stage: string; handCount: number }>>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [nextTournament, setNextTournament] = useState<{ id: string; name: string; start_time: string; buy_in: number; entry_count: number; max_players: number } | null>(null);
  const [tCountdown, setTCountdown] = useState('');
  const [tRegistering, setTRegistering] = useState(false);
  const [tRegistered, setTRegistered] = useState(false);
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const router = useRouter();

  const PRESET_AVATARS = [
    '/avatars/avatar-1.svg', '/avatars/avatar-2.svg', '/avatars/avatar-3.svg',
    '/avatars/avatar-4.svg', '/avatars/avatar-5.svg', '/avatars/avatar-6.svg',
    '/avatars/avatar-7.svg', '/avatars/avatar-8.svg', '/avatars/avatar-9.svg',
    '/avatars/avatar-10.svg',
  ];

  useEffect(() => {
    fetch('/api/user/balance').then(r => r.json()).then(d => setChipBalance(d.balance)).catch(() => {});
    fetch('/api/user/stats').then(r => r.json()).then(d => { if (d.title) setStats(d); }).catch(() => {});
    fetch('/api/multiplayer/tables').then(r => r.json()).then(d => { if (d.tables) setLiveTables(d.tables); }).catch(() => {});
    fetch('/api/tournaments').then(r => r.json()).then(d => { if (d.tournaments?.length > 0) setNextTournament(d.tournaments[0]); }).catch(() => {});
  }, []);

  // Tournament countdown
  useEffect(() => {
    if (!nextTournament) return;
    const tick = () => {
      const diff = new Date(nextTournament.start_time).getTime() - Date.now();
      if (diff <= 0) { setTCountdown('即將開始'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTCountdown(h > 0 ? `${h}小時${m}分${s}秒後開始` : `${m}分${s}秒後開始`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextTournament]);

  const handleTournamentRegister = useCallback(async () => {
    if (!nextTournament || tRegistering || tRegistered) return;
    setTRegistering(true);
    try {
      const res = await fetch('/api/tournaments/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: nextTournament.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setTRegistered(true);
        if (data.newBalance !== undefined) setChipBalance(data.newBalance);
      } else {
        alert(data.error || '報名失敗');
      }
    } catch { alert('網路錯誤'); }
    setTRegistering(false);
  }, [nextTournament, tRegistering, tRegistered]);

  const handleJoinMultiplayer = useCallback(async () => {
    if (isJoining) return;
    setIsJoining(true);
    try {
      const res = await fetch('/api/multiplayer/join', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.tableId) {
        router.push(`/game/${data.tableId}`);
      } else {
        alert(data.error || '無法加入牌桌');
      }
    } catch {
      alert('網路錯誤，請稍後再試');
    }
    setIsJoining(false);
  }, [isJoining, router]);

  const claimDailyReward = async () => {
    try {
      const res = await fetch('/api/user/daily-reward', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setChipBalance(prev => (prev || 0) + (data.amount || 10000));
        setRewardClaimed(true);
        setRewardMsg(`成功領取 $${(data.amount || 10000).toLocaleString()} 籌碼！`);
      } else {
        setRewardMsg(data.error || '獎勵冷卻中，請稍後再試');
      }
    } catch {
      setRewardMsg('網路錯誤，請稍後再試');
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName || undefined, avatarUrl: profileAvatar || undefined }),
      });
      if (res.ok) {
        setProfileMsg('儲存成功！');
        setTimeout(() => { setIsProfileModalOpen(false); window.location.reload(); }, 800);
      } else {
        const d = await res.json();
        setProfileMsg(d.error || '儲存失敗');
      }
    } catch {
      setProfileMsg('網路錯誤');
    }
    setProfileSaving(false);
  };

  return (
    <div className="bg-[#1a160a] min-h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-x-hidden">

      <style dangerouslySetInnerHTML={{
        __html: `

        body {
            font-family: 'Noto Sans TC', sans-serif;
        }
        .gold-gradient-text {
            background: linear-gradient(to bottom, #FCEda4, #C9A25D, #AA823C);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .gold-border {
            border: 1px solid transparent;
            background: linear-gradient(#33191b, #33191b) padding-box,
                        linear-gradient(to right, #AA823C, #FCEda4, #AA823C) border-box;
        }
    
      `}} />


      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 bg-cover bg-center" data-alt="Luxurious casino hall background with golden lights" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBz2iHltKdzG4NymKEOY7K0hIapoWbh_Xk8jYrVjbJYsMDwdA0rIcPLBgfJ5ZzxxYThCN0KvWPZ_pcw4A3PWlgquNK0KijIug9wFqCSSlClvqevRLJa3ZTeA9w_sLEIcKwbpSzQ6H5iF8iMDYucKlxNrxUZ2Bw9iJu71DxwSBK8EHR9UEf5I3OhndFWboyVAPXM_y8QXYLMqte67dma7ie_QJV7ItSQNYNVK_K0uXdhM05Lw22CAvg3_n5wf33u4Xv9yKEK2i06KEqw')` }}></div>
      <div className="relative z-10 flex flex-col min-h-screen w-full">
        <header className="flex items-center justify-between border-b border-primary/20 bg-surface-darker/90 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-primary to-red-900 text-white shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined">casino</span>
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight gold-gradient-text">澳門皇家</h2>
              <p className="text-xs text-primary/80 uppercase tracking-widest font-semibold">賭場與度假村</p>
            </div>
          </div>
          <div className="flex flex-1 justify-end gap-6 items-center">
            <nav className="hidden md:flex items-center gap-8 mr-4">
              <a className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium flex items-center gap-2" href="#">
                <span className="material-symbols-outlined text-lg">diamond</span> VIP 俱樂部
              </a>
              <a className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium flex items-center gap-2" href="#">
                <span className="material-symbols-outlined text-lg">local_fire_department</span> 優惠活動
              </a>
              <a className="text-slate-300 hover:text-accent-gold transition-colors text-sm font-medium flex items-center gap-2" href="#">
                <span className="material-symbols-outlined text-lg">support_agent</span> 客服支援
              </a>
            </nav>
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <button
                onClick={() => setIsRewardModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-xl h-10 px-6 bg-gradient-to-r from-primary to-red-700 hover:from-red-600 hover:to-red-800 text-white text-sm font-bold shadow-lg shadow-primary/30 transition-all transform hover:scale-105"
              >
                <span className="material-symbols-outlined text-lg">card_giftcard</span>
                <span>每日獎勵</span>
              </button>
              <div className="relative cursor-pointer group">
                <div className="size-10 rounded-full bg-cover bg-center border-2 border-accent-gold shadow-md" data-alt="Player avatar close up" style={{ backgroundImage: `url('${clerkUser?.imageUrl || 'https://ui-avatars.com/api/?name=Me&background=random'}')` }}></div>
                <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-surface-darker rounded-full"></div>
              </div>
              {clerkUser?.emailAddresses?.some(e => e.emailAddress === 'nbamoment@gmail.com') && (
                <Link href="/admin" className="flex items-center justify-center gap-1.5 rounded-lg h-10 px-4 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-300 text-sm font-medium transition-all">
                  <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                  <span className="hidden sm:inline">管理</span>
                </Link>
              )}
              <button
                onClick={() => signOut({ redirectUrl: '/sign-in' })}
                className="flex items-center justify-center gap-1.5 rounded-lg h-10 px-4 bg-white/5 hover:bg-red-900/40 border border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-300 text-sm font-medium transition-all"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                <span className="hidden sm:inline">登出</span>
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 flex flex-col gap-6">
            <div className="gold-border rounded-2xl p-6 bg-surface-dark/80 backdrop-blur-sm shadow-xl flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary/20 to-transparent"></div>
              <div className="relative mb-4 cursor-pointer group/avatar" onClick={() => { setProfileName(clerkUser?.firstName || ''); setProfileAvatar(clerkUser?.imageUrl || ''); setProfileMsg(''); setIsProfileModalOpen(true); }}>
                <div className="size-24 rounded-full bg-cover bg-center border-4 border-accent-gold shadow-2xl transition-opacity group-hover/avatar:opacity-80" data-alt="High roller player avatar" style={{ backgroundImage: `url('${clerkUser?.imageUrl || 'https://ui-avatars.com/api/?name=Me&background=random'}')` }}></div>
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-2xl">edit</span>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-surface-darker rounded-full p-1.5 border border-accent-gold">
                  <span className="material-symbols-outlined text-accent-gold text-xl">workspace_premium</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{stats?.title || '新手玩家'}</h3>
              {stats?.isTopPlayer && <span className="text-xs text-yellow-400 font-bold mb-1">👑 當前賭王</span>}
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-4">
                <span className="text-slate-400 text-xs mr-1">段位:</span>
                <span className="text-accent-gold text-xs font-bold tracking-wide">{stats?.vip || '---'}</span>
              </div>
              <div className="w-full grid grid-cols-2 gap-3 mb-4">
                <div className="bg-surface-darker/50 rounded-xl p-3 border border-white/5 text-center">
                  <p className="text-slate-400 text-[10px] uppercase font-medium mb-1">籌碼餘額</p>
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-white">
                    <span className="text-accent-gold">$</span>{chipBalance !== null ? chipBalance.toLocaleString() : '---'}
                  </div>
                </div>
                <div className="bg-surface-darker/50 rounded-xl p-3 border border-white/5 text-center">
                  <p className="text-slate-400 text-[10px] uppercase font-medium mb-1">累計盈利</p>
                  <div className={`flex items-center justify-center gap-1 text-lg font-bold ${(stats?.totalProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <span>{(stats?.totalProfit ?? 0) >= 0 ? '+' : ''}</span>${Math.abs(stats?.totalProfit ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="w-full grid grid-cols-2 gap-3">
                <Link href="/history" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-xs text-slate-300 transition-colors flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-lg">history</span> 歷史紀錄
                </Link>
                <Link href="/leaderboard" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-xs text-slate-300 transition-colors flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-lg">emoji_events</span> 盈利排行
                </Link>
              </div>
            </div>
            <div className="rounded-2xl p-5 bg-surface-dark/60 backdrop-blur-sm border border-white/5 shadow-lg hidden lg:block">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-wide">盈利排行</h4>
                <Link href="/leaderboard" className="text-xs text-primary cursor-pointer hover:underline">查看全部</Link>
              </div>
              <div className="space-y-3">
                {(stats?.topWinners && stats.topWinners.length > 0) ? stats.topWinners.map((w, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${i === 0 ? 'text-accent-gold' : i === 1 ? 'text-slate-400' : 'text-amber-700'}`}>{i + 1}</span>
                      <div className="size-6 rounded-full bg-cover bg-center bg-slate-700" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=${encodeURIComponent(w.name.slice(0,2))}&background=random')` }}></div>
                      <span className="text-slate-200 truncate max-w-[100px]">{w.name}</span>
                      {i === 0 && <span className="text-[10px]">👑</span>}
                    </div>
                    <span className={`font-medium ${w.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {w.profit >= 0 ? '+' : ''}{w.profit >= 1000 ? `$${(w.profit / 1000).toFixed(0)}k` : `$${w.profit.toLocaleString()}`}
                    </span>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500 text-center py-2">暫無數據</p>
                )}
              </div>
            </div>
          </aside>
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div onClick={() => !isJoining && handleJoinMultiplayer()} role="button" tabIndex={0} className="group relative overflow-hidden rounded-2xl aspect-video lg:aspect-[16/9] shadow-2xl cursor-pointer block w-full text-left">
              {/* Horse-year themed gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#8B0000] via-[#B22222] to-[#DAA520] transition-transform duration-700 group-hover:scale-105"></div>
              {/* Decorative horse-year SVG elements */}
              <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
                {/* Traditional Chinese cloud patterns */}
                <circle cx="120" cy="80" r="40" fill="#FFD700" />
                <circle cx="140" cy="80" r="40" fill="#FFD700" />
                <circle cx="130" cy="60" r="35" fill="#FFD700" />
                <circle cx="680" cy="350" r="35" fill="#FFD700" />
                <circle cx="700" cy="350" r="35" fill="#FFD700" />
                <circle cx="690" cy="330" r="30" fill="#FFD700" />
                {/* Horse silhouette */}
                <text x="600" y="180" fontSize="180" fill="#FFD700" opacity="0.5" fontFamily="serif">馬</text>
                {/* Coin patterns */}
                <circle cx="80" cy="300" r="25" fill="none" stroke="#FFD700" strokeWidth="2" />
                <rect x="70" y="293" width="20" height="14" rx="2" fill="none" stroke="#FFD700" strokeWidth="2" />
                <circle cx="720" cy="100" r="25" fill="none" stroke="#FFD700" strokeWidth="2" />
                <rect x="710" y="93" width="20" height="14" rx="2" fill="none" stroke="#FFD700" strokeWidth="2" />
                {/* Lucky knot motifs */}
                <path d="M50,200 Q70,180 90,200 Q70,220 50,200Z" fill="#FFD700" opacity="0.3" />
                <path d="M750,250 Q770,230 790,250 Q770,270 750,250Z" fill="#FFD700" opacity="0.3" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
              {/* Top badge */}
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black text-xs font-bold shadow-lg">
                  <span className="text-sm">🐴</span> 馬年限定
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/80 text-white text-xs font-bold animate-pulse">
                  <span className="size-2 rounded-full bg-white"></span> 真人+AI混戰
                </span>
              </div>
              <div className="absolute bottom-0 left-0 w-full p-6 flex flex-col items-start gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-4xl drop-shadow-lg">🐎</span>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight drop-shadow-lg gold-gradient-text">馬上有錢桌</h2>
                </div>
                <p className="text-slate-200 text-sm md:text-base max-w-md drop-shadow-md mb-2">真人玩家+AI混合對戰，最多5人同桌！馬年行大運。</p>
                <div className="flex items-center gap-4 w-full">
                  <div className="flex-1 bg-gradient-to-r from-accent-gold to-[#AA823C] text-surface-darker hover:brightness-110 font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">groups</span> {isJoining ? '加入中...' : '立即加入'}
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-slate-400 uppercase">盲注</span>
                    <span className="text-white font-bold text-lg">$50/$100</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/tournaments" className="relative h-48 rounded-xl overflow-hidden group cursor-pointer border border-white/5 bg-surface-dark shadow-lg block">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110 opacity-60" data-alt="Luxurious private poker room interior" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCr6IeNZA0yueH5DBcNKUfJJaxcClyQ_pZyGFLWnzPAUrVvB-zqGwgceNOUBSH9YbP_hZ0jGuoxA_eCwm33cCHhxJxK1y9Z0ITdSFeE14eGsxwjAHA-wov51L37ts7iEvUU87whD5VW5853zqJA5icE5alm2iZuEFQPLZurYmOeECDnM7aXacWikwqQoKT_HaDZpLreGPsItDNAb6s20ksQrUs5_SrCbST3eezRCpgMoBd0DNFMxMO7vWgxxv7SZFEHh3KhFiXzJtwe')` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-surface-darker via-surface-darker/60 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-5 w-full">
                  <div className="flex justify-between items-end mb-1">
                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">高額獎金賽</h3>
                    <span className="material-symbols-outlined text-accent-gold">local_atm</span>
                  </div>
                  <p className="text-slate-400 text-xs line-clamp-2">專為大師打造。無限的潛力。</p>
                </div>
              </Link>
              <Link href="/" className="relative h-48 rounded-xl overflow-hidden group cursor-pointer border border-white/5 bg-surface-dark shadow-lg block">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110 opacity-60" data-alt="Fast paced poker chips flying" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCwgFDjkyFXyMjpNRQxAAtooNrxau21ZZ1z1pAEwLsVyom0x17HWl1ylKYRtT7J7JcMPholGJRrE0ckY-EwU-GUfcG39VTHcpP12onH8sbzs74F7UvPYLZa4dbYedFUvnkPZB8zwGgCufmBPzoxiwg-p7bMfZO_TMBmY8p_MZ2mI5SISi7_s6kAzHD-XtLd-93OSrpJkNYTHrym-8Jjco9Q0IzGSC8L2OqntpyEiWAAw-cM0dZjfc7ZEN7kgqAztyGJ4OjsxJZf32WX')` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-surface-darker via-surface-darker/60 to-transparent"></div>
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30">
                    隨時可玩
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 p-5 w-full">
                  <div className="flex justify-between items-end mb-1">
                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">快速開始廳</h3>
                    <span className="material-symbols-outlined text-primary">smart_toy</span>
                  </div>
                  <p className="text-slate-400 text-xs line-clamp-2">單人 VS AI，隨時開局，不用等人。</p>
                </div>
              </Link>
            </div>
            {nextTournament ? (
              <div className="rounded-xl p-4 bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-2xl">emoji_events</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{nextTournament.name}</h4>
                    <p className="text-primary text-xs font-medium">{tCountdown}</p>
                    {nextTournament.buy_in > 0 && <p className="text-slate-400 text-[10px]">報名費: ${nextTournament.buy_in.toLocaleString()} | {nextTournament.entry_count}/{nextTournament.max_players}人</p>}
                  </div>
                </div>
                <button
                  onClick={handleTournamentRegister}
                  disabled={tRegistering || tRegistered}
                  className="px-4 py-2 bg-surface-darker hover:bg-black text-white text-sm font-medium rounded-lg border border-white/10 transition-colors disabled:opacity-50"
                >
                  {tRegistered ? '已報名' : tRegistering ? '報名中...' : '報名'}
                </button>
              </div>
            ) : (
              <Link href="/tournaments" className="rounded-xl p-4 bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 flex items-center justify-between group block">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-2xl">emoji_events</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold">錦標賽</h4>
                    <p className="text-slate-400 text-xs">查看即將舉行的錦標賽</p>
                  </div>
                </div>
                <span className="text-slate-400 group-hover:text-white material-symbols-outlined transition-colors">arrow_forward</span>
              </Link>
            )}
          </div>
          <aside className="lg:col-span-3 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-lg font-bold text-white">活躍牌桌</h2>
              <button className="size-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-300">
                <span className="material-symbols-outlined text-sm">filter_list</span>
              </button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1 custom-scrollbar">
              {liveTables.length > 0 ? liveTables.map(table => (
                <Link key={table.id} href={`/game/${table.id}`} className="p-3 rounded-xl bg-surface-dark hover:bg-surface-dark/80 border border-white/5 transition-colors cursor-pointer group block">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${table.status === 'playing' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                      <h4 className="text-white font-semibold text-sm">牌桌 #{table.tableNumber}</h4>
                    </div>
                    <span className="text-xs font-bold text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/20">
                      {table.stage === 'WAITING' ? '等待中' : table.stage === 'SHOWDOWN' ? '結算中' : '進行中'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-slate-400">
                      <p>盲注: <span className="text-slate-200">$50/$100</span></p>
                      <p className="mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">group</span>
                        <span className="text-green-400">{table.realPlayers}真人</span> + {table.totalPlayers - table.realPlayers}AI / 8
                      </p>
                    </div>
                    <div className="bg-primary hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      加入
                    </div>
                  </div>
                </Link>
              )) : (
                <>
                  <button onClick={handleJoinMultiplayer} disabled={isJoining} className="p-3 rounded-xl bg-surface-dark hover:bg-surface-dark/80 border border-white/5 transition-colors cursor-pointer group text-left w-full">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                        <h4 className="text-white font-semibold text-sm">澳門套房 #1</h4>
                      </div>
                      <span className="text-xs font-bold text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/20">無限注德州撲克</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-slate-400">
                        <p>盲注: <span className="text-slate-200">$50/$100</span></p>
                        <p className="mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span> {isJoining ? '加入中...' : '點擊加入'}</p>
                      </div>
                      <div className="bg-primary hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        加入
                      </div>
                    </div>
                  </button>
                  <Link href="/" className="p-3 rounded-xl bg-surface-dark hover:bg-surface-dark/80 border border-white/5 transition-colors cursor-pointer group block">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-green-500"></span>
                        <h4 className="text-white font-semibold text-sm">金龍廳</h4>
                      </div>
                      <span className="text-xs font-bold text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/20">單人 VS AI</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-slate-400">
                        <p>盲注: <span className="text-slate-200">$50/$100</span></p>
                        <p className="mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span> 隨時開局</p>
                      </div>
                      <div className="bg-primary hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        加入
                      </div>
                    </div>
                  </Link>
                  <Link href="/tournaments" className="p-3 rounded-xl bg-surface-dark hover:bg-surface-dark/80 border border-white/5 transition-colors cursor-pointer group block">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-yellow-500"></span>
                        <h4 className="text-white font-semibold text-sm">皇家同花順廳</h4>
                      </div>
                      <span className="text-xs font-bold text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/20">錦標賽</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-slate-400">
                        <p>盲注: <span className="text-slate-200">$500/$1k</span></p>
                        <p className="mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span> 查看賽程</p>
                      </div>
                      <div className="bg-primary hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        查看
                      </div>
                    </div>
                  </Link>
                  <div className="p-3 rounded-xl bg-surface-dark border border-white/5 opacity-75">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-slate-500"></span>
                        <h4 className="text-slate-300 font-semibold text-sm">新手運氣廳</h4>
                      </div>
                      <span className="text-xs font-bold text-slate-500 bg-slate-500/10 px-2 py-0.5 rounded border border-slate-500/20">無限注德州撲克</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-slate-500">
                        <p>盲注: <span className="text-slate-400">$1/$2</span></p>
                        <p className="mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span> 9/9 滿員</p>
                      </div>
                      <span className="bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                        滿員
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </main>
        <nav className="sticky bottom-0 z-50 w-full bg-surface-darker/95 backdrop-blur-md border-t border-white/10 px-6 py-3">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between md:justify-center gap-2 md:gap-12">
            <Link className="flex flex-col items-center gap-1 text-primary transition-colors group" href="/lobby">
              <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">home</span>
              <span className="text-[10px] font-medium uppercase tracking-wide">首頁</span>
            </Link>
            <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/welfare">
              <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">redeem</span>
              <span className="text-[10px] font-medium uppercase tracking-wide">福利</span>
            </Link>
            <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/tasks">
              <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">assignment</span>
              <span className="text-[10px] font-medium uppercase tracking-wide">任務</span>
            </Link>
            <button onClick={handleJoinMultiplayer} disabled={isJoining} className="md:hidden -mt-8 size-14 rounded-full bg-gradient-to-br from-primary to-red-800 text-white shadow-lg shadow-red-900/50 flex items-center justify-center border-4 border-surface-darker">
              <span className="material-symbols-outlined text-3xl">{isJoining ? 'hourglass_empty' : 'play_arrow'}</span>
            </button>
            <Link className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group" href="/leaderboard">
              <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">leaderboard</span>
              <span className="text-[10px] font-medium uppercase tracking-wide">排行榜</span>
            </Link>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group"
            >
              <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">settings</span>
              <span className="text-[10px] font-medium uppercase tracking-wide">設置</span>
            </button>
          </div>
        </nav>
      </div>


      <Modal
        isOpen={isRewardModalOpen}
        onClose={() => setIsRewardModalOpen(false)}
        title="每日登入獎勵"
        icon="monetization_on"
      >
        <div className="flex flex-col items-center py-6 text-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center p-1 shadow-[0_0_30px_rgba(250,204,21,0.4)]">
            <div className="w-full h-full rounded-full bg-black/50 border-[3px] border-yellow-300 flex items-center justify-center animate-pulse">
              <span className="material-symbols-outlined text-4xl text-yellow-300">attach_money</span>
            </div>
          </div>
          <div>
            <h4 className="text-xl font-bold text-white mb-2">恭喜獲得新手獎勵！</h4>
            <p className="text-gray-400 text-sm">每日登入遊戲即可領取免費籌碼。參加每日錦標賽也能獲得更多籌碼。</p>
          </div>
          <div className="bg-black/40 border border-yellow-500/30 rounded-lg px-8 py-4 mb-2">
            <span className="text-gray-400 text-sm mr-2">獲得籌碼:</span>
            <span className="text-2xl font-mono font-bold text-yellow-400">+$10,000</span>
          </div>
          {rewardMsg && (
            <p className={`text-sm font-medium ${rewardClaimed ? 'text-green-400' : 'text-yellow-400'}`}>{rewardMsg}</p>
          )}
          <button
            onClick={() => { claimDailyReward(); }}
            className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:from-red-500 hover:to-red-700 transition"
          >
            {rewardClaimed ? '已領取' : '立即領取'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="系統設置"
        icon="settings"
      >
        <div className="flex flex-col gap-6 py-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h4 className="text-white font-bold mb-1">背景音樂</h4>
              <p className="text-xs text-gray-400">開啟或關閉大廳背景音樂</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h4 className="text-white font-bold mb-1">畫面載入動畫</h4>
              <p className="text-xs text-gray-400">低效能裝置可選擇關閉動畫</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>
          <div className="flex items-center justify-between pb-2">
            <div>
              <h4 className="text-white font-bold mb-1">接收重要通知</h4>
              <p className="text-xs text-gray-400">設定是否接收錦標賽開賽提醒</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="flex-1 bg-surface-dark border border-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/5 transition"
          >
            儲存並關閉
          </button>
          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className="flex items-center justify-center gap-2 bg-red-900/30 border border-red-500/30 text-red-300 font-bold py-3 px-6 rounded-xl hover:bg-red-900/50 transition"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            登出
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="個人資料設定"
        icon="person"
      >
        <div className="flex flex-col gap-5 py-2">
          {/* Current avatar preview */}
          <div className="flex flex-col items-center gap-2">
            <div className="size-20 rounded-full bg-cover bg-center border-4 border-accent-gold shadow-xl" style={{ backgroundImage: `url('${profileAvatar || clerkUser?.imageUrl || ''}')` }}></div>
            <p className="text-xs text-gray-400">點擊下方頭像更換</p>
          </div>

          {/* Google avatar option */}
          <div>
            <p className="text-white text-xs font-bold mb-2 uppercase tracking-wide">Google 頭像</p>
            <button
              onClick={() => setProfileAvatar(clerkUser?.imageUrl || '')}
              className={`size-14 rounded-full bg-cover bg-center border-3 transition-all ${profileAvatar === clerkUser?.imageUrl ? 'border-accent-gold ring-2 ring-accent-gold/50 scale-110' : 'border-white/20 hover:border-white/50'}`}
              style={{ backgroundImage: `url('${clerkUser?.imageUrl || ''}')` }}
            />
          </div>

          {/* Preset avatars */}
          <div>
            <p className="text-white text-xs font-bold mb-2 uppercase tracking-wide">內建頭像</p>
            <div className="grid grid-cols-5 gap-3">
              {PRESET_AVATARS.map((av, i) => (
                <button
                  key={i}
                  onClick={() => setProfileAvatar(av)}
                  className={`size-14 rounded-full bg-cover bg-center border-3 transition-all ${profileAvatar === av ? 'border-accent-gold ring-2 ring-accent-gold/50 scale-110' : 'border-white/20 hover:border-white/50'}`}
                  style={{ backgroundImage: `url('${av}')` }}
                />
              ))}
            </div>
          </div>

          {/* Name input */}
          <div>
            <p className="text-white text-xs font-bold mb-2 uppercase tracking-wide">顯示名稱</p>
            <input
              type="text"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              maxLength={20}
              placeholder="輸入暱稱（最多20字）"
              className="w-full bg-black/50 border border-white/10 focus:border-accent-gold text-white px-4 py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
            />
          </div>

          {/* Message */}
          {profileMsg && (
            <p className={`text-sm font-medium text-center ${profileMsg.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>{profileMsg}</p>
          )}

          {/* Save button */}
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className="w-full bg-gradient-to-r from-accent-gold to-[#AA823C] text-black font-bold py-3 px-6 rounded-xl shadow-lg hover:brightness-110 transition disabled:opacity-50"
          >
            {profileSaving ? '儲存中...' : '儲存變更'}
          </button>
        </div>
      </Modal>

    </div>
  );
}
