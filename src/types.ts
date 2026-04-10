import type { Socket } from "node:net";
import type { Envelope } from "@jobmatchme/bee-dance-core";
import type { Msg, NatsConnection, Subscription } from "nats";

export interface SidecarWorkerConfig {
	socketPath: string;
	requestTimeoutMs?: number;
	connectRetryMs?: number;
	maxConnectRetryMs?: number;
}

export interface SidecarNatsConfig {
	servers: string | string[];
	name?: string;
}

export interface SidecarConfig {
	nats: SidecarNatsConfig;
	workerSubject: string;
	worker: SidecarWorkerConfig;
}

export interface SidecarLogger {
	info(message: string): void;
	warn(message: string): void;
	error(message: string, error?: string): void;
}

export type EnvelopeHandler = (envelope: Envelope) => Promise<void> | void;

export interface SocketEnvelopeClient {
	request(envelope: Envelope, timeoutMs?: number): Promise<Envelope>;
	send(envelope: Envelope): void;
	setEnvelopeHandler(handler: EnvelopeHandler): void;
	close(): void;
}

export interface SidecarRuntime {
	nats: NatsConnection;
	socketClient: SocketEnvelopeClient;
	protocolSubscription?: Subscription;
	commandSubscription?: Subscription;
}

export type WorkerSocketConnector = (socketPath: string) => Socket;

export interface MessageLike extends Pick<Msg, "data" | "respond"> {
	subject: string;
	reply?: string;
}
