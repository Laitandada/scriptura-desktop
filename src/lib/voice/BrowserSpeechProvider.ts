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
      const apiKey = key?.trim();
      if (!apiKey) {
        throw new Error("Missing DEEPGRAM_API_KEY in .env");
      }

      // 2. Initialize Deepgram Client & Connection
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

      // 3. When socket opens, request microphone access & start recording audio chunks
      this.connection.on("open", async () => {
        try {
          if (!this.isListening) return;
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: 'audio/webm' });
          
          this.mediaRecorder.addEventListener('dataavailable', (event) => {
            if (event.data.size > 0 && this.connection && this.connection.socket) {
              try {
                this.connection.socket.send(event.data);
              } catch (e) {
                console.error("Error sending audio chunk to Deepgram:", e);
              }
            }
          });
          
          this.mediaRecorder.start(250);
        } catch (micErr: any) {
          if (this.onErrorCallback) {
            this.onErrorCallback(new Error("Microphone access denied. Please allow microphone access and try again."));
          }
          this.stop();
        }
      });

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

      // Handle socket errors silently during listening session, logging to console
      this.connection.on("error", (err: any) => {
        console.error("Deepgram connection error:", err);
      });

      // Handle socket close
      this.connection.on("close", (event: any) => {
        if (this.isListening && this.onErrorCallback) {
          const code = event?.code;
          if (code && code !== 1000 && code !== 1001) {
            this.onErrorCallback(new Error("Lost connection to voice service — check your internet connection."));
          }
        }
        this.stop();
      });

      // 4. Trigger connection and wait for open
      this.connection.connect();
      await this.connection.waitForOpen();

    } catch (err: any) {
      this.isListening = false;
      if (this.onErrorCallback) {
        let message = "Failed to start voice recognition.";
        if (err instanceof Error) {
          message = err.message;
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
