"use client";

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { GameSounds } from '@/utils/sounds';
import type { PublicGameState, PublicSeat, PlayerAction } from '@/types/multiplayer';
import type { Card } from '@/utils/poker';
import { SMALL_BLIND, BIG_BLIND, MAX_SEATS } from '@/types/multiplayer';

// 8-seat positions around the oval table
const SEAT_POSITIONS: Record<number, string> = {
    0: "absolute -bottom-10 md:-bottom-14 left-[30%] -translate-x-1/2 flex flex-col items-center gap-1 md:gap-2 z-30",
    1: "absolute top-1/2 -left-4 md:-left-10 -translate-y-1/2 flex flex-col items-center gap-1 md:gap-2 z-20",
    2: "absolute -top-6 md:-top-10 left-[12%] md:left-[15%] flex flex-col items-center gap-1 md:gap-2 z-20",
    3: "absolute -top-6 md:-top-10 left-[38%] flex flex-col items-center gap-1 md:gap-2 z-20",
    4: "absolute -top-6 md:-top-10 right-[38%] flex flex-col items-center gap-1 md:gap-2 z-20",
    5: "absolute -top-6 md:-top-10 right-[12%] md:right-[15%] flex flex-col items-center gap-1 md:gap-2 z-20",
    6: "absolute top-1/2 -right-4 md:-right-10 -translate-y-1/2 flex flex-col items-center gap-1 md:gap-2 z-20",
    7: "absolute -bottom-10 md:-bottom-14 right-[30%] translate-x-1/2 flex flex-col items-center gap-1 md:gap-2 z-30",
};

const WIN_ANIM_TARGETS: Record<number, { x: string; y: string }> = {
    0: { x: '-40%', y: '120%' },
    1: { x: '-140%', y: '0%' },
    2: { x: '-80%', y: '-120%' },
    3: { x: '-20%', y: '-120%' },
    4: { x: '20%', y: '-120%' },
    5: { x: '80%', y: '-120%' },
    6: { x: '140%', y: '0%' },
    7: { x: '40%', y: '120%' },
};

const DEALER_POOL = [
    { id: '1', name: 'Lucia', style: '\u5df4\u897f\u98a8\u60c5', desc: '\u9996\u5e2d\u8377\u5b98 \u2022 \u71b1\u60c5\u6d3b\u529b', image: '/dealers/dealer-1.png' },
    { id: '2', name: 'Natasha', style: '\u4fc4\u5f0f\u512a\u96c5', desc: '\u660e\u661f\u8377\u5b98 \u2022 \u51b7\u8c54\u9ad8\u8cb4', image: '/dealers/dealer-2.png' },
    { id: '3', name: 'Camille', style: '\u6cd5\u5f0f\u9b45\u529b', desc: '\u738b\u724c\u8377\u5b98 \u2022 \u4eba\u6c23\u6700\u9ad8', image: '/dealers/dealer-3.png' },
    { id: '4', name: 'Ploy', style: '\u6cf0\u5f0f\u98a8\u83ef', desc: '\u5c08\u696d\u8377\u5b98 \u2022 \u50b3\u7d71\u878d\u5408', image: '/dealers/dealer-4.png' },
];

