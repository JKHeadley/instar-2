import { expect, it } from 'vitest';
import { appendFileSync, closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRunGraph } from '../../src/rungraph/index.js';
import { setup, value, json } from '../rungraph/fixtures.js';

// The disk adapter is real. Six's durable admission witness is a test ledger;
// this proves the public five/two restart boundary, not six's real realization.
it('P5-NF-04 P5-NF-11 P5-NF-44 fresh public-package worker survives effect-before-response kill without resubmission', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-crash-')), spine = join(directory, 'facts.jsonl'), effects = join(directory, 'effects.jsonl');
  writeFileSync(spine, ''); writeFileSync(effects, '');
  try {
    const f = setup(fallback => ({ owner: 'part-ten', read: () => readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)),
      append: (bytes, expected) => {
        const rows = readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
        if ((rows.at(-1)?.contentHash ?? null) !== expected) throw new Error('disk CAS');
        const fd = openSync(spine, 'a'); try { writeFileSync(fd, bytes + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
        return fallback.append(bytes, expected);
      } }));
    // Intake is already durable; discard the first graph before creating a root.
    const fresh = value(createRunGraph(f.deps)), ready = value(fresh.open(f.run));
    expect(value(f.graph.open(f.run)).head).toBe(ready.head);
    const ground = value(fresh.ground(f.id, 'first-worker', 'node', 'start', f.lease));
    value(fresh.transition(f.start(ready, ground)));
    const code = `
      import {readFileSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
      import {consumeResult,decode,decodeMeasurement} from '@instar/constitutional-types';
      import {createFactStore} from '@instar/constitutional-types/facts';
      import {runFactSchemas,createRunGraph} from '@instar/constitutional-types/rungraph';
      const seed=JSON.parse(readFileSync(0,'utf8'));
      const take=r=>consumeResult(r,{Success:v=>v,Refused:r=>{throw new Error(r.detail)}});
      const types=seed.context.decode, now=take(decodeMeasurement('clock',seed.context.genesis.clock,types));
      const base={...seed.context,genesis:{...seed.context.genesis,clock:now},schemas:seed.context.schemas.map(s=>({...s,scope:take(decode('Scope',s.scope,types))}))};
      let c={site:base.site,preserved:base.preserved,register:types.register,types,facts:base,stimulusKinds:['stimulus'],evidenceSources:{settlement:'probe',exit:'probe'}};
      const owned=take(runFactSchemas(c)); const context={...base,ownedBodies:owned.registrations}; c={...c,facts:context};
      const store=createFactStore(context,{owner:'part-ten',read:()=>readFileSync(seed.spine,'utf8').split('\\n').filter(Boolean).map(JSON.parse),append:()=>{throw new Error('restart fixture is observer-only')}});
      const ok=v=>take(decode('Result',{type:'Result',schemaVersion:1,kind:'Success',value:v,capacity:{kind:'none'}},types));
      const unavailable=()=>{throw new Error('unneeded owner port invoked')};
      const graph=take(createRunGraph({context:c,store,generation:()=>seed.generation,clock:()=>now,groundingPolicy:seed.policy,
        writer:{owner:'part-ten',append:unavailable},admission:{owner:'part-six',create:unavailable,commit:(_r,write)=>write(),verify:ref=>{if(!seed.admissions.includes(ref.id))throw new Error('missing witness');return ok(ref)}},
        grounding:{owner:'part-ten',read:unavailable},settlement:{owner:'part-eight',read:unavailable},control:{owner:'part-four',verify:unavailable},exitCheck:{owner:'part-nine',verify:unavailable}}));
      const view=take(graph.read(seed.id));
      if(seed.mode==='effect-cut') {
        if(view.state!=='running'||view.pending.length!==1)throw new Error('no durable step');
        const fd=openSync(seed.effects,'a');writeFileSync(fd,view.pending[0].operation.key+'\\n');fsyncSync(fd);closeSync(fd);
        process.kill(process.pid,'SIGKILL');
      } else {
        const attempts=seed.attempts.map(t=>consumeResult(graph.transition(t),{Success:()=>false,Refused:()=>true}));
        console.log(JSON.stringify({state:view.state,pending:view.pending.map(s=>s.operation.key),refused:attempts,wake:view.nextWake}));
      }
    `;
    const current = value(f.graph.read(f.id));
    const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, effects, id: f.id, generation: f.generation(), policy: f.deps.groundingPolicy,
      admissions: [...f.admissions], attempts: ['operation:1', 'new-after-crash'].map(key => ({ ...f.start({ ...current, state: 'ready' }, ground, key), id: `retry:${key}` })) };
    const killed = spawnSync(process.execPath, ['--input-type=module', '-e', code], { input: JSON.stringify({ ...seed, mode: 'effect-cut' }), encoding: 'utf8' });
    expect(killed.stderr).toBe(''); expect(killed.signal).toBe('SIGKILL');
    const recovered = spawnSync(process.execPath, ['--input-type=module', '-e', code], { input: JSON.stringify({ ...seed, mode: 'recover' }), encoding: 'utf8' });
    expect(recovered.stderr).toBe(''); expect(recovered.status).toBe(0);
    expect(JSON.parse(recovered.stdout)).toEqual({ state: 'running', pending: ['operation:1'], refused: [true, true], wake: current.nextWake });
    expect(readFileSync(effects, 'utf8')).toBe('operation:1\n');
    f.setClock(125);
    const regrounded = value(value(createRunGraph(f.deps)).ground(f.id, 'replacement-worker', 'node', 'recovery', f.lease));
    expect(JSON.stringify(regrounded.body)).toContain('replacement-worker');
    expect(JSON.stringify(regrounded.body)).toContain('operation:1');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
