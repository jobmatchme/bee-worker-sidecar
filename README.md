# `@jobmatchme/bee-worker-sidecar`

`bee-worker-sidecar` bridges Bee Dance speaking workers on a local Unix socket to
Bee Dance subjects on NATS.

It is designed for deployments where the actual agent process should stay small
and local to the pod, while the surrounding system communicates over NATS. The
sidecar does not implement agent behavior itself. It only adapts transports.

## What this package does

- subscribes to Bee Dance protocol and command subjects on NATS
- forwards Bee Dance envelopes to a local worker socket using framed JSON
- forwards worker event envelopes back to NATS session event subjects
- keeps reconnecting until the worker socket becomes available
- keeps the public Bee Dance transport separate from the worker runtime

## Design intent

This package exists for the common case where an agent can speak Bee Dance, but
should not know about NATS directly.

That split has a few practical benefits:

- the worker can focus on local execution and protocol semantics
- the sidecar can own NATS connection management and subject routing
- deployments can keep the familiar two-container pod shape
- later agents that speak Bee Dance natively over NATS can skip the sidecar
  without changing Bee-facing clients

## Wire model

The sidecar expects the following NATS subjects for a worker subject root such as
`bee.agent.pi.default`:

- `bee.agent.pi.default.protocol`
- `bee.agent.pi.default.command`
- `bee.agent.pi.default.session.<sessionId>.event`

On the local socket, the sidecar exchanges framed Bee Dance envelopes with the
worker. A `protocol.hello` received on NATS is forwarded to the worker socket
and the resulting `protocol.welcome` is sent back over the NATS reply subject.
Command envelopes are forwarded one-way, while worker event envelopes are
published to the session event subject.

## Configuration

The process reads its configuration from `BEE_WORKER_SIDECAR_CONFIG`.

Example:

```json
{
  "nats": {
    "servers": "nats://nats:4222",
    "name": "bee-worker-sidecar"
  },
  "workerSubject": "bee.agent.pi.default",
  "worker": {
    "socketPath": "/var/run/bee/worker.sock",
    "requestTimeoutMs": 10000,
    "connectRetryMs": 250,
    "maxConnectRetryMs": 5000
  }
}
```

## Publishing

GitLab is the canonical source and the only producer of new deployment
artifacts. The public npm package stopped at version `0.1.3`; it remains
available for compatibility, but no new npm versions are published.

Every successful default-branch pipeline publishes one immutable image:

```text
registry.gitlab.com/jobmatchme/cf/bee-worker-sidecar:sha-<8-character-commit>
```

The image is built directly from the checked-out source commit. GitLab does not
publish or promise `latest` or semantic-version image tags. Repeated pipelines
reuse an existing SHA tag only when its
`org.opencontainers.image.revision` label matches the full commit SHA.

## Container image

A multi-stage Dockerfile builds the runtime directly from the source checkout.
Build it locally with:

```bash
docker build -t bee-worker-sidecar:local .
```

Run it with a mounted config file:

```bash
docker run --rm \
  -v "$(pwd)/config.json:/config/config.json:ro" \
  bee-worker-sidecar:local
```

The container entrypoint expects `BEE_WORKER_SIDECAR_CONFIG=/config/config.json`.

Private GitLab Registry consumers need an image pull secret with access to
`jobmatchme/cf/bee-worker-sidecar`.

## License

MIT
