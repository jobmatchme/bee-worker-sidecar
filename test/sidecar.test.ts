import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSONCodec } from "nats";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BeeWorkerSidecar } from "../src/sidecar.js";
import { writeFramedJson } from "../src/stdio-jsonrpc.js";

const codec = JSONCodec<unknown>();
const cleanupPaths: string[] = [];

afterEach(async () => {
	while (cleanupPaths.length > 0) {
		const path = cleanupPaths.pop();
		if (path) {
			await rm(path, { force: true });
		}
	}
});

describe("BeeWorkerSidecar", () => {
	it("proxies bee protocol requests and republishes worker event envelopes", async () => {
		const published: Array<{ subject: string; payload: unknown }> = [];
		const responded: unknown[] = [];

		const sidecar = new BeeWorkerSidecar({
			nats: { servers: ["nats://127.0.0.1:4222"] },
			workerSubject: "bee.agent.pi.default",
			worker: { socketPath: "/var/run/bee/worker.sock" },
		});

		(sidecar as any).nats = {
			publish: vi.fn((subject: string, data: Uint8Array) => {
				published.push({ subject, payload: codec.decode(data) });
			}),
		};
		(sidecar as any).socketClient = {
			request: vi.fn(async () => ({
				id: "msg-2",
				type: "response",
				name: "protocol.welcome",
				time: new Date().toISOString(),
				sessionId: "bee:slack:T123:C123:1711111111_000100",
				from: { kind: "agent", id: "agent:pi" },
				to: { kind: "human", id: "user-1" },
				replyTo: "msg-1",
				payload: {
					protocolVersion: "2026-04-02",
					selectedCoreVersion: "2026-04-02",
					capabilities: {
						coreVersions: ["2026-04-02"],
						inputParts: ["text"],
						outputParts: ["text"],
						events: ["run.started"],
						actions: [],
						extensions: {},
						streaming: true,
					},
				},
			})),
			send: vi.fn(),
			setEnvelopeHandler: vi.fn(),
			close: vi.fn(),
		};

		await sidecar.handleProtocolMessage({
			subject: "bee.agent.pi.default.protocol",
			reply: "_INBOX.123",
			data: codec.encode({
				id: "msg-1",
				type: "command",
				name: "protocol.hello",
				time: new Date().toISOString(),
				sessionId: "bee:slack:T123:C123:1711111111_000100",
				from: { kind: "human", id: "user-1" },
				to: { kind: "agent", id: "bee.agent.pi.default" },
				replyTo: null,
				payload: {
					protocolVersion: "2026-04-02",
					capabilities: {
						coreVersions: ["2026-04-02"],
						inputParts: ["text"],
						outputParts: ["text"],
						events: ["run.started"],
						actions: [],
						extensions: {},
						streaming: true,
					},
				},
			}),
			respond: (data: Uint8Array) => {
				responded.push(codec.decode(data));
				return true;
			},
		});

		await sidecar.handleWorkerEnvelope({
			id: "msg-3",
			type: "event",
			name: "run.started",
			time: new Date().toISOString(),
			sessionId: "bee:slack:T123:C123:1711111111_000100",
			turnId: "turn-1",
			from: { kind: "agent", id: "agent:pi" },
			to: { kind: "human", id: "user-1" },
			replyTo: "msg-1",
			payload: {
				eventType: "run.started",
			},
		});

		expect((sidecar as any).socketClient.request).toHaveBeenCalledOnce();
		expect(responded).toHaveLength(1);
		expect(published).toEqual([
			{
				subject: "bee.agent.pi.default.session.bee_slack_T123_C123_1711111111_000100.event",
				payload: expect.objectContaining({
					name: "run.started",
					sessionId: "bee:slack:T123:C123:1711111111_000100",
				}),
			},
		]);
	});

	it("retries until the worker socket becomes available", async () => {
		const directory = mkdtempSync(join(tmpdir(), "bee-worker-sidecar-"));
		const socketPath = join(directory, "worker.sock");
		cleanupPaths.push(socketPath);

		const sidecar = new BeeWorkerSidecar(
			{
				nats: { servers: ["nats://127.0.0.1:4222"] },
				workerSubject: "bee.agent.pi.default",
				worker: {
					socketPath,
					requestTimeoutMs: 1_000,
					connectRetryMs: 10,
					maxConnectRetryMs: 20,
				},
			},
			{
				connectNats: vi.fn(async () => ({
					subscribe: vi.fn(() => ({
						unsubscribe: vi.fn(),
						async *[Symbol.asyncIterator]() {},
					})),
					drain: vi.fn(async () => undefined),
				})) as never,
			},
		);

		await sidecar.start();

		const responded: unknown[] = [];
		const messagePromise = sidecar.handleProtocolMessage({
			subject: "bee.agent.pi.default.protocol",
			reply: "_INBOX.456",
			data: codec.encode({
				id: "msg-10",
				type: "command",
				name: "protocol.hello",
				time: new Date().toISOString(),
				sessionId: "session-123",
				from: { kind: "human", id: "user-1" },
				to: { kind: "agent", id: "bee.agent.pi.default" },
				replyTo: null,
				payload: {
					protocolVersion: "2026-04-02",
					capabilities: {
						coreVersions: ["2026-04-02"],
						inputParts: ["text"],
						outputParts: ["text"],
						events: ["run.started"],
						actions: [],
						extensions: {},
						streaming: true,
					},
				},
			}),
			respond: (data: Uint8Array) => {
				responded.push(codec.decode(data));
				return true;
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 30));

		const server = createServer((socket) => {
			socket.on("data", () => {
				writeFramedJson(socket, {
					id: "msg-11",
					type: "response",
					name: "protocol.welcome",
					time: new Date().toISOString(),
					sessionId: "session-123",
					from: { kind: "agent", id: "agent:pi" },
					to: { kind: "human", id: "user-1" },
					replyTo: "msg-10",
					payload: {
						protocolVersion: "2026-04-02",
						selectedCoreVersion: "2026-04-02",
						capabilities: {
							coreVersions: ["2026-04-02"],
							inputParts: ["text"],
							outputParts: ["text"],
							events: ["run.started"],
							actions: [],
							extensions: {},
							streaming: true,
						},
					},
				});
			});
		});
		await new Promise<void>((resolve) => {
			server.listen(socketPath, resolve);
		});

		try {
			await messagePromise;
			expect(responded[0]).toMatchObject({
				name: "protocol.welcome",
				replyTo: "msg-10",
			});
		} finally {
			await sidecar.close();
			await new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			});
		}
	});
});
