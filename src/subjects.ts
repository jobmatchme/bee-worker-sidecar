export function trimSubject(subject: string): string {
	return subject.replace(/\.+/g, ".").replace(/^\./, "").replace(/\.$/, "");
}

export function sanitizeSubjectToken(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function buildProtocolSubject(workerSubject: string): string {
	return `${trimSubject(workerSubject)}.protocol`;
}

export function buildCommandSubject(workerSubject: string): string {
	return `${trimSubject(workerSubject)}.command`;
}

export function buildSessionEventSubject(workerSubject: string, sessionId: string): string {
	return `${trimSubject(workerSubject)}.session.${sanitizeSubjectToken(sessionId)}.event`;
}
