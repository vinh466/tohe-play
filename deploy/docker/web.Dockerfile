# Static web images (hub, docs, games), all served by Caddy. Build context: repository root.
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
# The console (ADR 0027) ships in the hub's image, served by its Caddy on a second site, the console's host (ADR 0042).
RUN pnpm turbo run build --filter=@tohe/hub --filter=@tohe/console

FROM workspace AS build-web
# The public pages (apps/web) ship in the hub's image too, served by its Caddy at the root of the hub's host
# (ADR 0042). One image for every environment (ADR 0021): the hub's own URL (canonical and Open Graph links) and the
# docs host's URL (the links to the developer docs) are built as placeholders and turned into template actions that
# the hub's Caddy fills in from TOHE_HUB_URL and TOHE_DOCS_URL at run time (Caddyfile.hub). Caddy only templates HTML,
# XML and text, so the build fails if a placeholder lands anywhere else. "Chơi ngay" needs nothing here: it links to /play.
ENV TOHE_HUB_URL=https://tohe-hub.invalid TOHE_DOCS_URL=https://tohe-docs.invalid
RUN pnpm turbo run build --filter=@tohe/web \
 && cd apps/web/dist \
 && find . -type f -name '*.html' \
      -exec sed -i -e 's#https://tohe-hub\.invalid#[[[env "TOHE_HUB_URL"]]]#g' -e 's#https://tohe-docs\.invalid#[[[env "TOHE_DOCS_URL"]]]#g' {} + \
 && if grep -rlE 'tohe-(hub|docs)\.invalid' .; then echo 'URL placeholder left outside HTML' >&2; exit 1; fi

FROM workspace AS build-docs
# One image for every environment (ADR 0021). The docs' own URL (canonical links, sitemap, llms.txt) is built as a
# placeholder and turned into a template action that the docs' Caddy fills in from TOHE_DOCS_URL at run time
# (Caddyfile.docs). Caddy only templates HTML, XML and text, so the build fails if the placeholder lands anywhere else.
# /play on the docs host is a run-time redirect to PUBLIC_HUB_URL.
ENV TOHE_DOCS_URL=https://tohe-docs.invalid
RUN pnpm turbo run build --filter=@tohe/docs \
 && cd apps/docs/dist \
 && find . -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' \) \
      -exec sed -i 's#https://tohe-docs\.invalid#[[[env "TOHE_DOCS_URL"]]]#g' {} + \
 && if grep -rl 'tohe-docs\.invalid' .; then echo 'docs URL placeholder left outside HTML, XML or text' >&2; exit 1; fi

FROM workspace AS build-games
RUN pnpm turbo run build --filter=@tohe/games-host

FROM caddy:2-alpine AS hub
COPY deploy/docker/Caddyfile.hub /etc/caddy/Caddyfile
# The namespaces of the hub's host and the console's, and the sitemap, generated from @tohe/routes and committed
# (ADR 0042); Caddyfile.hub imports them.
COPY deploy/docker/hub-routes.caddy /etc/caddy/hub-routes.caddy
COPY deploy/docker/console-routes.caddy /etc/caddy/console-routes.caddy
COPY deploy/docker/hub-sitemap.caddy /etc/caddy/hub-sitemap.caddy
COPY --from=build-hub /repo/apps/hub/dist /srv
COPY --from=build-hub /repo/apps/console/dist /srv/console
# The public pages, in a folder of their own: their index.html is not the app's.
COPY --from=build-web /repo/apps/web/dist /srv/web
# 8080 the hub, 8081 the console.
EXPOSE 8080 8081

FROM caddy:2-alpine AS docs
COPY deploy/docker/Caddyfile.docs /etc/caddy/Caddyfile
COPY --from=build-docs /repo/apps/docs/dist /srv
EXPOSE 8080

FROM caddy:2-alpine AS games
COPY deploy/docker/Caddyfile.games /etc/caddy/Caddyfile
COPY --from=build-games /repo/.out/games-csp.caddy /etc/caddy/games-csp.caddy
COPY --from=build-games /repo/.out/games /srv
EXPOSE 8080
