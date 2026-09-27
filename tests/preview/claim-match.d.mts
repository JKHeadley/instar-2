import type { MemoryChange } from './journal.js';

export function claimSpans(text: string, quote: string): number[];
export function hasClaim(text: string, quote: string): boolean;
export function replaceClaim(text: string, quote: string, replacement: string): string;
export function supersedesCorrection(change: MemoryChange, next: MemoryChange): boolean;
