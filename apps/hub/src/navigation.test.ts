import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createTrail } from './navigation/trail.ts';

describe('the trail of pages behind the current one', () => {
  it('finds the catalog behind a game, so leaving goes back instead of stacking it again', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const trail = createTrail(history);
    history.push('/play/tien-len');
    expect(trail.stepsBackTo('/')).toBe(1);
    // Chơi online → the lobby: the game is one step back, the catalog two.
    history.push('/rooms/tien-len');
    expect(trail.stepsBackTo('/play/tien-len')).toBe(1);
    expect(trail.stepsBackTo('/')).toBe(2);
    history.push('/room/abc');
    expect(trail.stepsBackTo('/rooms/tien-len')).toBe(1);
    // Not behind: the caller goes there in place of this page.
    expect(trail.stepsBackTo('/data')).toBe(0);
    trail.stop();
  });

  it('follows going back and replacing', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const trail = createTrail(history);
    history.push('/profiles');
    history.push('/account');
    history.back();
    expect(history.location.pathname).toBe('/profiles');
    expect(trail.stepsBackTo('/')).toBe(1);
    history.replace('/data');
    expect(trail.stepsBackTo('/')).toBe(1);
    // A page pushed after going back takes the place of the one left.
    history.push('/play/hello');
    expect(trail.stepsBackTo('/data')).toBe(1);
    expect(trail.stepsBackTo('/account')).toBe(0);
    trail.stop();
  });

  it('does not skip over pages it never saw (opened from a link, or after a reload)', () => {
    const history = createMemoryHistory({ initialEntries: ['/', '/play/hello'], initialIndex: 1 });
    const trail = createTrail(history);
    expect(trail.stepsBackTo('/')).toBe(0);
    history.push('/data');
    expect(trail.stepsBackTo('/play/hello')).toBe(1);
    expect(trail.stepsBackTo('/')).toBe(0);
    trail.stop();
  });
});
