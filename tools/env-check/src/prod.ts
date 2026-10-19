// Checks production from outside (ADR 0040, ADR 0041). Read-only: GET and HEAD, DNS over HTTPS.
//
//   pnpm check:prod                       # expects the commit of the newest prod- tag
//   pnpm check:prod --expect <ref>        # expects the commit of a tag, branch or sha
//   pnpm check:prod --hub https://… --games https://… --docs https://… --domain example.org --no-dns
//   pnpm check:prod --sending-domain notify.toheplay.io.vn   # where mail is sent from (docs/guides/mail-and-status.md)
import { parseArgs } from 'node:util';
import { scriptArgs } from './args.ts';
import { dohLookup } from './dns.ts';
import { realFetch } from './http.ts';
import { Git } from './proc.ts';
import { checkProd } from './prod-checks.ts';
import { Runner } from './runner.ts';

const { values } = parseArgs({
  args: scriptArgs(),
  options: {
    expect: { type: 'string' },
    hub: { type: 'string', default: 'https://toheplay.io.vn' },
    games: { type: 'string', default: 'https://games.toheplay.io.vn' },
    docs: { type: 'string', default: 'https://docs.toheplay.io.vn' },
    domain: { type: 'string', default: 'toheplay.io.vn' },
    // Production sends from the root until the owner moves mail to notify.toheplay.io.vn; then this default follows.
    'sending-domain': { type: 'string', default: 'toheplay.io.vn' },
    'no-dns': { type: 'boolean', default: false },
  },
});

const runner = new Runner();
try {
  await checkProd(
    {
      hub: values.hub,
      games: values.games,
      docs: values.docs,
      domain: values.domain,
      sendingDomain: values['sending-domain'],
      expect: values.expect,
      dns: !values['no-dns'],
    },
    { http: realFetch, dns: dohLookup(realFetch), git: new Git() },
    runner,
  );
  process.exitCode = runner.finish();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
