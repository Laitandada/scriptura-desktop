import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const translations = await prisma.bibleTranslation.findMany({
      orderBy: { abbreviation: 'asc' }
    });
    return NextResponse.json({ translations });
  } catch (error) {
    console.error('Failed to fetch translations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
