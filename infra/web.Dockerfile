# syntax=docker/dockerfile:1
# The web front door: the shell and the platform's own apps' frontends as static files, with /api sent to the gateway and /sso to Keycloak, so everything is one origin.
#   NODE_AUTH_TOKEN=<read:packages token> docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -f infra/web.Dockerfile .
# Apps the runner installs are served from Garage's frontends bucket, not from this image (ADR 0075).
# Everything up to the build stage's `COPY . .` is the same in infra/service.Dockerfile, so the services'
# images reuse this install (see there). Keep it identical.
FROM node:22-alpine AS manifests
WORKDIR /repo
COPY . .
# Only what pnpm install reads: every package.json, the lockfile, the workspace and .npmrc. The install
# below starts from these alone, so it is cached until the dependencies change, not on every change.
RUN find . -type f ! -name package.json ! -name pnpm-lock.yaml ! -name pnpm-workspace.yaml ! -name .npmrc -delete \
 && find . -mindepth 1 -type d -empty -delete
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY --from=manifests /repo .
# AUGUR's kit packages come from GitHub Packages (.npmrc): a build secret, so the token stays out of the image.
RUN --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN pnpm install --frozen-lockfile
FROM deps AS build
COPY . .
# A path: the shell signs in against Keycloak on whatever address it is served from.
ENV VITE_OIDC_AUTHORITY=/sso/realms/platform
RUN pnpm --filter "@augur/shell..." --filter "@augur/home..." --filter "@augur/admin..." --filter "@augur/upgrades..." build \
 && mkdir -p /site/apps \
 && cp -r platform/frontends/shell/dist/. /site/ \
 && cp -r platform/frontends/home/dist /site/apps/home \
 && cp -r platform/frontends/admin/dist /site/apps/admin \
 && cp -r platform/frontends/upgrades/dist /site/apps/upgrades \
 && mkdir -p /site/legal && cp LICENSE /site/legal/licence.txt && cp THIRD_PARTY_NOTICES.md /site/legal/third-party.txt \
 && mv /site/index.template.html /index.template.html \
 && node scripts/kit.mjs check

# nginx as an unprivileged user, listening on 8080 rather than 80.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS web
# Take Alpine's security fixes that came out after the base image was built (the deploy test's Trivy
# step fails a release on a critical one with a fix), then drop back to nginx's own user.
USER root
RUN apk upgrade --no-cache
USER 101
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/augur"
LABEL org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"
# Other sites apps may load from, space separated; see infra/deploy/nginx.conf.
ENV APP_ORIGINS=""
# Set from SERVER_RING and PLATFORM_URL when the container starts (infra/deploy/live-origins.envsh): the workbench's own tailnet, on the workbench only.
ENV LIVE_ORIGINS="" SERVER_RING=""
COPY --chmod=755 infra/deploy/live-origins.envsh /docker-entrypoint.d/15-live-origins.envsh
# Where apps load the UI kit from (ADR 0048): the bundle in this image at /kit/, unless KIT_URL names
# another host serving the same files. When the container starts, infra/deploy/kit-url.envsh writes the
# shell's page for it, and the hashes and the kit's site the Content Security Policy needs.
ENV KIT_URL=/kit/
# The product's name in the shell's page (its title, and a meta tag the shell reads for the tab), also
# written by kit-url.envsh. A deployment sets its own in ORG_PRODUCT_NAME.
ENV ORG_PRODUCT_NAME=AUGUR
# How focus is drawn (FOCUS_DEPTH: veil, lens or scrim), as the shell's augur-depth meta, also written by
# kit-url.envsh. Empty leaves it to each app.
ENV FOCUS_DEPTH=
COPY --chmod=755 infra/deploy/kit-url.envsh /docker-entrypoint.d/16-kit-url.envsh
# What the front door holds callers to (infra/deploy/nginx.conf). Requests a second from one address,
# and the burst let through at once, for the API and for sign-in; the largest upload in MB; and
# whether Keycloak's own admin console is served (open) or not (anything else).
ENV API_RATE_PER_SECOND=30 API_RATE_BURST=200 SSO_RATE_PER_SECOND=10 SSO_RATE_BURST=50 MAX_UPLOAD_MB=2048 KEYCLOAK_CONSOLE=closed
# nginx fills in ${APP_ORIGINS}, ${LIVE_ORIGINS}, ${KIT_ORIGIN} and ${SCRIPT_HASHES} from the environment when the container starts.
COPY infra/deploy/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /site /usr/share/nginx/html
COPY --from=build /index.template.html /usr/share/nginx/index.template.html
# The shell's page is written from the template at each start, by nginx's own user.
COPY --from=build --chown=101 /site/index.html /usr/share/nginx/html/index.html
