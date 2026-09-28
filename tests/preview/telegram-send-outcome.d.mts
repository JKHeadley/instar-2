import type { SendOutcome } from './outbound-provenance.js';
export function classifyTelegramSend(reply: unknown, expected: { chat: string; expectedText: string; thread?: number }): SendOutcome;
