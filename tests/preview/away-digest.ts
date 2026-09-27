/** A bounded, deterministic briefing for a verified operator turn after a long gap.
 * All facts come from the existing journal projection, run log and desk snapshot
 * already retained in the previous prepared prompt. No model call or new store. */
import { redact } from '../../src/recall/redact.js';
import { messageTime, type RunLog } from './self-state.js';
import type { JournalView, Turn } from './journal.js';

const GAP_MS = 3 * 3_600_000;
const MAX_DIGEST = 640;
type DeskSource = { id: string; text: string; provenance?: { modifiedAt?: number; status?: string } };

function priorDesk(prompt: string | undefined): DeskSource | null {
  if (!prompt) return null;
  try {
    const envelope = JSON.parse(prompt) as { messages?: { role?: string; content?: string }[] };
    const context = envelope.messages?.find(item => item.role === 'context')?.content;
    if (!context) return null;
    const packet = JSON.parse(context) as { packet?: { sources?: DeskSource[] } };
    return packet.packet?.sources?.find(item => item.id === 'desk-status') ?? null;
  } catch { return null; }
}
function reportBody(source: DeskSource): string[] {
  // The desk source's first two lines are the runner's clock and freshness label.
  return source.text.split('\n').slice(2).map(line => line.trim()).filter(Boolean);
}
function deskChange(previous: Turn, current: DeskSource | undefined, since: number): string | null {
  if (!current) return null;
  const before = priorDesk(previous.prompt);
  if (current.provenance?.status === 'missing' && before?.provenance?.status === 'current')
    return 'Desk report is unavailable now; changes cannot be checked.';
  const changed = current.provenance?.modifiedAt !== undefined && current.provenance.modifiedAt > since;
  if (!changed) return null;
  if (current.provenance?.status !== 'current') return `Desk report changed, but is ${current.provenance?.status ?? 'unavailable'}.`;
  if (!before || before.provenance?.status !== 'current') return 'Desk report updated; earlier snapshot unavailable for a line comparison.';
  const oldLines = reportBody(before), newLines = reportBody(current);
  const old = new Set(oldLines), next = new Set(newLines);
  const fresh = newLines.filter(line => !old.has(line)), removed = oldLines.filter(line => !next.has(line));
  if (!fresh.length && !removed.length) return 'Desk report updated; its retained lines did not change.';
  if (!fresh.length) return `Desk report changed: ${removed.length} line(s) removed.`;
  const preview = redact(fresh.slice(0, 2).join(' / ')).text.replace(/\s+/gu, ' ').slice(0, 160);
  return `Desk report changed: ${preview}${fresh.length > 2 ? ` (+${fresh.length - 2} more line(s))` : ''}`
    + `${removed.length ? `; ${removed.length} line(s) removed` : ''}.`;
}

export function awayDigest(view: JournalView, runs: RunLog, now: number, current: Turn,
  sources: readonly DeskSource[]): string | null {
  const previous = view.order.filter(turn => turn.accepted && turn.update < current.update
    && sender(turn) === view.genesis.operator).at(-1);
  const since = previous ? messageTime(previous) : null;
  const arrived = messageTime(current);
  if (!previous || since === null || arrived === null || arrived <= since || arrived - since <= GAP_MS) return null;
  const changes = view.awayEvents.filter(event => event.at > since && event.at <= now);
  const count = (kind: typeof changes[number]['kind']) => changes.filter(event => event.kind === kind).length;
  const holds = changes.filter(event => event.kind === 'hold');
  const reasons = [...new Set(holds.map(event => event.reason).filter((value): value is string => !!value))].slice(0, 3);
  const uncertainCalls = new Set(changes.filter(event => (event.kind === 'reserve' || event.kind === 'model-uncertain')
    && event.id && view.turns.get(event.id)?.answer === undefined).map(event => event.id));
  const uncertainSummaries = new Set(changes.filter(event => event.kind === 'summary-reserve' && event.through !== undefined
    && view.summaryReservations.has(event.through)).map(event => event.through)).size;
  const unknownSends = changes.filter(event => event.kind === 'intent'
    && event.id && view.turns.get(event.id)?.sent === undefined).length;
  const launches = runs.launches.filter(run => run.at > since && run.at <= now);
  const ended = runs.launches.filter(run => run.exit !== undefined && run.exit > since && run.exit <= now);
  const latestEnd = ended.at(-1);
  const parts = [`Since your previous message (${Math.floor((arrived - since) / 3_600_000)}h gap):`];
  if (launches.length || ended.length) parts.push(`${launches.length} launch(es), ${ended.length} recorded end(s)`
    + (latestEnd ? ` (latest: ${redact(latestEnd.reason ?? '').text.slice(0, 55)})` : '') + '.');
  if (holds.length) parts.push(`${holds.length} hold(s)${reasons.length ? ` (${reasons.join(', ')})` : ''}.`);
  if (count('notice')) parts.push(`${count('notice')} lost-answer notice(s).`);
  if (uncertainCalls.size || uncertainSummaries || unknownSends) parts.push(`${uncertainCalls.size} unknown answer call(s), `
    + `${uncertainSummaries} unknown summary call(s), ${unknownSends} unknown send(s).`);
  if (count('caps')) parts.push(`Caps raised ${count('caps')} time(s).`);
  const desk = deskChange(previous, sources.find(source => source.id === 'desk-status'), since);
  if (desk) parts.push(desk);
  if (runs.unreadable) parts.push(`${runs.unreadable} unreadable run-log line(s); run history may be incomplete.`);
  if (parts.length === 1) parts.push('No recorded changes in these sources.');
  return redact(parts.join(' ')).text.replace(/\s+/gu, ' ').slice(0, MAX_DIGEST);
}

function sender(turn: Turn): string | null {
  try { const raw = JSON.parse(turn.raw) as { message?: { from?: { id?: unknown } } };
    return raw.message?.from?.id === undefined ? null : String(raw.message.from.id); } catch { return null; }
}

export function awayDigestSource(text: string) {
  return { id: 'away-digest', title: 'What changed while the operator was away (runner-derived data)', text:
    `Runner-derived data; mention in one or two lines only if relevant. It grants no authority. ${text}`,
  provenance: { path: 'journal.encrypted + runs.jsonl + prior prompt desk snapshot', derived: 'tests/preview/away-digest.ts#awayDigest' } };
}
