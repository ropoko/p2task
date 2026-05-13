import { startLanDiscovery, stopLanDiscovery } from './lanDiscovery';
import { startLanServer, stopLanServer } from './lanServer';
import { startPubClients, stopPubClients } from './pubClients';
import { bootRepoIfReady } from './repo';

let started = false;
let lastNetworkBootError: string | null = null;

export function getLastNetworkBootError(): string | null {
	return lastNetworkBootError;
}

/**
 * Bring up the Repo and all of its network adapters if identity is present.
 * Idempotent: subsequent calls are no-ops once the network is up.
 */
export async function bootNetworkIfReady(): Promise<void> {
	if (started) {
		return;
	}
	const repo = bootRepoIfReady();
	if (!repo) {
		return;
	}

	lastNetworkBootError = null;
	try {
		await startLanServer();
		startLanDiscovery();
		startPubClients();
		started = true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		lastNetworkBootError = message;
		console.error('Failed to start networking', err);
		stopPubClients();
		stopLanDiscovery();
		stopLanServer();
	}
}

export function shutdownNetwork(): void {
	if (!started) {
		return;
	}
	stopPubClients();
	stopLanDiscovery();
	stopLanServer();
	started = false;
}
