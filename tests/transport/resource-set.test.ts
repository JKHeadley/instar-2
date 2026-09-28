import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { resourceDebited, resourceSetFactKind } from '../../src/transport/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import type { ResourceDomainPolicy } from '../../src/transport/index.js';
import { json, privateKey, value } from '../facts/fixtures.js';
import { resourceSetFixture, reservationRef, setRef } from './resource-set-fixture.js';

const refusal = <T>(r: Result<T>) => consumeResult(r, { Success: () => '', Refused: x => x.detail });
const domain = (d: string, dimension: ResourceDomainPolicy['dimension'], resource: string, capacity: number): ResourceDomainPolicy =>
  ({ domain: d, dimension, resource, capacity, policy: `policy:${d}` });
const accountsAndFamilies = [
  domain('account:A', 'account', 'launches', 1), domain('account:B', 'account', 'launches', 1),
  domain('family:x', 'job-family', 'launches', 1), domain('family:y', 'job-family', 'launches', 1)];

describe('P6-NF-19 Six composed resource admission (row 36)', () => {
  it('two families on one provider account compete for one account slot: exactly one commits', () => {
    const t = resourceSetFixture(undefined, 'authority:1', accountsAndFamilies);
    const fence = t.acquire();
    const first = value(t.sets.reserveResourceSet({ command: 'job-x', fence, request: t.request('rx'), run: t.run('rx'),
      parentAllocation: '', demands: [t.demand('account', 'account:A', 'launches', 1), t.demand('job-family', 'family:x', 'launches', 1)] }));
    expect(first.state).toBe('committed');
    expect(first.committed).toEqual(['account:A', 'family:x']);
    const second = t.sets.reserveResourceSet({ command: 'job-y', fence, request: t.request('ry'), run: t.run('ry'),
      parentAllocation: '', demands: [t.demand('account', 'account:A', 'launches', 1), t.demand('job-family', 'family:y', 'launches', 1)] });
    expect(refusal(second)).toMatch(/capacity exhausted/);
    // The refused set left no debit anywhere (its first domain was the exhausted one).
    expect(resourceDebited(t.rowsNow(), 'family:y', 'launches')).toBe(0);
    expect(t.rowsNow().filter(r => r.record.request === 'ry')).toHaveLength(0);
  });

  it('the same jobs on different accounts both commit', () => {
    const t = resourceSetFixture(undefined, 'authority:1', accountsAndFamilies);
    const fence = t.acquire();
    for (const [job, account, family] of [['x', 'account:A', 'family:x'], ['y', 'account:B', 'family:y']] as const)
      expect(value(t.sets.reserveResourceSet({ command: `job-${job}`, fence, request: t.request(`r${job}`), run: t.run(`r${job}`),
        parentAllocation: '', demands: [t.demand('account', account, 'launches', 1), t.demand('job-family', family, 'launches', 1)] })).state).toBe('committed');
  });

  it('a zero cap refuses in every dimension without becoming a positive default; a missing policy holds admission', () => {
    for (const dimension of ['global', 'installation', 'framework', 'account', 'job-family', 'job'] as const) {
      const t = resourceSetFixture(undefined, 'authority:1', [domain(`d:${dimension}`, dimension, 'launches', 0)]);
      const fence = t.acquire();
      expect(refusal(t.sets.reserveResourceSet({ command: 'zero', fence, request: t.request('r'), run: t.run('r'),
        parentAllocation: '', demands: [t.demand(dimension, `d:${dimension}`, 'launches', 1)] }))).toMatch(/capacity exhausted/);
      expect(t.rowsNow()).toHaveLength(0);
    }
    const t = resourceSetFixture(undefined, 'authority:1', []);
    const fence = t.acquire();
    expect(refusal(t.sets.reserveResourceSet({ command: 'unregistered', fence, request: t.request('r'), run: t.run('r'),
      parentAllocation: '', demands: [t.demand('installation', 'install:1', 'memory-bytes', 1)] }))).toMatch(/missing approved quantity/);
    // A zero-amount demand is not a free admission either.
    const u = resourceSetFixture(undefined, 'authority:1', [domain('install:1', 'installation', 'launches', 3)]);
    expect(refusal(u.sets.reserveResourceSet({ command: 'nothing', fence: u.acquire(), request: u.request('r'), run: u.run('r'),
      parentAllocation: '', demands: [u.demand('installation', 'install:1', 'launches', 0)] }))).toMatch(/positive finite integer/);
  });

  it('an independent ceiling per dimension: one unit is checked against each, never credited across peers', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('global:1', 'global', 'launches', 2),
      domain('install:1', 'installation', 'launches', 1)]);
    const fence = t.acquire();
    value(t.sets.reserveResourceSet({ command: 'a', fence, request: t.request('ra'), run: t.run('ra'), parentAllocation: '',
      demands: [t.demand('global', 'global:1', 'launches', 1), t.demand('installation', 'install:1', 'launches', 1)] }));
    // The global domain still has a free unit; the installation domain does not.
    const refused = t.sets.reserveResourceSet({ command: 'b', fence, request: t.request('rb'), run: t.run('rb'), parentAllocation: '',
      demands: [t.demand('global', 'global:1', 'launches', 1), t.demand('installation', 'install:1', 'launches', 1)] });
    expect(refusal(refused)).toMatch(/capacity exhausted/);
    // The refused set is preparing and holds only its prepared global debit, never spendable.
    const partial = t.rowsNow().filter(r => r.record.request === 'rb').at(-1)!.record;
    expect(partial.state).toBe('preparing');
    expect(partial.prepared).toEqual(['global:1']);
    const op = t.reservation(fence, 'rb');
    expect(refusal(t.sets.attachResourceSet(reservationRef(op.operation), setRef(partial.id)))).toMatch(/only a committed/);
    // Bounded recovery returns the proved-unused prepared debit exactly once.
    const closed = value(t.sets.closeResourceSet({ command: 'close-b', allocationSet: setRef(partial.id), settlement: 'never-launched:rb' }));
    expect(closed.state).toBe('closed');
    expect(closed.released).toEqual(['global:1']);
    expect(resourceDebited(t.rowsNow(), 'global:1', 'launches')).toBe(1);
    value(t.sets.closeResourceSet({ command: 'close-b', allocationSet: setRef(partial.id), settlement: 'never-launched:rb' }));
    expect(resourceDebited(t.rowsNow(), 'global:1', 'launches')).toBe(1);
  });

  it('demands are canonical: one per dimension and resource, ordered by domain; a stale domain predecessor refuses', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('a', 'installation', 'launches', 5), domain('b', 'job', 'launches', 5)]);
    const fence = t.acquire();
    const base = { fence, request: t.request('r'), run: t.run('r'), parentAllocation: '' };
    expect(refusal(t.sets.reserveResourceSet({ ...base, command: 'unordered',
      demands: [t.demand('job', 'b', 'launches', 1), t.demand('installation', 'a', 'launches', 1)] }))).toMatch(/canonically ordered/);
    expect(refusal(t.sets.reserveResourceSet({ ...base, command: 'twice',
      demands: [t.demand('installation', 'a', 'launches', 1), t.demand('installation', 'b', 'launches', 1)] }))).toMatch(/exactly one demand/);
    const stale = t.demand('installation', 'a', 'launches', 1);
    value(t.sets.reserveResourceSet({ ...base, command: 'first', demands: [t.demand('installation', 'a', 'launches', 1)] }));
    expect(refusal(t.sets.reserveResourceSet({ ...base, command: 'second', request: t.request('r2'), run: t.run('r2'),
      demands: [stale] }))).toMatch(/domain predecessor changed/);
  });

  it('crash cuts: after each prepare, commit, attach and return, recovery completes the same set without a duplicate debit', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('a', 'installation', 'launches', 1), domain('b', 'job', 'launches', 1),
      domain('c', 'account', 'launches', 1)]);
    const fence = t.acquire();
    const demands = () => [t.demand('installation', 'a', 'launches', 1), t.demand('job', 'b', 'launches', 1), t.demand('account', 'c', 'launches', 1)];
    const input = { command: 'launch-1', fence, request: t.request('r1'), run: t.run('r1'), parentAllocation: '' };
    const first = demands();
    for (const prepared of [1, 2, 3]) {
      t.crash.after = 1;
      expect(refusal(t.sets.reserveResourceSet({ ...input, demands: first }))).toMatch(/simulated crash/);
      const partial = t.rowsNow().at(-1)!.record;
      expect([partial.state, partial.prepared.length]).toEqual(['preparing', prepared]);
      // Nothing spendable while preparing.
      expect(refusal(t.sets.attachResourceSet(reservationRef('operation:none'), setRef(partial.id)))).toMatch(/reservation absent|only a committed/);
    }
    t.crash.after = 0; // the commit itself is lost
    expect(refusal(t.sets.reserveResourceSet({ ...input, demands: first }))).toMatch(/simulated crash/);
    expect(t.rowsNow().at(-1)!.record.state).toBe('preparing');
    t.crash.after = Infinity;
    // Recovery: the same command completes the same set.
    const set = value(t.sets.reserveResourceSet({ ...input, demands: first }));
    expect(set.state).toBe('committed');
    for (const d of ['a', 'b', 'c']) expect(resourceDebited(t.rowsNow(), d, 'launches')).toBe(1);
    // A second reserve under the same command replays, never debits again.
    expect(value(t.sets.reserveResourceSet({ ...input, demands: first })).id).toBe(set.id);
    for (const d of ['a', 'b', 'c']) expect(resourceDebited(t.rowsNow(), d, 'launches')).toBe(1);
    // Attach: the launch gate. A crash before the attach lands leaves it unattached; a retry attaches once.
    const op = t.reservation(fence, 'r1');
    t.crash.after = 0;
    expect(refusal(t.sets.attachResourceSet(reservationRef(op.operation), setRef(set.id)))).toMatch(/simulated crash/);
    t.crash.after = Infinity;
    expect(t.rowsNow().at(-1)!.record.operation).toBe('');
    expect(value(t.sets.attachResourceSet(reservationRef(op.operation), setRef(set.id))).operation).toBe(op.operation);
    expect(value(t.sets.attachResourceSet(reservationRef(op.operation), setRef(set.id))).operation).toBe(op.operation);
    // Close with a crash after the first return: the remaining returns complete once each.
    t.crash.after = 1;
    expect(refusal(t.sets.closeResourceSet({ command: 'close-1', allocationSet: setRef(set.id), settlement: 'cleanup:verified' }))).toMatch(/simulated crash/);
    t.crash.after = Infinity;
    expect(resourceDebited(t.rowsNow(), 'a', 'launches')).toBe(0);
    expect(resourceDebited(t.rowsNow(), 'b', 'launches')).toBe(1);
    expect(refusal(t.sets.closeResourceSet({ command: 'close-1', allocationSet: setRef(set.id), settlement: 'another' }))).toMatch(/another settlement/);
    const closed = value(t.sets.closeResourceSet({ command: 'close-1', allocationSet: setRef(set.id), settlement: 'cleanup:verified' }));
    expect(closed.state).toBe('closed');
    for (const d of ['a', 'b', 'c']) expect(resourceDebited(t.rowsNow(), d, 'launches')).toBe(0);
    const facts = t.rowsNow().length;
    value(t.sets.closeResourceSet({ command: 'close-1', allocationSet: setRef(set.id), settlement: 'cleanup:verified' }));
    expect(t.rowsNow().length).toBe(facts);
  });

  it('attach binds exactly its own unclaimed reservation, in its own single-run Six domain; a claimed operation cannot acquire a set', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('a', 'installation', 'launches', 3)]);
    const fence = t.acquire();
    const set = value(t.sets.reserveResourceSet({ command: 's1', fence, request: t.request('r1'), run: t.run('r1'), parentAllocation: '',
      demands: [t.demand('installation', 'a', 'launches', 1)] }));
    const other = t.launch('r2');
    expect(refusal(t.sets.attachResourceSet(reservationRef(other.op.operation), setRef(set.id)))).toMatch(/bind different work/);
    expect(refusal(t.sets.attachResourceSet(reservationRef('operation:unknown'), setRef(set.id)))).toMatch(/reservation absent/);
    const own = t.launch('r1');
    const attached = value(t.sets.attachResourceSet(reservationRef(own.op.operation), setRef(set.id)));
    expect(attached.operation).toBe(own.op.operation);
    const row = t.rowsNow().at(-1)!.record;
    expect([row.state, row.operation]).toEqual(['committed', own.op.operation]);
    // Dispatch happens in the launch's own domain only after the attach.
    value(own.authority.claim('claim-r1', own.fence, own.op.operation));
    // A second set for a claimed operation is refused: the attach must precede dispatch.
    const late = value(t.sets.reserveResourceSet({ command: 's1-late', fence, request: t.request('r1'), run: t.run('r1'), parentAllocation: '',
      demands: [t.demand('installation', 'a', 'launches', 1)] }));
    expect(refusal(t.sets.attachResourceSet(reservationRef(own.op.operation), setRef(late.id)))).toMatch(/attach precedes dispatch/);
    // The known outcome returns the debit once.
    expect(value(t.sets.closeResourceSet({ command: 'c1', allocationSet: setRef(set.id), settlement: 'cleanup:verified' })).state).toBe('closed');
    expect(resourceDebited(t.rowsNow(), 'a', 'launches')).toBe(1);
  });

  it('a same-domain reservation attaches only under the same fence', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('a', 'installation', 'launches', 3)]);
    const fence = t.acquire();
    const set = value(t.sets.reserveResourceSet({ command: 's1', fence, request: t.request('r1'), run: t.run('r1'), parentAllocation: '',
      demands: [t.demand('installation', 'a', 'launches', 1)] }));
    const op = t.reservation(fence, 'r1');
    expect(value(t.sets.attachResourceSet(reservationRef(op.operation), setRef(set.id))).operation).toBe(op.operation);
  });

  it('parent to child: the child spends only the exact ancestor allocation, and the parent returns only after the child closed', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('install:1', 'installation', 'processes', 10)]);
    const fence = t.acquire();
    const parent = value(t.sets.reserveResourceSet({ command: 'parent', fence, request: t.request('rp'), run: t.run('rp'), parentAllocation: '',
      demands: [t.demand('installation', 'install:1', 'processes', 4)] }));
    const child = (command: string, amount: number) => t.sets.reserveResourceSet({ command, fence, request: t.request(command), run: t.run(command),
      parentAllocation: parent.id, demands: [t.demand('ancestor', parent.id, 'processes', amount, 'policy:ancestor')] });
    expect(value(child('child-1', 3)).state).toBe('committed');
    expect(refusal(child('child-2', 2))).toMatch(/capacity exhausted/);
    expect(refusal(t.sets.closeResourceSet({ command: 'close-parent', allocationSet: setRef(parent.id), settlement: 'done' }))).toMatch(/every child closed/);
    const first = t.rowsNow().filter(r => r.record.request === 'child-1').at(-1)!.record;
    value(t.sets.closeResourceSet({ command: 'close-child', allocationSet: setRef(first.id), settlement: 'done' }));
    expect(value(t.sets.closeResourceSet({ command: 'close-parent', allocationSet: setRef(parent.id), settlement: 'done' })).state).toBe('closed');
    // Credits never multiplied: the installation domain holds nothing afterwards.
    expect(resourceDebited(t.rowsNow(), 'install:1', 'processes')).toBe(0);
  });

  it('an ancestor bounds the child by each parent dimension of that resource, never their sum', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('install:1', 'installation', 'launches', 3),
      domain('family:x', 'job-family', 'launches', 3)]);
    const fence = t.acquire();
    // One admitted launch, constrained on two independent dimensions: one unit of capacity, not two.
    const parent = value(t.sets.reserveResourceSet({ command: 'parent', fence, request: t.request('rp'), run: t.run('rp'), parentAllocation: '',
      demands: [t.demand('job-family', 'family:x', 'launches', 1), t.demand('installation', 'install:1', 'launches', 1)] }));
    const child = (command: string, resource: string, amount: number) => t.sets.reserveResourceSet({ command, fence, request: t.request(command),
      run: t.run(command), parentAllocation: parent.id, demands: [t.demand('ancestor', parent.id, resource, amount, 'policy:ancestor')] });
    expect(refusal(child('child-2', 'launches', 2))).toMatch(/capacity exhausted/);
    expect(value(child('child-1', 'launches', 1)).state).toBe('committed');
    expect(refusal(child('child-3', 'launches', 1))).toMatch(/capacity exhausted/);
    // A resource the parent never held is not an ambiguous zero-or-anything credit: it refuses.
    expect(refusal(child('child-4', 'processes', 1))).toMatch(/not held by the parent/);
  });

  it('a command reused with changed demands refuses (conflicting digest)', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('a', 'installation', 'launches', 3)]);
    const fence = t.acquire();
    value(t.sets.reserveResourceSet({ command: 'same', fence, request: t.request('r'), run: t.run('r'), parentAllocation: '',
      demands: [t.demand('installation', 'a', 'launches', 1)] }));
    expect(refusal(t.sets.reserveResourceSet({ command: 'same', fence, request: t.request('r'), run: t.run('r'), parentAllocation: '',
      demands: [t.demand('installation', 'a', 'launches', 2)] }))).toMatch(/different resource set/);
  });

  it('after a restart a new authority incarnation observes the durable set and closes it once', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('a', 'installation', 'launches', 1)]);
    const fence = t.acquire();
    const set = value(t.sets.reserveResourceSet({ command: 'before-restart', fence, request: t.request('r'), run: t.run('r'),
      parentAllocation: '', demands: [t.demand('installation', 'a', 'launches', 1)] }));
    const restarted = resourceSetFixture(t.directory, 'authority:2', [domain('a', 'installation', 'launches', 1)]);
    const fresh = restarted.acquire();
    // The unclosed debit survived the restart: a new launch cannot take the slot.
    expect(refusal(restarted.sets.reserveResourceSet({ command: 'after', fence: fresh, request: restarted.request('r2'),
      run: restarted.run('r2'), parentAllocation: '', demands: [restarted.demand('installation', 'a', 'launches', 1)] }))).toMatch(/capacity exhausted/);
    expect(value(restarted.sets.closeResourceSet({ command: 'recover', allocationSet: setRef(set.id), settlement: 'recovery:observed-gone' })).state).toBe('closed');
    expect(resourceDebited(restarted.rowsNow(), 'a', 'launches')).toBe(0);
  });

  it('a raw append that bypasses the authority is still decided by the owner decoder', () => {
    const t = resourceSetFixture(undefined, 'authority:1', [domain('a', 'installation', 'launches', 1)]);
    const fence = t.acquire();
    const set = value(t.sets.reserveResourceSet({ command: 'first', fence, request: t.request('r1'), run: t.run('r1'), parentAllocation: '',
      demands: [t.demand('installation', 'a', 'launches', 1)] }));
    const raw = (record: unknown) => refusal(authorAndAppend({ kind: resourceSetFactKind, schemaVersion: 1, machine: t.host.machine,
      principal: json(t.host.principal), provenance: json(t.host.principal.provenance), at: json(t.clock(100)),
      body: json({ record }), required: [] }, t.ctx, t.store, privateKey));
    const forged = { ...set, id: 'allocation:forged', request: 'rf', run: 'rf', state: 'preparing', prepared: ['a'], committed: [],
      released: [], operation: '', predecessor: '', demands: [{ ...set.demands[0], expectedPredecessor: t.head('a') }] };
    expect(raw(forged)).toMatch(/capacity exhausted/u);
    // A committed set cannot be forged into existence without its preparation.
    expect(raw({ ...forged, id: 'allocation:skip', state: 'committed', committed: ['a'] })).toMatch(/starts by preparing/u);
    // The other side: within capacity after the first returns, the same raw preparation is admitted.
    value(t.sets.closeResourceSet({ command: 'c', allocationSet: setRef(set.id), settlement: 'done' }));
    expect(raw({ ...forged, demands: [{ ...set.demands[0], expectedPredecessor: t.head('a') }] })).toBe('');
  });
});
