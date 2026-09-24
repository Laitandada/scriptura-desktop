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
  // isVisible controls opacity: content stays hidden until the layout effect
  // has settled on the correct ratio, preventing the "shoots off screen" flash.
  const [isVisible, setIsVisible] = useState(false);

  // Ref that tracks the measure-key from the PREVIOUS layout-effect run.
  // Using a ref (not state) lets the layout effect detect changes synchronously
  // without any race against useEffect.
  const prevMeasureKeyRef = useRef('');
  const prevScaleFactorRef = useRef(scaleFactor);

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
  const verseSettings = settings.verseSettings || {
    fontSize: 90,
    alignment: 'center',
    justification: 'justify',
    fontWeight: 'bold',
    textShadow: 'medium',
    textOutline: 'none',
    outlineColor: '#000000',
    textColor: '#ffffff',
  };
  const refSettings = settings.referenceSettings || {
    fontSize: 45,
    position: 'bottom-right',
    fontWeight: 'semibold',
    textShadow: 'medium',
    textOutline: 'none',
    outlineColor: '#000000',
    textColor: '#ffffff',
  };

  const alignment = verseSettings.alignment || 'center';
  const showReference = settings.showReference ?? true;

  // Compute relative base font sizes
  const relativeVerseFontSize = Math.max(10, Math.round((verseSettings.fontSize || 90) * scaleFactor));
  const relativeRefFontSize = Math.max(12, Math.round((refSettings.fontSize || 45) * scaleFactor));
  const relativePadding = Math.max(8, Math.round(48 * scaleFactor));

  // Key that uniquely identifies the current verse + all settings that affect text size.
  const measureKey = [
    state.scripture?.reference,
    state.scripture?.text,
    verseSettings.fontSize,
    verseSettings.fontWeight,
    verseSettings.textOutline,
    alignment,
    String(showReference),
    refSettings.fontSize,
    refSettings.fontWeight,
    refSettings.textOutline,
    refSettings.position,
  ].join('||');

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const containerH = container.clientHeight;
    const containerW = container.clientWidth;
    if (containerH <= 0 || containerW <= 0) return;

    const scaleFactorChanged = scaleFactor !== prevScaleFactorRef.current;

    if (measureKey !== prevMeasureKeyRef.current || scaleFactorChanged) {
      prevMeasureKeyRef.current = measureKey;
      prevScaleFactorRef.current = scaleFactor;
      setIsVisible(false);

      if (autoScaleRatio !== 1.0) {
        setAutoScaleRatio(1.0);
        return;
      }
    }

    const paddingY = alignment === 'center' ? 32 : relativePadding + 16;
    const availableH = Math.max(80, containerH - paddingY * 2);
    const availableW = Math.max(80, containerW * 0.92);

    // Measure the wrapper which contains both verse and absolute reference bounding box
    const scrollH = content.scrollHeight;
    const scrollW = content.scrollWidth;
    if (scrollH <= 0) return;

    const unscaledH = scrollH / autoScaleRatio;
    const unscaledW = scrollW / autoScaleRatio;

    const hRatio = availableH / unscaledH;
    const wRatio = availableW / unscaledW;

    let idealRatio = Math.min(1.0, hRatio, wRatio);
    idealRatio = Math.max(0.15, idealRatio);

    if (Math.abs(idealRatio - autoScaleRatio) > 0.005) {
      setAutoScaleRatio(idealRatio);
    } else {
      setIsVisible(true);
    }
  }, [measureKey, scaleFactor, autoScaleRatio, relativePadding, alignment]);

  const effectiveVerseFontSize = Math.max(9, Math.round(relativeVerseFontSize * autoScaleRatio));
  const effectiveRefFontSize = Math.max(9, Math.round(relativeRefFontSize * autoScaleRatio));

  let alignmentClass = "justify-center";
  let paddingStyle: React.CSSProperties = {};

  if (alignment === 'top') {
    alignmentClass = "justify-start";
    paddingStyle = { paddingTop: `${relativePadding}px` };
  } else if (alignment === 'bottom') {
    alignmentClass = "justify-end";
    paddingStyle = { paddingBottom: `${relativePadding}px` };
  }

  const fontWeightMap: Record<string, number> = {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  };

  const shadowMap: Record<string, string> = {
    none: "none",
    subtle: "0 2px 4px rgba(0,0,0,0.7)",
    medium: "0 4px 10px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.7)",
    strong: "0 8px 24px rgba(0,0,0,1), 0 2px 8px rgba(0,0,0,0.9)",
  };

  const buildTextShadow = (shadowStyle: string, outlineStyle: string, outlineColor: string, textColor: string) => {
    let glow = shadowStyle === 'glow' ? `0 0 20px ${textColor}, 0 0 10px ${textColor}` : "";
    let shadowVal = shadowStyle === 'glow' ? glow : (shadowMap[shadowStyle] || shadowMap.medium);
    
    let outlineVal = "";
    if (outlineStyle === "thin-dark" || outlineStyle === "thin-light") {
      outlineVal = `-1px -1px 0 ${outlineColor}, 1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor}, 1px 1px 0 ${outlineColor}`;
    } else if (outlineStyle === "thick-dark") {
      outlineVal = `-2px -2px 0 ${outlineColor}, 2px -2px 0 ${outlineColor}, -2px 2px 0 ${outlineColor}, 2px 2px 0 ${outlineColor}`;
    }

    return [outlineVal, shadowVal !== "none" ? shadowVal : ""].filter(Boolean).join(", ");
  };

  const verseTextShadow = buildTextShadow(verseSettings.textShadow, verseSettings.textOutline, verseSettings.outlineColor, verseSettings.textColor);
  const refTextShadow = buildTextShadow(refSettings.textShadow, refSettings.textOutline, refSettings.outlineColor, refSettings.textColor);

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

  // Map reference position setting to flow order and alignment
  const isRefTop = refSettings.position?.startsWith('top');
  const refAlignClass = refSettings.position?.includes('left') ? 'self-start text-left' :
                        refSettings.position?.includes('right') ? 'self-end text-right' :
                        'self-center text-center';

  const verseJustifyClass = {
    'left': 'text-left',
    'center': 'text-center',
    'right': 'text-right',
    'justify': 'text-justify',
  }[verseSettings.justification || 'justify'] || 'text-justify';

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
      {state.background?.url && state.type !== 'presentation' && (
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

      {/* Presentation Layer */}
      {state.type === 'presentation' && state.presentation && (
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
          {state.presentation.type === "image" && (
            <img
              src={state.presentation.url}
              alt="presentation slide"
              className="w-full h-full object-contain"
            />
          )}
          {state.presentation.type === "video" && (
            <video
              ref={videoRef}
              src={state.presentation.url}
              autoPlay={videoPlaying ?? true}
              loop={videoLoop ?? true}
              muted
              className="w-full h-full object-contain"
              onTimeUpdate={onVideoTimeUpdate}
              onLoadedMetadata={onVideoLoadedMetadata}
              onPlay={onVideoPlay}
              onPause={onVideoPause}
            />
          )}
        </div>
      )}

      {/* Dark Overlay */}
      <div
        className="absolute inset-0 z-10 bg-black pointer-events-none transition-opacity duration-500"
        style={{ opacity: effectiveOverlayOpacity }}
      />

      {/* Screen Cleared Indicator */}
      {state.type === "clear" && isPreview && (
        <div className="text-white/30 uppercase tracking-widest text-xs font-semibold z-20 relative">
          Screen Cleared
        </div>
      )}

      {/* Scripture Content */}
      {state.type === "scripture" && state.scripture && (
        <div
          style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.15s ease-in" }}
          className="relative z-20 w-[92%] max-w-[95%] flex flex-col items-center justify-center"
        >
          <div ref={contentRef} className="flex flex-col max-w-full" style={{ gap: '10px' }}>
            {showReference && isRefTop && (
              <h1
                className={`tracking-widest uppercase shrink-0 m-0 ${refAlignClass}`}
                style={{
                  fontFamily: verseSettings.fontFamily || 'var(--font-inter)',
                  fontSize: `${effectiveRefFontSize}px`,
                  fontWeight: fontWeightMap[refSettings.fontWeight] || 700,
                  color: refSettings.textColor,
                  textShadow: refTextShadow,
                }}
              >
                {displayReference}
              </h1>
            )}

            <p
              className={`leading-relaxed m-0 ${verseJustifyClass} ${verseSettings.justification !== 'justify' ? 'text-balance' : ''}`}
              style={{
                fontFamily: verseSettings.fontFamily || 'var(--font-inter)',
                fontSize: `${effectiveVerseFontSize}px`,
                fontWeight: fontWeightMap[verseSettings.fontWeight] || 700,
                color: verseSettings.textColor,
                textShadow: verseTextShadow,
              }}
            >
              {cleanScriptureText(state.scripture.text)}
            </p>

            {showReference && !isRefTop && (
              <h1
                className={`tracking-widest uppercase shrink-0 m-0 ${refAlignClass}`}
                style={{
                  fontFamily: verseSettings.fontFamily || 'var(--font-inter)',
                  fontSize: `${effectiveRefFontSize}px`,
                  fontWeight: fontWeightMap[refSettings.fontWeight] || 700,
                  color: refSettings.textColor,
                  textShadow: refTextShadow,
                }}
              >
                {displayReference}
              </h1>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
