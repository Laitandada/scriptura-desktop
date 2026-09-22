import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as cheerio from 'cheerio';

/**
 * ============================================================
 * Configuration
 * ============================================================
 */

const BIBLE_GATEWAY_URL = 'https://www.biblegateway.com/passage/';
const REQUEST_DELAY_MS = 750;
const MAX_RETRIES = 3;

const BIBLE_TRANSLATIONS = {
  AMP: 'AMP',
  AMPC: 'AMPC',
  ASV: 'ASV',
  AKJV: 'AKJV',
  BRG: 'BRG',
  CSB: 'CSB',
  EHV: 'EHV',
  ESV: 'ESV',
  ESVUK: 'ESVUK',
  GNV: 'GNV',
  GW: 'GW',
  ISV: 'ISV',
  JUB: 'JUB',
  KJV: 'KJV',
  KJ21: 'KJ21',
  LEB: 'LEB',
  LSB: 'LSB',
  MEV: 'MEV',
  MSG: 'MSG',
  NASB: 'NASB',
  NASB1995: 'NASB1995',
  NET: 'NET',
  NIV: 'NIV',
  NIVUK: 'NIVUK',
  NKJV: 'NKJV',
  NLT: 'NLT',
  NLV: 'NLV',
  NOG: 'NOG',
  NRSV: 'NRSV',
  NRSVUE: 'NRSVUE',
  RSV: 'RSV',
  WEB: 'WEB',
  YLT: 'YLT',
} as const;

type TranslationCode = keyof typeof BIBLE_TRANSLATIONS;

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
] as const;

const CHAPTER_COUNTS: Record<string, number> = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34, Joshua: 24, Judges: 21, Ruth: 4,
  '1 Samuel': 31, '2 Samuel': 24, '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalm: 150, Proverbs: 31, Ecclesiastes: 12, 'Song Of Solomon': 8,
  Isaiah: 66, Jeremiah: 52, Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9,
  Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2, Zechariah: 14,
  Malachi: 4, Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16, '1 Corinthians': 16,
  '2 Corinthians': 13, Galatians: 6, Ephesians: 6, Philippians: 4, Colossians: 4, '1 Thessalonians': 5,
  '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1, Hebrews: 13, James: 5,
  '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1, '3 John': 1, Jude: 1, Revelation: 22,
};

