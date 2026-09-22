import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY || '';
  return NextResponse.json({ key: apiKey });
}
