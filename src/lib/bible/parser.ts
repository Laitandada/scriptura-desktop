export type DetectionConfidence = "high" | "medium" | "low";

export interface ParsedReference {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  isDefaultedVerse?: boolean;
  confidence: DetectionConfidence;
  originalBookText: string;
  raw: string;
}

export type ReferenceValidator = (book: string, chapter: number, verseStart?: number, verseEnd?: number) => Promise<boolean>;

export const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const BOOK_ALIASES: Record<string, string[]> = {
  Genesis: ["genesis", "genises", "gen sis"],
  Exodus: ["exodus", "exodos", "exit us"],
  Leviticus: ["leviticus", "levy ticus", "levi ticus"],
  Numbers: ["numbers", "number", "numers"],
  Deuteronomy: ["deuteronomy"],
  Joshua: ["joshua", "josua", "josh"],
  Judges: ["judges", "judge"],
  Ruth: ["ruth", "root", "route"],
  "1 Samuel": ["first samuel", "1 samuel", "one samuel", "i samuel", "first sam", "one sam"],
  "2 Samuel": ["second samuel", "2 samuel", "two samuel", "ii samuel", "second sam", "two sam"],
  "1 Kings": ["first kings", "1 kings", "one kings", "i kings", "first king", "one king"],
  "2 Kings": ["second kings", "2 kings", "two kings", "ii kings", "second king", "two king"],
  "1 Chronicles": ["first chronicles", "1 chronicles", "one chronicles", "i chronicles", "first chronicle", "one chronicle", "first chron"],
  "2 Chronicles": ["second chronicles", "2 chronicles", "two chronicles", "ii chronicles", "second chronicle", "two chronicle", "second chron"],
  Ezra: ["ezra", "ezrah"],
  Nehemiah: ["nehemiah", "nehemia"],
  Esther: ["esther", "ester", "esta"],
  Job: ["job", "jobe"],
  Psalms: ["psalm", "psalms", "som", "salm", "songs"],
  Proverbs: ["proverbs", "proverb", "provers"],
  Ecclesiastes: ["ecclesiastes", "ecclesiastics", "ecclesiastis"],
  "Song of Solomon": ["song of solomon", "songs of solomon", "song of songs", "songs of songs", "song solomon"],
  Isaiah: ["isaiah", "isaia", "isiah"],
  Jeremiah: ["jeremiah", "jeremia", "jeremy"],
  Lamentations: ["lamentations", "lamentation"],
  Ezekiel: ["ezekiel", "ezekial"],
  Daniel: ["daniel", "danial", "danielle"],
  Hosea: ["hosea", "hosia", "hoseah"],
  Joel: ["joel", "jewel"],
  Amos: ["amos", "amoss", "almost"],
  Obadiah: ["obadiah", "obadaya", "obadya"],
  Jonah: ["jonah", "jona", "jonas"],
  Micah: ["micah", "mika", "mica"],
  Nahum: ["nahum", "nahom"],
  Habakkuk: ["habakkuk", "habakuk", "habacuc"],
  Zephaniah: ["zephaniah", "zephania"],
  Haggai: ["haggai", "hagai", "haggy"],
  Zechariah: ["zechariah", "zecharia", "zecharias"],
  Malachi: ["malachi", "malakai", "malaki", "malachy"],
  Matthew: ["matthew", "mathew", "matt", "matu"],
  Mark: ["mark", "marc", "mar"],
  Luke: ["luke", "look", "luk", "luuk", "looke"],
  John: ["john", "jon", "jhon"],
  Acts: ["acts", "ax", "act"],
  Romans: ["romans", "roman", "romance", "roamans", "rowmans"],
  "1 Corinthians": ["first corinthians", "1 corinthians", "one corinthians", "i corinthians", "first corinthian", "one corinthian", "first corinth"],
  "2 Corinthians": ["second corinthians", "2 corinthians", "two corinthians", "ii corinthians", "second corinthian", "two corinthian", "second corinth"],
  Galatians: ["galatians", "galatian", "galations", "galatia"],
  Ephesians: ["ephesians", "ephesian", "ephisions"],
  Philippians: ["philippians", "philippian", "filipians"],
  Colossians: ["colossians", "colossian", "colosians"],
  "1 Thessalonians": ["first thessalonians", "1 thessalonians", "one thessalonians", "i thessalonians", "first thessalonian", "one thessalonian", "first thess"],
  "2 Thessalonians": ["second thessalonians", "2 thessalonians", "two thessalonians", "ii thessalonians", "second thessalonian", "two thessalonian", "second thess"],
  "1 Timothy": ["first timothy", "1 timothy", "one timothy", "i timothy", "first tim", "one tim"],
  "2 Timothy": ["second timothy", "2 timothy", "two timothy", "ii timothy", "second tim", "two tim"],
  Titus: ["titus"],
  Philemon: ["philemon", "filemon"],
  Hebrews: ["hebrews", "hebrew"],
  James: ["james", "jaymes"],
  "1 Peter": ["first peter", "1 peter", "one peter", "i peter", "first petter"],
  "2 Peter": ["second peter", "2 peter", "two peter", "ii peter", "second petter"],
  "1 John": ["first john", "1 john", "one john", "i john", "first jon", "one jon"],
  "2 John": ["second john", "2 john", "two john", "ii john", "second jon", "two jon"],
  "3 John": ["third john", "3 john", "three john", "iii john", "third jon", "three jon"],
  Jude: ["jude", "jood"],
  Revelation: ["revelation", "revelations"],
};

