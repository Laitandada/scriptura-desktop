import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PresentationStateData } from '@/store/presentationStore';

export async function GET() {
  try {
    const state = await prisma.currentState.findUnique({
      where: { id: 'singleton' },
    });

    if (!state) {
      return NextResponse.json({ type: 'clear' }, { status: 200 });
    }

    const presentationState: PresentationStateData = {
      type: state.type as any,
      scripture: state.reference && state.translation && state.text ? {
        reference: state.reference,
        translation: state.translation,
        text: state.text,
      } : undefined,
      background: state.backgroundType ? {
        type: state.backgroundType as any,
        url: state.backgroundUrl || undefined,
      } : undefined,
      settings: {
        fontSize: state.fontSize,
        overlayOpacity: state.overlayOpacity,
        showReference: state.showReference,
        alignment: (state.alignment as any) || 'center',
        fontWeight: (state.fontWeight as any) || 'bold',
        textShadow: (state.textShadow as any) || 'medium',
        textOutline: (state.textOutline as any) || 'none',
        outlineColor: state.outlineColor || '#000000',
        textColor: state.textColor || '#ffffff',
      }
    };

    return NextResponse.json(presentationState);
  } catch (error) {
    console.error('Error fetching current state:', error);
    return NextResponse.json({ error: 'Failed to fetch state' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: PresentationStateData = await req.json();

    const data = {
      type: body.type,
      reference: body.scripture?.reference || null,
      translation: body.scripture?.translation || null,
      text: body.scripture?.text || null,
      backgroundType: body.background?.type || null,
      backgroundUrl: body.background?.url || null,
      fontSize: body.settings.fontSize,
      overlayOpacity: body.settings.overlayOpacity,
      showReference: body.settings.showReference,
      alignment: body.settings.alignment || 'center',
      fontWeight: body.settings.fontWeight || 'bold',
      textShadow: body.settings.textShadow || 'medium',
      textOutline: body.settings.textOutline || 'none',
      outlineColor: body.settings.outlineColor || '#000000',
      textColor: body.settings.textColor || '#ffffff',
    };

    await prisma.currentState.upsert({
      where: { id: 'singleton' },
      update: data,
      create: {
        id: 'singleton',
        ...data
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating current state:', error);
    return NextResponse.json({ error: 'Failed to update state' }, { status: 500 });
  }
}
