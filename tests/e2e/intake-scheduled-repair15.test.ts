import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { refused, value } from '../intake/fixtures.js';
import { addSecondGrant } from '../intake/scheduled-repair14-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

const ref=(id:string)=>({ owner:'part-two' as const,name:'FactEnvelope' as const,id });

it('P4-ST-89 V163 F2 durable restart reports an unavailable admission as partial',()=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair15-partial-'));
  const source=scheduledFixture({ directory }); source.grant();
  const tick=source.tick(),discovery=source.discovery(tick.eventId);
  const admitted:any=value(source.port().receiveScheduledTick({
    raw:tick.raw,route:tick.route,discovery:ref(discovery.fact.id),
  }));
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  restarted.dropCapture(discovery.evidence.capture.reference);
  const result=value(restarted.port().pendingScheduledAdmissions({
    owner:admitted.owner,frontier:restarted.frontier(),limit:10,after:null,
  }));
  expect(result).toMatchObject({ admissions:[],partial:[admitted.fact] });
});

it('P4-ST-90 V162 F3 durable ingress never records a multi-grant admission',()=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair15-grants-'));
  const f=scheduledFixture({ directory }),grant=f.grant(),tick=f.tick(),discovery=f.discovery(tick.eventId);
  addSecondGrant({ f,grant,tick,discovery,input:{ raw:tick.raw,route:tick.route,discovery:ref(discovery.fact.id) } });
  refused(f.port().receiveScheduledTick({ raw:tick.raw,route:tick.route,discovery:ref(discovery.fact.id) }),
    'unsupported-in-slice-a');
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
});
