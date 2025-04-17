import { writable, type Writable } from 'svelte/store';

// Types of pages in our application
export type PageType = 'home' | 'camera' | 'admin' | 'output';

// Store for current page
export const page: Writable<PageType> = writable<PageType>('home');