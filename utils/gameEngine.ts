/**
 * Server-side game engine for multiplayer poker.
 * Pure functions that operate on PublicGameState — no React, no DB calls.
 */

import { Deck, Card, evaluateHand, determineWinners } from './poker';
import {
    PublicGameState, PublicSeat, GameStage, PlayerAction, ActionEntry,
    SeatStatus, SMALL_BLIND, BIG_BLIND, MAX_SEATS, TURN_TIMER_MS, AI_TURN_TIMER_MS,
} from '../types/multiplayer';

// ========== HELPERS ==========

export function getActiveSeats(state: PublicGameState): PublicSeat[] {
    return state.seats.filter((s): s is PublicSeat => s !== null && s.status !== 'sitting-out');
}

export function getPlayingSeats(state: PublicGameState): PublicSeat[] {
    return state.seats.filter((s): s is PublicSeat =>
        s !== null && (s.status === 'playing' || s.status === 'all-in')
    );
}

export function getNonFoldedSeats(state: PublicGameState): PublicSeat[] {
    return state.seats.filter((s): s is PublicSeat =>
        s !== null && s.status !== 'folded' && s.status !== 'waiting' && s.status !== 'sitting-out'
    );
}

export function findNextActiveSeat(fromSeatIndex: number, seats: (PublicSeat | null)[]): number {
    for (let i = 1; i <= MAX_SEATS; i++) {
        const idx = (fromSeatIndex + i) % MAX_SEATS;
        const seat = seats[idx];
        if (seat && seat.status === 'playing') return idx;
    }
    return -1;
}

function addAction(state: PublicGameState, seatIndex: number, action: PlayerAction, amount?: number): PublicGameState {
    const seat = state.seats[seatIndex];
    if (!seat) return state;
    const entry: ActionEntry = {
        seatIndex,
        action,
        amount,
        displayName: seat.displayName,
        timestamp: Date.now(),
    };
    return { ...state, actionLog: [...state.actionLog, entry] };
}

// ========== AI DECISION ENGINE ==========

export function makeAiDecision(
    seat: PublicSeat,
    holeCards: Card[],
    communityCards: Card[],
    currentBet: number,
    potSize: number,
): { action: PlayerAction; raiseAmount?: number } {
    const callCost = currentBet - seat.bet;
    const canCheck = callCost <= 0;

    let handStrength = 0.3;

    if (communityCards.length >= 3 && holeCards.length === 2) {
        try {
            const solved = evaluateHand(holeCards, communityCards);
            handStrength = solved.rank / 10;
        } catch {
            handStrength = 0.3;
        }
    } else if (holeCards.length === 2) {
        const rankOrder = '23456789TJQKA';
        const r1 = rankOrder.indexOf(holeCards[0].rank === '10' ? 'T' : holeCards[0].rank);
        const r2 = rankOrder.indexOf(holeCards[1].rank === '10' ? 'T' : holeCards[1].rank);
        const highCard = Math.max(r1, r2);
        const isPair = r1 === r2;
        const isSuited = holeCards[0].suit === holeCards[1].suit;
        const gap = Math.abs(r1 - r2);

        handStrength = (highCard / 13) * 0.4;
        if (isPair) handStrength += 0.35;
        if (isSuited) handStrength += 0.05;
        if (gap <= 2 && !isPair) handStrength += 0.05;
        handStrength = Math.min(handStrength, 1.0);
    }

    const randomFactor = (Math.random() - 0.5) * 0.3;
    const adjusted = Math.max(0, Math.min(1, handStrength + randomFactor));
    const isPreflop = communityCards.length === 0;

    // AI is more willing to gamble preflop or if bluffing
    const bluffThreshold = isPreflop ? 0.15 : 0.08;
    const bluff = Math.random() < bluffThreshold;

    if (adjusted >= (isPreflop ? 0.6 : 0.65) || bluff) {
        if (seat.chipBalance <= callCost) {
            return { action: 'all-in' };
        }
        // Raise amount logic
        const raiseMultiplier = 2 + Math.random() * 2;
        const raiseTotal = currentBet + Math.floor(BIG_BLIND * raiseMultiplier);
        const maxRaise = Math.min(raiseTotal, seat.chipBalance + seat.bet);
        return { action: 'raise', raiseAmount: maxRaise };
    } else if (adjusted >= (isPreflop ? 0.2 : 0.3) || (canCheck && adjusted >= 0.1)) {
        if (canCheck) return { action: 'check' };

        // Pot odds / commitment logic: 
        // Preflop, AI should almost always call the BIG_BLIND if they've already put in SMALL_BLIND
        // or if the cost to call is very small relative to their stack.
        const stackPortion = callCost / Math.max(1, seat.chipBalance);
        const potOdds = callCost / Math.max(1, potSize + callCost);

        if (isPreflop && callCost <= BIG_BLIND) {
            return { action: 'call' };
        }

        if (stackPortion <= 0.3 || adjusted > 0.45 || (potOdds < 0.2 && adjusted > 0.2)) {
            if (callCost >= seat.chipBalance) return { action: 'all-in' };
            return { action: 'call' };
        }
        return { action: 'fold' };
    } else {
        if (canCheck) return { action: 'check' };
        // Even with garbage, small chance to stay in preflop for a cheap call
        if (isPreflop && callCost <= BIG_BLIND && Math.random() < 0.3) {
            return { action: 'call' };
        }
        return { action: 'fold' };
    }
}

