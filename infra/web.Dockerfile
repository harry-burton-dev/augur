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
 && pnpm --filter "@platform/shell..." --filter "@platform/home..." build \
 && mkdir -p /site/apps \
 && cp -r platform/frontends/shell/dist/. /site/ \
 && cp -r platform/frontends/home/dist /site/apps/home

FROM nginx:1.27-alpine AS web
COPY infra/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
