# Builds any service by package name:
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@platform/registry .
FROM node:22-alpine AS build
ARG PACKAGE
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter ${PACKAGE} build && pnpm --filter ${PACKAGE} deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
