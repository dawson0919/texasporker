import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

const STREAK_REWARDS = [
    { day: 1, amount: 1000 },
    { day: 2, amount: 2000 },
    { day: 3, amount: 3000 },
    { day: 4, amount: 5000 },
    { day: 5, amount: 8000 },
    { day: 6, amount: 12000 },
    { day: 7, amount: 20000 },
];

function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

function getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const today = getToday();
    const yesterday = getYesterday();

    // Get or create login streak
    let { data: streak } = await supabase
        .from('login_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (!streak) {
        // First time: create streak record
        const { data: newStreak, error } = await supabase
            .from('login_streaks')
            .insert({
                user_id: user.id,
                current_streak: 1,
                last_login_date: today,
                cycle_claimed_days: [],
                total_login_days: 1,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: 'Failed to init streak' }, { status: 500 });
        streak = newStreak;
    } else {
        const lastDate = streak.last_login_date;

        if (lastDate === today) {
            // Already logged in today — no update needed
        } else if (lastDate === yesterday) {
            // Consecutive day
            const newStreak = streak.current_streak + 1;
            const { error } = await supabase
                .from('login_streaks')
                .update({
                    current_streak: newStreak,
                    last_login_date: today,
                    total_login_days: streak.total_login_days + 1,
                })
                .eq('user_id', user.id);

            if (!error) {
                streak.current_streak = newStreak;
                streak.last_login_date = today;
                streak.total_login_days += 1;
            }
        } else {
            // Streak broken — reset
            const { error } = await supabase
                .from('login_streaks')
                .update({
                    current_streak: 1,
                    last_login_date: today,
                    cycle_claimed_days: [],
                    total_login_days: streak.total_login_days + 1,
                })
                .eq('user_id', user.id);

            if (!error) {
                streak.current_streak = 1;
                streak.last_login_date = today;
                streak.cycle_claimed_days = [];
                streak.total_login_days += 1;
            }
        }
    }

    const cycleDay = ((streak.current_streak - 1) % 7) + 1;
    const claimed: number[] = streak.cycle_claimed_days || [];

    const rewards = STREAK_REWARDS.map((r) => ({
        day: r.day,
        amount: r.amount,
        claimed: claimed.includes(r.day),
        available: cycleDay >= r.day && !claimed.includes(r.day),
    }));

    return NextResponse.json({
        currentStreak: streak.current_streak,
        cycleDay,
        cycleClaimed: claimed,
        rewards,
        totalLoginDays: streak.total_login_days,
    });
}

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { day } = await request.json();
    if (!day || day < 1 || day > 7) {
        return NextResponse.json({ error: 'Invalid day' }, { status: 400 });
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .single();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get streak
    const { data: streak } = await supabase
        .from('login_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (!streak) return NextResponse.json({ error: 'No streak data' }, { status: 404 });

    const cycleDay = ((streak.current_streak - 1) % 7) + 1;
    const claimed: number[] = streak.cycle_claimed_days || [];

    // Validate eligibility
    if (cycleDay < day) {
        return NextResponse.json({ error: '尚未達到該天數' }, { status: 400 });
    }
    if (claimed.includes(day)) {
        return NextResponse.json({ error: '已領取過該天獎勵' }, { status: 400 });
    }

    const reward = STREAK_REWARDS.find((r) => r.day === day);
    if (!reward) return NextResponse.json({ error: 'Invalid day' }, { status: 400 });

    // Update balance
    const { data: balance } = await supabase
        .from('balances')
        .select('chip_balance')
        .eq('user_id', user.id)
        .single();

    const newBalance = Number(balance?.chip_balance || 0) + reward.amount;
    await supabase
        .from('balances')
        .update({ chip_balance: newBalance })
        .eq('user_id', user.id);

    // Update claimed days
    const newClaimed = [...claimed, day];
    const resetCycle = newClaimed.length === 7;

    await supabase
        .from('login_streaks')
        .update({
            cycle_claimed_days: resetCycle ? [] : newClaimed,
        })
        .eq('user_id', user.id);

    return NextResponse.json({
        success: true,
        amount: reward.amount,
        newBalance,
        cycleReset: resetCycle,
    });
}
