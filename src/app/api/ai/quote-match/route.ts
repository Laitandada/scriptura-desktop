import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanScriptureText } from '@/lib/bible/cleaner';

// Common English stop words to strip before keyword extraction
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
  'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
  'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
  'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'through', 'during', 'before', 'after', 'above',
  'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's',
  't', 'can', 'will', 'just', 'don', 'should', 'now', 'would', 'could',
  // Preaching filler
  'said', 'says', 'say', 'told', 'like', 'know', 'think', 'well', 'also',
  'even', 'way', 'something', 'really', 'right', 'yeah', 'yes', 'um', 'uh',
  'uhm', 'oh', 'let', 'lets', 'go', 'going', 'gonna', 'got', 'get',
]);

/**
 * Extracts meaningful content words from a transcript, stripping stop words
 * and filler. Returns an array of lowercase words.
 */
function extractContentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Generates ILIKE search phrases from both the raw transcript and content words.
 * Uses sliding windows over the original text to preserve natural word order,
 * and supplements with content-word-only bigrams for broader matching.
 */
function generateKeyPhrases(contentWords: string[], originalText: string): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();

  const addPhrase = (p: string) => {
    const lower = p.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      phrases.push(lower);
    }
  };

  // Strategy 1: Sliding windows over the ORIGINAL text (preserving stop words)
  // This catches natural phrases like "the way the truth", "shall not want", etc.
  const rawWords = originalText.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, ' ').split(/\s+/).filter(w => w.length > 0);
  
  // 4-word windows
  for (let i = 0; i < rawWords.length - 3; i++) {
    addPhrase(rawWords.slice(i, i + 4).join(' '));
  }
  // 3-word windows
  for (let i = 0; i < rawWords.length - 2; i++) {
    addPhrase(rawWords.slice(i, i + 3).join(' '));
  }

  // Strategy 2: Content-word bigrams (stop words removed)
  // Catches semantic pairs like "shepherd want", "work together"
  for (let i = 0; i < contentWords.length - 1; i++) {
    addPhrase(`${contentWords[i]} ${contentWords[i + 1]}`);
  }

  // Strategy 3: Individual distinctive words (6+ chars)
  for (const w of contentWords) {
    if (w.length >= 6) {
      addPhrase(w);
    }
  }

  return phrases;
}

/**
 * Builds a SQL WHERE clause with ILIKE conditions for keyword pre-filtering.
 * We select the best phrases to keep the query fast.
 */
function buildIlikeClauses(phrases: string[]): { clause: string, params: string[] } {
  // Filter out very short phrases that would match too broadly
  const filtered = phrases.filter(p => p.length >= 12);
  
  // Select up to 80 phrases, spread evenly across the transcript.
  // We use 80 because a 2-sentence transcript buffer can easily generate 60+ phrases,
  // and sampling too aggressively (e.g. 25) causes us to completely skip the actual quote 
  // if it falls between the sampled indices. Postgres GIN handles 80 ILIKEs in < 30ms.
  const selected: string[] = [];
  if (filtered.length <= 80) {
    selected.push(...filtered);
  } else {
    const step = filtered.length / 80;
    for (let i = 0; i < 80; i++) {
      selected.push(filtered[Math.floor(i * step)]);
    }
  }

  if (selected.length === 0) {
    return { clause: 'TRUE', params: [] };
  }

  const conditions = selected.map((_, i) => `bv.text ILIKE $${i + 4}`);
  const clause = `(${conditions.join(' OR ')})`;
  // Replace spaces with % wildcards to tolerate punctuation between words
  // "the way the truth" → "%the%way%the%truth%" matches "the way, the truth,"
  const params = selected.map(p => `%${p.split(/\s+/).join('%')}%`);

  return { clause, params };
}

const SIMILARITY_THRESHOLD = 0.35;

export async function POST(req: Request) {
  try {
    const { transcript, translationId, speakerFilter } = await req.json();

    if (!transcript || !translationId) {
      return NextResponse.json({ error: 'Transcript and translationId are required' }, { status: 400 });
    }

    // 1. Extract content words and generate key phrases
    const contentWords = extractContentWords(transcript);

    if (contentWords.length < 3) {
      // Too few meaningful words to attempt a quotation match
      return NextResponse.json({ candidates: [] });
    }

    const phrases = generateKeyPhrases(contentWords, transcript);
    const { clause, params } = buildIlikeClauses(phrases);

    if (params.length === 0) {
      return NextResponse.json({ candidates: [] });
    }

    // 2. Build and execute the hybrid query
    //    ILIKE pre-filters using the GIN trigram index (~15ms)
    //    similarity() ranks the filtered results
    const query = `
      SELECT
        bv.id,
        bv.chapter,
        bv.verse,
        bv.text,
        bb.name as book_name,
        bt.abbreviation as translation,
        word_similarity(bv.text, $1) as sim
      FROM "BibleVerse" bv
      JOIN "BibleBook" bb ON bv."bookId" = bb.id
      JOIN "BibleTranslation" bt ON bv."translationId" = bt.id
      LEFT JOIN "VerseMetadata" vm ON vm."bookName" = bb.name AND vm.chapter = bv.chapter AND vm.verse = bv.verse
      WHERE bv."translationId" = $2
        AND (
          ($3::text IS NULL) OR 
          (vm.author ILIKE $3 OR vm.speaker ILIKE $3) OR
          ($3 ILIKE 'jesus' AND bb.name IN ('Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Revelation'))
        )
        AND ${clause}
      ORDER BY sim DESC
      LIMIT 8
    `;

    const queryParams = [transcript, translationId, speakerFilter || null, ...params];

    const results: any[] = await prisma.$queryRawUnsafe(query, ...queryParams);

    // 3. Filter by similarity threshold and format response
    const candidates = results
      .filter(r => Number(r.sim) >= SIMILARITY_THRESHOLD)
      .slice(0, 5)
      .map(r => ({
        reference: `${r.book_name} ${r.chapter}:${r.verse}`,
        text: cleanScriptureText(r.text),
        translation: r.translation,
        similarity: Math.round(Number(r.sim) * 100),
        source: 'quote' as const,
      }));

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('Quote Match Error:', error);
    return NextResponse.json({ error: 'Failed to match quotation' }, { status: 500 });
  }
}
