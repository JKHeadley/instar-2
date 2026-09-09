import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { intakeWorkRegistration } from '../../src/intake/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { missingScheduledPrincipalHistory } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

it.each([false,true])('P4-ST-34 V76 durable missing-principal admission refuses before fsync (lost ack=%s)',lostAck => {
  const x=missingScheduledPrincipalHistory(true),directory=mkdtempSync(join(tmpdir(),'instar-p4-repair6-'));
  const before=scheduledFixture({ directory }); before.installSchemas();
  Object.assign(before.f.captures,x.f.f.captures); before.syncCaptures();
  const registration=value(intakeWorkRegistration({ site: before.context.site,preserved: before.context.preserved,
    register: before.context.decode.register },before.principal.id));
  const context={ ...before.context,ownedBodies: [...before.context.ownedBodies??[],registration],
    decode: { ...before.context.decode,provenance: before.provenance } };
  const store=createFactStore(context,before.storage);
  for(const fact of x.f.frames as FactEnvelope[]) value(store.append(json(fact),{ peer: fact.machine }));
  const append=before.storage.append.bind(before.storage); let cut=false;
  before.storage.append=(bytes,expected) => {
    const receipt=append(bytes,expected);
    if(lostAck&&JSON.parse(bytes).kind==='intake-admitted') { cut=true; throw new Error('cut after fsync'); }
    return receipt;
  };
  const result=authorAndAppend({ kind: 'intake-admitted',schemaVersion: 1,machine: 'machine-a',
    principal: json(before.principal),provenance: json(before.provenance),at: json(before.f.now),body: x.body,
    required: x.required },context,store,before.deps.author.privateKey);
  refused(result);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  expect(restarted.facts().some(fact => fact.kind==='intake-admitted')).toBe(false);
  expect(cut).toBe(false);
});
