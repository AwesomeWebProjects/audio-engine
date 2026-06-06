# @awesome-web-projects/audio-engine

Framework-agnostic audio engine powered by the Web Audio API. Provides streaming audio loading, playlist management, playback control, and visualization data — no rendering library required.

## Features

- Web Audio API playback with `AudioContext`, `AnalyserNode`, and `GainNode`
- Streaming audio loading via `ReadableStream` with XHR fallback
- Web Worker support for background audio fetching
- Partial loading — starts playing in seconds, preloads the full song in the background
- Built-in playlist management (next, previous, go-to)
- Event-driven `PlayerController` that orchestrates everything
- Frequency data access for building custom visualizers
- Zero runtime dependencies
- Full TypeScript support with exported types
- Works with any framework (React, Vue, Svelte, Web Components, vanilla JS)

## Installation

```bash
npm install @awesome-web-projects/audio-engine
```

## Quick Start

```typescript
import { PlayerController } from '@awesome-web-projects/audio-engine';

const player = new PlayerController({
  tracks: [
    { name: 'Song One', artist: 'Artist A', url: '/songs/one.mp3' },
    { name: 'Song Two', artist: 'Artist B', url: '/songs/two.mp3' },
  ],
  thread: 'worker',
  initialVolume: 0.5,
});

// Listen to events
player.on('play', () => console.log('Playing'));
player.on('pause', () => console.log('Paused'));
player.on('trackchange', (track, index) => console.log(`Now playing: ${track.name}`));
player.on('timeupdate', (currentTime, duration) => {
  console.log(`${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s`);
});

// Control playback
player.play();
player.pause();
player.togglePlay();
player.next();
player.prev();
player.seek(0.5);       // seek to 50%
player.setVolume(0.8);  // 0-1

// Access state
console.log(player.isPlaying);
console.log(player.currentTrack);
console.log(player.progress);

// Visualization data
const analyser = player.analyserNode;
const freqData = player.frequencyData;

// Clean up
player.dispose();
```

## API

### `PlayerController`

The main class that orchestrates the audio engine, playlist, and loader.

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tracks` | `Track[]` | *required* | Array of tracks to play |
| `thread` | `'main' \| 'worker'` | `'worker'` | Audio fetching strategy |
| `initialVolume` | `number` | `0.5` | Initial volume (0-1) |
| `autoPlay` | `boolean` | `false` | Start playing immediately |
| `workerURL` | `URL \| string` | — | Custom worker URL for cross-package bundling |

#### Methods

| Method | Description |
|--------|-------------|
| `play()` | Start or resume playback |
| `pause()` | Pause playback |
| `togglePlay()` | Toggle play/pause |
| `seek(progress)` | Seek to position (0-1) |
| `setVolume(value)` | Set volume (0-1) |
| `next()` | Skip to next track |
| `prev()` | Go to previous track |
| `goTo(index)` | Jump to track by index |
| `setTracks(tracks)` | Replace the playlist |
| `dispose()` | Clean up all resources |

#### State Getters

| Getter | Type | Description |
|--------|------|-------------|
| `isPlaying` | `boolean` | Whether audio is currently playing |
| `isLoading` | `boolean` | Whether a track is being loaded |
| `isReady` | `boolean` | Whether the engine is initialized |
| `isFullSong` | `boolean` | Whether the full song has been loaded |
| `volume` | `number` | Current volume (0-1) |
| `currentTime` | `number` | Current playback time in seconds |
| `duration` | `number` | Total duration in seconds |
| `progress` | `number` | Playback progress (0-1) |
| `currentTrack` | `Track` | Currently active track |
| `currentIndex` | `number` | Index of current track |
| `tracks` | `Track[]` | All tracks in the playlist |
| `analyserNode` | `AnalyserNode \| null` | Web Audio analyser for visualization |
| `frequencyData` | `Uint8Array \| null` | Current frequency data |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `play` | — | Playback started or resumed |
| `pause` | — | Playback paused |
| `timeupdate` | `(currentTime, duration)` | Playback time changed |
| `trackchange` | `(track, index)` | Active track changed |
| `loading` | `(isLoading)` | Loading state changed |
| `ended` | — | Current track finished |
| `volumechange` | `(volume)` | Volume changed |
| `fullsongloaded` | — | Full song buffer loaded |
| `ready` | — | Engine initialized |

### `AudioEngine`

Low-level Web Audio API wrapper. Use `PlayerController` unless you need direct control.

### `Playlist`

Standalone playlist class with `next()`, `prev()`, `goTo()`, and `onChange` callback.

### Utilities

| Export | Description |
|--------|-------------|
| `formatTime(seconds)` | Formats seconds to `m:ss` string |
| `fetchAudioStream(url)` | Streams audio via `ReadableStream` |
| `fetchAudioXHR(url)` | Fetches audio via XHR (fallback) |
| `hasStreamSupport` | Whether the browser supports streaming |
| `EventEmitter` | Generic typed event emitter |

### Types

```typescript
interface Track {
  name: string;
  artist: string;
  url: string;
}
```

## Related Packages

- [`@awesome-web-projects/react-player`](https://github.com/AwesomeWebProjects/react-player) — React components built on this engine
- [`@awesome-web-projects/music-player`](https://github.com/AwesomeWebProjects/music-player) — Web Components built on this engine

## Development

```bash
npm install
npm run build        # Build library
npm run dev          # Build in watch mode
npm run typecheck    # Type check
```

## License

MIT