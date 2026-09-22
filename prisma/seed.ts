import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Bible dataset...');
  
  // 1. Create or get the translation
  const translation = await prisma.bibleTranslation.upsert({
    where: { abbreviation: 'WEB' },
    update: {},
    create: {
      name: 'World English Bible',
      abbreviation: 'WEB',
    },
  });

  // 2. Load the JSON data
  const dataPath = path.join(__dirname, 'seed_data', 'web.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Seed data not found at ${dataPath}`);
  }

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const bibleData = JSON.parse(rawData);

  // The expected JSON format from thiagobodruk/bible:
  // Array of book objects: { abbrev: string, chapters: string[][], name: string }
  // chapters is an array of arrays of strings (verses)

  let bookOrder = 1;
  for (const book of bibleData) {
    const testament = bookOrder <= 39 ? 'OT' : 'NT'; // Standard 66 book Protestant canon boundary
    
    const dbBook = await prisma.bibleBook.upsert({
      where: {
        translationId_name: {
          translationId: translation.id,
          name: book.name
        }
      },
      update: {},
      create: {
        translationId: translation.id,
        name: book.name,
        testament,
        order: bookOrder,
      }
    });

    const versesToInsert = [];
    
    // Add verses
    for (let c = 0; c < book.chapters.length; c++) {
      const chapterNum = c + 1;
      const verses = book.chapters[c];
      
      for (let v = 0; v < verses.length; v++) {
        const verseNum = v + 1;
        const text = verses[v];
        
        versesToInsert.push({
          translationId: translation.id,
          bookId: dbBook.id,
          chapter: chapterNum,
          verse: verseNum,
          text: text,
        });
      }
    }

    // Insert verses in batches to avoid overwhelming the DB
    if (versesToInsert.length > 0) {
      await prisma.bibleVerse.createMany({
        data: versesToInsert,
        skipDuplicates: true,
      });
    }

    console.log(`Seeded ${book.name} (${versesToInsert.length} verses)`);
    bookOrder++;
  }

  // Ensure singleton current state exists
  await prisma.currentState.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      type: 'clear',
    }
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
