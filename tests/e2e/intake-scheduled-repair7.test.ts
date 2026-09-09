import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { json,message,refused,route,value } from '../intake/fixtures.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { conversationPort,messageOnlyScheduledAttempt,unwitnessedScheduledAdmission } from '../intake/scheduled-repair7-fixtures.js';

it.each([false,true])('P4-ST-36 V86 durable unwitnessed malformed tick refuses before append (lost acknowledgement=%s)',cut => {
  const x=unwitnessedScheduledAdmission('version'),directory=mkdtempSync(join(tmpdir(),'instar-p4-repair7-v86-'));
  const f=scheduledFixture({ directory }); f.installSchemas(); Object.assign(f.f.captures,x.f.f.captures); f.syncCaptures();
  const context=scheduledOwnerContext(f),store=createFactStore(context,f.storage);
  for(const fact of x.f.frames as FactEnvelope[]) value(store.append(json(fact),{ peer: fact.machine }));
  const append=f.storage.append.bind(f.storage); let hit=false;
  f.storage.append=(bytes,expected) => {
    const receipt=append(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted') { hit=true; throw new Error('lost ack after fsync'); }
    return receipt;
  };
  const result=authorAndAppend(x.candidate,context,store,f.deps.author.privateKey);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  expect(restarted.facts().filter(fact => fact.kind==='intake-admitted')).toEqual([]);
  expect(hit).toBe(false); refused(result);
});

it.each(['intake-scheduled-principal','intake-admitted'])
('P4-PRESERVE-02 V87 ordinary input remains admissible after durable scheduled %s cut',kind => {
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair7-v87-')),f=scheduledFixture({ directory }); f.grant();
  const tick=f.tick(),discovery=f.discovery(tick.eventId),append=f.storage.append.bind(f.storage); let hit=false;
  f.storage.append=(bytes,expected) => {
    const receipt=append(bytes,expected);
    if(JSON.parse(bytes).kind===kind) { hit=true; throw new Error('lost scheduled acknowledgement'); }
    return receipt;
  };
  refused(f.port().receiveScheduledTick({ raw: tick.raw,route: tick.route,
    discovery: { owner: 'part-two',name: 'FactEnvelope',id: discovery.fact.id } }));
  expect(hit).toBe(true);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  expect(value(conversationPort(restarted).receive(message('ordinary after restart'),route)).kind).toBe('admitted');
});

it.each([false,true])('P4-ST-37 V92 durable message-only adapter cannot append a tick (lost acknowledgement=%s)',cut => {
  const x=messageOnlyScheduledAttempt(),directory=mkdtempSync(join(tmpdir(),'instar-p4-repair7-v92-'));
  const f=scheduledFixture({ directory }); f.installSchemas(); Object.assign(f.f.captures,x.f.f.captures); f.syncCaptures();
  const context={ ...x.context,captures: f.context.captures },store=createFactStore(context,f.storage);
  for(const fact of x.f.frames as FactEnvelope[]) value(store.append(json(fact),{ peer: fact.machine }));
  const append=f.storage.append.bind(f.storage); let hit=false;
  f.storage.append=(bytes,expected) => {
    const receipt=append(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted') { hit=true; throw new Error('lost ack after fsync'); }
    return receipt;
  };
  const result=authorAndAppend({ kind: 'intake-admitted',schemaVersion: 1,machine: 'machine-a',principal: json(x.principal),
    provenance: json(x.provenance),at: json(f.f.now),body: x.body,required: x.required },context,store,
  f.deps.author.privateKey);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  expect(restarted.facts().filter(fact => fact.kind==='intake-admitted')).toEqual([]);
  expect(hit).toBe(false); refused(result);
});
