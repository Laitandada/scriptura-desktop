"use client";

import { useEffect, useState, useRef } from "react";
import { usePresentationStore, PresentationStateData } from "@/store/presentationStore";
import { Maximize2 } from "lucide-react";

import { PresentationView } from "@/components/PresentationView";

export default function PresentationPage() {
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
      // Silently fail. When running natively in Electron (which forces true OS-level fullscreen),
      // the Chromium engine sometimes throws "Permissions check failed" if you try to 
      // stack an HTML5 fullscreen request on top of it. Since the window is already 
      // visually fullscreen, we don't care if the web API fails.
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

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for video controls, heartbeat, and fullscreen requests from dashboard
  useEffect(() => {
    const channel = new BroadcastChannel('scriptura-presentation-sync');
    
    channel.onmessage = (event) => {
      if (!event.data) return;
      if (event.data.type === 'PING') {
        channel.postMessage({ type: 'PONG' });
      } else if (event.data.type === 'FULLSCREEN_REQUEST') {
        // Dashboard is commanding us to go fullscreen
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

  // Auto-fullscreen on first user interaction (fallback for browsers
  // that block programmatic fullscreen). Any touch or mouse press will
  // trigger fullscreen once, so the user doesn't need to find and click
  // a specific button.
  useEffect(() => {
    if (isFullscreen) return;
    
    const autoFullscreen = () => {
      enterFullscreen();
      // Remove all listeners after first trigger
      document.removeEventListener('pointerdown', autoFullscreen);
      document.removeEventListener('keydown', autoFullscreen);
    };
    
    document.addEventListener('pointerdown', autoFullscreen, { once: true });
    document.addEventListener('keydown', autoFullscreen, { once: true });
    
    return () => {
      document.removeEventListener('pointerdown', autoFullscreen);
      document.removeEventListener('keydown', autoFullscreen);
    };
  }, [isFullscreen]);

  // Initial load from the database as fallback
  useEffect(() => {
    async function loadInitialState() {
      try {
        const res = await fetch("/api/presentation/current");
        if (res.ok) {
          const data = await res.json();
          // Update store state locally without triggering re-broadcast loop
          usePresentationStore.setState({ state: data });
        }
      } catch (err) {
        console.error("Failed to load initial presentation state", err);
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
