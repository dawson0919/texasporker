import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';
import { processFullAction } from '@/utils/gameEngine';
import { Deck, Card } from '@/utils/poker';
import type { PublicGameState } from '@/types/multiplayer';

/**
 * POST /api/multiplayer/timeout
 * Any player at the table can call this to force-fold a player whose actionDeadline has expired.
 * This prevents games from getting permanently stuck when a player disconnects.
 */
export async function POST(req: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tableId } = await req.json() as { tableId: string };
    if (!tableId) return NextResponse.json({ error: 'Missing tableId' }, { status: 400 });

    const { data: table } = await supabase
        .from('poker_tables')
        .select('game_state')
        .eq('id', tableId)
        .single();

    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 });

    const state: PublicGameState = table.game_state;

    // Must be in an active hand
    if (!state.isHandInProgress) {
        return NextResponse.json({ error: 'No hand in progress' }, { status: 400 });
    }

    // Must have an expired action deadline
    if (!state.actionDeadline) {
        return NextResponse.json({ error: 'No action deadline set' }, { status: 400 });
    }

    const deadline = new Date(state.actionDeadline).getTime();
    const grace = 1000; // 1s grace period
    if (Date.now() < deadline + grace) {
        return NextResponse.json({ error: 'Deadline not yet expired' }, { status: 400 });
    }

    // Fetch hole cards for AI decisions and showdown
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

    // Reconstruct deck without dealt cards
    const usedCards = new Set<string>();
    Object.values(holeCardsBySeat).forEach(cards => {
        cards.forEach(c => usedCards.add(`${c.rank}${c.suit}`));
    });
    state.communityCards.forEach(c => usedCards.add(`${c.rank}${c.suit}`));
    const deck = createFilteredDeck(usedCards);

    // Force fold the timed-out player
    const newState = processFullAction(state, state.currentSeatIndex, 'fold', undefined, holeCardsBySeat, deck);

    // Save to DB (triggers Realtime broadcast)
    await supabase
        .from('poker_tables')
        .update({ game_state: newState })
        .eq('id', tableId);

    // If showdown, commit balance changes
    if (newState.stage === 'SHOWDOWN' && !newState.isHandInProgress) {
        await commitShowdownResults(tableId, newState);
    }

    return NextResponse.json({ newState });
}

function createFilteredDeck(usedCards: Set<string>): Deck {
    const deck = new Deck();
    deck.reset();
    const d = deck as any;
    d.cards = d.cards.filter((c: Card) => !usedCards.has(`${c.rank}${c.suit}`));
    for (let i = d.cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d.cards[i], d.cards[j]] = [d.cards[j], d.cards[i]];
    }
    return deck;
}

async function commitShowdownResults(tableId: string, state: PublicGameState) {
    for (const seat of state.seats) {
        if (!seat) continue;
        await supabase
            .from('table_players')
            .update({ chip_balance: seat.chipBalance, hole_cards: null })
            .eq('table_id', tableId)
            .eq('seat_index', seat.seatIndex);

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
            }
        }
    }
}
