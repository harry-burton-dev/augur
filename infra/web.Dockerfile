# The web front door: the shell and the apps' frontends (the platform's own, and the apps that ship
# with AUGUR) as static files, with /api sent to the gateway and /sso to Keycloak, so everything is one origin.
#   docker build -f infra/web.Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
# A path: the shell signs in against Keycloak on whatever address it is served from.
ENV VITE_OIDC_AUTHORITY=/sso/realms/platform
RUN pnpm install --frozen-lockfile \
 && pnpm --filter "@augur/shell..." --filter "@augur/home..." --filter "@augur/admin..." --filter "@apps/folio-frontend..." --filter "@apps/auspex-frontend..." build \
 && mkdir -p /site/apps \
 && cp -r platform/frontends/shell/dist/. /site/ \
 && cp -r platform/frontends/home/dist /site/apps/home \
 && cp -r platform/frontends/admin/dist /site/apps/admin \
 && cp -r apps/folio/frontend/dist /site/apps/folio \
 && cp -r apps/auspex/frontend/dist /site/apps/auspex \
 && node infra/deploy/csp.mjs /site/index.html infra/deploy/nginx.conf > /default.conf.template

# nginx as an unprivileged user, listening on 8080 rather than 80.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS web
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/im-platform"
# Other sites apps may load from, space separated; see infra/deploy/nginx.conf.
ENV APP_ORIGINS=""
# What the front door holds callers to (infra/deploy/nginx.conf). Requests a second from one address,
# and the burst let through at once, for the API and for sign-in; the largest upload in MB; and
# whether Keycloak's own admin console is served (open) or not (anything else).
ENV API_RATE_PER_SECOND=30 API_RATE_BURST=200 SSO_RATE_PER_SECOND=10 SSO_RATE_BURST=50 MAX_UPLOAD_MB=2048 KEYCLOAK_CONSOLE=closed
# nginx fills in ${APP_ORIGINS} from the environment when the container starts.
COPY --from=build /default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /site /usr/share/nginx/html
