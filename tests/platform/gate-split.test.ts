// Every explicit-file vitest step of `npm run test:gate` must hold under the Linux/Mac split: in
// each half it runs only that half's named files (or is skipped, not run empty, which vitest fails
// with "No test files found"), and across both halves every file the unsplit step names runs
// exactly once. The steps are read from package.json, so a new raw `vitest run <files>` step fails here.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error The detection is plain JavaScript so it also runs as a CLI.
import { LIST_PATH, readList } from './macos-only.mjs';
import { planStep } from '../../scripts/vitest-split-step.mjs';

const scripts: Record<string, string> = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
const macosOnly: string[] = readList(readFileSync(LIST_PATH, 'utf8'));
const SPLITS = ['only-macos', 'exclude-macos'] as const;

const words = (command: string): string[] => [...command.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '');

/** The commands `npm run <name>` runs, with nested `npm run` steps expanded and env prefixes dropped. */
function commands(name: string): string[][] {
  const script = scripts[name];
  if (script === undefined) throw new Error(`package.json has no script ${name}`);
  return script.split('&&').flatMap(part => {
    const argv = words(part.trim());
    while (/^[A-Z_]+=/.test(argv[0] ?? '')) argv.shift();
    return argv[0] === 'npm' && argv[1] === 'run' ? commands(argv[2] ?? '') : [argv];
  });
}

interface Step { readonly named: string[]; run(split: typeof SPLITS[number]): { files: string[]; failsEmpty: boolean } }

/** The explicit-file vitest steps of the gate, each modelled as what it runs in one half. */
function explicitSteps(): Step[] {
  return commands('test:gate').flatMap((argv): Step[] => {
    if (argv[0] === 'node' && argv[1] === 'scripts/vitest-split-step.mjs') {
      const args = argv.slice(2);
      return [{ named: planStep(args, undefined, macosOnly).files, run: split => {
        const plan = planStep(args, split, macosOnly);
        return { files: plan.runs ? plan.files : [], failsEmpty: false };
      } }];
    }
    if (argv[0] !== 'vitest' || argv[1] !== 'run') return [];
    const named = argv.slice(2).filter(arg => arg.endsWith('.test.ts'));
    if (named.length === 0) return []; // the main run: the config's include/exclude splits it
    // A raw step: vitest.config.ts narrows include to this half, so an empty intersection exits 1.
    return [{ named, run: split => {
      const files = named.filter(file => macosOnly.includes(file) === (split === 'only-macos'));
      return { files, failsEmpty: files.length === 0 };
    } }];
  });
}

it('each explicit-file gate step runs only its half\'s files, and across both halves every named file exactly once', () => {
  const steps = explicitSteps();
  expect(steps.length).toBeGreaterThan(0);
  const failsEmpty = steps.flatMap(step => SPLITS.filter(split => step.run(split).failsEmpty).map(split => `${split}: ${step.named.join(' ')}`));
  expect(failsEmpty).toEqual([]);
  for (const step of steps) expect(SPLITS.flatMap(split => step.run(split).files).sort()).toEqual([...step.named].sort());
  // The gate's steps together name both macOS-only and portable files, so both skip paths are exercised.
  const named = steps.flatMap(step => step.named);
  expect(named.some(file => macosOnly.includes(file))).toBe(true);
  expect(named.some(file => !macosOnly.includes(file))).toBe(true);
});

it('plans a step: exact passthrough unset, this half only under a split, a skip when none is here', () => {
  const args = ['tests/a/mac.test.ts', 'tests/a/portable.test.ts', '-t', 'x|y'];
  const list = ['tests/a/mac.test.ts'];
  expect(planStep(args, undefined, list)).toEqual({ runs: true, argv: ['run', ...args], files: ['tests/a/mac.test.ts', 'tests/a/portable.test.ts'], otherHalf: [] });
  expect(planStep(args, 'only-macos', list)).toEqual({ runs: true, argv: ['run', 'tests/a/mac.test.ts', '-t', 'x|y'],
    files: ['tests/a/mac.test.ts'], otherHalf: ['tests/a/portable.test.ts'] });
  expect(planStep(args, 'exclude-macos', list)).toEqual({ runs: true, argv: ['run', 'tests/a/portable.test.ts', '-t', 'x|y'],
    files: ['tests/a/portable.test.ts'], otherHalf: ['tests/a/mac.test.ts'] });
  expect(planStep(['tests/a/mac.test.ts', '-t', 'x'], 'exclude-macos', list).runs).toBe(false);
  expect(planStep(['tests/a/portable.test.ts'], 'only-macos', list).runs).toBe(false);
  expect(() => planStep(args, 'linux', list)).toThrow(/must be exclude-macos or only-macos/);
  expect(() => planStep(['-t', 'x'], 'only-macos', list)).toThrow(/name the test files first/);
});
