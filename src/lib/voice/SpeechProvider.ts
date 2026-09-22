export interface SpeechRecognitionProvider {
  start(): void;
  stop(): void;
  onTranscript(callback: (text: string, isFinal: boolean) => void): void;
  onError(callback: (error: Error) => void): void;
  isSupported(): boolean;
}
