/** One process clock for preview deadlines and journal timestamps. A wall-clock
 * correction may advance time, but cannot take back elapsed monotonic time. */
export function createPreviewClock(wall: () => number, elapsed: () => number) {
  let last = 0;
  let tick = elapsed();
  const now = () => {
    const nextTick = elapsed();
    const advance = Math.max(0, nextTick - tick);
    last = Math.max(wall(), last + advance);
    tick = nextTick;
    return Math.floor(last);
  };
  return { now, elapsed, seed: (floor: number) => { last = Math.max(last, floor); tick = elapsed(); } };
}
