import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * ============================================================
 * Configuration
 * ============================================================
 */

const TRANSLATION_NAMES: Record<string, string> = {
  AMP: 'Amplified Bible',
  AMPC: 'Amplified Bible, Classic Edition',
  NKJV: 'New King James Version',
  NIV: 'New International Version',
  MSG: 'The Message',
  KJV: 'King James Version',
  ESV: 'English Standard Version',
  NLT: 'New Living Translation',
  NASB: 'New American Standard Bible',
  CSB: 'Christian Standard Bible',
};

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

const EXPECTED = {
  books: 66,
  chapters: 1189,
  verses: 31102,
};

type BibleData = Record<string, Record<string, Record<string, string>>>;

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

function calculateStatistics(data: BibleData) {
  let chapters = 0;
  let verses = 0;
  for (const book of Object.values(data)) {
    chapters += Object.keys(book).length;
    for (const chapter of Object.values(book)) {
      verses += Object.keys(chapter).length;
    }
  }
  return { books: Object.keys(data).length, chapters, verses };
}

async function seedTranslation(translationAbbr: string) {
  const translationName = TRANSLATION_NAMES[translationAbbr.toUpperCase()] || translationAbbr.toUpperCase();
  
  // Support both the generator's folder structure and flat structure
  let bibleJsonPath = path.join(process.cwd(), 'versions', translationAbbr, `${translationAbbr}_bible.json`);
  if (!fs.existsSync(bibleJsonPath)) {
    bibleJsonPath = path.join(process.cwd(), 'versions', `${translationAbbr}_bible.json`);
  }

  if (!fs.existsSync(bibleJsonPath)) {
    throw new Error(`Bible dataset not found at:\n${bibleJsonPath}\n\nPlease generate it first using 'npx tsx prisma/generate-bible.ts ${translationAbbr}'`);
  }

  console.log(`\n========================================`);
  console.log(`📖 Scriptura Universal Importer (${translationAbbr})`);
  console.log(`========================================\n`);

  console.log(`📖 Reading Bible dataset from ${bibleJsonPath}...`);
  const raw = fs.readFileSync(bibleJsonPath, 'utf-8');
  const bibleData = JSON.parse(raw) as BibleData;

  const stats = calculateStatistics(bibleData);
  console.log('\n📊 Dataset statistics');
  console.log(`   Books:    ${stats.books}`);
  console.log(`   Chapters: ${stats.chapters}`);
  console.log(`   Verses:   ${stats.verses}`);

  if (stats.verses !== EXPECTED.verses) {
    console.warn(`   ⚠️ Warning: Verse count is ${stats.verses} instead of standard ${EXPECTED.verses}. This is normal for modern translations.`);
  }

  console.log('\n🗄️  Importing into PostgreSQL...\n');

  await prisma.$transaction(
    async (tx) => {
      const translation = await tx.bibleTranslation.upsert({
        where: { abbreviation: translationAbbr },
        update: { name: translationName },
        create: { name: translationName, abbreviation: translationAbbr },
      });

      console.log(`✓ Translation: ${translation.name} (${translation.abbreviation})`);

      let totalVerses = 0;
      let totalChapters = 0;

      for (let bookIndex = 0; bookIndex < BOOKS.length; bookIndex++) {
        const canonicalBookName = BOOKS[bookIndex];
        const datasetBookName = Object.keys(bibleData).find((name) => normalizeBookName(name) === canonicalBookName);

        if (!datasetBookName) {
          throw new Error(`Unable to find dataset data for ${canonicalBookName}`);
        }

        const chapters = bibleData[datasetBookName];
        const bibleBook = await tx.bibleBook.upsert({
          where: { translationId_name: { translationId: translation.id, name: canonicalBookName } },
          update: { order: bookIndex + 1, testament: bookIndex < 39 ? 'OT' : 'NT' },
          create: { translationId: translation.id, name: canonicalBookName, order: bookIndex + 1, testament: bookIndex < 39 ? 'OT' : 'NT' },
        });

        const chapterNumbers = Object.keys(chapters).sort((a, b) => Number(a) - Number(b));
        totalChapters += chapterNumbers.length;

        for (const chapterNumber of chapterNumbers) {
          const verses = chapters[chapterNumber];
          for (const verseNumber of Object.keys(verses).sort((a, b) => Number(a) - Number(b))) {
            const text = normalizeVerseText(verses[verseNumber]);
            if (!text) continue;

            await tx.bibleVerse.upsert({
              where: {
                translationId_bookId_chapter_verse: {
                  translationId: translation.id,
                  bookId: bibleBook.id,
                  chapter: Number(chapterNumber),
                  verse: Number(verseNumber),
                },
              },
              update: { text },
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
              process.stdout.write(`\r   Imported ${totalVerses.toLocaleString()} verses...`);
            }
          }
        }
        console.log(`\n✓ ${String(bookIndex + 1).padStart(2, '0')}/66 ${canonicalBookName}`);
      }
      console.log(`\n✓ Imported ${totalChapters.toLocaleString()} chapters`);
      console.log(`✓ Imported ${totalVerses.toLocaleString()} verses`);
    },
    { timeout: 600_000 }
  );

  console.log('\n========================================');
  console.log(`✅ ${translationAbbr} import completed successfully`);
  console.log('========================================\n');
}

async function main() {
  const args = process.argv.slice(2);
  const translation = args[0];

  if (!translation) {
    console.error('❌ Please specify a translation to seed (e.g. npx tsx prisma/seed-bible.ts NKJV)');
    process.exitCode = 1;
    return;
  }

  await seedTranslation(translation.toUpperCase());
}

main()
  .catch((error) => {
    console.error('\n❌ Bible import failed:\n');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
