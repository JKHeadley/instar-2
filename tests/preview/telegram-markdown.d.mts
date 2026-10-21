import type { SendOutcome } from './outbound-provenance.js';
export function renderTelegramHtml(markdown: string): { html: string; shown: string };
export function telegramPlainText(markdown: string): string;
export function parseRefused(reply: unknown): boolean;
export function sendFormattedText(input: { text: string; expectedText: string; fallback?: { text: string }; body: Record<string, unknown>;
  recordRefusal: (reply: unknown) => void | boolean | Promise<void | boolean>;
  invoke: (request: Record<string, unknown>) => unknown; classify: (reply: unknown, expectedText: string) => SendOutcome;
  mayResend: () => boolean }): Promise<SendOutcome>;
