import { describe, it, expect, vi } from 'vitest';
import { createLoop } from '../../src/core/loop.js';

describe('createLoop', () => {
  it('runs one tick per dt accumulated', () => {
    const tick = vi.fn();
    const loop = createLoop({ tick, dt: 100 });
    expect(loop.advance(100)).toBe(1);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledWith(100);
  });

  it('runs multiple ticks for a large delta and keeps the remainder', () => {
    const tick = vi.fn();
    const loop = createLoop({ tick, dt: 100 });
    expect(loop.advance(250)).toBe(2);       // 2 full ticks
    expect(loop.accumulator).toBeCloseTo(50); // 50ms left over
  });

  it('caps ticks at maxSteps to avoid a spiral of death', () => {
    const tick = vi.fn();
    const loop = createLoop({ tick, dt: 100, maxSteps: 3 });
    expect(loop.advance(10_000)).toBe(3);
    expect(loop.accumulator).toBe(0);        // remainder dropped when capped
  });

  it('does not tick when less than dt has accumulated', () => {
    const tick = vi.fn();
    const loop = createLoop({ tick, dt: 100 });
    expect(loop.advance(50)).toBe(0);
    expect(tick).not.toHaveBeenCalled();
  });
});
