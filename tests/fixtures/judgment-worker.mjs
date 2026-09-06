import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../dist/index.js';
import { decodeLoopPolicy } from '../../dist/transport/index.js';
import { createJudgmentSlice } from '../../scripts/judgment-slice.mjs';

const [seedPath, directory, mode, cut] = process.argv.slice(2), seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const out = v => writeSync(1, JSON.stringify(v) + '\n');
const stopAt = phase => {
  if (mode === 'start' && cut === phase) {
    out({ ready: true, phase }); process.kill(process.pid, 'SIGSTOP');
    throw new Error('test worker must be killed, never resume');
  }
};
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
if (mode === 'resume') {
  const result = slice.doorway.resumeRecording(seed.question.id);
  out(consumeResult(result, { Success: resolution => ({ recorded: true, resolution }), Refused: r => ({ recorded: false, detail: r.detail }) }));
} else {
  const token = take(slice.six.acquire('acquire', '', 500));
  take(slice.six.schedule('schedule', token, seed.question.run, take(decodeLoopPolicy(seed.policy, slice.c))));
  const result = await slice.doorway.judge(seed.question, token);
  out(consumeResult(result, { Success: answer => ({ answer, recorded: true }), Refused: r => ({ recorded: false, detail: r.detail }) }));
}
