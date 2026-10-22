import { type QueryClient, queryOptions } from '@tanstack/react-query';
import i18n from '../i18n.ts';
import { sessionEnded } from '../session/ended.ts';
import { createMeWatch, loadMe, type MeDeps } from '../session/loadMe.ts';
import { funName } from '../session/profileNames.ts';
import { db } from '../storage/db.ts';
import { ensureDeviceProfile, listDeviceProfiles } from '../storage/deviceProfiles.ts';
import { withOfflineCache } from '../storage/repository.ts';
import { fetchConfig, fetchGames, fetchMe, fetchProfileOptions, type MeView } from './client.ts';

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
 * The device session. When the API cannot be reached — the network is down, the homelab's API is down behind the hub's
 * proxy, or it did not answer within ME_TIMEOUT_MS — the last known session is used so a child can keep playing offline
 * (ADR 0005) and a cold start on a weak signal is never stuck on "Đang tải…"; the API is asked again in the background.
 * An account's session that the API no longer knows — while this device still kept it — has ended, and the app says so
 * (session/ended.ts, ADR 0046); that needs the API's own answer, never a timeout (session/loadMe.ts).
 */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async ({ client }): Promise<MeView | null> => {
    background = client;
    const answer = await loadMe(meDeps);
    meWatch.answered(answer.confirmed);
    return answer.me;
  },
  // A session that is only the device's copy is stale at once: a returning focus or a network coming back asks again.
  staleTime: () => (meWatch.unconfirmed ? 0 : 30 * 1000),
});

const meDeps: MeDeps = {
  fetchMe,
  known: async () => (await db.cache.get('me'))?.value as MeView | undefined,
  keep: async (me) => void (await db.cache.put({ key: 'me', value: me, at: Date.now() })),
  forget: async () => void (await db.cache.delete('me')),
  ended: sessionEnded,
};

/** The query client that last read the session, for the background ask. */
let background: QueryClient | null = null;
const meWatch = createMeWatch(() => {
  // Offline there is nothing to ask: the network coming back asks (the session is stale by then).
  if (navigator.onLine) void background?.refetchQueries({ queryKey: ['me'] });
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
