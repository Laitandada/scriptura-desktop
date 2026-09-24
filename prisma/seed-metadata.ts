import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// MVP Book-level authorship mapping
const AUTHOR_MAP: Record<string, string[]> = {
  'Paul': ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon'],
  'Moses': ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],
  'David': ['Psalms'],
  'Solomon': ['Proverbs', 'Ecclesiastes', 'Song of Solomon'],
  'Isaiah': ['Isaiah'],
  'Jeremiah': ['Jeremiah', 'Lamentations'],
  'Ezekiel': ['Ezekiel'],
  'Daniel': ['Daniel'],
  'Peter': ['1 Peter', '2 Peter'],
  'John': ['John', '1 John', '2 John', '3 John', 'Revelation'],
  'James': ['James'],
  'Matthew': ['Matthew'],
  'Mark': ['Mark'],
  'Luke': ['Luke', 'Acts'],
};

async function main() {
  console.log('Fetching distinct verses to seed metadata...');
  
  // Get canonical verses from one translation
  const verses = await prisma.$queryRawUnsafe<any[]>(`
    SELECT DISTINCT bb.name as "bookName", bv.chapter, bv.verse
    FROM "BibleVerse" bv
    JOIN "BibleBook" bb ON bv."bookId" = bb.id
  `);
  
  console.log(`Found ${verses.length} canonical verses. Building metadata...`);
  
  const metadataRecords = verses.map(v => {
    let author = null;
    for (const [auth, books] of Object.entries(AUTHOR_MAP)) {
      if (books.includes(v.bookName)) {
        author = auth;
        break;
      }
    }
    
    return {
      bookName: v.bookName,
      chapter: v.chapter,
      verse: v.verse,
      author: author,
      speaker: null // Will be enriched later with red-letter data
    };
  });

  console.log('Inserting into VerseMetadata...');
  
  // Clean first for idempotency
  await prisma.verseMetadata.deleteMany();
  
  const batchSize = 5000;
  for (let i = 0; i < metadataRecords.length; i += batchSize) {
    const batch = metadataRecords.slice(i, i + batchSize);
    await prisma.verseMetadata.createMany({
      data: batch,
      skipDuplicates: true
    });
    console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} records)`);
  }
  
  console.log('Seeding complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
