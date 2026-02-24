import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';
import { dealNewHand, processFullAction, findNextActiveSeat, makeAiDecision, applyAction, isBettingRoundComplete, advanceStage } from '@/utils/gameEngine';
import type { PublicGameState } from '@/types/multiplayer';
import { TURN_TIMER_MS, AI_TURN_TIMER_MS, MAX_SEATS } from '@/types/multiplayer';
import type { Card } from '@/utils/poker';

export async function POST(req: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tableId } = await req.json() as { tableId: string };
    if (!tableId) return NextResponse.json({ error: 'Missing tableId' }, { status: 400 });

    // Fetch table
    const { data: table } = await supabase
        .from('poker_tables')
        .select('*')
        .eq('id', tableId)
        .single();

    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 });

    const state: PublicGameState = table.game_state;

    // Don't start if hand already in progress
    if (state.isHandInProgress) {
        return NextResponse.json({ newState: state });
    }

    // Sync seat balances from table_players (authoritative)
    const { data: dbPlayers } = await supabase
        .from('table_players')
        .select('*')
        .eq('table_id', tableId);

    const playerMap = new Map((dbPlayers || []).map(p => [p.seat_index, p]));

    // Truncate seats to MAX_SEATS (handles old 8-seat tables)
    const truncatedSeats = state.seats.slice(0, MAX_SEATS);

    const syncedState: PublicGameState = {
        ...state,
        seats: truncatedSeats.map((seat, idx) => {
            const dbPlayer = playerMap.get(idx);
            if (!seat && dbPlayer) {
                // Player exists in DB but not in state (joined between hands)
                return {
                    seatIndex: idx,
                    playerType: dbPlayer.player_type as 'real' | 'ai',
                    playerId: dbPlayer.id,
                    userId: dbPlayer.user_id ? undefined : undefined, // will be set below
                    displayName: dbPlayer.display_name,
                    avatarUrl: dbPlayer.avatar_url || '',
                    chipBalance: dbPlayer.chip_balance,
                    bet: 0,
                    totalInvested: 0,
                    status: 'waiting' as const,
                };
            }
            if (seat && dbPlayer) {
                return { ...seat, chipBalance: dbPlayer.chip_balance, status: 'waiting' as const, bet: 0, totalInvested: 0, isWinner: false, handName: undefined, revealedCards: undefined, lastAction: undefined };
            }
            if (seat && !dbPlayer) {
                return null; // Player left
            }
            return null;
        }),
    };

    // Resolve auth_ids for real players
    for (const seat of syncedState.seats) {
        if (seat && seat.playerType === 'real') {
            const dbPlayer = playerMap.get(seat.seatIndex);
            if (dbPlayer?.user_id) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('auth_id')
                    .eq('id', dbPlayer.user_id)
                    .single();
                if (userData) seat.userId = userData.auth_id;
            }
        }
    }

    // Need at least 2 players with balance > 0
    const activePlayers = syncedState.seats.filter(s => s && s.chipBalance > 0);
    if (activePlayers.length < 2) {
        return NextResponse.json({ error: 'Not enough players' }, { status: 400 });
    }

    // Deal new hand
    const { newState, holeCardsBySeat, deck } = dealNewHand(syncedState);

    // Save hole cards to table_players
    for (const [seatIdx, cards] of Object.entries(holeCardsBySeat)) {
        await supabase
            .from('table_players')
            .update({ hole_cards: cards })
            .eq('table_id', tableId)
            .eq('seat_index', Number(seatIdx));
    }

    // Chain through AI turns if first player is AI
    let currentState = newState;
    while (
        currentState.isHandInProgress &&
        currentState.currentSeatIndex >= 0 &&
        currentState.seats[currentState.currentSeatIndex]?.playerType === 'ai'
    ) {
        const aiSeat = currentState.seats[currentState.currentSeatIndex]!;
        const aiCards = holeCardsBySeat[aiSeat.seatIndex] || [];
        const decision = makeAiDecision(aiSeat, aiCards, currentState.communityCards, currentState.currentBet, currentState.potSize);

        const result = applyAction(currentState, aiSeat.seatIndex, decision.action, decision.raiseAmount);
        currentState = result.newState;

        if (result.lastPlayerStanding) {
            // Import handleLastPlayerWin
            const { handleLastPlayerWin } = await import('@/utils/gameEngine');
            currentState = handleLastPlayerWin(currentState);
            break;
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
                        : new Date(Date.now() + AI_TURN_TIMER_MS).toISOString(),
                };
            } else {
                break;
            }
        }
    }

    // Save state (triggers Realtime)
    await supabase
        .from('poker_tables')
        .update({
            game_state: currentState,
            hand_count: currentState.handCount,
            status: 'playing',
        })
        .eq('id', tableId);

    // Return the requesting user's hole cards
    const { data: mySeat } = await supabase
        .from('table_players')
        .select('seat_index, hole_cards')
        .eq('table_id', tableId)
        .eq('player_type', 'real')
        .single();

    // Find the requesting user's seat
    let myHoleCards: Card[] | null = null;
    if (dbPlayers) {
        const myDbPlayer = dbPlayers.find(p => {
            // Check against user_id
            return p.player_type === 'real';
        });
        // We need the user's actual UUID to find their seat
        const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', clerkUser.id)
            .single();
        if (userData) {
            const myPlayer = dbPlayers.find(p => p.user_id === userData.id);
            if (myPlayer) {
                myHoleCards = holeCardsBySeat[myPlayer.seat_index] || null;
            }
        }
    }

    return NextResponse.json({ newState: currentState, myHoleCards });
}
