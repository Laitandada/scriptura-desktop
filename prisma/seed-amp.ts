import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * ============================================================
 * Configuration
 * ============================================================
 */

const TRANSLATION = {
  name: 'Amplified Bible',
  abbreviation: 'AMP',
};

/**
 * Path to the Bible JSON dataset.
 */
const BIBLE_JSON_PATH = path.join(
  process.cwd(),
  'versions',
  'AMP_bible.json', // Placing it in the existing versions folder
);

/**
 * Canonical Protestant Bible book order.
 */
const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song Of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

/**
 * Expected statistics.
 * You may need to tweak these if the AMP JSON you acquire merges/omits verses.
 */
const EXPECTED = {
  books: 66,
  chapters: 1189,
  verses: 31102,
};

/**
 * ============================================================
 * Types
 * ============================================================
 */

type BibleData = Record<
  string,
  Record<
    string,
    Record<string, string>
  >
>;

/**
 * ============================================================
 * Helpers
 * ============================================================
 */

function loadBibleJson(): BibleData {
  if (!fs.existsSync(BIBLE_JSON_PATH)) {
    throw new Error(
      `Bible dataset not found:\n${BIBLE_JSON_PATH}\n\n` +
        `Please acquire the AMP JSON dataset and place it at that location before running the seed.`,
    );
  }

  console.log(`📖 Reading Bible dataset...`);
  console.log(`   ${BIBLE_JSON_PATH}`);

  const raw = fs.readFileSync(BIBLE_JSON_PATH, 'utf-8');

  try {
    return JSON.parse(raw) as BibleData;
  } catch (error) {
    throw new Error(
      `Unable to parse Bible JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function normalizeBookName(bookName: string): string {
  const aliases: Record<string, string> = {
    Psalms: 'Psalm',
    'Song of Solomon': 'Song Of Solomon',
    'Song of Songs': 'Song Of Solomon',
  };

  return aliases[bookName] ?? bookName;
}

function normalizeVerseText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function validateBooks(data: BibleData): void {
  const datasetBooks = Object.keys(data).map(normalizeBookName);

  const missingBooks = BOOKS.filter(
    (book) => !datasetBooks.includes(book),
  );

  if (missingBooks.length > 0) {
    throw new Error(
      `Dataset is missing ${missingBooks.length} Bible book(s):\n` +
        missingBooks.join(', '),
    );
  }

  if (datasetBooks.length !== EXPECTED.books) {
    throw new Error(
      `Expected ${EXPECTED.books} books but found ${datasetBooks.length}.`,
    );
  }
}

function calculateStatistics(data: BibleData) {
  let chapters = 0;
  let verses = 0;

  for (const book of Object.values(data)) {
    chapters += Object.keys(book).length;

    for (const chapter of Object.values(book)) {
      verses += Object.keys(chapter).length;
    }
  }

  return {
    books: Object.keys(data).length,
    chapters,
    verses,
  };
}

function validateStatistics(data: BibleData): void {
  const stats = calculateStatistics(data);

  console.log('\n📊 Dataset statistics');
  console.log(`   Books:    ${stats.books}`);
  console.log(`   Chapters: ${stats.chapters}`);
  console.log(`   Verses:   ${stats.verses}`);

  // Warning instead of error because translations like AMP often have slightly different verse counts
  if (stats.verses !== EXPECTED.verses) {
    console.warn(`   ⚠️ Warning: Verse count is ${stats.verses} instead of standard ${EXPECTED.verses}. This is normal for modern translations.`);
  }

  console.log('   ✅ Dataset validation passed');
}

/**
 * ============================================================
 * Main seed
 * ============================================================
 */

async function seedAMP(): Promise<void> {
  console.log('\n========================================');
  console.log('📖 Scriptura Bible Importer (AMP)');
  console.log('========================================\n');

  const bibleData = loadBibleJson();

  console.log('\n🔍 Validating dataset...');

  validateBooks(bibleData);
  validateStatistics(bibleData);

  console.log('\n🗄️  Importing into PostgreSQL...\n');

  await prisma.$transaction(
    async (tx) => {
      const translation = await tx.bibleTranslation.upsert({
        where: {
          abbreviation: TRANSLATION.abbreviation,
        },
        update: {
          name: TRANSLATION.name,
        },
        create: {
          name: TRANSLATION.name,
          abbreviation: TRANSLATION.abbreviation,
        },
      });

      console.log(
        `✓ Translation: ${translation.name} (${translation.abbreviation})`,
      );

      let totalVerses = 0;
      let totalChapters = 0;

      for (let bookIndex = 0; bookIndex < BOOKS.length; bookIndex++) {
        const canonicalBookName = BOOKS[bookIndex];

        const datasetBookName = Object.keys(bibleData).find(
          (name) => normalizeBookName(name) === canonicalBookName,
        );

        if (!datasetBookName) {
          throw new Error(
            `Unable to find dataset data for ${canonicalBookName}`,
          );
        }

        const chapters = bibleData[datasetBookName];

        const bibleBook = await tx.bibleBook.upsert({
          where: {
            translationId_name: {
              translationId: translation.id,
              name: canonicalBookName,
            },
          },
          update: {
            order: bookIndex + 1,
            testament: bookIndex < 39 ? 'OT' : 'NT',
          },
          create: {
            translationId: translation.id,
            name: canonicalBookName,
            order: bookIndex + 1,
            testament: bookIndex < 39 ? 'OT' : 'NT',
          },
        });

        const chapterNumbers = Object.keys(chapters).sort(
          (a, b) => Number(a) - Number(b),
        );

        totalChapters += chapterNumbers.length;

        for (const chapterNumber of chapterNumbers) {
          const verses = chapters[chapterNumber];

          for (const verseNumber of Object.keys(verses).sort(
            (a, b) => Number(a) - Number(b),
          )) {
            const text = normalizeVerseText(
              verses[verseNumber],
            );

            if (!text) {
              console.warn(
                `⚠️ Empty verse: ${canonicalBookName} ${chapterNumber}:${verseNumber}`,
              );
              continue;
            }

            await tx.bibleVerse.upsert({
              where: {
                translationId_bookId_chapter_verse: {
                  translationId: translation.id,
                  bookId: bibleBook.id,
                  chapter: Number(chapterNumber),
                  verse: Number(verseNumber),
                },
              },
              update: {
                text,
              },
              create: {
                translationId: translation.id,
                bookId: bibleBook.id,
                chapter: Number(chapterNumber),
                verse: Number(verseNumber),
                text,
              },
            });

            totalVerses++;

            if (totalVerses % 1000 === 0) {
              process.stdout.write(
                `\r   Imported ${totalVerses.toLocaleString()} verses...`,
              );
            }
          }
        }
        console.log(
          `\n✓ ${String(bookIndex + 1).padStart(2, '0')}/66 ${canonicalBookName}`,
        );
      }
      console.log(`\n✓ Imported ${totalChapters.toLocaleString()} chapters`);
      console.log(`✓ Imported ${totalVerses.toLocaleString()} verses`);
    },
    {
      timeout: 300_000,
    },
  );

  console.log('\n========================================');
  console.log('✅ AMP import completed successfully');
  console.log('========================================\n');
}

seedAMP()
  .catch((error) => {
    console.error('\n❌ Bible import failed:\n');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
