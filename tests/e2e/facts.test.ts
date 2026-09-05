import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { factsFixture } from '../facts/fixtures.js';
import { decodeEnvelope } from '../../src/facts/index.js';
import { value } from '../fixtures.js';

it('public fact and projection packages initialize and fold a signed fact in a fresh process', () => {
  const f = factsFixture();
  const authentication = f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity');
  const input = { context: f.ctx, provenanceInput: authentication.input, fact: f.wire() };
  const code = `
    import { readFileSync } from 'node:fs';
    import { decode, consumeResult } from '@instar/constitutional-types';
    import { createFactStore } from '@instar/constitutional-types/facts';
    import { foldProjection, checkpoint, verifyRebuild } from '@instar/constitutional-types/projections';
    const seed = JSON.parse(readFileSync(0, 'utf8'));
    const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
    const provenance = take(decode('Provenance', seed.provenanceInput, seed.context.decode));
    const principal = take(decode('VerifiedPrincipal', {type:'VerifiedPrincipal',schemaVersion:1,id:'alice',kind:'person'}, {...seed.context.decode,provenance}));
    const context = {...seed.context,decode:{...seed.context.decode,principals:[principal]}};
    const storage = {owner:'part-ten',read:()=>[seed.fact],append:()=>{throw new Error('read-only fixture');}};
    const facts = take(createFactStore(context,storage).read());
    const definition = {id:'totals',class:'informational',stalenessBound:100,retention:'all-identities',decisions:{note:{kind:'folds',identity:'identity',value:'amount',merge:'additive'}}};
    const generation = {reference:context.decode.register.generation,kinds:['note'],lineages:{'machine-a':{head:{epoch:0,position:0},observedAt:100,closed:false}}};
    const boundary = {site:context.site,preserved:context.preserved,register:context.decode.register};
    const view = take(foldProjection(definition,facts.map(fact=>({fact,taint:[]})),generation,boundary));
    const rebuild = take(foldProjection(definition,facts.map(fact=>({fact,taint:[]})),generation,boundary));
    console.log(JSON.stringify({facts:facts.length,total:view.values['note:one'],rebuild:take(verifyRebuild(checkpoint(view),checkpoint(rebuild),boundary))}));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], { input: JSON.stringify(input), encoding: 'utf8' });
  expect(JSON.parse(output)).toEqual({ facts: 1, total: '10', rebuild: 'equal' });
});

it('P2-NF-28 fresh-process history composes signed grants, authorizations and unavailable Evidence without live principals', () => {
  const f = factsFixture();
  const schemas = [
    { ...f.schema, kind: 'grant-record', fields: { grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const } } },
    { ...f.schema, kind: 'approval-record', fields: { approval: { kind: 'constitutional' as const, type: 'Authorization' as const } } },
    { ...f.schema, kind: 'evidence-record', fields: { evidence: { kind: 'constitutional' as const, type: 'Evidence' as const } } },
  ];
  const ctx = { ...f.ctx, schemas };
  const grantContext = { ...ctx, decode: { ...ctx.decode, provenance: f.g.source } };
  const grant = value(decodeEnvelope(f.wire({ kind: 'grant-record', provenance: f.g.source, body: { grant: f.g } }, ctx), grantContext));
  const approval = f.next(grant, { kind: 'approval-record', provenance: f.authorization.explicitYes, body: { approval: f.authorization } }, { ...ctx, decode: { ...ctx.decode, provenance: f.authorization.explicitYes } });
  const evidence = f.next(approval, { kind: 'evidence-record', body: { evidence: f.e } }, ctx);
  const captures = { ...ctx.decode.captures }; delete captures['capture:evidence'];
  const input = { context: { ...ctx, decode: { ...ctx.decode, captures, principals: [], grants: [], authorizations: [] } }, facts: [grant, approval, evidence] };
  const code = `
    import { readFileSync } from 'node:fs';
    import { decode, decodeMeasurement, consumeResult, readHistoricalEvidence } from '@instar/constitutional-types';
    import { createFactStore, decodeHistoricalBody } from '@instar/constitutional-types/facts';
    const seed = JSON.parse(readFileSync(0, 'utf8'));
    const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
    const now = take(decodeMeasurement('clock', seed.context.genesis.clock, seed.context.decode));
    const c = {...seed.context, genesis:{...seed.context.genesis,clock:now},decode:{...seed.context.decode,now}};
    c.schemas = c.schemas.map(s=>({...s,scope:take(decode('Scope',s.scope,c.decode))}));
    const storage = {owner:'part-ten',read:()=>seed.facts,append:()=>{throw new Error('read-only');}};
    const facts = take(createFactStore(c,storage).read()); c.facts = facts;
    const auth = take(decodeHistoricalBody(facts[1],c,c.decode));
    const evidence = take(decodeHistoricalBody(facts[2],c,c.decode));
    const unavailable = consumeResult(readHistoricalEvidence(evidence.fields.evidence,now,c.preserved),{Success:()=>false,Refused:r=>r.detail.includes('evidence-unavailable')});
    console.log(JSON.stringify({under:auth.fields.approval.view.under,mode:auth.fields.approval.mode,taint:evidence.taint,unavailable,principals:c.decode.principals.length}));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], { input: JSON.stringify(input), encoding: 'utf8' });
  expect(JSON.parse(output)).toEqual({ under: 'g1', mode: 'historical', taint: ['evidence-unavailable'], unavailable: true, principals: 0 });
});