// ========== DEAL NEW HAND ==========

export function dealNewHand(
    prevState: PublicGameState,
): { newState: PublicGameState; holeCardsBySeat: Record<number, Card[]>; deck: Deck } {
    const deck = new Deck();
    const holeCardsBySeat: Record<number, Card[]> = {};

    // Get seated players with balance > 0
    const seatedIndices: number[] = [];
    prevState.seats.forEach((seat, idx) => {
        if (seat && seat.chipBalance > 0 && seat.status !== 'sitting-out') {
            seatedIndices.push(idx);
        }
    });

    if (seatedIndices.length < 2) {
        return { newState: prevState, holeCardsBySeat, deck };
    }

    // Advance dealer
    let newDealerSeat = -1;
    if (prevState.dealerSeatIndex < 0) {
        newDealerSeat = seatedIndices[0];
    } else {
        // Find next seated player after current dealer
        for (let i = 1; i <= MAX_SEATS; i++) {
            const idx = (prevState.dealerSeatIndex + i) % MAX_SEATS;
            if (seatedIndices.includes(idx)) {
                newDealerSeat = idx;
                break;
            }
        }
        if (newDealerSeat < 0) newDealerSeat = seatedIndices[0];
    }

    // Find SB and BB
    const dealerPos = seatedIndices.indexOf(newDealerSeat);
    const sbSeat = seatedIndices[(dealerPos + 1) % seatedIndices.length];
    const bbSeat = seatedIndices[(dealerPos + 2) % seatedIndices.length];

    // Build new seats
    const newSeats: (PublicSeat | null)[] = prevState.seats.map((seat, idx) => {
        if (!seat || !seatedIndices.includes(idx)) return seat;

        const cards = deck.deal(2);
        holeCardsBySeat[idx] = cards;

        let role: PublicSeat['role'] = undefined;
        let bet = 0;
        let balance = seat.chipBalance;

        if (idx === newDealerSeat) role = 'dealer';
        if (idx === sbSeat) {
            role = 'small_blind';
            bet = Math.min(SMALL_BLIND, balance);
            balance -= bet;
        }
        if (idx === bbSeat) {
            role = 'big_blind';
            bet = Math.min(BIG_BLIND, balance);
            balance -= bet;
        }

        return {
            ...seat,
            chipBalance: balance,
            bet,
            totalInvested: bet,
            status: (balance === 0 && bet > 0) ? 'all-in' as SeatStatus : 'playing' as SeatStatus,
            role,
            lastAction: undefined,
            handName: undefined,
            isWinner: false,
            revealedCards: undefined,
        };
    });

    // UTG = next active after BB
    const utgSeat = findNextActiveSeat(bbSeat, newSeats);

    const newState: PublicGameState = {
        stage: 'PREFLOP',
        communityCards: [],
        potSize: 0,
        currentBet: BIG_BLIND,
        currentSeatIndex: utgSeat,
        dealerSeatIndex: newDealerSeat,
        lastRaiserSeatIndex: utgSeat,
        isHandInProgress: true,
        seats: newSeats,
        actedThisRound: [],
        handCount: prevState.handCount + 1,
        actionLog: [],
        actionDeadline: newSeats[utgSeat]?.playerType === 'real'
            ? new Date(Date.now() + TURN_TIMER_MS).toISOString()
            : new Date(Date.now() + AI_TURN_TIMER_MS).toISOString(),
    };

    return { newState, holeCardsBySeat, deck };
}

// ========== APPLY ACTION ==========

