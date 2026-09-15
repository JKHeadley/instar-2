import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { createConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import { privateKey, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';

const cases = [
  ['below-bound', 149, 149, 150, 'Success'],
  ['at-bound', 149, 150, 150, 'Refused'],
  ['no-bound-legacy', 149, 150, null, 'Success'],
] as const;

it.each(cases)(
  'P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] unit %s',
  (_caseId, startClock, commitClock, validUntil, expectedKind) => {
    const fixture = assemblyRuntimeFixture();
    fixture.time(startClock);
    const commitStorage: SegmentStoragePort = {
      owner: 'part-ten',
      read: fixture.storage.read,
      append(bytes, expectedHead) {
        fixture.time(commitClock);
        return fixture.storage.append(bytes, expectedHead);
      },
    };
    const adapter = 'telegram:v1:bot:validity-unit';
    const expected = {
      subject: { type: 'AdapterConformance' as const, field: 'adapter', value: adapter },
      facts: [],
      ...(validUntil === null ? {} : { validUntil }),
    };
    const result = createConditionalAssemblyAppendPort({
      host: fixture.host,
      author: { context: fixture.context, privateKey },
      storage: commitStorage,
    }).appendIfSubjectFrontier('AdapterConformance', {
      ...assemblyInput('AdapterConformance'), id: `conformance:${_caseId}`, adapter,
    }, expected);

    expect(result.kind).toBe(expectedKind);
    const rows = value(fixture.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance'
      && row.record.adapter === adapter);
    expect(rows).toHaveLength(expectedKind === 'Success' ? 1 : 0);
    if (result.kind === 'Refused') {
      expect(result.detail).toBe('evidence-expired: validUntil=150; commitClock=150');
    }
  },
);