export default function MultiplayerGamePage() {
    const { signOut } = useClerk();
    const { user: clerkUser } = useUser();
    const params = useParams();
    const router = useRouter();
    const tableId = params.tableId as string;

    // Game state from Realtime
    const [gameState, setGameState] = useState<PublicGameState | null>(null);
    const [myHoleCards, setMyHoleCards] = useState<Card[]>([]);
    const [mySeatIndex, setMySeatIndex] = useState<number>(-1);
    const [playerBalance, setPlayerBalance] = useState(10000);
    const [betAmount, setBetAmount] = useState(BIG_BLIND * 2);
    const [dealerMessage, setDealerMessage] = useState<string | null>('\u6b61\u8fce\u5165\u5ea7\uff0c\u5373\u5c07\u958b\u5c40...');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const soundEnabledRef = useRef(true);
    const [turnTimeLeft, setTurnTimeLeft] = useState(-1);
    const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [winAnimation, setWinAnimation] = useState<{ active: boolean; winnerSeatIndex: number; winnerName: string; potAmount: number } | null>(null);
    const [fillDeadline, setFillDeadline] = useState<string | null>(null);
    const [isActionPending, setIsActionPending] = useState(false);
    const [startCountdown, setStartCountdown] = useState(-1);
    const prevStateRef = useRef<PublicGameState | null>(null);
    const hasStartedFirstHand = useRef(false);

    const dealer = DEALER_POOL[Math.floor(Math.random() * DEALER_POOL.length)];

    useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

    const playSound = useCallback((sound: keyof typeof GameSounds) => {
        if (soundEnabledRef.current) GameSounds[sound]();
    }, []);

    // Fetch initial state and subscribe to Realtime
    useEffect(() => {
        if (!tableId) return;

        const supabase = createClient();

        // Fetch initial state
        const fetchState = async () => {
            const { data } = await supabase
                .from('poker_tables')
                .select('game_state, fill_deadline')
                .eq('id', tableId)
                .single();
            if (data) {
                setGameState(data.game_state);
                setFillDeadline(data.fill_deadline);
            }
        };
        fetchState();

        // Fetch my cards
        const fetchMyCards = async () => {
            const res = await fetch(`/api/multiplayer/my-cards?tableId=${tableId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.holeCards) setMyHoleCards(data.holeCards);
                if (data.seatIndex !== undefined) setMySeatIndex(data.seatIndex);
            }
        };
        fetchMyCards();

        // Subscribe to Realtime
        const channel = supabase
            .channel(`table:${tableId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'poker_tables', filter: `id=eq.${tableId}` },
                (payload) => {
                    const newState = payload.new.game_state as PublicGameState;
                    handleStateUpdate(newState);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tableId]);

    // Handle state updates with sound effects
    const handleStateUpdate = useCallback((newState: PublicGameState) => {
        const prev = prevStateRef.current;
        setGameState(newState);
        prevStateRef.current = newState;

        // Play sounds based on state changes
        if (prev) {
            if (!prev.isHandInProgress && newState.isHandInProgress) {
                playSound('blind');
                setTimeout(() => playSound('deal'), 300);
                // Fetch new hole cards
                fetch(`/api/multiplayer/my-cards?tableId=${tableId}`)
                    .then(r => r.json())
                    .then(d => { if (d.holeCards) setMyHoleCards(d.holeCards); });
            }
            if (prev.stage !== newState.stage && newState.stage !== 'SHOWDOWN' && newState.stage !== 'PREFLOP') {
                playSound('newStage');
            }
            if (newState.stage === 'SHOWDOWN' && prev.stage !== 'SHOWDOWN') {
                playSound('win');
                // Show win animation
                const winner = newState.seats.find(s => s?.isWinner);
                if (winner) {
                    setWinAnimation({
                        active: true,
                        winnerSeatIndex: winner.seatIndex,
                        winnerName: winner.displayName,
                        potAmount: newState.potSize,
                    });
                    setTimeout(() => setWinAnimation(null), 2500);
                }
            }
            // Check if it became our turn
            if (mySeatIndex >= 0 && newState.currentSeatIndex === mySeatIndex && newState.isHandInProgress) {
                playSound('yourTurn');
            }
        }

        // Update balance from our seat
        const mySeat = newState.seats[mySeatIndex];
        if (mySeat) {
            setPlayerBalance(mySeat.chipBalance);
        }
    }, [mySeatIndex, playSound, tableId]);

    // Auto-start first hand with visible countdown
    useEffect(() => {
        if (!gameState || hasStartedFirstHand.current) return;
        if (gameState.isHandInProgress) { hasStartedFirstHand.current = true; setStartCountdown(-1); return; }
        if (gameState.stage !== 'WAITING') return;

        const activeSeats = gameState.seats.filter(s => s && s.chipBalance > 0);
        if (activeSeats.length < 2) return;

        hasStartedFirstHand.current = true;
        setStartCountdown(5);

        const countdownInterval = setInterval(() => {
            setStartCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownInterval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        const timer = setTimeout(async () => {
            setStartCountdown(-1);
            await fetch('/api/multiplayer/start-hand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId }),
            });
        }, 5000);

        return () => { clearInterval(countdownInterval); clearTimeout(timer); };
    }, [gameState, tableId]);

    // Auto-start next hand after showdown
    useEffect(() => {
        if (!gameState) return;
        if (gameState.stage !== 'SHOWDOWN' || gameState.isHandInProgress) return;
        if (!gameState.autoStartAt) return;

        const delay = new Date(gameState.autoStartAt).getTime() - Date.now();
        const timer = setTimeout(async () => {
            await fetch('/api/multiplayer/start-hand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId }),
            });
        }, Math.max(0, delay));

        return () => clearTimeout(timer);
    }, [gameState?.stage, gameState?.isHandInProgress, gameState?.autoStartAt, tableId]);

    // Fill AI when deadline passes
    useEffect(() => {
        if (!fillDeadline) return;
        const delay = new Date(fillDeadline).getTime() - Date.now();
        if (delay <= 0) {
            fetch('/api/multiplayer/fill-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId }),
            });
            return;
        }
        const timer = setTimeout(() => {
            fetch('/api/multiplayer/fill-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId }),
            });
        }, delay);
        return () => clearTimeout(timer);
    }, [fillDeadline, tableId]);

    // Turn timer for own turns
    useEffect(() => {
        if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
        setTurnTimeLeft(-1);

        if (!gameState || !gameState.isHandInProgress || mySeatIndex < 0) return;
        if (gameState.currentSeatIndex !== mySeatIndex) return;
        if (!gameState.actionDeadline) return;

        const deadline = new Date(gameState.actionDeadline).getTime();
        const remaining = Math.ceil((deadline - Date.now()) / 1000);
        if (remaining <= 0) return;

        setTurnTimeLeft(remaining);
        turnTimerRef.current = setInterval(() => {
            setTurnTimeLeft(prev => {
                if (prev <= 1) {
                    if (turnTimerRef.current) clearInterval(turnTimerRef.current);
                    turnTimerRef.current = null;
                    // Auto-fold
                    handleAction('fold');
                    return -1;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
        };
    }, [gameState?.currentSeatIndex, gameState?.actionDeadline, mySeatIndex]);

    // Handle player action
    const handleAction = useCallback(async (action: PlayerAction, raiseAmount?: number) => {
        if (isActionPending) return;
        setIsActionPending(true);
        try {
            await fetch('/api/multiplayer/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId, action, raiseAmount }),
            });
        } catch (err) {
            console.error('Action error:', err);
        }
        setIsActionPending(false);
    }, [tableId, isActionPending]);

    // Leave table
    const handleLeave = useCallback(async () => {
        await fetch('/api/multiplayer/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId }),
        });
        router.push('/lobby');
    }, [tableId, router]);

    // Computed values
    const isMyTurn = gameState ? gameState.currentSeatIndex === mySeatIndex && gameState.isHandInProgress : false;
    const mySeat = gameState?.seats[mySeatIndex] ?? null;
    const canCheck = isMyTurn && (mySeat?.bet ?? 0) >= (gameState?.currentBet ?? 0);
    const callAmount = isMyTurn ? Math.max(0, (gameState?.currentBet ?? 0) - (mySeat?.bet ?? 0)) : 0;
    const minRaise = (gameState?.currentBet ?? 0) + BIG_BLIND;
    const communityCards = gameState?.communityCards ?? [];
    const potSize = gameState?.potSize ?? 0;
    const displayPot = potSize + (gameState?.seats.reduce((s, p) => s + (p?.bet ?? 0), 0) ?? 0);
    const isWaiting = !gameState?.isHandInProgress;

    if (!gameState) {
        return (
            <div className="bg-[#1a160a] h-screen flex items-center justify-center text-accent-gold">
                <div className="animate-pulse text-xl font-bold">\u8f09\u5165\u4e2d...</div>
            </div>
        );
    }

    return (
        <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between whitespace-nowrap border-b border-accent-gold/20 bg-[#121212] px-3 md:px-6 py-2 md:py-3 shrink-0 z-50 shadow-lg">
                <div className="flex items-center gap-2 md:gap-4 text-white">
                    <Link href="/lobby" className="flex items-center justify-center size-8 md:size-10 rounded bg-gradient-to-br from-primary to-primary-dark shadow-lg border border-white/10">
                        <span className="material-symbols-outlined !text-[20px] md:!text-[24px] text-white drop-shadow-md">arrow_back</span>
                    </Link>
                    <div>
                        <h2 className="text-accent-gold-light text-base md:text-xl font-serif font-bold leading-tight tracking-wide">\u591a\u4eba\u5fb7\u5dde\u64b2\u514b</h2>
                        <div className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest hidden sm:block">\u724c\u684c #{gameState.handCount}</div>
                    </div>
                </div>
                <div className="flex gap-2 md:gap-4 items-center">
                    <div className="flex items-center gap-1.5 md:gap-3 bg-black/40 rounded px-2 md:px-4 py-1.5 md:py-2 border border-accent-gold/30 shadow-inner">
                        <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-accent-gold flex items-center justify-center text-black text-[10px] md:text-xs font-bold">$</div>
                        <span className="text-xs md:text-sm font-mono font-bold text-white tracking-wider">{playerBalance.toLocaleString()}</span>
                    </div>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="flex items-center justify-center rounded-full size-8 md:size-10 bg-surface-dark hover:bg-neutral-700 text-gray-300 transition-colors border border-white/5">
                        <span className="material-symbols-outlined text-[18px] md:text-[20px]">{soundEnabled ? 'volume_up' : 'volume_off'}</span>
                    </button>
                    <button onClick={handleLeave} className="flex items-center justify-center gap-1 rounded-lg h-8 md:h-9 px-2 md:px-3 bg-white/5 hover:bg-red-900/40 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-300 text-xs font-medium transition-all">
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span className="hidden md:inline">\u96e2\u958b</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <div className="flex-1 flex flex-col relative bg-[#0f0f0f]">
                    <div className="absolute inset-0 bg-black/90 z-0">
                        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black"></div>
                    </div>

                    {/* Dealer Area */}
                    <div className="relative z-10 w-full h-[8vh] md:h-[12vh] bg-black shadow-2xl overflow-hidden border-b border-accent-gold/20 shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60"></div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full flex items-end justify-center z-10 pointer-events-none">
                            <div className="relative w-[80px] md:w-[140px] h-[110%] bg-no-repeat transition-all duration-700 rounded-t-xl" style={{ backgroundImage: `url('${dealer.image}')`, backgroundSize: '180%', backgroundPosition: 'center 12%' }}>
                                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none"></div>
                                {dealerMessage && (
                                    <div className="absolute top-[10%] right-[-30%] bg-surface-dark/95 border border-primary/40 text-white px-3 py-1.5 rounded-2xl rounded-bl-sm font-bold shadow-[0_0_20px_rgba(212,175,55,0.3)] z-50 backdrop-blur text-[10px] md:text-xs whitespace-nowrap">
                                        {dealerMessage}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="absolute top-2 right-3 flex flex-col items-end gap-1 z-20">
                            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded border-l-2 border-accent-gold">
                                <span className="text-white font-serif font-bold text-xs md:text-sm block leading-none">\u591a\u4eba\u724c\u684c</span>
                                <span className="text-accent-gold text-[9px] md:text-[10px] font-mono uppercase tracking-wider">{SMALL_BLIND}/{BIG_BLIND} \u2022 {gameState.seats.filter(s => s !== null).length}\u4eba</span>
                            </div>
                        </div>
                    </div>

                    {/* Poker Table */}
                    <div className="flex-1 relative flex items-center justify-center p-2 z-10 overflow-hidden -mt-4">
                        <div className="relative w-full max-w-5xl aspect-[1.8/1] md:aspect-[2.2/1] bg-[#35654d] rounded-[80px] md:rounded-[180px] border-[8px] md:border-[16px] border-[#3e2723] shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_40px_rgba(0,0,0,0.6)] flex items-center justify-center felt-texture ring-1 ring-white/5 wood-texture">
                            <div className="absolute inset-4 rounded-[160px] border border-yellow-400/10 pointer-events-none"></div>
                            <div className="absolute opacity-5 pointer-events-none select-none flex flex-col items-center justify-center transform scale-y-75">
                                <span className="text-4xl md:text-6xl font-serif font-bold text-black tracking-[0.5em] mb-2">ROYAL</span>
                                <span className="text-2xl md:text-4xl font-serif text-black tracking-[0.3em]">CASINO</span>
                            </div>

                            {/* Community Cards */}
                            <div className="flex gap-1 md:gap-2.5 items-center justify-center mb-6 md:mb-10 z-20 h-14 md:h-22">
                                {communityCards.map((card, idx) => (
                                    <div key={idx} className="w-9 h-14 md:w-14 md:h-22 bg-white rounded shadow-card flex flex-col justify-between p-0.5 md:p-1.5 border border-gray-300 animate-fade-in-up">
                                        <div className={`${card.suit === '\u2660' || card.suit === '\u2663' ? 'text-black' : 'text-red-600'} font-card font-bold text-[10px] md:text-base leading-none`}>{card.rank}</div>
                                        <div className={`self-center text-xl md:text-3xl ${card.suit === '\u2660' || card.suit === '\u2663' ? 'text-black' : 'text-red-600'} leading-none`}>{card.suit}</div>
                                        <div className={`${card.suit === '\u2660' || card.suit === '\u2663' ? 'text-black' : 'text-red-600'} font-card font-bold text-[10px] md:text-base leading-none self-end rotate-180`}>{card.rank}</div>
                                    </div>
                                ))}
                                {Array(5 - communityCards.length).fill(0).map((_, idx) => (
                                    <div key={`empty-${idx}`} className="w-9 h-14 md:w-14 md:h-22 rounded border border-white/10 shadow-inner bg-black/10 flex items-center justify-center">
                                        <div className="w-7 h-12 md:w-12 md:h-20 border-2 border-dashed border-white/10 rounded-sm"></div>
                                    </div>
                                ))}
                            </div>

                            {/* Start Countdown Overlay */}
                            {startCountdown > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                                    <div className="flex flex-col items-center gap-2 animate-pulse">
                                        <div className="text-6xl md:text-8xl font-bold text-accent-gold drop-shadow-[0_0_30px_rgba(212,175,55,0.8)] font-mono">{startCountdown}</div>
                                        <div className="text-sm md:text-lg text-white/80 font-bold tracking-widest uppercase">開局倒數</div>
                                    </div>
                                </div>
                            )}

                            {/* Pot Display */}
                            <div className="absolute top-[58%] left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
                                <div className={`bg-black/60 px-3 md:px-5 py-1 md:py-1.5 rounded-full text-accent-gold font-mono text-sm md:text-lg font-bold border border-accent-gold/30 shadow-lg backdrop-blur-sm mb-1 transition-all duration-500 ${winAnimation?.active ? 'scale-125 text-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : ''}`}>
                                    ${displayPot.toLocaleString()}
                                </div>
                                <div className="text-white/40 text-[7px] md:text-[10px] uppercase tracking-widest font-bold">\u7e3d\u5e95\u6c60</div>
                            </div>

                            {/* Player Seats */}
                            {gameState.seats.map((seat, idx) => {
                                if (!seat) {
                                    // Empty seat
                                    return (
                                        <div key={`empty-seat-${idx}`} className={SEAT_POSITIONS[idx]}>
                                            <div className="w-10 h-10 md:w-14 md:h-14 rounded-full border-2 border-dashed border-white/10 bg-black/20 flex items-center justify-center">
                                                <span className="text-white/20 text-[10px]">{idx + 1}</span>
                                            </div>
                                        </div>
                                    );
                                }

                                const isMe = idx === mySeatIndex;
                                const posClass = SEAT_POSITIONS[idx];
                                const foldedClass = seat.status === 'folded' ? 'opacity-40 grayscale' : '';
                                const isCurrentTurn = gameState.currentSeatIndex === idx && gameState.isHandInProgress;

                                if (isMe) {
                                    // My seat - show hole cards
                                    return (
                                        <div key={`seat-${idx}`} className={posClass}>
                                            {/* Hole cards */}
                                            <div className="flex gap-1 md:gap-1.5 -mb-4 md:-mb-6 z-10">
                                                {myHoleCards.length > 0 && gameState.isHandInProgress ? myHoleCards.map((card, ci) => (
                                                    <div key={ci} className={`w-12 h-18 md:w-18 md:h-26 bg-white rounded-md shadow-[0_5px_15px_rgba(0,0,0,0.4)] flex flex-col justify-between p-1 md:p-1.5 border border-gray-300 ${ci === 0 ? '-rotate-6' : 'rotate-6'} transition-transform`}>
                                                        <div className={`${card.suit === '\u2660' || card.suit === '\u2663' ? 'text-black' : 'text-red-600'} font-card font-bold text-sm md:text-lg leading-none`}>{card.rank}</div>
                                                        <div className={`self-center text-2xl md:text-4xl ${card.suit === '\u2660' || card.suit === '\u2663' ? 'text-black' : 'text-red-600'} leading-none`}>{card.suit}</div>
                                                        <div className={`${card.suit === '\u2660' || card.suit === '\u2663' ? 'text-black' : 'text-red-600'} font-card font-bold text-sm md:text-lg leading-none self-end rotate-180`}>{card.rank}</div>
                                                    </div>
                                                )) : seat.status === 'sitting-out' ? null : (
                                                    <div className="flex gap-1">
                                                        <div className="w-12 h-18 md:w-18 md:h-26 rounded-md card-pattern shadow-md -rotate-6"></div>
                                                        <div className="w-12 h-18 md:w-18 md:h-26 rounded-md card-pattern shadow-md rotate-6"></div>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Avatar + info */}
                                            <div className="relative z-20 mt-2 md:mt-4 flex flex-col items-center">
                                                <div className="relative">
                                                    <div className={`w-14 h-14 md:w-20 md:h-20 rounded-full border-[3px] ${seat.isWinner ? 'border-yellow-400' : isCurrentTurn ? 'border-green-400 shadow-[0_0_25px_rgba(74,222,128,0.5)] animate-pulse' : 'border-accent-gold'} bg-gray-700 bg-cover bg-center shadow-lg`} style={{ backgroundImage: `url('${seat.avatarUrl || clerkUser?.imageUrl || ''}')` }}></div>
                                                    {turnTimeLeft > 0 && isCurrentTurn && (
                                                        <svg className="absolute inset-[-4px] w-[84px] h-[84px] -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                                                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                                                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke={turnTimeLeft <= 10 ? '#ef4444' : '#22c55e'} strokeWidth="2.5" strokeDasharray={`${(turnTimeLeft / 30) * 100}, 100`} strokeLinecap="round" className="transition-all duration-1000" />
                                                        </svg>
                                                    )}
                                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent-gold text-surface-dark rounded-full flex items-center justify-center border-2 border-surface-dark shadow-md z-10">
                                                        <span className="material-symbols-outlined text-[10px] font-bold">star</span>
                                                    </div>
                                                    {seat.role === 'dealer' && <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center border border-yellow-300 shadow text-[9px] text-black font-bold">D</div>}
                                                    {seat.role === 'small_blind' && <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-2 border-blue-300 text-[8px] text-white font-bold z-20">SB</div>}
                                                    {seat.role === 'big_blind' && <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-300 text-[8px] text-white font-bold z-20">BB</div>}
                                                </div>
                                                <div className={`bg-surface-dark px-3 md:px-5 py-1 md:py-1.5 rounded-lg border text-center min-w-[70px] md:min-w-[100px] shadow-xl -mt-2 z-20 relative ${seat.isWinner ? 'border-yellow-400' : 'border-accent-gold/50'}`}>
                                                    {seat.lastAction && (
                                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/90 text-yellow-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-yellow-500/40 whitespace-nowrap animate-fade-in-up z-30">{seat.lastAction}</div>
                                                    )}
                                                    <div className={`text-xs font-bold ${seat.isWinner ? 'text-yellow-300' : 'text-white'}`}>{seat.displayName}</div>
                                                    <div className="text-[10px] text-accent-gold font-mono font-bold">
                                                        {seat.isWinner ? <span className="text-yellow-400">\ud83c\udfc6 \u52dd\u51fa\uff01</span> : seat.status === 'all-in' ? <span className="text-red-400">ALL-IN</span> : `$${seat.chipBalance.toLocaleString()}`}
                                                    </div>
                                                </div>
                                                {seat.bet > 0 && (
                                                    <div className="mt-0.5 flex items-center gap-1">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-red-600 border-2 border-dashed border-white/40 poker-chip"></div>
                                                        <span className="text-[9px] font-bold text-white bg-black/70 px-1 py-0.5 rounded border border-white/10">${seat.bet.toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                // Other player seat
                                return (
                                    <div key={`seat-${idx}`} className={`${posClass} ${foldedClass}`.trim()}>
                                        <div className="relative">
                                            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full border-2 ${seat.isWinner ? 'border-yellow-400' : isCurrentTurn ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)] animate-pulse' : 'border-surface-dark'} bg-gray-800 bg-cover bg-center shadow-lg`} style={{ backgroundImage: `url('${seat.avatarUrl}')` }}></div>
                                            {seat.role === 'dealer' && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center border border-yellow-300 shadow text-[9px] text-black font-bold">D</div>}
                                            {seat.role === 'small_blind' && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-2 border-blue-300 text-[8px] text-white font-bold z-20">SB</div>}
                                            {seat.role === 'big_blind' && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-300 text-[8px] text-white font-bold z-20">BB</div>}
                                            {seat.playerType === 'real' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border border-white/50 shadow z-20"></div>}
                                        </div>
                                        <div className={`bg-surface-dark/95 backdrop-blur px-2 md:px-3 py-0.5 md:py-1 rounded border ${seat.isWinner ? 'border-yellow-400' : 'border-gray-700'} text-center min-w-[50px] md:min-w-[80px] relative`}>
                                            {seat.lastAction && (
                                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/90 text-yellow-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-yellow-500/40 whitespace-nowrap animate-fade-in-up z-30">{seat.lastAction}</div>
                                            )}
                                            <div className={`text-[10px] font-bold truncate max-w-[70px] ${seat.isWinner ? 'text-yellow-300' : 'text-gray-200'}`}>{seat.displayName}</div>
                                            <div className="text-[10px] text-accent-gold font-mono">
                                                {seat.isWinner ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-yellow-400 font-bold">\ud83c\udfc6</span>
                                                        {seat.handName && <span className="text-yellow-300/80 text-[8px]">{seat.handName}</span>}
                                                    </div>
                                                ) : seat.status === 'folded' ? <span className="text-gray-400 text-[9px]">\u5df2\u68c4\u724c</span>
                                                    : seat.status === 'all-in' ? <span className="text-red-400 font-bold text-[9px]">ALL-IN</span>
                                                        : `$${seat.chipBalance.toLocaleString()}`}
                                            </div>
                                        </div>
                                        {/* Show cards at showdown */}
                                        {seat.revealedCards && seat.revealedCards.length > 0 && gameState.stage === 'SHOWDOWN' && (
                                            <div className="flex gap-0.5 mt-0.5">
                                                {seat.revealedCards.map((card, ci) => (
                                                    <div key={ci} className="w-7 h-10 bg-white rounded-sm shadow-md flex flex-col justify-between p-0.5 border border-gray-300">
                                                        <div className={`${card.suit === '\u2660' || card.suit === '\u2663' ? 'text-black' : 'text-red-600'} font-card font-bold text-[8px] leading-none`}>{card.rank}</div>
                                                        <div className={`self-center text-sm ${card.suit === '\u2660' || card.suit === '\u2663' ? 'text-black' : 'text-red-600'} leading-none`}>{card.suit}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* Face-down cards during play */}
                                        {!seat.revealedCards && seat.status !== 'folded' && seat.status !== 'waiting' && seat.status !== 'sitting-out' && gameState.isHandInProgress && (
                                            <div className="flex gap-0.5 mt-0.5">
                                                <div className="w-6 h-9 rounded-sm card-pattern shadow-md"></div>
                                                <div className="w-6 h-9 -ml-4 rounded-sm card-pattern shadow-md"></div>
                                            </div>
                                        )}
                                        {seat.bet > 0 && (
                                            <div className="flex items-center gap-0.5 mt-0.5">
                                                <div className="w-3.5 h-3.5 rounded-full bg-red-600 border-2 border-dashed border-white/40 poker-chip"></div>
                                                <span className="text-[9px] font-bold text-white bg-black/70 px-1 py-0.5 rounded border border-white/10">${seat.bet.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="bg-[#1a1a1a] border-t border-accent-gold/20 z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] relative shrink-0 py-2 px-2 md:px-4">
                        {/* Turn timer warning */}
                        {turnTimeLeft > 0 && turnTimeLeft <= 10 && isMyTurn && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600/95 text-white font-bold text-sm px-5 py-1 rounded-t-lg shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse z-50 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">timer</span>
                                <span>{turnTimeLeft}\u79d2</span>
                            </div>
                        )}

                        {/* Not my turn overlay */}
                        {gameState.isHandInProgress && !isMyTurn && gameState.stage !== 'SHOWDOWN' && (
                            <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-[1px]">
                                <div className="text-gray-400 text-sm font-bold uppercase tracking-widest animate-pulse">\u7b49\u5f85\u5176\u4ed6\u73a9\u5bb6...</div>
                            </div>
                        )}

                        {isWaiting ? (
                            <div className="flex items-center justify-center py-2">
                                <span className="text-accent-gold/70 text-sm font-bold animate-pulse">\u6e96\u5099\u958b\u59cb...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1.5 max-w-2xl mx-auto">
                                {/* Bet controls */}
                                <div className="flex items-center gap-3 w-full">
                                    <div className="flex gap-1.5 shrink-0">
                                        <button onClick={() => setBetAmount(Math.max(minRaise, Math.floor(potSize / 2)))} className="h-6 px-2 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-white/10 text-gray-400 text-[10px] font-bold transition-colors">\u00bd</button>
                                        <button onClick={() => setBetAmount(Math.max(minRaise, Math.floor(potSize * 0.75)))} className="h-6 px-2 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-white/10 text-gray-400 text-[10px] font-bold transition-colors">\u00be</button>
                                        <button onClick={() => setBetAmount(Math.max(minRaise, potSize))} className="h-6 px-2 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-white/10 text-gray-400 text-[10px] font-bold transition-colors">\u5e95\u6c60</button>
                                        <button onClick={() => setBetAmount(playerBalance + (mySeat?.bet ?? 0))} className="h-6 px-2 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-accent-gold/30 text-accent-gold text-[10px] font-bold transition-colors">MAX</button>
                                    </div>
                                    <input className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-gold" max={playerBalance + (mySeat?.bet ?? 0)} min={minRaise} type="range" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} />
                                    <div className="bg-black/80 border border-accent-gold/40 px-3 py-0.5 rounded text-accent-gold font-mono font-bold text-sm min-w-[70px] text-center shrink-0">${betAmount.toLocaleString()}</div>
                                </div>
                                {/* Action buttons */}
                                <div className="flex gap-2 w-full">
                                    <button onClick={() => handleAction('fold')} disabled={!isMyTurn || isActionPending} className="flex-1 h-10 rounded-lg bg-gradient-to-b from-gray-600 to-gray-800 hover:from-gray-500 hover:to-gray-700 text-white font-bold text-sm border-b-2 border-gray-900 active:border-b-0 active:translate-y-0.5 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed">
                                        \u68c4\u724c
                                    </button>
                                    <button onClick={() => handleAction(canCheck ? 'check' : 'call')} disabled={!isMyTurn || isActionPending} className="flex-1 h-10 rounded-lg bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-bold text-sm border-b-2 border-blue-950 active:border-b-0 active:translate-y-0.5 transition-all shadow-lg flex flex-col items-center justify-center leading-tight disabled:opacity-30 disabled:cursor-not-allowed">
                                        <span>{canCheck ? '\u904e\u724c' : '\u8ddf\u6ce8'}</span>
                                        {!canCheck && callAmount > 0 && <span className="text-[9px] font-normal text-blue-200">${callAmount.toLocaleString()}</span>}
                                    </button>
                                    <button onClick={() => handleAction('raise', betAmount)} disabled={!isMyTurn || isActionPending || playerBalance <= 0} className="flex-[1.3] h-10 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-sm border-b-2 border-emerald-900 active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:opacity-30 disabled:cursor-not-allowed">
                                        <span>\u52a0\u6ce8</span>
                                        <span className="text-[10px] font-normal text-emerald-200">${betAmount.toLocaleString()}</span>
                                    </button>
                                    <button onClick={() => handleAction('all-in')} disabled={!isMyTurn || isActionPending || playerBalance <= 0} className="flex-1 h-10 rounded-lg bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold text-sm border-b-2 border-red-950 active:border-b-0 active:translate-y-0.5 transition-all shadow-[0_0_12px_rgba(220,38,38,0.3)] disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider">
                                        \u5168\u4e0b
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
