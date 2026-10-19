// What `apiVersion` in GET /api/config says for a commit in each environment, and how migrations are named.

/** UAT: the first 12 characters of the commit (`deploy/uat/deploy.sh`). */
export function uatVersion(commit: string): string {
  return commit.slice(0, 12);
}

/** Production: `sha-` and the full commit, the tag of the images CI publishes (ADR 0021). */
export function prodVersion(commit: string): string {
  return `sha-${commit}`;
}

/** Migrations are named `<14 digits>_<Name>.cs`; the id EF records is the name without `.cs`. */
const MIGRATION_FILE = /(?:^|\/)(\d{14}_[A-Za-z0-9]+)\.cs$/;

/** The newest migration id among file paths (the `.Designer.cs` and snapshot files do not match), or null. */
export function newestMigration(paths: string[]): string | null {
  const ids = paths
    .map((path) => MIGRATION_FILE.exec(path)?.[1])
    .filter((id): id is string => id !== undefined);
  return ids.sort().at(-1) ?? null;
}