export function applyAction(
    state: PublicGameState,
    seatIndex: number,
    action: PlayerAction,
    raiseAmount?: number,
): { newState: PublicGameState; lastPlayerStanding: boolean } {
    const seats = state.seats.map(s => s ? { ...s } : null);
    const seat = seats[seatIndex];
    if (!seat || seat.status === 'folded' || seat.status === 'all-in') {
        return { newState: state, lastPlayerStanding: false };
    }

    let newBet = state.currentBet;
    let newRaiserIdx = state.lastRaiserSeatIndex;
    let newActed = [...state.actedThisRound];
    let logState = state;

    switch (action) {
        case 'fold': {
            seat.status = 'folded';
            seat.lastAction = '棄牌';
            logState = addAction(state, seatIndex, 'fold');
            break;
        }
        case 'check': {
            if (seat.bet < state.currentBet) {
                return { newState: state, lastPlayerStanding: false };
            }
            seat.lastAction = '過牌';
            logState = addAction(state, seatIndex, 'check');
            break;
        }
        case 'call': {
            const callAmount = Math.min(state.currentBet - seat.bet, seat.chipBalance);
            seat.chipBalance -= callAmount;
            seat.bet += callAmount;
            seat.totalInvested += callAmount;
            if (seat.chipBalance === 0) seat.status = 'all-in';
            seat.lastAction = seat.status === 'all-in' ? '全下' : '跟注';
            logState = addAction(state, seatIndex, 'call', callAmount);
            break;
        }
        case 'raise': {
            const targetBet = raiseAmount || (state.currentBet + BIG_BLIND);
            const raiseBy = targetBet - seat.bet;
            const actualPay = Math.min(raiseBy, seat.chipBalance);
            seat.chipBalance -= actualPay;
            seat.bet += actualPay;
            seat.totalInvested += actualPay;
            if (seat.chipBalance === 0) seat.status = 'all-in';
            seat.lastAction = '加注';
            newBet = seat.bet;
            newRaiserIdx = seatIndex;
            logState = addAction(state, seatIndex, 'raise', seat.bet);
            break;
        }
        case 'all-in': {
            const allInAmount = seat.chipBalance;
            seat.bet += allInAmount;
            seat.chipBalance = 0;
            seat.totalInvested += allInAmount;
            seat.status = 'all-in';
            seat.lastAction = '全下';
            if (seat.bet > newBet) {
                newBet = seat.bet;
                newRaiserIdx = seatIndex;
            }
            logState = addAction(state, seatIndex, 'all-in', allInAmount);
            break;
        }
    }

    // Track acted
    newActed.push(seatIndex);

    // Raise/all-in that increases bet resets acted
    if ((action === 'raise' || action === 'all-in') && newBet > state.currentBet) {
        newActed = [seatIndex];
    }

    const newState: PublicGameState = {
        ...logState,
        seats,
        currentBet: newBet,
        lastRaiserSeatIndex: newRaiserIdx,
        actedThisRound: newActed,
        actionLog: logState.actionLog,
    };

    // Check if only 1 non-folded player remains
    const remaining = getNonFoldedSeats(newState);
    if (remaining.length === 1) {
        return { newState, lastPlayerStanding: true };
    }

    return { newState, lastPlayerStanding: false };
}

// ========== CHECK BETTING ROUND COMPLETE ==========

export function isBettingRoundComplete(state: PublicGameState): boolean {
    const acted = new Set(state.actedThisRound);
    for (let i = 0; i < MAX_SEATS; i++) {
        const seat = state.seats[i];
        if (!seat) continue;
        if (seat.status === 'folded' || seat.status === 'all-in' || seat.status === 'waiting' || seat.status === 'sitting-out') continue;
        // This seat is 'playing' — must have acted AND matched the bet
        if (!acted.has(i)) return false;
        if (seat.bet < state.currentBet) return false;
    }
    // Also verify that at least 1 player acted
    return acted.size > 0;
}

// ========== ADVANCE STAGE ==========

