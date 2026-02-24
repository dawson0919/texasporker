import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';
import { currentUser } from '@clerk/nextjs/server';

// 10 preset avatars
const PRESET_AVATARS = [
    '/avatars/avatar-1.svg',
    '/avatars/avatar-2.svg',
    '/avatars/avatar-3.svg',
    '/avatars/avatar-4.svg',
    '/avatars/avatar-5.svg',
    '/avatars/avatar-6.svg',
    '/avatars/avatar-7.svg',
    '/avatars/avatar-8.svg',
    '/avatars/avatar-9.svg',
    '/avatars/avatar-10.svg',
];

// GET: Return current user's profile
export async function GET() {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: user } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .eq('auth_id', clerkUser.id)
        .single();

    return NextResponse.json({
        name: user?.name || clerkUser.firstName || 'Player',
        email: user?.email || clerkUser.emailAddresses?.[0]?.emailAddress,
        avatarUrl: user?.avatar_url || clerkUser.imageUrl,
        clerkImageUrl: clerkUser.imageUrl,
        presetAvatars: PRESET_AVATARS,
    });
}

// POST: Update name and/or avatar
export async function POST(request: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, avatarUrl } = body;

    const updates: Record<string, string> = {};
    if (typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 20) {
        updates.name = name.trim();
    }
    if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
        updates.avatar_url = avatarUrl;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('auth_id', clerkUser.id);

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    return NextResponse.json({ success: true, ...updates });
}
