// Stand-in for Claude Code inside tmux: it knows nothing except what SessionStart hooks
// (or a delivered message) put in its context, exactly like a freshly compacted or
// respawned model. Its "context" is mirrored to a file the test reads.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { groundingDigest } from '../../scripts/session-hooks/grounding.mjs';

const { INSTAR_SESSION_NAME: name, INSTAR_SESSION_INBOX: inbox, HARNESS_HOOK: hook, HARNESS_CONTEXT_FILE: contextFile } = process.env;
let context = '';
const save = () => writeFileSync(contextFile, context);
const receipt = (kind, extra = {}) => {
  mkdirSync(inbox, { recursive: true });
  const file = `${name}.${Date.now()}.${randomUUID()}.json`;
  writeFileSync(join(inbox, `${file}.tmp`), JSON.stringify({ kind, sessionId: 'fake', at: Date.now(), ...extra }));
  renameSync(join(inbox, `${file}.tmp`), join(inbox, file));
};
const sessionStart = source => {
  if (!hook) return { text: '', source };
  const out = spawnSync(process.execPath, [hook], { input: JSON.stringify({ session_id: 'fake', source, hook_event_name: 'SessionStart' }),
    encoding: 'utf8', env: process.env, timeout: 60_000, killSignal: 'SIGKILL' });
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
