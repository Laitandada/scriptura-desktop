import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanScriptureText } from '@/lib/bible/cleaner';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bookName = searchParams.get('book');
    const chapter = parseInt(searchParams.get('chapter') || '0', 10);
    const verse = parseInt(searchParams.get('verse') || '0', 10);
    const direction = searchParams.get('direction'); // 'next' or 'prev'
    const translationId = searchParams.get('translationId');

    if (!bookName || !chapter || !verse || !direction) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Find the current book to get its ID and order
    const bookWhere: any = { name: { equals: bookName, mode: 'insensitive' } };
    if (translationId) bookWhere.translationId = translationId;

    const currentBook = await prisma.bibleBook.findFirst({
      where: bookWhere,
      include: { translation: true }
    });

    if (!currentBook) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // 2. Find the current verse to ensure it exists and get its translationId
    const currentVerse = await prisma.bibleVerse.findFirst({
      where: {
        bookId: currentBook.id,
        chapter: chapter,
        verse: verse
      }
    });

    if (!currentVerse) {
      return NextResponse.json({ error: 'Current verse not found' }, { status: 404 });
    }

    // 3. Find the adjacent verse
    let adjacentVerse;

    if (direction === 'next') {
      adjacentVerse = await prisma.bibleVerse.findFirst({
        where: {
          translationId: currentVerse.translationId,
          OR: [
            {
              bookId: currentVerse.bookId,
              chapter: currentVerse.chapter,
              verse: { gt: currentVerse.verse }
            },
            {
              bookId: currentVerse.bookId,
              chapter: { gt: currentVerse.chapter }
            },
            {
              book: {
                order: { gt: currentBook.order }
              }
            }
          ]
        },
        orderBy: [
          { book: { order: 'asc' } },
          { chapter: 'asc' },
          { verse: 'asc' }
        ],
        include: { book: true }
      });
    } else if (direction === 'prev') {
      adjacentVerse = await prisma.bibleVerse.findFirst({
        where: {
          translationId: currentVerse.translationId,
          OR: [
            {
              bookId: currentVerse.bookId,
              chapter: currentVerse.chapter,
              verse: { lt: currentVerse.verse }
            },
            {
              bookId: currentVerse.bookId,
              chapter: { lt: currentVerse.chapter }
            },
            {
              book: {
                order: { lt: currentBook.order }
              }
            }
          ]
        },
        orderBy: [
          { book: { order: 'desc' } },
          { chapter: 'desc' },
          { verse: 'desc' }
        ],
        include: { book: true }
      });
    }

    if (!adjacentVerse) {
      return NextResponse.json({ error: 'No adjacent verse found' }, { status: 404 });
    }

    return NextResponse.json({
      result: {
        reference: `${adjacentVerse.book.name} ${adjacentVerse.chapter}:${adjacentVerse.verse}`,
        translation: currentBook.translation.abbreviation,
        text: cleanScriptureText(adjacentVerse.text),
      }
    });

  } catch (error) {
    console.error('Adjacent Verse Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
