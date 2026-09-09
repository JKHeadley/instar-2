import { expect,it } from 'vitest';
import { verifyAndAdmit } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { json,refused } from '../intake/fixtures.js';
import { changedScheduledRoute,missingScheduledPrincipalHistory,scheduledFactRef } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';

it.each([false,true])('P4-ST-32 V73 signed replication refuses absent principal history (changed tick=%s)',changed => {
  const x=missingScheduledPrincipalHistory(changed),frames=x.f.frames as FactEnvelope[],previous=frames.at(-1)!;
  const signed=x.f.f.next(previous,{ kind: 'intake-admitted',principal: x.f.principal,provenance: x.f.provenance,
    at: x.f.f.now,body: x.body,predecessors: { inSegment: previous.id,frontier: {},required: x.required } },x.context);
  refused(verifyAndAdmit(json(signed),'machine-a',{ ...x.context,facts: frames }));
});

it.each([
  ['channel','chat:ordinary'],['channel','scheduled:'],['identityEpoch','epoch:unsigned'],
  ['sender','other:system'],['adapter','host'],
] as const)('P4-ST-33 V74 replication and Part Five consumption refuse inconsistent signed route %s=%s',(field,replacement) => {
  const x=changedScheduledRoute(field,replacement,'signed');
  if(!x.signed) throw new Error('expected signed scheduled admission');
  const frames=x.f.frames as FactEnvelope[];
  refused(verifyAndAdmit(json(x.signed),'machine-a',{ ...x.context,facts: frames }));
  frames.push(x.signed);
  expect(() => scheduledRunHarness(x.f,{ ...x.admitted,fact: scheduledFactRef(x.signed!.id) }))
    .toThrow(/scheduled intake|standing|decode|integrity/);
  expect(x.f.facts().filter(fact => fact.kind==='run-opening')).toEqual([]);
});