type BibleChapter = Record<string, string>;
type BibleBook = Record<string, BibleChapter>;
type BibleData = Record<string, BibleBook>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function cleanVerseText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\[\[/g, '')
    .replace(/\]\]/g, '')
    .replace(/\*/g, '')
    .replace(/⌞/g, '')
    .replace(/⌟/g, '')
    .replace(/¶ /g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBookName(book: string): string {
  const aliases: Record<string, string> = {
    Psalms: 'Psalm',
    'Song of Solomon': 'Song Of Solomon',
    'Song of Songs': 'Song Of Solomon',
  };
  return aliases[book] ?? book;
}

function validateTranslation(translation: string): TranslationCode {
  const normalized = translation.toUpperCase();
  if (!(normalized in BIBLE_TRANSLATIONS)) {
    throw new Error(
      `Unsupported translation "${translation}".\n\nSupported translations:\n${Object.keys(BIBLE_TRANSLATIONS).join(', ')}`
    );
  }
  return normalized as TranslationCode;
}

async function fetchBibleGateway(translation: TranslationCode, search: string): Promise<string> {
  const params = new URLSearchParams({ version: translation, search, interface: 'print' });
  const url = `${BIBLE_GATEWAY_URL}?${params.toString()}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`      Request ${attempt}/${MAX_RETRIES}: ${search}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/139 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const html = await response.text();
      if (!html.includes('passage-content')) throw new Error('Bible Gateway response does not contain passage-content.');
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const retryDelay = REQUEST_DELAY_MS * attempt;
        console.warn(`      Request failed. Retrying in ${retryDelay}ms...`);
        await sleep(retryDelay);
      }
    }
  }
  throw new Error(`Failed to retrieve "${search}" after ${MAX_RETRIES} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function parseChapter(html: string, book: string, chapter: number): BibleChapter {
  const $ = cheerio.load(html);
  const passageContents = $('.passage-content');
  
  if (passageContents.length === 0) {
    throw new Error(`No passage content found for ${book} ${chapter}`);
  }

  $('h1, h2, h3, h4, a.full-chap-link, a.bibleref, sup.crossreference, sup.footnote, div.footnotes, div.dropdowns, div.crossrefs, div.passage-other-trans, p.translation-note, crossref').remove();
  
  $('span.selah, i.selah, selah').each((_, element) => {
    const text = $(element).text().trim();
    $(element).replaceWith(` ${text}`);
  });
  
  $('span.chapternum').each((_, element) => {
    $(element).replaceWith('\n[[VERSE:1]] ');
  });
  
  $('sup.versenum').each((_, element) => {
    const rawNumber = $(element).text().trim();
    const verseNumber = rawNumber.split('-')[0].replace(/\D/g, '');
    if (verseNumber) {
      $(element).replaceWith(`\n[[VERSE:${verseNumber}]] `);
    }
  });
  
  $('td:nth-child(odd)').each((_, element) => {
    $(element).append(' ');
  });
  
  $('.passage-content p').each((_, element) => {
    const text = $(element).text();
    $(element).replaceWith(`\n${text}`);
  });
  
  let rawText = '';
  passageContents.each((_, element) => {
    rawText += `\n${$(element).text()}`;
  });
  
  rawText = rawText.replace(/\u00a0/g, ' ');

  const versePattern = /\[\[VERSE:(\d+)\]\]\s*([\s\S]*?)(?=\n?\[\[VERSE:\d+\]\]|$)/g;
  const chapterData: BibleChapter = {};
  let match: RegExpExecArray | null;
  
  while ((match = versePattern.exec(rawText)) !== null) {
    const verseNumber = match[1];
    const text = cleanVerseText(match[2]);
    if (text) chapterData[verseNumber] = text;
  }
  
  if (Object.keys(chapterData).length === 0) {
    return parseChapterFallback($, book, chapter);
  }
  
  return chapterData;
}

function parseChapterFallback($: cheerio.CheerioAPI, book: string, chapter: number): BibleChapter {
  const result: BibleChapter = {};
  
  $('.passage-content').each((_, container) => {
    let currentVerse: string | null = null;
    $(container).find('sup.versenum, p, span, br').each((_, element) => {
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'sup' && $(element).hasClass('versenum')) {
        const rawNumber = $(element).text().trim();
        const number = rawNumber.split('-')[0].replace(/\D/g, '');
        if (number) {
          currentVerse = number;
          if (!result[number]) result[number] = '';
        }
        return;
      }
      if (tagName === 'br') {
        if (currentVerse) result[currentVerse] += ' ';
        return;
      }
      if (currentVerse) {
        const text = $(element).text().replace(/\s+/g, ' ').trim();
        if (text) result[currentVerse] += ` ${text}`;
      }
    });
  });
  
  for (const verse of Object.keys(result)) {
    result[verse] = cleanVerseText(result[verse]);
  }
  
  if (Object.keys(result).length === 0) {
    throw new Error(`Unable to parse verses from ${book} ${chapter}`);
  }
  
  return result;
}

async function downloadChapter(translation: TranslationCode, book: string, chapter: number): Promise<BibleChapter> {
  const search = `${book} ${chapter}`;
  const html = await fetchBibleGateway(translation, search);
  return parseChapter(html, book, chapter);
}

async function downloadBook(translation: TranslationCode, book: string, outputFolder: string): Promise<BibleBook> {
  const chapterCount = CHAPTER_COUNTS[book];
  if (!chapterCount) throw new Error(`No chapter count configured for ${book}`);
  
  const bookData: BibleBook = {};
  console.log(`\n📖 ${book} — ${chapterCount} chapters`);
  
  for (let chapter = 1; chapter <= chapterCount; chapter++) {
    console.log(`   Chapter ${chapter}/${chapterCount}`);
    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const chapterData = await downloadChapter(translation, book, chapter);
        if (Object.keys(chapterData).length === 0) throw new Error(`Chapter ${chapter} returned no verses`);
        bookData[String(chapter)] = chapterData;
        success = true;
        await sleep(REQUEST_DELAY_MS);
        break;
      } catch (error) {
        console.error(`   ❌ ${book} ${chapter} attempt ${attempt}:`, error instanceof Error ? error.message : error);
        if (attempt < MAX_RETRIES) await sleep(REQUEST_DELAY_MS * attempt);
      }
    }
    if (!success) throw new Error(`Failed to download ${book} chapter ${chapter}`);
  }
  
  const outputFile = path.join(outputFolder, `${book}.json`);
  fs.writeFileSync(outputFile, JSON.stringify({ [book]: bookData }, null, 2), 'utf8');
  console.log(`   ✅ Saved ${outputFile}`);
  return bookData;
}

function combineBooks(booksFolder: string, outputFile: string): BibleData {
  const combined: BibleData = {};
  for (const book of BOOKS) {
    const filePath = path.join(booksFolder, `${book}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`Missing downloaded book: ${book}`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as BibleData;
    const actualBook = Object.keys(data)[0];
    if (!actualBook) throw new Error(`Empty JSON file: ${filePath}`);
    combined[book] = data[actualBook];
  }
  fs.writeFileSync(outputFile, JSON.stringify(combined, null, 4), 'utf8');
  return combined;
}

