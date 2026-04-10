import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { FramedSocketEnvelopeClient, writeFramedJson } from "../src/stdio-jsonrpc.js";

describe("FramedSocketEnvelopeClient", () => {
	it("writes framed envelopes and resolves correlated responses", async () => {
		const input = new PassThrough();
		const output = new PassThrough();
		const writes: Buffer[] = [];
		output.on("data", (chunk: Buffer | string) => {
			writes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		});

		const client = new FramedSocketEnvelopeClient(input, output);
		const responsePromise = client.request({
			id: "msg-1",
			type: "command",
			name: "protocol.hello",
			time: new Date().toISOString(),
			sessionId: "session-1",
			from: { kind: "human", id: "user-1" },
			to: { kind: "agent", id: "agent-1" },
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
		});

		writeFramedJson(input, {
			id: "msg-2",
			type: "response",
			name: "protocol.welcome",
			time: new Date().toISOString(),
			sessionId: "session-1",
			from: { kind: "agent", id: "agent-1" },
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
		});

		await expect(responsePromise).resolves.toMatchObject({
			name: "protocol.welcome",
			replyTo: "msg-1",
		});
		expect(Buffer.concat(writes).toString("utf-8")).toContain('"name":"protocol.hello"');
	});
});
