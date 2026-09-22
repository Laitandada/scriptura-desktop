import { expect, test, describe } from 'vitest';
import { parseReference } from '../parser';

// Mock DB validator for testing candidate disambiguation
const mockValidateRef = async (book: string, chapter: number, verseStart?: number, verseEnd?: number) => {
  if (book === "1 Peter" && chapter === 2 && verseStart === 9) return true;
  if (book === "1 Peter" && chapter === 29 && !verseStart) return false;
  if (book === "John" && chapter === 3 && verseStart === 16) return true;
  if (book === "John" && chapter === 316 && !verseStart) return false;
  if (book === "John" && chapter === 15 && verseStart === 3) return true;
  if (book === "John" && chapter === 15 && verseStart === 3 && verseEnd === 5) return true;
  if (book === "Romans" && chapter === 8 && verseStart === 28) return true;
  if (book === "Romans" && chapter === 8 && verseStart === 28 && verseEnd === 30) return true;
  if (book === "Romans" && chapter === 5 && verseStart === 16) return true;
  if (book === "1 Corinthians" && chapter === 13 && verseStart === 4 && verseEnd === 7) return true;
  if (book === "1 John" && chapter === 4 && verseStart === 8) return true;
  if (book === "Matthew" && chapter === 6 && verseStart === 33) return true;
  
  // Single chapter tests
  if (book === "Psalms" && chapter === 23 && !verseStart) return true; // Psalm 23 exists
  if (book === "Psalms" && chapter === 2 && verseStart === 3) return true; // Psalm 2:3 exists
  if (book === "Psalms" && chapter === 23 && verseStart === 1) return true; // Psalm 23:1 exists

  if (book === "John" && chapter === 3 && !verseStart) return true; // John 3 exists
  if (book === "John" && chapter === 99) return false;

  return false;
};

describe('Voice Reference Parser (Concatenated & Ambiguous)', () => {
  test('Exact separated notations', async () => {
    expect(await parseReference("John 3 16", mockValidateRef)).toMatchObject({ book: "John", chapter: 3, verseStart: 16 });
    expect(await parseReference("Romans 8 28", mockValidateRef)).toMatchObject({ book: "Romans", chapter: 8, verseStart: 28 });
    expect(await parseReference("Matthew 6 33", mockValidateRef)).toMatchObject({ book: "Matthew", chapter: 6, verseStart: 33 });
    expect(await parseReference("First Peter 2 9", mockValidateRef)).toMatchObject({ book: "1 Peter", chapter: 2, verseStart: 9 });
  });

  test('Concatenated numbers', async () => {
    expect(await parseReference("John 316", mockValidateRef)).toMatchObject({ book: "John", chapter: 3, verseStart: 16 });
    expect(await parseReference("Romans 828", mockValidateRef)).toMatchObject({ book: "Romans", chapter: 8, verseStart: 28 });
    expect(await parseReference("First Peter 29", mockValidateRef)).toMatchObject({ book: "1 Peter", chapter: 2, verseStart: 9 });
  });

  test('Chapter-only preservation', async () => {
    // "Psalm 23" -> candidates: [{chapter: 23}, {chapter: 2, verseStart: 3}]. 
    // chapter 23 exists, so it should stop at {chapter: 23}.
    expect(await parseReference("Psalm 23", mockValidateRef)).toMatchObject({ book: "Psalms", chapter: 23, verseStart: undefined });
    expect(await parseReference("John 3", mockValidateRef)).toMatchObject({ book: "John", chapter: 3, verseStart: undefined });
  });

  test('Chapter+Verse for single chapter books', async () => {
    expect(await parseReference("Psalm 23 1", mockValidateRef)).toMatchObject({ book: "Psalms", chapter: 23, verseStart: 1 });
  });

  test('Spoken numbers and words', async () => {
    expect(await parseReference("First Peter two nine", mockValidateRef)).toMatchObject({ book: "1 Peter", chapter: 2, verseStart: 9 });
    expect(await parseReference("First Peter chapter 2 verse 9", mockValidateRef)).toMatchObject({ book: "1 Peter", chapter: 2, verseStart: 9 });
    expect(await parseReference("First Peter chapter two verse nine", mockValidateRef)).toMatchObject({ book: "1 Peter", chapter: 2, verseStart: 9 });
    expect(await parseReference("Matthew six thirty three", mockValidateRef)).toMatchObject({ book: "Matthew", chapter: 6, verseStart: 33 });
  });

  test('Fuzzy matching combined with separated/concatenated', async () => {
    // Fuzzy word "humans", dist 2 to Romans, concatenated 516
    expect(await parseReference("humans 5 16", mockValidateRef)).toMatchObject({ book: "Romans", chapter: 5, verseStart: 16 });
  });

  test('Invalid cases do not guess incorrectly', async () => {
    // 99 doesn't exist
    expect(await parseReference("John 99 verse 3", mockValidateRef)).toBeNull();
    // 999 doesn't exist
    expect(await parseReference("John 3 verse 999", mockValidateRef)).toBeNull();
    // Non-existent book
    expect(await parseReference("NotABibleBook 3 verse 16", mockValidateRef)).toBeNull();
  });
});

