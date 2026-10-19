// DNS over HTTPS (Google), behind a small function so tests never touch the network.
import { type Fetcher, getJson } from './http.ts';

export type DnsLookup = (name: string, type: 'TXT' | 'MX') => Promise<string[]>;

const TYPE_CODE = { TXT: 16, MX: 15 } as const;

interface DohAnswer {
  Status: number;
  Answer?: { type: number; data: string }[];
}

/** The record data of `type` for `name`; an empty list when there is none. */
export function dohLookup(http: Fetcher): DnsLookup {
  return async (name, type) => {
    const { json } = await getJson<DohAnswer>(
      http,
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    );
    return (json.Answer ?? [])
      .filter((answer) => answer.type === TYPE_CODE[type])
      .map((answer) => answer.data);
  };
}
