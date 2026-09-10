import { expect, it } from 'vitest';
import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRunClosureGraph } from '../../src/rungraph/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { completedFixture, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { ref, refused, value } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-A-F4-RESTART-CUTS P5-SEAM-RC-R12-V18 P5-SEAM-RC-R12-V23 P5-SEAM-RC-R13-E2E-V02-V05-V18 P5-NF-11 P5-NF-17 P5-NF-23 both exit arms survive fsynced restart cuts before and after both exit appends', () => {
  for (const arm of ['completed', 'unreachable'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `rungraph-${arm}-closure-`)), spine = join(directory, 'facts.jsonl');
    writeFileSync(spine, '');
    const storageFactory = (fallback: SegmentStoragePort): SegmentStoragePort => ({
      owner: 'part-ten',
      read: () => readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row)),
      append: (bytes, expected) => {
        const rows = readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row));
        if ((rows.at(-1)?.contentHash ?? null) !== expected) throw new Error('disk CAS');
        const fd = openSync(spine, 'a');
        try { writeFileSync(fd, bytes + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
        return fallback.append(bytes, expected);
      },
    });
    try {
      const f = arm === 'completed' ? completedFixture(storageFactory) : exhaustionFixture(storageFactory);
      const proposal: any = 'proposal' in f ? f.proposal : f.transition;
      let cut: { operation: string; side: 'before' | 'after' } | undefined;
      const deps = { ...f.deps, admission: { ...f.deps.admission, commit: (request: Parameters<typeof f.deps.admission.commit>[0], write: Parameters<typeof f.deps.admission.commit>[1]) => {
        if (cut?.operation === request.operation && cut.side === 'before') throw new Error('cut before durable exit append');
        const receipt = f.deps.admission.commit(request, write);
        if (cut?.operation === request.operation && cut.side === 'after') throw new Error('cut after durable exit append');
        return receipt;
      } } };

      let graph = value(createRunClosureGraph(deps));
      const appendProposal = () => arm === 'completed'
        ? graph.transition(proposal)
        : graph.recordUnreachableExit(proposal, f.lease);
      cut = { operation: proposal.id, side: 'before' };
      refused(appendProposal() as never, 'cut before durable exit append');
      expect(value(value(createRunClosureGraph(deps)).read(f.id)).state).toBe('ready');

      cut = { operation: proposal.id, side: 'after' };
      graph = value(createRunClosureGraph(deps));
      refused((arm === 'completed' ? graph.transition(proposal)
        : graph.recordUnreachableExit(proposal, f.lease)) as never, 'cut after durable exit append');
      const restarted = value(createRunClosureGraph(deps));
      const rowsAfterProposal = readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row));
      const proposalFact = rowsAfterProposal.filter(row => row.kind === (arm === 'completed' ? 'run-transition' : 'run-unreachable-exit')).at(-1)!;
      const closing = value(restarted.read(f.id));
      expect(closing.state).toBe('closing');

      const terminalExit = arm === 'completed'
        ? { ...proposal.exit!, id: `exit:${arm}:terminal-cut`, expected: closing.head }
        : { ...proposal, id: `exit:${arm}:terminal-cut`, expected: proposal.id, phase: 'close',
          frontier: closing.source.foldedThrough,
          proposal: { owner: 'part-five', name: 'UnreachableRunExit', id: proposal.id, fact: ref(proposalFact) } };
      const close = arm === 'completed'
        ? { ...proposal, id: `close:${arm}:cut`, expected: closing.head, kind: 'close', from: 'closing', to: arm, exit: terminalExit }
        : terminalExit;
      cut = { operation: close.id, side: 'before' };
      refused((arm === 'completed' ? restarted.transition(close)
        : restarted.recordUnreachableExit(close, f.lease)) as never, 'cut before durable exit append');

      cut = { operation: close.id, side: 'after' };
      const afterBeforeCut = value(createRunClosureGraph(deps));
      refused((arm === 'completed' ? afterBeforeCut.transition(close)
        : afterBeforeCut.recordUnreachableExit(close, f.lease)) as never, 'cut after durable exit append');
      const recovered = value(createRunClosureGraph(deps));
      const rows = readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row));
      const closeFact = rows.filter(row => row.kind === (arm === 'completed' ? 'run-transition' : 'run-unreachable-exit')).at(-1)!;
      expect(value(recovered.readExit({ owner: 'part-five', name: 'Run', id: f.id })))
        .toEqual({ fact: ref(closeFact), exit: terminalExit });
      expect(value(recovered.read(f.id)).state).toBe(arm);
      if (arm === 'unreachable') refused(recovered.ground(f.id, 'w', 'h', 'start', f.lease), 'terminal/conflicted run');
      expect(rows.filter(row => row.kind === (arm === 'completed' ? 'run-transition' : 'run-unreachable-exit'))).toHaveLength(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}, 30_000);
