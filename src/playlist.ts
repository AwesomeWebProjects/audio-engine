import type { Track } from './types';

export class Playlist {
  private _tracks: Track[];
  private _currentIndex: number;
  private _onChange: ((track: Track, index: number) => void) | null = null;

  constructor(tracks: Track[], startIndex = 0) {
    this._tracks = tracks;
    this._currentIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
  }

  get tracks(): Track[] {
    return this._tracks;
  }

  get currentTrack(): Track {
    return this._tracks[this._currentIndex];
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  set onChange(callback: ((track: Track, index: number) => void) | null) {
    this._onChange = callback;
  }

  setTracks(tracks: Track[]): void {
    this._tracks = tracks;
    this._currentIndex = 0;
    this._onChange?.(this.currentTrack, this._currentIndex);
  }

  next(): void {
    this._currentIndex =
      this._currentIndex >= this._tracks.length - 1
        ? 0
        : this._currentIndex + 1;
    this._onChange?.(this.currentTrack, this._currentIndex);
  }

  prev(): void {
    this._currentIndex =
      this._currentIndex <= 0
        ? this._tracks.length - 1
        : this._currentIndex - 1;
    this._onChange?.(this.currentTrack, this._currentIndex);
  }

  goTo(index: number): void {
    this._currentIndex = Math.max(
      0,
      Math.min(index, this._tracks.length - 1),
    );
    this._onChange?.(this.currentTrack, this._currentIndex);
  }
}