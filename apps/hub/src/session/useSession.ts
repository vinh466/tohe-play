import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { MeView } from '../api/client.ts';
import { deviceProfileQuery, meQuery } from '../api/queries.ts';
import { db } from '../storage/db.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { sessionEnded } from './ended.ts';
import { deviceMode, resolveSession, type SessionState } from './session.ts';

/** The session, or `loading` while the first answer is pending. */
export function useSession(): SessionState | { status: 'loading' } {
  const me = useQuery(meQuery);
  // The flag is read live: a visitor entering by themselves changes the session without a navigation.
  const asDevice = useSyncExternalStore(deviceMode.subscribe, deviceMode.enabled);
  // A device's first device profile is its first step in the newcomer funnel (`guest-start`, kept from guest mode).
  const device = useQuery({ ...deviceProfileQuery(() => funnel.guestStart()), enabled: asDevice });
  if (me.isPending || (asDevice && device.isPending && !me.data)) return { status: 'loading' };
  return resolveSession(me.data ?? null, asDevice, device.data ?? null);
}

/** Store a new session answer from a mutation, and refresh what depends on the active profile. */
export function useSetMe() {
  const queryClient = useQueryClient();
  return useCallback(
    async (me: MeView | null) => {
      queryClient.setQueryData(meQuery.queryKey, me);
      if (me) {
        await db.cache.put({ key: 'me', value: me, at: Date.now() });
        sessionEnded.clear();
      } else await db.cache.delete('me');
      await queryClient.invalidateQueries({ queryKey: ['games'] });
    },
    [queryClient],
  );
}

/** After a device profile was made, switched, renamed, deleted or brought into an account. */
export function useDeviceProfilesChanged() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['device-profile'] });
    await queryClient.invalidateQueries({ queryKey: ['device-profiles'] });
  }, [queryClient]);
}
