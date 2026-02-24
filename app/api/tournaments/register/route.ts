import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';

export async function POST(req: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tournamentId } = await req.json() as { tournamentId: string };
    if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

    // Resolve Clerk ID → Supabase UUID
    const { data: user } = await supabase
        .from('users').select('id').eq('auth_id', clerkUser.id).single();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Fetch tournament
    const { data: tournament } = await supabase
        .from('tournaments').select('*').eq('id', tournamentId).single();
    if (!tournament) return NextResponse.json({ error: '錦標賽不存在' }, { status: 404 });
    if (tournament.status !== 'upcoming' && tournament.status !== 'registering') {
        return NextResponse.json({ error: '該錦標賽不接受報名' }, { status: 400 });
    }

    // Check if already registered
    const { data: existing } = await supabase
        .from('tournament_entries')
        .select('id').eq('tournament_id', tournamentId).eq('user_id', user.id).single();
    if (existing) {
        return NextResponse.json({ error: '您已報名此錦標賽' }, { status: 409 });
    }

    // Check entry count vs max_players
    const { count } = await supabase
        .from('tournament_entries')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId);
    if ((count || 0) >= tournament.max_players) {
        return NextResponse.json({ error: '報名已滿' }, { status: 400 });
    }

    // Check balance
    const { data: balance } = await supabase
        .from('balances').select('chip_balance').eq('user_id', user.id).single();
    if (!balance || balance.chip_balance < tournament.buy_in) {
        return NextResponse.json({ error: '籌碼不足' }, { status: 400 });
    }

    // Deduct buy_in
    if (tournament.buy_in > 0) {
        const newBalance = balance.chip_balance - tournament.buy_in;
        const { error: updateErr } = await supabase
            .from('balances').update({ chip_balance: newBalance }).eq('user_id', user.id);
        if (updateErr) {
            return NextResponse.json({ error: '扣款失敗' }, { status: 500 });
        }
    }

    // Insert entry
    const { error: entryErr } = await supabase
        .from('tournament_entries')
        .insert({ tournament_id: tournamentId, user_id: user.id });
    if (entryErr) {
        // Rollback balance if buy_in was deducted
        if (tournament.buy_in > 0) {
            await supabase.from('balances').update({ chip_balance: balance.chip_balance }).eq('user_id', user.id);
        }
        return NextResponse.json({ error: '報名失敗' }, { status: 500 });
    }

    const newBalance = balance.chip_balance - tournament.buy_in;
    return NextResponse.json({ success: true, newBalance });
}
