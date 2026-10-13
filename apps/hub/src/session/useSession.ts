import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { MeView } from '../api/client.ts';
import { meQuery, profileQuery } from '../api/queries.ts';
import { db } from '../storage/db.ts';
import { guestMode, resolveSession, type SessionState } from './session.ts';

/** The session, or `loading` while the first answer is pending. */
export function useSession(): SessionState | { status: 'loading' } {
  const me = useQuery(meQuery);
  const guest = useQuery({ ...profileQuery, enabled: guestMode.enabled() });
  if (me.isPending || (guestMode.enabled() && guest.isPending && !me.data)) return { status: 'loading' };
  return resolveSession(me.data ?? null, guestMode.enabled(), guest.data ?? null);
}

/** Store a new session answer from a mutation, and refresh what depends on the active profile. */
export function useSetMe() {
  const queryClient = useQueryClient();
  return useCallback(
    async (me: MeView | null) => {
      queryClient.setQueryData(meQuery.queryKey, me);
      if (me) await db.cache.put({ key: 'me', value: me, at: Date.now() });
      else await db.cache.delete('me');
      await queryClient.invalidateQueries({ queryKey: ['games'] });
    },
    [queryClient],
  );
}
