import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PresentationStateData } from '@/store/presentationStore';

export async function POST(req: Request) {
  try {
    const body: { state: PresentationStateData, sessionId?: string } = await req.json();
    const { state, sessionId } = body;

    const data = {
      type: state.type,
      reference: state.scripture?.reference || null,
      translation: state.scripture?.translation || null,
      text: state.scripture?.text || null,
      backgroundType: state.background?.type || null,
      backgroundUrl: state.background?.url || null,
      fontSize: state.settings.fontSize,
      overlayOpacity: state.settings.overlayOpacity,
      showReference: state.settings.showReference,
      alignment: state.settings.alignment || 'center',
      fontWeight: state.settings.fontWeight || 'bold',
      textShadow: state.settings.textShadow || 'medium',
      textOutline: state.settings.textOutline || 'none',
      outlineColor: state.settings.outlineColor || '#000000',
      textColor: state.settings.textColor || '#ffffff',
    };

    // Use Prisma transaction to atomically update state and log history
    await prisma.$transaction(async (tx) => {
      // 1. Update CurrentState
      await tx.currentState.upsert({
        where: { id: 'singleton' },
        update: data,
        create: {
          id: 'singleton',
          ...data
        },
      });

      // 2. Log History if session exists and we are projecting a scripture
      // We also log "black" and "clear" so the operator knows when the screen was cleared
      if (sessionId) {
        await tx.projectionEvent.create({
          data: {
            sessionId: sessionId,
            type: state.type,
            reference: state.scripture?.reference || null,
            translation: state.scripture?.translation || null,
            text: state.scripture?.text || null,
            backgroundType: state.background?.type || null,
            backgroundUrl: state.background?.url || null,
            fontSize: state.settings.fontSize,
            overlayOpacity: state.settings.overlayOpacity,
            showReference: state.settings.showReference,
            alignment: state.settings.alignment || 'center',
            fontWeight: state.settings.fontWeight || 'bold',
            textShadow: state.settings.textShadow || 'medium',
            textOutline: state.settings.textOutline || 'none',
            outlineColor: state.settings.outlineColor || '#000000',
            textColor: state.settings.textColor || '#ffffff',
          }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error projecting and saving history:', error);
    return NextResponse.json({ error: 'Failed to project' }, { status: 500 });
  }
}
