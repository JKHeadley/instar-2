import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createDecipheriv } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps, UNKNOWN_ANSWER_NOTICE, MODEL_FAILURE_REPLY } from './journal.js';
import type { JournalRecord } from './journal.js';

const key = new Uint8Array(32).fill(7);
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-compact-')));
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 30, maxTurns: 30, maxBytes: 262144, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;
const raw = (n: number) => JSON.stringify({ update_id: n, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: `question ${n}` } });
function seed(root: string) {
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  journal.append({kind:'intake',id:id(1),update:1,text:'question 1',raw:raw(1),accepted:true,cursor:2,at:1000});
  journal.append({kind:'reserve',id:id(1),prompt:'exact prepared input',at:1001});
  journal.append({kind:'answer',id:id(1),text:'answer 1',at:1002});
  journal.append({kind:'intent',id:id(1),text:'PREVIEW — answer 1',chat:genesis.chat,update:1,grant:genesis.grant,at:1003});
  journal.append({kind:'sent',id:id(1),message:41,at:1004});
  journal.append({kind:'intake',id:id(2),update:2,text:'question 2',raw:raw(2),accepted:true,cursor:3,at:1005});
  journal.append({kind:'reserve',id:id(2),prompt:'prepared for unknown send',at:1006});
  journal.append({kind:'answer',id:id(2),text:'answer 2',memory:[{mode:'correct',source:id(1),
    quote:'question 1',trigger:id(2),replacement:'question 2'}],at:1007});
  journal.append({kind:'intent',id:id(2),text:'PREVIEW — answer 2',chat:genesis.chat,update:2,grant:genesis.grant,at:1008});
  journal.append({kind:'intake',id:id(3),update:3,text:'question 3',raw:raw(3),accepted:true,cursor:4,at:1009});
  journal.append({kind:'hold',id:id(3),reason:'reply check unavailable',at:1010});
  journal.append({kind:'intake',id:id(4),update:4,text:'question 4',raw:raw(4),accepted:true,cursor:5,at:1011});
  journal.append({kind:'reserve',id:id(4),at:1012});
  journal.append({kind:'model-uncertain',id:id(4),state:'uncertain',at:1013});
  journal.append({kind:'summary-reserve',through:3,at:1014});
  journal.append({kind:'channel-item',item:{source:'email',account:'agent@example.test',id:'mail-1',
    from:'friend@example.test',at:1000,text:'remember the blue notebook'},at:1015});
  journal.close();
  return path;
}
function read(root: string) { return openPreviewJournal(join(root, 'journal.encrypted'), key); }
function decodedRows(path: string): {kind: string; data?: string; retained?: JournalRecord[]}[] {
  const sealed = readFileSync(path), rows = [];
  for (let offset = 0; offset < sealed.length;) {
    const length = sealed.readUInt32BE(offset), body = sealed.subarray(offset + 4, offset + 4 + length);
    const decipher = createDecipheriv('aes-256-gcm', key, body.subarray(0, 12));
    decipher.setAAD(Buffer.from(`preview-journal:${offset}`)); decipher.setAuthTag(body.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(body.subarray(28)), decipher.final()]);
    rows.push(JSON.parse((plain[0] === 1 ? brotliDecompressSync(plain.subarray(1)) : plain).toString('utf8')));
    offset += 4 + length;
  }
  return rows;
}
function retainedRows(path: string): JournalRecord[] {
  const chunks = decodedRows(path).filter(row => row.kind === 'snapshot-chunk');
  const snapshot = JSON.parse(Buffer.concat(chunks.map(row => Buffer.from(row.data!, 'base64'))).toString('utf8')) as
    {retained: JournalRecord[]};
  return snapshot.retained;
}
const withoutSnapshotPromptCopies = <T extends { kind: string }>(rows: T[]): T[] => rows.map(row => {
  if (row.kind !== 'reserve') return row;
  const stored = { ...row } as T & { prompt?: string }; delete stored.prompt; return stored;
});

