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
 && pnpm --filter "@platform/shell..." --filter "@platform/home..." --filter "@platform/admin..." --filter "./apps/sample-*/frontend..." build \
 && mkdir -p /site/apps \
 && cp -r platform/frontends/shell/dist/. /site/ \
 && cp -r platform/frontends/home/dist /site/apps/home \
 && cp -r platform/frontends/admin/dist /site/apps/admin \
 && cp -r apps/sample-board/frontend/dist /site/apps/sample-board \
 && cp -r apps/sample-palette/frontend/dist /site/apps/sample-palette

# Registers the frontend-only sample apps with the registry, then exits.
FROM node:22-alpine AS register
WORKDIR /repo
COPY scripts/register-app.mjs scripts/
COPY apps/sample-board/manifest.json apps/sample-board/
COPY apps/sample-palette/manifest.json apps/sample-palette/
CMD ["node", "scripts/register-app.mjs", "apps/sample-board/manifest.json", "apps/sample-palette/manifest.json"]

FROM nginx:1.27-alpine AS web
COPY infra/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
