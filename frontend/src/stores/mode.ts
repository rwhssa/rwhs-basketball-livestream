import { writable, type Writable } from 'svelte/store';

// System modes
export type SystemMode = 'semi' | 'final';

// Store for current system mode
export const mode: Writable<SystemMode> = writable<SystemMode>('semi');