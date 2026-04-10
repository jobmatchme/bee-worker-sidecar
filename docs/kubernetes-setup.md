# Kubernetes setup

`bee-worker-sidecar` is intended to run in the same pod as a local Bee Dance
worker process.

Recommended pod shape:

- one container for the worker runtime
- one container for `bee-worker-sidecar`
- one shared `emptyDir` mounted at `/var/run/bee`
- the worker binds `/var/run/bee/worker.sock`
- the sidecar connects to that socket and exposes the worker on NATS

Minimal config excerpt:

```json
{
  "nats": {
    "servers": "nats://nats:4222",
    "name": "bee-worker-sidecar"
  },
  "workerSubject": "bee.agent.pi.default",
  "worker": {
    "socketPath": "/var/run/bee/worker.sock"
  }
}
```
