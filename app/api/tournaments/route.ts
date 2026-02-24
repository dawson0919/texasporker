import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';

// Auto-ensure there's always a next "假日錦標賽" every Saturday 9:00 AM (Asia/Taipei = UTC+8)
async function ensureWeeklyTournament() {
    const now = new Date();

    // Find the next Saturday 9:00 AM in UTC+8
    // Saturday = day 6
    const taipeiOffset = 8 * 60 * 60 * 1000;
    const taipeiNow = new Date(now.getTime() + taipeiOffset);
    const dayOfWeek = taipeiNow.getUTCDay(); // 0=Sun ... 6=Sat
    let daysUntilSat = (6 - dayOfWeek + 7) % 7;
    // If today is Saturday but past 9AM Taipei time, schedule next week
    if (daysUntilSat === 0) {
        const taipeiHour = taipeiNow.getUTCHours();
        if (taipeiHour >= 9) daysUntilSat = 7;
    }

    const nextSat = new Date(taipeiNow);
    nextSat.setUTCDate(nextSat.getUTCDate() + daysUntilSat);
    nextSat.setUTCHours(9, 0, 0, 0);
    // Convert back to UTC
    const nextSatUTC = new Date(nextSat.getTime() - taipeiOffset);

    // Check if a tournament already exists for that time window (same day)
    const startOfDay = new Date(nextSatUTC);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(nextSatUTC);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const { data: existing } = await supabase
        .from('tournaments')
        .select('id')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .in('status', ['upcoming', 'registering', 'in_progress'])
        .limit(1);

    if (existing && existing.length > 0) return; // Already exists

    // Auto-create the weekly tournament
    await supabase.from('tournaments').insert({
        name: '假日錦標賽',
        status: 'upcoming',
        max_players: 100,
        buy_in: 0,
        prize_1st: '100,000 籌碼',
        prize_2nd: '50,000 籌碼',
        prize_3rd: '20,000 籌碼',
        start_time: nextSatUTC.toISOString(),
    });
}

export async function GET() {
    // Auto-create weekly tournament if needed
    await ensureWeeklyTournament();

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
