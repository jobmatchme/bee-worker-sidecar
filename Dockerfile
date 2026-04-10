# syntax=docker/dockerfile:1.6
FROM node:20-alpine

LABEL org.opencontainers.image.source="https://github.com/jobmatchme/bee-worker-sidecar"

ARG BEE_WORKER_SIDECAR_PACKAGE=@jobmatchme/bee-worker-sidecar

RUN apk add --no-cache \
    ca-certificates \
    tini

RUN addgroup -g 10001 -S app && adduser -S -D -H -u 10001 -G app -h /workspace app

RUN npm install -g --ignore-scripts "${BEE_WORKER_SIDECAR_PACKAGE}"

WORKDIR /workspace
RUN mkdir -p /config && chown -R 10001:10001 /workspace /config

USER 10001:10001

ENV HOME=/workspace
ENV NODE_ENV=production
ENV BEE_WORKER_SIDECAR_CONFIG=/config/config.json
ENV NODE_PATH=/usr/local/lib/node_modules/@jobmatchme/bee-worker-sidecar/node_modules

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bee-worker-sidecar"]
