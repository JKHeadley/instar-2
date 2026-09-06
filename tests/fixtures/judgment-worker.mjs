import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { consumeResult } from '../../dist/index.js';
import { decodeLoopPolicy } from '../../dist/transport/index.js';
import { createJudgmentSlice } from '../../scripts/judgment-slice.mjs';

const [seedPath, directory, mode, cut] = process.argv.slice(2), seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const out = v => writeSync(1, JSON.stringify(v) + '\n');
const stopAt = phase => {
  if (['start', 'capture-lock', 'capture-reaper'].includes(mode) && cut === phase) {
    out({ ready: true, phase }); process.kill(process.pid, 'SIGSTOP');
    if (mode === 'capture-reaper') return; // Race test resumes the losing reaper.
    throw new Error('test worker must be killed, never resume');
  }
};
if (mode === 'capture-lock') {
  // Fault injection observes the REAL custody lock boundary, not a fabricated
  // lock file. One cut precedes owner publication; the other follows its fsync.
  const mkdir = fs.mkdirSync, open = fs.openSync, sync = fs.fsyncSync;
  let ownerFd;
  fs.mkdirSync = (path, ...args) => { const result = mkdir(path, ...args); if (String(path).endsWith('/captures/capture.lock')) stopAt('capture-empty'); return result; };
  fs.openSync = (path, ...args) => { const fd = open(path, ...args); if (/\/capture\.lock\/owner-[a-f0-9-]+\.json$/.test(String(path))) ownerFd = fd; return fd; };
  fs.fsyncSync = fd => { sync(fd); if (fd === ownerFd) stopAt('capture-owner'); };
  syncBuiltinESMExports();
}
if (mode === 'capture-reaper') {
  const unlink = fs.unlinkSync; let paused = false;
  fs.unlinkSync = path => {
    if (!paused && /\/capture\.lock\/owner-[a-f0-9-]+\.json$/.test(String(path))) { paused = true; stopAt('capture-reaper'); }
    return unlink(path);
  };
  syncBuiltinESMExports();
}
const runtime = { incarnation: mode === 'resume' ? 'worker:2' : 'worker:1', authorityIncarnation: mode === 'resume' ? 'authority:2' : 'authority:1', monotonic: () => 100,
  invoke: async (bytes, operation) => {
    const fd = openSync(join(directory, 'provider-invocations.jsonl'), 'a', 0o600);
    try { appendFileSync(fd, JSON.stringify({ bytes, operation }) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
    stopAt('provider'); return seed.observation;
  },
  storage: base => ({ ...base, append: (bytes, head) => {
    const result = base.append(bytes, head);
    consumeResult(result, { Success: () => {
      const row = JSON.parse(bytes).body?.record;
      if (row?.phase === 'dispatch-observed') stopAt('dispatch');
      if (row?.phase === 'response-observed') stopAt('response');
      if (row?.type === 'JudgmentResolution') stopAt('resolution');
    }, Refused: () => {} }); return result;
  } }),
};
const slice = createJudgmentSlice(seed, directory, runtime);
if (mode === 'capture-lock') {
  take(slice.captures.reserve(1)); throw new Error('expected capture lock fault cut');
} else if (mode === 'capture-reaper') {
  out(consumeResult(slice.captures.reserve(1), { Success: () => ({ ok: true }), Refused: r => ({ ok: false, detail: r.detail }) }));
} else if (mode === 'capture-probe') {
  const response = take(slice.store.read()).map(f => f.body?.record).find(r => r?.phase === 'response-observed');
  out({ bytes: take(slice.captures.read(response.receipt)), write: consumeResult(slice.captures.reserve(1),
    { Success: () => ({ ok: true }), Refused: r => ({ ok: false, detail: r.detail }) }) });
} else if (mode === 'resume') {
  const result = slice.doorway.resumeRecording(seed.question.id);
  out(consumeResult(result, { Success: resolution => ({ recorded: true, resolution }), Refused: r => ({ recorded: false, detail: r.detail }) }));
} else {
  const token = take(slice.six.acquire('acquire', '', 500));
  take(slice.six.schedule('schedule', token, seed.question.run, take(decodeLoopPolicy(seed.policy, slice.c))));
  const result = await slice.doorway.judge(seed.question, token);
  out(consumeResult(result, { Success: answer => ({ answer, recorded: true }), Refused: r => ({ recorded: false, detail: r.detail }) }));
}
