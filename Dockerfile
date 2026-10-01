# syntax=docker/dockerfile:1.6
FROM node:22.19.0-alpine3.22 AS build

WORKDIR /build

COPY package.json package-lock.json ./
RUN HUSKY=0 npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22.19.0-alpine3.22

ARG OCI_SOURCE=https://gitlab.com/jobmatchme/cf/bee-worker-sidecar
ARG OCI_REVISION=""
LABEL org.opencontainers.image.source="${OCI_SOURCE}" \
      org.opencontainers.image.revision="${OCI_REVISION}"

RUN apk add --no-cache \
    ca-certificates \
    tini \
 && addgroup -g 10001 -S app \
 && adduser -S -D -H -u 10001 -G app -h /workspace app

WORKDIR /app
COPY --from=build --chown=10001:10001 /build/package.json /build/package-lock.json ./
COPY --from=build --chown=10001:10001 /build/dist ./dist
COPY --from=build --chown=10001:10001 /build/node_modules ./node_modules
RUN ln -s /app/dist/main.js /usr/local/bin/bee-worker-sidecar \
 && mkdir -p /workspace /config \
 && chown -R 10001:10001 /workspace /config

USER 10001:10001
WORKDIR /workspace

ENV HOME=/workspace
ENV NODE_ENV=production
ENV BEE_WORKER_SIDECAR_CONFIG=/config/config.json

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bee-worker-sidecar"]
