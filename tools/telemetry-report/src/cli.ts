// Prints the telemetry report (ADR 0015) as Markdown, or JSON with --json.
//
//   pnpm --filter @tohe/telemetry-report report                    # dev stack (http://localhost:4720)
//   pnpm --filter @tohe/telemetry-report report -- --env uat       # UAT, token from ~/.config/tohe-uat/uat.env
//   pnpm --filter @tohe/telemetry-report report -- --days 30 --json
//
// It only reads the report endpoint through the hub's /api: never the database (docs/guides/uat.md).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { renderMarkdown, type TelemetryReport } from './render.ts';

// `pnpm … report -- --env uat` hands the `--` on to the script; options come after it.
const argv = process.argv.slice(2);
const { values } = parseArgs({
  args: argv[0] === '--' ? argv.slice(1) : argv,
  options: {
    env: { type: 'string', default: 'dev' },
    days: { type: 'string', default: '7' },
    json: { type: 'boolean', default: false },
    headless: { type: 'boolean', default: false },
    url: { type: 'string' },
    token: { type: 'string' },
  },
});

/** KEY=value lines of an env file. */
function readEnv(path: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map((match) => [match[1] as string, match[2] as string]),
    );
  } catch {
    return {};
  }
}

function target(): { url: string; token: string } {
  if (values.env === 'uat') {
    const env = readEnv(process.env.TOHE_UAT_ENV ?? join(homedir(), '.config/tohe-uat/uat.env'));
    return {
      url: values.url ?? `http://${env.TOHE_UAT_HOST ?? '10.100.0.2'}:4820`,
      token: values.token ?? process.env.TOHE_TELEMETRY_TOKEN ?? env.TOHE_UAT_TELEMETRY_TOKEN ?? '',
    };
  }
  return {
    url: values.url ?? `http://${process.env.TOHE_PUBLIC_HOST ?? 'localhost'}:4720`,
    // The development token from compose.yaml and appsettings.Development.json; local containers only.
    token: values.token ?? process.env.TOHE_TELEMETRY_TOKEN ?? 'tohe-dev-only',
  };
}

const { url, token } = target();
if (!token) {
  console.error('No operator token: set TOHE_TELEMETRY_TOKEN, or deploy UAT once so uat.env has one.');
  process.exit(2);
}

const query = new URLSearchParams({ days: values.days ?? '7', includeHeadless: String(values.headless) });
const response = await fetch(`${url}/api/telemetry/report?${query}`, {
  headers: { 'X-Tohe-Operator': token },
});
if (!response.ok) {
  console.error(`${url} answered ${response.status}: ${await response.text()}`);
  process.exit(1);
}
const report = (await response.json()) as TelemetryReport;
console.log(values.json ? JSON.stringify(report, null, 2) : renderMarkdown(report));
