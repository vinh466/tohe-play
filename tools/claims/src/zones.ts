// Hot zones: files that collide even when two workers change different ones, because they are regenerated together,
// ordered, or shared. Two workers whose claims reach the same zone run one after another.
export interface HotZone {
  name: string;
  claims: string[];
}

export const HOT_ZONES: HotZone[] = [
  { name: 'EF Core migrations', claims: ['services/api/src/Tohe.Api/Infrastructure/Database/Migrations/'] },
  {
    name: 'generated files',
    claims: ['packages/contract/schema/', 'services/api/openapi/', 'apps/*/src/api/schema.gen.ts'],
  },
  { name: "the hub's router", claims: ['apps/hub/src/router.tsx'] },
  {
    name: 'Caddy',
    claims: [
      'packages/routes/',
      'deploy/docker/Caddyfile.*',
      'deploy/docker/*.caddy',
      'deploy/helm/tohe/templates/_caddy.tpl',
    ],
  },
  // Any package.json change rewrites pnpm-lock.yaml. The packages are where pnpm-workspace.yaml puts them.
  {
    name: 'the lockfile',
    claims: [
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'package.json',
      'apps/*/package.json',
      'packages/*/package.json',
      'games/*/package.json',
      'tools/*/package.json',
      'services/*/package.json',
    ],
  },
  // One dev stack (ports 47xx, compose project `tohe`): e2e suites and `docker compose` share it.
  { name: 'the dev stack', claims: ['@dev-stack'] },
];
