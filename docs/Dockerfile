# syntax=docker/dockerfile:1
# AUGUR's documentation site as static files, served by nginx on 8080. It builds from the repo root, because the
# build reads the OpenAPI files in contracts/ and the JSON schemas under platform/ as well as docs/:
#   docker build -f docs/Dockerfile --build-arg DOCS_SITE_URL=https://docs.example.org .
# The site is its own pnpm root (docs/pnpm-workspace.yaml) with public packages only, so no token is needed.
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
# The root package.json only for its packageManager, so corepack uses the same pnpm as the rest of AUGUR.
COPY package.json ./
COPY docs/package.json docs/pnpm-lock.yaml docs/pnpm-workspace.yaml docs/
RUN cd docs && pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Where the site is published: its origin (for canonical links and the sitemap) and the path it is served under,
# which starts and ends with a slash. The image has no git history (.dockerignore), so pages show no
# "Last updated" date.
ARG DOCS_SITE_URL=""
ARG DOCS_BASE="/"
ENV DOCS_SITE_URL=$DOCS_SITE_URL DOCS_BASE=$DOCS_BASE
RUN case "$DOCS_BASE" in /*/|/) ;; *) echo "DOCS_BASE must start and end with /, not '$DOCS_BASE'" >&2; exit 1 ;; esac \
 && cd docs && pnpm build

# nginx as an unprivileged user, listening on 8080 rather than 80, as the front door does (infra/web.Dockerfile).
FROM nginxinc/nginx-unprivileged:1.30-alpine AS web
# Take Alpine's security fixes that came out after the base image was built, then drop back to nginx's own user.
USER root
RUN apk upgrade --no-cache
USER 101
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/augur"
LABEL org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"
ARG DOCS_BASE="/"
ENV DOCS_BASE=$DOCS_BASE
COPY docs/nginx.conf /etc/nginx/templates/default.conf.template
# Served under the same path it was built for, so its links and assets are found without a proxy rewriting them.
COPY --from=build /repo/docs/dist /usr/share/nginx/html${DOCS_BASE}
EXPOSE 8080
