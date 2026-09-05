import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { factsFixture } from '../facts/fixtures.js';

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
