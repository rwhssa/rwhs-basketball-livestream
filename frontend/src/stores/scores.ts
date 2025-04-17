import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type { SystemMode } from './mode';

// Score data interfaces
export interface GameScore {
  [className: string]: string;
}

export interface ScoreData {
  phase: SystemMode;
  scores: {
    game1?: GameScore;
    game2?: GameScore;
    final?: GameScore;
  };
}

// Initial empty state
const initialScores: ScoreData = {
  phase: 'semi',
  scores: {}
};

// Create the writable store
export const scores: Writable<ScoreData> = writable<ScoreData>(initialScores);

// Derived stores for specific games
export const game1Scores: Readable<GameScore> = derived(scores, $scores => $scores.scores.game1 || {});
export const game2Scores: Readable<GameScore> = derived(scores, $scores => $scores.scores.game2 || {});
export const finalScores: Readable<GameScore> = derived(scores, $scores => $scores.scores.final || {});