const EXACT_MATCH_STRINGS: { canonical: string; text: string }[] = [];
for (const book of BIBLE_BOOKS) {
  EXACT_MATCH_STRINGS.push({ canonical: book, text: book.toLowerCase() });
  if (BOOK_ALIASES[book]) {
    for (const alias of BOOK_ALIASES[book]) {
      EXACT_MATCH_STRINGS.push({ canonical: book, text: alias.toLowerCase() });
    }
  }
}
EXACT_MATCH_STRINGS.sort((a, b) => b.text.length - a.text.length);

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100
};

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function convertWordsToNumbers(text: string): string {
  const cleaned = text.toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\b(uhm+|um+|uh+|ah+|hmm+|like)\b/g, ' ')
    .replace(/-/g, ' - ');
  
  const tokens = cleaned.split(/\s+/);
  const result: string[] = [];
  
  let currentNum = 0;
  let inNumber = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (token === "and" && inNumber && i + 1 < tokens.length && NUMBER_WORDS[tokens[i+1]] !== undefined) {
      continue;
    }

    if (NUMBER_WORDS[token] !== undefined) {
      const val = NUMBER_WORDS[token];
      
      if (inNumber) {
        if (val === 100) {
          currentNum = currentNum === 0 ? 100 : currentNum * 100;
        } else if (currentNum >= 20 && currentNum < 100 && currentNum % 10 === 0 && val >= 1 && val <= 9) {
          // e.g. "twenty" + "three" -> 23
          currentNum += val;
        } else if (currentNum >= 100 && currentNum % 100 === 0 && val < 100) {
          // e.g. "one hundred" + "five" -> 105
          currentNum += val;
        } else {
          // They are independent adjacent numbers (e.g. "three sixteen" or "two nine")
          // Flush the old one
          result.push(currentNum.toString());
          currentNum = val;
        }
      } else {
        inNumber = true;
        currentNum = val;
      }
    } else {
      if (inNumber) {
        result.push(currentNum.toString());
        currentNum = 0;
        inNumber = false;
      }
      result.push(token);
    }
  }

  if (inNumber) {
    result.push(currentNum.toString());
  }

  return result.join(" ").replace(/\s+-\s+/g, '-').replace(/\s*:\s*/g, ':');
}

