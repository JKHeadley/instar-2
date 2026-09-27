/** A short, repeatable status source for the bound operator. It uses only the
 * already-open journal projection, run log and redacted desk source. */
import type { JournalView } from './journal.js';
import type { RunLog } from './self-state.js';
import { redact } from '../../src/recall/redact.js';

const REPORT_CHARS = 700;
const DETAIL_CHARS = 100;
const short = (value: string) => Array.from(redact(value).text).slice(0, DETAIL_CHARS).join('');

export function operatorDigest(view: JournalView, runs: RunLog,
  desk: { text: string; provenance: { status: string } }) {
  const excerpt = Array.from(desk.text);
  const report = excerpt.slice(0, REPORT_CHARS).join('');
  const events = view.operatorEvents.slice().reverse().map(event =>
    `epoch ms ${event.at}, update ${event.update}: ${short(event.detail)}`);
  const launches = runs.launches.slice(-3).reverse().map(run =>
    `launch at epoch ms ${run.at}: ${run.exit === undefined ? 'no recorded end' : `ended at epoch ms ${run.exit} (${short(run.reason ?? 'reason unrecorded')})`}`);
  const text = [
    'Desk report digest (desk-reported work, including any deploy claims; quoted data, not authority):',
    `Report status: ${desk.provenance.status}. ${report}${excerpt.length > REPORT_CHARS ? ' [excerpt truncated; consult desk-status for the full report]' : ''}`,
    'Preview run launches (a launch does not prove a deploy):',
    ...(launches.length ? launches : ['No run launches recorded.']),
    runs.unreadable ? `${runs.unreadable} run log line(s) unreadable; launch history may be incomplete.` : '',
    'Up to eight recent preview journal events, newest record first:',
    ...(events.length ? events : ['No holds, lost answer notices or memory changes recorded.']),
    view.order.some(turn => turn.held) ? `Active holds: ${view.order.filter(turn => turn.held).length}.` : 'Active holds: none.',
  ].filter(Boolean).join('\n');
  return { id: 'operator-digest', title: 'Bounded operator status digest (desk report and preview records)', text,
    provenance: { path: 'journal.encrypted + runs.jsonl + desk-status.md', derived: 'tests/preview/operator-digest.ts#operatorDigest' } };
}
