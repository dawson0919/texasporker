import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';

export async function GET() {
    // Fetch active tournaments (upcoming, registering, in_progress)
    const { data: tournaments, error } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['upcoming', 'registering', 'in_progress'])
        .order('start_time', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
    }

    // Get entry counts per tournament
    const ids = (tournaments || []).map(t => t.id);
    const entryCounts: Record<string, number> = {};

    if (ids.length > 0) {
        const { data: entries } = await supabase
            .from('tournament_entries')
            .select('tournament_id')
            .in('tournament_id', ids);

        (entries || []).forEach(e => {
            entryCounts[e.tournament_id] = (entryCounts[e.tournament_id] || 0) + 1;
        });
    }

    const result = (tournaments || []).map(t => ({
        ...t,
        entry_count: entryCounts[t.id] || 0,
    }));

    return NextResponse.json({ tournaments: result });
}
