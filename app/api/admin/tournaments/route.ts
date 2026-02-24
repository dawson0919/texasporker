import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';

const ADMIN_EMAIL = 'nbamoment@gmail.com';

async function checkAdmin() {
    const user = await currentUser();
    if (!user) return { admin: false, clerkUser: null };
    const isAdmin = user.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL);
    return { admin: isAdmin, clerkUser: user };
}

// GET: List ALL tournaments for admin (including completed/cancelled)
export async function GET() {
    const { admin } = await checkAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: tournaments } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_time', { ascending: false });

    // Get entry counts
    const { data: entries } = await supabase
        .from('tournament_entries').select('tournament_id');
    const counts: Record<string, number> = {};
    (entries || []).forEach(e => { counts[e.tournament_id] = (counts[e.tournament_id] || 0) + 1; });

    const result = (tournaments || []).map(t => ({ ...t, entry_count: counts[t.id] || 0 }));
    return NextResponse.json({ tournaments: result });
}

// POST: Create a new tournament
export async function POST(req: Request) {
    const { admin, clerkUser } = await checkAdmin();
    if (!admin || !clerkUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, start_time, max_players, buy_in, prize_1st, prize_2nd, prize_3rd } = body;

    if (!name || !start_time) {
        return NextResponse.json({ error: 'name and start_time are required' }, { status: 400 });
    }

    // Resolve admin UUID
    const { data: adminUser } = await supabase
        .from('users').select('id').eq('auth_id', clerkUser.id).single();

    const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
            name,
            start_time,
            max_players: max_players || 100,
            buy_in: buy_in || 0,
            prize_1st: prize_1st || null,
            prize_2nd: prize_2nd || null,
            prize_3rd: prize_3rd || null,
            created_by: adminUser?.id || null,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
    }

    return NextResponse.json({ tournament });
}
