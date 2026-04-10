import type { Readable, Writable } from "node:stream";
import { assertValidEnvelope, type Envelope } from "@jobmatchme/bee-dance-core";
import type { EnvelopeHandler, SocketEnvelopeClient } from "./types.js";

export class FramedSocketEnvelopeClient implements SocketEnvelopeClient {
	private buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
	private pending = new Map<string, Deferred<Envelope>>();
	private envelopeHandler: EnvelopeHandler | null = null;
	private closed = false;
	private sharedStream: boolean;

	constructor(
		private input: Readable,
		private output: Writable,
	) {
		this.sharedStream = (input as unknown) === (output as unknown);
		this.input.on("data", (chunk: Buffer | string) => {
			const nextChunk = typeof chunk === "string" ? Buffer.from(chunk, "utf-8") : Buffer.from(chunk);
			this.buffer = Buffer.concat([this.buffer, nextChunk]);
			this.drain();
		});
		this.input.on("end", () => this.failAll(new Error("Worker socket input ended")));
		this.input.on("error", (error) => this.failAll(error));
	}

	request(envelope: Envelope, timeoutMs = 10_000): Promise<Envelope> {
		if (!envelope.id) {
			throw new Error("Envelope requests require an id");
		}
		assertValidEnvelope(envelope);
		const deferred = createDeferred<Envelope>();
		const timeoutId = setTimeout(() => {
			this.pending.delete(envelope.id);
			deferred.reject(new Error(`Timed out waiting for response to ${envelope.id}`));
		}, timeoutMs);
		this.pending.set(envelope.id, {
			promise: deferred.promise,
			resolve: (value) => {
				clearTimeout(timeoutId);
				deferred.resolve(value);
			},
			reject: (reason) => {
				clearTimeout(timeoutId);
				deferred.reject(reason);
			},
		});
		writeFramedJson(this.output, envelope);
		return deferred.promise;
	}

	send(envelope: Envelope): void {
		assertValidEnvelope(envelope);
		writeFramedJson(this.output, envelope);
	}

	setEnvelopeHandler(handler: EnvelopeHandler): void {
		this.envelopeHandler = handler;
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		this.failAll(new Error("Worker socket client closed"));
		this.input.removeAllListeners();
		if ("destroy" in this.input && typeof this.input.destroy === "function") {
			this.input.destroy();
		}
		if (!this.sharedStream && "destroy" in this.output && typeof this.output.destroy === "function") {
			this.output.destroy();
		}
	}

	private drain(): void {
		while (true) {
			const next = readFramedMessage(this.buffer);
			if (!next) return;
			this.buffer = next.rest;
			this.handlePayload(next.payload);
		}
	}

	private handlePayload(payload: string): void {
		const parsed = JSON.parse(payload) as Envelope;
		assertValidEnvelope(parsed);

		if (parsed.replyTo) {
			const pending = this.pending.get(parsed.replyTo);
			if (pending) {
				this.pending.delete(parsed.replyTo);
				pending.resolve(parsed);
				return;
			}
		}

		void this.envelopeHandler?.(parsed);
	}

	private failAll(error: unknown): void {
		for (const pending of this.pending.values()) {
			pending.reject(error);
		}
		this.pending.clear();
	}
}

export function writeFramedJson(output: Writable, payload: unknown): void {
	const json = JSON.stringify(payload);
	const frame = `Content-Length: ${Buffer.byteLength(json, "utf-8")}\r\n\r\n${json}`;
	output.write(frame);
}

export function readFramedMessage(
	buffer: Buffer<ArrayBufferLike>,
): { payload: string; rest: Buffer<ArrayBufferLike> } | undefined {
	const headerEnd = buffer.indexOf("\r\n\r\n");
	if (headerEnd === -1) return undefined;

	const header = buffer.slice(0, headerEnd).toString("utf-8");
	const contentLength = parseContentLength(header);
	if (contentLength === undefined) {
		throw new Error("Missing Content-Length header");
	}

	const bodyStart = headerEnd + 4;
	const bodyEnd = bodyStart + contentLength;
	if (buffer.length < bodyEnd) return undefined;

	return {
		payload: buffer.slice(bodyStart, bodyEnd).toString("utf-8"),
		rest: buffer.slice(bodyEnd),
	};
}

function parseContentLength(header: string): number | undefined {
	for (const line of header.split("\r\n")) {
		const separatorIndex = line.indexOf(":");
		if (separatorIndex === -1) continue;
		if (line.slice(0, separatorIndex).trim().toLowerCase() !== "content-length") continue;
		const value = Number.parseInt(line.slice(separatorIndex + 1).trim(), 10);
		return Number.isFinite(value) ? value : undefined;
	}
	return undefined;
}

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((innerResolve, innerReject) => {
		resolve = innerResolve;
		reject = innerReject;
	});
	return { promise, resolve, reject };
}

interface Deferred<T> {
	promise: Promise<T>;
	resolve(value: T | PromiseLike<T>): void;
	reject(reason?: unknown): void;
}