/**
 * Extracts candidate chapter/verse combinations from a number block suffix.
 */
function generateCandidates(numberBlock: string): { chapter: number, verseStart?: number, verseEnd?: number, isDefaultedVerse?: boolean }[] {
  const clean = numberBlock.trim();
  const candidates: { chapter: number, verseStart?: number, verseEnd?: number, isDefaultedVerse?: boolean }[] = [];

  // Priority 1: Explicit notation "15:3" or "15:3-5"
  const p1 = clean.match(/^(\d+):(\d+)(?:\s*(?:-|to|through|and|,)\s*(\d+))?$/i);
  if (p1) {
    candidates.push({
      chapter: parseInt(p1[1]),
      verseStart: parseInt(p1[2]),
      verseEnd: p1[3] ? parseInt(p1[3]) : undefined,
    });
    return candidates;
  }

  // Priority 1: Explicit spoken format "chapter 15 verse 3 to 5"
  const p2 = clean.match(/^(?:chapter\s+)?(\d+)\s+(?:verses?\s+)(\d+)(?:\s+(?:to|through|-|and|,)\s+(?:verse\s+)?(\d+))?$/i);
  if (p2) {
    candidates.push({
      chapter: parseInt(p2[1]),
      verseStart: parseInt(p2[2]),
      verseEnd: p2[3] ? parseInt(p2[3]) : undefined,
    });
    return candidates;
  }

  // Priority 2: Separate numeric tokens e.g. "8 28" or "8 28 30"
  const separateTokens = clean.match(/^(\d+)\s+(\d+)(?:\s+(?:to|through|-|and|,)\s+(\d+)|\s+(\d+))?$/i);
  if (separateTokens) {
    // "8 28"
    if (!separateTokens[3] && !separateTokens[4]) {
      candidates.push({ chapter: parseInt(separateTokens[1]), verseStart: parseInt(separateTokens[2]) });
      return candidates;
    }
    // "8 28 30" or "8 28 to 30"
    const end = separateTokens[3] || separateTokens[4];
    candidates.push({ chapter: parseInt(separateTokens[1]), verseStart: parseInt(separateTokens[2]), verseEnd: parseInt(end) });
    return candidates;
  }

  // Priority 3: Concatenated numbers "316" or single numbers "23"
  const single = clean.match(/^(\d+)$/);
  if (single) {
    const numStr = single[1];

    // First candidate is always the number itself as a chapter (e.g., "Psalm 23")
    candidates.push({ chapter: parseInt(numStr), isDefaultedVerse: true });

    // Then, generate all possible splits
    for (let i = 1; i < numStr.length; i++) {
      const chapter = parseInt(numStr.substring(0, i));
      const verse = parseInt(numStr.substring(i));
      candidates.push({ chapter, verseStart: verse });
    }
    
    return candidates;
  }

  return candidates;
}

