export interface Track {
  name: string;
  artist: string;
  url: string;
}

export interface WorkerMessage {
  type: 'audio' | 'preload';
  data: {
    url?: string;
    playingFullMusic: boolean;
    all?: boolean;
  };
}

export interface WorkerResponse {
  response: ArrayBuffer;
  actionType: 'load' | 'preload';
  playingFullMusic: boolean;
}

export interface StreamParams {
  all: boolean;
  sec?: number;
  amount?: number;
}