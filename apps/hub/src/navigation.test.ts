import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createTrail } from './navigation/trail.ts';

describe('the trail of pages behind the current one', () => {
  it('finds the catalog behind a game, so leaving goes back instead of stacking it again', () => {
    const history = createMemoryHistory({ initialEntries: ['/play'] });
    const trail = createTrail(history);
    history.push('/play/tien-len');
    expect(trail.stepsBackTo('/play')).toBe(1);
    // Chơi online → the lobby: the game is one step back, the catalog two.
    history.push('/play/tien-len/rooms');
    expect(trail.stepsBackTo('/play/tien-len')).toBe(1);
    expect(trail.stepsBackTo('/play')).toBe(2);
    history.push('/play/tien-len/rooms/abc');
    expect(trail.stepsBackTo('/play/tien-len/rooms')).toBe(1);
    // Not behind: the caller goes there in place of this page.
    expect(trail.stepsBackTo('/account/data')).toBe(0);
    trail.stop();
  });

  it('follows going back and replacing', () => {
    const history = createMemoryHistory({ initialEntries: ['/play'] });
    const trail = createTrail(history);
    history.push('/account/profiles');
    history.push('/account');
    history.back();
    expect(history.location.pathname).toBe('/account/profiles');
    expect(trail.stepsBackTo('/play')).toBe(1);
    history.replace('/account/data');
    expect(trail.stepsBackTo('/play')).toBe(1);
    // A page pushed after going back takes the place of the one left.
    history.push('/play/hello');
    expect(trail.stepsBackTo('/account/data')).toBe(1);
    expect(trail.stepsBackTo('/account')).toBe(0);
    trail.stop();
  });

  it('knows the app’s level put behind a game the app was opened at, so leaving the game goes back to it', () => {
    // main.tsx: /play/hello opened straight became [/play, /play/hello] before the router started.
    const history = createMemoryHistory({ initialEntries: ['/play', '/play/hello'], initialIndex: 1 });
    const trail = createTrail(history, { 0: '/play' });
    expect(trail.stepsBackTo('/play')).toBe(1);
    expect(trail.previous()).toBe('/play');
    trail.stop();
  });

  it('names the page right behind this one, when it saw it', () => {
    const history = createMemoryHistory({ initialEntries: ['/account/profiles'] });
    const trail = createTrail(history);
    expect(trail.previous()).toBeUndefined();
    history.push('/account?manage=true');
    expect(trail.previous()).toBe('/account/profiles');
    trail.stop();
  });

  it('does not skip over pages it never saw (opened from a link, or after a reload)', () => {
    const history = createMemoryHistory({ initialEntries: ['/play', '/play/hello'], initialIndex: 1 });
    const trail = createTrail(history);
    expect(trail.stepsBackTo('/play')).toBe(0);
    history.push('/account/data');
    expect(trail.stepsBackTo('/play/hello')).toBe(1);
    expect(trail.stepsBackTo('/play')).toBe(0);
    trail.stop();
  });
});
