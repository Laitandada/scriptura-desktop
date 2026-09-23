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

  // Key that uniquely identifies the current verse + all settings that affect text size.
  // When this changes we restart the measurement cycle from ratio=1.0.
  const measureKey = [
    state.scripture?.reference,
    state.scripture?.text,
    fontSizeSetting,
    alignment,
    String(settings.showReference),
    fontWeightSetting,
    textShadowSetting,
    textOutlineSetting,
    outlineColorSetting,
    textColorSetting,
  ].join('||');

  // ─── Single layout effect handles BOTH reset detection AND measurement ───────
  //
  // WHY one effect?
  // React's commit phase runs useLayoutEffect BEFORE useEffect.
  // The previous approach used a useEffect to reset autoScaleRatio → 1.0, but the
  // layout effect had already fired its measurement with the OLD stale ratio first,
  // so every verse change required an extra refresh cycle to converge.
  //
  // FIX: detect verse/settings changes via prevMeasureKeyRef (synchronous, no race).
  // On change  → hide content, reset ratio to 1.0, bail out early.
  //              The re-render from setAutoScaleRatio(1.0) brings the DOM to ratio=1.0,
  //              then this effect runs again and measures correctly in one pass.
  // No change  → measure the DOM (which is at current autoScaleRatio), compute the
  //              ideal ratio, apply it. When the ratio stabilises, reveal the content.
  // ─────────────────────────────────────────────────────────────────────────────
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const containerH = container.clientHeight;
    const containerW = container.clientWidth;
    if (containerH <= 0 || containerW <= 0) return;

    // ── Detect verse / settings change ──────────────────────────────────────
    if (measureKey !== prevMeasureKeyRef.current) {
      prevMeasureKeyRef.current = measureKey;
      setIsVisible(false);

      if (autoScaleRatio !== 1.0) {
        // Reset ratio → triggers re-render → this effect fires again with DOM at 1.0
        setAutoScaleRatio(1.0);
        return; // Don't measure yet; wait for the clean re-render
      }
      // Already at 1.0 → fall through and measure directly
    }

    // ── Measurement pass ─────────────────────────────────────────────────────
    const paddingY = alignment === 'center' ? 32 : relativePadding + 16;
    const availableH = Math.max(80, containerH - paddingY * 2);
    const availableW = Math.max(80, containerW * 0.92);

    const scrollH = content.scrollHeight;
    const scrollW = content.scrollWidth;
    if (scrollH <= 0) return;

    // Project what the dimensions would be at ratio=1.0
    const unscaledH = scrollH / autoScaleRatio;
    const unscaledW = scrollW / autoScaleRatio;

    const hRatio = availableH / unscaledH;
    const wRatio = availableW / unscaledW;

    // Never scale UP beyond the user's configured size
    let idealRatio = Math.min(1.0, hRatio, wRatio);
    idealRatio = Math.max(0.15, idealRatio);

    if (Math.abs(idealRatio - autoScaleRatio) > 0.005) {
      // Not yet stable — apply new ratio; next pass will confirm
      setAutoScaleRatio(idealRatio);
    } else {
      // Stable — reveal at correct size
      setIsVisible(true);
    }
  }, [measureKey, scaleFactor, autoScaleRatio, relativePadding, alignment]);

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

  // Text Outline stroke mapping
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

      {/* Dark Overlay - fades to 0 when text is cleared */}
      <div
        className="absolute inset-0 z-10 bg-black pointer-events-none transition-opacity duration-500"
        style={{ opacity: effectiveOverlayOpacity }}
      />

      {/* Screen Cleared Indicator (preview only) */}
      {state.type === "clear" && isPreview && (
        <div className="text-white/30 uppercase tracking-widest text-xs font-semibold z-20 relative">
          Screen Cleared
        </div>
      )}

      {/* Scripture Content
          opacity stays 0 until the layout effect confirms the correct autoScaleRatio,
          preventing long verses from shooting off-screen and short verses from
          appearing at a wrong (shrunken) size. */}
      {state.type === "scripture" && state.scripture && (
        <div
          style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.15s ease-in" }}
          className="relative z-20 w-[92%] max-w-[95%] flex flex-col items-center justify-center text-center"
        >
          <div ref={contentRef} className="flex flex-col items-center justify-center text-center">
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
        </div>
      )}
    </div>
  );
}
