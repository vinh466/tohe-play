# Static web images (hub, site, games), all served by Caddy. Build context: repository root.
#   docker build -f deploy/docker/web.Dockerfile --target hub .
FROM node:26-bookworm-slim AS workspace
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Install exactly the pnpm pinned in package.json -> packageManager. Not via corepack: Node 25+ no longer ships it.
RUN npm install --global --no-fund --no-audit "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline

FROM workspace AS build-hub
# The admin console (ADR 0027) ships in the hub's image, served at /admin/.
RUN pnpm turbo run build --filter=@tohe/hub --filter=@tohe/admin

FROM workspace AS build-site
# One image for every environment (ADR 0021). The site's own URL (canonical links, sitemap, llms.txt) is built as a
# placeholder and turned into a template action that the site's Caddy fills in from TOHE_SITE_URL at run time
# (Caddyfile.site). Caddy only templates HTML, XML and text, so the build fails if the placeholder lands anywhere else.
# The play button needs nothing here: /play is a run-time redirect to PUBLIC_HUB_URL.
ENV TOHE_SITE_URL=https://tohe-site.invalid
RUN pnpm turbo run build --filter=@tohe/site \
 && cd apps/site/dist \
 && find . -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' \) \
      -exec sed -i 's#https://tohe-site\.invalid#[[[env "TOHE_SITE_URL"]]]#g' {} + \
 && if grep -rl 'tohe-site\.invalid' .; then echo 'site URL placeholder left outside HTML, XML or text' >&2; exit 1; fi

FROM workspace AS build-games
RUN pnpm turbo run build --filter=@tohe/games-host

FROM caddy:2-alpine AS hub
COPY deploy/docker/Caddyfile.hub /etc/caddy/Caddyfile
COPY --from=build-hub /repo/apps/hub/dist /srv
COPY --from=build-hub /repo/apps/admin/dist /srv/admin
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
