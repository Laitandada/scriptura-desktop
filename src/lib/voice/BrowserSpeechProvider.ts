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
          this.onErrorCallback(new Error(err.message || "Deepgram Error"));
        }
        this.stop();
      });

      this.connection.on("close", () => {
        this.stop();
      });

      this.connection.connect();
      await this.connection.waitForOpen();

    } catch (err) {
      this.isListening = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(err instanceof Error ? err : new Error(String(err)));
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
