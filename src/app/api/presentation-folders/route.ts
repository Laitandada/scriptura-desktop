import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const folders = await prisma.presentationFolder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        media: {
          orderBy: { order: 'asc' }
        }
      }
    });
    return NextResponse.json({ folders });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch presentation folders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const folder = await prisma.presentationFolder.create({
      data: { name },
      include: { media: true }
    });

    return NextResponse.json({ success: true, folder });
  } catch (error) {
    console.error('Create Folder Error:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
