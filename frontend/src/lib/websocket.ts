import { connectionState } from '../stores/connection';
import { scores, type ScoreData } from '../stores/scores';

let wsInstance: WebSocket | null = null;
let reconnectTimeout: number | null = null;

/**
 * Connect to WebSocket server for score updates
 * @param url WebSocket server URL
 * @param onMessage Optional callback for message handling
 * @returns WebSocket instance
 */
export function connectWebSocket(
  url: string = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
  onMessage?: (data: ScoreData) => void
): WebSocket {
  
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    return wsInstance;
  }
  
  connectionState.update(state => ({ ...state, websocket: 'connecting' }));
  
  const ws = new WebSocket(url);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    connectionState.update(state => ({ ...state, websocket: 'connected' }));
    
    // Clear any pending reconnection
    if (reconnectTimeout !== null) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    connectionState.update(state => ({ ...state, websocket: 'disconnected' }));
    
    // Try to reconnect
    reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket');
      connectWebSocket(url, onMessage);
    }, 3000) as unknown as number;
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    connectionState.update(state => ({
      ...state,
      websocket: 'error',
      errorMessage: 'WebSocket connection error'
    }));
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as ScoreData;
      
      // Update scores store
      scores.set(data);
      
      // Call optional handler
      if (onMessage) {
        onMessage(data);
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  };
  
  wsInstance = ws;
  return ws;
}

/**
 * Disconnect WebSocket connection
 */
export function disconnectWebSocket(): void {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsInstance.close();
  }
  
  if (reconnectTimeout !== null) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  wsInstance = null;
}