"use client";

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Deck, Card, evaluateHand, determineWinners } from '../../../utils/poker';
import { GameSounds } from '../../../utils/sounds';

type GameStage = 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

interface TPlayer {
    id: string;
    name: string;
    balance: number;
    status: 'playing' | 'folded' | 'thinking' | 'all-in' | 'eliminated';
    bet: number;
    cards: Card[];
    isUser?: boolean;
    role?: 'dealer' | 'small_blind' | 'big_blind';
    handName?: string;
    isWinner?: boolean;
    placement?: number;
}

const BLIND_LEVELS = [
    { sb: 25, bb: 50 },
    { sb: 50, bb: 100 },
    { sb: 100, bb: 200 },
    { sb: 200, bb: 400 },
    { sb: 400, bb: 800 },
    { sb: 800, bb: 1600 },
    { sb: 1500, bb: 3000 },
];

const STARTING_STACK = 5000;
const HANDS_PER_LEVEL = 4;

const AI_NAMES = ['龍王', '賭神', '鳳凰', '老虎', '黑豹', '金鷹', '銀狐'];

export default function TournamentPlayPage() {
    const { user: clerkUser } = useUser();
    const [tournamentState, setTournamentState] = useState<'LOBBY' | 'PLAYING' | 'FINISHED'>('LOBBY');
    const [players, setPlayers] = useState<TPlayer[]>([]);
    const [communityCards, setCommunityCards] = useState<Card[]>([]);
    const [potSize, setPotSize] = useState(0);
    const [gameStage, setGameStage] = useState<GameStage>('WAITING');
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(-1);
    const [currentBet, setCurrentBet] = useState(0);
    const [lastRaiserIndex, setLastRaiserIndex] = useState(-1);
    const [dealerButtonIndex, setDealerButtonIndex] = useState(-1);
    const [blindLevel, setBlindLevel] = useState(0);
    const [handsPlayed, setHandsPlayed] = useState(0);
    const [actionLog, setActionLog] = useState<string[]>([]);
    const [betAmount, setBetAmount] = useState(100);
    const [placements, setPlacements] = useState<{ name: string; place: number }[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);

    const deckRef = useRef<Deck>(new Deck());
    const playersRef = useRef(players);
    const communityCardsRef = useRef(communityCards);
    const potSizeRef = useRef(potSize);
    const currentBetRef = useRef(currentBet);
    const gameStageRef = useRef(gameStage);
    const currentPlayerIndexRef = useRef(currentPlayerIndex);
    const lastRaiserIndexRef = useRef(lastRaiserIndex);
    const placementsRef = useRef(placements);
    const soundRef = useRef(soundEnabled);

    useEffect(() => { playersRef.current = players; }, [players]);
    useEffect(() => { communityCardsRef.current = communityCards; }, [communityCards]);
    useEffect(() => { potSizeRef.current = potSize; }, [potSize]);
    useEffect(() => { currentBetRef.current = currentBet; }, [currentBet]);
    useEffect(() => { gameStageRef.current = gameStage; }, [gameStage]);
    useEffect(() => { currentPlayerIndexRef.current = currentPlayerIndex; }, [currentPlayerIndex]);
    useEffect(() => { lastRaiserIndexRef.current = lastRaiserIndex; }, [lastRaiserIndex]);
    useEffect(() => { placementsRef.current = placements; }, [placements]);
    useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

    const play = useCallback((s: keyof typeof GameSounds) => { if (soundRef.current) GameSounds[s](); }, []);
    const addLog = useCallback((msg: string) => { setActionLog(prev => [...prev.slice(-30), msg]); }, []);

    const currentBlinds = BLIND_LEVELS[Math.min(blindLevel, BLIND_LEVELS.length - 1)];

    // ========= TOURNAMENT INIT =========
    const startTournament = useCallback(() => {
        const aiCount = 5;
        const shuffledNames = [...AI_NAMES].sort(() => Math.random() - 0.5).slice(0, aiCount);
        const allPlayers: TPlayer[] = [
            { id: 'user', name: '你', balance: STARTING_STACK, status: 'playing', bet: 0, cards: [], isUser: true },
            ...shuffledNames.map((name, i) => ({
                id: `ai_${i}`, name, balance: STARTING_STACK, status: 'playing' as const,
                bet: 0, cards: [], isUser: false,
            })),
        ];
        setPlayers(allPlayers);
        setTournamentState('PLAYING');
        setBlindLevel(0);
        setHandsPlayed(0);
        setPlacements([]);
        setActionLog([]);
        addLog('--- 錦標賽開始! 6 名玩家，起始籌碼 $5,000 ---');
    }, [addLog]);

    // ========= AI DECISION =========
    const makeAiDecision = useCallback((player: TPlayer, cc: Card[], bet: number, pot: number): { action: PlayerAction; raiseAmount?: number } => {
        const bb = currentBlinds.bb;
        const callCost = bet - player.bet;
        const canCheck = callCost <= 0;

        let strength = 0.3;
        if (cc.length >= 3 && player.cards.length === 2) {
            try { strength = evaluateHand(player.cards, cc).rank / 10; } catch { strength = 0.3; }
        } else if (player.cards.length === 2) {
            const rk = '23456789TJQKA';
            const r1 = rk.indexOf(player.cards[0].rank === '10' ? 'T' : player.cards[0].rank);
            const r2 = rk.indexOf(player.cards[1].rank === '10' ? 'T' : player.cards[1].rank);
            strength = (Math.max(r1, r2) / 13) * 0.4;
            if (r1 === r2) strength += 0.35;
            if (player.cards[0].suit === player.cards[1].suit) strength += 0.05;
        }

        const adj = Math.max(0, Math.min(1, strength + (Math.random() - 0.5) * 0.3));
        const bluff = Math.random() < 0.08;

        if (adj >= 0.65 || bluff) {
            if (player.balance <= callCost) return { action: 'all-in' };
            return { action: 'raise', raiseAmount: Math.min(bet + Math.floor(bb * (2 + Math.random() * 2)), player.balance + player.bet) };
        } else if (adj >= 0.3 || (canCheck && adj >= 0.1)) {
            if (canCheck) return { action: 'check' };
            if (callCost <= player.balance * 0.3 || adj > 0.45) {
                return callCost >= player.balance ? { action: 'all-in' } : { action: 'call' };
            }
            return { action: 'fold' };
        }
        return canCheck ? { action: 'check' } : { action: 'fold' };
    }, [currentBlinds]);

    // ========= CORE ENGINE =========
    const findNext = useCallback((from: number, list: TPlayer[]): number => {
        for (let i = 1; i <= list.length; i++) {
            const idx = (from + i) % list.length;
            if (list[idx].status === 'playing') return idx;
        }
        return -1;
    }, []);

    const processActionRef = useRef<(action: PlayerAction, raiseAmount?: number) => void>(() => {});

    const runShowdown = useCallback((fp: TPlayer[], cc: Card[], pot: number) => {
        setGameStage('SHOWDOWN');
        setCurrentPlayerIndex(-1);
        const active = fp.filter(p => p.status !== 'folded' && p.status !== 'eliminated' && p.cards.length === 2);
        if (active.length === 0) return;
        const result = determineWinners(active.map(p => ({ playerId: p.id, holeCards: p.cards })), cc);
        const winAmt = Math.floor(pot / result.winningPlayerIds.length);
        const updated = fp.map(p => {
            if (result.winningPlayerIds.includes(p.id)) return { ...p, balance: p.balance + winAmt, isWinner: true, handName: result.handName };
            const h = result.allHands.find((x: any) => x.playerId === p.id);
            return { ...p, isWinner: false, handName: h?.name };
        });
        setPlayers(updated);
        setPotSize(pot);
        play('win');
        addLog(`🏆 ${updated.find(p => p.isWinner)?.name} 贏得 $${pot.toLocaleString()} (${result.handName})`);
    }, [addLog, play]);

    const dealRemaining = useCallback((pl: TPlayer[], cc: Card[], pot: number) => {
        let nc = [...cc];
        const needed = 5 - nc.length;
        if (needed > 0) nc = [...nc, ...deckRef.current.deal(needed)];
        setCommunityCards(nc);
        setTimeout(() => runShowdown(pl, nc, pot), 1000);
    }, [runShowdown]);

    const lastPlayerWin = useCallback((pl: TPlayer[], pot: number) => {
        const w = pl.find(p => p.status !== 'folded' && p.status !== 'eliminated')!;
        const upd = pl.map(p => p.id === w.id ? { ...p, balance: p.balance + pot, isWinner: true } : { ...p, isWinner: false });
        setPlayers(upd);
        setGameStage('SHOWDOWN');
        setCurrentPlayerIndex(-1);
        setPotSize(pot);
        play('win');
        addLog(`🏆 ${w.name} 贏得 $${pot.toLocaleString()} (其他棄牌)`);
    }, [addLog, play]);

    const endBettingRound = useCallback((pl: TPlayer[], cc: Card[], pot: number) => {
        const totalBets = pl.reduce((s, p) => s + p.bet, 0);
        const newPot = pot + totalBets;
        const reset = pl.map(p => ({ ...p, bet: 0 }));
        setPotSize(newPot);
        setCurrentBet(0);
        setLastRaiserIndex(-1);

        const stage = gameStageRef.current;
        let nc = [...cc];
        if (stage === 'PREFLOP') { nc = deckRef.current.deal(3); setCommunityCards(nc); setGameStage('FLOP'); play('newStage'); }
        else if (stage === 'FLOP') { nc = [...cc, ...deckRef.current.deal(1)]; setCommunityCards(nc); setGameStage('TURN'); play('newStage'); }
        else if (stage === 'TURN') { nc = [...cc, ...deckRef.current.deal(1)]; setCommunityCards(nc); setGameStage('RIVER'); play('newStage'); }
        else if (stage === 'RIVER') { runShowdown(reset, cc, newPot); return; }

        setPlayers(reset);
        const canAct = reset.filter(p => p.status === 'playing');
        if (canAct.length <= 1) { dealRemaining(reset, nc, newPot); return; }
        const dIdx = reset.findIndex(p => p.role === 'dealer');
        const first = findNext(dIdx, reset);
        if (first < 0) { dealRemaining(reset, nc, newPot); return; }
        setCurrentPlayerIndex(first);
        setLastRaiserIndex(first);
    }, [findNext, runShowdown, dealRemaining, play]);

    const advanceNext = useCallback((pl: TPlayer[], bet: number, raiser: number, from: number) => {
        const next = findNext(from, pl);
        if (next < 0) { endBettingRound(pl, communityCardsRef.current, potSizeRef.current); return; }
        const allMatched = pl.every(p => p.status === 'folded' || p.status === 'eliminated' || p.status === 'all-in' || p.bet >= bet);
        if (allMatched && next === raiser) { endBettingRound(pl, communityCardsRef.current, potSizeRef.current); return; }
        setCurrentPlayerIndex(next);
    }, [findNext, endBettingRound]);

    useEffect(() => {
        processActionRef.current = (action: PlayerAction, raiseAmount?: number) => {
            const ci = currentPlayerIndexRef.current;
            const cp = [...playersRef.current];
            const bet = currentBetRef.current;
            const pot = potSizeRef.current;
            let raiser = lastRaiserIndexRef.current;
            if (ci < 0 || ci >= cp.length) return;
            const p = cp[ci];
            if (!p || p.status === 'folded' || p.status === 'all-in' || p.status === 'eliminated') return;

            let nb = bet;
            switch (action) {
                case 'fold': cp[ci] = { ...p, status: 'folded' }; addLog(`${p.name} 棄牌`); play('fold'); break;
                case 'check': if (p.bet < bet) return; addLog(`${p.name} 過牌`); play('check'); break;
                case 'call': {
                    const c = Math.min(bet - p.bet, p.balance);
                    const nb2 = p.balance - c;
                    cp[ci] = { ...p, balance: nb2, bet: p.bet + c, status: nb2 === 0 ? 'all-in' : 'playing' };
                    addLog(`${p.name} 跟注 $${c}`); play('call'); break;
                }
                case 'raise': {
                    const t = raiseAmount || (bet + currentBlinds.bb);
                    const pay = Math.min(t - p.bet, p.balance);
                    const bal = p.balance - pay;
                    const pb = p.bet + pay;
                    cp[ci] = { ...p, balance: bal, bet: pb, status: bal === 0 ? 'all-in' : 'playing' };
                    nb = pb; raiser = ci;
                    addLog(`${p.name} 加注至 $${pb}`); play('raise'); break;
                }
                case 'all-in': {
                    const pb = p.bet + p.balance;
                    cp[ci] = { ...p, balance: 0, bet: pb, status: 'all-in' };
                    if (pb > nb) { nb = pb; raiser = ci; }
                    addLog(`${p.name} 全下!`); play('allIn'); break;
                }
            }
            setPlayers(cp);
            setCurrentBet(nb);
            setLastRaiserIndex(raiser);

            const remaining = cp.filter(p => p.status !== 'folded' && p.status !== 'eliminated');
            if (remaining.length === 1) {
                const tb = cp.reduce((s, p) => s + p.bet, 0);
                const fp = pot + tb;
                setPotSize(fp);
                lastPlayerWin(cp.map(p => ({ ...p, bet: 0 })), fp);
                return;
            }
            advanceNext(cp, nb, raiser, ci);
        };
    }, [addLog, play, lastPlayerWin, advanceNext, currentBlinds]);

    // AI turn trigger
    useEffect(() => {
        if (currentPlayerIndex < 0 || gameStage === 'SHOWDOWN' || gameStage === 'WAITING') return;
        const p = players[currentPlayerIndex];
        if (!p || p.isUser || p.status === 'folded' || p.status === 'all-in' || p.status === 'eliminated') return;

        setPlayers(prev => prev.map((pl, i) => i === currentPlayerIndex ? { ...pl, status: 'thinking' as const } : pl));
        const timer = setTimeout(() => {
            const cur = playersRef.current[currentPlayerIndex];
            if (!cur || cur.isUser) return;
            const restored = playersRef.current.map((pl, i) =>
                i === currentPlayerIndex && pl.status === 'thinking' ? { ...pl, status: 'playing' as const } : pl
            );
            playersRef.current = restored;
            setPlayers(restored);
            const d = makeAiDecision({ ...cur, status: 'playing' }, communityCardsRef.current, currentBetRef.current, potSizeRef.current);
            processActionRef.current(d.action, d.raiseAmount);
        }, 600 + Math.random() * 1000);
        return () => clearTimeout(timer);
    }, [currentPlayerIndex, gameStage, players, makeAiDecision]);

    // User turn sound
    useEffect(() => {
        if (currentPlayerIndex >= 0 && players[currentPlayerIndex]?.isUser && players[currentPlayerIndex]?.status === 'playing') {
            play('yourTurn');
        }
    }, [currentPlayerIndex, players, play]);

    // ========= START NEW HAND =========
    const startNewHand = useCallback(() => {
        const current = playersRef.current;
        // Eliminate busted players
        const alive = current.filter(p => p.balance > 0 || p.isUser);
        const busted = current.filter(p => p.balance <= 0 && !p.isUser && p.status !== 'eliminated');
        const currentPlacements = [...placementsRef.current];
        busted.forEach(b => {
            if (!currentPlacements.find(x => x.name === b.name)) {
                const place = alive.length + currentPlacements.length + 1;
                currentPlacements.push({ name: b.name, place });
                addLog(`${b.name} 被淘汰! 第 ${place} 名`);
            }
        });
        setPlacements(currentPlacements);

        const activePlayers = alive.filter(p => p.status !== 'eliminated').map(p => ({
            ...p, status: 'playing' as const, bet: 0, cards: [] as Card[], isWinner: false, handName: undefined, role: undefined,
        }));

        // Check tournament end
        if (activePlayers.length <= 1) {
            const winner = activePlayers[0] || current.find(p => p.isUser);
            const finalPlacements = [{ name: winner?.name || '你', place: 1 }, ...currentPlacements];
            setPlacements(finalPlacements);
            setTournamentState('FINISHED');
            addLog(`🏆 恭喜 ${winner?.name} 贏得錦標賽冠軍!`);
            return;
        }

        // Check blind level
        const newHandsPlayed = handsPlayed + 1;
        setHandsPlayed(newHandsPlayed);
        const newLevel = Math.min(Math.floor(newHandsPlayed / HANDS_PER_LEVEL), BLIND_LEVELS.length - 1);
        if (newLevel > blindLevel) {
            setBlindLevel(newLevel);
            const bl = BLIND_LEVELS[newLevel];
            addLog(`⬆ 盲注升級! 小盲 $${bl.sb} / 大盲 $${bl.bb}`);
        }
        const bl = BLIND_LEVELS[Math.min(newLevel, BLIND_LEVELS.length - 1)];

        deckRef.current.reset();
        setCommunityCards([]);

        const di = (dealerButtonIndex + 1) % activePlayers.length;
        setDealerButtonIndex(di);
        const sbi = (di + 1) % activePlayers.length;
        const bbi = (di + 2) % activePlayers.length;

        const dealt = activePlayers.map((p, i) => {
            const role = i === di ? 'dealer' as const : i === sbi ? 'small_blind' as const : i === bbi ? 'big_blind' as const : undefined;
            let bet = 0, bal = p.balance;
            if (i === sbi) { bet = Math.min(bl.sb, bal); bal -= bet; }
            else if (i === bbi) { bet = Math.min(bl.bb, bal); bal -= bet; }
            return { ...p, cards: deckRef.current.deal(2), status: (bal === 0 && bet > 0) ? 'all-in' as const : 'playing' as const, bet, balance: bal, role };
        });

        setPlayers(dealt);
        setPotSize(0);
        setCurrentBet(bl.bb);
        setBetAmount(bl.bb * 2);
        setGameStage('PREFLOP');

        const utg = (bbi + 1) % dealt.length;
        setLastRaiserIndex(utg);
        setCurrentPlayerIndex(utg);
        play('blind');
        setTimeout(() => play('deal'), 200);
        addLog(`--- 第 ${newHandsPlayed} 手 | 盲注 $${bl.sb}/$${bl.bb} ---`);
    }, [handsPlayed, blindLevel, dealerButtonIndex, addLog, play]);

    // Auto-advance after showdown
    useEffect(() => {
        if (gameStage === 'SHOWDOWN' && tournamentState === 'PLAYING') {
            const t = setTimeout(() => startNewHand(), 3000);
            return () => clearTimeout(t);
        }
    }, [gameStage, tournamentState, startNewHand]);

    // ========= UI =========
    const userPlayer = players.find(p => p.isUser);
    const isUserTurn = currentPlayerIndex >= 0 && players[currentPlayerIndex]?.isUser === true;
    const canCheck = isUserTurn && (userPlayer?.bet ?? 0) >= currentBet;
    const callAmount = isUserTurn ? Math.max(0, currentBet - (userPlayer?.bet ?? 0)) : 0;
    const minRaise = currentBet + currentBlinds.bb;
    const alivePlayers = players.filter(p => p.status !== 'eliminated' && p.balance > 0);
    const displayPot = potSize + players.reduce((s, p) => s + p.bet, 0);

    if (tournamentState === 'LOBBY') {
        return (
            <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col items-center justify-center font-['Noto_Sans_TC']">
                <div className="text-center max-w-md">
                    <span className="material-symbols-outlined text-6xl text-primary mb-4 block">emoji_events</span>
                    <h1 className="text-3xl font-black text-white mb-2">快速錦標賽 (SNG)</h1>
                    <p className="text-gray-400 mb-6 text-sm">6 名玩家 | 起始籌碼 $5,000 | 盲注自動升級</p>
                    <div className="bg-surface-dark border border-primary/30 rounded-xl p-6 mb-6 text-left">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-400">買入:</span><span className="text-white font-bold ml-2">$500</span></div>
                            <div><span className="text-gray-400">參賽人數:</span><span className="text-white font-bold ml-2">6 人</span></div>
                            <div><span className="text-gray-400">起始籌碼:</span><span className="text-white font-bold ml-2">$5,000</span></div>
                            <div><span className="text-gray-400">盲注升級:</span><span className="text-white font-bold ml-2">每 {HANDS_PER_LEVEL} 手</span></div>
                            <div><span className="text-gray-400">冠軍獎金:</span><span className="text-primary font-bold ml-2">$2,000</span></div>
                            <div><span className="text-gray-400">亞軍獎金:</span><span className="text-primary font-bold ml-2">$750</span></div>
                        </div>
                    </div>
                    <button onClick={startTournament} className="w-full py-4 rounded-xl bg-gradient-to-b from-primary to-yellow-700 hover:from-yellow-500 hover:to-yellow-800 text-black font-bold text-lg shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                        開始錦標賽
                    </button>
                    <Link href="/tournaments" className="block mt-4 text-gray-500 text-sm hover:text-white transition-colors">返回錦標賽大廳</Link>
                </div>
            </div>
        );
    }

    if (tournamentState === 'FINISHED') {
        const sortedPlacements = [...placements].sort((a, b) => a.place - b.place);
        const userPlace = sortedPlacements.find(p => p.name === '你')?.place ?? sortedPlacements.length;
        const prize = userPlace === 1 ? 2000 : userPlace === 2 ? 750 : userPlace === 3 ? 250 : 0;
        return (
            <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col items-center justify-center font-['Noto_Sans_TC']">
                <div className="text-center max-w-lg">
                    <span className="material-symbols-outlined text-7xl text-primary mb-4 block animate-bounce">emoji_events</span>
                    <h1 className="text-3xl font-black text-white mb-2">錦標賽結束!</h1>
                    <p className="text-gray-400 mb-6">你的名次: <span className="text-primary font-bold text-2xl">第 {userPlace} 名</span></p>
                    {prize > 0 && <p className="text-xl text-primary font-bold mb-6">獲得獎金: ${prize.toLocaleString()}</p>}
                    <div className="bg-surface-dark border border-primary/30 rounded-xl p-4 mb-6">
                        <table className="w-full text-sm">
                            <thead><tr className="text-gray-400 border-b border-gray-700"><th className="py-2 text-left">名次</th><th className="py-2 text-left">玩家</th><th className="py-2 text-right">獎金</th></tr></thead>
                            <tbody>
                                {sortedPlacements.map(p => (
                                    <tr key={p.name} className={`${p.name === '你' ? 'text-primary font-bold' : 'text-white'} border-b border-gray-800`}>
                                        <td className="py-2">#{p.place}</td>
                                        <td className="py-2">{p.name}</td>
                                        <td className="py-2 text-right">{p.place === 1 ? '$2,000' : p.place === 2 ? '$750' : p.place === 3 ? '$250' : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => { setTournamentState('LOBBY'); setGameStage('WAITING'); }} className="flex-1 py-3 rounded-xl bg-gradient-to-b from-primary to-yellow-700 text-black font-bold shadow-lg">再來一局</button>
                        <Link href="/tournaments" className="flex-1 py-3 rounded-xl bg-surface-dark border border-white/10 text-white font-bold text-center">返回大廳</Link>
                    </div>
                </div>
            </div>
        );
    }

    // PLAYING VIEW
    return (
        <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-hidden">
            {/* Tournament HUD */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#121212] border-b border-primary/20 shrink-0 text-xs">
                <div className="flex items-center gap-4">
                    <Link href="/tournaments" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">arrow_back</span>返回
                    </Link>
                    <span className="text-primary font-bold">快速錦標賽</span>
                </div>
                <div className="flex items-center gap-6">
                    <span className="text-gray-400">盲注: <span className="text-white font-mono font-bold">${currentBlinds.sb}/${currentBlinds.bb}</span></span>
                    <span className="text-gray-400">級別: <span className="text-white font-bold">{blindLevel + 1}</span></span>
                    <span className="text-gray-400">手數: <span className="text-white font-bold">{handsPlayed}</span></span>
                    <span className="text-gray-400">剩餘: <span className="text-primary font-bold">{alivePlayers.length}/{players.length || 6}</span></span>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-gray-400 hover:text-white">
                        <span className="material-symbols-outlined text-sm">{soundEnabled ? 'volume_up' : 'volume_off'}</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 relative flex items-center justify-center p-4">
                    <div className="relative w-full max-w-4xl aspect-[2.2/1] bg-[#35654d] rounded-[180px] border-[14px] border-[#3e2723] shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(0,0,0,0.6)] flex items-center justify-center felt-texture ring-1 ring-white/5">
                        {/* Community Cards */}
                        <div className="flex gap-2 items-center justify-center mb-8 z-20 h-20">
                            {communityCards.map((c, i) => (
                                <div key={i} className="w-14 h-20 bg-white rounded shadow-card flex flex-col justify-between p-1 border border-gray-300 animate-fade-in-up">
                                    <div className={`${c.suit === '♠' || c.suit === '♣' ? 'text-black' : 'text-red-600'} font-bold text-sm leading-none`}>{c.rank}</div>
                                    <div className={`self-center text-3xl ${c.suit === '♠' || c.suit === '♣' ? 'text-black' : 'text-red-600'} leading-none`}>{c.suit}</div>
                                    <div className={`${c.suit === '♠' || c.suit === '♣' ? 'text-black' : 'text-red-600'} font-bold text-sm leading-none self-end rotate-180`}>{c.rank}</div>
                                </div>
                            ))}
                            {Array(5 - communityCards.length).fill(0).map((_, i) => (
                                <div key={`e${i}`} className="w-14 h-20 rounded border border-white/10 bg-black/10 flex items-center justify-center">
                                    <div className="w-12 h-18 border border-dashed border-white/10 rounded-sm"></div>
                                </div>
                            ))}
                        </div>
                        {/* Pot */}
                        <div className="absolute top-[62%] left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
                            <div className="bg-black/60 px-4 py-1 rounded-full text-primary font-mono text-base font-bold border border-primary/30 backdrop-blur-sm">
                                ${displayPot.toLocaleString()}
                            </div>
                            <div className="text-white/40 text-[9px] uppercase tracking-widest font-bold">底池</div>
                        </div>
                        {/* Player Seats - arranged around table */}
                        {players.filter(p => p.status !== 'eliminated').map((player, idx) => {
                            const total = players.filter(p => p.status !== 'eliminated').length;
                            const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
                            const rx = 44, ry = 38;
                            const x = 50 + rx * Math.cos(angle);
                            const y = 50 + ry * Math.sin(angle);
                            const playerIdx = players.indexOf(player);
                            const isTurn = currentPlayerIndex === playerIdx && gameStage !== 'SHOWDOWN' && gameStage !== 'WAITING';

                            return (
                                <div key={player.id} className="absolute z-20" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                                    <div className="flex flex-col items-center gap-1">
                                        {/* Cards */}
                                        {player.cards.length > 0 && (
                                            <div className="flex gap-0.5 mb-0.5">
                                                {player.isUser || gameStage === 'SHOWDOWN' ? player.cards.map((c, i) => (
                                                    <div key={i} className="w-8 h-11 bg-white rounded-sm shadow flex flex-col justify-between p-0.5 border border-gray-300">
                                                        <div className={`${c.suit === '♠' || c.suit === '♣' ? 'text-black' : 'text-red-600'} font-bold text-[9px] leading-none`}>{c.rank}</div>
                                                        <div className={`self-center text-base ${c.suit === '♠' || c.suit === '♣' ? 'text-black' : 'text-red-600'}`}>{c.suit}</div>
                                                    </div>
                                                )) : (
                                                    <>
                                                        <div className="w-7 h-10 rounded-sm bg-blue-900 border border-blue-700 shadow"></div>
                                                        <div className="w-7 h-10 -ml-4 rounded-sm bg-blue-900 border border-blue-700 shadow"></div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {/* Avatar */}
                                        <div className={`w-12 h-12 rounded-full border-[3px] ${isTurn ? 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)] animate-pulse' : player.isUser ? 'border-primary' : 'border-gray-600'} bg-gray-800 bg-cover bg-center ${player.status === 'folded' ? 'opacity-40 grayscale' : ''}`}
                                            style={{ backgroundImage: `url('${player.isUser && clerkUser?.imageUrl ? clerkUser.imageUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=random`}')` }}>
                                        </div>
                                        {player.role && (
                                            <div className={`absolute -bottom-0 -right-0 w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border shadow
                                                ${player.role === 'dealer' ? 'bg-yellow-500 border-yellow-300 text-black' : player.role === 'small_blind' ? 'bg-blue-500 border-blue-300 text-white' : 'bg-red-500 border-red-300 text-white'}`}>
                                                {player.role === 'dealer' ? 'D' : player.role === 'small_blind' ? 'SB' : 'BB'}
                                            </div>
                                        )}
                                        {/* Name plate */}
                                        <div className={`px-3 py-0.5 rounded text-center ${player.isUser ? 'bg-surface-dark border border-primary/40' : 'bg-black/60 border border-gray-700'} min-w-[70px]`}>
                                            <div className="text-[10px] text-white font-bold truncate max-w-[70px]">{player.name}</div>
                                            <div className="text-[9px] font-mono text-primary">
                                                {player.isWinner ? <span className="text-yellow-400 animate-pulse">{player.handName}</span> :
                                                    player.status === 'folded' ? <span className="text-gray-500">棄牌</span> :
                                                        player.status === 'thinking' ? <span className="animate-pulse">思考...</span> :
                                                            player.status === 'all-in' ? <span className="text-red-400">ALL-IN</span> :
                                                                `$${player.balance.toLocaleString()}`}
                                            </div>
                                        </div>
                                        {player.bet > 0 && (
                                            <div className="text-[9px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded border border-white/10">${player.bet}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar Log */}
                <div className="w-64 bg-[#151515] border-l border-primary/20 flex flex-col shrink-0">
                    <div className="py-2 px-3 border-b border-white/5 bg-[#1a1a1a] text-[10px] text-gray-400 font-bold uppercase tracking-widest">遊戲紀錄</div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 text-[11px]">
                        {actionLog.map((msg, i) => (
                            <div key={i} className="text-gray-300 py-0.5 px-1 rounded hover:bg-white/5">{msg}</div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="h-16 bg-[#1a1a1a] border-t border-primary/20 flex items-center px-4 gap-3 shrink-0 relative">
                {gameStage !== 'SHOWDOWN' && gameStage !== 'WAITING' && !isUserTurn && (
                    <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">等待其他玩家...</div>
                    </div>
                )}
                <div className="flex gap-2 items-center mr-auto">
                    <button onClick={() => setBetAmount(Math.max(minRaise, Math.floor(displayPot / 2)))} className="h-7 px-2 rounded bg-[#333] hover:bg-[#444] border border-white/5 text-gray-300 text-[9px] font-bold">1/2 池</button>
                    <button onClick={() => setBetAmount(Math.max(minRaise, displayPot))} className="h-7 px-2 rounded bg-[#333] hover:bg-[#444] border border-white/5 text-gray-300 text-[9px] font-bold">底池</button>
                    <button onClick={() => setBetAmount((userPlayer?.balance ?? 0) + (userPlayer?.bet ?? 0))} className="h-7 px-2 rounded bg-[#333] hover:bg-[#444] border border-white/5 text-primary text-[9px] font-bold">全下</button>
                </div>
                <div className="flex items-center gap-2 w-44">
                    <span className="text-[9px] text-gray-400">$</span>
                    <input className="flex-1 h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-primary" type="range"
                        min={minRaise} max={(userPlayer?.balance ?? 0) + (userPlayer?.bet ?? 0)} value={betAmount}
                        onChange={e => setBetAmount(Number(e.target.value))} />
                    <span className="text-xs text-primary font-mono font-bold w-14 text-right">${betAmount}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => processActionRef.current('fold')} disabled={!isUserTurn}
                        className="h-10 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border-b-2 border-zinc-950 disabled:opacity-30 disabled:cursor-not-allowed">棄牌</button>
                    <button onClick={() => processActionRef.current(canCheck ? 'check' : 'call')} disabled={!isUserTurn}
                        className="h-10 px-4 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs border-b-2 border-emerald-950 disabled:opacity-30 disabled:cursor-not-allowed">
                        {canCheck ? '過牌' : `跟注 $${callAmount}`}
                    </button>
                    <button onClick={() => processActionRef.current('raise', betAmount)} disabled={!isUserTurn || (userPlayer?.balance ?? 0) <= 0}
                        className="h-10 px-5 rounded-lg bg-gradient-to-b from-primary to-primary-dark hover:from-red-600 hover:to-red-800 text-white font-bold text-xs border-b-2 border-red-950 disabled:opacity-30 disabled:cursor-not-allowed">
                        加注 ${betAmount}
                    </button>
                </div>
            </div>
        </div>
    );
}
