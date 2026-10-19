// The HTTP the checks need, behind a small function so tests never touch the network. GET and HEAD only.

export interface HttpResult {
  status: number;
  /** Header names in lower case. */
  headers: Record<string, string>;
  body: string;
}

export interface HttpInit {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
}

export type Fetcher = (url: string, init?: HttpInit) => Promise<HttpResult>;

/** Node's fetch without following redirects, so a redirect is seen as it is. */
export const realFetch: Fetcher = async (url, init = {}) => {
  const method = init.method ?? 'GET';
  const response = await fetch(url, {
    method,
    headers: init.headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  }).catch((error: unknown) => {
    // Node's "fetch failed" hides the reason in `cause`: a DNS name that does not resolve, a refused connection.
    const cause = error instanceof Error ? error.cause : undefined;
    const why = cause instanceof Error ? ((cause as { code?: string }).code ?? cause.message) : String(error);
    throw new Error(`${url} did not answer (${why})`);
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });
  return { status: response.status, headers, body: method === 'HEAD' ? '' : await response.text() };
};

/** GET `url` and parse its body as JSON. */
export async function getJson<T>(
  http: Fetcher,
  url: string,
  headers?: Record<string, string>,
): Promise<{ status: number; json: T }> {
  const result = await http(url, { headers });
  try {
    return { status: result.status, json: JSON.parse(result.body) as T };
  } catch {
    throw new Error(`${url} answered ${result.status} and not JSON`);
  }
}
