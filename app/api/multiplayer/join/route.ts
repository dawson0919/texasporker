import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';
import { assignSeat } from '@/utils/tableManager';

export async function POST() {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve Clerk user to Supabase UUID
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', clerkUser.id)
        .single();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get balance
    const { data: balance } = await supabase
        .from('balances')
        .select('chip_balance')
        .eq('user_id', user.id)
        .single();

    const chipBalance = balance?.chip_balance ?? 10000;
    const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
        || clerkUser.username || '玩家';
    const avatarUrl = clerkUser.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;

    try {
        const result = await assignSeat(user.id, clerkUser.id, displayName, avatarUrl, chipBalance);

        // Fetch fresh game state
        const { data: table } = await supabase
            .from('poker_tables')
            .select('game_state, fill_deadline, table_number')
            .eq('id', result.tableId)
            .single();

        return NextResponse.json({
            tableId: result.tableId,
            seatIndex: result.seatIndex,
            tableNumber: table?.table_number ?? result.tableNumber,
            fillDeadline: table?.fill_deadline,
            initialState: table?.game_state,
        });
    } catch (err: any) {
        if (err.message === 'LOBBY_FULL') {
            return NextResponse.json({ error: '所有牌桌已滿，請稍後再試' }, { status: 503 });
        }
        console.error('Join error:', err);
        return NextResponse.json({ error: 'Failed to join' }, { status: 500 });
    }
}
