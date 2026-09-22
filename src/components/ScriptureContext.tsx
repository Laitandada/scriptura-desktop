import { useEffect, useState, useRef } from "react";
import { usePresentationStore } from "@/store/presentationStore";
import { BookOpen } from "lucide-react";

interface VerseData {
  verse: number;
  text: string;
  reference: string;
}

interface ChapterData {
  book: string;
  chapter: number;
  translation: string;
  translationId: string;
  verses: VerseData[];
}

export function ScriptureContext() {
  const { state, projectScripture, activeTranslationId } = usePresentationStore();
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Track the active reference components
  const [activeBook, setActiveBook] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [activeVerses, setActiveVerses] = useState<number[]>([]);
  
  const activeVerseRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state.scripture?.reference) return;

    const match = state.scripture.reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
    if (!match) return;

    const book = match[1];
    const chapter = parseInt(match[2], 10);
    const verseStart = parseInt(match[3], 10);
    const verseEnd = match[4] ? parseInt(match[4], 10) : verseStart;
    
    // Generate array of active verses
    const verses = [];
    for (let i = verseStart; i <= verseEnd; i++) {
      verses.push(i);
    }
    
    setActiveBook(book);
    setActiveChapter(chapter);
    setActiveVerses(verses);

    // If chapter and translation haven't changed, don't refetch
    if (chapterData && chapterData.book === book && chapterData.chapter === chapter && chapterData.translationId === activeTranslationId) {
      return;
    }

    const fetchChapter = async () => {
      setIsLoading(true);
      try {
        const url = new URL(`/api/bible/chapter`, window.location.origin);
        url.searchParams.append('book', book);
        url.searchParams.append('chapter', chapter.toString());
        if (activeTranslationId) url.searchParams.append('translationId', activeTranslationId);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setChapterData(data);
        }
      } catch (err) {
        console.error("Failed to load chapter", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChapter();
  }, [state.scripture?.reference, activeTranslationId]);

  useEffect(() => {
    // Scroll active verse into view
    if (activeVerseRef.current && containerRef.current) {
      activeVerseRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [activeVerses, chapterData]);

  if (!chapterData) {
    return (
      <section className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 h-full">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50 flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4" />
          Scripture Context
        </h2>
        <div className="flex-1 flex flex-col items-center justify-center text-white/20">
          <BookOpen className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-sm text-center">Project a scripture to view its full chapter.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden max-h-[850px]">
      <div className="p-4 border-b border-white/10 bg-black/40">
        <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          {chapterData.book.toUpperCase()} {chapterData.chapter}
        </h2>
        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
          {chapterData.verses.length} verses • {chapterData.translation}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar" ref={containerRef}>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-blue-500/50 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          chapterData.verses.map((verseData) => {
            const isActive = activeVerses.includes(verseData.verse);
            return (
              <button
                key={verseData.verse}
                ref={isActive ? activeVerseRef : null}
                onClick={() => projectScripture(verseData.reference, chapterData.translation, verseData.text)}
                className={`w-full text-left p-3 rounded-xl transition-all group border ${
                  isActive 
                    ? "bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.2)]" 
                    : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-bold mt-1 ${isActive ? "text-blue-400" : "text-white/30 group-hover:text-white/50"}`}>
                    {verseData.verse}
                  </span>
                  <p className={`text-sm leading-relaxed ${isActive ? "text-white font-medium" : "text-white/60"}`}>
                    {verseData.text}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
