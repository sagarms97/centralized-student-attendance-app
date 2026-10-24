import { Injectable, inject, signal, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TranscribeResponse } from '../models/chatbot.models';

export interface SupportedLanguage {
  code: string;
  label: string;
  short: string;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);
  private apiUrl = `${environment.apiUrl}/chatbot`;

  readonly supportedLanguages: SupportedLanguage[] = [
    { code: 'en-IN', label: 'English (India)', short: 'EN' },
    { code: 'hi-IN', label: 'हिन्दी (Hindi)', short: 'HI' },
    { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', short: 'KN' }
  ];

  isListening = signal<boolean>(false);
  selectedLanguage = signal<string>('en-IN');
  isSupported = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private maxDurationTimer: any = null;
  private onTranscriptCallback: ((transcript: string, isFinal: boolean) => void) | null = null;

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.selectedLanguage();

      this.recognition.onstart = () => {
        this.ngZone.run(() => {
          this.isListening.set(true);
          this.errorMessage.set(null);
        });
      };

      this.recognition.onresult = (event: any) => {
        this.ngZone.run(() => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          const combined = (finalTranscript || interimTranscript).trim();
          if (combined && this.onTranscriptCallback) {
            this.onTranscriptCallback(combined, !!finalTranscript);
          }
        });
      };

      this.recognition.onerror = (event: any) => {
        this.ngZone.run(() => {
          this.isListening.set(false);
          this.clearTimer();

          switch (event.error) {
            case 'not-allowed':
            case 'permission-denied':
              this.errorMessage.set('Microphone permission was denied. Please allow microphone access in your browser settings.');
              break;
            case 'no-speech':
              // Silent stop, do not alarm user with error
              break;
            case 'audio-capture':
              this.errorMessage.set('No microphone was detected. Please connect an audio input device.');
              break;
            case 'network':
              this.errorMessage.set('Speech recognition network error. Please verify your internet connection.');
              break;
            default:
              this.errorMessage.set(`Speech recognition error: ${event.error}`);
              break;
          }
        });
      };

      this.recognition.onend = () => {
        this.ngZone.run(() => {
          this.isListening.set(false);
          this.clearTimer();
        });
      };
    } else {
      // Browser does not support Web Speech API - fallback will use MediaRecorder + Server STT
      this.isSupported.set(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
    }
  }

  setLanguage(langCode: string): void {
    this.selectedLanguage.set(langCode);
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
    // If currently listening, restart with new language
    if (this.isListening()) {
      const cb = this.onTranscriptCallback;
      this.stopListening();
      if (cb) {
        setTimeout(() => this.startListening(cb), 200);
      }
    }
  }

  toggleListening(onTranscript: (text: string, isFinal: boolean) => void): void {
    if (this.isListening()) {
      this.stopListening();
    } else {
      this.startListening(onTranscript);
    }
  }

  startListening(onTranscript: (text: string, isFinal: boolean) => void): void {
    this.errorMessage.set(null);
    this.onTranscriptCallback = onTranscript;

    // 1. Offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.errorMessage.set('You appear to be offline. Speech recognition requires an active network connection.');
      return;
    }

    // 2. Set max duration safety timer (60 seconds)
    this.clearTimer();
    this.maxDurationTimer = setTimeout(() => {
      if (this.isListening()) {
        this.stopListening();
      }
    }, 60000);

    // 3. Web Speech API (Primary)
    if (this.recognition) {
      try {
        this.recognition.lang = this.selectedLanguage();
        this.recognition.start();
      } catch (err: any) {
        // If already started or failed
        if (err.name !== 'InvalidStateError') {
          this.errorMessage.set('Could not initialize microphone. Please try again.');
        }
      }
      return;
    }

    // 4. Fallback: MediaRecorder + Server STT Provider Stub
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          this.isListening.set(true);
          this.audioChunks = [];
          this.mediaRecorder = new MediaRecorder(stream);

          this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              this.audioChunks.push(e.data);
            }
          };

          this.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            stream.getTracks().forEach(track => track.stop());
            this.sendAudioToServer(audioBlob);
          };

          this.mediaRecorder.start();
        })
        .catch(err => {
          this.isListening.set(false);
          this.clearTimer();
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            this.errorMessage.set('Microphone access was denied. Please allow microphone access in your browser settings.');
          } else {
            this.errorMessage.set('Unable to access microphone on this device.');
          }
        });
    } else {
      this.errorMessage.set('Speech recognition is not supported in this browser.');
    }
  }

  stopListening(): void {
    this.clearTimer();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }

    this.isListening.set(false);
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  private clearTimer(): void {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }

  private sendAudioToServer(audioBlob: Blob): void {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-recording.webm');
    formData.append('language', this.selectedLanguage());

    this.http.post<TranscribeResponse>(`${this.apiUrl}/transcribe`, formData).subscribe({
      next: (res) => {
        if (res.success && res.transcript && this.onTranscriptCallback) {
          this.onTranscriptCallback(res.transcript, true);
        } else if (res.error) {
          this.errorMessage.set(res.error);
        }
      },
      error: (err) => {
        const msg = err.error?.error || 'Server transcription failed. Please try typing your message.';
        this.errorMessage.set(msg);
      }
    });
  }
}
