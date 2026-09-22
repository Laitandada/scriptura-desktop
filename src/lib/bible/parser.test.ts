import { describe, test, expect } from 'vitest';
import { parseReferences } from './parser';

// Mock validator that rejects chapter > 150 (Psalms limit) or specific invalid ones
const mockValidator = async (book: string, chapter: number, verseStart?: number, verseEnd?: number) => {
  if (book === 'Luke' && chapter > 24) return false;
  if (book === '1 Peter' && chapter > 5) return false;
  if (chapter > 150) return false;
  return true;
};

describe('parseReferences', () => {
  test('single explicit reference', async () => {
    const results = await parseReferences("let's turn to John chapter 3 verse 16", mockValidator);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ book: 'John', chapter: 3, verseStart: 16 });
  });

  test('two references', async () => {
    const results = await parseReferences("John 3:16 and Romans 8:28", mockValidator);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ book: 'John', chapter: 3, verseStart: 16 });
    expect(results[1]).toMatchObject({ book: 'Romans', chapter: 8, verseStart: 28 });
  });

  test('three references', async () => {
    const results = await parseReferences("Matthew 5:3-5, John 3:16 and Romans 8:28", mockValidator);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ book: 'Matthew', chapter: 5, verseStart: 3, verseEnd: 5 });
    expect(results[1]).toMatchObject({ book: 'John', chapter: 3, verseStart: 16 });
    expect(results[2]).toMatchObject({ book: 'Romans', chapter: 8, verseStart: 28 });
  });

  test('chapter-only references', async () => {
    const results = await parseReferences("Psalm 23 and Psalm 91", mockValidator);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ book: 'Psalms', chapter: 23 });
    expect(results[1]).toMatchObject({ book: 'Psalms', chapter: 91 });
  });

  test('ranges with "and"', async () => {
    const results = await parseReferences("John 3:16 and 17", mockValidator);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 });
  });

  test('repeated references (deduplication)', async () => {
    const results = await parseReferences("John 3:16 and John 3:16", mockValidator);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ book: 'John', chapter: 3, verseStart: 16 });
  });

  test('Nigerian/STT aliases and fuzzy matching', async () => {
    const results = await parseReferences("look 11 33 and Filipians 4 13", mockValidator);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ book: 'Luke', chapter: 11, verseStart: 33 });
    expect(results[1]).toMatchObject({ book: 'Philippians', chapter: 4, verseStart: 13 });
  });

  test('invalid references are rejected', async () => {
    const results = await parseReferences("Luke 25:40-41", mockValidator);
    expect(results).toHaveLength(0); // Luke only has 24 chapters, rejected by mock validator
  });

  test('ambiguous / mixed formats', async () => {
    const results = await parseReferences("John 3:16, Romans 8 28 and first Peter 29", mockValidator);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ book: 'John', chapter: 3, verseStart: 16 });
    expect(results[1]).toMatchObject({ book: 'Romans', chapter: 8, verseStart: 28 });
    expect(results[2]).toMatchObject({ book: '1 Peter', chapter: 2, verseStart: 9 }); // "29" parsed as 2:9
  });
});
