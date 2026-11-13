import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts } from './journal-test-worker.js';
// @ts-expect-error Host-only observation reader.
import { createWorkingActivities } from './working-activity.mjs';
import { WORKING_LIVENESS } from './working-progress.js';

const roots: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

// Incident shape supplied by the desk: message 785 at 12:38:45, reaction +31s,
// fixed progress +158s with running:false, answer +165s (160s model time).
// The tool request below is a constructed neighbor: no exact captured tool bytes
// or tool start time were supplied. Never present it as a recovered live trace.
it.each(['open', 'completed', 'no description', 'no tools', 'secret', 'stopped'] as const)(
  'message 785 recorded-shape writer: %s evidence, bounded progress and no post-answer note', async mode => {
    vi.useFakeTimers(); const intakeAt = Date.parse('2026-11-12T12:38:45Z'); vi.setSystemTime(intakeAt);
    const root = mkdtempSync(join(tmpdir(), 'truthful-progress-')); roots.push(root);
    const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(71);
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: intakeAt + 3600000,
      maxCalls: 30, maxReplies: 30, maxTurns: 20, maxBytes: 262144, cursor: 0 });
    let bytes = '', release!: (answer: string) => void, entered!: () => void;
    const enteredPromise = new Promise<void>(done => { entered = done; });
    const busy = new Promise<string>(done => { release = done; });
    const activity = createWorkingActivities({ read: () => bytes, now: () => Date.now() });
    const sent: { text: string; at: number; target: string | undefined }[] = [];
    const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false,
      model: async () => { entered(); return busy; }, workingActivity: () => activity.current('answer'),
      checkOutbound: text => { if (text.includes('fixture-secret')) throw Error('secret wall'); },
      send: async input => { if (input.target?.startsWith('held-notice:')) { await new Promise(resolve => setTimeout(resolve, 24000)); return { kind: 'accepted', message: 785, acknowledgementPath: 'reaction' }; } sent.push({ text: input.expectedText, at: Date.now(), target: input.target }); return sent.length + 785; } };
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: 785, message: { message_id: 785, chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Take your time, just keep me posted.' } }]);
    const drain = worker.drain(); const progress = () => sent.filter(row => row.target?.startsWith('working-progress:'));
    try {
      await enteredPromise; activity.observe('answer', 'message-785', 'start');
      await vi.advanceTimersByTimeAsync(31000);
      expect(journal.view.order[0]?.acknowledgementPath).toBe('reaction');
      if (mode === 'completed') await vi.advanceTimersByTimeAsync(88000);
      const description = mode === 'secret' ? 'Read fixture-secret' : 'Read the GitHub API and count files';
      bytes = JSON.stringify({ phase: 'pre', id: 'github-count', tool: 'Bash', decision: 'allow',
        input: JSON.stringify(mode === 'no description' ? {} : { description, command: 'fixture-command-never-executed' }) }) + '\n';
      if (mode === 'no tools') bytes = '';
      if (mode === 'completed') bytes += JSON.stringify({ phase: 'post', id: 'github-count', tool: 'Bash' }) + '\n';
      if (mode === 'stopped') worker.stop('operator');
      while (Date.now() < intakeAt + 125000) {
        activity.observe('answer', 'message-785', 'working');
        await vi.advanceTimersByTimeAsync(1000);
      }
      if (mode === 'open') {
        expect(progress()).toHaveLength(1);
        expect(progress()[0]?.text).toBe('Tool request in progress: “Bash: Read the GitHub API and count files”');
        expect(progress()[0]!.at - intakeAt).toBeGreaterThanOrEqual(120000);
        expect(progress()[0]!.at - intakeAt).toBeLessThanOrEqual(125000);
        expect(progress()[0]!.text).not.toMatch(/finished|found|counted|success/iu);
      } else if (mode === 'secret' || mode === 'stopped') expect(progress()).toHaveLength(0);
      else expect(progress().map(row => row.text)).toEqual([WORKING_LIVENESS]);
      activity.observe('answer', null, 'end');
      await vi.advanceTimersByTimeAsync(40000); release('The requested answer.'); await drain.catch(error => { if (mode !== 'stopped') throw error; });
      const count = progress().length;
      await vi.advanceTimersByTimeAsync(1200000); expect(progress()).toHaveLength(count);
      journal.compact(); journal.close();
      const reopened = openPreviewJournal(path, key);
      try { await createJournalWorker(reopened, ports).drain().catch(error => { if (mode !== 'stopped') throw error; }); expect(progress()).toHaveLength(count); }
      finally { reopened.close(); }
    } finally { release('Done.'); await drain.catch(() => {}); journal.close(); }
  });
