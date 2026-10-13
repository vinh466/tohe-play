import { queryOptions } from '@tanstack/react-query';
import { db } from '../storage/db.ts';
import { ensureGuestProfile, withOfflineCache } from '../storage/repository.ts';
import { ApiError, fetchConfig, fetchGames, fetchMe, fetchProfileOptions, type MeView } from './client.ts';

export const configQuery = queryOptions({
  queryKey: ['config'],
  queryFn: () => withOfflineCache(db, 'config', fetchConfig),
  staleTime: 60 * 60 * 1000,
});

/** The catalog differs per profile (age filtering happens on the server), so it is cached per profile. */
export const gamesQuery = (profileId: string | null) =>
  queryOptions({
    queryKey: ['games', profileId],
    queryFn: () => withOfflineCache(db, `games:${profileId ?? 'none'}`, fetchGames),
    staleTime: 60 * 1000,
  });

/**
 * The device session. When the API cannot be reached (network down, or the homelab's API down behind the hub's
 * proxy), the last known session is used so a child can keep playing offline (ADR 0005).
 */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<MeView | null> => {
    try {
      const me = await fetchMe();
      if (me) await db.cache.put({ key: 'me', value: me, at: Date.now() });
      else await db.cache.delete('me');
      return me;
    } catch (error) {
      const unreachable = error instanceof TypeError || (error instanceof ApiError && error.status >= 500);
      if (!unreachable) throw error;
      return ((await db.cache.get('me'))?.value as MeView | undefined) ?? null;
    }
  },
  staleTime: 30 * 1000,
});

export const profileOptionsQuery = queryOptions({
  queryKey: ['profile-options'],
  queryFn: () => withOfflineCache(db, 'profile-options', fetchProfileOptions),
  staleTime: Number.POSITIVE_INFINITY,
});

/** The local guest profile used in "Chơi thử" mode. */
export const profileQuery = queryOptions({
  queryKey: ['profile'],
  queryFn: () => ensureGuestProfile(db),
  staleTime: Number.POSITIVE_INFINITY,
});
