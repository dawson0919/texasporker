import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';
import { processFullAction } from '@/utils/gameEngine';
import { Deck, Card } from '@/utils/poker';
import type { PublicGameState, PlayerAction } from '@/types/multiplayer';

export async function POST(req: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tableId, action, raiseAmount } = await req.json() as {
        tableId: string;
        action: PlayerAction;
        raiseAmount?: number;
    };

    if (!tableId || !action) {
        return NextResponse.json({ error: 'Missing tableId or action' }, { status: 400 });
    }

    // Fetch current table state
    const { data: table } = await supabase
        .from('poker_tables')
        .select('game_state')
        .eq('id', tableId)
        .single();

    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 });

    const state: PublicGameState = table.game_state;

    // Verify it's this player's turn
    const currentSeat = state.seats[state.currentSeatIndex];
    if (!currentSeat || currentSeat.userId !== clerkUser.id) {
        return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
    }

    // Verify action deadline hasn't expired (allow small grace period)
    if (state.actionDeadline) {
        const deadline = new Date(state.actionDeadline).getTime();
        const grace = 2000; // 2s grace
        if (Date.now() > deadline + grace && action !== 'fold') {
            // Force fold if past deadline
            return NextResponse.json({ error: 'Turn expired' }, { status: 408 });
        }
    }

    // Fetch all hole cards for this table (needed for AI decisions and showdown)
    const { data: allPlayers } = await supabase
        .from('table_players')
        .select('seat_index, hole_cards')
        .eq('table_id', tableId);

    const holeCardsBySeat: Record<number, Card[]> = {};
    (allPlayers || []).forEach(p => {
        if (p.hole_cards) {
            holeCardsBySeat[p.seat_index] = p.hole_cards as Card[];
        }
    });

    // Reconstruct deck (without dealt cards)
    const deck = new Deck();
    // Remove all known cards from deck
    const usedCards = new Set<string>();
    Object.values(holeCardsBySeat).forEach(cards => {
        cards.forEach(c => usedCards.add(`${c.rank}${c.suit}`));
    });
    state.communityCards.forEach(c => usedCards.add(`${c.rank}${c.suit}`));
    // Create a filtered deck
    const filteredDeck = new Deck();
    filteredDeck.reset();
    // We need to manually filter — use a fresh deck approach
    // Since the Deck class doesn't support removal, we create a new deck
    // and deal the remaining cards excluding used ones
    const freshDeck = createFilteredDeck(usedCards);

    // Process the action (includes AI chain)
    const newState = processFullAction(state, state.currentSeatIndex, action, raiseAmount, holeCardsBySeat, freshDeck);

    // Save to DB (triggers Realtime broadcast)
    await supabase
        .from('poker_tables')
        .update({ game_state: newState })
        .eq('id', tableId);

    // If showdown, commit balance changes
    if (newState.stage === 'SHOWDOWN' && !newState.isHandInProgress) {
        await commitShowdownResults(tableId, newState, clerkUser.id);
    }

    return NextResponse.json({ newState });
}

// Create a deck with specific cards removed
function createFilteredDeck(usedCards: Set<string>): Deck {
    const deck = new Deck();
    deck.reset();
    // Access internal cards via type assertion
    const d = deck as any;
    d.cards = d.cards.filter((c: Card) => !usedCards.has(`${c.rank}${c.suit}`));
    // Shuffle remaining
    for (let i = d.cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d.cards[i], d.cards[j]] = [d.cards[j], d.cards[i]];
    }
    return deck;
}

async function commitShowdownResults(tableId: string, state: PublicGameState, clerkUserId: string) {
    // Update chip balances for all players in DB
    for (const seat of state.seats) {
        if (!seat) continue;

        await supabase
            .from('table_players')
            .update({ chip_balance: seat.chipBalance, hole_cards: null })
            .eq('table_id', tableId)
            .eq('seat_index', seat.seatIndex);

        // For real players: update main balance and record history
        if (seat.playerType === 'real' && seat.userId) {
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', seat.userId)
                .single();

            if (user) {
                await supabase
                    .from('balances')
                    .update({ chip_balance: seat.chipBalance })
                    .eq('user_id', user.id);

                // Record game history
                const profitLoss = seat.isWinner
                    ? seat.chipBalance - (seat.chipBalance - (seat.totalInvested || 0)) // approximate
                    : -(seat.totalInvested || 0);

                await supabase.from('game_history').insert({
                    user_id: user.id,
                    game_type: 'MULTIPLAYER_CASH',
                    stake: '50/100',
                    profit_loss: profitLoss,
                    stage_reached: 'SHOWDOWN',
                });
            }
        }
    }
}
