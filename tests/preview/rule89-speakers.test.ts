import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, sendOutcomeCounts,
  type PreviewPorts } from './journal-test-worker.js';
import { jevQuestions } from './reply-check.js';

type Counts = { accepted: number; speakers: { agent: number; infrastructure: number } };
const evidence = JSON.parse(readFileSync(new URL('./fixtures/rule89-speakers-2026-10-14.json', import.meta.url), 'utf8')) as {
  samples: { label: string; update: number; at: number; reply: string; sent: number;
    heldNoticeSent: number; before: Counts; after: Counts }[] };

it('the exact desk B8 expression accepts recorded messages and no-message acknowledgements, but refuses wrong accounting', () => {
  const expression = readFileSync(new URL('./fixtures/rule89-b8-expression.txt', import.meta.url), 'utf8').trim();
  // Execute the actual Python expression handed to the desk, not a TypeScript translation.
  const result = execFileSync('python3', ['-c', `
import copy,json,sys
original,expression=json.load(sys.stdin)
def check(samples, scheduler=0, missing=False):
  def U(label): return next(s['update'] for s in samples if s['label']==label)
  def F(name):
    label=name.removeprefix('turns-').removesuffix('.json')
    return json.dumps({'turns': [] if missing else [next(s for s in samples if s['label']==label)]})
  def d(before,label,path):
    if path=='intakeWriters.scheduler': return scheduler
    s=next(s for s in samples if s['label']==label)
    def get(value):
      for key in path.split('.')[1:]: value=value[key]
      return value
    return get(s['after'])-get(s['before'])
  return eval(expression,dict(json=json,F=F,U=U,d=d))
assert check(original) is True
assert check(original,missing=True) is None
assert check(original,scheduler=1) is None
without=copy.deepcopy(original)
for sample in without:
  sample['heldNoticeSent']=None
  sample['after']['speakers']['infrastructure']-=1
  sample['after']['accepted']-=1
assert check(without) is True # no text acknowledgement, including a reaction
for base in (original,without):
  for label in ('b5','b8'):
    for speaker in ('agent','infrastructure'):
      for delta in (-1,1):
        bad=copy.deepcopy(base)
        next(s for s in bad if s['label']==label)['after']['speakers'][speaker]+=delta
        assert check(bad) is False
    bad=copy.deepcopy(base)
    next(s for s in bad if s['label']==label)['after']['accepted']+=1
    assert check(bad) is False
print('recorded + no-message positives; missing/scheduler UNTESTED; 20 wrong-count negatives passed')
`], { input: JSON.stringify([evidence.samples, expression]), encoding: 'utf8', timeout: 10000 });
  expect(result).toContain('20 wrong-count negatives passed');
});

// B8 must account for the additional *message*, not assume an acknowledgement
// exists on every turn. A reaction has no held-notice message receipt.
for (const sample of evidence.samples) {
  it(`recorded ${sample.update}: reconcile every sent message by speaker`, () => {
    const agent = sample.label === 'b5' ? 1 : 0;
    const infrastructure = 1 - agent + Number(sample.heldNoticeSent > 0);
    expect(sample.after.speakers.agent - sample.before.speakers.agent).toBe(agent);
    expect(sample.after.speakers.infrastructure - sample.before.speakers.infrastructure).toBe(infrastructure);
    expect(sample.after.accepted - sample.before.accepted).toBe(agent + infrastructure);
  });

  for (const acknowledge of [false, true]) for (const timing of ['before-send', 'after-send'] as const)
    it(`${sample.update}: ${timing}, text acknowledgement=${acknowledge}; signed counters survive replay`, async () => {
      const root = mkdtempSync(join(tmpdir(), 'rule89-')), path = join(root, 'journal.encrypted');
      const key = new Uint8Array(32).fill(89);
      let now = sample.at;
      let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
        grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 86400000,
        maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
      const sent: Parameters<PreviewPorts['send']>[0][] = [];
      const ports: PreviewPorts = { now: () => now, stopped: () => false, checkOutbound: () => {},
        acknowledgementTimer: () => () => {}, replyReviewTiming: timing,
        model: async () => sample.reply,
        replyCheck: { elapsedMs: () => 0,
          jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
            Object.keys(jevQuestions).map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 0 }),
          escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 0 }) },
        send: async input => { sent.push(input); return input.expectedText === REPLY_ACKNOWLEDGEMENT ? sample.heldNoticeSent : sample.sent; } };
      try {
        const worker = createJournalWorker(journal, ports);
        // Synthetic verified intake wraps the recorded delivered answer; this does
        // not claim to replay the original model/reviewer calls or raw intake.
        worker.intake([{ update_id: sample.update, message: { chat: { id: 7654321, type: 'private' },
          from: { id: 7654321 }, text: sample.label === 'b8' ? 'status' : 'What is one easy stretch to do after a long walk?' } }]);
        if (acknowledge) { now += 7000; await worker.minimal(); }
        await worker.drain(); await worker.reviewReplies(); await worker.minimal();
        const speakers = { agent: sample.label === 'b5' ? 1 : 0,
          infrastructure: Number(sample.label === 'b8') + Number(acknowledge) };
        expect(journal.view.speakers).toEqual(speakers);
        if (timing === 'after-send') expect(journal.view.order[0]?.afterSendReview).toBe(true);
        expect(sendOutcomeCounts(journal.view).accepted).toBe(1 + Number(acknowledge));
        expect(sent.map(row => row.provenance?.speaker)).toEqual([
          ...(acknowledge ? ['infrastructure'] : []), sample.label === 'b5' ? 'agent' : 'infrastructure']);
        expect(sent.filter(row => row.expectedText === REPLY_ACKNOWLEDGEMENT)).toHaveLength(Number(acknowledge));
        journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
        await createJournalWorker(journal, ports).drain();
        expect(sent).toHaveLength(1 + Number(acknowledge));
        expect(journal.view.speakers).toEqual(speakers);
      } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
    });
}
