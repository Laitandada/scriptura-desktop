"use client";

import React from "react";
import { usePresentationStore } from "@/store/presentationStore";
import { ImageIcon, Play, Film } from "lucide-react";

export function PresentationContext() {
  const { state, projectPresentationSlide } = usePresentationStore();

  const presentation = state.presentation;
  if (!presentation) return null;

  // We need to fetch the media for this folder
  // Since we don't have it directly in state, we should probably fetch it
  // or pass it down. 
  // For simplicity, we can fetch it when the component mounts if we have a folderId
  const [slides, setSlides] = React.useState<any[]>([]);
  
  React.useEffect(() => {
    if (presentation.folderId) {
      fetch('/api/presentation-folders')
        .then(res => res.json())
        .then(data => {
          const folder = data.folders.find((f: any) => f.id === presentation.folderId);
          if (folder) setSlides(folder.media || []);
        })
        .catch(console.error);
    }
  }, [presentation.folderId]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white/90">
          Presentation: {presentation.folderName}
        </h2>
        <span className="text-xs text-white/50">{slides.length} Slides</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2">
        {slides.map((slide, i) => {
          const isActive = presentation.mediaId === slide.id;
          return (
            <button
              key={slide.id}
              onClick={() => projectPresentationSlide(presentation.folderId, presentation.folderName, slide.id, slide.type === 'IMAGE' ? 'image' : 'video', slide.path)}
              className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-4 group ${
                isActive 
                  ? "bg-blue-600/30 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                  : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
              }`}
            >
              <div className="w-16 h-10 bg-black rounded overflow-hidden relative shrink-0 border border-white/20">
                {slide.type === 'IMAGE' ? (
                  <img src={slide.path} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <video src={`${slide.path}#t=0.1`} className="w-full h-full object-cover" preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Film className="w-3 h-3 text-white/80" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold truncate ${isActive ? "text-blue-400" : "text-white/90 group-hover:text-white"}`}>
                  Slide {i + 1}
                </div>
                <div className="text-xs text-white/40 truncate">
                  {slide.filename}
                </div>
              </div>
            </button>
          );
        })}
        {slides.length === 0 && (
          <div className="text-center p-8 text-white/30 text-sm italic">
            No slides in this folder.
          </div>
        )}
      </div>
    </div>
  );
}
