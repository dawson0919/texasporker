"use client";

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { Modal } from './components/Modal';
import { Deck, Card, evaluateHand, determineWinners } from '../utils/poker';
import { GameSounds } from '../utils/sounds';

type GameStage = 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

export type PlayerState = {
    id: string;
    name: string;
    avatar: string;
    balance: number;
    positionIndex: number;
    status: 'playing' | 'folded' | 'thinking' | 'waiting' | 'all-in';
    role?: 'dealer' | 'small_blind' | 'big_blind';
    isRealUser?: boolean;
    bet: number;
    cards: Card[];
    handName?: string;
    isWinner?: boolean;
    totalInvested: number;
    lastAction?: string;
};

export const SEAT_POSITIONS: Record<number, string> = {
    0: "absolute -bottom-12 md:-bottom-16 left-[30%] -translate-x-1/2 flex flex-col items-center gap-1 md:gap-3 z-30",
    1: "absolute top-1/2 -left-4 md:-left-10 -translate-y-1/2 flex flex-col items-center gap-1 md:gap-2 z-20",
    2: "absolute -top-6 md:-top-10 left-[12%] md:left-[15%] flex flex-col items-center gap-1 md:gap-2 z-20",
    3: "absolute -top-6 md:-top-10 left-[38%] flex flex-col items-center gap-1 md:gap-2 z-20",
    4: "absolute -top-6 md:-top-10 right-[38%] flex flex-col items-center gap-1 md:gap-2 z-20",
    5: "absolute -top-6 md:-top-10 right-[12%] md:right-[15%] flex flex-col items-center gap-1 md:gap-2 z-20",
    6: "absolute top-1/2 -right-4 md:-right-10 -translate-y-1/2 flex flex-col items-center gap-1 md:gap-2 z-20",
    7: "absolute -bottom-12 md:-bottom-16 right-[30%] translate-x-1/2 flex flex-col items-center gap-1 md:gap-3 z-30",
};

const DEALER_POOL = [
    { id: '1', name: 'Lucia', style: '巴西風情', desc: '首席荷官 • 熱情活力', hue: '0',
      image: '/dealers/dealer-1.png' },
    { id: '2', name: 'Natasha', style: '俄式優雅', desc: '明星荷官 • 冷艷高貴', hue: '0',
      image: '/dealers/dealer-2.png' },
    { id: '3', name: 'Camille', style: '法式魅力', desc: '王牌荷官 • 人氣最高', hue: '0',
      image: '/dealers/dealer-3.png' },
    { id: '4', name: 'Ploy', style: '泰式風華', desc: '專業荷官 • 傳統融合', hue: '0',
      image: '/dealers/dealer-4.png' },
];

const SMALL_BLIND = 50;
const BIG_BLIND = 100;

const DEALER_WIN_MESSAGES = [
    (name: string, pot: string) => `恭喜 ${name} 贏得 $${pot}！精彩的一手牌！`,
    (name: string, pot: string) => `${name} 勝出！獲得 $${pot} 籌碼！`,
    (name: string, pot: string) => `漂亮！${name} 拿下 $${pot}！`,
    (name: string, pot: string) => `${name} 大獲全勝！贏取 $${pot}！`,
    (name: string, pot: string) => `恭喜恭喜！${name} 贏了 $${pot}！`,
    (name: string, pot: string) => `好牌！${name} 收下 $${pot}！`,
    (name: string, pot: string) => `${name} 技高一籌！$${pot} 歸入囊中！`,
];

const DEALER_FOLD_WIN_MESSAGES = [
    (name: string, pot: string) => `所有人棄牌，${name} 不戰而勝！贏得 $${pot}！`,
    (name: string, pot: string) => `${name} 的氣勢壓倒全場！贏取 $${pot}！`,
    (name: string, pot: string) => `沒人敢跟！${name} 直接收下 $${pot}！`,
    (name: string, pot: string) => `${name} 霸氣全開！$${pot} 入袋！`,
];

// Map seat position to animation endpoint (relative to pot center in %)
const WIN_ANIM_TARGETS: Record<number, { x: string; y: string }> = {
    0: { x: '0%', y: '120%' },   // bottom center (user)
    1: { x: '-140%', y: '0%' },  // left
    2: { x: '-80%', y: '-120%' }, // top-left
    3: { x: '80%', y: '-120%' },  // top-right
    4: { x: '140%', y: '0%' },   // right
};

