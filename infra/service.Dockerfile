# Builds any service by package name:
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry .
FROM node:22-alpine AS build
ARG PACKAGE
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter "${PACKAGE}..." build && pnpm --filter ${PACKAGE} deploy --prod --legacy /out

FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/im-platform"
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
# The image's own unprivileged user: the service only reads its files and talks over the network.
USER node
CMD ["node", "dist/index.js"]
