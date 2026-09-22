"use client";

import React from "react";
import { X, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Type, Eye } from "lucide-react";
import { 
  usePresentationStore, 
  PresentationStateData,
  TextAlignment, 
  FontWeight, 
  TextShadowStyle, 
  TextOutlineStyle 
} from "@/store/presentationStore";
import { PresentationView } from "@/components/PresentationView";

interface FormatTextModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FormatTextModal({ isOpen, onClose }: FormatTextModalProps) {
  const { state, setState } = usePresentationStore();

  if (!isOpen) return null;

  const settings = state.settings || {
    fontSize: 90,
    overlayOpacity: 50,
    showReference: true,
    alignment: 'center',
    fontWeight: 'bold',
    textShadow: 'medium',
    textOutline: 'none',
    textColor: '#ffffff',
  };

  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setState({
      settings: {
        ...settings,
        [key]: value,
      },
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

  const fontWeights: { id: FontWeight; label: string }[] = [
    { id: 'normal', label: 'Normal' },
    { id: 'medium', label: 'Medium' },
    { id: 'semibold', label: 'Semibold' },
    { id: 'bold', label: 'Bold' },
    { id: 'black', label: 'Black' },
  ];

  const shadows: { id: TextShadowStyle; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'subtle', label: 'Subtle' },
    { id: 'medium', label: 'Medium' },
    { id: 'strong', label: 'Strong' },
    { id: 'glow', label: 'Glow' },
  ];

  const outlines: { id: TextOutlineStyle; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'thin-dark', label: 'Thin Dark' },
    { id: 'thick-dark', label: 'Thick Dark' },
    { id: 'thin-light', label: 'Thin Light' },
  ];

  const presetColors = [
    '#ffffff',
    '#fef08a',
    '#fbbf24',
    '#38bdf8',
    '#34d399',
    '#f472b6',
    '#c084fc',
    '#ff7b72',
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/90 flex items-center gap-2">
            <Type className="w-4 h-4 text-blue-400" />
            Format Text
          </h2>
          <button 
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form & Live Preview Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Formatting Controls */}
            <div className="md:col-span-7 flex flex-col gap-6">
              
              {/* i. Vertical Alignment */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Text Alignment
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {alignments.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => updateSetting('alignment', item.id)}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        (settings.alignment || 'center') === item.id
                          ? 'bg-blue-600/30 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ii. Font Size */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Font Size
                  </label>
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {settings.fontSize}px
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={2}
                    value={settings.fontSize}
                    onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                  />
                </div>
              </div>

              {/* iii. Font Weight */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Font Weight
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {fontWeights.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => updateSetting('fontWeight', item.id)}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                        (settings.fontWeight || 'bold') === item.id
                          ? 'bg-blue-600/30 border-blue-500 text-blue-400 font-bold shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* iv. Text Shadow */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Text Shadow
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {shadows.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => updateSetting('textShadow', item.id)}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                        (settings.textShadow || 'medium') === item.id
                          ? 'bg-blue-600/30 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* v. Text Outline */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Text Outline Style
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {outlines.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => updateSetting('textOutline', item.id)}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                        (settings.textOutline || 'none') === item.id
                          ? 'bg-blue-600/30 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* vi. Outline Color */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Outline Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['#000000', '#ffffff', '#fbbf24', '#ef4444', '#38bdf8', '#22c55e', '#a855f7', '#f97316'].map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSetting('outlineColor', color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        (settings.outlineColor || '#000000').toLowerCase() === color.toLowerCase()
                          ? 'border-blue-500 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.8)]'
                          : 'border-white/20 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  
                  {/* Custom Color Input */}
                  <div className="relative flex items-center ml-2">
                    <input
                      type="color"
                      value={settings.outlineColor || '#000000'}
                      onChange={(e) => updateSetting('outlineColor', e.target.value)}
                      className="w-8 h-8 rounded-full border-0 bg-transparent cursor-pointer p-0 overflow-hidden"
                      title="Choose custom outline color"
                    />
                  </div>
                </div>
              </div>

              {/* vii. Text Color */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Text Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSetting('textColor', color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        (settings.textColor || '#ffffff').toLowerCase() === color.toLowerCase()
                          ? 'border-blue-500 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.8)]'
                          : 'border-white/20 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  
                  {/* Custom Color Input */}
                  <div className="relative flex items-center ml-2">
                    <input
                      type="color"
                      value={settings.textColor || '#ffffff'}
                      onChange={(e) => updateSetting('textColor', e.target.value)}
                      className="w-8 h-8 rounded-full border-0 bg-transparent cursor-pointer p-0 overflow-hidden"
                      title="Choose custom color"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Live Preview Box */}
            <div className="md:col-span-5 flex flex-col gap-3 sticky top-0">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/50">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Eye className="w-3.5 h-3.5" /> Live Preview
                </span>
                <span className="text-[10px] text-white/30">16:9 Viewport</span>
              </div>

              <div className="aspect-video bg-black rounded-xl border border-white/15 overflow-hidden relative shadow-2xl group">
                <PresentationView 
                  state={previewState} 
                  isPreview={true} 
                  className="w-full h-full"
                />
              </div>

              <p className="text-[11px] text-white/40 text-center italic">
                Changes apply live to preview and presentation screen.
              </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
