import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanScriptureText } from '@/lib/bible/cleaner';

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const MAX_CHAPTERS: Record<string, number> = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4,
  "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12, "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, "Malachi": 4,
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28, "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const exactBook = searchParams.get('book');
  const exactChapter = searchParams.get('chapter');
  const exactVerseStart = searchParams.get('verseStart');
  const exactVerseEnd = searchParams.get('verseEnd');
  const translationId = searchParams.get('translationId');

  // If explicit parameters are provided (e.g. from the voice parser)
  if (exactBook && exactChapter) {
    // Some translations store variant book names (e.g. "Psalm" instead of "Psalms").
    // We try the canonical name first, then any known aliases, so we always find the book.
    const BOOK_NAME_ALIASES: Record<string, string[]> = {
      "Psalms":          ["Psalm"],
      "Song of Solomon": ["Song Of Solomon", "Song of Songs", "Song Of Songs"],
    };

    const namesToTry: string[] = [exactBook, ...(BOOK_NAME_ALIASES[exactBook] ?? [])];

    let book: (Awaited<ReturnType<typeof prisma.bibleBook.findFirst>> & { translation: any }) | null = null;
    for (const nameVariant of namesToTry) {
      const bookWhere: any = { name: { equals: nameVariant, mode: 'insensitive' } };
      if (translationId) bookWhere.translationId = translationId;
      book = await prisma.bibleBook.findFirst({ where: bookWhere, include: { translation: true } });
      if (book) break;
    }

    if (!book) {
      return NextResponse.json({ error: `Book '${exactBook}' not found in the selected translation.` });
    }

    const chapter = parseInt(exactChapter, 10);
    const verseStart = exactVerseStart ? parseInt(exactVerseStart, 10) : undefined;
    const verseEnd = exactVerseEnd ? parseInt(exactVerseEnd, 10) : undefined;

    const verses = await prisma.bibleVerse.findMany({
      where: {
        bookId: book.id,
        chapter,
        ...(verseStart && { verse: verseEnd ? { gte: verseStart, lte: verseEnd } : verseStart })
      },
      orderBy: { verse: 'asc' }
    });

    if (verses.length > 0) {
      // Combine verses if it's a range or a full chapter
      const combinedText = cleanScriptureText(verses.map(v => v.text).join(' '));
      
      let reference = `${book.name} ${chapter}`;
      if (verseStart) {
        reference += `:${verseStart}${verseEnd ? `-${verseEnd}` : ''}`;
      }

      return NextResponse.json({
          results: [{
            reference,
            translation: book.translation.abbreviation,
            text: combinedText,
          }]
        });
      }
      // If we got here, verses were empty. Let's find out why.
      const chapterExists = await prisma.bibleVerse.findFirst({
        where: { bookId: book.id, chapter }
      });

      if (!chapterExists) {
        let suggestion = "";
        const bookIndex = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === book.name.toLowerCase());
        
        if (bookIndex !== -1 && chapter <= 150) {
          // Search outwards for the closest book that has this chapter
          for (let offset = 1; offset < BIBLE_BOOKS.length; offset++) {
            const left = bookIndex - offset;
            const right = bookIndex + offset;
            
            if (left >= 0 && MAX_CHAPTERS[BIBLE_BOOKS[left]] >= chapter) {
              suggestion = `\nDid you mean ${BIBLE_BOOKS[left]} ${chapter}?`;
              break;
            }
            if (right < BIBLE_BOOKS.length && MAX_CHAPTERS[BIBLE_BOOKS[right]] >= chapter) {
              suggestion = `\nDid you mean ${BIBLE_BOOKS[right]} ${chapter}?`;
              break;
            }
          }
        }
        
        return NextResponse.json({ error: `Chapter number (${chapter}) does not exist in ${book.name}.${suggestion}` });
      } else {
        const maxVerseRow = await prisma.bibleVerse.findFirst({
          where: { bookId: book.id, chapter },
          orderBy: { verse: 'desc' }
        });
        const maxVerse = maxVerseRow?.verse || 0;
        let suggestion = "";
        if (verseStart && verseStart > maxVerse) {
          suggestion = `\n(Chapter ${chapter} only has ${maxVerse} verses)`;
        }
        return NextResponse.json({ error: `Verse number (${verseStart}${verseEnd ? `-${verseEnd}` : ''}) is not in ${book.name} chapter ${chapter}.${suggestion}` });
      }
    }

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  // Pure Phrase / Text Search
  const verseWhere: any = { text: { contains: q, mode: 'insensitive' } };
  if (translationId) verseWhere.translationId = translationId;

  const verses = await prisma.bibleVerse.findMany({
    where: verseWhere,
    include: { book: { include: { translation: true } } },
    take: 50, // Increased limit so they see more results
  });

  const results = verses.map(v => ({
    reference: `${v.book.name} ${v.chapter}:${v.verse}`,
    translation: v.book.translation.abbreviation,
    text: cleanScriptureText(v.text),
  }));

  return NextResponse.json({ results });
}
