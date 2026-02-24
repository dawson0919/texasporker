import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user UUID
    let { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    // FALLBACK: Auto-provision user
    if (userError || !user) {
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{ auth_id: userId, email: 'user@example.com', name: 'Player' }])
            .select('id')
            .single();

        if (insertError || !newUser) return NextResponse.json({ error: 'User not found in DB' }, { status: 404 });
        await supabase.from('balances').insert([{ user_id: newUser.id, chip_balance: 10000 }]);
        user = newUser;
    }

    // Get history
    const { data: history, error: historyError } = await supabase
        .from('game_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (historyError) return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });

    return NextResponse.json({ history });
}

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { gameType, stake, profitLoss, stageReached } = body;

    // Validate payload
    if (!gameType || !stake || typeof profitLoss !== 'number' || !stageReached) {
        return NextResponse.json({ error: 'Invalid history payload' }, { status: 400 });
    }

    // Get user UUID
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    if (userError || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Insert history
    const { data: inserted, error: insertError } = await supabase
        .from('game_history')
        .insert([{
            user_id: user.id,
            game_type: gameType,
            stake,
            profit_loss: profitLoss,
            stage_reached: stageReached
        }])
        .select()
        .single();

    if (insertError) return NextResponse.json({ error: 'Failed to record history' }, { status: 500 });

    return NextResponse.json({ success: true, record: inserted });
}
