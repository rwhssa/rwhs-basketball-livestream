import {
  Room,
  RoomEvent,
  RemoteParticipant,
  ConnectionState as LiveKitConnectionState
} from 'livekit-client';
import { get } from 'svelte/store';
import { connectionState } from '../stores/connection';

/**
 * Function to update connection state based on LiveKit room state
 * @param room LiveKit room instance
 * @param state Current connection state
 */
export function updateConnectionState(room: Room | null, state?: LiveKitConnectionState): void {
  if (!room) {
    connectionState.update(c => ({ ...c, livekit: 'disconnected' }));
    return;
  }
  
  let status: 'disconnected' | 'connecting' | 'connected' | 'error';
  
  if (state !== undefined) {
    switch (state) {
      case LiveKitConnectionState.Connecting:
        status = 'connecting';
        break;
      case LiveKitConnectionState.Connected:
        status = 'connected';
        break;
      case LiveKitConnectionState.Disconnected:
        status = 'disconnected';
        break;
      default:
        status = 'error';
    }
  } else {
    // Determine state from room
    switch (room.state) {
      case 'connecting':
        status = 'connecting';
        break;
      case 'connected':
        status = 'connected';
        break;
      case 'disconnected':
        status = 'disconnected';
        break;
      default:
        status = 'error';
    }
  }
  
  connectionState.update(c => ({ ...c, livekit: status }));
}

/**
 * Parse LiveKit participant metadata
 * @param participant LiveKit participant
 * @returns Parsed metadata or null if invalid
 */
export function parseMetadata(participant: RemoteParticipant): Record<string, any> | null {
  try {
    if (!participant.metadata) {
      return null;
    }
    return JSON.parse(participant.metadata);
  } catch (e) {
    console.error('Error parsing metadata:', e);
    return null;
  }
}