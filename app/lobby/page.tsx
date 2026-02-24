"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';

export default function LobbyPage() {
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [chipBalance, setChipBalance] = useState<number | null>(null);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [rewardMsg, setRewardMsg] = useState('');

  useEffect(() => {
    fetch('/api/user/balance').then(r => r.json()).then(d => setChipBalance(d.balance)).catch(() => {});
  }, []);

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
                <div className="size-10 rounded-full bg-cover bg-center border-2 border-accent-gold shadow-md" data-alt="Player avatar close up" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=P1&background=random')` }}></div>
                <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-surface-darker rounded-full"></div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 flex flex-col gap-6">
            <div className="gold-border rounded-2xl p-6 bg-surface-dark/80 backdrop-blur-sm shadow-xl flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary/20 to-transparent"></div>
              <div className="relative mb-4">
                <div className="size-24 rounded-full bg-cover bg-center border-4 border-accent-gold shadow-2xl" data-alt="High roller player avatar" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=P2&background=random')` }}></div>
                <div className="absolute -bottom-2 -right-2 bg-surface-darker rounded-full p-1.5 border border-accent-gold">
                  <span className="material-symbols-outlined text-accent-gold text-xl">workspace_premium</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">至尊賭神</h3>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6">
                <span className="text-slate-400 text-xs mr-1">VIP 等級:</span>
                <span className="text-accent-gold text-xs font-bold uppercase tracking-wide">鑽石龍</span>
              </div>
              <div className="w-full bg-surface-darker/50 rounded-xl p-4 border border-white/5">
                <p className="text-slate-400 text-xs uppercase font-medium mb-1">籌碼餘額</p>
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
                  <span className="text-accent-gold">$</span> {chipBalance !== null ? chipBalance.toLocaleString() : '---'}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 w-full">
                <Link href="/history" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-xs text-slate-300 transition-colors flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-lg">history</span> 歷史紀錄
                </Link>
                <button className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-xs text-slate-300 transition-colors flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-lg">account_balance_wallet</span> 出納櫃檯
                </button>
              </div>
            </div>
            <div className="rounded-2xl p-5 bg-surface-dark/60 backdrop-blur-sm border border-white/5 shadow-lg hidden lg:block">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-wide">頂級贏家</h4>
                <Link href="/leaderboard" className="text-xs text-primary cursor-pointer hover:underline">查看全部</Link>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-accent-gold font-bold">1</span>
                    <div className="size-6 rounded-full bg-slate-700" data-alt="Winner 1 avatar" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=W1&background=random')` }}></div>
                    <span className="text-slate-200">Dragon88</span>
                  </div>
                  <span className="text-green-400 font-medium">+$450k</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold">2</span>
                    <div className="size-6 rounded-full bg-slate-700" data-alt="Winner 2 avatar" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=W2&background=random')` }}></div>
                    <span className="text-slate-200">PokerStar</span>
                  </div>
                  <span className="text-green-400 font-medium">+$210k</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700 font-bold">3</span>
                    <div className="size-6 rounded-full bg-slate-700" data-alt="Winner 3 avatar" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=W3&background=random')` }}></div>
                    <span className="text-slate-200">LuckyLady</span>
                  </div>
                  <span className="text-green-400 font-medium">+$180k</span>
                </div>
              </div>
            </div>
          </aside>
          <div className="lg:col-span-6 flex flex-col gap-6">
            <Link href="/" className="group relative overflow-hidden rounded-2xl aspect-video lg:aspect-[16/9] shadow-2xl cursor-pointer block">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" data-alt="Beautiful Chinese live dealer in red qipao" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBqCOPO7sGBiSWQfVrqJbX5dspt5SucZh-ecc2DOoIP7L6WuZmGK6VMgX4qq5cbYfMUPkSS4DSI5F-eENUazuf61Rcoe6xy-lRAax3fy9efUPNq9rEFQnUxrNgzxCZT3bk6S1sAJTS6jvI_dnO9yQfZgnEwyxZYEQmYLxhcppuAYpRN6I2-PqKD4b3vEdYzg88bVhBwPXE0rIU7JJ6Gzr9V4yllkP5OEgJYo3IzmCxloRb-uIoCly-N3SCUEgVTXeAkayfkKTYywpIZ')` }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90"></div>
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold animate-pulse">
                  <span className="size-2 rounded-full bg-white"></span> 直播中
                </span>
              </div>
              <div className="absolute bottom-0 left-0 w-full p-6 flex flex-col items-start gap-2">
                <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight drop-shadow-lg">真人荷官桌</h2>
                <p className="text-slate-200 text-sm md:text-base max-w-md drop-shadow-md mb-2">與我們的 VIP 荷官即時互動，體驗澳門的刺激快感。</p>
                <div className="flex items-center gap-4 w-full">
                  <div className="flex-1 bg-gradient-to-r from-accent-gold to-[#AA823C] text-surface-darker hover:brightness-110 font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">play_circle</span> 立即遊玩
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-slate-400 uppercase">最低買入</span>
                    <span className="text-white font-bold text-lg">$500</span>
                  </div>
                </div>
              </div>
            </Link>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/" className="relative h-48 rounded-xl overflow-hidden group cursor-pointer border border-white/5 bg-surface-dark shadow-lg block">
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
              <Link href="/multi-table" className="relative h-48 rounded-xl overflow-hidden group cursor-pointer border border-white/5 bg-surface-dark shadow-lg block">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110 opacity-60" data-alt="Fast paced poker chips flying" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCwgFDjkyFXyMjpNRQxAAtooNrxau21ZZ1z1pAEwLsVyom0x17HWl1ylKYRtT7J7JcMPholGJRrE0ckY-EwU-GUfcG39VTHcpP12onH8sbzs74F7UvPYLZa4dbYedFUvnkPZB8zwGgCufmBPzoxiwg-p7bMfZO_TMBmY8p_MZ2mI5SISi7_s6kAzHD-XtLd-93OSrpJkNYTHrym-8Jjco9Q0IzGSC8L2OqntpyEiWAAw-cM0dZjfc7ZEN7kgqAztyGJ4OjsxJZf32WX')` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-surface-darker via-surface-darker/60 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-5 w-full">
                  <div className="flex justify-between items-end mb-1">
                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">快速開始</h3>
                    <span className="material-symbols-outlined text-primary">speed</span>
                  </div>
                  <p className="text-slate-400 text-xs line-clamp-2">立即加入行動。快速盲注。</p>
                </div>
              </Link>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl">emoji_events</span>
                </div>
                <div>
                  <h4 className="text-white font-bold">龍之盃錦標賽</h4>
                  <p className="text-primary text-xs font-medium">2小時15分後開始</p>
                </div>
              </div>
              <Link href="/tournaments" className="px-4 py-2 bg-surface-darker hover:bg-black text-white text-sm font-medium rounded-lg border border-white/10 transition-colors">
                報名
              </Link>
            </div>
          </div>
          <aside className="lg:col-span-3 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-lg font-bold text-white">活躍牌桌</h2>
              <button className="size-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-300">
                <span className="material-symbols-outlined text-sm">filter_list</span>
              </button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1 custom-scrollbar">
              <Link href="/" className="p-3 rounded-xl bg-surface-dark hover:bg-surface-dark/80 border border-white/5 transition-colors cursor-pointer group block">
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
                    <p className="mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span> 5/9 玩家</p>
                  </div>
                  <div className="bg-primary hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    加入
                  </div>
                </div>
              </Link>
              <Link href="/" className="p-3 rounded-xl bg-surface-dark hover:bg-surface-dark/80 border border-white/5 transition-colors cursor-pointer group block">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-green-500"></span>
                    <h4 className="text-white font-semibold text-sm">金龍廳</h4>
                  </div>
                  <span className="text-xs font-bold text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/20">奧馬哈</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-xs text-slate-400">
                    <p>盲注: <span className="text-slate-200">$100/$200</span></p>
                    <p className="mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span> 8/9 玩家</p>
                  </div>
                  <div className="bg-primary hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    加入
                  </div>
                </div>
              </Link>
              <Link href="/" className="p-3 rounded-xl bg-surface-dark hover:bg-surface-dark/80 border border-white/5 transition-colors cursor-pointer group block">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-yellow-500"></span>
                    <h4 className="text-white font-semibold text-sm">皇家同花順廳</h4>
                  </div>
                  <span className="text-xs font-bold text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded border border-accent-gold/20">無限注德州撲克</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-xs text-slate-400">
                    <p>盲注: <span className="text-slate-200">$500/$1k</span></p>
                    <p className="mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span> 2/6 玩家</p>
                  </div>
                  <div className="bg-primary hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    加入
                  </div>
                </div>
              </Link>
              <div className="p-3 rounded-xl bg-surface-dark hover:bg-surface-dark/80 border border-white/5 transition-colors cursor-pointer group opacity-75 hover:opacity-100">
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
                  <button className="bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-not-allowed">
                    滿員
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </main>
        <nav className="sticky bottom-0 z-50 w-full bg-surface-darker/95 backdrop-blur-md border-t border-white/10 px-6 py-3">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between md:justify-center gap-2 md:gap-12">
            <Link className="flex flex-col items-center gap-1 text-primary transition-colors group" href="/lobby">
              <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">home</span>
              <span className="text-[10px] font-medium uppercase tracking-wide">首頁</span>
            </Link>
            <button onClick={() => setIsComingSoonModalOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group">
              <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">redeem</span>
              <span className="text-[10px] font-medium uppercase tracking-wide">福利</span>
            </button>
            <button onClick={() => setIsComingSoonModalOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors group">
              <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">assignment</span>
              <span className="text-[10px] font-medium uppercase tracking-wide">任務</span>
            </button>
            <button onClick={() => setIsComingSoonModalOpen(true)} className="md:hidden -mt-8 size-14 rounded-full bg-gradient-to-br from-primary to-red-800 text-white shadow-lg shadow-red-900/50 flex items-center justify-center border-4 border-surface-darker">
              <span className="material-symbols-outlined text-3xl">play_arrow</span>
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
        </div>
      </Modal>

    </div>
  );
}
