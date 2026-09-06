import type { Result } from '../index.js';
import { decodeDeclaration } from '../register/index.js';
import type { Declaration, RegisterContext } from '../register/index.js';
import { boundary, need, take } from './boundary.js';

/** P3 remains the declaration owner. Installation consumes the colocated
 * declaration rather than teaching P5 a second register schema. This is shape
 * validation, not a claim that a production generation has entered force. */
export function decodeRunGraphRegistration(input: unknown, context: RegisterContext): Result<Declaration> {
  return boundary('RunGraphRegistration', input, context, safe => {
    const declaration = take(decodeDeclaration(safe, context));
    need(declaration.id === 'rungraph-core' && declaration.kind === 'features', 'wrong feature registration');
    need(declaration.profile?.consequence === 'control' && declaration.profile.reach === 'internal', 'run graph profile understates control');
    return declaration;
  });
}
