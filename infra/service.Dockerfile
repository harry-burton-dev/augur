# Builds any service by package name:
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry .
FROM node:22-alpine AS build
ARG PACKAGE
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter "${PACKAGE}..." build && pnpm --filter ${PACKAGE} deploy --prod --legacy /out

# The updater (platform/services/updater) also drives Docker Compose and checks image signatures:
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@augur/updater --target updater .
FROM node:22-alpine AS updater
RUN apk add --no-cache docker-cli docker-cli-compose cosign
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