export default function GameTablePage() {
    const { signOut } = useClerk();
    const { user: clerkUser } = useUser();
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);

    // Game State
    const [gameStage, setGameStage] = useState<GameStage>('WAITING');
    const [betAmount, setBetAmount] = useState(BIG_BLIND * 2);
    const [potSize, setPotSize] = useState(0);
    const [communityCards, setCommunityCards] = useState<Card[]>([]);
    const deckRef = useRef<Deck>(new Deck());

    const [playerBalance, setPlayerBalance] = useState(10000);

    const [dealer, setDealer] = useState(DEALER_POOL[0]);
    const [dealerMessage, setDealerMessage] = useState<string | null>('歡迎入座，即將開局...');
    const [players, setPlayers] = useState<PlayerState[]>([
        { id: '1', name: '賭神', avatar: 'https://ui-avatars.com/api/?name=%E8%B3%AD%E7%A5%9E&background=8B0000&color=fff', balance: 5934, positionIndex: 3, status: 'waiting', bet: 0, cards: [], totalInvested: 0 },
        { id: '2', name: '阿星', avatar: 'https://ui-avatars.com/api/?name=%E9%98%BF%E6%98%9F&background=9B870C&color=fff', balance: 8176, positionIndex: 5, status: 'waiting', bet: 0, cards: [], totalInvested: 0 },
        { id: '3', name: '小刀', avatar: 'https://ui-avatars.com/api/?name=%E5%B0%8F%E5%88%80&background=4169E1&color=fff', balance: 2599, positionIndex: 1, status: 'waiting', bet: 0, cards: [], totalInvested: 0 },
        { id: '4', name: '幸運星', avatar: 'https://ui-avatars.com/api/?name=%E5%B9%B8%E9%81%8B&background=9ACD32&color=fff', balance: 8900, positionIndex: 6, status: 'waiting', bet: 0, cards: [], totalInvested: 0 },
        { id: '5', name: '龍王', avatar: 'https://ui-avatars.com/api/?name=%E9%BE%8D%E7%8E%8B&background=FF6347&color=fff', balance: 6200, positionIndex: 2, status: 'waiting', bet: 0, cards: [], totalInvested: 0 },
        { id: '6', name: '撲克女王', avatar: 'https://ui-avatars.com/api/?name=%E5%A5%B3%E7%8E%8B&background=DA70D6&color=fff', balance: 4500, positionIndex: 4, status: 'waiting', bet: 0, cards: [], totalInvested: 0 },
        { id: '7', name: '全下王', avatar: 'https://ui-avatars.com/api/?name=%E5%85%A8%E4%B8%8B&background=FF4500&color=fff', balance: 7300, positionIndex: 7, status: 'waiting', bet: 0, cards: [], totalInvested: 0 },
        { id: 'user', name: '我', avatar: 'https://ui-avatars.com/api/?name=You&background=random', balance: 10000, positionIndex: 0, status: 'waiting', isRealUser: true, bet: 0, cards: [], totalInvested: 0 }
    ]);

    // Game engine state
    const [dealerButtonIndex, setDealerButtonIndex] = useState(-1);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(-1);
    const [currentBet, setCurrentBet] = useState(0);
    const [lastRaiserIndex, setLastRaiserIndex] = useState(-1);
    const [isHandInProgress, setIsHandInProgress] = useState(false);
    const [actionLog, setActionLog] = useState<string[]>([]);
    const [chatMessages, setChatMessages] = useState<Array<{ name: string; text: string; isUser: boolean }>>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const soundEnabledRef = useRef(true);
    const [autoStartCountdown, setAutoStartCountdown] = useState(-1);
    const [winAnimation, setWinAnimation] = useState<{ active: boolean; winnerPositionIndex: number; winnerName: string; potAmount: number } | null>(null);
    const [turnTimeLeft, setTurnTimeLeft] = useState(-1);
    const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const actionClearTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const actedThisRound = useRef<Set<number>>(new Set());

    // Refs for latest state in async callbacks
    const playersRef = useRef(players);
    const communityCardsRef = useRef(communityCards);
    const potSizeRef = useRef(potSize);
    const currentBetRef = useRef(currentBet);
    const gameStageRef = useRef(gameStage);
    const currentPlayerIndexRef = useRef(currentPlayerIndex);
    const lastRaiserIndexRef = useRef(lastRaiserIndex);
    const isHandInProgressRef = useRef(isHandInProgress);

    useEffect(() => { playersRef.current = players; }, [players]);
    useEffect(() => { communityCardsRef.current = communityCards; }, [communityCards]);
    useEffect(() => { potSizeRef.current = potSize; }, [potSize]);
    useEffect(() => { currentBetRef.current = currentBet; }, [currentBet]);
    useEffect(() => { gameStageRef.current = gameStage; }, [gameStage]);
    useEffect(() => { currentPlayerIndexRef.current = currentPlayerIndex; }, [currentPlayerIndex]);
    useEffect(() => { lastRaiserIndexRef.current = lastRaiserIndex; }, [lastRaiserIndex]);
    useEffect(() => { isHandInProgressRef.current = isHandInProgress; }, [isHandInProgress]);
    useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

    // Auto-start first hand on page load
    const hasAutoStarted = useRef(false);

    const addToLog = useCallback((msg: string) => {
        setActionLog(prev => [...prev.slice(-20), msg]);
    }, []);

    const playSound = useCallback((sound: keyof typeof GameSounds) => {
        if (soundEnabledRef.current) GameSounds[sound]();
    }, []);

    // Fetch real balance on mount
    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const res = await fetch('/api/user/balance');
                if (res.ok) {
                    const data = await res.json();
                    setPlayerBalance(data.balance);
                    setPlayers(prev => prev.map(p =>
                        p.isRealUser ? { ...p, balance: data.balance } : p
                    ));
                }
            } catch {
                // Offline or not authenticated - use default balance
            }
        };
        fetchBalance();
    }, []);

    // Sync Clerk user avatar & name to player state
    useEffect(() => {
        if (!clerkUser) return;
        const avatarUrl = clerkUser.imageUrl;
        const displayName = clerkUser.firstName || clerkUser.username || '我';
        setPlayers(prev => prev.map(p =>
            p.isRealUser ? { ...p, avatar: avatarUrl, name: displayName } : p
        ));
    }, [clerkUser]);

    // AI Player Dynamic Joining/Leaving Logic (only between hands)
    useEffect(() => {
        setTimeout(() => setDealer(DEALER_POOL[Math.floor(Math.random() * DEALER_POOL.length)]), 0);

        const aiNames = ['達人', '賭神', '高進', '小刀', '阿星', '雷茲', '全下王', '玫瑰', 'Lucky', 'Pro'];

        const interval = setInterval(() => {
            if (isHandInProgressRef.current) return;

            setPlayers(prevPlayers => {
                if (prevPlayers.length >= 5) {
                    if (Math.random() > 0.9) {
                        const aiPlayers = prevPlayers.filter(p => !p.isRealUser);
                        if (aiPlayers.length > 0) {
                            const leaveId = aiPlayers[Math.floor(Math.random() * aiPlayers.length)].id;
                            return prevPlayers.filter(p => p.id !== leaveId);
                        }
                    }
                    return prevPlayers;
                }

                if (Math.random() > 0.75) {
                    const occupiedSeats = prevPlayers.map(p => p.positionIndex);
                    const emptySeats = [1, 2, 3, 4].filter(seat => !occupiedSeats.includes(seat));

                    if (emptySeats.length > 0) {
                        const randomSeat = emptySeats[Math.floor(Math.random() * emptySeats.length)];
                        const randomName = aiNames[Math.floor(Math.random() * aiNames.length)] + Math.floor(Math.random() * 100);
                        const newAI: PlayerState = {
                            id: `ai_${Date.now()}_${Math.random()}`,
                            name: randomName,
                            avatar: `https://ui-avatars.com/api/?name=${randomName}&background=random`,
                            balance: Math.floor(Math.random() * 9000) + 1000,
                            positionIndex: randomSeat,
                            status: 'waiting',
                            bet: 0,
                            cards: [],
                            totalInvested: 0,
                        };
                        return [...prevPlayers, newAI];
                    }
                }
                return prevPlayers;
            });
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    // Dealer message effects (SHOWDOWN messages are handled directly in win functions)
    useEffect(() => {
        if (gameStage === 'PREFLOP' || gameStage === 'FLOP' || gameStage === 'TURN' || gameStage === 'RIVER') {
            setDealerMessage(gameStage === 'PREFLOP' ? "發牌中..." : "下一張牌...");
            const timer = setTimeout(() => setDealerMessage(null), 2500);
            return () => clearTimeout(timer);
        } else if (gameStage === 'SHOWDOWN') {
            // Don't override - dealer message is already set by runShowdownWithCards/handleLastPlayerWin
            const timer = setTimeout(() => setDealerMessage(null), 4500);
            return () => clearTimeout(timer);
        }
    }, [gameStage]);

    // ========== AI DECISION ENGINE ==========
    const makeAiDecision = useCallback((
        player: PlayerState,
        cc: Card[],
        bet: number,
        pot: number,
    ): { action: PlayerAction; raiseAmount?: number } => {
        const callCost = bet - player.bet;
        const canCheck = callCost <= 0;

        let handStrength = 0.3;

        if (cc.length >= 3 && player.cards.length === 2) {
            try {
                const solved = evaluateHand(player.cards, cc);
                handStrength = solved.rank / 10;
            } catch {
                handStrength = 0.3;
            }
        } else if (player.cards.length === 2) {
            const rankOrder = '23456789TJQKA';
            const r1 = rankOrder.indexOf(player.cards[0].rank === '10' ? 'T' : player.cards[0].rank);
            const r2 = rankOrder.indexOf(player.cards[1].rank === '10' ? 'T' : player.cards[1].rank);
            const highCard = Math.max(r1, r2);
            const isPair = r1 === r2;
            const isSuited = player.cards[0].suit === player.cards[1].suit;
            const gap = Math.abs(r1 - r2);

            handStrength = (highCard / 13) * 0.4;
            if (isPair) handStrength += 0.35;
            if (isSuited) handStrength += 0.05;
            if (gap <= 2 && !isPair) handStrength += 0.05;
            handStrength = Math.min(handStrength, 1.0);
        }

        const randomFactor = (Math.random() - 0.5) * 0.3;
        const adjusted = Math.max(0, Math.min(1, handStrength + randomFactor));
        const bluff = Math.random() < 0.08;

        if (adjusted >= 0.65 || bluff) {
            if (player.balance <= callCost) {
                return { action: 'all-in' };
            }
            const raiseMultiplier = 2 + Math.random() * 2;
            const raiseTotal = bet + Math.floor(BIG_BLIND * raiseMultiplier);
            const maxRaise = Math.min(raiseTotal, player.balance + player.bet);
            return { action: 'raise', raiseAmount: maxRaise };
        } else if (adjusted >= 0.3 || (canCheck && adjusted >= 0.1)) {
            if (canCheck) return { action: 'check' };
            if (callCost <= player.balance * 0.3 || adjusted > 0.45) {
                if (callCost >= player.balance) return { action: 'all-in' };
                return { action: 'call' };
            }
            return { action: 'fold' };
        } else {
            if (canCheck) return { action: 'check' };
            return { action: 'fold' };
        }
    }, []);

    // ========== SAVE GAME RESULT TO BACKEND ==========
    const saveGameResult = useCallback(async (finalPlayers: PlayerState[], totalPot: number, stage: string) => {
        const user = finalPlayers.find(p => p.isRealUser);
        if (!user) return;
        const winnerCount = finalPlayers.filter(p => p.isWinner).length;
        const profitLoss = user.isWinner
            ? Math.floor(totalPot / winnerCount) - user.totalInvested
            : -user.totalInvested;
        try {
            await fetch('/api/game/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameType: 'CASH',
                    stake: `${SMALL_BLIND}/${BIG_BLIND}`,
                    profitLoss,
                    stageReached: stage,
                }),
            });
            await fetch('/api/user/balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newBalance: user.balance }),
            });
        } catch {
            // Offline
        }
    }, []);

    // ========== CORE GAME ENGINE ==========

    const findNextActivePlayer = useCallback((fromIndex: number, playerList: PlayerState[]): number => {
        const len = playerList.length;
        for (let i = 1; i <= len; i++) {
            const idx = (fromIndex + i) % len;
            if (playerList[idx].status === 'playing') return idx;
        }
        return -1;
    }, []);

    // Forward-declare processAction via ref so callbacks can call it
    const processActionRef = useRef<(action: PlayerAction, raiseAmount?: number) => void>(() => {});

    const runShowdownWithCards = useCallback((finalPlayers: PlayerState[], cc: Card[], pot: number) => {
        setGameStage('SHOWDOWN');
        setCurrentPlayerIndex(-1);

        const activePlayers = finalPlayers.filter(p => p.status !== 'folded' && p.cards.length === 2);
        if (activePlayers.length === 0) return;

        // --- Side Pot Distribution ---
        const investmentLevels = [...new Set(activePlayers.map(p => p.totalInvested))].sort((a, b) => a - b);
        const winnings: Record<string, number> = {};
        finalPlayers.forEach(p => { winnings[p.id] = 0; });

        let processedLevel = 0;
        let overallHandName = '';

        for (const level of investmentLevels) {
            if (level <= processedLevel) continue;
            const perPlayerContrib = level - processedLevel;
            const contributors = finalPlayers.filter(p => p.totalInvested > processedLevel);
            const subPot = perPlayerContrib * contributors.length;

            const eligible = activePlayers.filter(p => p.totalInvested >= level);
            if (eligible.length === 1) {
                winnings[eligible[0].id] += subPot;
            } else if (eligible.length > 1) {
                const handsToEval = eligible.map(p => ({ playerId: p.id, holeCards: p.cards }));
                const result = determineWinners(handsToEval, cc);
                const perWinner = Math.floor(subPot / result.winningPlayerIds.length);
                result.winningPlayerIds.forEach(id => { winnings[id] += perWinner; });
                if (!overallHandName) overallHandName = result.handName;
            }
            processedLevel = level;
        }

        const winnerIds = Object.keys(winnings).filter(id => winnings[id] > 0);

        // Evaluate individual hand names for display
        const handNames: Record<string, string> = {};
        activePlayers.forEach(p => {
            try {
                const solved = evaluateHand(p.cards, cc);
                handNames[p.id] = solved.name;
            } catch { /* ignore */ }
        });

        const showdownPlayers = finalPlayers.map(p => {
            const winAmount = winnings[p.id] || 0;
            const isWinner = winAmount > 0;
            const newBalance = p.balance + winAmount;
            if (p.isRealUser && winAmount > 0) setPlayerBalance(newBalance);
            return {
                ...p,
                balance: newBalance,
                isWinner,
                handName: isWinner ? (overallHandName || handNames[p.id]) : handNames[p.id],
            };
        });

        setPlayers(showdownPlayers);
        setPotSize(pot);

        const winner = showdownPlayers.find(p => p.isWinner);
        const totalWon = winnerIds.reduce((sum, id) => sum + (winnings[id] || 0), 0);
        addToLog(`🏆 ${winner?.name} 贏得 $${totalWon.toLocaleString()} (${overallHandName})`);

        // Dealer congratulatory message
        const msg = DEALER_WIN_MESSAGES[Math.floor(Math.random() * DEALER_WIN_MESSAGES.length)];
        setDealerMessage(msg(winner?.name || '玩家', totalWon.toLocaleString()));

        // Trigger chip flying animation
        if (winner) {
            setWinAnimation({
                active: true,
                winnerPositionIndex: winner.positionIndex,
                winnerName: winner.name,
                potAmount: totalWon,
            });
            setTimeout(() => setWinAnimation(null), 2500);
        }

        playSound('win');
        saveGameResult(showdownPlayers, pot, 'SHOWDOWN');
        setIsHandInProgress(false);
    }, [addToLog, playSound, saveGameResult]);

    const dealRemainingAndShowdown = useCallback((currentPlayers: PlayerState[], cc: Card[], pot: number) => {
        let newCC = [...cc];
        const needed = 5 - newCC.length;
        if (needed > 0) {
            newCC = [...newCC, ...deckRef.current.deal(needed)];
        }
        setCommunityCards(newCC);
        setTimeout(() => {
            runShowdownWithCards(currentPlayers, newCC, pot);
        }, 1500);
    }, [runShowdownWithCards]);

    const handleLastPlayerWin = useCallback((currentPlayers: PlayerState[], pot: number) => {
        const winner = currentPlayers.find(p => p.status !== 'folded')!;
        const newBalance = winner.balance + pot;

        const updated = currentPlayers.map(p => {
            if (p.id === winner.id) {
                if (p.isRealUser) setPlayerBalance(newBalance);
                return { ...p, balance: newBalance, isWinner: true };
            }
            return { ...p, isWinner: false };
        });

        setPlayers(updated);
        setGameStage('SHOWDOWN');
        setCurrentPlayerIndex(-1);
        setPotSize(pot);
        addToLog(`🏆 ${winner.name} 贏得 $${pot.toLocaleString()} (其他玩家棄牌)`);

        // Dealer congratulatory message for fold wins
        const msg = DEALER_FOLD_WIN_MESSAGES[Math.floor(Math.random() * DEALER_FOLD_WIN_MESSAGES.length)];
        setDealerMessage(msg(winner.name, pot.toLocaleString()));

        // Trigger chip flying animation
        setWinAnimation({
            active: true,
            winnerPositionIndex: winner.positionIndex,
            winnerName: winner.name,
            potAmount: pot,
        });
        setTimeout(() => setWinAnimation(null), 2500);

        playSound('win');
        saveGameResult(updated, pot, gameStageRef.current);
        setIsHandInProgress(false);
    }, [addToLog, playSound, saveGameResult]);

    const endBettingRound = useCallback((currentPlayers: PlayerState[], currentCC: Card[], pot: number) => {
        const totalBets = currentPlayers.reduce((sum, p) => sum + p.bet, 0);
        const newPot = pot + totalBets;
        const resetPlayers = currentPlayers.map(p => ({ ...p, bet: 0 }));

        setPotSize(newPot);
        setCurrentBet(0);
        setLastRaiserIndex(-1);
        actedThisRound.current = new Set();

        const stage = gameStageRef.current;
        let newCC = [...currentCC];

        if (stage === 'PREFLOP') {
            newCC = deckRef.current.deal(3);
            setCommunityCards(newCC);
            setGameStage('FLOP');
            playSound('newStage');
        } else if (stage === 'FLOP') {
            newCC = [...currentCC, ...deckRef.current.deal(1)];
            setCommunityCards(newCC);
            setGameStage('TURN');
            playSound('newStage');
        } else if (stage === 'TURN') {
            newCC = [...currentCC, ...deckRef.current.deal(1)];
            setCommunityCards(newCC);
            setGameStage('RIVER');
            playSound('newStage');
        } else if (stage === 'RIVER') {
            runShowdownWithCards(resetPlayers, currentCC, newPot);
            return;
        }

        setPlayers(resetPlayers);

        const canAct = resetPlayers.filter(p => p.status === 'playing');
        if (canAct.length <= 1) {
            dealRemainingAndShowdown(resetPlayers, newCC, newPot);
            return;
        }

        const dealerIdx = resetPlayers.findIndex(p => p.role === 'dealer');
        const firstAct = findNextActivePlayer(dealerIdx, resetPlayers);
        if (firstAct < 0) {
            dealRemainingAndShowdown(resetPlayers, newCC, newPot);
            return;
        }

        setCurrentPlayerIndex(firstAct);
        setLastRaiserIndex(firstAct);
    }, [playSound, findNextActivePlayer, runShowdownWithCards, dealRemainingAndShowdown]);

    const advanceToNextPlayer = useCallback((currentPlayers: PlayerState[], bet: number, raiserIdx: number, fromIdx: number) => {
        const nextIdx = findNextActivePlayer(fromIdx, currentPlayers);

        if (nextIdx < 0) {
            endBettingRound(currentPlayers, communityCardsRef.current, potSizeRef.current);
            return;
        }

        const allMatched = currentPlayers.every(p =>
            p.status === 'folded' || p.status === 'all-in' || p.bet >= bet
        );

        // Check if all active ('playing') players have acted this round
        const allPlayingActed = currentPlayers.every((p, i) =>
            p.status !== 'playing' || actedThisRound.current.has(i)
        );

        if (allMatched && allPlayingActed) {
            endBettingRound(currentPlayers, communityCardsRef.current, potSizeRef.current);
            return;
        }

        setCurrentPlayerIndex(nextIdx);
    }, [findNextActivePlayer, endBettingRound]);

    // ========== PLAYER ACTION HANDLER (via ref for stable identity) ==========
    useEffect(() => {
        processActionRef.current = (action: PlayerAction, raiseAmount?: number) => {
            const cpIdx = currentPlayerIndexRef.current;
            const currentPlayers = [...playersRef.current];
            const bet = currentBetRef.current;
            const pot = potSizeRef.current;
            let raiserIdx = lastRaiserIndexRef.current;

            if (cpIdx < 0 || cpIdx >= currentPlayers.length) return;
            const player = currentPlayers[cpIdx];
            if (!player || player.status === 'folded' || player.status === 'all-in') return;

            let newBet = bet;

            switch (action) {
                case 'fold': {
                    currentPlayers[cpIdx] = { ...player, status: 'folded', lastAction: '棄牌' };
                    addToLog(`${player.name} 棄牌`);
                    playSound('fold');
                    break;
                }
                case 'check': {
                    if (player.bet < bet) return;
                    currentPlayers[cpIdx] = { ...player, lastAction: '過牌' };
                    addToLog(`${player.name} 過牌`);
                    playSound('check');
                    break;
                }
                case 'call': {
                    const callAmount = Math.min(bet - player.bet, player.balance);
                    const newBalance = player.balance - callAmount;
                    const newPlayerBet = player.bet + callAmount;
                    const newStatus = newBalance === 0 ? 'all-in' as const : 'playing' as const;
                    currentPlayers[cpIdx] = { ...player, balance: newBalance, bet: newPlayerBet, status: newStatus, totalInvested: player.totalInvested + callAmount, lastAction: newStatus === 'all-in' ? '全下' : '跟注' };
                    if (player.isRealUser) setPlayerBalance(newBalance);
                    addToLog(`${player.name} 跟注 $${callAmount.toLocaleString()}`);
                    playSound('call');
                    break;
                }
                case 'raise': {
                    const targetBet = raiseAmount || (bet + BIG_BLIND);
                    const raiseBy = targetBet - player.bet;
                    const actualPay = Math.min(raiseBy, player.balance);
                    const newBalance = player.balance - actualPay;
                    const newPlayerBet = player.bet + actualPay;
                    const newStatus = newBalance === 0 ? 'all-in' as const : 'playing' as const;
                    currentPlayers[cpIdx] = { ...player, balance: newBalance, bet: newPlayerBet, status: newStatus, totalInvested: player.totalInvested + actualPay, lastAction: '加注' };
                    newBet = newPlayerBet;
                    raiserIdx = cpIdx;
                    if (player.isRealUser) setPlayerBalance(newBalance);
                    addToLog(`${player.name} 加注至 $${newPlayerBet.toLocaleString()}`);
                    playSound('raise');
                    break;
                }
                case 'all-in': {
                    const allInAmount = player.balance;
                    const newPlayerBet = player.bet + allInAmount;
                    currentPlayers[cpIdx] = { ...player, balance: 0, bet: newPlayerBet, status: 'all-in', totalInvested: player.totalInvested + allInAmount, lastAction: '全下' };
                    if (newPlayerBet > newBet) {
                        newBet = newPlayerBet;
                        raiserIdx = cpIdx;
                    }
                    if (player.isRealUser) setPlayerBalance(0);
                    addToLog(`${player.name} 全下 $${allInAmount.toLocaleString()}!`);
                    playSound('allIn');
                    break;
                }
            }

            // Track who has acted this round
            actedThisRound.current.add(cpIdx);
            // Raise/all-in that increases bet resets the round — only raiser counts as having acted
            if ((action === 'raise' || action === 'all-in') && newBet > bet) {
                actedThisRound.current = new Set([cpIdx]);
            }

            // Clear action badge after delay
            const actingPlayerId = currentPlayers[cpIdx].id;
            const clearTimer = setTimeout(() => {
                setPlayers(prev => prev.map(p =>
                    p.id === actingPlayerId ? { ...p, lastAction: undefined } : p
                ));
            }, 2500);
            actionClearTimers.current.push(clearTimer);

            setPlayers(currentPlayers);
            setCurrentBet(newBet);
            setLastRaiserIndex(raiserIdx);

            const remainingActive = currentPlayers.filter(p => p.status !== 'folded');
            if (remainingActive.length === 1) {
                const totalBets = currentPlayers.reduce((sum, p) => sum + p.bet, 0);
                const finalPot = pot + totalBets;
                setPotSize(finalPot);
                handleLastPlayerWin(currentPlayers.map(p => ({ ...p, bet: 0 })), finalPot);
                return;
            }

            advanceToNextPlayer(currentPlayers, newBet, raiserIdx, cpIdx);
        };
    }, [addToLog, playSound, handleLastPlayerWin, advanceToNextPlayer]);

    const handlePlayerAction = useCallback((action: PlayerAction, raiseAmount?: number) => {
        processActionRef.current(action, raiseAmount);
    }, []);

    // AI turn trigger
    useEffect(() => {
        if (currentPlayerIndex < 0 || !isHandInProgress) return;
        if (gameStage === 'SHOWDOWN' || gameStage === 'WAITING') return;

        const player = players[currentPlayerIndex];
        if (!player || player.isRealUser || player.status === 'folded' || player.status === 'all-in') return;

        // Set thinking status
        setPlayers(prev => prev.map((p, i) =>
            i === currentPlayerIndex ? { ...p, status: 'thinking' as const } : p
        ));

        const thinkTime = 800 + Math.random() * 1500;
        const timer = setTimeout(() => {
            const currentP = playersRef.current[currentPlayerIndex];
            if (!currentP || currentP.isRealUser || currentP.status === 'folded') return;

            // Restore to playing then decide
            const restored = playersRef.current.map((p, i) =>
                i === currentPlayerIndex && p.status === 'thinking'
                    ? { ...p, status: 'playing' as const }
                    : p
            );
            playersRef.current = restored;
            setPlayers(restored);

            const decision = makeAiDecision(
                { ...currentP, status: 'playing' },
                communityCardsRef.current,
                currentBetRef.current,
                potSizeRef.current,
            );

            // Use processActionRef for fresh closure
            processActionRef.current(decision.action, decision.raiseAmount);
        }, thinkTime);

        return () => clearTimeout(timer);
    }, [currentPlayerIndex, isHandInProgress, gameStage, makeAiDecision]);

    // User turn notification sound
    useEffect(() => {
        if (currentPlayerIndex < 0 || !isHandInProgress) return;
        if (gameStage === 'SHOWDOWN' || gameStage === 'WAITING') return;
        const player = players[currentPlayerIndex];
        if (player?.isRealUser && player.status === 'playing') {
            playSound('yourTurn');
        }
    }, [currentPlayerIndex, isHandInProgress, gameStage, players, playSound]);

    // ========== AUTO-FOLD TIMER (30s, last 10s countdown) ==========
    useEffect(() => {
        if (turnTimerRef.current) {
            clearInterval(turnTimerRef.current);
            turnTimerRef.current = null;
        }
        setTurnTimeLeft(-1);

        const userTurn = currentPlayerIndex >= 0 && players[currentPlayerIndex]?.isRealUser === true;
        if (!userTurn || !isHandInProgress || gameStage === 'SHOWDOWN' || gameStage === 'WAITING') return;

        setTurnTimeLeft(30);
        turnTimerRef.current = setInterval(() => {
            setTurnTimeLeft(prev => {
                if (prev <= 1) {
                    if (turnTimerRef.current) clearInterval(turnTimerRef.current);
                    turnTimerRef.current = null;
                    processActionRef.current('fold');
                    return -1;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (turnTimerRef.current) {
                clearInterval(turnTimerRef.current);
                turnTimerRef.current = null;
            }
        };
    }, [currentPlayerIndex, players, isHandInProgress, gameStage]);

    // ========== START NEW HAND ==========
    const startNewHand = useCallback(() => {
        const currentPlayers = playersRef.current;
        const activePlayers = currentPlayers.filter(p => p.balance > 0 || p.isRealUser);
        if (activePlayers.length < 2) {
            addToLog("玩家不足，無法開始新一局");
            return;
        }

        deckRef.current.reset();
        setCommunityCards([]);
        setActionLog([]);
        actionClearTimers.current.forEach(t => clearTimeout(t));
        actionClearTimers.current = [];

        const newDealerIndex = (dealerButtonIndex + 1) % activePlayers.length;
        setDealerButtonIndex(newDealerIndex);

        const sbIndex = (newDealerIndex + 1) % activePlayers.length;
        const bbIndex = (newDealerIndex + 2) % activePlayers.length;

        const updatedPlayers = activePlayers.map((p, idx) => {
            const role = idx === newDealerIndex ? 'dealer' as const
                : idx === sbIndex ? 'small_blind' as const
                    : idx === bbIndex ? 'big_blind' as const
                        : undefined;

            let bet = 0;
            let balance = p.balance;

            if (idx === sbIndex) {
                bet = Math.min(SMALL_BLIND, balance);
                balance -= bet;
            } else if (idx === bbIndex) {
                bet = Math.min(BIG_BLIND, balance);
                balance -= bet;
            }

            return {
                ...p,
                cards: deckRef.current.deal(2),
                status: (balance === 0 && bet > 0) ? 'all-in' as const : 'playing' as const,
                bet,
                balance,
                isWinner: false,
                handName: undefined,
                role,
                totalInvested: bet,
                lastAction: undefined,
            };
        });

        setPlayers(updatedPlayers);
        setPotSize(0);
        setCurrentBet(BIG_BLIND);
        setBetAmount(BIG_BLIND * 2);
        setIsHandInProgress(true);
        setGameStage('PREFLOP');

        const user = updatedPlayers.find(p => p.isRealUser);
        if (user) setPlayerBalance(user.balance);

        const utgIndex = (bbIndex + 1) % updatedPlayers.length;
        setLastRaiserIndex(utgIndex);
        setCurrentPlayerIndex(utgIndex);
        actedThisRound.current = new Set();

        addToLog(`--- 新一局開始 ---`);
        addToLog(`莊家: ${updatedPlayers[newDealerIndex].name} | 小盲: $${SMALL_BLIND} | 大盲: $${BIG_BLIND}`);
        playSound('blind');
        setTimeout(() => playSound('deal'), 300);
    }, [dealerButtonIndex, addToLog, playSound]);

    // Auto-advance to next hand after showdown
    useEffect(() => {
        if (gameStage === 'SHOWDOWN' && !isHandInProgress) {
            setAutoStartCountdown(4);
            const countdownInterval = setInterval(() => {
                setAutoStartCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            const autoTimer = setTimeout(() => {
                startNewHand();
            }, 4000);
            return () => {
                clearInterval(countdownInterval);
                clearTimeout(autoTimer);
                setAutoStartCountdown(-1);
            };
        }
    }, [gameStage, isHandInProgress, startNewHand]);

    // Auto-start first hand on page load
    const autoStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (hasAutoStarted.current) return;
        if (gameStage !== 'WAITING' || isHandInProgress) return;
        const activePlayers = players.filter(p => p.balance > 0);
        if (activePlayers.length < 2) return;

        hasAutoStarted.current = true;
        autoStartRef.current = setTimeout(() => {
            startNewHand();
        }, 1500);
        // No cleanup - hasAutoStarted prevents re-entry, ref cleaned on unmount
    }, [gameStage, isHandInProgress, players, startNewHand]);
    useEffect(() => { return () => { if (autoStartRef.current) clearTimeout(autoStartRef.current); }; }, []);

    // ========== UI COMPUTED VALUES ==========
    const userPlayer = players.find(p => p.isRealUser);
    const isUserTurn = currentPlayerIndex >= 0 && players[currentPlayerIndex]?.isRealUser === true;
    const canCheck = isUserTurn && (userPlayer?.bet ?? 0) >= currentBet;
    const callAmount = isUserTurn ? Math.max(0, currentBet - (userPlayer?.bet ?? 0)) : 0;
    const minRaise = currentBet + BIG_BLIND;
    const isWaitingForNextHand = gameStage === 'WAITING' || (gameStage === 'SHOWDOWN' && !isHandInProgress);
    const displayPot = potSize + players.reduce((s, p) => s + p.bet, 0);

    // Claim daily reward
    const handleClaimReward = async () => {
        try {
            const checkRes = await fetch('/api/user/daily-reward');
            const checkData = await checkRes.json();

            if (!checkData.canClaim) {
                const hours = Math.floor(checkData.timeRemainingMs / 3600000);
                const mins = Math.floor((checkData.timeRemainingMs % 3600000) / 60000);
                setDealerMessage(`獎勵冷卻中，${hours}小時${mins}分後再試`);
                setIsRewardModalOpen(false);
                return;
            }

            const claimRes = await fetch('/api/user/daily-reward', { method: 'POST' });
            const claimData = await claimRes.json();

            if (claimData.success) {
                setPlayerBalance(claimData.newBalance);
                setPlayers(prev => prev.map(p =>
                    p.isRealUser ? { ...p, balance: claimData.newBalance } : p
                ));
                setDealerMessage(`恭喜獲得 $${claimData.rewardAmount.toLocaleString()} 獎勵！`);
            }
        } catch {
            // Offline
        }
        setIsRewardModalOpen(false);
    };

    return (
        <div className="bg-[#1a160a] h-screen text-slate-100 flex flex-col font-['Noto_Sans_TC'] overflow-hidden">

            <header className="flex items-center justify-between whitespace-nowrap border-b border-accent-gold/20 bg-[#121212] px-3 md:px-6 py-2 md:py-3 shrink-0 z-50 shadow-lg">
                <div className="flex items-center gap-2 md:gap-4 text-white">
                    <Link href="/lobby" className="flex items-center justify-center size-8 md:size-10 rounded bg-gradient-to-br from-primary to-primary-dark shadow-lg border border-white/10">
                        <span className="material-symbols-outlined !text-[20px] md:!text-[24px] text-white drop-shadow-md">poker_chip</span>
                    </Link>
                    <div>
                        <h2 className="text-accent-gold-light text-base md:text-xl font-serif font-bold leading-tight tracking-wide">皇家德州撲克</h2>
                        <div className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest hidden sm:block">頂級真人娛樂場</div>
                    </div>
                </div>
                <div className="flex flex-1 justify-end gap-2 md:gap-8">
                    <div className="hidden md:flex items-center gap-8">
                        <Link className="text-slate-400 hover:text-accent-gold transition-colors text-sm font-medium tracking-wide uppercase" href="/lobby">大廳</Link>
                        <Link className="text-accent-gold text-sm font-bold tracking-wide uppercase border-b-2 border-accent-gold pb-1" href="/">牌桌</Link>
                        <Link className="text-slate-400 hover:text-accent-gold transition-colors text-sm font-medium tracking-wide uppercase" href="/tournaments">錦標賽</Link>
                        <button onClick={() => setIsComingSoonModalOpen(true)} className="text-slate-400 hover:text-accent-gold transition-colors text-sm font-medium tracking-wide uppercase">VIP 俱樂部</button>
                    </div>
                    <div className="flex gap-2 md:gap-4 items-center md:pl-6 md:border-l border-white/10">
                        <div className="flex items-center gap-1.5 md:gap-3 bg-black/40 rounded px-2 md:px-4 py-1.5 md:py-2 border border-accent-gold/30 shadow-inner">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-accent-gold flex items-center justify-center text-black text-[10px] md:text-xs font-bold">$</div>
                            <span className="text-xs md:text-sm font-mono font-bold text-white tracking-wider">{playerBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <button
                                onClick={() => setIsRewardModalOpen(true)}
                                className="ml-1 md:ml-2 bg-gradient-to-b from-primary to-primary-dark hover:from-red-600 hover:to-red-800 text-white text-[9px] md:text-[10px] font-bold px-2 md:px-3 py-1 rounded shadow-md border border-white/10 uppercase tracking-wider transition-all"
                            >
                                獎勵
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-3">
                            <button
                                onClick={() => setIsSettingsModalOpen(true)}
                                className="flex items-center justify-center rounded-full size-8 md:size-10 bg-surface-dark hover:bg-neutral-700 text-gray-300 transition-colors border border-white/5"
                            >
                                <span className="material-symbols-outlined text-[18px] md:text-[20px]">settings</span>
                            </button>
                            <div className="hidden sm:flex items-center justify-center rounded-full size-8 md:size-10 bg-surface-dark hover:bg-neutral-700 text-gray-300 transition-colors relative border border-white/5">
                                <span className="material-symbols-outlined text-[18px] md:text-[20px]">notifications</span>
                                <span className="absolute top-1.5 right-1.5 size-2 bg-accent-gold rounded-full shadow-[0_0_8px_rgba(197,160,89,0.6)]"></span>
                            </div>
                            <div className="bg-center bg-no-repeat bg-cover rounded-full size-8 md:size-10 border-2 border-accent-gold/50 cursor-pointer shadow-lg" data-alt="User profile avatar" style={{ backgroundImage: `url('${clerkUser?.imageUrl || 'https://ui-avatars.com/api/?name=You&background=random'}')` }}></div>
                            <button
                                onClick={() => signOut({ redirectUrl: '/sign-in' })}
                                className="hidden sm:flex items-center justify-center gap-1.5 rounded-lg h-8 md:h-9 px-2 md:px-3 bg-white/5 hover:bg-red-900/40 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-300 text-xs font-medium transition-all"
                            >
                                <span className="material-symbols-outlined text-[16px]">logout</span>
                                <span className="hidden lg:inline">登出</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 flex flex-col relative bg-[#0f0f0f]">
                    <div className="absolute inset-0 bg-black/90 z-0">
                        <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm" data-alt="Luxury casino background blurred" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAJsqf8ld7f8d1XU4UL3JDeujclDuwLT0SwQHyn6vIihMIOJ9OsQcaF6LEiLQ9_2SRbtuwNVG6p8-qgGM12NkG3b7TM5H7Stackc3pAQ8td7UhAM12iwCRJgWmUfowJAmG0JrMMGJSsJQzHCSlMj41A0Fhvml8Ip8NdHnFyItDtfGtzNknKb3fMXjoqKCApUYp_tPnHJUuRo7FoD080f-VbZdq04-lqfcJWeGGKuWY7r-mVXq7sREyKI8nFwV8GjH1Q3pOlIPd-QUhj')` }}></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black"></div>
                    </div>
                    {/* Dealer Showcase */}
                    <div className="relative z-10 w-full h-[10vh] md:h-[14vh] lg:h-[16vh] bg-black shadow-2xl overflow-hidden border-b border-accent-gold/20 group shrink-0">
                        <div className="absolute inset-0 bg-cover bg-center opacity-70 blur-[2px]" data-alt="Soft focus luxury casino background" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAJsqf8ld7f8d1XU4UL3JDeujclDuwLT0SwQHyn6vIihMIOJ9OsQcaF6LEiLQ9_2SRbtuwNVG6p8-qgGM12NkG3b7TM5H7Stackc3pAQ8td7UhAM12iwCRJgWmUfowJAmG0JrMMGJSsJQzHCSlMj41A0Fhvml8Ip8NdHnFyItDtfGtzNknKb3fMXjoqKCApUYp_tPnHJUuRo7FoD080f-VbZdq04-lqfcJWeGGKuWY7r-mVXq7sREyKI8nFwV8GjH1Q3pOlIPd-QUhj')` }}></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60"></div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full flex items-end justify-center z-10 pointer-events-none">
                            <div className="relative w-[100px] md:w-[180px] lg:w-[220px] h-[110%] bg-no-repeat transition-all duration-700 rounded-t-xl" style={{ backgroundImage: `url('${dealer.image}')`, backgroundSize: '180%', backgroundPosition: 'center 12%' }}>
                                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none"></div>
                                {dealerMessage && (
                                    <div className="absolute top-[10%] right-[-30%] bg-surface-dark/95 border border-primary/40 text-white px-4 py-2 rounded-2xl rounded-bl-sm font-bold shadow-[0_0_20px_rgba(212,175,55,0.3)] animate-bounce z-50 backdrop-blur text-xs whitespace-nowrap">
                                        {dealerMessage}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="absolute top-2 left-3 flex items-center gap-2 z-20">
                            <div className="flex items-center gap-1.5 bg-red-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg backdrop-blur-sm border border-red-400/30 uppercase tracking-wider">
                                <span className="animate-pulse w-1.5 h-1.5 bg-white rounded-full"></span>
                                直播中
                            </div>
                            <div className="bg-black/60 text-white/80 text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10 uppercase tracking-wider">
                                高清 1080p
                            </div>
                        </div>
                        <div className="absolute top-2 right-3 flex flex-col items-end gap-1 z-20">
                            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded border-l-2 border-accent-gold">
                                <span className="text-white font-serif font-bold text-sm block leading-none">澳門貴賓廳</span>
                                <span className="text-accent-gold text-[10px] font-mono uppercase tracking-wider">牌桌 #888 • 無限注德州撲克</span>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-6 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out z-20">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full border-2 border-accent-gold/50 bg-cover bg-center" style={{ backgroundImage: `url('${dealer.image}')`, backgroundPosition: "center top" }}></div>
                                <div>
                                    <h3 className="text-white font-bold text-sm">{dealer.name} <span className="text-[10px] font-normal text-gray-400">({dealer.style})</span></h3>
                                    <p className="text-accent-gold/80 text-[10px] uppercase tracking-wide">{dealer.desc}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Poker Table */}
                    <div className="flex-1 relative flex items-center justify-center p-2 z-10 overflow-hidden -mt-6">
                        <div className="relative w-full max-w-5xl aspect-[1.8/1] md:aspect-[2.1/1] bg-[#35654d] rounded-[100px] md:rounded-[200px] border-[8px] md:border-[16px] border-[#3e2723] shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_40px_rgba(0,0,0,0.6)] flex items-center justify-center felt-texture ring-1 ring-white/5 wood-texture">
                            <div className="absolute inset-4 rounded-[180px] border border-yellow-400/10 pointer-events-none"></div>
                            <div className="absolute opacity-5 pointer-events-none select-none flex flex-col items-center justify-center transform scale-y-75">
                                <span className="text-6xl font-serif font-bold text-black tracking-[0.5em] mb-2">ROYAL</span>
                                <span className="text-4xl font-serif text-black tracking-[0.3em]">CASINO</span>
                            </div>
                            {/* Community Cards */}
                            <div className="flex gap-1.5 md:gap-3 items-center justify-center mb-6 md:mb-10 z-20 h-16 md:h-24">
                                {communityCards.map((card, idx) => (
                                    <div key={idx} className="w-10 h-16 md:w-16 md:h-24 bg-white rounded shadow-card flex flex-col justify-between p-1 md:p-1.5 border border-gray-300 transform hover:-translate-y-1 transition-transform duration-200 animate-fade-in-up">
                                        <div className={`${card.suit === '♠' || card.suit === '♣' ? 'text-black' : 'text-red-600'} font-card font-bold text-xs md:text-lg leading-none`}>{card.rank}</div>
                                        <div className={`self-center text-2xl md:text-4xl ${card.suit === '♠' || card.suit === '♣' ? 'text-black' : 'text-red-600'} leading-none`}>{card.suit}</div>
                                        <div className={`${card.suit === '♠' || card.suit === '♣' ? 'text-black' : 'text-red-600'} font-card font-bold text-xs md:text-lg leading-none self-end rotate-180`}>{card.rank}</div>
                                    </div>
                                ))}
                                {Array(5 - communityCards.length).fill(0).map((_, idx) => (
                                    <div key={`empty-${idx}`} className="w-10 h-16 md:w-16 md:h-24 rounded border border-white/10 shadow-inner bg-black/10 flex items-center justify-center">
                                        <div className="w-8 h-14 md:w-14 md:h-22 border-2 border-dashed border-white/10 rounded-sm"></div>
                                    </div>
                                ))}
                            </div>
                            {/* Pot Display */}
                            <div className="absolute top-[60%] left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
                                <div className={`bg-black/60 px-3 md:px-5 py-1 md:py-1.5 rounded-full text-accent-gold font-mono text-sm md:text-lg font-bold border border-accent-gold/30 shadow-lg backdrop-blur-sm mb-1 md:mb-2 transition-all duration-500 ${winAnimation?.active ? 'scale-125 text-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : ''}`}>
                                    ${displayPot.toLocaleString()}
                                </div>
                                <div className="text-white/40 text-[8px] md:text-[10px] uppercase tracking-widest font-bold mb-1">總底池</div>
                                {/* Static chip stack (hidden during win animation) */}
                                {!winAnimation?.active && (
                                    <div className="flex items-center justify-center -space-x-4 mt-1 perspective-500">
                                        <div className="w-8 h-8 rounded-full bg-red-600 border-4 border-dashed border-white/40 shadow-chip relative poker-chip"></div>
                                        <div className="w-8 h-8 rounded-full bg-blue-700 border-4 border-dashed border-white/40 shadow-chip relative poker-chip -mt-2"></div>
                                        <div className="w-8 h-8 rounded-full bg-zinc-900 border-4 border-dashed border-white/40 shadow-chip relative poker-chip"></div>
                                        <div className="w-8 h-8 rounded-full bg-red-600 border-4 border-dashed border-white/40 shadow-chip relative poker-chip -mt-2"></div>
                                    </div>
                                )}
                                {/* Animated chips flying to winner */}
                                {winAnimation?.active && (() => {
                                    const target = WIN_ANIM_TARGETS[winAnimation.winnerPositionIndex] || { x: '0%', y: '0%' };
                                    const chipColors = ['bg-red-600', 'bg-blue-700', 'bg-zinc-900', 'bg-green-700', 'bg-yellow-600', 'bg-purple-700', 'bg-red-500', 'bg-blue-600'];
                                    return (
                                        <div className="relative mt-1">
                                            {chipColors.map((color, i) => (
                                                <div
                                                    key={i}
                                                    className={`absolute w-7 h-7 rounded-full ${color} border-3 border-dashed border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.3)] poker-chip`}
                                                    style={{
                                                        left: `${(i % 4) * 8 - 12}px`,
                                                        top: `${Math.floor(i / 4) * -6}px`,
                                                        animation: `chipFly${winAnimation.winnerPositionIndex} 1.2s ease-in-out ${i * 0.08}s forwards`,
                                                        opacity: 0,
                                                    }}
                                                />
                                            ))}
                                            {/* Win amount floating text */}
                                            <div
                                                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-yellow-300 font-bold text-2xl drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]"
                                                style={{
                                                    animation: `winTextFloat 2s ease-out 0.5s forwards`,
                                                    opacity: 0,
                                                    top: '-20px',
                                                }}
                                            >
                                                +${winAnimation.potAmount.toLocaleString()}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            {/* Player Seats */}
                            {players.map((player, playerIdx) => {
                                const isUser = player.isRealUser;
                                const posClass = SEAT_POSITIONS[player.positionIndex];
                                const foldedClass = player.status === 'folded' ? 'opacity-40 grayscale' : '';
                                const isCurrentTurn = currentPlayerIndex === playerIdx && isHandInProgress;

                                if (isUser) {
                                    return (
                                        <div key={player.id} className={posClass}>
                                            <div className="flex gap-1 md:gap-2 -mb-6 md:-mb-8 z-10 hover:-translate-y-6 transition-transform duration-300 cursor-pointer">
                                                {player.cards?.map((card, idx) => (
                                                    <div key={idx} className={`w-14 h-20 md:w-20 md:h-28 bg-white rounded-md shadow-[0_5px_15px_rgba(0,0,0,0.4)] flex flex-col justify-between p-1.5 md:p-2 border border-gray-300 relative transform ${idx === 0 ? '-rotate-6 hover:rotate-0 origin-bottom-right' : 'rotate-6 hover:rotate-0 origin-bottom-left'} transition-transform group`}>
                                                        <div className={`${card.suit === '♠' || card.suit === '♣' ? 'text-black' : 'text-red-600'} font-card font-bold text-base md:text-xl leading-none`}>{card.rank}</div>
                                                        <div className={`self-center text-3xl md:text-5xl ${card.suit === '♠' || card.suit === '♣' ? 'text-black' : 'text-red-600'} leading-none mt-1`}>{card.suit}</div>
                                                        <div className={`${card.suit === '♠' || card.suit === '♣' ? 'text-black' : 'text-red-600'} font-card font-bold text-base md:text-xl leading-none self-end rotate-180`}>{card.rank}</div>
                                                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-md"></div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="relative z-20 mt-4 md:mt-6 flex flex-col items-center">
                                                <div className="relative">
                                                    <div className={`w-16 h-16 md:w-24 md:h-24 rounded-full border-[3px] md:border-[4px] ${player.isWinner ? 'border-yellow-400 animate-[winnerGlow_1.5s_ease-in-out_infinite]' : isCurrentTurn ? 'border-green-400 shadow-[0_0_25px_rgba(74,222,128,0.5)] animate-pulse' : 'border-accent-gold'} bg-gray-700 bg-cover bg-center shadow-[0_0_20px_rgba(197,160,89,0.3)]`} style={{ backgroundImage: `url('${player.avatar}')` }}></div>
                                                    {/* Turn countdown ring */}
                                                    {turnTimeLeft > 0 && isCurrentTurn && (
                                                        <svg className="absolute inset-[-4px] w-[104px] h-[104px] -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                                                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                                                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke={turnTimeLeft <= 10 ? '#ef4444' : '#22c55e'} strokeWidth="2.5" strokeDasharray={`${(turnTimeLeft / 30) * 100}, 100`} strokeLinecap="round" className="drop-shadow-[0_0_4px_currentColor] transition-all duration-1000" />
                                                        </svg>
                                                    )}
                                                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-accent-gold text-surface-dark rounded-full flex items-center justify-center border-2 border-surface-dark shadow-md z-10">
                                                        <span className="material-symbols-outlined text-sm font-bold">star</span>
                                                    </div>
                                                    {player.role === 'dealer' && (
                                                        <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center border border-yellow-300 shadow text-[10px] text-black font-bold">D</div>
                                                    )}
                                                    {player.role === 'small_blind' && (
                                                        <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.5)] text-[9px] text-white font-bold z-20">小盲</div>
                                                    )}
                                                    {player.role === 'big_blind' && (
                                                        <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-300 shadow-[0_0_10px_rgba(239,68,68,0.5)] text-[9px] text-white font-bold z-20">大盲</div>
                                                    )}
                                                </div>
                                                <div className={`bg-surface-dark px-3 md:px-6 py-1.5 md:py-2 rounded-lg border text-center min-w-[80px] md:min-w-[120px] shadow-xl -mt-3 md:-mt-4 z-20 relative ${player.isWinner ? 'border-yellow-400 animate-[winnerGlow_1.5s_ease-in-out_infinite]' : 'border-accent-gold/50'}`}>
                                                    {/* Action badge */}
                                                    {player.lastAction && (
                                                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/90 text-yellow-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-yellow-500/40 whitespace-nowrap animate-fade-in-up z-30 shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                                                            {player.lastAction}
                                                        </div>
                                                    )}
                                                    <div className={`text-sm font-bold uppercase tracking-wider ${player.isWinner ? 'text-yellow-300' : 'text-white'}`}>{player.name}</div>
                                                    <div className="text-xs text-accent-gold font-mono font-bold">
                                                        {player.isWinner ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-yellow-400 text-sm">🏆 勝出！</span>
                                                                {player.handName && <span className="text-yellow-300/80 text-[10px]">{player.handName}</span>}
                                                            </div>
                                                        ) :
                                                            player.status === 'all-in' ? <span className="text-red-400 font-bold">ALL-IN</span> :
                                                                `$${playerBalance.toLocaleString()}`}
                                                    </div>
                                                </div>
                                                {player.bet > 0 && (
                                                    <div className="mt-1 flex items-center gap-1">
                                                        <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-dashed border-white/40 poker-chip"></div>
                                                        <span className="text-[10px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded border border-white/10">${player.bet.toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={player.id} className={`${posClass} ${foldedClass}`.trim()}>
                                        <div className="relative">
                                            <div className={`w-10 h-10 md:w-16 md:h-16 rounded-full border-2 md:border-[3px] ${player.isWinner ? 'border-yellow-400 animate-[winnerGlow_1.5s_ease-in-out_infinite]' : isCurrentTurn ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)] animate-pulse' : 'border-surface-dark'} bg-gray-800 bg-cover bg-center shadow-lg hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer`} style={{ backgroundImage: `url('${player.avatar}')` }}></div>
                                            {player.role === 'dealer' && (
                                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center border border-yellow-300 shadow text-[10px] text-black font-bold">D</div>
                                            )}
                                            {player.role === 'small_blind' && (
                                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.5)] text-[9px] text-white font-bold z-20">小盲</div>
                                            )}
                                            {player.role === 'big_blind' && (
                                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-300 shadow-[0_0_10px_rgba(239,68,68,0.5)] text-[9px] text-white font-bold z-20">大盲</div>
                                            )}
                                            {player.status === 'thinking' && (
                                                <svg className="absolute inset-[-4px] w-[72px] h-[72px] -rotate-90 pointer-events-none animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 36 36">
                                                    <path className="text-transparent" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2"></path>
                                                    <path className="text-accent-gold stroke-current drop-shadow-[0_0_3px_rgba(197,160,89,0.8)]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray="30, 100" strokeLinecap="round" strokeWidth="2"></path>
                                                </svg>
                                            )}
                                        </div>

                                        <div className={`bg-surface-dark/95 backdrop-blur px-2 md:px-4 py-1 md:py-1.5 rounded border ${player.status === 'thinking' ? 'border-accent-gold shadow-[0_0_15px_rgba(197,160,89,0.15)]' : player.isWinner ? 'border-yellow-400' : 'border-gray-700 shadow-lg'} text-center min-w-[60px] md:min-w-[90px] ${player.isWinner ? 'animate-[winnerGlow_1.5s_ease-in-out_infinite]' : ''} relative`}>
                                            {/* Action badge */}
                                            {player.lastAction && (
                                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/90 text-yellow-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-yellow-500/40 whitespace-nowrap animate-fade-in-up z-30 shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                                                    {player.lastAction}
                                                </div>
                                            )}
                                            <div className={`text-xs font-bold truncate max-w-[80px] ${player.isWinner ? 'text-yellow-300' : 'text-gray-200'}`}>{player.name}</div>
                                            <div className="text-[11px] text-accent-gold font-mono">
                                                {player.isWinner ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-yellow-400 font-bold text-xs">🏆 勝出！</span>
                                                        <span className="text-yellow-300/80 text-[9px]">{player.handName}</span>
                                                    </div>
                                                ) :
                                                    player.status === 'folded' ? <span className="text-gray-400 uppercase text-[10px]">已棄牌</span> :
                                                        player.status === 'thinking' ? <span className="animate-pulse">思考中...</span> :
                                                            player.status === 'all-in' ? <span className="text-red-400 font-bold text-[10px]">ALL-IN</span> :
                                                                `$${player.balance.toLocaleString()}`}
                                            </div>
                                        </div>

                                        {player.bet > 0 && (
                                            <div className="absolute right-full mr-6 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                                <div className="flex -space-y-1 flex-col-reverse mb-1">
                                                    <div className="w-6 h-6 rounded-full bg-red-600 border-2 border-dashed border-white/40 shadow-chip poker-chip"></div>
                                                    {player.bet > SMALL_BLIND && <div className="w-6 h-6 rounded-full bg-blue-700 border-2 border-dashed border-white/40 shadow-chip poker-chip"></div>}
                                                </div>
                                                <span className="text-[10px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded border border-white/10">${player.bet.toLocaleString()}</span>
                                            </div>
                                        )}

                                        {player.status !== 'folded' && player.cards.length > 0 && (
                                            <div className={`absolute ${player.positionIndex === 4 ? 'right-12 top-0 transform -rotate-12 origin-bottom-right' : player.positionIndex === 1 ? 'left-full ml-4 top-1/2 -translate-y-1/2' : 'top-12 left-full ml-2 transform rotate-6 origin-bottom-left'} flex gap-1`}>
                                                {gameStage === 'SHOWDOWN' ? (
                                                    <>
                                                        {player.cards.map((card, idx) => (
                                                            <div key={idx} className="w-8 h-11 bg-white rounded-sm shadow-md flex flex-col justify-between p-0.5 border border-gray-300">
                                                                <div className={`${card.suit === '♠' || card.suit === '♣' ? 'text-black' : 'text-red-600'} font-card font-bold text-[10px] leading-none`}>{card.rank}</div>
                                                                <div className={`self-center text-lg ${card.suit === '♠' || card.suit === '♣' ? 'text-black' : 'text-red-600'} leading-none`}>{card.suit}</div>
                                                            </div>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-8 h-11 rounded-sm card-pattern shadow-md"></div>
                                                        <div className="w-8 h-11 -ml-6 rounded-sm card-pattern shadow-md"></div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Action Bar */}
                    <div className="bg-[#1a1a1a] border-t border-accent-gold/20 z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] relative shrink-0 py-2 px-2 md:px-4">
                        {/* Auto-fold countdown */}
                        {turnTimeLeft > 0 && turnTimeLeft <= 10 && isUserTurn && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600/95 text-white font-bold text-sm px-5 py-1 rounded-t-lg shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse z-50 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">timer</span>
                                <span>{turnTimeLeft}秒</span>
                            </div>
                        )}
                        {isHandInProgress && !isUserTurn && gameStage !== 'SHOWDOWN' && (
                            <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-[1px]">
                                <div className="text-gray-400 text-sm font-bold uppercase tracking-widest animate-pulse">等待其他玩家...</div>
                            </div>
                        )}

                        {isWaitingForNextHand ? (
                            <div className="flex items-center justify-center py-2">
                                {autoStartCountdown > 0 ? (
                                    <span className="text-accent-gold text-sm font-bold animate-pulse">{autoStartCountdown} 秒後自動開始...</span>
                                ) : (
                                    <span className="text-accent-gold/70 text-sm font-bold animate-pulse">準備開始...</span>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1.5 max-w-2xl mx-auto">
                                {/* Row 1: Slider + Amount */}
                                <div className="flex items-center gap-3 w-full">
                                    <div className="flex gap-1.5 shrink-0">
                                        <button onClick={() => setBetAmount(Math.max(minRaise, Math.floor(potSize / 2)))} className="h-6 px-2 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-white/10 text-gray-400 text-[10px] font-bold transition-colors active:translate-y-0.5">½</button>
                                        <button onClick={() => setBetAmount(Math.max(minRaise, Math.floor(potSize * 0.75)))} className="h-6 px-2 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-white/10 text-gray-400 text-[10px] font-bold transition-colors active:translate-y-0.5">¾</button>
                                        <button onClick={() => setBetAmount(Math.max(minRaise, potSize))} className="h-6 px-2 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-white/10 text-gray-400 text-[10px] font-bold transition-colors active:translate-y-0.5">底池</button>
                                        <button onClick={() => setBetAmount(playerBalance + (userPlayer?.bet ?? 0))} className="h-6 px-2 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-accent-gold/30 text-accent-gold text-[10px] font-bold transition-colors active:translate-y-0.5">MAX</button>
                                    </div>
                                    <input
                                        className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-gold"
                                        max={playerBalance + (userPlayer?.bet ?? 0)}
                                        min={minRaise}
                                        type="range"
                                        value={betAmount}
                                        onChange={(e) => setBetAmount(Number(e.target.value))}
                                    />
                                    <div className="bg-black/80 border border-accent-gold/40 px-3 py-0.5 rounded text-accent-gold font-mono font-bold text-sm min-w-[70px] text-center shrink-0">${betAmount.toLocaleString()}</div>
                                </div>
                                {/* Row 2: Action Buttons - compact & colorful */}
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => handlePlayerAction('fold')}
                                        disabled={!isUserTurn}
                                        className="flex-1 h-10 rounded-lg bg-gradient-to-b from-gray-600 to-gray-800 hover:from-gray-500 hover:to-gray-700 text-white font-bold text-sm border-b-2 border-gray-900 active:border-b-0 active:translate-y-0.5 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        棄牌
                                    </button>
                                    <button
                                        onClick={() => handlePlayerAction(canCheck ? 'check' : 'call')}
                                        disabled={!isUserTurn}
                                        className="flex-1 h-10 rounded-lg bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-bold text-sm border-b-2 border-blue-950 active:border-b-0 active:translate-y-0.5 transition-all shadow-lg flex flex-col items-center justify-center leading-tight disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <span>{canCheck ? '過牌' : '跟注'}</span>
                                        {!canCheck && callAmount > 0 && <span className="text-[9px] font-normal text-blue-200">${callAmount.toLocaleString()}</span>}
                                    </button>
                                    <button
                                        onClick={() => handlePlayerAction('raise', betAmount)}
                                        disabled={!isUserTurn || playerBalance <= 0}
                                        className="flex-[1.3] h-10 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-sm border-b-2 border-emerald-900 active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <span>加注</span>
                                        <span className="text-[10px] font-normal text-emerald-200">${betAmount.toLocaleString()}</span>
                                    </button>
                                    <button
                                        onClick={() => handlePlayerAction('all-in')}
                                        disabled={!isUserTurn || playerBalance <= 0}
                                        className="flex-1 h-10 rounded-lg bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold text-sm border-b-2 border-red-950 active:border-b-0 active:translate-y-0.5 transition-all shadow-[0_0_12px_rgba(220,38,38,0.3)] disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider"
                                    >
                                        全下
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* Right Sidebar - hidden on mobile */}
                <div className="hidden lg:flex w-80 bg-[#151515] border-l border-accent-gold/20 flex-col shrink-0 z-20 shadow-2xl">
                    <div className="flex border-b border-white/5 bg-[#1a1a1a]">
                        <button className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-accent-gold border-b-2 border-accent-gold bg-white/5">聊天</button>
                        <button className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">歷史</button>
                        <button className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">玩家</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide bg-[#121212]">
                        <div className="text-center">
                            <span className="text-[10px] text-gray-600 font-mono bg-[#1a1a1a] px-2 py-1 rounded">遊戲紀錄</span>
                        </div>

                        {isHandInProgress && (
                            <div className="text-center">
                                <span className="text-[10px] text-primary font-mono bg-primary/10 px-3 py-1 rounded-full border border-primary/20 uppercase tracking-wider">
                                    {gameStage} • 底池 ${displayPot.toLocaleString()} • 盲注 ${SMALL_BLIND}/${BIG_BLIND}
                                </span>
                            </div>
                        )}

                        {actionLog.map((msg, idx) => (
                            <div key={idx} className="flex gap-3 bg-white/5 p-2 rounded border border-white/5">
                                <div className="bg-indigo-900 rounded w-6 h-6 shrink-0 flex items-center justify-center text-[8px] text-white font-bold border border-indigo-500 shadow-inner">
                                    <span className="material-symbols-outlined text-[12px]">casino</span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed self-center">{msg}</p>
                            </div>
                        ))}

                        {actionLog.length === 0 && (
                            <>
                                <div className="flex gap-3 group">
                                    <div className="bg-gray-700 rounded w-8 h-8 shrink-0 bg-cover border border-white/10" data-alt="User avatar" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=P5&background=random')` }}></div>
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">撲克王</span>
                                        </div>
                                        <p className="text-sm text-gray-400 font-light leading-relaxed">一手好牌！那個同花聽牌太嚇人了。</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 group">
                                    <div className="bg-gray-700 rounded w-8 h-8 shrink-0 bg-cover border border-white/10" data-alt="User avatar" style={{ backgroundImage: `url('https://ui-avatars.com/api/?name=P6&background=random')` }}></div>
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-bold text-accent-gold">幸運星</span>
                                        </div>
                                        <p className="text-sm text-gray-400 font-light leading-relaxed">等下有人要打錦標賽嗎？</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="p-3 border-t border-white/5 bg-[#1a1a1a]">
                        {chatMessages.length > 0 && (
                            <div className="mb-2 max-h-24 overflow-y-auto space-y-1">
                                {chatMessages.slice(-5).map((msg, idx) => (
                                    <div key={idx} className="text-xs">
                                        <span className={`font-bold ${msg.isUser ? 'text-accent-gold' : 'text-blue-400'}`}>{msg.name}:</span>
                                        <span className="text-gray-300 ml-1">{msg.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                            {['打得好 👍', '好牌！', '太厲害了', '加油！', '好運 🍀', '哈哈 😂', '嚇死我了', '再來一局', 'GG', 'All in!'].map(text => (
                                <button
                                    key={text}
                                    onClick={() => {
                                        const userName = players.find(p => p.isRealUser)?.name || '我';
                                        setChatMessages(prev => [...prev, { name: userName, text, isUser: true }]);
                                        // AI auto-reply after 1-3s
                                        const aiReplies = ['謝謝！', '你也打得不錯', '哈哈', '加油加油', '下一把見', '厲害👏', '運氣好而已'];
                                        const aiPlayers = players.filter(p => !p.isRealUser && p.balance > 0);
                                        if (aiPlayers.length > 0) {
                                            const delay = 1000 + Math.random() * 2000;
                                            setTimeout(() => {
                                                const ai = aiPlayers[Math.floor(Math.random() * aiPlayers.length)];
                                                const reply = aiReplies[Math.floor(Math.random() * aiReplies.length)];
                                                setChatMessages(prev => [...prev, { name: ai.name, text: reply, isUser: false }]);
                                            }, delay);
                                        }
                                    }}
                                    className="text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg bg-white/5 transition-all active:scale-95"
                                >
                                    {text}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <Modal isOpen={isRewardModalOpen} onClose={() => setIsRewardModalOpen(false)} title="每日登入獎勵" icon="monetization_on">
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
                    <button onClick={handleClaimReward} className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:from-red-500 hover:to-red-700 transition">
                        立即領取
                    </button>
                </div>
            </Modal>

            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="遊戲設定" icon="settings">
                <div className="flex flex-col gap-6 py-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div><h4 className="text-white font-bold mb-1">音效與音樂</h4><p className="text-xs text-gray-400">開啟或關閉遊戲背景音樂與發牌音效</p></div>
                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} /><div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div></label>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div><h4 className="text-white font-bold mb-1">顯示四色撲克牌</h4><p className="text-xs text-gray-400">使用更容易辨識的四色牌面設計</p></div>
                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" /><div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div></label>
                    </div>
                    <div className="flex items-center justify-between pb-2">
                        <div><h4 className="text-white font-bold mb-1">隱藏玩家聊天</h4><p className="text-xs text-gray-400">在牌桌上關閉隨機文字與表情符號</p></div>
                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" /><div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div></label>
                    </div>
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={() => setIsSettingsModalOpen(false)} className="flex-1 bg-surface-dark border border-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/5 transition">關閉</button>
                </div>
            </Modal>

            <Modal isOpen={isComingSoonModalOpen} onClose={() => setIsComingSoonModalOpen(false)} title="敬請期待" icon="construction">
                <div className="flex flex-col items-center py-6 text-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-surface-dark flex items-center justify-center border border-white/10 mb-2">
                        <span className="material-symbols-outlined text-4xl text-gray-400">hourglass_empty</span>
                    </div>
                    <div><h4 className="text-lg font-bold text-white mb-2">功能開發中</h4><p className="text-gray-400 text-sm">此功能目前正在開發中，將在未來的版本更新中推出。感謝您的耐心等候！</p></div>
                    <button onClick={() => setIsComingSoonModalOpen(false)} className="w-full mt-4 bg-surface-dark border border-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/5 transition">我知道了</button>
                </div>
            </Modal>
        </div>
    );
}
