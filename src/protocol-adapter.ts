import { assertValidEnvelope, type Envelope } from "@jobmatchme/bee-dance-core";

export type SidecarEnvelope = Envelope;

export function decodeEnvelope(value: unknown): SidecarEnvelope {
	assertValidEnvelope(value);
	return value as SidecarEnvelope;
}

export function isEventEnvelope(envelope: SidecarEnvelope): boolean {
	return envelope.type === "event";
}

export function isProtocolEnvelope(envelope: SidecarEnvelope): boolean {
	return envelope.name === "protocol.hello";
}

export function getCorrelationId(envelope: SidecarEnvelope): string | undefined {
	return envelope.replyTo || undefined;
}
