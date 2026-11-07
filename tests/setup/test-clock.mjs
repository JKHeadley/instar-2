// TEST-INFRASTRUCTURE only: inherited by Vitest workers and their node children.
// Shift wall time, not elapsed timers; explicit dates and later injected clocks retain their meaning.
const shift = Number(process.env.INSTAR_TEST_CLOCK_SHIFT_MS);
if (Number.isSafeInteger(shift) && shift !== 0) {
  const Real = Date, now = Real.now.bind(Real);
  function TestDate(...args) {
    if (!new.target) return new Real(now() + shift).toString();
    return Reflect.construct(Real, args.length ? args : [now() + shift], new.target);
  }
  Object.setPrototypeOf(TestDate, Real);
  TestDate.prototype = Real.prototype;
  TestDate.now = () => now() + shift;
  TestDate.hostNow = now; // tests/setup/host-clock.mjs: run evidence stays on the host clock
  globalThis.Date = TestDate;
}
