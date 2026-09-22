import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Find the media record
    const media = await prisma.media.findUnique({
      where: { id }
    });
    
    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Attempt to delete from Cloudflare R2
    try {
      // The path is the full URL, e.g. https://pub-xxxx.r2.dev/uuid.jpg
      // We need just the 'uuid.jpg' key.
      const urlParts = media.path.split('/');
      const key = urlParts[urlParts.length - 1];
      
      if (key) {
        const command = new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
        });
        await s3.send(command);
      }
    } catch (r2Error) {
      console.error('Failed to delete from R2 (ignoring):', r2Error);
    }

    // Delete from Database
    await prisma.media.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Media Error:', error);
    return NextResponse.json({ error: 'Failed to delete media record' }, { status: 500 });
  }
}
