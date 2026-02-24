import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

const REWARD_AMOUNT = 10000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user UUID
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    if (userError || !user) return NextResponse.json({ error: 'User not found in DB' }, { status: 404 });

    // Get last refill time
    const { data: balance, error: balanceError } = await supabase
        .from('balances')
        .select('last_refill_time')
        .eq('user_id', user.id)
        .single();

    if (balanceError || !balance) return NextResponse.json({ error: 'Balance not found' }, { status: 404 });

    const lastRefill = new Date(balance.last_refill_time).getTime();
    const now = Date.now();
    const timeSinceLastRefill = now - lastRefill;

    if (timeSinceLastRefill >= COOLDOWN_MS) {
        return NextResponse.json({ canClaim: true, timeRemainingMs: 0 });
    } else {
        return NextResponse.json({
            canClaim: false,
            timeRemainingMs: COOLDOWN_MS - timeSinceLastRefill
        });
    }
}

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user UUID
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    if (userError || !user) return NextResponse.json({ error: 'User not found in DB' }, { status: 404 });

    // Lock the row or just optimistic check
    const { data: balance, error: balanceError } = await supabase
        .from('balances')
        .select('chip_balance, last_refill_time')
        .eq('user_id', user.id)
        .single();

    if (balanceError || !balance) return NextResponse.json({ error: 'Balance not found' }, { status: 404 });

    const lastRefill = new Date(balance.last_refill_time).getTime();
    const now = Date.now();

    if (now - lastRefill < COOLDOWN_MS) {
        return NextResponse.json({ error: 'Cooldown active', timeRemainingMs: COOLDOWN_MS - (now - lastRefill) }, { status: 400 });
    }

    // Update balance and refill time
    const newBalance = Number(balance.chip_balance) + REWARD_AMOUNT;
    const { error: updateError } = await supabase
        .from('balances')
        .update({
            chip_balance: newBalance,
            last_refill_time: new Date().toISOString()
        })
        .eq('user_id', user.id);

    if (updateError) return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 });

    return NextResponse.json({ success: true, newBalance, rewardAmount: REWARD_AMOUNT });
}