it('compacts only above the threshold and bounds repeated hold writes without losing state', () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted');
    let replacements = 0;
    const journal = openPreviewJournal(path, key, genesis,
      stage => { if (stage === 'compact:after-rename') replacements++; }, false, 4096);
    const before = journal.size;
    expect(before).toBeLessThan(4096);
    expect(readFileSync(path).length).toBe(before);
    journal.append({kind:'intake',id:id(1),update:1,text:'question 1',raw:raw(1),accepted:true,cursor:2,at:1000});
    journal.append({kind:'hold',id:id(1),reason:'waiting',at:1001});
    for (let i = 0; i < 80; i++) journal.append({kind:'hold',id:id(1),reason:'waiting',at:1002 + i});
    expect(replacements).toBeGreaterThan(0);
    expect(journal.size).toBeLessThan(8192);
    expect(readFileSync(path).length).toBe(journal.size);
    journal.close();
    const replay = read(root);
    expect(replay.view.order).toHaveLength(1);
    expect(replay.view.cursor).toBe(2);
    expect(replay.view.order[0]?.held).toBe('waiting');
    replay.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('compacts an overlimit older journal on writer restart', () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted');
    const old = openPreviewJournal(path, key, genesis);
    old.append({kind:'intake',id:id(1),update:1,text:'question 1',raw:raw(1),accepted:true,cursor:2,at:1000});
    for (let i = 0; i < 80; i++) old.append({kind:'hold',id:id(1),reason:'waiting',at:1001+i});
    old.close();
    const oldBytes = statSync(path).size;
    expect(oldBytes).toBeGreaterThan(4096);
    let replacements = 0;
    const resumed = openPreviewJournal(path,key,undefined,
      stage=>{if(stage==='compact:after-rename')replacements++;},false,4096);
    expect(replacements).toBe(1);
    expect(resumed.size).toBeLessThan(oldBytes);
    expect(resumed.view.order[0]?.held).toBe('waiting');
    resumed.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('reopens a verified snapshot with pending effects and appends after replacement', async () => {
  const root = origin();
  try {
    const path = seed(root), before = read(root);
    const expected = { calls: before.view.calls, replies: before.view.replies, cursor: before.view.cursor };
    const oldSize = statSync(path).size;
    before.compact();
    expect(before.view).toMatchObject(expected);
    expect(before.size).not.toBe(oldSize);
    before.append({kind:'hold',id:id(3),reason:'still held',at:1020});
    before.close();
    const replay = read(root);
    expect(replay.view.order).toHaveLength(4);
    expect(replay.view.cursor).toBe(5);
    expect(replay.view.calls).toBe(4);
    expect(replay.view.replies).toBe(2);
    expect(replay.view.channelItems.size).toBe(1);
    expect(replay.view.memory).toHaveLength(1);
    expect(replay.view.summaryReservations.has(3)).toBe(true);
    expect(replay.view.order[1]?.intent).toBe('PREVIEW — answer 2');
    expect(replay.view.order[1]?.sent).toBeUndefined();
    expect(replay.view.order[2]?.held).toBe('still held');
    expect(replay.view.order[3]?.modelState).toBe('uncertain');
    let calls = 0;
    const sentUpdates: number[] = [];
    const worker = createJournalWorker(replay, {now:()=>2000,stopped:()=>false,
      model:async()=>{calls++;return 'new';},send:async input=>{sentUpdates.push(input.update);return 42;},checkOutbound:()=>{}});
    worker.intake([JSON.parse(raw(2))]);
    await worker.drain();
    // The UNKNOWN model call is not repeated; its fixed lost-answer notice may send once.
    expect(calls).toBe(0); expect(sentUpdates).toEqual([4]);
    expect(replay.view.order).toHaveLength(4);
    expect(replay.view.order[1]?.sent).toBeUndefined();
    expect(replay.view.order[3]?.answer).toBeUndefined();
    replay.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('keeps UNKNOWN model usage and reply review preparation after its notice was sent', () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted'), journal = openPreviewJournal(path, key, genesis);
    journal.append({kind:'intake',id:id(1),update:1,text:'question 1',raw:raw(1),accepted:true,cursor:2,at:1000});
    journal.append({kind:'reserve',id:id(1),prompt:'original prepared prompt',at:1001});
    journal.append({kind:'model-uncertain',id:id(1),state:'uncertain',
      usage:{inputTokens:12345,outputTokens:67,charge:null},at:1002});
    journal.append({kind:'notice',id:id(1),noticeClass:'unknown-answer',at:1003});
    journal.append({kind:'reply-review-reserve',id:id(1),candidate:UNKNOWN_ANSWER_NOTICE,
      prompt:'unique review prompt',at:1004});
    journal.append({kind:'reply-review-state',id:id(1),state:'complete',at:1005});
    journal.append({kind:'reply-check',id:id(1),result:{verdict:'pass',ruleIds:[],confidence:1,
      path:'subscription',latencyMs:1},at:1006});
    journal.append({kind:'intent',id:id(1),text:UNKNOWN_ANSWER_NOTICE,chat:genesis.chat,
      update:1,grant:genesis.grant,at:1007});
    journal.append({kind:'sent',id:id(1),message:42,at:1008});
    const original = decodedRows(path).slice(1);
    journal.compact();
    expect(retainedRows(path)).toEqual(withoutSnapshotPromptCopies(original));
    journal.compact(); journal.close();
    expect(retainedRows(path)).toEqual(withoutSnapshotPromptCopies(original));
    const replay = read(root);
    expect(replay.view.order[0]).toMatchObject({modelState:'uncertain',sent:42,reviewState:'complete'});
    replay.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('keeps completed call metering, failure details and completed summary preparation', () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted'), journal = openPreviewJournal(path, key, genesis);
    journal.append({kind:'intake',id:id(1),update:1,text:'question 1',raw:raw(1),accepted:true,cursor:2,at:1000});
    journal.append({kind:'reserve',id:id(1),prompt:'call one prompt',at:1001});
    journal.append({kind:'answer',id:id(1),text:'answer 1',state:'complete',
      usage:{inputTokens:111,outputTokens:12,charge:null},at:1002});
    journal.append({kind:'intent',id:id(1),text:'answer 1',chat:genesis.chat,update:1,grant:genesis.grant,at:1003});
    journal.append({kind:'sent',id:id(1),message:41,at:1004});
    journal.append({kind:'intake',id:id(2),update:2,text:'question 2',raw:raw(2),accepted:true,cursor:3,at:1005});
    journal.append({kind:'reserve',id:id(2),prompt:'call two prompt',at:1006});
    journal.append({kind:'answer',id:id(2),text:MODEL_FAILURE_REPLY,state:'rejected',failureClass:'rejected',
      usage:{inputTokens:222,outputTokens:0,charge:null},at:1007});
    journal.append({kind:'summary-reserve',through:2,prompt:'summary attempt one',at:1008});
    journal.append({kind:'summary-failed',through:2,state:'rejected',failureClass:'rejected',
      usage:{inputTokens:333,outputTokens:0,charge:null},at:1009});
    journal.append({kind:'summary-reserve',through:2,prompt:'summary attempt two',at:1010});
    journal.append({kind:'summary',through:2,text:'faithful summary',state:'complete',
      usage:{inputTokens:444,outputTokens:14,charge:null},at:1011});
    const original = decodedRows(path).slice(1);
    journal.compact(); journal.close();
    expect(retainedRows(path)).toEqual(withoutSnapshotPromptCopies(original));
    const replay = read(root);
    expect(replay.view).toMatchObject({calls:4,summaries:[{text:'faithful summary'}]});
    replay.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('reassembles a snapshot that spans several authenticated frames', () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted'), journal = openPreviewJournal(path, key, genesis);
    const text = 'A'.repeat(400_000);
    journal.append({kind:'intake',id:id(1),update:1,text,raw:JSON.stringify({update_id:1,text}),
      accepted:true,cursor:2,at:1000});
    journal.append({kind:'hold',id:id(1),reason:'waiting',at:1001});
    journal.compact(); journal.close();
    expect(readFileSync(path,'utf8')).not.toContain(text.slice(0,200));
    const replay = read(root);
    expect(replay.view.order[0]?.text).toBe(text);
    expect(replay.view.order[0]?.held).toBe('waiting');
    replay.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('retains imported cursor, raised spend bounds and the stop latch across replacement', () => {
  const root = origin();
  try {
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, {...genesis,importSource:'old-root',importCursor:9});
    journal.append({kind:'import',source:'old-root',remainingCalls:30,remainingReplies:30,oldStop:'old poller stopped',at:1000});
    raiseJournalCaps(journal,{maxCalls:31,maxReplies:31,maxTurns:31,authority:'operator cap record',at:1001});
    journal.append({kind:'stop',reason:'operator',at:1002});
    journal.compact(); journal.close();
    const replay = read(root);
    expect(replay.view).toMatchObject({cursor:9,imported:true,sourceStop:'old poller stopped',
      capAuthority:'operator cap record',capRaisedAt:1001,stop:'operator',calls:0,replies:0});
    expect(replay.view.limits).toEqual({maxCalls:31,maxReplies:31,maxTurns:31,maxBytes:262144});
    const worker = createJournalWorker(replay,{now:()=>2000,stopped:()=>false,model:async()=>{
      throw Error('model must not run');},send:async()=>{throw Error('send must not run');},checkOutbound:()=>{}});
    expect(()=>worker.intake([JSON.parse(raw(10))])).toThrow('stopped');
    replay.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('SIGKILL at every compaction boundary leaves the old or new journal readable', () => {
  const stages = ['compact:before-temp','compact:after-temp','compact:after-genesis','compact:after-snapshot-start',
    'compact:after-chunk','compact:after-write','compact:after-fsync','compact:after-verify','compact:before-rename',
    'compact:after-rename','compact:after-dir-fsync','compact:after-reopen'];
  for (const stage of stages) {
    const root = origin();
    try {
      const path = seed(root), original = readFileSync(path);
      const child = spawnSync(process.execPath,
        ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-compaction-crash-child.mjs',root,stage],
        {cwd:process.cwd(),encoding:'utf8',timeout:10000});
      expect(child.signal, `${stage}: ${child.stderr}`).toBe('SIGKILL');
      const current = readFileSync(path);
      expect(current.equals(original), stage).toBe(stages.indexOf(stage) < stages.indexOf('compact:after-rename'));
      const journal = read(root);
      expect(journal.view.cursor, stage).toBe(5);
      expect(journal.view.calls, stage).toBe(4);
      expect(journal.view.replies, stage).toBe(2);
      expect(journal.view.order[1]?.intent, stage).toBe('PREVIEW — answer 2');
      expect(journal.view.order[1]?.sent, stage).toBeUndefined();
      expect(journal.view.order[2]?.held, stage).toBe('reply check unavailable');
      expect(journal.view.order[3]?.modelState, stage).toBe('uncertain');
      expect(journal.view.summaryReservations.has(3), stage).toBe(true);
      journal.append({kind:'hold',id:id(3),reason:'resumed safely',at:2000});
      journal.close();
      const again = read(root);
      expect(again.view.order[2]?.held, stage).toBe('resumed safely');
      again.close();
    } finally { rmSync(root, {recursive:true,force:true}); }
  }
}, 120000);

it('rejects a damaged temp before replacing the old journal', () => {
  const root = origin();
  try {
    const path = seed(root), original = readFileSync(path);
    const journal = openPreviewJournal(path, key, undefined, stage => {
      if (stage === 'compact:after-fsync') {
        const temp = `${path}.compacting`, bytes = readFileSync(temp);
        bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1; writeFileSync(temp, bytes);
      }
    });
    expect(() => journal.compact()).toThrow();
    journal.close();
    expect(readFileSync(path).equals(original)).toBe(true);
    const replay = read(root); expect(replay.view.order).toHaveLength(4); replay.close();
  } finally { rmSync(root, {recursive:true,force:true}); }
});

it('runs the Justin probe on an isolated copy and refuses an unmarked root', () => {
  const root = origin();
  try {
    seed(root);
    const args = ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs',
      'tests/preview/journal-compaction-probe.mjs',root];
    const env = {...process.env,INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(key).toString('hex')};
    const refused = spawnSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',env,timeout:10000});
    expect(refused.status).not.toBe(0);
    writeFileSync(join(root,'.journal-compaction-clone'),'');
    const accepted = spawnSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',env,timeout:10000});
    expect(accepted.status, accepted.stderr).toBe(0);
    expect(JSON.parse(accepted.stdout)).toMatchObject({result:'verified',cursor:5,turns:4,calls:4,replies:2,
      unknownCalls:1,unknownSends:1,holds:1,reservations:1,stopped:false});
  } finally { rmSync(root, {recursive:true,force:true}); }
}, 30000);
