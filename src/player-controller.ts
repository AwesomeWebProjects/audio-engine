import { AudioEngine } from './audio-engine';
import { Playlist } from './playlist';
import {
  fetchAudioStream,
  fetchAudioXHR,
  hasStreamSupport,
} from './audio-loader';
import { EventEmitter } from './event-emitter';
import type { Track, WorkerResponse } from './types';

export interface PlayerControllerOptions {
  tracks: Track[];
  thread?: 'main' | 'worker';
  initialVolume?: number;
  autoPlay?: boolean;
  workerURL?: URL | string;
}

export interface PlayerControllerEvents {
  play: () => void;
  pause: () => void;
  timeupdate: (currentTime: number, duration: number) => void;
  trackchange: (track: Track, index: number) => void;
  loading: (isLoading: boolean) => void;
  ended: () => void;
  volumechange: (volume: number) => void;
  fullsongloaded: () => void;
  ready: () => void;
}

export class PlayerController extends EventEmitter<PlayerControllerEvents> {
  private engine: AudioEngine;
  private playlist: Playlist;
  private worker: Worker | null = null;

  private preloadFn: (() => Promise<ArrayBuffer>) | null = null;
  private isPreloading = false;
  private _isFullSong = false;
  private canPreload = true;
  private currentUrl: string | null = null;

  private _isReady = false;
  private _isPlaying = false;
  private _isLoading = false;
  private _volume: number;
  private _currentTime = 0;
  private _duration = 0;

  private timeInterval: ReturnType<typeof setInterval> | null = null;
  private hasInitialized = false;

  private readonly thread: 'main' | 'worker';
  private readonly workerURL?: URL | string;

  constructor(options: PlayerControllerOptions) {
    super();

    const {
      tracks,
      thread = 'worker',
      initialVolume = 0.5,
      workerURL,
    } = options;

    this.engine = new AudioEngine();
    this.playlist = new Playlist(tracks);
    this._volume = initialVolume;
    this.thread = thread;
    this.workerURL = workerURL;

    this.playlist.onChange = (track, index) => {
      this.emit('trackchange', track, index);
      if (this.hasInitialized) {
        this.loadAndPlay(track.url);
      }
    };

    this.engine.onEnded = () => {
      if (this._isFullSong) {
        this.emit('ended');
        this.playlist.next();
      }
    };

    if (thread === 'worker') {
      this.initWorker();
    }
  }

  // --- Playback ---

  play(): void {
    if (!this.hasInitialized) {
      this.hasInitialized = true;
      this.loadAndPlay(this.playlist.currentTrack.url);
    } else {
      this.engine.resume();
      this._isPlaying = true;
      this.emit('play');
    }
  }

  pause(): void {
    this.engine.suspend();
    this._isPlaying = false;
    this.emit('pause');
  }

