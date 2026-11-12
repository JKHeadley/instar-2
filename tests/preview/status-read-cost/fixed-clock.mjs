// Equality tests hold both external clock inputs constant; timings use the normal clock.
Date.now = () => 1_800_000_000_000;
Object.defineProperty(performance, 'now', { value: () => 0 });
