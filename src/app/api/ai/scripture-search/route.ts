import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanScriptureText } from '@/lib/bible/cleaner';

export async function POST(req: Request) {
  try {
    const { query, translationId } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });
    }

    // Call OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'google/gemini-pro-1.5',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for a church scripture presentation system.
Given a user query (e.g., "scriptures about faith"), return a JSON object with a list of relevant Bible verses.
ONLY return references that actually exist in standard Protestant Bibles.
Never invent references. Do not return the scripture text, ONLY the reference.
Respond strictly with a JSON object in this format:
{
  "results": [
    {
      "book": "John",
      "chapter": 3,
      "verse": 16,
      "reason": "Directly addresses..."
    }
  ]
}
`
          },
          {
            role: 'user',
            content: query
          }
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
    if (!parsed.results || !Array.isArray(parsed.results)) {
      throw new Error('Invalid JSON structure from AI');
    }

    // Validate references against local DB
    const validatedResults = [];

    for (const res of parsed.results) {
      const bookWhere: any = { name: { startsWith: res.book, mode: 'insensitive' } };
      if (translationId) bookWhere.translationId = translationId;

      const book = await prisma.bibleBook.findFirst({
        where: bookWhere,
        include: { translation: true },
      });

      if (book) {
        const verse = await prisma.bibleVerse.findFirst({
          where: {
            translationId: book.translationId,
            bookId: book.id,
            chapter: res.chapter,
            verse: res.verse,
          }
        });

        if (verse) {
          validatedResults.push({
            reference: `${book.name} ${verse.chapter}:${verse.verse}`,
            translation: book.translation.abbreviation,
            text: cleanScriptureText(verse.text),
            reason: res.reason,
          });
        }
      }
    }

    return NextResponse.json({ results: validatedResults });
  } catch (error) {
    console.error('AI Search Error:', error);
    return NextResponse.json({ error: 'Failed to search using AI' }, { status: 500 });
  }
}