  togglePlay(): void {
    if (this._isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(progress: number): void {
    const dur = this.engine.getDuration();
    if (dur <= 0) return;
    this.engine.seek(Math.max(0, Math.min(1, progress)) * dur);
  }

  setVolume(value: number): void {
    this.engine.setVolume(value);
    this._volume = Math.max(0, Math.min(1, value));
    this.emit('volumechange', this._volume);
  }

  // --- Playlist ---

  next(): void {
    if (!this.hasInitialized) {
      this.hasInitialized = true;
    }
    this.playlist.next();
  }

  prev(): void {
    if (!this.hasInitialized) {
      this.hasInitialized = true;
    }
    this.playlist.prev();
  }

  goTo(index: number): void {
    if (!this.hasInitialized) {
      this.hasInitialized = true;
    }
    this.playlist.goTo(index);
  }

  setTracks(tracks: Track[]): void {
    this.playlist.setTracks(tracks);
  }

  // --- State getters ---

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get isFullSong(): boolean {
    return this._isFullSong;
  }

  get volume(): number {
    return this._volume;
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get duration(): number {
    return this._duration;
  }

  get progress(): number {
    return this.engine.getProgress();
  }

  get currentTrack(): Track {
    return this.playlist.currentTrack;
  }

  get currentIndex(): number {
    return this.playlist.currentIndex;
  }

  get tracks(): Track[] {
    return this.playlist.tracks;
  }

  // --- Frequency data for visualizers ---

  get analyserNode(): AnalyserNode | null {
    return this.engine.getAnalyser();
  }

  get frequencyData(): Uint8Array<ArrayBuffer> | null {
    return this.engine.getFrequencyData();
  }

  getProgress(): number {
    return this.engine.getProgress();
  }

  // --- Lifecycle ---

  dispose(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.engine.dispose();
    this.removeAllListeners();
  }

  // --- Private ---

  private ensureEngine(): AudioEngine {
    if (!this._isReady) {
      this.engine.init(this._volume);
      this._isReady = true;
      this.emit('ready');

      // Start time tracking
      if (this.timeInterval) clearInterval(this.timeInterval);
      this.timeInterval = setInterval(() => {
        const ct = this.engine.getCurrentTime();
        const dur = this.engine.getDuration();
        if (ct !== this._currentTime || dur !== this._duration) {
          this._currentTime = ct;
          this._duration = dur;
          this.emit('timeupdate', ct, dur);
        }
      }, 300);
    }
    return this.engine;
  }

  private initWorker(): void {
    const rawUrl = this.workerURL ?? new URL('./audio-worker.js', import.meta.url);
    let workerUrl: string | URL = rawUrl;

    // When bundled (e.g. Vite library mode), the worker file gets inlined as a
    // data URL. Data URL workers have an opaque (null) origin and cannot make
    // same-origin fetch requests. Convert to a blob URL which inherits the
    // document's origin.
    if (rawUrl instanceof URL && rawUrl.protocol === 'data:') {
      const dataStr = rawUrl.href;
      const commaIndex = dataStr.indexOf(',');
      const base64 = dataStr.substring(commaIndex + 1);
      const code = atob(base64);
      const blob = new Blob([code], { type: 'text/javascript' });
      workerUrl = URL.createObjectURL(blob);
    }

    const worker = new Worker(workerUrl);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { response, actionType, playingFullMusic } = event.data;

      if (actionType === 'load') {
        this.engine
          .decodeAndPlay(response)
          .then(() => {
            this._isPlaying = true;
            this._isLoading = false;
            this.canPreload = true;
            this._isFullSong = playingFullMusic;

            this.emit('play');
            this.emit('loading', false);
            if (playingFullMusic) {
              this.emit('fullsongloaded');
            }

            // Immediately preload full song
            if (!playingFullMusic && !this.isPreloading) {
              this.isPreloading = true;
              this.worker?.postMessage({
                type: 'preload',
                data: { playingFullMusic: false, all: true },
              });
            }
          })
          .catch(console.error);
      } else if (actionType === 'preload') {
        if (this.canPreload) {
          this.engine
            .decodeAndSwap(response)
            .then(() => {
              this._isPlaying = true;
              this.isPreloading = false;
              this._isFullSong = true;
              this.canPreload = false;
              this.emit('play');
              this.emit('fullsongloaded');
            })
            .catch(console.error);
        }
      }
    };

    this.worker = worker;
  }

  private triggerPreload(): void {
    if (this.thread === 'worker' && this.worker) {
      this.worker.postMessage({
        type: 'preload',
        data: { playingFullMusic: this._isFullSong, all: true },
      });
    } else if (this.preloadFn) {
      this.preloadFn()
        .then((buffer) => {
          if (this.canPreload) {
            return this.engine.decodeAndSwap(buffer).then(() => {
              this._isPlaying = true;
              this.isPreloading = false;
              this._isFullSong = true;
              this.canPreload = false;
              this.emit('play');
              this.emit('fullsongloaded');
            });
          }
        })
        .catch(console.error);
    }
  }

  private loadAndPlay(url: string): void {
    this.currentUrl = url;
    this._isFullSong = false;
    this.canPreload = true;
    this.isPreloading = false;
    this.preloadFn = null;
    this._isLoading = true;
    this.emit('loading', true);

    this.ensureEngine();

    if (this.thread === 'worker' && this.worker) {
      this.worker.postMessage({
        type: 'audio',
        data: { url, playingFullMusic: false },
      });
    } else if (hasStreamSupport) {
      fetchAudioStream(url)
        .then(({ buffer, isFullSong, preloadFn }) => {
          if (this.currentUrl !== url) return;
          this.preloadFn = preloadFn;
          this._isFullSong = isFullSong;
          if (isFullSong) this.emit('fullsongloaded');
          return this.engine.decodeAndPlay(buffer);
        })
        .then(() => {
          if (this.currentUrl !== url) return;
          this._isPlaying = true;
          this._isLoading = false;
          this.canPreload = true;

          this.emit('play');
          this.emit('loading', false);

          if (!this._isFullSong && this.preloadFn && !this.isPreloading) {
            this.isPreloading = true;
            this.triggerPreload();
          }
        })
        .catch(console.error);
    } else {
      fetchAudioXHR(url)
        .then(({ buffer }) => {
          if (this.currentUrl !== url) return;
          this._isFullSong = true;
          this.emit('fullsongloaded');
          return this.engine.decodeAndPlay(buffer);
        })
        .then(() => {
          if (this.currentUrl !== url) return;
          this._isPlaying = true;
          this._isLoading = false;
          this.emit('play');
          this.emit('loading', false);
        })
        .catch(console.error);
    }
  }
}