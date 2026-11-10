# syntax=docker/dockerfile:1
# Builds any service by package name:
#   NODE_AUTH_TOKEN=<read:packages token> docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry .
# An app's service in apps/ can carry its built frontend too, at /app/frontend, to give the registry
# when it starts (service kit's publishFrontend):
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@apps/<id> --build-arg FRONTEND=@apps/<id>-frontend .
#
# Everything up to the build stage's `COPY . .` is the same in infra/web.Dockerfile and comes before any
# build argument, so one builder installs the workspace once and every other image reuses that layer: a
# release builds a dozen images, and each used to install everything again. Keep it identical. The
# install (the deps stage) reads only the workspace's manifests, so it is also kept between runs
# (BUILDX_CACHE in infra/release-images.sh) and reinstalled only when the dependencies change.
FROM node:22-alpine AS manifests
WORKDIR /repo
COPY . .
# Only what pnpm install reads: every package.json, the lockfile, the workspace and .npmrc. The install
# below starts from these alone, so it is cached until the dependencies change, not on every change.
RUN find . -type f ! -name package.json ! -name pnpm-lock.yaml ! -name pnpm-workspace.yaml ! -name .npmrc -delete \
 && find . -mindepth 1 -type d -empty -delete
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY --from=manifests /repo .
# AUGUR's kit packages come from GitHub Packages (.npmrc): a build secret, so the token stays out of the image.
RUN --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN pnpm install --frozen-lockfile
FROM deps AS build
COPY . .
ARG PACKAGE
ARG FRONTEND=""
# pnpm deploy reads the lockfile's packages again, the kit's among them, so it needs the token too.
RUN --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN \
    pnpm --filter "${PACKAGE}..." build && pnpm --filter ${PACKAGE} deploy --prod --legacy /out
RUN if [ -n "$FRONTEND" ]; then \
      pnpm --filter "${FRONTEND}..." build \
      && cp -r "$(pnpm --filter "${FRONTEND}" exec pwd)/dist" /out/frontend; \
    fi

# The updater (platform/services/updater) also drives Docker Compose and checks image signatures:
#   docker build -f infra/service.Dockerfile --build-arg PACKAGE=@augur/updater --target updater .
FROM node:22-alpine AS updater
RUN apk add --no-cache docker-cli docker-cli-compose cosign
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/augur"
LABEL org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"
# A copy of the image carries its licence and the open-source notices (docs/licensing.md).
COPY LICENSE THIRD_PARTY_NOTICES.md /usr/share/augur/
WORKDIR /app
COPY --from=build /out .
# This release's deploy files: the updater of the release before writes them onto the server when it
# upgrades to this one, and this updater compares the server's with them (platform/services/updater).
COPY infra/deploy /augur/deploy
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]

# The registry also checks the release feed's signature with cosign (ADR 0017):
#   NODE_AUTH_TOKEN=<read:packages token> docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry .-target registry .
FROM node:22-alpine AS registry
RUN apk add --no-cache cosign
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/augur"
LABEL org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"
# A copy of the image carries its licence and the open-source notices (docs/licensing.md).
COPY LICENSE THIRD_PARTY_NOTICES.md /usr/share/augur/
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]

# AUGUR's Keycloak (ADR 0041): Keycloak with AUGUR's sign-in and email theme (platform/frontends/sign-in-theme)
# in its providers. The realm job turns the theme on.
#   NODE_AUTH_TOKEN=<read:packages token> docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -f infra/service.Dockerfile --target keycloak .
# Keycloakify packs the theme into a jar with Maven, so this stage alone adds a JDK and Maven.
FROM deps AS sign-in-theme
RUN apk add --no-cache openjdk21-jdk maven
COPY . .
RUN pnpm --filter @augur/sign-in-theme run jar

# The Keycloak AUGUR runs: a Keycloak upgrade is a change to this line (docs/upgrade.md).
FROM quay.io/keycloak/keycloak:26.8.1 AS keycloak
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/augur"
LABEL org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"
COPY --from=sign-in-theme /repo/platform/frontends/sign-in-theme/dist_keycloak/augur-theme.jar /opt/keycloak/providers/augur-theme.jar
# Keycloak's email listener, which the realm job turns on with a relay, emails people when their password,
# code app or passkeys change. Failed sign-ins are left out: they say nothing a person can act on, and an
# attacker could fill someone's inbox with them.
ENV KC_SPI_EVENTS_LISTENER__EMAIL__EXCLUDE_EVENTS=LOGIN_ERROR

# The OpenFGA AUGUR runs (ADR 0085): OpenFGA's own binary, started so that it brings its tables up to date
# first, then serves. One part, so it can't serve before its tables are ready. An OpenFGA upgrade is a change
# to this line (docs/upgrade.md).
FROM openfga/openfga:v1.11.2 AS openfga-upstream
FROM alpine:3.22 AS openfga
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/augur"
LABEL org.opencontainers.image.licenses="Apache-2.0"
COPY --from=openfga-upstream /openfga /usr/local/bin/openfga
COPY --from=openfga-upstream /usr/local/bin/grpc_health_probe /usr/local/bin/grpc_health_probe
USER 65532
ENTRYPOINT ["/bin/sh", "-c", "openfga migrate && exec openfga run"]

# The default target, and so the last stage: a service by package name (the top of this file).
FROM node:22-alpine AS service
LABEL org.opencontainers.image.source="https://github.com/harry-burton-dev/augur"
LABEL org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"
# A copy of the image carries its licence and the open-source notices (docs/licensing.md).
COPY LICENSE THIRD_PARTY_NOTICES.md /usr/share/augur/
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
# A folder the user owns, for a service that keeps a file on a volume of its own (the knowledge graph's
# forget ledger): a new volume takes the folder's owner.
RUN mkdir -p /var/lib/augur/knowledge && chown -R node:node /var/lib/augur
# The image's own unprivileged user: the service only reads its files and talks over the network.
USER node
CMD ["node", "dist/index.js"]

