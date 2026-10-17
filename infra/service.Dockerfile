# Builds any service: docker build -f infra/service.Dockerfile --build-arg SERVICE=registry .
FROM node:22-alpine AS build
ARG SERVICE
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @im/${SERVICE} build && pnpm --filter @im/${SERVICE} deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
