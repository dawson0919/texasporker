"use client";

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Modal } from '../components/Modal';

const SUITS = ['h', 'd', 'c', 's'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

function randomCards(count: number): string[] {
  const deck: string[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, count);
}

const SUITS_DISPLAY: Record<string, { symbol: string; color: string }> = {
  h: { symbol: '♥', color: 'text-red-600' },
  d: { symbol: '♦', color: 'text-red-600' },
  c: { symbol: '♣', color: 'text-black' },
  s: { symbol: '♠', color: 'text-black' },
};

const RANK_DISPLAY: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8',
  '9': '9', 'T': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

type TableState = {
  id: number;
  name: string;
  blinds: string;
  players: { name: string; balance: number; status: 'playing' | 'folded' | 'thinking' }[];
  communityCards: string[];
  potSize: number;
  stage: string;
  handCount: number;
};

function createTable(id: number, name: string, blinds: string): TableState {
  const names = id === 1
    ? ['Dragon88', 'AceKing', 'LadyLuck', 'SharkFin', 'PokerPro', 'BigBluff']
    : ['RiverRat', 'NightOwl', 'GoldFish', 'IronMan', 'DeepStack', 'CoolCat'];
  return {
    id,
    name,
    blinds,
    players: names.map(n => ({ name: n, balance: 5000 + Math.floor(Math.random() * 15000), status: 'playing' as const })),
    communityCards: [],
    potSize: 0,
    stage: 'PREFLOP',
    handCount: 0,
  };
}

function simulateStep(table: TableState): TableState {
  const next = { ...table, players: table.players.map(p => ({ ...p })) };

  if (next.stage === 'WAITING' || next.stage === 'SHOWDOWN') {
    // Start new hand
    next.communityCards = [];
    next.potSize = 150 + Math.floor(Math.random() * 500);
    next.stage = 'PREFLOP';
    next.handCount++;
    next.players.forEach(p => {
      p.status = Math.random() > 0.15 ? 'playing' : 'folded';
    });
    return next;
  }

  // Advance stage
  const stages = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
  const idx = stages.indexOf(next.stage);

  if (idx < 4) {
    next.stage = stages[idx + 1];
    next.potSize += Math.floor(Math.random() * 800) + 100;

    // Random fold
    const activePlayers = next.players.filter(p => p.status === 'playing');
    if (activePlayers.length > 2 && Math.random() > 0.5) {
      const foldIdx = Math.floor(Math.random() * activePlayers.length);
      activePlayers[foldIdx].status = 'folded';
    }

    // Deal community cards
    if (next.stage === 'FLOP') {
      next.communityCards = randomCards(3);
    } else if (next.stage === 'TURN') {
      next.communityCards = [...next.communityCards.slice(0, 3), ...randomCards(1)];
    } else if (next.stage === 'RIVER') {
      next.communityCards = [...next.communityCards.slice(0, 4), ...randomCards(1)];
    }
  } else {
    // Showdown → waiting
    next.stage = 'WAITING';
    const winner = next.players.filter(p => p.status === 'playing')[0];
    if (winner) winner.balance += next.potSize;
  }

  return next;
}

function CardDisplay({ card }: { card: string }) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const display = SUITS_DISPLAY[suit] || { symbol: '?', color: 'text-black' };
  return (
    <div className="w-10 h-14 bg-white rounded shadow-lg flex flex-col items-center justify-center border border-gray-300">
      <span className={`font-bold text-sm leading-none ${display.color}`}>{RANK_DISPLAY[rank] || rank}</span>
      <span className={`text-base leading-none ${display.color}`}>{display.symbol}</span>
    </div>
  );
}

