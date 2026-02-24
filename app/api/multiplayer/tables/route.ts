import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getTableSummaries } from '@/utils/tableManager';

export async function GET() {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tables = await getTableSummaries();
    return NextResponse.json({ tables });
}
