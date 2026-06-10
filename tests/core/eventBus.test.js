import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/core/eventBus.js';

describe('createEventBus', () => {
  it('calls handlers on emit with payload', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('hit', fn);
    bus.emit('hit', { dmg: 5 });
    expect(fn).toHaveBeenCalledWith({ dmg: 5 });
  });

  it('supports multiple handlers for one type', () => {
    const bus = createEventBus();
    const a = vi.fn(); const b = vi.fn();
    bus.on('x', a); bus.on('x', b);
    bus.emit('x', 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('off removes a handler', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('x', fn); bus.off('x', fn);
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('on returns an unsubscribe function', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const unsub = bus.on('x', fn);
    unsub();
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('emitting an unknown type does not throw', () => {
    const bus = createEventBus();
    expect(() => bus.emit('nope')).not.toThrow();
  });
});
