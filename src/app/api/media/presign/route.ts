import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Filename and contentType are required' }, { status: 400 });
    }

    // MIME type validation
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      return NextResponse.json({ error: 'Invalid file type. Only images and videos are allowed.' }, { status: 400 });
    }

    const ext = filename.split('.').pop() || '';
    if (!/^[a-zA-Z0-9]+$/.test(ext)) {
      return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 });
    }

    const uuid = randomUUID();
    const safeFilename = `${uuid}.${ext.toLowerCase()}`;
    const bucketName = process.env.R2_BUCKET_NAME!;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: safeFilename,
      ContentType: contentType,
    });

    // The presigned URL expires in 15 minutes
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // Assuming the user has a public R2 domain or configured a custom domain
    // If NEXT_PUBLIC_R2_PUBLIC_URL is not set, we default to the bucket endpoint, though that may not be publicly readable without a custom domain.
    const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || `${process.env.R2_ENDPOINT}/${bucketName}`;
    const publicUrl = `${publicUrlBase}/${safeFilename}`;

    return NextResponse.json({
      signedUrl,
      publicUrl,
      safeFilename
    });

  } catch (error) {
    console.error('Presign Error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
