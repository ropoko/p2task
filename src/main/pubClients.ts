import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';

import { getConfiguredPubUrls } from './pubConfig';
import { getRepo } from './repo';
import { trackAdapterPeers, untrackAdapterPeers } from './peerTransports';

type PubClient = {
	url: string;
	adapter: WebSocketClientAdapter;
};

const clientsByUrl = new Map<string, PubClient>();

/**
 * Open a WebSocketClientAdapter for each configured pub URL. The adapter
 * handles its own reconnect loop. Idempotent: existing URLs are kept.
 */
export function startPubClients(): void {
	const repo = getRepo();
	const urls = getConfiguredPubUrls();
	for (const url of urls) {
		if (clientsByUrl.has(url)) {
			continue;
		}
		const adapter = new WebSocketClientAdapter(url);
		trackAdapterPeers(adapter, 'pub', url);
		repo.networkSubsystem.addNetworkAdapter(adapter);
		clientsByUrl.set(url, { url, adapter });
	}
}

export function getPubClientUrls(): string[] {
	return Array.from(clientsByUrl.keys());
}

const WS_OPEN_READY_STATE = 1;

export function getPubClientStatuses(): Array<{ url: string; connected: boolean }> {
	return Array.from(clientsByUrl.values()).map(({ url, adapter }) => ({
		url,
		connected: adapter.socket?.readyState === WS_OPEN_READY_STATE
	}));
}

export function stopPubClients(): void {
	if (clientsByUrl.size === 0) {
		return;
	}
	const repo = getRepo();
	for (const { adapter } of clientsByUrl.values()) {
		untrackAdapterPeers(adapter);
		try {
			repo.networkSubsystem.removeNetworkAdapter(adapter);
		} catch {
			// Best-effort shutdown.
		}
		try {
			adapter.disconnect();
		} catch {
			// Best-effort shutdown.
		}
	}
	clientsByUrl.clear();
}
