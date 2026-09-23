import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-4d96cc389f2d4f18844b2e210f5610c2.r2.dev';

async function sync() {
  const r2Res = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME }));
  const objects = r2Res.Contents || [];
  
  const existingMedia = await prisma.media.findMany();
  const existingPaths = new Set(existingMedia.map(m => m.path));

  for (const obj of objects) {
    if (!obj.Key) continue;
    const publicUrl = `${R2_PUBLIC_URL}/${obj.Key}`;
    
    if (!existingPaths.has(publicUrl)) {
      const isImage = obj.Key.endsWith('.jpg') || obj.Key.endsWith('.jpeg') || obj.Key.endsWith('.png') || obj.Key.endsWith('.webp');
      const type = isImage ? 'IMAGE' : 'VIDEO';
      const filename = `R2 Background Video (${obj.Key.substring(0, 8)})`;
      
      const created = await prisma.media.create({
        data: {
          filename,
          type,
          path: publicUrl,
          createdAt: obj.LastModified || new Date(),
        }
      });
      console.log('✓ Added missing Cloudflare R2 media to DB:', created.filename, created.path);
    } else {
      console.log('Already in DB:', publicUrl);
    }
  }
}

sync()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
