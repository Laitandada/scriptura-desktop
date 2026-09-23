"use client";

import { useEffect, useState, useRef } from "react";
import { usePresentationStore } from "@/store/presentationStore";
import { PresentationView } from "@/components/PresentationView";

export default function AlternateOutputPage() {
  const { state, setState } = usePresentationStore();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      // Electron native fullscreen handles OS level window sizing.
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error attempting to toggle fullscreen:", err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for BroadcastChannel updates (shared with Main Output)
  useEffect(() => {
    const channel = new BroadcastChannel('scriptura-presentation-sync');
    channel.onmessage = (event) => {
      if (!event.data) return;
      if (event.data.type === 'PING') {
        channel.postMessage({ type: 'PONG' });
      } else if (event.data.type === 'FULLSCREEN_REQUEST') {
        enterFullscreen();
      } else if (event.data.type === 'VIDEO_CONTROL' && videoRef.current) {
        const { command, value } = event.data;
        switch (command) {
          case 'play':
            videoRef.current.play().catch(console.error);
            break;
          case 'pause':
            videoRef.current.pause();
            break;
          case 'seek':
            videoRef.current.currentTime = value;
            break;
          case 'loop':
            videoRef.current.loop = value;
            break;
        }
      }
    };

    // Immediately request current active state from Dashboard as soon as window loads
    channel.postMessage({ type: 'REQUEST_STATE' });

    return () => channel.close();
  }, []);

  // Initial load from the database as fallback
  useEffect(() => {
    async function loadInitialState() {
      try {
        const res = await fetch("/api/presentation/current");
        if (res.ok) {
          const data = await res.json();
          usePresentationStore.setState({ state: data });
        }
      } catch (err) {
        console.error("Failed to load initial alternate output presentation state", err);
      } finally {
        setIsLoaded(true);
      }
    }
    loadInitialState();
  }, []);

  if (!isLoaded) return <div className="bg-black w-screen h-screen" />;

  return (
    <PresentationView
      state={state}
      videoRef={videoRef}
      onClick={enterFullscreen}
      onDoubleClick={toggleFullscreen}
      className="w-screen h-screen"
      isPreview={false}
    />
  );
}
