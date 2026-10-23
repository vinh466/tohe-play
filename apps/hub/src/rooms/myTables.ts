// The tables the player sits at (`GET /api/rooms/mine`), for Trò chơi's first screen and Chơi cùng (ADR 0046). Who
// asks: the account's session, or a device profile that has a copy on the server — one that never reached the server
// sat at no table, so it is not asked for a name only to learn that (ADR 0043).
import { queryOptions, useQuery } from '@tanstack/react-query';
import { rooms } from '../api/client.ts';
import { deviceProfileQuery } from '../api/queries.ts';
import { TERMS_VERSION } from '../legal/documents.ts';
import { tablesStep } from '../session/serverCopy.ts';
import type { Player, SessionState } from '../session/session.ts';
import { actAsDevice } from './devicePlayer.ts';

type PlayingSession = Extract<SessionState, { status: 'device' | 'account' }> & { player: Player };

/** The open tables `playerId` sits at, checked every 20 s while a screen shows them. */
export const myTablesQuery = (playerId: string) =>
  queryOptions({
    queryKey: ['rooms-mine', playerId],
    queryFn: () => rooms.mine(),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

/**
 * Who acts at the tables and on links for this screen: the account's profile, or the device profile with a copy on
 * the server (it acts with the device's key from now on), or null. `waiting` while a device profile is being read.
 */
export function useTablePlayer(session: PlayingSession): { acting: Player | null; waiting: boolean } {
  const device = useQuery({ ...deviceProfileQuery(), enabled: session.status === 'device' });
  if (session.status === 'account') {
    actAsDevice(null);
    return { acting: session.player, waiting: false };
  }
  if (device.data && tablesStep(device.data, TERMS_VERSION) === 'play') {
    actAsDevice(device.data.id);
    return { acting: session.player, waiting: false };
  }
  actAsDevice(null);
  return { acting: null, waiting: device.isPending };
}

/** A table's six digits as people read them out: "482 113" (`GET /api/rooms/mine` gives the code, rooms.md). */
export const tableCode = (code: string): string =>
  /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