export async function parseReferences(
  text: string, 
  validateRef: ReferenceValidator,
  context?: { book: string, chapter: number }
): Promise<ParsedReference[]> {
  const normalized = convertWordsToNumbers(text);
  const results: ParsedReference[] = [];
  
  const numberBlockRegex = /\b(?:chapter\s+)?(\d+(?:\s*(?:verses?|to|through|and|-|:|,)\s*\d+|\s+\d+)*)\b/gi;
  let match;
  
  while ((match = numberBlockRegex.exec(normalized)) !== null) {
    const prefix = normalized.substring(0, match.index).trim();
    if (!prefix && !context) continue;
    
    const words = prefix ? prefix.split(/\s+/) : [];
    if (words.length === 1 && (words[0] === "verse" || words[0] === "verses")) {
      words.pop();
    }
    const numberBlock = match[1];
    const numberBlockText = (prefix === "verse" || prefix === "verses") ? `${prefix} ${numberBlock}` : numberBlock;
    
    let blockResolved = false;

    // Fast path for context-only parsing (e.g. user just says "verse 5" or "5")
    if (words.length === 0 && context && numberBlockText.trim().length > 0) {
      const cleanNb = numberBlockText.trim();
      let cVerseStart: number | undefined;
      let cVerseEnd: number | undefined;

      const justVerse = cleanNb.match(/^(?:verses?\s+)?(\d+)(?:\s+(?:to|through|-|and|,)\s+(?:verse\s+)?(\d+))?$/i);
      if (justVerse) {
        cVerseStart = parseInt(justVerse[1]);
        if (justVerse[2]) cVerseEnd = parseInt(justVerse[2]);
      }

      if (cVerseStart !== undefined) {
        const isValid = await validateRef(context.book, context.chapter, cVerseStart, cVerseEnd);
        if (isValid) {
          results.push({
            book: context.book,
            chapter: context.chapter,
            verseStart: cVerseStart,
            verseEnd: cVerseEnd,
            confidence: "high",
            originalBookText: context.book,
            raw: text
          });
          blockResolved = true;
          continue; // Move to next numberBlock match
        }
      }
    }

    const candidates = generateCandidates(numberBlockText);
    
    // First, try EXACT matching on the last 1, 2, or 3 words (including ASR aliases)
    for (let wordCount = 3; wordCount >= 1; wordCount--) {
      if (words.length < wordCount) continue;
      const candidateText = words.slice(-wordCount).join(" ").toLowerCase();
      
      const exactMatch = EXACT_MATCH_STRINGS.find(m => m.text === candidateText);
      if (exactMatch) {
        for (const cand of candidates) {
          const isValid = await validateRef(exactMatch.canonical, cand.chapter, cand.verseStart, cand.verseEnd);
          if (isValid) {
            results.push({
              book: exactMatch.canonical,
              chapter: cand.chapter,
              verseStart: cand.verseStart,
              verseEnd: cand.verseEnd,
              isDefaultedVerse: cand.isDefaultedVerse,
              confidence: "high",
              originalBookText: candidateText,
              raw: text
            });
            blockResolved = true;
            break;
          }
        }
      }
      if (blockResolved) break;
    }
    
    if (blockResolved) continue;
    
    // Fallback: FUZZY matching on the last 1, 2, or 3 words
    for (let wordCount = 1; wordCount <= 3; wordCount++) {
      if (words.length < wordCount) continue;
      const candidateText = words.slice(-wordCount).join(" ").toLowerCase();
      
      let bestMatch: string | null = null;
      let minDistance = Infinity;

      for (const bMatch of EXACT_MATCH_STRINGS) {
        if (Math.abs(bMatch.text.length - candidateText.length) > 3) continue;
        const dist = levenshtein(bMatch.text, candidateText);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = bMatch.canonical;
        }
      }

      const threshold = candidateText.length > 10 ? 3 : 2;

      if (minDistance <= threshold && bestMatch) {
        for (const cand of candidates) {
          const isValid = await validateRef(bestMatch, cand.chapter, cand.verseStart, cand.verseEnd);
          if (isValid) {
            results.push({
              book: bestMatch,
              chapter: cand.chapter,
              verseStart: cand.verseStart,
              verseEnd: cand.verseEnd,
              isDefaultedVerse: cand.isDefaultedVerse,
              confidence: "medium",
              originalBookText: candidateText,
              raw: text
            });
            blockResolved = true;
            break;
          }
        }
      }
      if (blockResolved) break;
    }
  }

  // Deduplicate
  const uniqueResults: ParsedReference[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    const key = `${r.book}-${r.chapter}-${r.verseStart}-${r.verseEnd}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(r);
    }
  }

  return uniqueResults;
}

export async function parseReference(
  text: string,
  validateRef: ReferenceValidator
): Promise<ParsedReference | null> {
  const results = await parseReferences(text, validateRef);
  return results.length > 0 ? results[0] : null;
}
