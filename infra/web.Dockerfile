# The web front door: the shell and the apps' frontends as static files, with
# /api sent to the gateway and /sso to Keycloak, so everything is one origin.
#   docker build -f infra/web.Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
# A path: the shell signs in against Keycloak on whatever address it is served from.
ENV VITE_OIDC_AUTHORITY=/sso/realms/platform
RUN pnpm install --frozen-lockfile \
 && pnpm --filter "@augur/shell..." --filter "@augur/home..." --filter "@augur/admin..." build \
 && mkdir -p /site/apps \
 && cp -r platform/frontends/shell/dist/. /site/ \
 && cp -r platform/frontends/home/dist /site/apps/home \
 && cp -r platform/frontends/admin/dist /site/apps/admin \
 && node infra/deploy/csp.mjs /site/index.html infra/deploy/nginx.conf > /default.conf.template

FROM nginx:1.27-alpine AS web
# Other sites apps may load from, space separated; see infra/deploy/nginx.conf.
ENV APP_ORIGINS=""
# nginx fills in ${APP_ORIGINS} from the environment when the container starts.
COPY --from=build /default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /site /usr/share/nginx/html
