const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, '../versions/kjv.json');
  console.log(`Reading KJV JSON from ${jsonPath}...`);
  
  if (!fs.existsSync(jsonPath)) {
    console.error("KJV JSON file not found.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`Seeding Translation: ${data.name} (${data.version.toUpperCase()})`);

  const translation = await prisma.bibleTranslation.upsert({
    where: { abbreviation: data.version.toUpperCase() },
    update: {},
    create: {
      name: data.name,
      abbreviation: data.version.toUpperCase(),
    }
  });

  console.log(`Translation created/found with ID: ${translation.id}`);

  let totalVerses = 0;

  for (const bookData of data.books) {
    const book = await prisma.bibleBook.upsert({
      where: {
        translationId_name: {
          translationId: translation.id,
          name: bookData.englishName
        }
      },
      update: {},
      create: {
        translationId: translation.id,
        name: bookData.englishName,
        testament: bookData.testament,
        order: bookData.bookId
      }
    });

    console.log(`Processing Book: ${book.name}`);
    const versesToInsert = [];

    for (const chapterData of bookData.chapters) {
      for (const verseData of chapterData.verses) {
        versesToInsert.push({
          translationId: translation.id,
          bookId: book.id,
          chapter: chapterData.chapter,
          verse: verseData.number,
          text: verseData.text
        });
      }
    }

    // Insert verses in chunks to avoid blowing up memory/query limits
    const chunkSize = 500;
    for (let i = 0; i < versesToInsert.length; i += chunkSize) {
      const chunk = versesToInsert.slice(i, i + chunkSize);
      await prisma.bibleVerse.createMany({
        data: chunk,
        skipDuplicates: true
      });
    }

    totalVerses += versesToInsert.length;
  }

  console.log(`\n🎉 Success! Seeded ${totalVerses} verses for ${data.name}.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
