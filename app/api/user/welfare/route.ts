import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

const FIRST_LOGIN_BONUS = 5000;

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: reward } = await supabase
        .from('user_rewards')
        .select('id')
        .eq('user_id', user.id)
        .eq('reward_type', 'first_login_bonus')
        .single();

    return NextResponse.json({
        firstLoginBonus: {
            claimed: !!reward,
            amount: FIRST_LOGIN_BONUS,
        },
    });
}

export async function POST() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Check if already claimed
    const { data: existing } = await supabase
        .from('user_rewards')
        .select('id')
        .eq('user_id', user.id)
        .eq('reward_type', 'first_login_bonus')
        .single();

    if (existing) {
        return NextResponse.json({ error: '已領取過首次登入獎勵' }, { status: 400 });
    }

    // Claim: insert reward record
    const { error: insertError } = await supabase
        .from('user_rewards')
        .insert({
            user_id: user.id,
            reward_type: 'first_login_bonus',
            amount: FIRST_LOGIN_BONUS,
        });

    if (insertError) {
        return NextResponse.json({ error: '領取失敗' }, { status: 500 });
    }

    // Update balance
    const { data: balance } = await supabase
        .from('balances')
        .select('chip_balance')
        .eq('user_id', user.id)
        .single();

    const newBalance = Number(balance?.chip_balance || 0) + FIRST_LOGIN_BONUS;
    await supabase
        .from('balances')
        .update({ chip_balance: newBalance })
        .eq('user_id', user.id);

    return NextResponse.json({ success: true, amount: FIRST_LOGIN_BONUS, newBalance });
}
