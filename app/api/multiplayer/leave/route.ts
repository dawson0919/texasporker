import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { supabase } from '@/utils/supabase/server';
import { removePlayer } from '@/utils/tableManager';

export async function POST(req: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tableId } = await req.json() as { tableId: string };
    if (!tableId) return NextResponse.json({ error: 'Missing tableId' }, { status: 400 });

    // Get user UUID
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', clerkUser.id)
        .single();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await removePlayer(tableId, user.id);

    return NextResponse.json({ success: true });
}
