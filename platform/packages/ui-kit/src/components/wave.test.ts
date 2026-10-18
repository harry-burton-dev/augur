import { describe, expect, it } from 'vitest';
import './wave.js';
import { resolveWave, waveY, wavePresets, type UiWaveBackground } from './wave.js';

describe('resolveWave', () => {
  it('falls back to Calm Tide for an unknown preset', () => {
    expect(resolveWave('Nope')).toEqual(resolveWave('Calm Tide'));
  });

  it('lets the colour tokens reach the default, but not the variants', () => {
    const tokens = { navy: '#000080' };
    expect(resolveWave('Calm Tide', {}, tokens).colors.navy).toBe('#000080');
    expect(resolveWave('Deep Ocean', {}, tokens).colors.navy).toBe(wavePresets['Deep Ocean'].colors.navy);
  });

  it('puts overrides on top and never shares band objects with the preset', () => {
    const c = resolveWave('Minimal', { global: { speed: 2 }, colors: { green: '#00ff00' } });
    expect(c.global.speed).toBe(2);
    expect(c.global.blur).toBe(wavePresets.Minimal.global.blur);
    expect(c.colors.green).toBe('#00ff00');
    c.waves[0].y = 9;
    expect(wavePresets.Minimal.waves[0].y).not.toBe(9);
  });
});

describe('waveY', () => {
  it('stays within the band amplitude around its line', () => {
    const band = wavePresets['Calm Tide'].waves[0];
    for (let t = 0; t < 20; t += 0.7)
      for (let x = 0; x <= 400; x += 37) {
        const y = waveY(band, x, t, 400, 300);
        expect(Math.abs(y - 300 * band.y)).toBeLessThanOrEqual(300 * band.amp * 1.5 + 1e-9);
      }
  });

  it('drifts over time', () => {
    const band = wavePresets['Calm Tide'].waves[0];
    expect(waveY(band, 50, 0, 400, 300)).not.toBe(waveY(band, 50, 1, 400, 300));
  });
});

describe('ui-wave-background', () => {
  it('draws the preset ground and grain, and switches preset', async () => {
    document.body.innerHTML = '<div style="position:relative;height:200px"><ui-wave-background preset="Deep Ocean"></ui-wave-background></div>';
    const el = document.querySelector('ui-wave-background') as UiWaveBackground;
    await el.updateComplete;
    const ground = () => (el.shadowRoot!.querySelector('.ground') as HTMLElement).getAttribute('style');
    expect(ground()).toContain('#1F2733');
    el.preset = 'Minimal';
    await el.updateComplete;
    expect(ground()).toContain('#2E3644');
    expect(el.getConfig().waves).toHaveLength(2);
    el.pulse(5);
    el.pause();
    expect(el.paused).toBe(true);
  });
});
