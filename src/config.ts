import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SidecarConfig } from "./types.js";

export function loadConfig(configPath?: string): SidecarConfig {
	const path = configPath || process.env.BEE_WORKER_SIDECAR_CONFIG;
	if (!path) {
		throw new Error("Missing BEE_WORKER_SIDECAR_CONFIG");
	}

	const fullPath = resolve(path);
	const config = JSON.parse(readFileSync(fullPath, "utf-8")) as SidecarConfig;
	if (!config.nats?.servers || (Array.isArray(config.nats.servers) && config.nats.servers.length === 0)) {
		throw new Error(`Missing nats.servers in ${fullPath}`);
	}
	if (!config.workerSubject) {
		throw new Error(`Missing workerSubject in ${fullPath}`);
	}
	if (!config.worker?.socketPath) {
		throw new Error(`Missing worker.socketPath in ${fullPath}`);
	}
	return config;
}
