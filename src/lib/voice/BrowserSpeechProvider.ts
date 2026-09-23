import { SpeechRecognitionProvider } from './SpeechProvider';
import { DeepgramClient } from '@deepgram/sdk';

export class BrowserSpeechProvider implements SpeechRecognitionProvider {
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private isListening: boolean = false;
  
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private connection: any = null; // using any since SDK types are not perfectly exported

  isSupported(): boolean {
    return true;
  }

  async start(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;

    try {
      // 1. Fetch Deepgram API Key securely from Next.js backend
      const res = await fetch('/api/voice/key');
      const { key } = await res.json();
      if (!key) {
        throw new Error("Missing DEEPGRAM_API_KEY in .env");
      }

      // 2. Initialize Deepgram SDK v3
      const client = new DeepgramClient({ apiKey: key });
      this.connection = await client.listen.v1.connect({
        model: "nova-3",
        language: "en",
        smart_format: true as any,
        interim_results: true as any,
        endpointing: 300,
      });

      this.connection.on("open", async () => {
        // 3. Get Microphone Access
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 4. Start recording and streaming chunks to Deepgram every 250ms
        this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: 'audio/webm' });
        
        this.mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && this.connection && this.connection.socket && this.connection.socket.readyState === 1) {
            this.connection.socket.send(event.data);
          }
        });
        
        this.mediaRecorder.start(250);
      });

      this.connection.on("message", (data: any) => {
        if (!this.isListening) return;
        
        if (data.type === "Results") {
          const isFinal = data.is_final;
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          
          if (transcript && transcript.trim().length > 0) {
            if (this.onTranscriptCallback) {
              this.onTranscriptCallback(transcript, isFinal);
            }
          }
        }
      });

      this.connection.on("error", (err: any) => {
        if (this.onErrorCallback) {
          // The Deepgram SDK passes a raw browser Event (not an Error instance) on
          // network-level failures, so err.message is often undefined or "[object Event]".
          // We inspect the event to give a useful message instead.
          let message = "Voice service error. Please try again.";

          if (err instanceof Error) {
            message = err.message;
          } else if (err && typeof err === "object") {
            // WebSocket CloseEvent carries a code + reason
            if ("code" in err) {
              const code: number = err.code;
              if (code === 1006 || code === 1001) {
                message = "Lost connection to voice service — check your internet connection.";
              } else if (code === 1008 || code === 4000) {
                message = "Voice service rejected the connection (invalid API key).";
              } else if (code === 1011) {
                message = "Voice service encountered an internal error. Please try again.";
              } else {
                message = `Voice connection closed (code ${code})${err.reason ? ": " + err.reason : ""}.`;
              }
            } else if ("type" in err && err.type === "error") {
              // Generic ErrorEvent with no code — almost always a network drop
              message = "Lost connection to voice service — check your internet connection.";
            }
          }

          this.onErrorCallback(new Error(message));
        }
        this.stop();
      });

      this.connection.on("close", (event: any) => {
        // Only surface a user-visible error for abnormal closures (code 1006 = no close frame,
        // meaning the network dropped). Normal stops (code 1000/1001 from this.stop()) are silent.
        if (this.isListening && this.onErrorCallback) {
          const code = event?.code;
          if (code && code !== 1000 && code !== 1001) {
            this.onErrorCallback(new Error("Lost connection to voice service — check your internet connection."));
          }
        }
        this.stop();
      });

      this.connection.connect();
      await this.connection.waitForOpen();

    } catch (err) {
      this.isListening = false;
      if (this.onErrorCallback) {
        let message = "Failed to start voice recognition.";
        if (err instanceof Error) {
          if (err.name === "NotAllowedError" || err.message.includes("Permission")) {
            message = "Microphone access denied. Please allow microphone access and try again.";
          } else if (err.message.includes("fetch") || err.message.includes("network") || err.message.includes("Failed to fetch")) {
            message = "Could not reach voice service — check your internet connection.";
          } else if (err.message.includes("DEEPGRAM_API_KEY") || err.message.includes("Missing")) {
            message = "Voice service is not configured (missing API key).";
          } else {
            message = err.message;
          }
        }
        this.onErrorCallback(new Error(message));
      }
    }
  }

  stop(): void {
    if (!this.isListening) return;
    this.isListening = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.connection) {
      try {
        if (this.connection.socket && this.connection.socket.readyState === 1) {
          this.connection.socket.close();
        }
      } catch (e) {}
      this.connection = null;
    }
  }

  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.onTranscriptCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }
}
