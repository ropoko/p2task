import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { Bonjour, type Browser, type Service } from 'bonjour-service';

import { getRepo } from './repo';
import { getLanServerPort } from './lanServer';

const SERVICE_TYPE = 'p2task';
const PROTOCOL = 'tcp';
const SERVICE_VERSION = '1';

type Discovered = {
	peerId: string;
	url: string;
	adapter: WebSocketClientAdapter;
};

let bonjour: Bonjour | null = null;
let browser: Browser | null = null;
let publishedService: Service | null = null;
const discoveredPeers = new Map<string, Discovered>();

function pickIpv4Address(addresses: string[] | undefined): string | null {
	if (!addresses || addresses.length === 0) {
		return null;
	}
	const ipv4 = addresses.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
	return ipv4 ?? null;
}

function txtPeerId(txt: unknown): string | null {
	if (!txt || typeof txt !== 'object') {
		return null;
	}
	const value = (txt as { peerId?: unknown }).peerId;
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function shouldInitiateTo(remotePeerId: string, localPeerId: string): boolean {
	return localPeerId < remotePeerId;
}

function handleServiceUp(service: Service): void {
	const remotePeerId = txtPeerId(service.txt);
	const repo = getRepo();
	const localPeerId = repo.peerId;

	if (!remotePeerId || remotePeerId === localPeerId) {
		return;
	}
	if (discoveredPeers.has(remotePeerId)) {
		return;
	}
	if (!shouldInitiateTo(remotePeerId, localPeerId)) {
		return;
	}

	const host = pickIpv4Address(service.addresses);
	if (!host) {
		return;
	}

	const url = `ws://${host}:${service.port}`;
	const adapter = new WebSocketClientAdapter(url);
	repo.networkSubsystem.addNetworkAdapter(adapter);

	discoveredPeers.set(remotePeerId, { peerId: remotePeerId, url, adapter });
}

/**
 * Advertise this peer over mDNS and browse for other p2task peers. Spawns a
 * `WebSocketClientAdapter` for each peer we should initiate to (deduped by
 * lexicographic peerId comparison so each pair only connects once).
 */
export function startLanDiscovery(): void {
	if (bonjour) {
		return;
	}

	const port = getLanServerPort();
	if (port === null) {
		throw new Error('LAN server must be started before discovery.');
	}

	const repo = getRepo();
	const peerId = repo.peerId;

	bonjour = new Bonjour();

	publishedService = bonjour.publish({
		name: `p2task-${peerId.slice(0, 12)}`,
		type: SERVICE_TYPE,
		protocol: PROTOCOL,
		port,
		txt: { peerId, v: SERVICE_VERSION }
	});

	browser = bonjour.find({ type: SERVICE_TYPE, protocol: PROTOCOL });
	browser.on('up', (service: Service) => {
		try {
			handleServiceUp(service);
		} catch {
			// A single bad mDNS record shouldn't tear discovery down.
		}
	});
}

export function getLanDiscoveredPeers(): Array<{ peerId: string; url: string }> {
	return Array.from(discoveredPeers.values()).map(({ peerId, url }) => ({ peerId, url }));
}

export function stopLanDiscovery(): void {
	if (publishedService) {
		try {
			publishedService.stop?.();
		} catch {
			// Best-effort shutdown.
		}
		publishedService = null;
	}
	if (browser) {
		try {
			browser.stop();
		} catch {
			// Best-effort shutdown.
		}
		browser = null;
	}
	if (bonjour) {
		try {
			bonjour.unpublishAll();
		} catch {
			// Best-effort shutdown.
		}
		try {
			bonjour.destroy();
		} catch {
			// Best-effort shutdown.
		}
		bonjour = null;
	}
	discoveredPeers.clear();
}
