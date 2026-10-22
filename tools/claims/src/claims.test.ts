import { describe, expect, it } from 'vitest';
import { covers, normaliseClaim, outside, touches, touchesBetween, zonesOf } from './claims.ts';

describe('covers', () => {
  it('reads a directory claim as everything under it', () => {
    expect(covers('apps/hub/src/features/', 'apps/hub/src/features/play/Board.tsx')).toBe(true);
    expect(covers('apps/hub/src/features/', 'apps/hub/src/router.tsx')).toBe(false);
  });

  it('reads a plain claim as one file', () => {
    expect(covers('docs/guides/uat.md', 'docs/guides/uat.md')).toBe(true);
    expect(covers('docs/guides/uat.md', 'docs/guides/uat.md.bak')).toBe(false);
  });

  it('matches * inside one segment and ** across segments', () => {
    expect(covers('apps/*/src/api/schema.gen.ts', 'apps/console/src/api/schema.gen.ts')).toBe(true);
    expect(covers('apps/*/src/api/schema.gen.ts', 'apps/hub/x/src/api/schema.gen.ts')).toBe(false);
    expect(covers('games/**/*.test.ts', 'games/merge-block/src/logic/board.test.ts')).toBe(true);
    expect(covers('games/**/*.test.ts', 'games/merge-block/src/logic/board.ts')).toBe(false);
    expect(covers('**/package.json', 'package.json')).toBe(true);
  });

  it('never covers a file with a resource claim', () => {
    expect(covers('@dev-stack', 'docker-compose.yml')).toBe(false);
  });
});

describe('touches', () => {
  it('sees a directory and a path below it', () => {
    expect(touches('apps/hub/', 'apps/hub/src/router.tsx')).toBe(true);
    expect(touches('apps/hub/src/', 'apps/hub/')).toBe(true);
  });

  it('keeps sibling directories and different apps apart', () => {
    expect(touches('apps/hub/src/features/play/', 'apps/hub/src/features/account/')).toBe(false);
    expect(touches('apps/hub/src/features/', 'apps/console/src/')).toBe(false);
    expect(touches('apps/hub/', 'apps/hub-docs/')).toBe(false);
  });

  it('compares patterns segment by segment', () => {
    expect(touches('apps/hub/src/**/*.ts', 'apps/hub/src/router.tsx')).toBe(false);
    expect(touches('apps/hub/src/**/*.ts', 'apps/hub/src/lib/')).toBe(true);
    expect(touches('**/*.ts', '**/*.json')).toBe(false);
    expect(touches('apps/*/src/', 'apps/hub/src/x.ts')).toBe(true);
  });

  it('errs towards touching when two wildcards could meet', () => {
    expect(touches('apps/*/src/', 'apps/h*/src/')).toBe(true);
  });

  it('matches a resource only to itself', () => {
    expect(touches('@dev-stack', '@dev-stack')).toBe(true);
    expect(touches('@dev-stack', 'docker-compose.yml')).toBe(false);
  });
});

describe('hot zones', () => {
  it('puts every package.json in the lockfile zone', () => {
    expect(zonesOf('apps/hub/package.json').map((zone) => zone.name)).toEqual(['the lockfile']);
    expect(zonesOf('apps/hub/').map((zone) => zone.name)).toContain('the lockfile');
    expect(zonesOf('apps/hub/src/features/')).toEqual([]);
  });

  it('makes two workers on different migration files touch', () => {
    const touched = touchesBetween(
      ['services/api/src/Tohe.Api/Infrastructure/Database/Migrations/20261023_AddSeats.cs'],
      ['services/api/src/Tohe.Api/Infrastructure/Database/Migrations/20261023_AddRooms.cs'],
    );
    expect(touched).toEqual([
      {
        mine: 'services/api/src/Tohe.Api/Infrastructure/Database/Migrations/20261023_AddSeats.cs',
        theirs: 'services/api/src/Tohe.Api/Infrastructure/Database/Migrations/20261023_AddRooms.cs',
        zone: 'EF Core migrations',
      },
    ]);
  });

  it('makes two dependency changes in different packages touch through the lockfile', () => {
    expect(touchesBetween(['apps/hub/package.json'], ['tools/e2e/package.json'])[0]?.zone).toBe(
      'the lockfile',
    );
  });

  it('makes a routes map change and a Caddyfile change touch', () => {
    expect(touchesBetween(['packages/routes/src/map.ts'], ['deploy/docker/Caddyfile.hub'])[0]?.zone).toBe(
      'Caddy',
    );
  });

  it('lets narrow claims in different places run side by side', () => {
    expect(
      touchesBetween(['apps/hub/src/features/play/', 'docs/guides/play.md'], ['games/merge-block/src/']),
    ).toEqual([]);
  });

  it('makes two users of the dev stack touch', () => {
    expect(touchesBetween(['@dev-stack', 'tools/e2e/src/rooms/'], ['@dev-stack'])).toEqual([
      { mine: '@dev-stack', theirs: '@dev-stack' },
    ]);
  });
});

describe('normaliseClaim', () => {
  it('drops a leading ./ and keeps the rest', () => {
    expect(normaliseClaim(' ./apps/hub/src/ ')).toBe('apps/hub/src/');
    expect(normaliseClaim('@dev-stack')).toBe('@dev-stack');
  });

  it('refuses claims outside the repository', () => {
    expect(() => normaliseClaim('/etc/passwd')).toThrow();
    expect(() => normaliseClaim('apps/../..')).toThrow();
    expect(() => normaliseClaim('')).toThrow();
    expect(() => normaliseClaim('@Dev Stack')).toThrow();
  });
});

describe('outside', () => {
  it('lists the changed files no claim covers', () => {
    expect(
      outside(
        ['apps/hub/src/features/play/'],
        ['apps/hub/src/features/play/Board.tsx', 'apps/hub/src/router.tsx'],
      ),
    ).toEqual(['apps/hub/src/router.tsx']);
  });
});
