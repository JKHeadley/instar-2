import type { SendOutcome } from './outbound-provenance.js';
export function renderTelegramHtml(markdown: string): { html: string; shown: string };
export function telegramPlainText(markdown: string): string;
export function sendFormattedText(input: { text: string; expectedText: string; body: Record<string, unknown>;
  invoke: (request: Record<string, unknown>) => unknown; classify: (reply: unknown, expectedText: string) => SendOutcome;
  mayResend: () => boolean }): SendOutcome;