export function advanceStage(
    state: PublicGameState,
    holeCardsBySeat: Record<number, Card[]>,
    deck: Deck,
): PublicGameState {
    // Sweep bets into pot
    let totalBets = 0;
    const newSeats = state.seats.map(s => {
        if (!s) return null;
        totalBets += s.bet;
        return { ...s, bet: 0 };
    });
    const newPot = state.potSize + totalBets;

    // Check if we should fast-track to showdown (only 0-1 players can still act)
    const canAct = newSeats.filter(s => s && s.status === 'playing');
    const nonFolded = newSeats.filter((s): s is PublicSeat =>
        s !== null && s.status !== 'folded' && s.status !== 'waiting' && s.status !== 'sitting-out'
    );

    if (state.stage === 'RIVER' || canAct.length <= 1) {
        // Run showdown
        return runShowdown(
            { ...state, seats: newSeats, potSize: newPot, currentBet: 0, actedThisRound: [] },
            holeCardsBySeat,
            deck,
        );
    }

    // Deal next community cards
    let newCC = [...state.communityCards];
    let newStage: GameStage = state.stage;

    if (state.stage === 'PREFLOP') {
        newCC = deck.deal(3);
        newStage = 'FLOP';
    } else if (state.stage === 'FLOP') {
        newCC = [...state.communityCards, ...deck.deal(1)];
        newStage = 'TURN';
    } else if (state.stage === 'TURN') {
        newCC = [...state.communityCards, ...deck.deal(1)];
        newStage = 'RIVER';
    }

    // Find first active player after dealer
    const firstAct = findNextActiveSeat(state.dealerSeatIndex, newSeats);
    if (firstAct < 0) {
        // No one can act — deal remaining and showdown
        const needed = 5 - newCC.length;
        if (needed > 0) newCC = [...newCC, ...deck.deal(needed)];
        return runShowdown(
            { ...state, seats: newSeats, potSize: newPot, communityCards: newCC, currentBet: 0, actedThisRound: [] },
            holeCardsBySeat,
            deck,
        );
    }

    return {
        ...state,
        seats: newSeats,
        communityCards: newCC,
        potSize: newPot,
        currentBet: 0,
        lastRaiserSeatIndex: firstAct,
        currentSeatIndex: firstAct,
        stage: newStage,
        actedThisRound: [],
        actionDeadline: newSeats[firstAct]?.playerType === 'real'
            ? new Date(Date.now() + TURN_TIMER_MS).toISOString()
            : new Date(Date.now() + AI_TURN_TIMER_MS).toISOString(),
    };
}

// ========== RUN SHOWDOWN ==========

export function runShowdown(
    state: PublicGameState,
    holeCardsBySeat: Record<number, Card[]>,
    deck: Deck,
): PublicGameState {
    let cc = [...state.communityCards];
    const needed = 5 - cc.length;
    if (needed > 0) cc = [...cc, ...deck.deal(needed)];

    const seats = state.seats.map(s => s ? { ...s } : null);
    const activePlayers = seats.filter((s): s is PublicSeat =>
        s !== null && s.status !== 'folded' && s.status !== 'waiting' && s.status !== 'sitting-out'
        && holeCardsBySeat[s.seatIndex]?.length === 2
    );

    if (activePlayers.length === 0) {
        return { ...state, stage: 'SHOWDOWN', isHandInProgress: false, communityCards: cc };
    }

    // Side pot distribution
    const investmentLevels = [...new Set(activePlayers.map(p => p.totalInvested))].sort((a, b) => a - b);
    const winnings: Record<number, number> = {};
    seats.forEach((s, idx) => { if (s) winnings[idx] = 0; });

    let processedLevel = 0;
    let overallHandName = '';

    for (const level of investmentLevels) {
        if (level <= processedLevel) continue;
        const perPlayerContrib = level - processedLevel;
        const allSeats = seats.filter((s): s is PublicSeat => s !== null && s.totalInvested > processedLevel);
        const subPot = perPlayerContrib * allSeats.length;

        const eligible = activePlayers.filter(p => p.totalInvested >= level);
        if (eligible.length === 1) {
            winnings[eligible[0].seatIndex] += subPot;
        } else if (eligible.length > 1) {
            const handsToEval = eligible.map(p => ({
                playerId: String(p.seatIndex),
                holeCards: holeCardsBySeat[p.seatIndex],
            }));
            const result = determineWinners(handsToEval, cc);
            const perWinner = Math.floor(subPot / result.winningPlayerIds.length);
            result.winningPlayerIds.forEach(id => {
                winnings[Number(id)] += perWinner;
            });
            if (!overallHandName) overallHandName = result.handName;
        }
        processedLevel = level;
    }

    // Update seats with winnings and hand names
    const handNames: Record<number, string> = {};
    activePlayers.forEach(p => {
        try {
            const solved = evaluateHand(holeCardsBySeat[p.seatIndex], cc);
            handNames[p.seatIndex] = solved.name;
        } catch { /* ignore */ }
    });

    const finalSeats = seats.map((seat, idx) => {
        if (!seat) return null;
        const winAmount = winnings[idx] || 0;
        const isWinner = winAmount > 0;
        return {
            ...seat,
            chipBalance: seat.chipBalance + winAmount,
            isWinner,
            handName: isWinner ? (overallHandName || handNames[idx]) : handNames[idx],
            revealedCards: activePlayers.some(p => p.seatIndex === idx)
                ? holeCardsBySeat[idx]
                : undefined,
        };
    });

    return {
        ...state,
        stage: 'SHOWDOWN',
        communityCards: cc,
        isHandInProgress: false,
        currentSeatIndex: -1,
        seats: finalSeats,
        autoStartAt: new Date(Date.now() + 4000).toISOString(),
    };
}

