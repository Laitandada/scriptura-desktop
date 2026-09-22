import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sessions = await prisma.presentationSession.findMany({
      where: { endTime: { not: null } },
      orderBy: { startTime: 'desc' },
      include: {
        events: {
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            type: true,
            reference: true,
            translation: true,
            text: true,
            backgroundType: true,
            backgroundUrl: true,
            timestamp: true,
          }
        },
        _count: {
          select: { events: true }
        }
      }
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch session history' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // Delete cascade will remove events too
    await prisma.presentationSession.delete({
      where: { id: sessionId }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
