/** Exact, deliberately narrow first-person promises in a reply actually sent by the preview. */
import { parseDatedItem, type DatedItem } from './dated-memory.js';

export interface AgentPromise { quote: string; action: 'remind' | 'check' | 'follow up' | 'send' | 'tell' | 'update' | 'keep';
  owner: 'agent'; waitsOn: 'next-relevant-reply'; due?: DatedItem }

export function explicitAgentPromises(reply: string, source: string, at: number, zone: string): AgentPromise[] {
  const found: AgentPromise[] = [];
  let code = false;
  for (const line of reply.replace(/^PREVIEW — /u, '').split('\n')) {
    if (line.trimStart().startsWith('```')) { code = !code; continue; }
    if (code || /^\s*(?:>|["“'`])/u.test(line)) continue;
    for (const sentence of line.split(/(?<=[.!?])\s+/u)) {
      const match = /^\s*(?:I’ll|I'll|I will)\s+(remind you(?: to)?|check|follow up(?: on)?|send|tell|update|keep)(?:\s+(.+?))?(?:[.!?])?\s*$/iu.exec(sentence);
      if (!match) continue;
      const quote = sentence.trim(), action = match[1]!.toLowerCase().startsWith('remind') ? 'remind'
        : match[1]!.toLowerCase().startsWith('follow') ? 'follow up' : match[1]!.toLowerCase() as AgentPromise['action'];
      if (Buffer.byteLength(quote) > 500 || action !== 'remind' && (match[2]?.trim().length ?? 0) < 3
        || /\bto$/iu.test(match[1]!) && (match[2]?.trim().length ?? 0) < 3
        || found.some(item => item.quote === quote)) continue;
      const when = /\b(?:tomorrow|today|on \d{4}-\d{2}-\d{2})\b/iu.exec(quote)?.[0]?.replace(/^on /iu, '');
      const due = when ? parseDatedItem(source, quote, when, at, zone) : undefined;
      found.push({ quote, action, owner: 'agent', waitsOn: 'next-relevant-reply', ...(due ? { due } : {}) });
    }
  }
  return found;
}

/** Only a later API-accepted reply that actually says the promised reminder is evidence here. */
export function fulfillsReminder(promise: AgentPromise, reply: string): boolean {
  if (promise.action !== 'remind') return false;
  const target = /^(?:I’ll|I'll|I will) remind you to\s+(.+?)(?:[.!?])?$/iu.exec(promise.quote)?.[1]
    ?.replace(/\s+(?:tomorrow|today|on \d{4}-\d{2}-\d{2})\s*$/iu, '').replace(/[.!?]+$/u, '').trim();
  if (!target) return false;
  const reminder = /^Reminder:\s*(.+?)(?:[.!?])?$/imu.exec(reply.replace(/^PREVIEW — /u, ''))?.[1]
    ?.replace(/[.!?]+$/u, '').trim();
  return reminder?.toLowerCase() === target.toLowerCase();
}
