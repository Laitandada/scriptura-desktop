import * as cheerio from 'cheerio';

async function test() {
  const response = await fetch("https://www.biblegateway.com/passage/?version=MSG&search=Genesis+1&interface=print");
  const html = await response.text();
  
  const $ = cheerio.load(html);
  $('sup.versenum').each((_, element) => {
     console.log("Found verse text:", $(element).text());
  });
}
test();
