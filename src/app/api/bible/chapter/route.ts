import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanScriptureText } from '@/lib/bible/cleaner';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bookName = searchParams.get('book');
    const chapter = parseInt(searchParams.get('chapter') || '0', 10);
    const translationId = searchParams.get('translationId');

    if (!bookName || !chapter) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Find the book
    const bookWhere: any = { name: { equals: bookName, mode: 'insensitive' } };
    if (translationId) {
      bookWhere.translationId = translationId;
    }

    const book = await prisma.bibleBook.findFirst({
      where: bookWhere,
      include: { translation: true }
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // 2. Fetch all verses for this chapter in order
    const verses = await prisma.bibleVerse.findMany({
      where: {
        bookId: book.id,
        chapter: chapter
      },
      orderBy: {
        verse: 'asc'
      }
    });

    if (verses.length === 0) {
      return NextResponse.json({ error: 'Chapter not found or contains no verses' }, { status: 404 });
    }

    return NextResponse.json({
      book: book.name,
      chapter: chapter,
      translation: book.translation.abbreviation,
      translationId: book.translation.id,
      verses: verses.map(v => ({
        verse: v.verse,
        text: cleanScriptureText(v.text),
        reference: `${book.name} ${chapter}:${v.verse}`
      }))
    });

  } catch (error) {
    console.error('Chapter Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
