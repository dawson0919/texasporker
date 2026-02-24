import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = clerkUser.id;

    // Get user's UUID from public.users using auth_id
    let { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    // FALLBACK: Auto-provision user if they do not exist (useful for localhost ignoring webhooks)
    if (userError || !user) {
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || 'unknown@example.com';
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username || 'Player';
        const avatarUrl = clerkUser.imageUrl || null;

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{ auth_id: userId, email, name, avatar_url: avatarUrl }])
            .select('id')
            .single();

        if (insertError || !newUser) {
            return NextResponse.json({ error: 'User not found and could not auto-provision in DB' }, { status: 404 });
        }

        // Give $10,000 starting cash
        await supabase.from('balances').insert([{ user_id: newUser.id, chip_balance: 10000 }]);
        user = newUser;
    }

    // Sync Clerk profile data to Supabase (fixes stale "Player" / "user@example.com")
    const clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
    const clerkName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username;
    if (clerkEmail || clerkName || clerkUser.imageUrl) {
        const updates: Record<string, string> = {};
        if (clerkEmail) updates.email = clerkEmail;
        if (clerkName) updates.name = clerkName;
        if (clerkUser.imageUrl) updates.avatar_url = clerkUser.imageUrl;
        await supabase.from('users').update(updates).eq('auth_id', userId);
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
    const postUser = await currentUser();
    if (!postUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = postUser.id;

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
