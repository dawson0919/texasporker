import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { currentUser } from '@clerk/nextjs/server';

// Profit-based title tiers
function getProfitTitle(totalProfit: number, isTopPlayer: boolean): { title: string; vip: string } {
    if (isTopPlayer && totalProfit > 0) return { title: '賭王', vip: '至尊賭神' };
    if (totalProfit >= 1000000) return { title: '撲克大師', vip: '鑽石龍' };
    if (totalProfit >= 500000) return { title: '賭場名流', vip: '白金虎' };
    if (totalProfit >= 200000) return { title: '撲克高手', vip: '黃金鳳' };
    if (totalProfit >= 50000) return { title: '牌桌常客', vip: '白銀獅' };
    if (totalProfit >= 10000) return { title: '撲克新秀', vip: '青銅鷹' };
    if (totalProfit > 0) return { title: '初出茅廬', vip: '新手' };
    return { title: '新手玩家', vip: '無段位' };
}

export async function GET() {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = clerkUser.id;

    // Get user UUID
    let { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('auth_id', userId)
        .single();

    if (userError || !user) {
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || 'unknown@example.com';
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username || 'Player';

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{ auth_id: userId, email, name, avatar_url: clerkUser.imageUrl }])
            .select('id, name')
            .single();
        if (insertError || !newUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        await supabase.from('balances').insert([{ user_id: newUser.id, chip_balance: 10000 }]);
        user = newUser;
    }

    // Get current user's total profit
    const { data: userHistory } = await supabase
        .from('game_history')
        .select('profit_loss')
        .eq('user_id', user.id);

    const myTotalProfit = (userHistory || []).reduce((sum, r) => sum + (r.profit_loss || 0), 0);
    const myTotalHands = (userHistory || []).length;

    // Get ALL users' total profits to determine ranking
    const { data: allHistory } = await supabase
        .from('game_history')
        .select('user_id, profit_loss');

    const profitByUser: Record<string, number> = {};
    (allHistory || []).forEach(r => {
        profitByUser[r.user_id] = (profitByUser[r.user_id] || 0) + (r.profit_loss || 0);
    });

    // Sort to find top player
    const sorted = Object.entries(profitByUser).sort((a, b) => b[1] - a[1]);
    const topPlayerId = sorted.length > 0 ? sorted[0][0] : null;
    const isTopPlayer = topPlayerId === user.id;

    const { title, vip } = getProfitTitle(myTotalProfit, isTopPlayer);

    // Get top 3 winners with names
    const top3Ids = sorted.slice(0, 3).map(([id]) => id);
    let topWinners: { name: string; profit: number }[] = [];

    if (top3Ids.length > 0) {
        const { data: topUsers } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', top3Ids);

        topWinners = sorted.slice(0, 3).map(([uid, profit]) => {
            const u = (topUsers || []).find(tu => tu.id === uid);
            const displayName = u?.name || u?.email?.split('@')[0] || 'Unknown';
            return { name: displayName, profit };
        });
    }

    return NextResponse.json({
        totalProfit: myTotalProfit,
        totalHands: myTotalHands,
        title,
        vip,
        isTopPlayer,
        topWinners,
    });
}
