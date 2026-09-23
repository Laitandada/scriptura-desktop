import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get the active session (one that hasn't ended)
    const activeSession = await prisma.presentationSession.findFirst({
      where: { endTime: null },
      orderBy: { startTime: 'desc' }
    });

    return NextResponse.json({ activeSession });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, name } = await req.json();

    if (action === 'start') {
      // Close any open sessions first
      await prisma.presentationSession.updateMany({
        where: { endTime: null },
        data: { endTime: new Date() }
      });

      const session = await prisma.presentationSession.create({
        data: { name: name || 'New Service' }
      });
      return NextResponse.json({ session });
    } 
    
    if (action === 'end') {
      const activeSession = await prisma.presentationSession.findFirst({
        where: { endTime: null },
        orderBy: { startTime: 'desc' }
      });

      if (activeSession) {
        const session = await prisma.presentationSession.update({
          where: { id: activeSession.id },
          data: { endTime: new Date() }
        });
        return NextResponse.json({ session });
      }
      return NextResponse.json({ error: 'No active session found. Please start a service or projection first.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid session action.' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Unable to manage session. Please start a projection or check database connection.' }, { status: 500 });
  }
}

