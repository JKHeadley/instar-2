import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { refused } from '../intake/fixtures.js';
import { mismatchedSourceDiscoveryBundle } from '../intake/scheduled-repair16-fixtures.js';
import { scheduledFactRef } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

it('P4-ST-93 V176/V181 mismatched-source duplicate discovery never reaches durable admission',()=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair16-source-'));
  const f=scheduledFixture({ directory });f.grant();
  const tick=f.tick(),discovery=f.discovery(tick.eventId),bundle=mismatchedSourceDiscoveryBundle(f,discovery);
  refused(f.port().receiveScheduledTick({
    raw:tick.raw,route:tick.route,discovery:scheduledFactRef(bundle.fact.id),
  }),'exactly one discovery Evidence witness');
  const restarted=scheduledFixture({ directory });restarted.installSchemas();
  Object.assign(restarted.context,{ schemas:[...restarted.context.schemas,bundle.schema] });
  expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
});
