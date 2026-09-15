import type { Result } from '../../src/index.js';
import type { HarnessValidationFloor } from '../../src/harness-adapters/index.js';
import { decodeHarnessValidationFloor } from '../../src/harness-adapters/index.js';

type Plain<T> = Pick<T, Extract<keyof T, string>>;
declare const plainFloor: Plain<HarnessValidationFloor>;
// @ts-expect-error HarnessValidationFloor is an opaque owned record constructible only through its decoder.
const fabricatedFloor: HarnessValidationFloor = plainFloor;

declare const raw: unknown;
const acceptedFloor: Result<HarnessValidationFloor> = decodeHarnessValidationFloor(raw);
void fabricatedFloor;
void acceptedFloor;
