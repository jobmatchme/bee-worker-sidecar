import { createConnection } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { assertValidEnvelope, type Envelope } from "@jobmatchme/bee-dance-core";
import { connect, JSONCodec, type NatsConnection } from "nats";
import * as log from "./log.js";
import { decodeEnvelope, isEventEnvelope } from "./protocol-adapter.js";
import { FramedSocketEnvelopeClient } from "./stdio-jsonrpc.js";
import { buildCommandSubject, buildProtocolSubject, buildSessionEventSubject } from "./subjects.js";
import type {
	MessageLike,
	SidecarConfig,
	SidecarLogger,
	SocketEnvelopeClient,
	WorkerSocketConnector,
} from "./types.js";

const codec = JSONCodec<Envelope>();

export interface BeeWorkerSidecarOptions {
	logger?: SidecarLogger;
	connectNats?: typeof connect;
	connectWorkerSocket?: WorkerSocketConnector;
}

export class BeeWorkerSidecar {
	private logger: SidecarLogger;
	private socketClient: SocketEnvelopeClient | null = null;
	private nats: NatsConnection | null = null;
	private protocolSubscription: ReturnType<NatsConnection["subscribe"]> | null = null;
	private commandSubscription: ReturnType<NatsConnection["subscribe"]> | null = null;
	private connectPromise: Promise<SocketEnvelopeClient> | null = null;
	private closing = false;

	constructor(
		private config: SidecarConfig,
		private options: BeeWorkerSidecarOptions = {},
	) {
		this.logger = options.logger || {
			info: log.logInfo,
			warn: log.logWarning,
			error: log.logError,
		};
	}

	async start(): Promise<void> {
		const connectNats = this.options.connectNats || connect;
		this.nats = await connectNats({
			servers: this.config.nats.servers,
			name: this.config.nats.name,
		});
		this.protocolSubscription = this.nats.subscribe(buildProtocolSubject(this.config.workerSubject));
		this.commandSubscription = this.nats.subscribe(buildCommandSubject(this.config.workerSubject));

		this.logger.info(`listening on ${buildProtocolSubject(this.config.workerSubject)}`);
		this.logger.info(`listening on ${buildCommandSubject(this.config.workerSubject)}`);
		void this.ensureSocketClient().catch((error) => {
			if (!this.closing) {
				this.logger.warn(`initial worker socket connect failed: ${String(error)}`);
			}
		});
		void this.consumeProtocolMessages();
		void this.consumeCommandMessages();
	}

	async close(): Promise<void> {
		this.closing = true;
		this.protocolSubscription?.unsubscribe();
		this.commandSubscription?.unsubscribe();
		this.connectPromise = null;
		this.socketClient?.close();
		this.socketClient = null;
		if (this.nats) {
			await this.nats.drain();
		}
	}

	async handleProtocolMessage(message: MessageLike): Promise<void> {
		if (!message.reply) {
			this.logger.warn(`dropping bee protocol message without reply subject on ${message.subject}`);
			return;
		}
		const envelope = decodeEnvelope(codec.decode(message.data));
		const socketClient = await this.ensureSocketClient();
		const response = await socketClient.request(envelope, this.config.worker.requestTimeoutMs ?? 10_000);
		assertValidEnvelope(response);
		message.respond(codec.encode(response));
	}

	async handleCommandMessage(message: MessageLike): Promise<void> {
		const envelope = decodeEnvelope(codec.decode(message.data));
		const socketClient = await this.ensureSocketClient();
		socketClient.send(envelope);
	}

	async handleWorkerEnvelope(envelope: Envelope): Promise<void> {
		if (!this.nats) {
			return;
		}
		assertValidEnvelope(envelope);
		if (!isEventEnvelope(envelope)) {
			this.logger.warn(`dropping non-event worker envelope ${envelope.name}`);
			return;
		}
		if (!envelope.sessionId) {
			this.logger.warn(`dropping worker event without sessionId: ${envelope.name}`);
			return;
		}
		this.nats.publish(
			buildSessionEventSubject(this.config.workerSubject, envelope.sessionId),
			codec.encode(envelope),
		);
	}

	private async consumeProtocolMessages(): Promise<void> {
		if (!this.protocolSubscription) return;
		for await (const message of this.protocolSubscription) {
			try {
				await this.handleProtocolMessage({
					subject: message.subject,
					reply: message.reply,
					data: message.data,
					respond: (data) => message.respond(data),
				});
			} catch (error) {
				this.logger.error(`Failed to handle bee protocol message on ${message.subject}`, String(error));
			}
		}
	}

	private async consumeCommandMessages(): Promise<void> {
		if (!this.commandSubscription) return;
		for await (const message of this.commandSubscription) {
			try {
				await this.handleCommandMessage({
					subject: message.subject,
					reply: message.reply,
					data: message.data,
					respond: (data) => message.respond(data),
				});
			} catch (error) {
				this.logger.error(`Failed to handle bee command message on ${message.subject}`, String(error));
			}
		}
	}

	private async ensureSocketClient(): Promise<SocketEnvelopeClient> {
		if (this.socketClient) {
			return this.socketClient;
		}
		if (this.connectPromise) {
			return this.connectPromise;
		}

		this.connectPromise = this.connectSocketClientWithRetry();
		try {
			const client = await this.connectPromise;
			this.socketClient = client;
			return client;
		} finally {
			this.connectPromise = null;
		}
	}

	private async connectSocketClientWithRetry(): Promise<SocketEnvelopeClient> {
		const initialRetryMs = this.config.worker.connectRetryMs ?? 250;
		const maxRetryMs = this.config.worker.maxConnectRetryMs ?? 5_000;
		let retryMs = initialRetryMs;

		while (!this.closing) {
			try {
				return await this.connectSocketClientOnce();
			} catch (error) {
				this.logger.warn(
					`worker socket not ready at ${this.config.worker.socketPath}; retrying in ${retryMs}ms (${String(error)})`,
				);
				await delay(retryMs);
				retryMs = Math.min(retryMs * 2, maxRetryMs);
			}
		}

		throw new Error("Sidecar is closing");
	}

	private async connectSocketClientOnce(): Promise<SocketEnvelopeClient> {
		const connectWorkerSocket =
			this.options.connectWorkerSocket || ((socketPath: string) => createConnection(socketPath));
		const workerSocket = connectWorkerSocket(this.config.worker.socketPath);

		await new Promise<void>((resolvePromise, rejectPromise) => {
			const cleanup = () => {
				workerSocket.off("connect", onConnect);
				workerSocket.off("error", onError);
			};
			const onConnect = () => {
				cleanup();
				resolvePromise();
			};
			const onError = (error: Error) => {
				cleanup();
				workerSocket.destroy();
				rejectPromise(error);
			};
			workerSocket.once("connect", onConnect);
			workerSocket.once("error", onError);
		});

		const client = new FramedSocketEnvelopeClient(workerSocket, workerSocket);
		client.setEnvelopeHandler(async (envelope) => {
			try {
				await this.handleWorkerEnvelope(envelope);
			} catch (error) {
				this.logger.error(`Failed to publish worker envelope ${envelope.name}`, String(error));
			}
		});

		workerSocket.on("close", () => {
			if (this.socketClient === client) {
				this.socketClient = null;
				if (!this.closing) {
					void this.ensureSocketClient().catch((error) => {
						if (!this.closing) {
							this.logger.warn(`worker socket reconnect failed: ${String(error)}`);
						}
					});
				}
			}
		});

		return client;
	}
}
