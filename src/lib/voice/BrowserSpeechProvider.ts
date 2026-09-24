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
      // 1. Get Microphone Access FIRST (prompts user for mic permission immediately)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Fetch Deepgram API Key securely from Next.js backend
      const res = await fetch('/api/voice/key');
      const { key } = await res.json();
      const apiKey = key?.trim();
      if (!apiKey) {
        throw new Error("Missing DEEPGRAM_API_KEY in .env");
      }

      // 3. Initialize Deepgram Client & Connection
      // Pass token in queryParams so browser WebSockets (which cannot send custom headers) can authenticate
      const client = new DeepgramClient({ apiKey });
      this.connection = await client.listen.v1.connect({
        model: "nova-3",
        language: "en",
        smart_format: true as any,
        interim_results: true as any,
        endpointing: 500,
        queryParams: {
          token: apiKey,
        },
      } as any);

      // Listen for transcription results from Deepgram
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

      // Handle socket errors
      this.connection.on("error", (err: any) => {
        console.error("Deepgram connection error:", err);
        if (this.onErrorCallback) {
          let message = "Voice service error. Please try again.";
          if (err instanceof Error) {
            message = err.message;
          } else if (err && typeof err === "object" && err.message) {
            message = String(err.message);
          }
          this.onErrorCallback(new Error(message));
        }
        this.stop();
      });

      // Handle socket close
      this.connection.on("close", (event: any) => {
        console.log("Deepgram connection closed:", event);
        if (this.isListening && this.onErrorCallback) {
          const code = event?.code;
          if (code && code !== 1000 && code !== 1001) {
            this.onErrorCallback(new Error("Lost connection to voice service — check your internet connection."));
          }
        }
        this.stop();
      });

      // 4. Start MediaRecorder immediately to record and stream audio chunks
      if (this.mediaStream && this.isListening) {
        this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: 'audio/webm' });
        
        this.mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && this.connection && this.connection.socket) {
            try {
              // Send audio chunk directly to Deepgram socket
              this.connection.socket.send(event.data);
            } catch (e) {
              console.error('Error sending audio chunk to Deepgram:', e);
            }
          }
        });
        
        this.mediaRecorder.start(250);
      }

    } catch (err: any) {
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
