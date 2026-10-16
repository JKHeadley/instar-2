// Host-only projection of the existing bounded tool-admission record. No tool is run and
// no prompt is changed. A live adapter observation is necessary, but never sufficient.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export function readWorkingAdmission(base, claim) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/u.test(claim)) return null;
  try {
    const path = join(base, claim, 'admission.jsonl');
    if (statSync(path).size > 2 * 1024 * 1024) return null;
    return readFileSync(path, 'utf8');
  } catch { return null; }
}

/** Quoted self-written description preferred; otherwise the actual tool and its target.
 * The outbound secret and audience floors
 * still inspect this line. Missing/truncated evidence produces no status. */
export function admissionActivity(bytes, offset, claim) {
  if (typeof bytes !== 'string' || bytes.length <= offset) return null;
  const complete = bytes.slice(offset).split('\n'); complete.pop();
  if (complete.length > 4096) return null;
  const pending = new Map();
  let latest = null;
  for (const line of complete) {
    let row; try { row = JSON.parse(line); } catch { return null; }
    if (row.phase === 'post') pending.delete(row.id);
    if (row.phase === 'post-failure' && !row.agent && pending.get(row.id)?.tool === row.tool) pending.delete(row.id);
    if (row.phase === 'pre' && row.decision === 'allow' && typeof row.id === 'string' && !row.agent) { pending.set(row.id, row); latest = row; }
  }
  const running = [...pending.values()].at(-1);
  const row = running ?? latest;
  if (!row || typeof row.tool !== 'string') return null;
  const step = createHash('sha256').update(`${claim}:${row.id}:${row.input}`).digest('hex');
  // All admitted root occurrences have completion evidence. Do not describe an ended
  // command as current work, or infer what the model or background children are doing.
  if (!running) return { step, text: 'Status: latest main-session tool call ended' };
  let input; try { input = JSON.parse(row.input); } catch { return null; }
  if (!input || typeof input !== 'object') return null;
  const own = typeof input.description === 'string' ? input.description.trim() : '';
  const path = typeof input.file_path === 'string' ? input.file_path : typeof input.path === 'string' ? input.path : '';
  const target = path ? path.split('/').filter(Boolean).at(-1) : '';
  // A tool name by itself is not a useful account of what is being done.
  const command = typeof input.command === 'string' ? input.command.trim() : '';
  const detail = own || (target ? `${row.tool}: ${target}` : command ? `${row.tool}: ${command}` : '');
  if (!detail) return null;
  const text = `Status: ${detail.replace(/\s+/gu, ' ')}`;
  // Do not cut a credential before the existing exact outbound wall can inspect it.
  if (text.length > 280) return null;
  return { step, text };
}

export function createWorkingActivities({ read, now }) {
  const active = new Map();
  return {
    observe(operation, claim, phase) {
      if (phase === 'end' || claim === null) { active.delete(operation); return; }
      if (phase === 'start') {
        const bytes = read(claim);
        active.set(operation, { claim, offset: typeof bytes === 'string' ? bytes.length : 0, observedAt: null });
      } else {
        const current = active.get(operation);
        if (current?.claim === claim) current.observedAt = now();
      }
    },
    current(operation) {
      const state = active.get(operation);
      if (!state || state.observedAt === null || now() - state.observedAt > 10_000) return null;
      const activity = admissionActivity(read(state.claim), state.offset, state.claim);
      return activity ? { ...activity, observedAt: state.observedAt } : null;
    },
  };
}
