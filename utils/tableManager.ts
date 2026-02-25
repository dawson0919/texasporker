/**
 * Table management: matchmaking, seat assignment, AI fill, player replacement.
 */

import { supabase } from './supabase/server';
import {
    PublicGameState, PublicSeat, PokerTableRow, TablePlayerRow,
    MAX_SEATS, MAX_TABLES, FILL_DEADLINE_MS, AI_NAMES,
    createEmptyGameState,
} from '../types/multiplayer';

// ========== MATCHMAKING ==========

const MAX_REAL_PLAYERS = 3; // Mixed table must have at least 2 AI (MAX_SEATS=5)

export async function assignSeat(
    userUuid: string,
    clerkUserId: string,
    displayName: string,
    avatarUrl: string,
    chipBalance: number,
): Promise<{ tableId: string; seatIndex: number; tableNumber: number; isNewTable: boolean }> {

    // Check if user is already seated somewhere
    const { data: existingSeat } = await supabase
        .from('table_players')
        .select('table_id, seat_index, poker_tables!inner(id, table_number, status)')
        .eq('user_id', userUuid)
        .eq('player_type', 'real')
        .limit(1)
        .single();

    if (existingSeat) {
        const table = (existingSeat as any).poker_tables;
        if (table && (table.status === 'waiting' || table.status === 'playing')) {
            return {
                tableId: existingSeat.table_id,
                seatIndex: existingSeat.seat_index,
                tableNumber: table.table_number,
                isNewTable: false,
            };
        }
    }

    // Proactive Cleanup: Remove players who joined > 2 hours ago (ghost prevention)
    // Use raw SQL for safer relative time comparison across environments
    await supabase.rpc('delete_stale_multiplayer_players');
    // Fallback if RPC fails: simpler JS logic
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await supabase.from('table_players')
        .delete()
        .eq('player_type', 'real')
        .lt('joined_at', twoHoursAgo);

    // Find available table (prefer tables with real players but not full)
    const { data: tables } = await supabase
        .from('poker_tables')
        .select('*')
        .in('status', ['waiting', 'playing'])
        .order('table_number', { ascending: true });

    for (const table of (tables || [])) {
        const { data: players } = await supabase
            .from('table_players')
            .select('seat_index, player_type')
            .eq('table_id', table.id);

        const validPlayers = (players || []).filter(p => p.seat_index < MAX_SEATS);
        const realCount = validPlayers.filter(p => p.player_type === 'real').length;

        // Table has room (limit to MAX_REAL_PLAYERS to reserve 2 AI seats)
        if (realCount < MAX_REAL_PLAYERS) {
            // Find a seat: prefer empty seat, then replace AI
            const gs: PublicGameState = table.game_state;
            const occupied = new Set(validPlayers.map(p => p.seat_index));
            let targetSeat = -1;

            // Try empty seat first
            for (let i = 0; i < MAX_SEATS; i++) {
                if (!occupied.has(i)) {
                    targetSeat = i;
                    break;
                }
            }

            // If no empty seat, replace an AI
            if (targetSeat < 0) {
                const aiPlayers = (players || []).filter(p => p.player_type === 'ai');
                if (aiPlayers.length > 0) {
                    targetSeat = aiPlayers[0].seat_index;
                    // Remove the AI player
                    await supabase
                        .from('table_players')
                        .delete()
                        .eq('table_id', table.id)
                        .eq('seat_index', targetSeat);

                    // Update game_state to remove AI from seat
                    const gameState: PublicGameState = table.game_state;
                    if (gameState.seats[targetSeat]) {
                        const newSeats = [...gameState.seats];
                        // If hand in progress, mark as sitting-out until next hand
                        if (gameState.isHandInProgress) {
                            newSeats[targetSeat] = null;
                        } else {
                            newSeats[targetSeat] = null;
                        }
                        await supabase
                            .from('poker_tables')
                            .update({ game_state: { ...gameState, seats: newSeats } })
                            .eq('id', table.id);
                    }
                }
            }

            // NEW: If no seat found, but realCount < MAX_SEATS, there must be invalid indices blocking
            // OR if there's a "ghost" seat index in the DB that is null in gameState.seats
            if (targetSeat < 0) {
                for (let i = 0; i < MAX_SEATS; i++) {
                    const isOccupiedInDB = occupied.has(i);
                    const isOccupiedInGS = gs.seats[i] !== null;

                    // If DB says occupied but GS says empty, it's a ghost seat
                    if (isOccupiedInDB && !isOccupiedInGS) {
                        targetSeat = i;
                        // Clean up the ghost record
                        await supabase
                            .from('table_players')
                            .delete()
                            .eq('table_id', table.id)
                            .eq('seat_index', targetSeat);
                        break;
                    }
                }
            }

            // Still no seat? Clean up indices >= MAX_SEATS that might be polluting the count
            const overflowPlayers = (players || []).filter(p => p.seat_index >= MAX_SEATS);
            if (overflowPlayers.length > 0) {
                await supabase
                    .from('table_players')
                    .delete()
                    .eq('table_id', table.id)
                    .in('seat_index', overflowPlayers.map(p => p.seat_index));
            }

            if (targetSeat >= 0) {
                // Seat the real player
                await supabase.from('table_players').insert({
                    table_id: table.id,
                    seat_index: targetSeat,
                    player_type: 'real',
                    user_id: userUuid,
                    display_name: displayName,
                    avatar_url: avatarUrl,
                    chip_balance: chipBalance,
                });

                // Update game_state with new seat
                const { data: freshTable } = await supabase
                    .from('poker_tables')
                    .select('game_state')
                    .eq('id', table.id)
                    .single();

                const gs: PublicGameState = freshTable!.game_state;
                const newSeats = [...gs.seats];
                newSeats[targetSeat] = {
                    seatIndex: targetSeat,
                    playerType: 'real',
                    playerId: '', // will be set from DB
                    userId: clerkUserId,
                    displayName,
                    avatarUrl,
                    chipBalance,
                    bet: 0,
                    totalInvested: 0,
                    status: gs.isHandInProgress ? 'sitting-out' : 'waiting',
                };

                await supabase
                    .from('poker_tables')
                    .update({
                        game_state: { ...gs, seats: newSeats },
                        status: 'playing',
                    })
                    .eq('id', table.id);

                return {
                    tableId: table.id,
                    seatIndex: targetSeat,
                    tableNumber: table.table_number,
                    isNewTable: false,
                };
            }
        }
    }

    // No available table — create new one
    const activeCount = (tables || []).length;
    if (activeCount >= MAX_TABLES) {
        throw new Error('LOBBY_FULL');
    }

    // Find next available table number
    const usedNumbers = new Set((tables || []).map(t => t.table_number));
    let newTableNumber = 1;
    for (let i = 1; i <= MAX_TABLES; i++) {
        if (!usedNumbers.has(i)) { newTableNumber = i; break; }
    }

    const now = new Date();
    const fillDeadline = new Date(now.getTime() + FILL_DEADLINE_MS);
    const initialState = createEmptyGameState();

    // Create table
    const { data: newTable, error: tableError } = await supabase
        .from('poker_tables')
        .insert({
            table_number: newTableNumber,
            status: 'waiting',
            fill_deadline: fillDeadline.toISOString(),
            game_state: initialState,
        })
        .select()
        .single();

    if (tableError || !newTable) {
        throw new Error('Failed to create table: ' + (tableError?.message || 'unknown'));
    }

    // Seat the player at seat 0
    await supabase.from('table_players').insert({
        table_id: newTable.id,
        seat_index: 0,
        player_type: 'real',
        user_id: userUuid,
        display_name: displayName,
        avatar_url: avatarUrl,
        chip_balance: chipBalance,
    });

    // Update game_state with the player seat
    const seatedState: PublicGameState = {
        ...initialState,
        seats: initialState.seats.map((_, idx) => {
            if (idx === 0) {
                return {
                    seatIndex: 0,
                    playerType: 'real' as const,
                    playerId: '',
                    userId: clerkUserId,
                    displayName,
                    avatarUrl,
                    chipBalance,
                    bet: 0,
                    totalInvested: 0,
                    status: 'waiting' as const,
                };
            }
            return null;
        }),
    };

    await supabase
        .from('poker_tables')
        .update({ game_state: seatedState })
        .eq('id', newTable.id);

    return {
        tableId: newTable.id,
        seatIndex: 0,
        tableNumber: newTableNumber,
        isNewTable: true,
    };
}

