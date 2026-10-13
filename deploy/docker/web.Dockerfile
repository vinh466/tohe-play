# Static web images (hub, site, games), all served by Caddy. Build context: repository root.
#   docker build -f deploy/docker/web.Dockerfile --target hub .
FROM node:26-bookworm-slim AS workspace
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline

FROM workspace AS build-hub
RUN pnpm turbo run build --filter=@tohe/hub

FROM workspace AS build-site
RUN pnpm turbo run build --filter=@tohe/site

FROM workspace AS build-games
RUN pnpm turbo run build --filter=@tohe/games-host

FROM caddy:2-alpine AS hub
COPY deploy/docker/Caddyfile.hub /etc/caddy/Caddyfile
COPY --from=build-hub /repo/apps/hub/dist /srv
EXPOSE 8080

FROM caddy:2-alpine AS site
COPY deploy/docker/Caddyfile.site /etc/caddy/Caddyfile
COPY --from=build-site /repo/apps/site/dist /srv
EXPOSE 8080

FROM caddy:2-alpine AS games
COPY deploy/docker/Caddyfile.games /etc/caddy/Caddyfile
COPY --from=build-games /repo/.out/games-csp.caddy /etc/caddy/games-csp.caddy
COPY --from=build-games /repo/.out/games /srv
EXPOSE 8080
