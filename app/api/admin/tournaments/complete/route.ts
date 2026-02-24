import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';

const ADMIN_EMAIL = 'nbamoment@gmail.com';

export async function POST(req: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = clerkUser.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL);
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { tournamentId, winners } = await req.json() as {
        tournamentId: string;
        winners?: Array<{ userId: string; placement: number; prize: string }>;
    };

    if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 });

    // Update tournament status
    const { error: statusErr } = await supabase
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', tournamentId);

    if (statusErr) {
        return NextResponse.json({ error: 'Failed to complete tournament' }, { status: 500 });
    }

    // Update winner placements
    if (winners && Array.isArray(winners)) {
        for (const w of winners) {
            await supabase
                .from('tournament_entries')
                .update({ placement: w.placement, prize_won: w.prize })
                .eq('tournament_id', tournamentId)
                .eq('user_id', w.userId);
        }
    }

    return NextResponse.json({ success: true });
}
