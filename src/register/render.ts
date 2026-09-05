import type { GeneratedRegister, RegisterContext, RegisterGeneration } from './types.js';
import type { RuleGraph } from '../rulegraph/graph.js';
import type { TermResolution } from '../terms/resolver.js';
import { checked, encoding, requireThat, text } from './boundary.js';

export interface Renderings { readonly register: string; readonly ruleBook: string; readonly glossary: string;
  readonly capabilities: string; readonly coverage: string }
export function renderRegister(register: GeneratedRegister, generation: RegisterGeneration, resolution: TermResolution,
  graph: RuleGraph | null, context: RegisterContext) {
  return checked<Renderings, RegisterContext>('RegisterRenderings', { register, generation, resolution, graph }, context, () => {
    requireThat(encoding(register).hash === generation.id, 'P3-NF-08: rendering generation mismatch');
    const header = `Register generation: ${generation.id}\nSource commit: ${register.commit}\nExtract vector: ${register.extract.vector.id}\nAuthority: shape-only; entering-force verification required at consumption.\n`;
    const entries = register.entries.map(e => e.declaration);
    const ruleBook = '# Generated rules\n\n' + header + '\n' + entries.filter(d => d.kind === 'rules').map(d => {
      const f = d.requiredFacts; return `## ${f.number}. ${f.name}\n\n${f.statement}\n\nCheck: ${f.checkDescription}\nTerms: ${(f.termRefs as readonly string[]).join(', ') || '(none)'}\n`;
    }).join('\n');
    const glossary = '# Generated glossary\n\n' + header + '\n' + entries.filter(d => d.kind === 'terms').map(d =>
      `## ${d.requiredFacts.name}\n\n${d.requiredFacts.definition}\n\nUsed by: ${(resolution.usedBy[d.id] ?? []).join(', ') || '(unused)'}\n`).join('\n');
    const capabilities = '# Capabilities\n\n' + header + '\n' + entries.filter(d => d.kind === 'features').map(d =>
      `- ${d.id}: ${d.status}; metrics: ${JSON.stringify(d.requiredFacts.metrics)}; live proof: ${d.requiredFacts.liveProof ?? 'unavailable'}\n`).join('');
    const coverage = '# Rule coverage\n\n' + header + '\n' + (graph
      ? '| Class | Count |\n|---|---:|\n' + Object.entries(graph.totals).map(([name, count]) => `| ${name} | ${count} |`).join('\n') + '\n\n' + JSON.stringify(graph.rules, null, 2)
      : 'Bootstrap coverage is unavailable: rule deadlines/standing routes and holder declarations have not been approved. No rule is claimed held.\n');
    return { register: encoding(register).bytes + '\n', ruleBook, glossary, capabilities, coverage };
  });
}
