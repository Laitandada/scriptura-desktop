"use client";

import React, { useEffect, useState, useCallback } from "react";
import { 
  X, 
  Monitor, 
  Tv, 
  Radio, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Square, 
  Sliders, 
  BookOpen, 
  Palette, 
  Info, 
  Sparkles,
  ExternalLink,
  History,
  ChevronDown,
  ChevronRight,
  Trash2,
  Clock,
  BookMarked
} from "lucide-react";
import { DisplayInfo, OutputStatus, OutputSettings } from "@/types/scriptura";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "displays" | "general" | "bible" | "appearance" | "about" | "history";
}

interface HistorySession {
  id: string;
  name: string;
  startTime: string;
  endTime: string | null;
  events: {
    id: string;
    type: string;
    reference: string | null;
    translation: string | null;
    text: string | null;
    backgroundType: string | null;
    backgroundUrl: string | null;
    timestamp: string;
  }[];
  _count: { events: number };
}

export function SettingsModal({ isOpen, onClose, initialTab = "displays" }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"displays" | "general" | "bible" | "appearance" | "about" | "history">(initialTab);

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [status, setStatus] = useState<OutputStatus | null>(null);
  const [settings, setSettings] = useState<OutputSettings>({
    mainOutput: { enabled: true, displayId: null, autoLaunch: false },
    alternateOutput: { enabled: false, displayId: null, autoLaunch: false },
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // History state
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  const isElectronAvailable = typeof window !== "undefined" && Boolean(window.scriptura?.outputs);

  const fetchDisplayData = useCallback(async () => {
    if (!isElectronAvailable || !window.scriptura?.outputs) {
      setLoading(false);
      return;
    }

    try {
      const [fetchedDisplays, fetchedStatus, fetchedSettings] = await Promise.all([
        window.scriptura.outputs.getDisplays(),
        window.scriptura.outputs.getStatus(),
        window.scriptura.outputs.getSettings(),
      ]);

      setDisplays(fetchedDisplays || []);
      setStatus(fetchedStatus || null);
      if (fetchedSettings) {
        setSettings(fetchedSettings);
      }
    } catch (err) {
      console.error("Failed to load display data:", err);
    } finally {
      setLoading(false);
    }
  }, [isElectronAvailable]);

  const fetchHistoryData = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/sessions/history');
      const data = await res.json();
      setHistorySessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSession(sessionId);
    try {
      const res = await fetch(`/api/sessions/history?sessionId=${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        setHistorySessions(prev => prev.filter(s => s.id !== sessionId));
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    } finally {
      setDeletingSession(null);
    }
  };

  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  useEffect(() => {
    if (isOpen) {
      fetchDisplayData();
      if (activeTab === 'history') {
        fetchHistoryData();
      }
    }
  }, [isOpen, fetchDisplayData, fetchHistoryData, activeTab]);

  // Subscribe to realtime display topology & status changes from Electron main process
  useEffect(() => {
    if (!isOpen || !isElectronAvailable || !window.scriptura?.outputs) return;

    const unbindDisplays = window.scriptura.outputs.onDisplaysChanged((updatedDisplays) => {
      setDisplays(updatedDisplays || []);
    });

    const unbindStatus = window.scriptura.outputs.onStatusChanged((updatedStatus) => {
      setStatus(updatedStatus || null);
    });

    return () => {
      unbindDisplays();
      unbindStatus();
    };
  }, [isOpen, isElectronAvailable]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDisplayData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const updateOutputSettings = async (partialSettings: Partial<OutputSettings>) => {
    const updated = {
      ...settings,
      ...partialSettings,
      mainOutput: { ...settings.mainOutput, ...(partialSettings.mainOutput || {}) },
      alternateOutput: { ...settings.alternateOutput, ...(partialSettings.alternateOutput || {}) },
    };

    setSettings(updated);

    if (isElectronAvailable && window.scriptura?.outputs) {
      const res = await window.scriptura.outputs.saveSettings(updated);
      if (res.success && res.settings) {
        setSettings(res.settings);
        const newStatus = await window.scriptura.outputs.getStatus();
        setStatus(newStatus);
      }
    }
  };

  const handleTestMainOutput = async () => {
    if (!isElectronAvailable || !window.scriptura?.outputs) return;
    setActionMessage(null);

    if (status?.mainOutput.active) {
      const res = await window.scriptura.outputs.closeMain();
      if (!res.success) setActionMessage(res.error || "Failed to close Main Output");
    } else {
      const res = await window.scriptura.outputs.openMain(settings.mainOutput.displayId);
      if (!res.success) setActionMessage(res.error || "Failed to open Main Output");
    }
    const newStatus = await window.scriptura.outputs.getStatus();
    setStatus(newStatus);
  };

  const handleTestAlternateOutput = async () => {
    if (!isElectronAvailable || !window.scriptura?.outputs) return;
    setActionMessage(null);

    if (status?.alternateOutput.active) {
      const res = await window.scriptura.outputs.closeAlternate();
      if (!res.success) setActionMessage(res.error || "Failed to close Alternate Output");
    } else {
      const res = await window.scriptura.outputs.openAlternate(settings.alternateOutput.displayId);
      if (!res.success) setActionMessage(res.error || "Failed to open Alternate Output");
    }
    const newStatus = await window.scriptura.outputs.getStatus();
    setStatus(newStatus);
  };

  if (!isOpen) return null;

  const sameDisplayWarning = 
    displays.length > 1 && 
    settings.mainOutput.enabled && 
    settings.alternateOutput.enabled && 
    settings.mainOutput.displayId && 
    settings.alternateOutput.displayId && 
    settings.mainOutput.displayId === settings.alternateOutput.displayId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold tracking-tight">Scriptura Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Navigation */}
          <div className="w-60 border-r border-white/10 bg-black/20 p-4 flex flex-col gap-1 shrink-0">
            <button
              onClick={() => setActiveTab("displays")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "displays"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Monitor className="w-4 h-4" />
              Displays & Outputs
            </button>

            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "general"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sliders className="w-4 h-4" />
              General
            </button>

            <button
              onClick={() => setActiveTab("bible")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "bible"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Bible
            </button>

            <button
              onClick={() => setActiveTab("appearance")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "appearance"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Palette className="w-4 h-4" />
              Appearance
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "history"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <History className="w-4 h-4" />
              Projection History
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "about"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Info className="w-4 h-4" />
              About
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            
            {activeTab === "displays" && (
              <div className="flex flex-col gap-6">
                
                {/* Header & Refresh */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Displays & Outputs
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      Configure Main Presentation Projector and Livestream/OBS Alternate Output destinations.
                    </p>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh Displays
                  </button>
                </div>

                {!isElectronAvailable && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-300 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold">Web Browser Environment Detected</p>
                      <p className="text-xs text-amber-300/80 mt-1">
                        Native multi-display management requires running Scriptura inside the Electron application (`npm run dev`). Web popups will be used as a fallback.
                      </p>
                    </div>
                  </div>
                )}

                {actionMessage && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 flex items-center justify-between">
                    <span>{actionMessage}</span>
                    <button onClick={() => setActionMessage(null)} className="text-xs hover:underline">Dismiss</button>
                  </div>
                )}

                {sameDisplayWarning && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-300 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Both Main Output and Alternate Output are assigned to the same display. Alternate Output works best when placed on a separate streaming display.</span>
                  </div>
                )}

                {/* Detected Displays List */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-blue-400" />
                    Detected Displays ({displays.length})
                  </h4>

                  {displays.length === 0 ? (
                    <p className="text-xs text-white/40 italic">Scanning connected monitors...</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {displays.map((display) => (
                        <div
                          key={display.id}
                          className="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-white">{display.name}</span>
                            {display.isPrimary && (
                              <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-white/50 mt-1 font-mono">
                            {display.resolution} &bull; Bounds: ({display.bounds.x}, {display.bounds.y})
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Main Output Configuration Card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <Tv className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">Main Presentation Output</h4>
                        <p className="text-xs text-white/50">Primary projector / TV display for church audience</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <StatusBadge singleStatus={status?.mainOutput} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-white/70">Display Destination</label>
                      <select
                        value={settings.mainOutput.displayId || ""}
                        onChange={(e) => updateOutputSettings({ mainOutput: { ...settings.mainOutput, displayId: e.target.value || null } })}
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                      >
                        <option value="">Auto Select (External Display / Primary)</option>
                        {displays.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} — {d.resolution} {d.isPrimary ? "(Primary)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={handleTestMainOutput}
                        className={`w-full py-2 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                          status?.mainOutput.active
                            ? "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30"
                            : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                        }`}
                      >
                        {status?.mainOutput.active ? (
                          <>
                            <Square className="w-4 h-4" /> Close Main Output
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" /> Test Main Output
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Alternate Output Configuration Card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Radio className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base text-white">Alternate Output</h4>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                            OBS / Livestream
                          </span>
                        </div>
                        <p className="text-xs text-white/50">Dedicated window for OBS Studio, vMix, or livestream video capture</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <StatusBadge singleStatus={status?.alternateOutput} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-3 col-span-full">
                      <input
                        type="checkbox"
                        id="enableAlternate"
                        checked={settings.alternateOutput.enabled}
                        onChange={(e) => updateOutputSettings({ alternateOutput: { ...settings.alternateOutput, enabled: e.target.checked } })}
                        className="w-4 h-4 rounded border-white/20 bg-black/50 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="enableAlternate" className="text-sm font-semibold text-white cursor-pointer select-none">
                        Enable Alternate Output
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-white/70">Display Destination</label>
                      <select
                        disabled={!settings.alternateOutput.enabled}
                        value={settings.alternateOutput.displayId || ""}
                        onChange={(e) => updateOutputSettings({ alternateOutput: { ...settings.alternateOutput, displayId: e.target.value || null } })}
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-medium disabled:opacity-40"
                      >
                        <option value="">Auto Select (External Display / Primary)</option>
                        {displays.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} — {d.resolution} {d.isPrimary ? "(Primary)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        disabled={!settings.alternateOutput.enabled}
                        onClick={handleTestAlternateOutput}
                        className={`w-full py-2 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-40 ${
                          status?.alternateOutput.active
                            ? "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30"
                            : "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                        }`}
                      >
                        {status?.alternateOutput.active ? (
                          <>
                            <Square className="w-4 h-4" /> Close Alternate Output
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" /> Test Alternate Output
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Startup Configuration Card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">
                    Service Startup Behavior
                  </h4>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex items-center gap-3 text-sm text-white/80 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settings.mainOutput.autoLaunch}
                        onChange={(e) => updateOutputSettings({ mainOutput: { ...settings.mainOutput, autoLaunch: e.target.checked } })}
                        className="w-4 h-4 rounded border-white/20 bg-black/50 text-blue-600"
                      />
                      Automatically open Main Output when Scriptura starts
                    </label>

                    <label className="flex items-center gap-3 text-sm text-white/80 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settings.alternateOutput.autoLaunch}
                        onChange={(e) => updateOutputSettings({ alternateOutput: { ...settings.alternateOutput, autoLaunch: e.target.checked } })}
                        className="w-4 h-4 rounded border-white/20 bg-black/50 text-purple-600"
                      />
                      Automatically open Alternate Output when Scriptura starts
                    </label>
                  </div>
                </div>

                {/* Workflow Architecture Callout */}
                <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-white/70 leading-relaxed">
                    <p className="font-semibold text-blue-300 mb-1">Church Livestream Architecture</p>
                    Scriptura provides independent visual outputs. For church streaming, route the <span className="text-white font-medium">Alternate Output Window</span> into your existing video capture setup or OBS Studio window display capture. Both outputs stay synchronized in real time whenever scriptures, backgrounds, or controls change.
                  </div>
                </div>

              </div>
            )}

            {activeTab === "general" && (
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-white">General Settings</h3>
                <p className="text-sm text-white/50">Service session defaults and general preferences.</p>
              </div>
            )}

            {activeTab === "bible" && (
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-white">Bible Settings</h3>
                <p className="text-sm text-white/50">Manage default Bible translations and search parameters.</p>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-white">Appearance Settings</h3>
                <p className="text-sm text-white/50">Presentation typography, default font sizes, and overlay styling.</p>
              </div>
            )}

            {activeTab === "history" && (
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Projection History
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    Browse past service sessions and their projection events, grouped by date.
                  </p>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                  </div>
                ) : historySessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-white/30">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">No past service sessions found</p>
                    <p className="text-xs text-white/20 mt-1">Start and end a service to see history here</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {(() => {
                      // Group sessions by date
                      const grouped: Record<string, HistorySession[]> = {};
                      for (const session of historySessions) {
                        const dateKey = new Date(session.startTime).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        });
                        if (!grouped[dateKey]) grouped[dateKey] = [];
                        grouped[dateKey].push(session);
                      }

                      return Object.entries(grouped).map(([dateLabel, sessions]) => (
                        <div key={dateLabel} className="flex flex-col gap-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2 sticky top-0 bg-[#0f1117] py-1 z-10">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            {dateLabel}
                          </h4>

                          {sessions.map(session => {
                            const isExpanded = expandedSessions.has(session.id);
                            const startTime = new Date(session.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            const endTime = session.endTime ? new Date(session.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Ongoing';
                            const scriptureEvents = session.events.filter(e => e.type === 'scripture');
                            const uniqueRefs = new Set(scriptureEvents.map(e => e.reference).filter(Boolean));

                            return (
                              <div key={session.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                {/* Session Header */}
                                <button
                                  onClick={() => toggleSessionExpanded(session.id)}
                                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                                    <div>
                                      <div className="font-bold text-sm text-white">{session.name}</div>
                                      <div className="text-xs text-white/40 mt-0.5">
                                        {startTime} — {endTime} &bull; {session._count.events} event{session._count.events !== 1 ? 's' : ''} &bull; {uniqueRefs.size} unique scripture{uniqueRefs.size !== 1 ? 's' : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                    disabled={deletingSession === session.id}
                                    className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                                    title="Delete this session"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </button>

                                {/* Expanded Events List */}
                                {isExpanded && (
                                  <div className="border-t border-white/5 px-4 pb-4 pt-2">
                                    {scriptureEvents.length === 0 ? (
                                      <p className="text-xs text-white/30 italic py-2">No scripture projections in this session</p>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        {scriptureEvents.map((event, idx) => (
                                          <div key={event.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                                            <div className="text-xs text-white/20 font-mono mt-0.5 w-5 text-right shrink-0">
                                              {idx + 1}
                                            </div>
                                            <BookMarked className="w-3.5 h-3.5 text-blue-400/60 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white">{event.reference}</span>
                                                {event.translation && (
                                                  <span className="text-[10px] font-bold text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                                                    {event.translation}
                                                  </span>
                                                )}
                                              </div>
                                              {event.text && (
                                                <p className="text-xs text-white/40 mt-0.5 line-clamp-2 leading-relaxed">{event.text}</p>
                                              )}
                                              <span className="text-[10px] text-white/20 mt-0.5 block">
                                                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-white">About Scriptura</h3>
                <p className="text-sm text-white/60">
                  Scriptura Church Presentation System v0.1.0 (Native Electron Edition)
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

function StatusBadge({ singleStatus }: { singleStatus?: { active: boolean; status: string; displayFound: boolean; enabled: boolean } }) {
  if (!singleStatus) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white/50 border border-white/10">
        ○ Loading...
      </span>
    );
  }

  if (singleStatus.active) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        ● Active
      </span>
    );
  }

  if (singleStatus.status === "unavailable") {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        ⚠ Display unavailable
      </span>
    );
  }

  if (singleStatus.enabled && singleStatus.displayFound) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-400" />
        ● Connected
      </span>
    );
  }

  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white/40 border border-white/10">
      ○ Not running
    </span>
  );
}
