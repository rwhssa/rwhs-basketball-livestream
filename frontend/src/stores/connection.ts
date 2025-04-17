import { writable, type Writable } from 'svelte/store';

export interface ConnectionState {
  livekit: 'disconnected' | 'connecting' | 'connected' | 'error';
  websocket: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage?: string;
}

// Initial connection state
const initialState: ConnectionState = {
  livekit: 'disconnected',
  websocket: 'disconnected'
};

// Create the connection state store
export const connectionState: Writable<ConnectionState> = writable<ConnectionState>(initialState);