// ========== HANDLE LAST PLAYER WIN (everyone else folded) ==========

export function handleLastPlayerWin(state: PublicGameState): PublicGameState {
    const seats = state.seats.map(s => s ? { ...s } : null);

    // Sweep remaining bets
    let totalBets = 0;
    seats.forEach(s => {
        if (s) {
            totalBets += s.bet;
            s.bet = 0;
        }
    });
    const finalPot = state.potSize + totalBets;

    const winner = seats.find(s => s !== null && s.status !== 'folded' && s.status !== 'waiting' && s.status !== 'sitting-out');
    if (winner) {
        winner.chipBalance += finalPot;
        winner.isWinner = true;
    }

    return {
        ...state,
        stage: 'SHOWDOWN',
        isHandInProgress: false,
        currentSeatIndex: -1,
        potSize: finalPot,
        seats,
        autoStartAt: new Date(Date.now() + 4000).toISOString(),
    };
}

// ========== PROCESS FULL ACTION (action + AI chain + stage advance) ==========

/**
 * Main entry point: processes a player action, then chains through AI turns
 * until a real player's turn or hand ends.
 * Returns final state + updated hole cards map (for DB write).
 */
export function processFullAction(
    state: PublicGameState,
    seatIndex: number,
    action: PlayerAction,
    raiseAmount: number | undefined,
    holeCardsBySeat: Record<number, Card[]>,
    deck: Deck,
): PublicGameState {
    let currentState: PublicGameState = { ...state, actionLog: [] as ActionEntry[] };

    // 1. Apply the player's action
    let result = applyAction(currentState, seatIndex, action, raiseAmount);
    currentState = result.newState;

    if (result.lastPlayerStanding) {
        return handleLastPlayerWin(currentState);
    }

    // 2. Check if betting round is complete
    if (isBettingRoundComplete(currentState)) {
        currentState = advanceStage(currentState, holeCardsBySeat, deck);
    } else {
        // Advance to next player
        const nextSeat = findNextActiveSeat(seatIndex, currentState.seats);
        if (nextSeat >= 0) {
            currentState = {
                ...currentState,
                currentSeatIndex: nextSeat,
                actionDeadline: currentState.seats[nextSeat]?.playerType === 'real'
                    ? new Date(Date.now() + TURN_TIMER_MS).toISOString()
                    : undefined,
            };
        }
    }

    // 3. Chain through AI turns
    while (
        currentState.isHandInProgress &&
        currentState.currentSeatIndex >= 0 &&
        currentState.seats[currentState.currentSeatIndex]?.playerType === 'ai'
    ) {
        const aiSeat = currentState.seats[currentState.currentSeatIndex]!;
        const aiCards = holeCardsBySeat[aiSeat.seatIndex] || [];

        const decision = makeAiDecision(
            aiSeat, aiCards, currentState.communityCards,
            currentState.currentBet, currentState.potSize,
        );

        const aiResult = applyAction(currentState, aiSeat.seatIndex, decision.action, decision.raiseAmount);
        currentState = aiResult.newState;

        if (aiResult.lastPlayerStanding) {
            return handleLastPlayerWin(currentState);
        }

        if (isBettingRoundComplete(currentState)) {
            currentState = advanceStage(currentState, holeCardsBySeat, deck);
        } else {
            const nextSeat = findNextActiveSeat(aiSeat.seatIndex, currentState.seats);
            if (nextSeat >= 0) {
                currentState = {
                    ...currentState,
                    currentSeatIndex: nextSeat,
                    actionDeadline: currentState.seats[nextSeat]?.playerType === 'real'
                        ? new Date(Date.now() + TURN_TIMER_MS).toISOString()
                        : undefined,
                };
            } else {
                break;
            }
        }
    }

    return currentState;
}
