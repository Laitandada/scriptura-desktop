"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PresentationStateData } from "@/store/presentationStore";
import { cleanScriptureText } from "@/lib/bible/cleaner";

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface PresentationViewProps {
  state: PresentationStateData;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  videoPlaying?: boolean;
  videoLoop?: boolean;
  onVideoTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVideoLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVideoPlay?: () => void;
  onVideoPause?: () => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  isPreview?: boolean;
}

export function PresentationView({
  state,
  videoRef,
  videoPlaying,
  videoLoop,
  onVideoTimeUpdate,
  onVideoLoadedMetadata,
  onVideoPlay,
  onVideoPause,
  onClick,
  onDoubleClick,
  className = "",
  isPreview = false,
}: PresentationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [autoScaleRatio, setAutoScaleRatio] = useState(1);

  // Measure container dimensions for relative canvas scaling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) {
        // Base reference width for standard 1080p canvas is 1920px
        setScaleFactor(width / 1920);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const settings = state.settings || {};
  const alignment = settings.alignment || 'center';
  const fontSizeSetting = settings.fontSize ?? 90;
  const fontWeightSetting = settings.fontWeight || 'bold';
  const textShadowSetting = settings.textShadow || 'medium';
  const textOutlineSetting = settings.textOutline || 'none';
  const outlineColorSetting = settings.outlineColor || '#000000';
  const textColorSetting = settings.textColor || '#ffffff';

  // Compute relative base font size
  const relativeFontSize = Math.max(10, Math.round(fontSizeSetting * scaleFactor));
  const relativeRefFontSize = Math.max(12, Math.round(36 * scaleFactor));
  const relativePadding = Math.max(8, Math.round(48 * scaleFactor));

  // Dynamic Auto-Fit measurement to downscale long scriptures so text and reference NEVER crop off-screen
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;
    if (containerHeight <= 0 || containerWidth <= 0) return;

    // Available bounds inside presentation screen
    const paddingY = alignment === 'center' ? 32 : relativePadding + 16;
    const availableHeight = Math.max(80, containerHeight - paddingY * 2);
    const availableWidth = Math.max(80, containerWidth * 0.92);

    const currentRatio = autoScaleRatio > 0 ? autoScaleRatio : 1;
    const scrollHeight = content.scrollHeight;
    const scrollWidth = content.scrollWidth;

    if (scrollHeight <= 0) return;

    // Calculate unscaled dimensions (dimensions if autoScaleRatio were 1.0)
    const unscaledHeight = scrollHeight / currentRatio;
    const unscaledWidth = scrollWidth / currentRatio;

    const heightRatio = availableHeight / unscaledHeight;
    const widthRatio = availableWidth / unscaledWidth;

    // Scale down proportionally so both height and width fit inside available bounds
    let idealRatio = Math.min(heightRatio, widthRatio);
    idealRatio = Math.min(1.0, Math.max(0.20, idealRatio));

    if (Math.abs(idealRatio - autoScaleRatio) > 0.01) {
      setAutoScaleRatio(idealRatio);
    }
  }, [
    state.scripture?.text, 
    state.scripture?.reference, 
    fontSizeSetting, 
    scaleFactor, 
    alignment, 
    settings.showReference,
    autoScaleRatio,
    relativePadding
  ]);

  const effectiveFontSize = Math.max(9, Math.round(relativeFontSize * autoScaleRatio));
  const effectiveRefFontSize = Math.max(11, Math.round(relativeRefFontSize * autoScaleRatio));

  // Alignment classes
  let alignmentClass = "justify-center";
  let paddingStyle: React.CSSProperties = {};

  if (alignment === 'top') {
    alignmentClass = "justify-start";
    paddingStyle = { paddingTop: `${relativePadding}px` };
  } else if (alignment === 'bottom') {
    alignmentClass = "justify-end";
    paddingStyle = { paddingBottom: `${relativePadding}px` };
  }

  // Font weight mapping
  const fontWeightMap: Record<string, number> = {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  };
  const computedFontWeight = fontWeightMap[fontWeightSetting] || 700;

  // Text Shadow presets
  const shadowMap: Record<string, string> = {
    none: "none",
    subtle: "0 2px 4px rgba(0,0,0,0.7)",
    medium: "0 4px 10px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.7)",
    strong: "0 8px 24px rgba(0,0,0,1), 0 2px 8px rgba(0,0,0,0.9)",
    glow: `0 0 20px ${textColorSetting}, 0 0 10px ${textColorSetting}`,
  };

  // Text Outline stroke mapping using dynamic outlineColorSetting
  const outlineMap: Record<string, string> = {
    none: "",
    "thin-dark": `-1px -1px 0 ${outlineColorSetting}, 1px -1px 0 ${outlineColorSetting}, -1px 1px 0 ${outlineColorSetting}, 1px 1px 0 ${outlineColorSetting}`,
    "thick-dark": `-2px -2px 0 ${outlineColorSetting}, 2px -2px 0 ${outlineColorSetting}, -2px 2px 0 ${outlineColorSetting}, 2px 2px 0 ${outlineColorSetting}`,
    "thin-light": `-1px -1px 0 ${outlineColorSetting}, 1px -1px 0 ${outlineColorSetting}, -1px 1px 0 ${outlineColorSetting}, 1px 1px 0 ${outlineColorSetting}`,
  };

  const shadowVal = shadowMap[textShadowSetting] || shadowMap.medium;
  const outlineVal = outlineMap[textOutlineSetting] || "";
  
  const combinedTextShadow = [outlineVal, shadowVal !== "none" ? shadowVal : ""]
    .filter(Boolean)
    .join(", ");

  const displayReference = (() => {
    if (!state.scripture) return "";
    const ref = state.scripture.reference || "";
    const trans = state.scripture.translation;
    if (!trans) return ref;
    
    if (ref.toUpperCase().includes(`(${trans.toUpperCase()})`)) {
      return ref;
    }
    return `${ref} (${trans})`;
  })();

  const hasActiveScripture = state.type === "scripture" && Boolean(state.scripture?.text);
  const effectiveOverlayOpacity = hasActiveScripture ? ((settings.overlayOpacity ?? 50) / 100) : 0;

  if (state.type === "black") {
    return (
      <div 
        ref={containerRef}
        className={`bg-black w-full h-full overflow-hidden relative cursor-pointer ${className}`}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-black flex flex-col items-center ${alignmentClass} cursor-pointer select-none ${className}`}
      style={paddingStyle}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Background Layer */}
      {state.background?.url && (
        <div className="absolute inset-0 z-0">
          {state.background.type === "image" && (
            <img 
              src={state.background.url} 
              alt="background" 
              className="w-full h-full object-cover"
            />
          )}
          {state.background.type === "video" && (
            <video 
              ref={videoRef}
              src={state.background.url} 
              autoPlay={videoPlaying ?? true} 
              loop={videoLoop ?? true} 
              muted 
              className="w-full h-full object-cover"
              onTimeUpdate={onVideoTimeUpdate}
              onLoadedMetadata={onVideoLoadedMetadata}
              onPlay={onVideoPlay}
              onPause={onVideoPause}
            />
          )}
        </div>
      )}

      {/* Dark Overlay for Readability - Fades to 0 opacity when text is cleared */}
      <div 
        className="absolute inset-0 z-10 bg-black pointer-events-none transition-opacity duration-500"
        style={{ opacity: effectiveOverlayOpacity }}
      />

      {/* Screen Cleared Indicator for Preview */}
      {state.type === "clear" && isPreview && (
        <div className="text-white/30 uppercase tracking-widest text-xs font-semibold z-20 relative">
          Screen Cleared
        </div>
      )}

      {/* Scripture Content */}
      {state.type === "scripture" && state.scripture && (
        <div 
          ref={contentRef}
          className="relative z-20 w-[92%] max-w-[95%] max-h-[92%] flex flex-col items-center justify-center text-center overflow-hidden"
        >
          {settings.showReference && (
            <h1 
              className="tracking-widest uppercase mb-[0.5em] opacity-90 font-serif shrink-0"
              style={{
                fontSize: `${effectiveRefFontSize}px`,
                fontWeight: computedFontWeight,
                color: textColorSetting,
                textShadow: combinedTextShadow,
              }}
            >
              {displayReference}
            </h1>
          )}
          
          <p 
            className="font-serif leading-relaxed text-balance"
            style={{ 
              fontSize: `${effectiveFontSize}px`,
              fontWeight: computedFontWeight,
              color: textColorSetting,
              textShadow: combinedTextShadow,
            }}
          >
            {cleanScriptureText(state.scripture.text)}
          </p>
        </div>
      )}
    </div>
  );
}
