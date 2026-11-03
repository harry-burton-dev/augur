# The web front door: the shell and the apps' frontends (the platform's own, and the apps that ship
# with AUGUR) as static files, with /api sent to the gateway and /sso to Keycloak, so everything is one origin.
#   docker build -f infra/web.Dockerfile .
# The shipped apps' frontends come from their releases (ADR 0049): infra/release-images.sh puts each in
# .shipped/frontends/<id> first. Without that folder the image has the platform's own frontends only.
# The first five lines are the same in infra/service.Dockerfile, so the services' images reuse this
# install (see there). Keep them identical.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# A path: the shell signs in against Keycloak on whatever address it is served from.
ENV VITE_OIDC_AUTHORITY=/sso/realms/platform
RUN pnpm --filter "@augur/shell..." --filter "@augur/home..." --filter "@augur/admin..." --filter "@augur/upgrades..." build \
 && mkdir -p /site/apps \
 && cp -r platform/frontends/shell/dist/. /site/ \
 && cp -r platform/frontends/home/dist /site/apps/home \
 && cp -r platform/frontends/admin/dist /site/apps/admin \
 && cp -r platform/frontends/upgrades/dist /site/apps/upgrades \
 && if [ -d .shipped/frontends ]; then cp -r .shipped/frontends/. /site/apps/; fi \
 && node infra/deploy/csp.mjs /site/index.html infra/deploy/nginx.conf > /default.conf.template

# nginx as an unprivileged user, listening on 8080 rather than 80.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS web
# Take Alpine's security fixes that came out after the base image was built (the deploy test's Trivy
# step fails a release on a critical one with a fix), then drop back to nginx's own user.
USER root
RUN apk upgrade --no-cache
USER 101
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/im-platform"
# Other sites apps may load from, space separated; see infra/deploy/nginx.conf.
ENV APP_ORIGINS=""
# Set from SERVER_RING and PLATFORM_URL when the container starts (infra/deploy/live-origins.envsh): the workbench's own tailnet, on the workbench only.
ENV LIVE_ORIGINS="" SERVER_RING=""
COPY --chmod=755 infra/deploy/live-origins.envsh /docker-entrypoint.d/15-live-origins.envsh
# What the front door holds callers to (infra/deploy/nginx.conf). Requests a second from one address,
# and the burst let through at once, for the API and for sign-in; the largest upload in MB; and
# whether Keycloak's own admin console is served (open) or not (anything else).
ENV API_RATE_PER_SECOND=30 API_RATE_BURST=200 SSO_RATE_PER_SECOND=10 SSO_RATE_BURST=50 MAX_UPLOAD_MB=2048 KEYCLOAK_CONSOLE=closed
# nginx fills in ${APP_ORIGINS} and ${LIVE_ORIGINS} from the environment when the container starts.
COPY --from=build /default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /site /usr/share/nginx/html
