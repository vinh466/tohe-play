import { queryOptions } from '@tanstack/react-query';
import i18n from '../i18n.ts';
import { sessionEnded, sessionEndedBy } from '../session/ended.ts';
import { funName } from '../session/profileNames.ts';
import { db } from '../storage/db.ts';
import { ensureDeviceProfile, listDeviceProfiles } from '../storage/deviceProfiles.ts';
import { withOfflineCache } from '../storage/repository.ts';
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
 * proxy), the last known session is used so a child can keep playing offline (ADR 0005). An account's session that the
 * API no longer knows — while this device still kept it — has ended, and the app says so (session/ended.ts, ADR 0046).
 */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<MeView | null> => {
    try {
      const me = await fetchMe();
      if (me) {
        await db.cache.put({ key: 'me', value: me, at: Date.now() });
        sessionEnded.clear();
      } else {
        const known = (await db.cache.get('me'))?.value as MeView | undefined;
        if (sessionEndedBy(known, me)) sessionEnded.mark();
        await db.cache.delete('me');
      }
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

/**
 * The device profile playing on this device (ADR 0043) — made silently, with a suggested name, the first time a device
 * plays without an account; `onMade` hears of that first one.
 */
export const deviceProfileQuery = (onMade?: () => void) =>
  queryOptions({
    queryKey: ['device-profile'],
    queryFn: async () => {
      const { profile, made } = await ensureDeviceProfile(db, () => funName(i18n.language));
      if (made) onMade?.();
      return profile;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

/** Every device profile of this device, oldest first. */
export const deviceProfilesQuery = queryOptions({
  queryKey: ['device-profiles'],
  queryFn: () => listDeviceProfiles(db),
  staleTime: Number.POSITIVE_INFINITY,
});
