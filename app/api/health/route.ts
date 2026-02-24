import { NextResponse } from 'next/server';

export async function GET() {
    const envCheck = {
        CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };

    const allSet = Object.values(envCheck).every(Boolean);

    return NextResponse.json({
        status: allSet ? 'ok' : 'missing_env',
        env: envCheck,
    }, { status: 200 });
}
