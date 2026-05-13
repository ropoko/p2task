import type { AddressInfo } from 'net';

import { WebSocketServerAdapter } from '@automerge/automerge-repo-network-websocket';
import WebSocket from 'isomorphic-ws';

import { getRepo } from './repo';
import { trackAdapterPeers, untrackAdapterPeers } from './peerTransports';

const WebSocketServer = WebSocket.WebSocketServer;
type WebSocketServer = InstanceType<typeof WebSocket.WebSocketServer>;

type LanServer = {
	wss: WebSocketServer;
	adapter: WebSocketServerAdapter;
	port: number;
};

let lanServer: LanServer | null = null;

/**
 * Boot the LAN-facing WebSocket server. Idempotent: returns the existing
 * server on subsequent calls.
 */
export async function startLanServer(): Promise<LanServer> {
	if (lanServer) {
		return lanServer;
	}

	const repo = getRepo();

	const wss = new WebSocketServer({ host: '0.0.0.0', port: 0 });
	await new Promise<void>((resolve, reject) => {
		const onListening = (): void => {
			wss.off('error', onError);
			resolve();
		};
		const onError = (err: Error): void => {
			wss.off('listening', onListening);
			reject(err);
		};
		wss.once('listening', onListening);
		wss.once('error', onError);
	});

	const address = wss.address() as AddressInfo;
	const port = address.port;

	const adapter = new WebSocketServerAdapter(wss);
	trackAdapterPeers(adapter, 'lan-in');
	repo.networkSubsystem.addNetworkAdapter(adapter);

	lanServer = { wss, adapter, port };
	return lanServer;
}

export function getLanServerPort(): number | null {
	return lanServer?.port ?? null;
}

export function stopLanServer(): void {
	if (!lanServer) {
		return;
	}
	const { adapter, wss } = lanServer;
	untrackAdapterPeers(adapter);
	try {
		wss.close();
	} catch {
		// Best-effort shutdown.
	}
	lanServer = null;
}
