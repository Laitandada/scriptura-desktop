export interface DisplayInfo {
  id: string;
  rawId: number | string;
  name: string;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
  resolution: string;
}

export type OutputStatusType = 'active' | 'connected' | 'unavailable' | 'not-running';

export interface OutputSingleStatus {
  active: boolean;
  status: OutputStatusType;
  displayId: string | null;
  displayFound: boolean;
  autoLaunch: boolean;
  enabled: boolean;
}

export interface OutputStatus {
  mainOutput: OutputSingleStatus;
  alternateOutput: OutputSingleStatus;
}

export interface OutputSettings {
  mainOutput: {
    enabled: boolean;
    displayId: string | null;
    autoLaunch: boolean;
  };
  alternateOutput: {
    enabled: boolean;
    displayId: string | null;
    autoLaunch: boolean;
  };
}

export interface ScripturaOutputsAPI {
  getDisplays: () => Promise<DisplayInfo[]>;
  getStatus: () => Promise<OutputStatus>;
  getSettings: () => Promise<OutputSettings>;
  saveSettings: (settings: OutputSettings) => Promise<{ success: boolean; settings?: OutputSettings; error?: string }>;
  openMain: (displayId?: string | null) => Promise<{ success: boolean; action?: string; error?: string }>;
  closeMain: () => Promise<{ success: boolean; error?: string }>;
  openAlternate: (displayId?: string | null) => Promise<{ success: boolean; action?: string; error?: string }>;
  closeAlternate: () => Promise<{ success: boolean; error?: string }>;
  onDisplaysChanged: (callback: (displays: DisplayInfo[]) => void) => () => void;
  onStatusChanged: (callback: (status: OutputStatus) => void) => () => void;
}

declare global {
  interface Window {
    scriptura?: {
      outputs: ScripturaOutputsAPI;
    };
    electron?: {
      launchProjector: () => void;
    };
  }
}
