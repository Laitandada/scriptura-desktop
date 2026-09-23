import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const media = await prisma.media.findMany({
      orderBy: { createdAt: 'desc' },
      include: { folder: true }
    });
    return NextResponse.json({ media });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { filename, type, publicUrl, folderId } = body;

    if (!filename || !type || !publicUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'IMAGE' && type !== 'VIDEO') {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Determine order if in a folder
    let order = 0;
    if (folderId) {
      const lastMedia = await prisma.media.findFirst({
        where: { folderId },
        orderBy: { order: 'desc' }
      });
      if (lastMedia) {
        order = lastMedia.order + 1;
      }
    }

    // Save to database
    const mediaRecord = await prisma.media.create({
      data: {
        filename,
        type,
        path: publicUrl, // Save the R2 public URL directly
        folderId: folderId || null,
        order
      }
    });

    return NextResponse.json({ success: true, media: mediaRecord });
  } catch (error) {
    console.error('Save Media Record Error:', error);
    return NextResponse.json({ error: 'Failed to save media record' }, { status: 500 });
  }
}
