import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's UUID from public.users using auth_id
    let { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    // FALLBACK: Auto-provision user if they do not exist (useful for localhost ignoring webhooks)
    if (userError || !user) {
        // Attempt to create user
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{ auth_id: userId, email: 'user@example.com', name: 'Player' }])
            .select('id')
            .single();

        if (insertError || !newUser) {
            return NextResponse.json({ error: 'User not found and could not auto-provision in DB' }, { status: 404 });
        }

        // Give $10,000 starting cash
        await supabase.from('balances').insert([{ user_id: newUser.id, chip_balance: 10000 }]);
        user = newUser;
    }

    // Get balance
    const { data: balance, error: balanceError } = await supabase
        .from('balances')
        .select('chip_balance')
        .eq('user_id', user!.id)
        .single();

    if (balanceError || !balance) {
        return NextResponse.json({ error: 'Balance not found' }, { status: 404 });
    }

    return NextResponse.json({ balance: balance.chip_balance });
}

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { newBalance } = body;

    if (typeof newBalance !== 'number') {
        return NextResponse.json({ error: 'Invalid balance payload' }, { status: 400 });
    }

    // Get user's UUID
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    if (userError || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Update balance
    const { error: updateError } = await supabase
        .from('balances')
        .update({ chip_balance: newBalance })
        .eq('user_id', user.id);

    if (updateError) return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });

    return NextResponse.json({ success: true, balance: newBalance });
}
