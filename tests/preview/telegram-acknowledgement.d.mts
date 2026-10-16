import type { SendOutcome } from './outbound-provenance.js';
export type NoticeInvoke = (method: string, body: Record<string, unknown>, timeoutMs: number) => unknown;
export function reactionAcknowledgement(invoke: NoticeInvoke, chat: string, message: number): SendOutcome | null;
export function createReplyTyping(input: { invoke: NoticeInvoke; allowed(): Promise<boolean>; now(): number;
  after(ms: number, run: () => void): () => void }): {
    start(chat: string, thread: number | undefined, current: () => boolean, working?: () => boolean): void;
    stop(chat: string, thread: number | undefined): void;
  };
