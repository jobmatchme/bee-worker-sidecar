#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { BeeWorkerSidecar } from "./sidecar.js";

async function main(): Promise<void> {
	const config = loadConfig();
	const sidecar = new BeeWorkerSidecar(config);
	await sidecar.start();

	const shutdown = async () => {
		try {
			await sidecar.close();
		} finally {
			process.exit(0);
		}
	};

	process.once("SIGINT", () => void shutdown());
	process.once("SIGTERM", () => void shutdown());

	const terminalError = await sidecar.waitForTermination();
	if (terminalError) throw terminalError;
}

void main().catch((error) => {
	console.error(error);
	process.exit(1);
});
