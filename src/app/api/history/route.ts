import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ events: [] });
    }

    const events = await prisma.projectionEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      include: { media: true }
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
