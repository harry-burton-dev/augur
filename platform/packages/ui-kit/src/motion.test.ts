import { afterEach, describe, expect, it, vi } from 'vitest';
import { animate, finishMotion, liftGhost, motionMode, moving, tokenValue, track } from './motion.js';

/** A stand-in for an Animation that ends when finished. */
function fakeAnimation() {
  let end!: () => void;
  const finished = new Promise<void>((resolve) => (end = resolve));
  return { finished, finish: vi.fn(() => end()) } as unknown as Animation & { finish: ReturnType<typeof vi.fn> };
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  document.documentElement.style.removeProperty('--motion-calm');
  document.body.replaceChildren();
});

describe('motionMode', () => {
  it('is reduce when the page asks for it, so one check covers both switches', () => {
    expect(motionMode()).toBe('full');
    document.documentElement.dataset.motion = 'reduce';
    expect(motionMode()).toBe('reduce');
  });
});

describe('finishMotion', () => {
  it('jumps every move under way to its end', async () => {
    const a = track(fakeAnimation());
    const b = track(fakeAnimation());
    expect(moving()).toBe(true);
    finishMotion();
    expect(a.finish).toHaveBeenCalled();
    expect(b.finish).toHaveBeenCalled();
    await Promise.all([a.finished, b.finished]);
    await Promise.resolve();
    expect(moving()).toBe(false);
  });
});

describe('tokenValue', () => {
  it('reads a duration token in ms, and falls back without one', () => {
    expect(tokenValue('motion-calm', 600)).toBe(600);
    document.documentElement.style.setProperty('--motion-calm', '0.4s');
    expect(tokenValue('motion-calm', 600)).toBe(400);
  });
});

describe('animate', () => {
  it('resolves at once where the page cannot animate', async () => {
    const el = document.createElement('div');
    (el as unknown as { animate?: unknown }).animate = undefined;
    await expect(animate(el, [{ opacity: 0 }], { duration: 100 })).resolves.toBeUndefined();
  });
});

describe('liftGhost', () => {
  const placed = () => {
    const el = document.createElement('span');
    el.textContent = 'Artifacts';
    el.getBoundingClientRect = () => ({ left: 10, top: 20, width: 80, height: 16 }) as DOMRect;
    document.body.append(el);
    return el;
  };

  it('copies the choice above everything and removes it once landed', async () => {
    const ghost = liftGhost(placed());
    const copies = [...document.body.children].filter((c) => c.getAttribute('aria-hidden') === 'true');
    expect(copies).toHaveLength(1);
    expect((copies[0] as HTMLElement).style.position).toBe('fixed');
    await ghost.land({ left: 100, top: 40, width: 40, height: 8 } as DOMRect, { duration: 1 });
    expect(document.body.children).toHaveLength(1);
  });

  it('lifts nothing under reduced motion', async () => {
    document.documentElement.dataset.motion = 'reduce';
    const ghost = liftGhost(placed());
    expect(document.body.children).toHaveLength(1);
    await ghost.land(null);
  });

  it('lifts nothing from an element that is not on screen', () => {
    liftGhost(document.createElement('span'));
    expect(document.body.children).toHaveLength(0);
  });
});
