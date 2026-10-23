import { describe, expect, it } from 'vitest';
import { fitWorld, type Insets, layoutOf, splitLayout } from './layout.ts';

const none: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

describe('layoutOf', () => {
  it('sees a phone held upright', () => {
    expect(layoutOf({ width: 390, height: 844 }, none, 'coarse')).toEqual({
      width: 390,
      height: 844,
      orientation: 'portrait',
      form: 'phone',
      safe: none,
      short: 390,
      long: 844,
    });
  });

  it('sees a phone held sideways, still a phone', () => {
    const layout = layoutOf({ width: 844, height: 390 }, none, 'coarse');
    expect(layout).toMatchObject({ orientation: 'landscape', form: 'phone', short: 390, long: 844 });
  });

  it('sees a tablet from a short side of 600 with touch', () => {
    expect(layoutOf({ width: 1024, height: 768 }, none, 'coarse').form).toBe('tablet');
    expect(layoutOf({ width: 600, height: 960 }, none, 'coarse').form).toBe('tablet');
    expect(layoutOf({ width: 599, height: 960 }, none, 'coarse').form).toBe('phone');
  });

  it('sees a desktop from a short side of 600 with a mouse, a small window as a phone', () => {
    expect(layoutOf({ width: 1280, height: 720 }, none, 'fine')).toMatchObject({
      orientation: 'landscape',
      form: 'desktop',
    });
    expect(layoutOf({ width: 400, height: 700 }, none, 'fine').form).toBe('phone');
  });

  it('counts a square as portrait and a missing pointer as touch', () => {
    expect(layoutOf({ width: 700, height: 700 }, none)).toMatchObject({
      orientation: 'portrait',
      form: 'tablet',
    });
  });
});

describe('splitLayout', () => {
  it('puts the panel at the bottom in portrait', () => {
    const layout = layoutOf({ width: 400, height: 800 }, none);
    expect(splitLayout(layout, { panel: 120 })).toEqual({
      world: { x: 0, y: 0, width: 400, height: 680 },
      panel: { x: 0, y: 680, width: 400, height: 120 },
      side: 'bottom',
    });
  });

  it('puts the panel at the right in landscape', () => {
    const layout = layoutOf({ width: 1000, height: 500 }, none, 'fine');
    expect(splitLayout(layout, { panel: 300 })).toEqual({
      world: { x: 0, y: 0, width: 700, height: 500 },
      panel: { x: 700, y: 0, width: 300, height: 500 },
      side: 'right',
    });
  });

  it('keeps both inside the safe area', () => {
    const safe = { top: 47, right: 0, bottom: 34, left: 0 };
    const layout = layoutOf({ width: 390, height: 844 }, safe);
    expect(splitLayout(layout, { panel: 100 })).toEqual({
      world: { x: 0, y: 47, width: 390, height: 663 },
      panel: { x: 0, y: 710, width: 390, height: 100 },
      side: 'bottom',
    });
    const sideways = layoutOf({ width: 844, height: 390 }, { top: 0, right: 47, bottom: 21, left: 47 });
    expect(splitLayout(sideways, { panel: 200 })).toEqual({
      world: { x: 47, y: 0, width: 550, height: 369 },
      panel: { x: 597, y: 0, width: 200, height: 369 },
      side: 'right',
    });
  });

  it('caps the panel at maxPanel and at half the side', () => {
    const layout = layoutOf({ width: 400, height: 800 }, none);
    expect(splitLayout(layout, { panel: 300, maxPanel: 200 }).panel.height).toBe(200);
    expect(splitLayout(layout, { panel: 600 }).panel.height).toBe(400);
    expect(splitLayout(layout, { panel: 600 }).world.height).toBe(400);
    expect(splitLayout(layout, { panel: -10 }).panel.height).toBe(0);
  });
});

describe('fitWorld', () => {
  const world = { x: 0, y: 0, width: 200, height: 100 };

  it('contains: shows the whole world centred', () => {
    const fit = fitWorld(world, { x: 0, y: 0, width: 400, height: 400 }, 'contain');
    expect(fit).toEqual({ zoom: 2, scrollX: 0, scrollY: -50 });
    // The world's centre lands on the view's centre.
    expect((100 - fit.scrollX) * fit.zoom).toBe(200);
    expect((50 - fit.scrollY) * fit.zoom).toBe(200);
  });

  it('covers: fills the view and crops the rest', () => {
    const fit = fitWorld(world, { x: 0, y: 0, width: 400, height: 400 }, 'cover');
    expect(fit).toEqual({ zoom: 4, scrollX: 50, scrollY: 0 });
  });

  it('centres a world that does not start at the origin', () => {
    const fit = fitWorld(
      { x: 100, y: 100, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 200 },
      'contain',
    );
    expect(fit).toEqual({ zoom: 2, scrollX: 100, scrollY: 100 });
  });

  it('clamps the zoom', () => {
    const view = { x: 0, y: 0, width: 400, height: 400 };
    expect(fitWorld(world, view, 'contain', { max: 1 })).toEqual({ zoom: 1, scrollX: -100, scrollY: -150 });
    expect(fitWorld(world, view, 'cover', { max: 3 }).zoom).toBe(3);
    expect(fitWorld(world, { x: 0, y: 0, width: 40, height: 40 }, 'contain', { min: 0.5 }).zoom).toBe(0.5);
  });

  it('survives an empty world', () => {
    expect(
      fitWorld({ x: 0, y: 0, width: 0, height: 0 }, { x: 0, y: 0, width: 100, height: 100 }, 'contain').zoom,
    ).toBe(1);
  });
});
