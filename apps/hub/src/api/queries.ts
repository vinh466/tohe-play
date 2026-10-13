import { queryOptions } from '@tanstack/react-query';
import { db } from '../storage/db.ts';
import { ensureGuestProfile, withOfflineCache } from '../storage/repository.ts';
import { fetchConfig, fetchGames } from './client.ts';

export const configQuery = queryOptions({
  queryKey: ['config'],
  queryFn: () => withOfflineCache(db, 'config', fetchConfig),
  staleTime: 60 * 60 * 1000,
});

export const gamesQuery = queryOptions({
  queryKey: ['games'],
  queryFn: () => withOfflineCache(db, 'games', fetchGames),
  staleTime: 60 * 1000,
});

export const profileQuery = queryOptions({
  queryKey: ['profile'],
  queryFn: () => ensureGuestProfile(db),
  staleTime: Number.POSITIVE_INFINITY,
});
