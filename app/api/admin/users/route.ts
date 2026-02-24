import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { currentUser } from '@clerk/nextjs/server';

const ADMIN_EMAIL = 'nbamoment@gmail.com';

async function isAdmin() {
    const user = await currentUser();
    if (!user) return false;
    return user.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL);
}

// GET: List all users with balances
export async function GET() {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: users, error } = await supabase
        .from('users')
        .select('id, auth_id, email, name, avatar_url, created_at');

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Fetch balances for all users
    const { data: balances } = await supabase
        .from('balances')
        .select('user_id, chip_balance, last_refill_time');

    const balanceMap: Record<string, { chip_balance: number; last_refill_time: string | null }> = {};
    (balances || []).forEach(b => {
        balanceMap[b.user_id] = { chip_balance: b.chip_balance, last_refill_time: b.last_refill_time };
    });

    const enrichedUsers = (users || []).map(u => ({
        ...u,
        chip_balance: balanceMap[u.id]?.chip_balance ?? 0,
        last_refill_time: balanceMap[u.id]?.last_refill_time ?? null,
    }));

    return NextResponse.json({ users: enrichedUsers });
}

// POST: Update a user's balance
export async function POST(request: Request) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, amount, action } = body;

    if (!userId || typeof amount !== 'number') {
        return NextResponse.json({ error: 'Missing userId or amount' }, { status: 400 });
    }

    // Get current balance
    const { data: balance, error: balError } = await supabase
        .from('balances')
        .select('chip_balance')
        .eq('user_id', userId)
        .single();

    if (balError || !balance) {
        return NextResponse.json({ error: 'User balance not found' }, { status: 404 });
    }

    let newBalance: number;
    if (action === 'set') {
        newBalance = amount;
    } else {
        // Default: add
        newBalance = balance.chip_balance + amount;
    }
    newBalance = Math.max(0, newBalance);

    const { error: updateError } = await supabase
        .from('balances')
        .update({ chip_balance: newBalance })
        .eq('user_id', userId);

    if (updateError) {
        return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId, newBalance });
}
