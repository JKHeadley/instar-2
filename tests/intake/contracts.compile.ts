import type { IntakeDependencies } from '../../src/intake/index.js';
import type { GeneratedRegister, RegisterContext } from '../../src/register/index.js';
declare const shape: GeneratedRegister;
declare const context: RegisterContext;
// @ts-expect-error Offline generated data is not verified runtime authority.
const unverified: IntakeDependencies['governance'] = { register: shape, context };
void unverified;
