// The console lives on a host of its own (ADR 0042): its links back to the hub are absolute, to the hub's public URL
// the API tells (App:PublicUrl). Never a root-relative link to the hub — on this host it would be a 404.
import { useQuery } from '@tanstack/react-query';
import { admin } from './api/client.ts';

/** The hub's address, or null while it loads or when the deployment does not say. */
export function useHubUrl(): string | null {
  const config = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: admin.config,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return config.data?.hubUrl ?? null;
}

/** A page of the hub, e.g. `hubLink(hubUrl, '/account')`. */
export function hubLink(hubUrl: string, path: string): string {
  return `${hubUrl.replace(/\/$/, '')}${path}`;
}