function validateBible(data: BibleData): void {
  const bookCount = Object.keys(data).length;
  let chapterCount = 0;
  let verseCount = 0;
  
  for (const book of BOOKS) {
    if (!data[book]) throw new Error(`Validation failed: missing ${book}`);
    const chapters = data[book];
    chapterCount += Object.keys(chapters).length;
    for (const chapter of Object.values(chapters)) {
      verseCount += Object.keys(chapter).length;
      for (const [verse, text] of Object.entries(chapter)) {
        if (!text.trim()) throw new Error(`Validation failed: empty verse ${book} ${verse}`);
      }
    }
  }
  
  console.log('\n========================================');
  console.log('📊 Bible validation');
  console.log('========================================');
  console.log(`Books:    ${bookCount}`);
  console.log(`Chapters: ${chapterCount}`);
  console.log(`Verses:   ${verseCount}`);
  if (bookCount !== 66) throw new Error(`Expected 66 books, got ${bookCount}`);
  if (chapterCount !== 1189) throw new Error(`Expected 1189 chapters, got ${chapterCount}`);
  console.log('========================================\n');
  console.log('✅ Bible validation passed');
}

async function generateBible(translationInput: string): Promise<void> {
  const translation = validateTranslation(translationInput);
  
  // Save into versions folder to keep things clean
  const rootDirectory = path.join(process.cwd(), 'versions', translation);
  const booksDirectory = path.join(rootDirectory, `${translation}_books`);
  
  ensureDirectory(rootDirectory);
  ensureDirectory(booksDirectory);
  
  console.log('\n========================================');
  console.log(`📖 Generating ${translation} Bible`);
  console.log('========================================');
  console.log(`Output: ${rootDirectory}`);
  
  // We no longer delete existing files to support resuming
  const existingFiles = fs.readdirSync(booksDirectory);
  console.log(`\n📚 Found ${existingFiles.length} existing files (will skip downloading them)`);
  
  for (let i = 0; i < BOOKS.length; i++) {
    const book = BOOKS[i];
    const outputFile = path.join(booksDirectory, `${book}.json`);
    
    if (fs.existsSync(outputFile)) {
      console.log(`\n[${i + 1}/66] ${book} (Already downloaded)`);
      continue;
    }
    
    console.log(`\n[${i + 1}/66] ${book}`);
    await downloadBook(translation, book, booksDirectory);
  }
  
  const combinedFile = path.join(rootDirectory, `${translation}_bible.json`);
  console.log('\n📦 Combining books...');
  const combined = combineBooks(booksDirectory, combinedFile);
  console.log(`✅ Combined Bible written to:\n${combinedFile}`);
  
  validateBible(combined);
  console.log(`\n🎉 ${translation} generation complete!`);
}

function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let translation = args[0];
  
  console.log('\n========================================');
  console.log('📖 Scriptura Bible Generator');
  console.log('========================================\n');
  
  if (!translation) {
    console.log('Available translations:\n');
    console.log(Object.keys(BIBLE_TRANSLATIONS).join('  '));
    translation = await askQuestion('\nTranslation (e.g. KJV): ');
  }
  
  await generateBible(translation.toUpperCase());
}

main().catch((error) => {
  console.error('\n❌ Generation failed:\n');
  console.error(error);
  process.exitCode = 1;
});
