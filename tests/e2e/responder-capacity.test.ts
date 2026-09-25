import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine } from '../../src/transport/index.js';
import { intakeFixture } from '../intake/fixtures.js';
import { privateKey, value } from '../facts/fixtures.js';
import { responderCapacityFixture } from '../transport/responder-capacity.test.js';

it('P6-NF-42/43 restores a finite same-store capacity debit from fsync-backed history and rebinds once', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'instar-capacity-')));
  try {
    const x = responderCapacityFixture(intakeFixture({ directory }));
    const reserved = value(x.api.reserveCapacity(x.input));
    expect(reserved.type).toBe('CapacityReservation');
    expect(value(x.api.inspect()).some(row => row.record.type === 'LoopRecord')).toBe(false);
    expect(readFileSync(join(directory, 'segment.jsonl'), 'utf8')).toContain('transport-CapacityReservation');
    const restoredStore = createFactStore(x.f.context, x.f.storage);
    const restored = createTransportAuthority(x.host,
      createTransportSpine(x.host, { context: x.f.context, privateKey }, restoredStore), x.boundary);
    expect(value(restored.inspectCapacity()).parentRemainder.effect.quantity).toBe(80);
    x.advance(301);
    const old = value(restored.inspectCapacity()).heads[0]!;
    expect(old.usable).toBe(false);
    const successor = value(restored.rebindCapacity({ command: 'capacity:after-restart',
      previousCapacity: old.fact, fence: x.lease, validUntil: x.clock(450) }));
    expect(successor.previousCapacity).toBe(old.fact);
    const current = value(restored.inspectCapacity());
    expect(current.heads).toHaveLength(1);
    expect(current.heads[0]!.usable).toBe(true);
    expect(current.parentRemainder.effect.quantity).toBe(80);
    expect(readFileSync(join(directory, 'segment.jsonl'), 'utf8').match(/transport-CapacityReservation/g)).toHaveLength(2);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