// ========== FILL TABLE WITH AI ==========

export async function fillTableWithAI(tableId: string): Promise<PublicGameState | null> {
    const { data: table } = await supabase
        .from('poker_tables')
        .select('*')
        .eq('id', tableId)
        .single();

    if (!table) return null;

    // Check deadline
    if (table.fill_deadline && new Date(table.fill_deadline) > new Date()) {
        return table.game_state; // Not yet time to fill
    }

    const { data: existingPlayers } = await supabase
        .from('table_players')
        .select('seat_index')
        .eq('table_id', tableId);

    const occupied = new Set((existingPlayers || []).map(p => p.seat_index));
    if (occupied.size >= MAX_SEATS) return table.game_state; // Already full

    const gameState: PublicGameState = table.game_state;
    const newSeats = [...gameState.seats];
    const usedNames = new Set(
        newSeats.filter((s): s is PublicSeat => s !== null).map(s => s.displayName)
    );

    const availableNames = AI_NAMES.filter(n => !usedNames.has(n));
    let nameIdx = 0;

    for (let i = 0; i < MAX_SEATS; i++) {
        if (!occupied.has(i)) {
            const aiName = availableNames[nameIdx % availableNames.length] || `AI_${i}`;
            nameIdx++;
            const aiBalance = 2000 + Math.floor(Math.random() * 8000);

            await supabase.from('table_players').insert({
                table_id: tableId,
                seat_index: i,
                player_type: 'ai',
                display_name: aiName,
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(aiName)}&background=random`,
                chip_balance: aiBalance,
            });

            newSeats[i] = {
                seatIndex: i,
                playerType: 'ai',
                playerId: '',
                displayName: aiName,
                avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(aiName)}&background=random`,
                chipBalance: aiBalance,
                bet: 0,
                totalInvested: 0,
                status: 'waiting',
            };
        }
    }

    const updatedState: PublicGameState = {
        ...gameState,
        seats: newSeats,
    };

    await supabase
        .from('poker_tables')
        .update({
            game_state: updatedState,
            status: 'playing',
        })
        .eq('id', tableId);

    return updatedState;
}

