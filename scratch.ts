import * as cheerio from 'cheerio';

function cleanVerseText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/\[\[/g, '').replace(/\]\]/g, '').replace(/\*/g, '').replace(/⌞/g, '').replace(/⌟/g, '').replace(/¶ /g, '').replace(/\s+/g, ' ').trim();
}

async function test() {
  const response = await fetch("https://www.biblegateway.com/passage/?version=NKJV&search=Genesis+1&interface=print", {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/139 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
  const html = await response.text();
  
  const $ = cheerio.load(html);
  const passageContents = $('.passage-content');
  
  $('h1, h2, h3, h4, a.full-chap-link, a.bibleref, sup.crossreference, sup.footnote, div.footnotes, div.dropdowns, div.crossrefs, div.passage-other-trans, p.translation-note, crossref').remove();
  
  $('span.selah, i.selah, selah').each((_, element) => {
    const text = $(element).text().trim();
    $(element).replaceWith(` ${text}`);
  });
  
  // FIX for Verse 1: When replacing chapternum, also insert verse 1!
  $('span.chapternum').each((_, element) => {
    $(element).replaceWith('\n[[VERSE:1]] ');
  });
  
  $('sup.versenum').each((_, element) => {
    const verseNumber = $(element).text().replace(/\D/g, '');
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
  
  rawText = rawText.replace(/\u00a0/g, ' ').replace(/\[\[/g, '').replace(/\]\]/g, '');
  console.log("Raw text sample:", rawText.substring(0, 500));
  
  const versePattern = /VERSE:(\d+)\]\]\s*([\s\S]*?)(?=\n?\[\[?VERSE:\d+\]\]?|$)/g;
  const chapterData: Record<string, string> = {};
  let match: RegExpExecArray | null;
  
  while ((match = versePattern.exec(rawText)) !== null) {
    const verseNumber = match[1];
    const text = cleanVerseText(match[2]);
    if (text) chapterData[verseNumber] = text;
  }
  
  console.log("Parsed verses:", Object.keys(chapterData).length);
  if (Object.keys(chapterData).length > 0) {
    console.log("Verse 1:", chapterData['1']);
    console.log("Verse 2:", chapterData['2']);
  }
}
test();
