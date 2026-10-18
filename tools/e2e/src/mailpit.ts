// The codes the API emails (ADR 0024), read from the local stack's Mailpit (ADR 0022): signing up needs one.

const mailpitUrl = process.env.MAILPIT_URL ?? 'http://localhost:4760';

interface Summary {
  ID: string;
}

/** The code in the newest email to `to`, waiting for the outbox to hand it over (it looks every 3 s). */
export async function codeSentTo(to: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${mailpitUrl}/api/v1/search?limit=1&query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    if (search.ok) {
      const { messages } = (await search.json()) as { messages: Summary[] };
      const newest = messages[0];
      if (newest) {
        const message = (await (await fetch(`${mailpitUrl}/api/v1/message/${newest.ID}`)).json()) as {
          Text: string;
        };
        const code = /\b(\d{3}) (\d{3})\b/.exec(message.Text);
        if (code) return `${code[1]}${code[2]}`;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`no code reached ${to} in Mailpit (${mailpitUrl}) within ${timeoutMs / 1000} s`);
}
