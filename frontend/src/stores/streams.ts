import { writable, type Writable } from 'svelte/store';
import type { RemoteParticipant, RemoteTrackPublication } from 'livekit-client';

// Interface for tracking stream metadata
export interface StreamInfo {
  participant: RemoteParticipant;
  videoPublication?: RemoteTrackPublication;
  audioPublication?: RemoteTrackPublication;
  phase: 'semi' | 'final';
  game?: 'game1' | 'game2' | 'final';
  angle?: 'main' | 'angle1' | 'angle2';
}

// Main store for all available streams
export const availableStreams: Writable<StreamInfo[]> = writable<StreamInfo[]>([]);

// Store for currently active/selected source in finals mode
export const selectedSource: Writable<string | null> = writable<string | null>(null); // Stores participant SID