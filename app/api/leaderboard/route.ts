import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { currentUser } from '@clerk/nextjs/server';

// Profit-based VIP tier
function getVipTier(profit: number): string {
    if (profit >= 1000000) return '鑽石 VIP';
    if (profit >= 500000) return '白金 VIP';
    if (profit >= 200000) return '黃金 VIP';
    if (profit >= 50000) return '白銀 VIP';
    if (profit >= 10000) return '青銅 VIP';
    return '普通';
}

export async function GET(request: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'global'; // global | weekly

    // Get all game history
    let query = supabase.from('game_history').select('user_id, profit_loss, created_at');

    // Weekly: only last 7 days
    if (mode === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('created_at', weekAgo.toISOString());
    }

    const { data: allHistory } = await query;

    // Aggregate profit by user
    const profitByUser: Record<string, { profit: number; games: number }> = {};
    (allHistory || []).forEach(r => {
        if (!profitByUser[r.user_id]) profitByUser[r.user_id] = { profit: 0, games: 0 };
        profitByUser[r.user_id].profit += r.profit_loss || 0;
        profitByUser[r.user_id].games += 1;
    });

    // Sort by profit descending
    const sorted = Object.entries(profitByUser)
        .sort((a, b) => b[1].profit - a[1].profit);

    // Get all user IDs to fetch names/avatars
    const userIds = sorted.map(([id]) => id);

    let usersMap: Record<string, { name: string; email: string; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
        const { data: users } = await supabase
            .from('users')
            .select('id, name, email, avatar_url')
            .in('id', userIds);

        (users || []).forEach(u => {
            usersMap[u.id] = { name: u.name, email: u.email, avatar_url: u.avatar_url };
        });
    }

    // Build ranked list
    const leaderboard = sorted.map(([userId, stats], idx) => {
        const u = usersMap[userId];
        const displayName = u?.name || u?.email?.split('@')[0] || 'Unknown';
        return {
            rank: idx + 1,
            userId,
            name: displayName,
            avatarUrl: u?.avatar_url || null,
            profit: stats.profit,
            games: stats.games,
            vip: getVipTier(stats.profit),
        };
    });

    // Find current user's rank
    const { data: myUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', clerkUser.id)
        .single();

    let myRank = 0;
    let myProfit = 0;
    let myGames = 0;
    if (myUser) {
        const idx = leaderboard.findIndex(e => e.userId === myUser.id);
        if (idx >= 0) {
            myRank = idx + 1;
            myProfit = leaderboard[idx].profit;
            myGames = leaderboard[idx].games;
        }
    }

    return NextResponse.json({
        leaderboard,
        me: {
            rank: myRank,
            profit: myProfit,
            games: myGames,
            vip: getVipTier(myProfit),
        },
        totalPlayers: leaderboard.length,
    });
}
