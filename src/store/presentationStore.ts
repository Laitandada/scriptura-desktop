import { create } from 'zustand';
import { cleanScriptureText } from '@/lib/bible/cleaner';

export type PresentationStateType = 'scripture' | 'black' | 'clear' | 'presentation';
export type BackgroundType = 'image' | 'video' | 'none';
export type TextAlignment = 'top' | 'center' | 'bottom';
export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
export type TextShadowStyle = 'none' | 'subtle' | 'medium' | 'strong' | 'glow';
export type TextOutlineStyle = 'none' | 'thin-dark' | 'thick-dark' | 'thin-light';

export type ReferencePosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type TextJustification = 'left' | 'center' | 'right' | 'justify';

export interface VerseSettings {
  fontSize: number;
  alignment: TextAlignment;
  justification?: TextJustification;
  fontWeight: FontWeight;
  textShadow: TextShadowStyle;
  textOutline: TextOutlineStyle;
  outlineColor: string;
  textColor: string;
}

export interface ReferenceSettings {
  fontSize: number;
  position: ReferencePosition;
  fontWeight: FontWeight;
  textShadow: TextShadowStyle;
  textOutline: TextOutlineStyle;
  outlineColor: string;
  textColor: string;
}

export interface PresentationSettings {
  overlayOpacity: number;
  showReference: boolean;
  verseSettings?: VerseSettings;
  referenceSettings?: ReferenceSettings;
}

export interface PresentationStateData {
  type: PresentationStateType;
  scripture?: {
    reference: string;
    translation: string;
    text: string;
    // When a verse range is detected (e.g. "Genesis 20:1-9"), only the first verse
    // is projected on screen. verseRangeEnd stores the last verse of the range so
    // ScriptureContext can still highlight all verses in the list.
    verseRangeEnd?: number;
  };
  background?: {
    type: BackgroundType;
    url?: string;
  };
  presentation?: {
    folderId: string;
    folderName: string;
    mediaId: string;
    type: 'image' | 'video';
    url: string;
  };
  settings: PresentationSettings;
}

interface PresentationStore {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  activeTranslationId: string | null;
  setActiveTranslationId: (id: string | null) => void;
  state: PresentationStateData;
  setState: (newState: Partial<PresentationStateData>) => void;
  projectScripture: (reference: string, translation: string, text: string, verseRangeEnd?: number) => void;
  projectPresentationSlide: (folderId: string, folderName: string, mediaId: string, type: 'image' | 'video', url: string) => void;
  blackScreen: () => void;
  clearScreen: () => void;
  setBackground: (type: BackgroundType, url?: string) => void;
  sendVideoCommand: (command: 'play' | 'pause' | 'seek' | 'loop', value?: any) => void;
}

const defaultState: PresentationStateData = {
  type: 'clear',
  settings: {
    overlayOpacity: 50,
    showReference: true,
    verseSettings: {
      fontSize: 90,
      alignment: 'center',
      justification: 'justify',
      fontWeight: 'bold',
      textShadow: 'medium',
      textOutline: 'none',
      outlineColor: '#000000',
      textColor: '#ffffff',
    },
    referenceSettings: {
      fontSize: 45,
      position: 'bottom-right',
      fontWeight: 'semibold',
      textShadow: 'medium',
      textOutline: 'none',
      outlineColor: '#000000',
      textColor: '#ffffff',
    }
  },
};

const channelName = 'scriptura-presentation-sync';
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined') {
  broadcastChannel = new BroadcastChannel(channelName);
}

export const usePresentationStore = create<PresentationStore>((set, get) => {
  // Listen for messages from other tabs
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'SYNC_STATE') {
        set({ state: event.data.state });
      }
    };
  }

  const syncState = (newState: PresentationStateData, sessionId: string | null) => {
    if (typeof window !== 'undefined') {
      // Broadcast instantly for sub-millisecond tab sync
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'SYNC_STATE', state: newState });
      }
      // Persist state asynchronously in DB
      fetch('/api/presentation/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState, sessionId }),
      }).catch(console.error);
    }
  };

  return {
    activeSessionId: null,
    setActiveSessionId: (id) => set({ activeSessionId: id }),
    activeTranslationId: null,
    setActiveTranslationId: (id) => set({ activeTranslationId: id }),
    state: defaultState,
    setState: (updates) => {
      set((prev) => {
        const newState = { ...prev.state, ...updates };
        syncState(newState, prev.activeSessionId);
        return { state: newState };
      });
    },
    projectScripture: (reference, translation, text, verseRangeEnd) => {
      const cleanedText = cleanScriptureText(text);
      set((prev) => {
        const newState = {
          ...prev.state,
          type: 'scripture' as PresentationStateType,
          scripture: { reference, translation, text: cleanedText, verseRangeEnd },
        };
        syncState(newState, prev.activeSessionId);
        return { state: newState };
      });
    },
    projectPresentationSlide: (folderId, folderName, mediaId, type, url) => {
      set((prev) => {
        const newState = {
          ...prev.state,
          type: 'presentation' as PresentationStateType,
          presentation: { folderId, folderName, mediaId, type, url },
        };
        syncState(newState, prev.activeSessionId);
        return { state: newState };
      });
    },
    blackScreen: () => {
      set((prev) => {
        const newState = { ...prev.state, type: 'black' as PresentationStateType };
        syncState(newState, prev.activeSessionId);
        return { state: newState };
      });
    },
    clearScreen: () => {
      set((prev) => {
        // Toggle behavior: if it's already clear and we have previous scripture data, restore it
        const isCurrentlyClear = prev.state.type === 'clear';
        const newType = (isCurrentlyClear && prev.state.scripture) ? 'scripture' : 'clear';
        
        const newState = { ...prev.state, type: newType as PresentationStateType };
        syncState(newState, prev.activeSessionId);
        return { state: newState };
      });
    },
    setBackground: (type, url) => {
      set((prev) => {
        let newType = prev.state.type;
        // Wake up the screen to show the background if it's currently hidden by black or presentation mode
        if (newType === 'black' || newType === 'presentation') {
          newType = prev.state.scripture?.reference ? 'scripture' : 'clear';
        }

        const newState = {
          ...prev.state,
          type: newType as PresentationStateType,
          background: { type, url },
        };
        syncState(newState, prev.activeSessionId);
        return { state: newState };
      });
    },
    sendVideoCommand: (command, value) => {
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'VIDEO_CONTROL', command, value });
      }
    },
  };
});
