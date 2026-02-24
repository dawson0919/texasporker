import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { fillTableWithAI } from '@/utils/tableManager';

export async function POST(req: Request) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tableId } = await req.json() as { tableId: string };
    if (!tableId) return NextResponse.json({ error: 'Missing tableId' }, { status: 400 });

    const updatedState = await fillTableWithAI(tableId);
    if (!updatedState) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    return NextResponse.json({ state: updatedState });
}
