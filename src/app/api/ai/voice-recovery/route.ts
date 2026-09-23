import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanScriptureText } from '@/lib/bible/cleaner';

const PROMPT = `You are a Bible reference recovery system for a church presentation application.
Your task is to identify Bible references that a speaker most likely intended to say.

The speech transcript may contain:
- accents
- speech-to-text errors
- missing punctuation
- missing spaces
- homophones
- incorrect Bible book names
- spoken numbers
- concatenated chapter and verse numbers
- conversational filler

Return ONLY valid Bible references.
Do not generate Bible verse text.
Do not invent references.
If the transcript does not contain a sufficiently clear Bible reference, return an empty candidates array.

Examples:

Transcript:
"first Peter 29"
Likely:
1 Peter 2:9

Transcript:
"humans five verse sixteen"
Likely:
Romans 5:16

Transcript:
"john three sixteen"
Likely:
John 3:16

Transcript:
"something about trusting God"
This is not a direct Bible reference.
Return:
{
  "candidates": []
}

Output JSON only in the following schema:
{
  "candidates": [
    {
      "book": "string (standard canonical name)",
      "chapter": 1,
      "verseStart": 1,
      "verseEnd": null,
      "confidence": 0.95
    }
  ]
}
`;

export async function POST(req: Request) {
  try {
    const { transcript, translationId } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });
    }

    // 1. Call OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'google/gemini-pro-1.5',
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: `Transcript:\n"${transcript}"` }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from AI');
    }

    const parsed = JSON.parse(content);
    if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
      throw new Error('Invalid JSON structure from AI');
    }

    // 2. Local DB Validation
    const validatedResults = [];

    for (const cand of parsed.candidates) {
      const BOOK_NAME_ALIASES: Record<string, string[]> = {
        "Psalms":          ["Psalm"],
        "Song of Solomon": ["Song Of Solomon", "Song of Songs", "Song Of Songs"],
      };

      const namesToTry: string[] = [cand.book, ...(BOOK_NAME_ALIASES[cand.book] ?? [])];

      let book: (Awaited<ReturnType<typeof prisma.bibleBook.findFirst>> & { translation: any }) | null = null;
      for (const nameVariant of namesToTry) {
        const bookWhere: any = { name: { equals: nameVariant, mode: 'insensitive' } };
        if (translationId) bookWhere.translationId = translationId;
        book = await prisma.bibleBook.findFirst({ where: bookWhere, include: { translation: true } });
        if (book) break;
      }

      if (book) {
        // Build query based on whether there's a verseStart
        const query: any = {
          translationId: book.translationId,
          bookId: book.id,
          chapter: cand.chapter,
        };
        
        if (cand.verseStart !== undefined && cand.verseStart !== null) {
          query.verse = cand.verseStart;
        }

        const verse = await prisma.bibleVerse.findFirst({
          where: query
        });

        if (verse) {
          validatedResults.push({
            reference: cand.verseStart 
              ? `${book.name} ${cand.chapter}:${cand.verseStart}${cand.verseEnd ? `-${cand.verseEnd}` : ''}`
              : `${book.name} ${cand.chapter}`,
            translation: book.translation.abbreviation,
            text: cleanScriptureText(verse.text),
            confidence: cand.confidence,
          });
        }
      }
    }

    return NextResponse.json({ candidates: validatedResults });
  } catch (error) {
    console.error('AI Recovery Error:', error);
    return NextResponse.json({ error: 'Failed to recover using AI' }, { status: 500 });
  }
}
