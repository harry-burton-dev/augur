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
# Where the site is published: its origin (for canonical links and the sitemap) and the path it is served under.
ARG DOCS_SITE_URL=""
ARG DOCS_BASE="/"
ENV DOCS_SITE_URL=$DOCS_SITE_URL DOCS_BASE=$DOCS_BASE
RUN cd docs && pnpm build

# nginx as an unprivileged user, listening on 8080 rather than 80, as the front door does (infra/web.Dockerfile).
FROM nginxinc/nginx-unprivileged:1.30-alpine AS web
USER root
RUN apk upgrade --no-cache
USER 101
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/augur"
LABEL org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"
COPY --from=build /repo/docs/dist /usr/share/nginx/html
EXPOSE 8080
