# Builds any service by package name:
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry .
# An app's service can carry its built frontend too, at /app/frontend, to give the registry
# when it starts (service kit's publishFrontend):
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@apps/folio --build-arg FRONTEND=@apps/folio-frontend .
FROM node:22-alpine AS build
ARG PACKAGE
ARG FRONTEND=""
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter "${PACKAGE}..." build && pnpm --filter ${PACKAGE} deploy --prod --legacy /out
RUN if [ -n "$FRONTEND" ]; then \
      pnpm --filter "${FRONTEND}..." build \
      && cp -r "$(pnpm --filter "${FRONTEND}" exec pwd)/dist" /out/frontend; \
    fi

# The updater (platform/services/updater) also drives Docker Compose and checks image signatures:
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@augur/updater --target updater .
FROM node:22-alpine AS updater
RUN apk add --no-cache docker-cli docker-cli-compose cosign
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/im-platform"
WORKDIR /app
COPY --from=build /out .
# This release's deploy files: the updater of the release before writes them onto the server when it
# upgrades to this one, and this updater compares the server's with them (platform/services/updater).
COPY infra/deploy /augur/deploy
# Which repositories publish the apps that live in their own (ADR 0047): the runner trusts each for its app.
COPY release/app-repos.json /augur/app-repos.json
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]

# The registry also checks the release feed's signature with cosign (ADR 0017):
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry --target registry .
FROM node:22-alpine AS registry
RUN apk add --no-cache cosign
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/im-platform"
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]

FROM node:22-alpine AS service
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/im-platform"
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
# The image's own unprivileged user: the service only reads its files and talks over the network.
USER node
CMD ["node", "dist/index.js"]
