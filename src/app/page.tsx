"use client";

import { useState, useEffect, useRef } from "react";
import { usePresentationStore, PresentationStateData } from "@/store/presentationStore";
import toast from "react-hot-toast";
import { Search, MonitorPlay, History, Settings, Image as ImageIcon, Video, PowerOff, UploadCloud, PlayCircle, StopCircle, Mic, MicOff, AlertCircle, X, ChevronLeft, ChevronRight, ExternalLink, Play, Pause, Repeat, RotateCcw, Trash2, Sliders } from "lucide-react";
import { BrowserSpeechProvider } from "@/lib/voice/BrowserSpeechProvider";
import { parseReferences, BIBLE_BOOKS } from "@/lib/bible/parser";
import { ScriptureContext } from "@/components/ScriptureContext";
import { PresentationContext } from "@/components/PresentationContext";
import { PresentationView } from "@/components/PresentationView";
import { FormatTextModal } from "@/components/FormatTextModal";
import { SettingsModal } from "@/components/SettingsModal";
import { OutputStatus } from "@/types/scriptura";

// Helper to intelligently deduplicate and merge scripture queues
const mergeScriptureQueues = (newItems: any[], prevItems: any[]) => {
  const getBaseRef = (ref: string) => ref.split(':')[0]; // "Daniel 12"
  const hasVerse = (ref: string) => ref.includes(':');

  let merged = [...newItems, ...prevItems];
  let finalQueue: any[] = [];

  for (const item of merged) {
    const baseRef = getBaseRef(item.reference);
    const itemHasVerse = hasVerse(item.reference);

    // Find if we already have this exact reference
    if (finalQueue.some(t => t.reference === item.reference)) {
      continue;
    }

    // Check if we have a defaulted version that should be replaced by a specific one
    const existingIdx = finalQueue.findIndex(t => getBaseRef(t.reference) === baseRef);
    if (existingIdx !== -1) {
      const existing = finalQueue[existingIdx];

      if (!existing.isDefaultedVerse && item.isDefaultedVerse) {
        // Queue has explicit "Acts 10:5", item is defaulted "Acts 10:1" (from silence). Ignore the defaulted one.
        continue;
      }
      if (existing.isDefaultedVerse && !item.isDefaultedVerse) {
        // Queue has defaulted "Acts 10:1", item is explicit "Acts 10:5". Replace the defaulted one!
        finalQueue[existingIdx] = item;
        continue;
      }
      // If BOTH are explicit, we already skipped the exact match check above.
      // So this means they are different explicit verses (e.g. Acts 10:5 and Acts 10:8). We keep both!
    }

    finalQueue.push(item);
  }

  return finalQueue.slice(0, 3);
};

