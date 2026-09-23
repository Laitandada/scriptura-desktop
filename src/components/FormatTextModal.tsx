"use client";

import React from "react";
import { X, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Type, Eye, LayoutGrid, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import { 
  usePresentationStore, 
  PresentationStateData,
  TextAlignment, 
  FontWeight, 
  TextShadowStyle, 
  TextOutlineStyle,
  ReferencePosition,
  TextJustification,
  VerseSettings,
  ReferenceSettings
} from "@/store/presentationStore";
import { PresentationView } from "@/components/PresentationView";

interface FormatTextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FormatTextModal({ isOpen, onClose }: FormatTextModalProps) {
  const { state, setState } = usePresentationStore();

  if (!isOpen) return null;

  const settings = state.settings || {};
  const verseSettings: VerseSettings = settings.verseSettings || {
    fontSize: 90,
    alignment: 'center',
    justification: 'justify',
    fontWeight: 'bold',
    textShadow: 'medium',
    textOutline: 'none',
    outlineColor: '#000000',
    textColor: '#ffffff',
  };
  const refSettings: ReferenceSettings = settings.referenceSettings || {
    fontSize: 45,
    position: 'bottom-right',
    fontWeight: 'semibold',
    textShadow: 'medium',
    textOutline: 'none',
    outlineColor: '#000000',
    textColor: '#ffffff',
  };

  const updateGlobalSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setState({ settings: { ...settings, [key]: value } });
  };

  const updateVerseSetting = <K extends keyof VerseSettings>(key: K, value: VerseSettings[K]) => {
    setState({
      settings: {
        ...settings,
        verseSettings: { ...verseSettings, [key]: value }
      }
    });
  };

  const updateRefSetting = <K extends keyof ReferenceSettings>(key: K, value: ReferenceSettings[K]) => {
    setState({
      settings: {
        ...settings,
        referenceSettings: { ...refSettings, [key]: value }
      }
    });
  };

  // Construct preview state so user always sees live formatted text
  const previewState: PresentationStateData = {
    ...state,
    type: 'scripture',
    scripture: state.scripture || {
      reference: "John 3:16",
      translation: "WEB",
      text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
    },
  };

  const alignments: { id: TextAlignment; label: string; icon: React.ReactNode }[] = [
    { id: 'top', label: 'Top', icon: <AlignVerticalJustifyStart className="w-4 h-4" /> },
    { id: 'center', label: 'Center', icon: <AlignVerticalJustifyCenter className="w-4 h-4" /> },
    { id: 'bottom', label: 'Bottom', icon: <AlignVerticalJustifyEnd className="w-4 h-4" /> },
  ];

  const justifications: { id: TextJustification; label: string; icon: React.ReactNode }[] = [
    { id: 'left', label: 'Left', icon: <AlignLeft className="w-4 h-4" /> },
    { id: 'center', label: 'Center', icon: <AlignCenter className="w-4 h-4" /> },
    { id: 'right', label: 'Right', icon: <AlignRight className="w-4 h-4" /> },
    { id: 'justify', label: 'Justify', icon: <AlignJustify className="w-4 h-4" /> },
  ];

  const positions: { id: ReferencePosition; label: string }[] = [
    { id: 'top-left', label: 'Top L' },
    { id: 'top-center', label: 'Top C' },
    { id: 'top-right', label: 'Top R' },
    { id: 'bottom-left', label: 'Bot L' },
    { id: 'bottom-center', label: 'Bot C' },
    { id: 'bottom-right', label: 'Bot R' },
  ];

  const fontWeights: { id: FontWeight; label: string }[] = [
    { id: 'normal', label: 'Norm' },
    { id: 'medium', label: 'Med' },
    { id: 'semibold', label: 'Semi' },
    { id: 'bold', label: 'Bold' },
    { id: 'black', label: 'Blk' },
  ];

  const shadows: { id: TextShadowStyle; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'subtle', label: 'Subt' },
    { id: 'medium', label: 'Med' },
    { id: 'strong', label: 'Stro' },
    { id: 'glow', label: 'Glow' },
  ];

  const outlines: { id: TextOutlineStyle; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'thin-dark', label: 'Tn-Dk' },
    { id: 'thick-dark', label: 'Tk-Dk' },
    { id: 'thin-light', label: 'Tn-Lt' },
  ];

  const presetColors = [
    '#ffffff', '#fef08a', '#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#c084fc', '#ff7b72',
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 shrink-0">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/90 flex items-center gap-2">
            <Type className="w-4 h-4 text-blue-400" />
            1. Format Verse Text & Scripture Reference
          </h2>
          <button 
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row text-sm">
          
          {/* COLUMN 1: Verse Settings */}
          <div className="w-full md:w-1/3 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
              <Type className="w-5 h-5 text-blue-400" />
              Format Verse Text
            </h3>

            {/* Global: Overlay Opacity */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Background Dim (Opacity)</label>
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {settings.overlayOpacity ?? 50}%
                </span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={settings.overlayOpacity ?? 50}
                onChange={(e) => updateGlobalSetting('overlayOpacity', parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.8)]"
              />
            </div>

            {/* Verse Alignment */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Vertical Alignment</label>
              <div className="grid grid-cols-3 gap-2">
                {alignments.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateVerseSetting('alignment', item.id)}
                    className={`flex items-center justify-center gap-2 py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      verseSettings.alignment === item.id ? 'bg-blue-600/30 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verse Justification */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Text Justification</label>
              <div className="grid grid-cols-4 gap-2">
                {justifications.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateVerseSetting('justification', item.id)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                      (verseSettings.justification || 'justify') === item.id ? 'bg-blue-600/30 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verse Font Size */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Font Size</label>
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{verseSettings.fontSize}px</span>
              </div>
              <input
                type="range" min={20} max={120} step={2}
                value={verseSettings.fontSize}
                onChange={(e) => updateVerseSetting('fontSize', parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            {/* Verse Font Weight */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Font Weight</label>
              <div className="grid grid-cols-5 gap-1.5">
                {fontWeights.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateVerseSetting('fontWeight', item.id)}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${verseSettings.fontWeight === item.id ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verse Text Shadow */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Text Shadow</label>
              <div className="grid grid-cols-5 gap-1.5">
                {shadows.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateVerseSetting('textShadow', item.id)}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${verseSettings.textShadow === item.id ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verse Text Outline */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Text Outline Style</label>
              <div className="grid grid-cols-4 gap-2">
                {outlines.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateVerseSetting('textOutline', item.id)}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${verseSettings.textOutline === item.id ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verse Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Text Color</label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color} onClick={() => updateVerseSetting('textColor', color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${(verseSettings.textColor || '#ffffff').toLowerCase() === color.toLowerCase() ? 'border-blue-500 scale-110' : 'border-white/20 hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Outline Color</label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color} onClick={() => updateVerseSetting('outlineColor', color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${(verseSettings.outlineColor || '#000000').toLowerCase() === color.toLowerCase() ? 'border-blue-500 scale-110' : 'border-white/20 hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* COLUMN 2: Reference Settings */}
          <div className="w-full md:w-1/3 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 border-t md:border-t-0 md:border-l border-white/10 bg-black/20">
            <h3 className="text-lg font-bold text-white mb-2 flex justify-between items-center border-b border-white/10 pb-2">
              <span className="flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-purple-400" /> Format Scripture Reference</span>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showReference ?? true}
                  onChange={(e) => updateGlobalSetting('showReference', e.target.checked)}
                  className="rounded border-white/20 bg-black/50 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-white/70">Show</span>
              </label>
            </h3>

            {/* Reference Position */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Screen Position</label>
              <div className="grid grid-cols-3 gap-2">
                {positions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateRefSetting('position', item.id)}
                    className={`py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                      refSettings.position === item.id ? 'bg-purple-600/30 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Font Size */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Font Size</label>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{refSettings.fontSize}px</span>
              </div>
              <input
                type="range" min={10} max={100} step={1}
                value={refSettings.fontSize}
                onChange={(e) => updateRefSetting('fontSize', parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            {/* Reference Font Weight */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Font Weight</label>
              <div className="grid grid-cols-5 gap-1.5">
                {fontWeights.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateRefSetting('fontWeight', item.id)}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${refSettings.fontWeight === item.id ? 'bg-purple-600/30 border-purple-500 text-purple-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Text Shadow */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Text Shadow</label>
              <div className="grid grid-cols-5 gap-1.5">
                {shadows.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateRefSetting('textShadow', item.id)}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${refSettings.textShadow === item.id ? 'bg-purple-600/30 border-purple-500 text-purple-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Text Outline */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Text Outline Style</label>
              <div className="grid grid-cols-4 gap-2">
                {outlines.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateRefSetting('textOutline', item.id)}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${refSettings.textOutline === item.id ? 'bg-purple-600/30 border-purple-500 text-purple-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Text Color</label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color} onClick={() => updateRefSetting('textColor', color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${(refSettings.textColor || '#ffffff').toLowerCase() === color.toLowerCase() ? 'border-purple-500 scale-110' : 'border-white/20 hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Outline Color</label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color} onClick={() => updateRefSetting('outlineColor', color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${(refSettings.outlineColor || '#000000').toLowerCase() === color.toLowerCase() ? 'border-purple-500 scale-110' : 'border-white/20 hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* COLUMN 3: Live Preview */}
          <div className="w-full md:w-1/3 p-6 flex flex-col border-t md:border-t-0 md:border-l border-white/10">
            <h3 className="text-lg font-bold text-white/90 mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
              <Eye className="w-5 h-5 text-green-400" />
              Live Preview
            </h3>
            
            <div className="w-full aspect-video bg-black rounded-xl border border-white/20 overflow-hidden shadow-2xl relative">
              <PresentationView state={previewState} isPreview={true} />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg"
              >
                Done
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