function MiniTable({ table, onJoin }: { table: TableState; onJoin: () => void }) {
  const activePlayers = table.players.filter(p => p.status === 'playing');

  return (
    <section className="flex-1 flex flex-col bg-surface-dark relative border-r border-[#492229] last:border-r-0">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex justify-between items-start pointer-events-none">
        <div>
          <h3 className="text-white text-lg font-bold drop-shadow-md flex items-center gap-2">
            <span className="bg-primary text-[#1a0b0d] text-xs px-1.5 py-0.5 rounded font-bold">VIP {table.id}</span>
            {table.name}
          </h3>
          <p className="text-primary/80 text-xs mt-1">底注: {table.blinds} | 第 {table.handCount} 手</p>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={onJoin} className="px-3 py-1.5 rounded-lg bg-primary/90 hover:bg-primary text-[#1a0b0d] text-xs font-bold transition-colors shadow-lg">
            加入牌桌
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative bg-[#1a0b0d] min-h-[300px]">
        {/* Felt background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a3a1a] via-[#0d4a0d] to-[#1a3a1a] opacity-40"></div>

        {/* Stage indicator */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            table.stage === 'SHOWDOWN' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
            table.stage === 'WAITING' ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30' :
            'bg-primary/20 text-primary border border-primary/30'
          }`}>
            {table.stage}
          </span>
        </div>

        {/* Pot */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/60 backdrop-blur border border-primary/50 text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            底池: <span className="text-white">${table.potSize.toLocaleString()}</span>
          </div>
        </div>

        {/* Community Cards */}
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {table.communityCards.map((card, i) => (
            <CardDisplay key={i} card={card} />
          ))}
          {Array.from({ length: 5 - table.communityCards.length }).map((_, i) => (
            <div key={`empty-${i}`} className="w-10 h-14 bg-black/40 rounded border border-primary/20"></div>
          ))}
        </div>

        {/* Players arranged in oval */}
        {table.players.map((player, i) => {
          const angle = (i / table.players.length) * Math.PI * 2 - Math.PI / 2;
          const rx = 38;
          const ry = 32;
          const left = 50 + rx * Math.cos(angle);
          const top = 55 + ry * Math.sin(angle);

          return (
            <div
              key={i}
              className={`absolute z-10 flex flex-col items-center gap-0.5 transform -translate-x-1/2 -translate-y-1/2 transition-opacity ${
                player.status === 'folded' ? 'opacity-40' : ''
              }`}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <div className={`size-9 rounded-full border-2 bg-cover bg-center ${
                player.status === 'playing' ? 'border-green-500' : 'border-gray-600'
              }`} style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=${encodeURIComponent(player.name.slice(0,2))}&background=random&size=40')` }}></div>
              <span className="text-white text-[10px] font-medium drop-shadow-md whitespace-nowrap">{player.name}</span>
              <span className="text-primary text-[10px] font-mono">${(player.balance / 1000).toFixed(1)}k</span>
              {player.status === 'folded' && (
                <span className="text-[9px] text-red-400 font-bold">棄牌</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Bar */}
      <div className="h-10 bg-[#231013] border-t border-[#492229] px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-gray-400">{activePlayers.length}/{table.players.length} 位玩家</span>
        </div>
        <span className="text-primary/60 font-mono">Hand #{table.handCount}</span>
      </div>
    </section>
  );
}

export default function MultiTablePage() {
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [table1, setTable1] = useState(() => createTable(1, '龍廳', '$100/200'));
  const [table2, setTable2] = useState(() => createTable(2, '鳳廳', '$500/1000'));

  const stepTables = useCallback(() => {
    setTable1(prev => simulateStep(prev));
    setTimeout(() => {
      setTable2(prev => simulateStep(prev));
    }, 800);
  }, []);

  // Auto-simulate every 3 seconds
  useEffect(() => {
    // Initial deal
    setTable1(prev => simulateStep(prev));
    setTable2(prev => simulateStep(prev));

    const interval = setInterval(stepTables, 3000);
    return () => clearInterval(interval);
  }, [stepTables]);

  return (
    <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-hidden">
      {/* Top Navigation */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-[#492229] bg-[#231013] px-6 py-3 shrink-0 z-20 shadow-lg">
        <div className="flex items-center gap-4 text-white">
          <div className="size-8 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">casino</span>
          </div>
          <h2 className="text-white text-xl font-bold leading-tight tracking-wider bg-gradient-to-b from-[#f3e5ab] via-[#d4af37] to-[#b08d26] bg-clip-text text-transparent">澳門豪華撲克</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 bg-surface-dark px-4 py-1.5 rounded-full border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="text-primary/80 text-xs font-bold uppercase tracking-wider">多桌模式</span>
              <span className="text-green-400 text-xs font-bold flex items-center gap-1">
                <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                直播中
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsRewardModalOpen(true)}
              className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-primary text-background-dark text-sm font-bold shadow-lg hover:bg-primary-dark transition-colors"
            >
              <span className="truncate">每日獎勵</span>
            </button>
            <Link href="/lobby" className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-[#492229] hover:bg-[#5e2c35] border border-primary/30 text-primary text-sm font-bold transition-colors">
              <span className="truncate">返回大廳</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content: Split View */}
      <main className="flex-1 flex overflow-hidden relative">
        <MiniTable table={table1} onJoin={() => router.push('/')} />
        <MiniTable table={table2} onJoin={() => router.push('/')} />
      </main>

      {/* Bottom Status Bar */}
      <footer className="bg-[#1a0b0d] border-t border-[#492229] text-gray-400 text-xs py-2 px-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>系統連線正常</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">visibility</span>
            <span>觀戰模式 - 點擊「加入牌桌」開始遊玩</span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>龍廳: #{table1.handCount}</span>
          <span>鳳廳: #{table2.handCount}</span>
        </div>
      </footer>

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
            <h4 className="text-xl font-bold text-white mb-2">每日獎勵</h4>
            <p className="text-gray-400 text-sm">每日登入遊戲即可領取免費籌碼。</p>
          </div>
          <button
            onClick={() => setIsRewardModalOpen(false)}
            className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:from-red-500 hover:to-red-700 transition"
          >
            立即領取
          </button>
        </div>
      </Modal>
    </div>
  );
}
