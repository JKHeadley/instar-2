import { expect,it } from 'vitest';
import { refused } from './fixtures.js';
import { scheduledFactRef,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';
import { mismatchedSourceDiscoveryBundle } from './scheduled-repair16-fixtures.js';

it('P4-ST-91 V170 counts a matching discovery before checking its reported source',()=>{
  const x=scheduledRepair6Setup(),bundle=mismatchedSourceDiscoveryBundle(x.f,x.discovery);
  const before=x.f.frames.length;
  refused(x.f.port().receiveScheduledTick({
    ...x.input,discovery:scheduledFactRef(bundle.fact.id),
  }),'exactly one discovery Evidence witness');
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
});
