import type { SystemMode } from '../stores/mode';

// Environment variables (will be replaced by actual values at build time)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface TokenResponse {
  token: string;
  room: string;
}

export interface TokenRequest {
  type: 'camera' | 'admin' | 'output';
  phase: SystemMode;
  metadata?: Record<string, string>;
}

/**
 * Get LiveKit token from backend
 * @param params Token request parameters
 * @returns Token response
 */
export async function getToken(params: TokenRequest): Promise<TokenResponse> {
  const queryParams = new URLSearchParams({
    type: params.type,
    phase: params.phase
  });
  
  // Add metadata if provided
  if (params.metadata) {
    queryParams.append('metadata', JSON.stringify(params.metadata));
  }
  
  const response = await fetch(`${API_BASE_URL}/api/token?${queryParams.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`);
  }
  
  return response.json() as Promise<TokenResponse>;
}