// ========== REMOVE PLAYER ==========

export async function removePlayer(
    tableId: string,
    userUuid: string,
): Promise<void> {
    // Get player's seat info
    const { data: playerSeat } = await supabase
        .from('table_players')
        .select('seat_index, chip_balance')
        .eq('table_id', tableId)
        .eq('user_id', userUuid)
        .single();

    if (!playerSeat) return;

    // Commit balance back to user's main balance
    await supabase
        .from('balances')
        .update({ chip_balance: playerSeat.chip_balance })
        .eq('user_id', userUuid);

    // Remove from table_players
    await supabase
        .from('table_players')
        .delete()
        .eq('table_id', tableId)
        .eq('user_id', userUuid);

    // Update game_state
    const { data: table } = await supabase
        .from('poker_tables')
        .select('game_state')
        .eq('id', tableId)
        .single();

    if (table) {
        const gs: PublicGameState = table.game_state;
        const newSeats = [...gs.seats];
        newSeats[playerSeat.seat_index] = null;

        // Check if any real players remain
        const realPlayersRemain = newSeats.some(s => s !== null && s.playerType === 'real');

        if (!realPlayersRemain) {
            // Close the table
            await supabase
                .from('poker_tables')
                .update({ status: 'closed', game_state: { ...gs, seats: newSeats } })
                .eq('id', tableId);

            // Clean up all AI players
            await supabase
                .from('table_players')
                .delete()
                .eq('table_id', tableId);
        } else {
            await supabase
                .from('poker_tables')
                .update({ game_state: { ...gs, seats: newSeats } })
                .eq('id', tableId);
        }
    }
}

// ========== GET TABLE STATUS SUMMARY ==========

export async function getTableSummaries(): Promise<Array<{
    id: string;
    tableNumber: number;
    status: string;
    realPlayers: number;
    totalPlayers: number;
    stage: string;
    handCount: number;
}>> {
    const { data: tables } = await supabase
        .from('poker_tables')
        .select('*')
        .in('status', ['waiting', 'playing'])
        .order('table_number', { ascending: true });

    if (!tables) return [];

    const result = [];
    for (const table of tables) {
        const { data: players } = await supabase
            .from('table_players')
            .select('player_type')
            .eq('table_id', table.id);

        const realCount = (players || []).filter(p => p.player_type === 'real').length;
        const gs: PublicGameState = table.game_state;

        result.push({
            id: table.id,
            tableNumber: table.table_number,
            status: table.status,
            realPlayers: realCount,
            totalPlayers: (players || []).length,
            stage: gs.stage,
            handCount: gs.handCount,
        });
    }

    return result;
}
