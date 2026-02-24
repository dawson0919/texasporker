import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';

export async function GET(req: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tableId = new URL(req.url).searchParams.get('tableId');
    if (!tableId) return NextResponse.json({ error: 'Missing tableId' }, { status: 400 });

    // Get user UUID
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', clerkUser.id)
        .single();

    if (!user) return NextResponse.json({ holeCards: null });

    const { data: seat } = await supabase
        .from('table_players')
        .select('seat_index, hole_cards')
        .eq('table_id', tableId)
        .eq('user_id', user.id)
        .single();

    if (!seat) return NextResponse.json({ holeCards: null });

    return NextResponse.json({
        seatIndex: seat.seat_index,
        holeCards: seat.hole_cards,
    });
}