export default function Dashboard() {
  const {
    state, activeSessionId, setActiveSessionId, projectScripture,
    blackScreen, clearScreen, setBackground, setState,
    activeTranslationId, setActiveTranslationId, sendVideoCommand
  } = usePresentationStore();

  // Video Controls State
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoLoop, setVideoLoop] = useState(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const [translations, setTranslations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Manual Search State
  const [activeSearchTab, setActiveSearchTab] = useState<'manual' | 'search'>('manual');
  const [manualBook, setManualBook] = useState("Genesis");
  const [manualChapter, setManualChapter] = useState("1");
  const [manualVerse, setManualVerse] = useState("1");
  const [editingField, setEditingField] = useState<'book' | 'chapter' | 'verse' | null>(null);

  const [session, setSession] = useState<any>(null);
  const [isSessionToggling, setIsSessionToggling] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [outputStatus, setOutputStatus] = useState<OutputStatus | null>(null);

  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaModalTab, setMediaModalTab] = useState<'images' | 'videos'>('images');

  const [isProjectorLive, setIsProjectorLive] = useState(false);

  const [deleteMediaPrompt, setDeleteMediaPrompt] = useState<{ id: string, filename: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [mediaItems, setMediaItems] = useState<any[]>([]);

  // Presentation Folders State
  const [presentationFolders, setPresentationFolders] = useState<any[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [mediaViewTab, setMediaViewTab] = useState<'backgrounds' | 'presentations'>('backgrounds');

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastVoiceCommandTimeRef = useRef<number>(0);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [detectedVoiceScriptures, setDetectedVoiceScriptures] = useState<any[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const speechProvider = useRef<BrowserSpeechProvider | null>(null);
  const lastDetectedRef = useRef<string>("");
  const voiceQueueRef = useRef<any[]>([]);

  useEffect(() => {
    voiceQueueRef.current = detectedVoiceScriptures;
  }, [detectedVoiceScriptures]);

  // Auto-clear voice errors after 5 seconds
  useEffect(() => {
    if (voiceError) {
      const timer = setTimeout(() => setVoiceError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [voiceError]);

  const handleAdjacentScripture = async (direction: 'next' | 'prev') => {
    const currentState = usePresentationStore.getState().state;
    const currentTranslationId = usePresentationStore.getState().activeTranslationId;

    // --- Presentation Slide Navigation ---
    if (currentState.type === 'presentation' && currentState.presentation) {
      try {
        const p = currentState.presentation;
        const res = await fetch('/api/presentation-folders');
        const data = await res.json();
        const folder = data.folders?.find((f: any) => f.id === p.folderId);
        if (!folder || !folder.media || folder.media.length === 0) return;

        const mediaList = folder.media;
        const currentIndex = mediaList.findIndex((m: any) => m.id === p.mediaId);

        let targetIndex = currentIndex;
        if (direction === 'next') targetIndex = Math.min(mediaList.length - 1, currentIndex + 1);
        if (direction === 'prev') targetIndex = Math.max(0, currentIndex - 1);

        if (targetIndex !== currentIndex) {
          const slide = mediaList[targetIndex];
          usePresentationStore.getState().projectPresentationSlide(
            p.folderId,
            p.folderName,
            slide.id,
            slide.type === 'IMAGE' ? 'image' : 'video',
            slide.path
          );
        }
      } catch (e) {
        console.error('Failed to navigate presentation slides', e);
      }
      return;
    }

    // --- Scripture Navigation ---
    if (!currentState.scripture?.reference) return;

    // Parse current reference (e.g., "Romans 5:1" or "Romans 5:1-3")
    const match = currentState.scripture.reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
    if (!match) return;

    const book = match[1];
    const chapter = parseInt(match[2], 10);
    // If going next from Romans 5:1-3, we want verse 4, so we base it on verseEnd if it exists
    const verse = direction === 'next'
      ? parseInt(match[4] || match[3], 10)
      : parseInt(match[3], 10);

    try {
      const url = new URL('/api/bible/adjacent', window.location.origin);
      url.searchParams.append('book', book);
      url.searchParams.append('chapter', chapter.toString());
      url.searchParams.append('verse', verse.toString());
      url.searchParams.append('direction', direction);
      if (currentTranslationId) url.searchParams.append('translationId', currentTranslationId);
      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.result) {
        projectScripture(data.result.reference, data.result.translation, data.result.text);
      }
    } catch (e) {
      console.error('Failed to fetch adjacent scripture', e);
    }
  };

  // Track previous translation ID to only update live projection when user explicitly changes translation
  const prevTranslationIdRef = useRef<string | null>(null);
  const isUpdatingTranslationRef = useRef(false);

  useEffect(() => {
    if (!activeTranslationId) return;

    // Skip on initial load — just record the initial value
    if (prevTranslationIdRef.current === null) {
      prevTranslationIdRef.current = activeTranslationId;
      return;
    }

    // Skip if the ID hasn't actually changed
    if (prevTranslationIdRef.current === activeTranslationId) return;
    prevTranslationIdRef.current = activeTranslationId;

    // Prevent re-entrant calls (projectScripture triggers state changes that could cascade)
    if (isUpdatingTranslationRef.current) return;

    // Read current state directly from the store to avoid stale closure
    const currentState = usePresentationStore.getState().state;
    if (!currentState.scripture?.reference) return;

    isUpdatingTranslationRef.current = true;

    const updateLiveTranslation = async () => {
      const match = currentState.scripture!.reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
      if (!match) {
        isUpdatingTranslationRef.current = false;
        return;
      }

      const book = match[1];
      const chapter = parseInt(match[2], 10);
      const verseStart = parseInt(match[3], 10);
      const verseEnd = match[4] ? parseInt(match[4], 10) : undefined;

      try {
        const url = new URL('/api/bible/search', window.location.origin);
        url.searchParams.append('book', book);
        url.searchParams.append('chapter', chapter.toString());
        url.searchParams.append('verseStart', verseStart.toString());
        if (verseEnd) url.searchParams.append('verseEnd', verseEnd.toString());
        url.searchParams.append('translationId', activeTranslationId);

        const res = await fetch(url.toString());
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          projectScripture(result.reference, result.translation || "WEB", result.text);
        }
      } catch (e) {
        console.error("Failed to update live translation", e);
      } finally {
        // Allow future updates after a short delay to let the state settle
        setTimeout(() => { isUpdatingTranslationRef.current = false; }, 300);
      }
    };

    updateLiveTranslation();
  }, [activeTranslationId, projectScripture]);

  // Projector Heartbeat & Live State Sync
  useEffect(() => {
    const channel = new BroadcastChannel('scriptura-presentation-sync');
    let lastPong = 0;

    channel.onmessage = (e) => {
      if (e.data?.type === 'PONG') {
        const wasDisconnected = Date.now() - lastPong >= 2500;
        lastPong = Date.now();
        // If projector just came online/reconnected, sync active state immediately
        if (wasDisconnected) {
          channel.postMessage({ type: 'SYNC_STATE', state: usePresentationStore.getState().state });
        }
      } else if (e.data?.type === 'REQUEST_STATE') {
        // Projector explicitly requested current state upon opening
        channel.postMessage({ type: 'SYNC_STATE', state: usePresentationStore.getState().state });
      }
    };

    const interval = setInterval(() => {
      channel.postMessage({ type: 'PING' });
      setIsProjectorLive(Date.now() - lastPong < 2500);
    }, 1000);

    return () => {
      clearInterval(interval);
      channel.close();
    };
  }, []);

  // Listen for native Electron output status changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.scriptura?.outputs) {
      window.scriptura.outputs.getStatus().then(setOutputStatus).catch(console.error);
      const unbind = window.scriptura.outputs.onStatusChanged((newStatus) => {
        setOutputStatus(newStatus);
      });
      return () => unbind();
    }
  }, []);

  useEffect(() => {
    // Load current state
    fetch("/api/presentation/current")
      .then((res) => res.json())
      .then((data) => {
        if (data.type) setState(data);
      })
      .catch(console.error);

    // Load active session
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        const active = data.sessions?.find((s: any) => !s.endTime);
        if (active) {
          setActiveSessionId(active.id);
          setSession(active);
        } else if (data.activeSession) {
          setSession(data.activeSession);
          setActiveSessionId(data.activeSession.id);
          loadHistory(data.activeSession.id);
        }
      })
      .catch(console.error);

    // Load translations
    fetch("/api/bible/translations")
      .then((res) => res.json())
      .then((data) => {
        if (data.translations && data.translations.length > 0) {
          setTranslations(data.translations);

          let targetId: string | null = null;

          // Priority 1: User's explicitly saved preference in localStorage
          if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('scriptura_active_translation_id');
            if (saved && data.translations.some((t: any) => t.id === saved)) {
              targetId = saved;
            }
          }

          // Priority 2: Match from current presentation state (if any)
          if (!targetId) {
            const currentState = usePresentationStore.getState().state;
            if (currentState.scripture?.translation) {
              const match = data.translations.find(
                (t: any) => t.abbreviation.toUpperCase() === currentState.scripture!.translation.toUpperCase()
              );
              if (match) targetId = match.id;
            }
          }

          // Priority 3: Default to KJV or first available
          if (!targetId) {
            const kjv = data.translations.find((t: any) => t.abbreviation.toUpperCase() === 'KJV');
            targetId = kjv ? kjv.id : data.translations[0].id;
          }

          if (targetId) {
            setActiveTranslationId(targetId);
          }
        }
      })
      .catch(console.error);

    // Load media and folders
    fetch("/api/media")
      .then(r => r.json())
      .then(data => setMediaItems(data.media || []))
      .catch(console.error);

    fetch("/api/presentation-folders")
      .then(r => r.json())
      .then(data => setPresentationFolders(data.folders || []))
      .catch(console.error);

    // Initialize Voice Provider
    speechProvider.current = new BrowserSpeechProvider();
    if (!speechProvider.current.isSupported()) {
      setVoiceError("Voice recognition is not supported in this browser.");
    } else {
      let currentTranscriptValidationError: string | null = null;

      const validateCandidate = async (book: string, chapter: number, verseStart?: number, verseEnd?: number) => {
        const url = new URL('/api/bible/search', window.location.origin);
        url.searchParams.append('book', book);
        url.searchParams.append('chapter', chapter.toString());
        if (verseStart) url.searchParams.append('verseStart', verseStart.toString());
        if (verseEnd) url.searchParams.append('verseEnd', verseEnd.toString());

        const currentTransId = usePresentationStore.getState().activeTranslationId;
        if (currentTransId) url.searchParams.append('translationId', currentTransId);

        try {
          const res = await fetch(url.toString());
          const data = await res.json();
          if (data.error) {
            currentTranscriptValidationError = data.error;
          } else {
            currentTranscriptValidationError = null;
          }
          return data.results && data.results.length > 0;
        } catch (err) {
          return false;
        }
      };

      speechProvider.current.onTranscript(async (text, isFinal) => {
        setVoiceTranscript(text);

        if (usePresentationStore.getState().state.type === 'black') { }

        const lowerText = text.toLowerCase();

        // --- Voice Commands ---
        const now = Date.now();
        const currentState = usePresentationStore.getState().state;
        if ((currentState.type === 'scripture' || currentState.type === 'presentation') && (now - lastVoiceCommandTimeRef.current > 3000)) {
          if (/\b(?:next verse|go to the next verse|next one|read the next verse)\b/.test(lowerText)) {
            lastVoiceCommandTimeRef.current = now;
            handleAdjacentScripture('next');
            toast.success("Voice command: Next Verse");
            return;
          }
          if (/\b(?:previous verse|go back a verse|previous one|read the previous verse)\b/.test(lowerText)) {
            lastVoiceCommandTimeRef.current = now;
            handleAdjacentScripture('prev');
            toast.success("Voice command: Previous Verse");
            return;
          }
        }

        const wakeMatch = lowerText.match(/(?:the bible says|the scripture says|it is written)\s+(.+)/i);

        if (wakeMatch && isFinal && wakeMatch[1].trim().length > 10) {
          const quote = wakeMatch[1].trim();
          setIsRecovering(true);
          try {
            const res = await fetch('/api/ai/scripture-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: quote, translationId: usePresentationStore.getState().activeTranslationId })
            });
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              if (data.results.length > 0) {
                setDetectedVoiceScriptures(prev => {
                  const newScriptures = data.results.map((r: any) => ({ ...r, source: 'ai' }));
                  return mergeScriptureQueues(newScriptures, prev);
                });
              }
            } else {
              setVoiceError(`Could not find a matching scripture for: "${quote}"`);
            }
          } catch (e) {
            setVoiceError("Semantic search unavailable.");
          } finally {
            setIsRecovering(false);
          }
          return; // Skip normal parser
        }

        currentTranscriptValidationError = null;
        // Extract context from the most recent detected scripture
        let context: { book: string, chapter: number } | undefined;
        if (voiceQueueRef.current.length > 0) {
          const latest = voiceQueueRef.current[0].reference;
          const match = latest.match(/^(.+?)\s+(\d+)(?::\d+)?$/);
          if (match) {
            context = { book: match[1], chapter: parseInt(match[2], 10) };
          }
        }

        const parsedResults = await parseReferences(text, validateCandidate, context);

        if (parsedResults && parsedResults.length > 0) {
          // Clear any previous fallback UI
          setVoiceError(null);
          setIsRecovering(false);

          // Deduplication: prevent repeated queries for the exact same parsed result(s)
          const refKey = parsedResults.map(p => `${p.book}-${p.chapter}-${p.verseStart}-${p.verseEnd}`).join('|');
          if (lastDetectedRef.current === refKey) return;

          lastDetectedRef.current = refKey;
          setTimeout(() => { if (lastDetectedRef.current === refKey) lastDetectedRef.current = ""; }, 3000); // Debounce cooldown

          // Re-fetch the final full text for all confirmed candidates.
          // IMPORTANT: For verse ranges (e.g. Genesis 20:1-9) we only PROJECT the
          // first verse so the screen isn't overloaded with text. The full range is
          // stored as `verseRangeEnd` on the result so ScriptureContext can still
          // highlight all the verses in the list.
          const fullResults = await Promise.all(parsedResults.map(async (parsed) => {
            const url = new URL('/api/bible/search', window.location.origin);
            url.searchParams.append('book', parsed.book);
            url.searchParams.append('chapter', parsed.chapter.toString());
            if (parsed.verseStart) url.searchParams.append('verseStart', parsed.verseStart.toString());
            // Do NOT send verseEnd here — we project only the first verse of the range.
            // verseEnd is preserved separately so the UI can highlight the full range.
            const currentTransId = usePresentationStore.getState().activeTranslationId;
            if (currentTransId) url.searchParams.append('translationId', currentTransId);

            try {
              const res = await fetch(url.toString());
              const data = await res.json();
              if (data.results && data.results.length > 0) {
                return {
                  ...data.results[0],
                  confidence: parsed.confidence,
                  originalText: parsed.originalBookText,
                  source: 'parser',
                  isDefaultedVerse: parsed.isDefaultedVerse,
                  // Preserve the range end so ScriptureContext can highlight all verses
                  verseRangeEnd: parsed.verseEnd ?? null,
                };
              }
            } catch (err) {
              console.error(err);
            }
            return null;
          }));

          const validFullResults = fullResults.filter(Boolean);

          if (validFullResults.length > 0) {
            setDetectedVoiceScriptures(prev => mergeScriptureQueues(validFullResults, prev));
          }
        } else if (isFinal) {
          // If we had a specific validation error from the database (e.g. verse doesn't exist)
          if (currentTranscriptValidationError) {
            toast.error(currentTranscriptValidationError);
            setVoiceError(currentTranscriptValidationError);
            return;
          }

          // Heuristic: Only hit the AI if the sentence actually looks like it *might* be a reference.
          // This prevents sending every single sentence of normal preaching to the AI.
          const hasNumber = /\d/.test(text) || /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty)\b/i.test(text);
          const hasKeyword = /\b(chapter|verse|scripture|bible|book|read|turn to|somewhere in)\b/i.test(text);

          if (!hasNumber && !hasKeyword) {
            // It's just normal talking without any numbers or scripture keywords.
            // Don't waste AI tokens.
            setVoiceError(null);
            return;
          }

          // L3 AI Fallback
          setIsRecovering(true);
          try {
            const res = await fetch('/api/ai/voice-recovery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transcript: text, translationId: activeTranslationId })
            });
            const data = await res.json();

            if (data.candidates && data.candidates.length > 0) {
              setDetectedVoiceScriptures(prev => {
                const newScriptures = data.candidates.map((c: any) => ({ ...c, source: 'ai' }));
                return mergeScriptureQueues(newScriptures, prev);
              });
            } else {
              setVoiceError(`Could not identify a scripture reference.\nTry saying: "Romans chapter 5 verse 16"`);
            }
          } catch (e) {
            setVoiceError("Voice recovery unavailable. Please use manual scripture search.");
          } finally {
            setIsRecovering(false);
          }
        }

      });
      speechProvider.current.onError((err) => {
        if (err.message !== 'no-speech') {
          setVoiceError(`Microphone error: ${err.message}`);
          setIsListening(false);
        }
      });
    }

    return () => {
      if (speechProvider.current) {
        speechProvider.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveSessionId]);

  const loadHistory = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/history?sessionId=${sessionId}`);
      const data = await res.json();
      setHistory(data.events || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Poll history occasionally if active session exists
  // For a tighter integration, history would be updated upon local projection too, 
  // but a simple interval ensures we catch updates if multiple operators exist.
  useEffect(() => {
    if (!activeSessionId) return;
    const interval = setInterval(() => loadHistory(activeSessionId), 5000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "b":
          blackScreen();
          break;
        case "escape":
          clearScreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blackScreen, clearScreen]);

  const [bookInput, setBookInput] = useState("");
  const bookInputRef = useRef<HTMLInputElement>(null);
  const chapterInputRef = useRef<HTMLInputElement>(null);
  const verseInputRef = useRef<HTMLInputElement>(null);

  const predictedBook = bookInput ? BIBLE_BOOKS.find(b => b.toLowerCase().startsWith(bookInput.toLowerCase())) : "";
  const presentationWindowRef = useRef<Window | null>(null);

  const handleLaunchProjector = async () => {
    // --- Toggle OFF: If projector is already live, close it ---
    if (isProjectorLive) {
      // Electron path
      if (typeof window !== 'undefined' && window.scriptura?.outputs) {
        try {
          await window.scriptura.outputs.closeMain();
        } catch (err) {
          console.error("Failed to close native projector:", err);
        }
        return;
      }
      // Web browser fallback: close the popup
      if (presentationWindowRef.current && !presentationWindowRef.current.closed) {
        presentationWindowRef.current.close();
        presentationWindowRef.current = null;
      }
      return;
    }

    // --- Toggle ON: Open the projector ---
    const currentState = usePresentationStore.getState().state;
    const channel = new BroadcastChannel('scriptura-presentation-sync');
    channel.postMessage({ type: 'SYNC_STATE', state: currentState });

    // Check if we're running inside the Electron wrapper
    if (typeof window !== 'undefined' && window.scriptura?.outputs) {
      try {
        const res = await window.scriptura.outputs.openMain();
        if (!res.success && res.error === 'Configured display unavailable') {
          toast.error('Configured display unavailable. Opening settings...');
          setIsSettingsOpen(true);
        }
        setTimeout(() => {
          channel.postMessage({ type: 'SYNC_STATE', state: usePresentationStore.getState().state });
          channel.close();
        }, 600);
        return;
      } catch (err) {
        console.error("Failed to launch native projector:", err);
      }
    }

    // --- Web Browser Fallback Below ---
    const url = '/presentation';
    let win: Window | null = null;

    // Try the Window Management API to place the window on the external screen
    if ('getScreenDetails' in window) {
      try {
        // @ts-ignore - Window Management API
        const screenDetails = await window.getScreenDetails();
        const externalScreen = screenDetails.screens.find((s: any) => s !== screenDetails.currentScreen) || screenDetails.currentScreen;

        // Open as a popup (no toolbar/menubar) sized to fill the external screen
        win = window.open(
          url,
          'Presentation',
          `popup,left=${externalScreen.availLeft},top=${externalScreen.availTop},width=${externalScreen.availWidth},height=${externalScreen.availHeight}`
        );
      } catch {
        // Window Management API denied or unavailable — fall through to basic open
      }
    }

    // Fallback: open a regular popup if the Window Management path didn't work
    if (!win || win.closed) {
      win = window.open(url, 'Presentation', 'popup,width=1280,height=720,resizable=yes');
    }

    if (win) {
      presentationWindowRef.current = win;
      win.focus();
      // Tell the presentation window to enter fullscreen & sync state once loaded
      setTimeout(() => {
        channel.postMessage({ type: 'SYNC_STATE', state: usePresentationStore.getState().state });
        channel.postMessage({ type: 'FULLSCREEN_REQUEST' });
        channel.close();
      }, 600);
    }
  };

  const handleManualProject = async (overrideBook?: string, overrideChapter?: string, overrideVerse?: string) => {
    try {
      const b = overrideBook || manualBook;
      const c = overrideChapter || manualChapter;
      const v = overrideVerse || manualVerse;

      const url = new URL('/api/bible/search', window.location.origin);
      url.searchParams.append('book', b);
      url.searchParams.append('chapter', c);
      url.searchParams.append('verseStart', v);
      if (activeTranslationId) url.searchParams.append('translationId', activeTranslationId);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        projectScripture(result.reference, result.translation || activeTranslationId || "WEB", result.text);
        setTimeout(() => { if (activeSessionId) loadHistory(activeSessionId) }, 500);
      } else {
        toast.error("Scripture not found in database.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to project manual scripture.");
    }
  };

  // Resets the manual entry fields back to whatever is currently projected.
  // Parses references like "Psalms 91:1", "John 3:16", "1 Kings 22:1-3".
  const handleCancelManual = () => {
    setEditingField(null);
    const ref = state.scripture?.reference;
    if (!ref) {
      setManualBook("Genesis");
      setManualChapter("1");
      setManualVerse("1");
      setBookInput("");
      return;
    }
    // Reference format: "<Book Name> <chapter>:<verseStart>" or "<Book> <chapter>:<vs>-<ve>"
    // The chapter:verse block is always the last whitespace-delimited token.
    const parts = ref.trim().split(/\s+/);
    const cvPart = parts[parts.length - 1]; // e.g. "91:1" or "3:16"
    const bookPart = parts.slice(0, -1).join(' '); // e.g. "Psalms" or "1 Kings"
    const [chapterStr, verseStr] = cvPart.split(':');
    const verseOnly = (verseStr || '1').split('-')[0]; // take only start verse of a range
    setManualBook(bookPart || "Genesis");
    setManualChapter(chapterStr || "1");
    setManualVerse(verseOnly || "1");
    setBookInput("");
  };

  const handleManualKeyDown = (e: React.KeyboardEvent, field: 'book' | 'chapter' | 'verse') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      let finalBook = manualBook;
      let finalChapter = manualChapter;
      let finalVerse = manualVerse;

      if (field === 'book') {
        if (predictedBook) finalBook = predictedBook;
        else if (BIBLE_BOOKS.includes(bookInput)) finalBook = bookInput;
        setManualBook(finalBook);
      } else if (field === 'chapter') {
        finalChapter = manualChapter;
      } else if (field === 'verse') {
        finalVerse = manualVerse;
      }

      setEditingField(null);
      handleManualProject(finalBook, finalChapter, finalVerse);
    } else if (e.key === 'Escape') {
      setEditingField(null);
    } else if (e.key === 'Tab' || e.key === ' ') {
      // Space and Tab both advance through Book → Chapter → Verse.
      // Edge-case: In the book field, Space is used inside numbered book names
      // (e.g. "1 Kings"). We only intercept Space here when the current typed
      // value already resolves to a known book — otherwise let it type normally
      // so the operator can finish typing "1 Kings", "2 Chronicles" etc.
      if (e.key === ' ' && field === 'book') {
        const resolvedBook = predictedBook ||
          (BIBLE_BOOKS.find(b => b.toLowerCase() === bookInput.trim().toLowerCase()) ?? null);
        if (!resolvedBook) {
          // Not yet a complete book name — let the space character through
          return;
        }
      }
      e.preventDefault();
      if (field === 'book') {
        if (predictedBook) setManualBook(predictedBook);
        else if (BIBLE_BOOKS.includes(bookInput)) setManualBook(bookInput);
        setEditingField('chapter');
        setManualChapter("");
      } else if (field === 'chapter') {
        setEditingField('verse');
        setManualVerse("");
      }
      // In the verse field, Space does nothing (Enter projects)
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const url = new URL('/api/bible/search', window.location.origin);
      url.searchParams.append('q', searchQuery);
      if (activeTranslationId) url.searchParams.append('translationId', activeTranslationId);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/ai/scripture-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, translationId: activeTranslationId })
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSessionToggle = async () => {
    if (isSessionToggling) return;
    setIsSessionToggling(true);
    try {
      if (session) {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end" })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          toast.error(data.error || "Failed to end service session");
          return;
        }
        setSession(null);
        setActiveSessionId(null);
        setHistory([]);
        toast.success("Service session ended");
      } else {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", name: `${today} Service` })
        });
        const data = await res.json();
        if (!res.ok || !data?.session?.id) {
          toast.error(data?.error || "Failed to start service session. Please verify database connection.");
          return;
        }
        setSession(data.session);
        setActiveSessionId(data.session.id);
        toast.success(`Service session started: ${data.session.name}`);
      }
    } catch (err) {
      console.error("Session toggle error:", err);
      toast.error("Network error while updating service session");
    } finally {
      setIsSessionToggling(false);
    }
  };

  const confirmDeleteMedia = async () => {
    if (!deleteMediaPrompt) return;
    const { id, filename } = deleteMediaPrompt;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMediaItems(prev => prev.filter(m => m.id !== id));
        if (state.background?.url && mediaItems.find(m => m.id === id)?.path === state.background.url) {
          setBackground('none');
        }
        toast.success(`Deleted "${filename}" successfully`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete media');
    } finally {
      setIsDeleting(false);
      setDeleteMediaPrompt(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Step 1: Get presigned URL
      const presignRes = await fetch('/api/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error || 'Failed to get upload URL');

      const { signedUrl, publicUrl } = presignData;

      // Step 2: Upload file directly to Cloudflare R2
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error('Failed to upload file to storage');

      // Step 3: Save media record to DB
      const type = file.type.startsWith('image/') ? 'IMAGE' : 'VIDEO';
      const saveRes = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, type, publicUrl, folderId: activeFolderId }),
      });
      const saveData = await saveRes.json();

      if (saveData.media) {
        if (activeFolderId) {
          // If we are in a folder, update the folders state
          setPresentationFolders(prev => prev.map(f =>
            f.id === activeFolderId ? { ...f, media: [...(f.media || []), saveData.media] } : f
          ));
        } else {
          // Loose media
          setMediaItems([saveData.media, ...mediaItems]);
        }
      } else {
        alert(saveData.error || "Failed to save media record");
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/presentation-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });
      const data = await res.json();
      if (data.folder) {
        setPresentationFolders([data.folder, ...presentationFolders]);
        setNewFolderName("");
        setIsCreatingFolder(false);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to create folder");
    }
  };

  const reprojectHistory = (event: any) => {
    // Reconstruct state payload precisely as it was
    const restoredState: Partial<PresentationStateData> = {
      type: event.type,
      settings: {
        fontSize: event.fontSize || 90,
        overlayOpacity: event.overlayOpacity || 50,
        showReference: event.showReference ?? true,
      }
    };

    if (event.reference && event.text && event.translation) {
      restoredState.scripture = {
        reference: event.reference,
        text: event.text,
        translation: event.translation
      };
    }

    if (event.backgroundType) {
      restoredState.background = {
        type: event.backgroundType,
        url: event.backgroundUrl
      };
    }

    // Call setState on store which will trigger syncState and create a NEW projection event
    setState(restoredState);
    // Optimistically update history locally
    setTimeout(() => {
      if (activeSessionId) loadHistory(activeSessionId);
    }, 500);
  };

  const toggleListening = () => {
    if (!speechProvider.current || !speechProvider.current.isSupported()) return;

    if (isListening) {
      speechProvider.current.stop();
      setIsListening(false);
    } else {
      setVoiceError(null);
      setVoiceTranscript("");
      setDetectedVoiceScriptures([]);
      speechProvider.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden">

      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 p-4 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <MonitorPlay className="text-blue-500 w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">Scriptura</h1>
          </div>

          <div className="h-6 w-[1px] bg-white/20"></div>

          {/* Session Control */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSessionToggle}
              disabled={isSessionToggling}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${isSessionToggling ? 'opacity-50 cursor-not-allowed ' : ''}${session ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'}`}
            >
              {session ? <StopCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              {isSessionToggling ? (session ? "ENDING..." : "STARTING...") : (session ? "END SERVICE" : "START SERVICE")}
            </button>
            {session && <span className="text-sm text-white/50">{session.name}</span>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={blackScreen}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${state.type === 'black' ? 'bg-red-600 text-white border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.5)] animate-pulse' : 'bg-red-950/40 text-red-400 hover:bg-red-900/60 border-red-900/50'}`}
            title="Black out presentation screen (Shortcut: B)"
          >
            <PowerOff className="w-4 h-4" />
            BLANK SCREEN
          </button>

          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
          >
            <History className="w-4 h-4" />
            HISTORY
          </button>

          <div className="h-4 w-[1px] bg-white/20"></div>

          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${state.type !== 'black' && (state.type !== 'clear' || (state.background?.type && state.background.type !== 'none')) ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-white/20'}`}></span>
            <span className="text-white/60 uppercase tracking-wider text-xs font-semibold">
              {state.type !== 'black' && (state.type !== 'clear' || (state.background?.type && state.background.type !== 'none')) ? 'Projecting' : 'Standby'}
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors text-white/70 hover:text-white"
            title="Displays & Outputs Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1800px] mx-auto w-full overflow-hidden">

        {/* Left Column: Search & Media */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-hidden">

          {/* Voice Module */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Voice Scripture
              </h2>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isListening ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-white/10 text-white/50 border border-white/20'}`}>
                {isListening ? '● Listening' : 'Ready'}
              </span>
            </div>

            <button
              onClick={toggleListening}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isListening ? 'bg-red-950/50 hover:bg-red-900/50 text-red-400 border border-red-900/50' : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30'}`}
            >
              {isListening ? (
                <><MicOff className="w-5 h-5" /> STOP LISTENING</>
              ) : (
                <><Mic className="w-5 h-5" /> START LISTENING</>
              )}
            </button>

            {voiceTranscript && !voiceError && !isRecovering && (
              <div className="bg-black/30 border border-white/5 rounded-lg p-3 text-sm text-white/50 italic font-medium">
                "{voiceTranscript}"
              </div>
            )}

            {isRecovering && (
              <div className="bg-purple-950/30 border border-purple-500/30 rounded-lg p-4 flex flex-col gap-2 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                <div className="text-xs font-bold text-purple-400 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500 animate-ping"></div>
                  Recovering with AI...
                </div>
                <div className="text-sm text-white/50 italic font-medium">"{voiceTranscript}"</div>
              </div>
            )}

            {voiceError && (
              <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-sm text-red-400 flex items-start gap-2 relative pr-8">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="whitespace-pre-line">{voiceError}</span>
                <button
                  onClick={() => setVoiceError(null)}
                  className="absolute right-2 top-2 p-1 hover:bg-red-900/30 rounded-md transition-colors"
                >
                  <X className="w-3 h-3 text-red-400/70 hover:text-red-400" />
                </button>
              </div>
            )}

            {detectedVoiceScriptures.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="text-xs font-bold text-purple-400 flex items-center gap-1 bg-purple-950/30 w-fit px-2 py-1 rounded border border-purple-500/20">
                  <Mic className="w-3 h-3" /> {detectedVoiceScriptures.length} Scripture{detectedVoiceScriptures.length > 1 ? 's' : ''} Queued
                </div>
                {detectedVoiceScriptures.map((scripture, i) => (
                  <div key={i} className={`border rounded-xl p-4 shadow-lg transition-all ${scripture.source === 'ai' ? 'bg-purple-950/40 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : scripture.confidence === 'medium' ? 'bg-orange-950/40 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-blue-950/40 border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.1)]'}`}>
                    <h3 className="font-bold text-lg text-white mb-1">{scripture.reference}</h3>
                    {scripture.source === 'ai' && <div className="text-xs text-purple-400/80 mb-2">AI recovered from speech</div>}
                    <p className="text-white/70 line-clamp-2 text-sm leading-relaxed mb-3 italic">"{scripture.text}"</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setDetectedVoiceScriptures(prev => prev.filter((_, idx) => idx !== i));
                          if (detectedVoiceScriptures.length <= 1) setVoiceTranscript("");
                        }}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => {
                          projectScripture(scripture.reference, scripture.translation || activeTranslationId || "WEB", scripture.text, scripture.verseRangeEnd ?? undefined);
                          setTimeout(() => { if (activeSessionId) loadHistory(activeSessionId) }, 500);
                          setDetectedVoiceScriptures(prev => prev.filter((_, idx) => idx !== i));
                          if (detectedVoiceScriptures.length <= 1) setVoiceTranscript("");
                        }}
                        className={`flex-1 text-white text-sm font-bold py-1.5 rounded-lg shadow-lg transition-all ${scripture.source === 'ai' ? 'bg-purple-600 hover:bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : scripture.confidence === 'medium' ? 'bg-orange-600 hover:bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]'}`}
                      >
                        Project
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl flex flex-col shadow-2xl flex-1 overflow-hidden">
            {/* Tabs Header */}
            <div className="flex border-b border-white/10 shrink-0">
              <button
                onClick={() => setActiveSearchTab('manual')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeSearchTab === 'manual' ? 'bg-white/10 text-blue-400 border-b-2 border-blue-500' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setActiveSearchTab('search')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeSearchTab === 'search' ? 'bg-white/10 text-blue-400 border-b-2 border-blue-500' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
              >
                Database Search
              </button>
            </div>

            <div className="p-5 flex flex-col flex-1 overflow-hidden relative">
              <div className="flex items-center justify-between mb-4 shrink-0 relative z-10">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
                  {activeSearchTab === 'manual' ? 'Fast Entry' : 'Search Options'}
                </h2>
                {translations.length > 0 && (
                  <select
                    value={activeTranslationId || ''}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setActiveTranslationId(newId);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('scriptura_active_translation_id', newId);
                      }
                    }}
                    className="bg-black/50 border border-white/10 rounded-lg text-xs font-bold text-white/70 px-2 py-1 outline-none"
                  >
                    {translations.map(t => (
                      <option key={t.id} value={t.id}>{t.abbreviation}</option>
                    ))}
                  </select>
                )}
              </div>

              {activeSearchTab === 'search' ? (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <form onSubmit={handleSearch} className="flex flex-col gap-3 shrink-0 mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by phrase - 'For God so loved... '"
                        className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 rounded-xl transition-all">
                        Manual Search
                      </button>
                      <button type="button" onClick={handleAISearch} className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                        ✨ AI Search
                      </button>
                    </div>
                  </form>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {isSearching ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((result, idx) => (
                        <div key={idx} className="bg-black/40 border border-white/5 hover:border-white/20 rounded-xl p-4 transition-all group">
                          <h3 className="font-bold text-lg text-blue-400 mb-2">{result.reference}</h3>
                          <p className="text-white/70 line-clamp-3 text-sm leading-relaxed mb-4">{result.text}</p>

                          <div className="flex gap-2">
                            <button className="flex-1 bg-white/5 hover:bg-white/10 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                              Preview
                            </button>
                            <button
                              onClick={() => {
                                projectScripture(result.reference, result.translation || "WEB", result.text);
                                setTimeout(() => { if (activeSessionId) loadHistory(activeSessionId) }, 500);
                              }}
                              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all"
                            >
                              Project
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center h-32 text-white/30 text-sm">
                        <Search className="w-8 h-8 mb-2 opacity-50" />
                        <p>Search for scriptures to display</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 items-center justify-center relative -mt-8">
                  <div className="flex items-baseline justify-center gap-3 text-5xl xl:text-6xl font-black tracking-tighter">
                    {/* Book */}
                    {editingField === 'book' ? (
                      <div className="relative">
                        <input
                          className="text-white/20 absolute left-0 top-0 pointer-events-none whitespace-nowrap bg-transparent border-b-2 border-transparent outline-none w-48 xl:w-64 p-0 m-0"
                          value={predictedBook}
                          readOnly
                          tabIndex={-1}
                        />
                        <input
                          ref={bookInputRef}
                          className="bg-transparent border-b-2 border-blue-500 outline-none w-48 xl:w-64 text-white relative z-10 p-0 m-0"
                          value={bookInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const val = raw
                              .split(' ')
                              .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '')
                              .join(' ');
                            // Auto-append a space after a leading digit (1/2/3) so that
                            // numbered books like "1 Kings" or "2 Chronicles" get their
                            // space inserted automatically. This keeps the Space key free
                            // to advance from Book → Chapter without ambiguity.
                            const autoSpaced =
                              bookInput === '' && /^[123]$/.test(val) ? val + ' ' : val;
                            setBookInput(autoSpaced);
                          }}
                          onKeyDown={(e) => handleManualKeyDown(e, 'book')}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span onClick={() => { setEditingField('book'); setBookInput(""); }} className="cursor-pointer hover:text-blue-400 transition-colors">{manualBook}</span>
                    )}

                    {/* Chapter */}
                    {editingField === 'chapter' ? (
                      <input
                        ref={chapterInputRef}
                        className="bg-transparent border-b-2 border-blue-500 outline-none w-20 text-center text-white p-0 m-0"
                        value={manualChapter}
                        onChange={e => setManualChapter(e.target.value)}
                        onKeyDown={(e) => handleManualKeyDown(e, 'chapter')}
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => { setEditingField('chapter'); setManualChapter(""); }} className="cursor-pointer hover:text-blue-400 transition-colors">{manualChapter || "_"}</span>
                    )}

                    <span className="text-white/50 -mx-1">:</span>

                    {/* Verse */}
                    {editingField === 'verse' ? (
                      <input
                        ref={verseInputRef}
                        className="bg-transparent border-b-2 border-blue-500 outline-none w-20 text-center text-white p-0 m-0"
                        value={manualVerse}
                        onChange={e => setManualVerse(e.target.value)}
                        onKeyDown={(e) => handleManualKeyDown(e, 'verse')}
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => { setEditingField('verse'); setManualVerse(""); }} className="cursor-pointer hover:text-blue-400 transition-colors">{manualVerse || "_"}</span>
                    )}
                  </div>

                  <p className="text-white/30 text-xs mt-6 mb-8 uppercase tracking-widest text-center font-semibold">Click any field to edit. Tab or Space to move. Enter to project.</p>

                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={() => handleManualProject()}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-16 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all text-xl tracking-wide flex items-center gap-3 group"
                    >
                      Project
                      <MonitorPlay className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                      onClick={handleCancelManual}
                      className="text-white/40 hover:text-white/80 text-xs font-semibold uppercase tracking-widest transition-colors px-6 py-2 rounded-xl hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Middle Column: Current Projection & Controls */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-full overflow-hidden">

          <section className="bg-gradient-to-b from-blue-900/20 to-black/40 border border-blue-500/20 rounded-2xl p-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col flex-[3] overflow-hidden">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-400/70 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                Current Projection
                {isProjectorLive ? (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">Live</span>
                ) : (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full border border-red-500/30">Offline</span>
                )}
              </div>
              <button
                onClick={handleLaunchProjector}
                className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all normal-case tracking-normal border ${isProjectorLive ? 'bg-red-600/20 hover:bg-red-600/40 text-red-400 border-red-500/30' : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border-blue-500/30'}`}
                title={isProjectorLive ? "Close presentation window" : "Launch presentation on secondary screen"}
              >
                {isProjectorLive ? <StopCircle className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                {isProjectorLive ? 'Close Projector' : 'Launch Projector'}
              </button>
            </h2>

            <div className="aspect-video bg-black rounded-xl border border-white/10 overflow-hidden relative shadow-inner mb-3 shrink-0 mx-auto w-full max-h-[60%]">
              <PresentationView
                state={state}
                videoRef={previewVideoRef}
                videoPlaying={videoPlaying}
                videoLoop={videoLoop}
                onVideoTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime)}
                onVideoLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                onVideoPlay={() => setVideoPlaying(true)}
                onVideoPause={() => setVideoPlaying(false)}
                isPreview={true}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2 shrink-0">
              <button
                onClick={() => setIsFormatModalOpen(true)}
                className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm group"
              >
                <Sliders className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Format Text
              </button>
              <button
                onClick={clearScreen}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-2.5 rounded-xl transition-all text-sm"
              >
                Clear Text (Esc)
              </button>
            </div>

            {/* Prev/Next Controls */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={() => handleAdjacentScripture('prev')}
                disabled={!state.scripture?.reference && state.type !== 'presentation'}
                className={`border font-bold py-2.5 text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${(state.scripture?.reference || state.type === 'presentation') ? 'bg-blue-900/20 hover:bg-blue-900/40 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}
              >
                <ChevronLeft className="w-4 h-4" />
                {state.type === 'presentation' ? 'PREV SLIDE' : 'PREV VERSE'}
              </button>
              <button
                onClick={() => handleAdjacentScripture('next')}
                disabled={!state.scripture?.reference && state.type !== 'presentation'}
                className={`border font-bold py-2.5 text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${(state.scripture?.reference || state.type === 'presentation') ? 'bg-blue-900/20 hover:bg-blue-900/40 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}
              >
                {state.type === 'presentation' ? 'NEXT SLIDE' : 'NEXT VERSE'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* video controls (repeat, seek, duration) */}
          {state.background?.type === "video" && (
            <section className="bg-blue-950/30 border border-blue-500/20 rounded-2xl p-2 overflow-hidden shrink-0 ">
              <div className="flex items-center gap-4 ">
                <button
                  onClick={() => {
                    const nextPlaying = !videoPlaying;
                    setVideoPlaying(nextPlaying);
                    if (nextPlaying) {
                      previewVideoRef.current?.play().catch(console.error);
                      sendVideoCommand('play');
                    } else {
                      previewVideoRef.current?.pause();
                      sendVideoCommand('pause');
                    }
                  }}
                  className="bg-blue-600/30 hover:bg-blue-500/50 text-white rounded-full p-2 transition-all"
                >
                  {videoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <div className="flex-1 flex items-center gap-3">
                  <span className="text-xs text-white/50 font-mono w-10 text-right">
                    {Math.floor(videoCurrentTime / 60)}:{(Math.floor(videoCurrentTime) % 60).toString().padStart(2, '0')}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 100}
                    value={videoCurrentTime}
                    onChange={(e) => {
                      const newTime = parseFloat(e.target.value);
                      if (previewVideoRef.current) previewVideoRef.current.currentTime = newTime;
                      setVideoCurrentTime(newTime);
                      sendVideoCommand('seek', newTime);
                    }}
                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                  />
                  <span className="text-xs text-white/50 font-mono w-10">
                    {Math.floor(videoDuration / 60)}:{(Math.floor(videoDuration) % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <button
                  onClick={() => {
                    const nextLoop = !videoLoop;
                    setVideoLoop(nextLoop);
                    if (previewVideoRef.current) previewVideoRef.current.loop = nextLoop;
                    sendVideoCommand('loop', nextLoop);
                  }}
                  className={`p-2 rounded-lg transition-all ${videoLoop ? 'text-blue-400 bg-blue-500/20' : 'text-white/40 hover:bg-white/10'}`}
                >
                  <Repeat className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (previewVideoRef.current) previewVideoRef.current.currentTime = 0;
                    setVideoCurrentTime(0);
                    sendVideoCommand('seek', 0);
                  }}
                  className="p-2 rounded-lg text-white/40 hover:bg-white/10 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {/* Media & Presentations */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden flex flex-col flex-[2]">
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />

            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setMediaViewTab('backgrounds');
                    setActiveFolderId(null);
                  }}
                  className={`text-xs font-semibold uppercase tracking-widest transition-colors ${mediaViewTab === 'backgrounds' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-white/50 hover:text-white/80 pb-1'}`}
                >
                  Backgrounds
                </button>
                <button
                  onClick={() => setMediaViewTab('presentations')}
                  className={`text-xs font-semibold uppercase tracking-widest transition-colors ${mediaViewTab === 'presentations' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-white/50 hover:text-white/80 pb-1'}`}
                >
                  Presentations
                </button>
              </div>

              {/* Header Actions */}
              {mediaViewTab === 'backgrounds' && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 text-xs bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
                >
                  {isUploading ? <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                  {isUploading ? "Uploading..." : "Upload File"}
                </button>
              )}
              {mediaViewTab === 'presentations' && !activeFolderId && (
                <div className="flex items-center gap-2">
                  {isCreatingFolder ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name..."
                        className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 w-32"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                      />
                      <button onClick={handleCreateFolder} className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-white">Save</button>
                      <button onClick={() => setIsCreatingFolder(false)} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-white">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCreatingFolder(true)}
                      className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
                    >
                      + New Presentation
                    </button>
                  )}
                </div>
              )}
            </div>

            {mediaViewTab === 'backgrounds' ? (
              // --- ORIGINAL BACKGROUNDS UI ---
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-white/40 uppercase mb-2">Images</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <button
                      onClick={() => setBackground('none')}
                      className={`aspect-video flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${state.background?.type === 'none' || !state.background?.type ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-black/50 border-white/10 hover:border-white/30'}`}
                    >
                      <span className="text-[10px] font-medium opacity-50">None</span>
                    </button>

                    {(() => {
                      const images = mediaItems.filter(m => m.type === 'IMAGE' && !m.folderId);
                      const displayImages = images.slice(0, 3);
                      const remaining = images.length - 3;

                      return (
                        <>
                          {displayImages.map(m => {
                            const isSelected = state.background?.url === m.path;
                            return (
                              <button
                                key={m.id}
                                onClick={() => setBackground(m.type.toLowerCase(), m.path)}
                                className={`aspect-video rounded-lg border overflow-hidden relative transition-all group ${isSelected ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-white/10 hover:border-white/30'}`}
                                title={m.filename}
                              >
                                <img src={m.path} className="w-full h-full object-cover" alt="media" />
                                <div
                                  className="absolute top-1 right-1 p-1.5 bg-black/60 rounded-md text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80 hover:text-white cursor-pointer z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteMediaPrompt({ id: m.id, filename: m.filename });
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </div>
                              </button>
                            )
                          })}
                          {remaining > 0 && (
                            <button
                              onClick={() => {
                                setMediaModalTab('images');
                                setIsMediaModalOpen(true);
                              }}
                              className="aspect-video flex flex-col items-center justify-center p-2 rounded-lg border bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10 transition-all text-white/50 hover:text-white group"
                            >
                              <span className="text-xl font-light mb-1">+{remaining}</span>
                              <span className="text-[10px] font-medium uppercase tracking-wider">See More</span>
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {mediaItems.filter(m => m.type === 'VIDEO' && !m.folderId).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-white/40 uppercase mb-2">Videos</h3>
                    <div className="grid grid-cols-4 gap-3">
                      {(() => {
                        const videos = mediaItems.filter(m => m.type === 'VIDEO' && !m.folderId);
                        const displayVideos = videos.slice(0, 3);
                        const remaining = videos.length - 3;

                        return (
                          <>
                            {displayVideos.map(m => {
                              const isSelected = state.background?.url === m.path;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => setBackground(m.type.toLowerCase(), m.path)}
                                  className={`aspect-video rounded-lg border overflow-hidden relative transition-all group ${isSelected ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-white/10 hover:border-white/30'}`}
                                  title={m.filename}
                                >
                                  <div className="relative w-full h-full bg-black">
                                    <video src={`${m.path}#t=0.1`} className="w-full h-full object-cover" preload="metadata" muted playsInline />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                      <Play className="w-4 h-4 text-white/70" />
                                    </div>
                                  </div>
                                  <div
                                    className="absolute top-1 right-1 p-1.5 bg-black/60 rounded-md text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80 hover:text-white cursor-pointer z-10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteMediaPrompt({ id: m.id, filename: m.filename });
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </div>
                                </button>
                              )
                            })}
                            {remaining > 0 && (
                              <button
                                onClick={() => {
                                  setMediaModalTab('videos');
                                  setIsMediaModalOpen(true);
                                }}
                                className="aspect-video flex flex-col items-center justify-center p-2 rounded-lg border bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10 transition-all text-white/50 hover:text-white group"
                              >
                                <span className="text-xl font-light mb-1">+{remaining}</span>
                                <span className="text-[10px] font-medium uppercase tracking-wider">See More</span>
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // --- PRESENTATIONS UI ---
              <div className="flex flex-col h-full overflow-hidden">
                {!activeFolderId ? (
                  // Folders Grid
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {presentationFolders.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {presentationFolders.map(folder => (
                          <button
                            key={folder.id}
                            onClick={() => setActiveFolderId(folder.id)}
                            className="bg-black/30 hover:bg-black/50 border border-white/10 hover:border-white/30 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-all aspect-video group relative"
                          >
                            <div className="text-white/40 group-hover:text-blue-400 transition-colors">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                            <div className="text-xs font-semibold text-white/80 group-hover:text-white truncate w-full text-center">
                              {folder.name}
                            </div>
                            <div className="text-[10px] text-white/30 uppercase tracking-widest">
                              {folder.media?.length || 0} Slides
                            </div>
                            <div
                              className="absolute top-2 right-2 bg-blue-600 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.8)]"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (folder.media && folder.media.length > 0) {
                                  const slide = folder.media[0];
                                  usePresentationStore.getState().projectPresentationSlide(folder.id, folder.name, slide.id, slide.type === 'IMAGE' ? 'image' : 'video', slide.path);
                                } else {
                                  toast.error("Presentation is empty");
                                }
                              }}
                            >
                              <MonitorPlay className="w-3 h-3 text-white" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-white/30 text-sm italic border border-dashed border-white/10 rounded-xl">
                        No presentations yet. Create one to get started.
                      </div>
                    )}
                  </div>
                ) : (
                  // Inside Folder
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center mb-3 shrink-0">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setActiveFolderId(null)}
                          className="text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h3 className="text-xs font-semibold text-white/70">
                          {presentationFolders.find(f => f.id === activeFolderId)?.name || 'Presentation'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const folder = presentationFolders.find(f => f.id === activeFolderId);
                            if (folder && folder.media && folder.media.length > 0) {
                              const slide = folder.media[0];
                              usePresentationStore.getState().projectPresentationSlide(folder.id, folder.name, slide.id, slide.type === 'IMAGE' ? 'image' : 'video', slide.path);
                            } else {
                              toast.error("Presentation is empty");
                            }
                          }}
                          className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-white font-bold transition-all shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                        >
                          <MonitorPlay className="w-3 h-3" />
                          Project
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-2 text-xs bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
                        >
                          {isUploading ? <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                          Add Slide
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-4 gap-3">
                        {presentationFolders.find(f => f.id === activeFolderId)?.media?.map((m: any, index: number) => {
                          const isSelected = state.type === 'presentation' && state.presentation?.mediaId === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                const folder = presentationFolders.find(f => f.id === activeFolderId);
                                if (folder) usePresentationStore.getState().projectPresentationSlide(folder.id, folder.name, m.id, m.type === 'IMAGE' ? 'image' : 'video', m.path);
                              }}
                              className={`aspect-video rounded-lg border overflow-hidden relative transition-all group ${isSelected ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-105 z-10' : 'border-white/10 hover:border-white/30'}`}
                            >
                              <div className="absolute top-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-[9px] font-bold text-white z-10 backdrop-blur-sm">
                                {index + 1}
                              </div>
                              {m.type === 'IMAGE' ? (
                                <img src={m.path} className="w-full h-full object-cover" alt="slide" />
                              ) : (
                                <div className="relative w-full h-full bg-black">
                                  <video src={`${m.path}#t=0.1`} className="w-full h-full object-cover" preload="metadata" muted playsInline />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Play className="w-4 h-4 text-white/70" />
                                  </div>
                                </div>
                              )}
                              <div
                                className="absolute top-1 right-1 p-1 bg-black/60 rounded-md text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80 hover:text-white cursor-pointer z-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteMediaPrompt({ id: m.id, filename: m.filename });
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </div>
                            </button>
                          )
                        })}
                        {(!presentationFolders.find(f => f.id === activeFolderId)?.media || presentationFolders.find(f => f.id === activeFolderId)?.media.length === 0) && (
                          <div className="col-span-4 py-8 text-center text-white/30 text-sm italic border border-dashed border-white/10 rounded-xl">
                            This presentation is empty. Upload a slide to get started.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Scripture/Presentation Context */}
        <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-hidden">
          {state.type === 'presentation' ? <PresentationContext /> : <ScriptureContext />}
        </div>

      </main>

      {/* Modals */}
      {isMediaModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Media Gallery
              </h2>
              <button
                onClick={() => setIsMediaModalOpen(false)}
                className="text-white/50 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 px-6 pt-4 border-b border-white/10">
              <button
                onClick={() => setMediaModalTab('images')}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${mediaModalTab === 'images' ? 'border-blue-500 text-white' : 'border-transparent text-white/50 hover:text-white/80'}`}
              >
                Images
              </button>
              <button
                onClick={() => setMediaModalTab('videos')}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${mediaModalTab === 'videos' ? 'border-blue-500 text-white' : 'border-transparent text-white/50 hover:text-white/80'}`}
              >
                Videos
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                {mediaModalTab === 'images' && mediaItems.filter(m => m.type === 'IMAGE').map(m => {
                  const isSelected = state.background?.url === m.path;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setBackground('image', m.path)}
                      className={`aspect-video rounded-lg border overflow-hidden relative transition-all group ${isSelected ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-105 z-10' : 'border-white/10 hover:border-white/30'}`}
                      title={m.filename}
                    >
                      <img src={m.path} className="w-full h-full object-cover" alt="media" />
                      <div
                        className="absolute top-1 right-1 p-1.5 bg-black/60 rounded-md text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80 hover:text-white cursor-pointer z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteMediaPrompt({ id: m.id, filename: m.filename });
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  )
                })}

                {mediaModalTab === 'videos' && mediaItems.filter(m => m.type === 'VIDEO').map(m => {
                  const isSelected = state.background?.url === m.path;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setBackground('video', m.path)}
                      className={`aspect-video rounded-lg border overflow-hidden relative transition-all group ${isSelected ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-105 z-10' : 'border-white/10 hover:border-white/30'}`}
                      title={m.filename}
                    >
                      <div className="relative w-full h-full bg-black">
                        <video src={`${m.path}#t=0.1`} className="w-full h-full object-cover" preload="metadata" muted playsInline />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-5 h-5 text-white/70" />
                        </div>
                      </div>
                      <div
                        className="absolute top-1 right-1 p-1.5 bg-black/60 rounded-md text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80 hover:text-white cursor-pointer z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteMediaPrompt({ id: m.id, filename: m.filename });
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  )
                })}
              </div>

              {mediaItems.filter(m => m.type === (mediaModalTab === 'images' ? 'IMAGE' : 'VIDEO')).length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-white/30">
                  {mediaModalTab === 'images' ? <ImageIcon className="w-12 h-12 mb-4 opacity-20" /> : <Video className="w-12 h-12 mb-4 opacity-20" />}
                  <p>No {mediaModalTab} uploaded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteMediaPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              Delete Media
            </h2>
            <p className="text-white/70 mb-6">
              Are you sure you want to delete <strong className="text-white">"{deleteMediaPrompt.filename}"</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteMediaPrompt(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-all font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMedia}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-white transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && (

        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70 flex items-center gap-2">
                <History className="w-5 h-5" />
                Projection History
              </h2>
              <div className="flex items-center gap-4">
                {session && <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">Recording</span>}
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="text-white/50 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {!session ? (
                <div className="text-center text-white/30 text-sm mt-10 p-6 border border-white/5 rounded-xl bg-black/30">
                  <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Start a service session to record history.
                </div>
              ) : history.length === 0 ? (
                <div className="text-center text-white/30 text-sm mt-10 p-6">
                  No projections yet.
                </div>
              ) : (
                history.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      reprojectHistory(item);
                      setIsHistoryModalOpen(false);
                    }}
                    className="w-full text-left bg-black/40 border border-white/5 hover:border-white/20 hover:bg-white/5 rounded-xl p-4 transition-all group relative overflow-hidden"
                  >
                    {/* Tiny thumbnail of background if active */}
                    {item.backgroundUrl && (
                      <div className="absolute inset-0 opacity-10 pointer-events-none">
                        {item.backgroundType === 'image' ? (
                          <img src={item.backgroundUrl} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-bold ${item.type === 'scripture' ? 'text-blue-400' : 'text-red-400'}`}>
                          {item.type === 'scripture' ? item.reference : item.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-white/30 font-medium">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {item.type === 'scripture' && item.text && (
                        <p className="text-sm text-white/50 line-clamp-2 leading-relaxed mt-1">{item.text}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <FormatTextModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
