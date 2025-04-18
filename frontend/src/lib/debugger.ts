/**
 * Debug utility for the basketball livestream application
 */

export const DEBUG_MODE = true;

/**
 * Enhanced debug logger with type information
 * @param area System area that's logging
 * @param message Message to log
 * @param data Optional data to include
 */
export function debugLog(area: string, message: string, data?: any): void {
  if (DEBUG_MODE) {
    console.log(`[${area}] ${message}`, data || '');
  }
}

/**
 * Validate score data structure and report issues
 * @param scores The score data to validate
 * @returns True if valid, false if issues were found
 */
export function validateScores(scores: any): boolean {
  if (!scores) {
    console.error("Score data is null or undefined");
    return false;
  }

  if (!scores.scores) {
    console.error("Missing scores object in data structure:", scores);
    return false;
  }

  if (!scores.phase) {
    console.warn("Missing phase in score data:", scores);
    // This is just a warning, not a critical issue
  }
  
  // Check specific game data based on phase
  if (scores.phase === 'semi') {
    const hasGame1 = scores.scores.hasOwnProperty('game1');
    const hasGame2 = scores.scores.hasOwnProperty('game2');
    
    if (!hasGame1 && !hasGame2) {
      console.error("Semi-finals mode but no game1 or game2 data:", scores);
      return false;
    }
    
    // Validate each game's data if present
    if (hasGame1 && Object.keys(scores.scores.game1).length === 0) {
      console.warn("game1 exists but has no team data");
    }
    
    if (hasGame2 && Object.keys(scores.scores.game2).length === 0) {
      console.warn("game2 exists but has no team data");
    }
  }
  
  if (scores.phase === 'final') {
    if (!scores.scores.hasOwnProperty('final')) {
      console.error("Finals mode but no final game data:", scores);
      return false;
    }
    
    if (Object.keys(scores.scores.final).length === 0) {
      console.warn("final game exists but has no team data");
    }
  }
  
  return true;
}

/**
 * Format score data for display in debug overlays
 * @param scores Score data to format
 * @returns Formatted string representation
 */
export function formatScoreData(scores: any): string {
  if (!scores) return 'No data';
  
  try {
    return JSON.stringify(scores, null, 2);
  } catch (err) {
    return `Error formatting score data: ${err}`;
  }
}