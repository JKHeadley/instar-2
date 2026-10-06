// Stand-in for Claude Code inside tmux: it knows nothing except what SessionStart hooks
// (or a delivered message) put in its context, exactly like a freshly compacted or
// respawned model. Its "context" is mirrored to a file the test reads.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { groundingDigest } from '../../scripts/session-hooks/grounding.mjs';

const { INSTAR_SESSION_NAME: name, INSTAR_SESSION_INBOX: inbox, HARNESS_HOOK: hook, HARNESS_CONTEXT_FILE: contextFile } = process.env;
let context = '';
// Both files below are MIRRORS of what the stand-in already holds in memory, written only so
// the case can read them. A write that fails transiently under a full-suite run (the host out
// of descriptors, the shared scratch volume momentarily gone) used to throw out of the input
// loop and end the process, and a dead stand-in takes its tmux session with it — which is all
// the sb-w4-a7c gate could report on 2026-10-05: "timed out waiting for the answer after
// COMPACTED:" with an EMPTY pane, because tmux answers a missing session with exit 1 and no
// output. So every mirror write retries inside a finite bound, re-creating its directory first.
// The bytes written are unchanged; nothing is retried that the stand-in does not already know.
const WRITE_ATTEMPTS = 20, WRITE_PAUSE_MS = 25;
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const mirror = write => {
  for (let attempt = 1; ; attempt++) {
    try { return write(); } catch (error) {
      if (attempt >= WRITE_ATTEMPTS) throw error;
      try { mkdirSync(dirname(contextFile), { recursive: true }); mkdirSync(inbox, { recursive: true }); }
      catch { /* reported by the next write attempt, or by the throw above */ }
      pause(WRITE_PAUSE_MS);
    }
  }
};
const save = () => mirror(() => writeFileSync(contextFile, context));
const receipt = (kind, extra = {}) => mirror(() => {
  mkdirSync(inbox, { recursive: true });
  const file = `${name}.${Date.now()}.${randomUUID()}.json`;
  writeFileSync(join(inbox, `${file}.tmp`), JSON.stringify({ kind, sessionId: 'fake', at: Date.now(), ...extra }));
  renameSync(join(inbox, `${file}.tmp`), join(inbox, file));
});
const sessionStart = source => {
  if (!hook) return { text: '', source };
  const input = JSON.stringify({ session_id: 'fake', source, hook_event_name: 'SessionStart' });
  let out;
  // A spawn that never started the hook (the host out of descriptors or processes) is retried
  // inside the same finite bound: it ran nothing, so it wrote no receipt and a retry duplicates
  // nothing. A hook that DID run is taken as it stands, however it answered — including one the
  // finite timeout below killed: a hung hook ran, may have written a receipt, and a retry would
  // duplicate it, so a timeout ends the loop rather than repeating the call. The timeout is what
  // keeps a hook that never returns from holding this synchronous call, and with it the case's
  // own budget, open for the whole run.
  for (let attempt = 1; ; attempt++) {
    out = spawnSync(process.execPath, [hook], { input, encoding: 'utf8', env: process.env, timeout: 60_000, killSignal: 'SIGKILL' });
    if (out.error === undefined || out.error.code === 'ETIMEDOUT' || attempt >= WRITE_ATTEMPTS) break;
    pause(WRITE_PAUSE_MS);
  }
  try { return { text: JSON.parse(out.stdout).hookSpecificOutput.additionalContext, source }; } catch { return { text: '', source }; }
};
const consumed = result => {
  if (!result.text) return;
  const resetId = result.text.match(/Reset-ID ([a-f0-9-]+)/)?.[1];
  receipt('context-consumed', { source: result.source, digest: groundingDigest(result.text), resetId });
};
const carryOn = () => {
  const pending = context.match(/^ {2}\[[^\]]+\] [^:]+: "(.*)"$/m)?.[1];
  const promise = context.match(/^ {2}- \[[^\]]+\] \(you owe[^)]*\) (.*)$/m)?.[1];
  process.stdout.write(`\nCARRYING ON: ${pending ?? promise ?? 'nothing known — would have to ask the user'}\n❯ `);
};
const started = sessionStart('startup'); context = started.text; save(); consumed(started);
process.stdout.write(`BOOTED hook=${hook ? 'on' : 'off'}\n`); carryOn();
let paste = null;
// A stand-in that exits takes its tmux session with it, and the test then captures an EMPTY
// pane with no cause at all — the gate failure of 2026-10-05 on sb-w4-a7c read only
// "timed out waiting for the answer after COMPACTED:" with nothing after the colon. So the
// reason for every end of the input loop is printed INTO the pane, and the process then holds
// the session open (bounded, well past the case's own 30 s budget) instead of vanishing.
// Nothing here is a retry: the failure still fails, it just says what happened.
const heldMs = Number(process.env.HARNESS_HOLD_MS ?? 120_000);
const stop = (reason, detail) => {
  process.stdout.write(`\nHARNESS ${reason}${detail === undefined ? '' : `: ${detail}`}\n\u276f `);
  setTimeout(() => process.exit(0), heldMs); // a live timer, so the pane survives for the case to read
};
try {
  for await (const line of createInterface({ input: process.stdin })) {
    if (paste !== null) {
      paste.push(line);
      if (line === '=== END INSTAR GROUNDING ===') {
        context = paste.join('\n'); paste = null; save(); process.stdout.write('\nREGROUNDED');
        receipt('delivery-consumed', { operation: context.match(/Delivery operation: ([^\n]+)/)?.[1],
          lastInboundMessageId: context.match(/Last inbound message ID: ([^\.\n]+)/)?.[1]?.startsWith('unavailable')
            ? null : context.match(/Last inbound message ID: ([^\.\n]+)/)?.[1] ?? null });
        receipt('turn-closed'); carryOn();
      }
      continue;
    }
    if (line.startsWith('[instar awareness]')) { paste = [line]; continue; }
    if (line.trim() === '/compact') {
      context = ''; receipt('compact'); const reset = sessionStart('compact'); context = reset.text; save(); consumed(reset);
      process.stdout.write('\nCOMPACTED'); carryOn();
    }
  }
  stop('INPUT ENDED');
} catch (error) {
  stop('FAILED', `${error?.code ?? ''} ${error?.message ?? error}`.trim());
}
