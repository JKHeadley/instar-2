import { expect, it } from 'vitest';
import {
  admitMeasurementAmount, coalesceUnknownQuotaEpisodes, createMeasurementLedger,
  decodeMeasurementProducerContract, reconcileProcessIncarnation,
} from '../../src/measurement/index.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from '../measurement/fixture.js';

it('P16-NF-01 P16-NF-02 P16-NF-03 P16-NF-05 P16-NF-22 P16-NF-23 P16-NF-24 P16-NF-25 P16-NF-26 P16-NF-27 P16-NF-28 P16-NF-29 P16-NF-30 P16-NF-52 P16-NF-53 full public A1 port preserves F8 F9 F10 F11 boundaries', () => {
  const f = measurementFixture();
  const port = createMeasurementLedger(f.c);

  expect(value(port.admitAmount({ contract: f.eventProducer, category: 'input', amount: 2 })))
    .toMatchObject({ family: 'programmatic-event', subjectKind: 'programmatic-count', amount: 2 });
  refused(port.admitAmount({ contract: f.producer, category: 'input', amount: 0.5 }), 'safe integer');
  refused(port.admitAmount({ contract: f.producer, category: 'input', amount: Number.MAX_VALUE }), 'safe integer');
  expect(value(port.admitAmount({ contract: f.resourceProducer, category: 'cpu', amount: 0.25 })).amount).toBe(0.25);

  refused(decodeMeasurementProducerContract(f.producerInput({
    categories: [{ name: 'fictional-token', unit: 'tokens', relation: 'standalone' }],
  }), f.c), 'current registered content');

  const process = { processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['worker'] };
  expect(value(reconcileProcessIncarnation(process, null, f.c))).toBe('missing');
  refused(reconcileProcessIncarnation(process, false as never, f.c), 'closed object');
  expect(value(coalesceUnknownQuotaEpisodes(['account'], ['prior'], f.c)).open).toEqual(['account', 'prior']);
  refused(coalesceUnknownQuotaEpisodes(['account'], [null, 42] as never, f.c), 'text array');

  expect(value(port.trend([f.resourcePoint('one', 100, 100), f.resourcePoint('two', 160, 110)], 2)))
    .toMatchObject({ state: 'complete', rssDeltaBytes: 10 });
});
