import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { Bonjour, type Browser, type Service } from 'bonjour-service';

import { getRepo } from './repo';
import { getLanServerPort } from './lanServer';
import { trackAdapterPeers, untrackAdapterPeers } from './peerTransports';

const SERVICE_TYPE = 'p2task';
const PROTOCOL = 'tcp';
const SERVICE_VERSION = '1';

type Discovered = {
	peerId: string;
	url: string;
	adapter: WebSocketClientAdapter | null;
};

let bonjour: Bonjour | null = null;
let browser: Browser | null = null;
let publishedService: Service | null = null;
const discoveredPeers = new Map<string, Discovered>();

function isIpv4Address(address: string | undefined): address is string {
	return typeof address === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(address);
}

function isIpv6Address(address: string | undefined): address is string {
	return typeof address === 'string' && address.includes(':');
}

function websocketHost(host: string): string {
	return isIpv6Address(host) ? `[${host}]` : host;
}

function pickReachableHost(service: Service): string | null {
	const ipv4 = service.addresses?.find(isIpv4Address);
	if (ipv4) {
		return ipv4;
	}
	if (isIpv4Address(service.referer?.address)) {
		return service.referer.address;
	}
	if (typeof service.host === 'string' && service.host.length > 0) {
		return service.host;
	}
	const firstAddress = service.addresses?.[0];
	if (firstAddress) {
		return firstAddress;
	}
	return null;
}

function txtPeerId(txt: unknown): string | null {
	if (!txt || typeof txt !== 'object') {
		return null;
	}
	const value = (txt as { peerId?: unknown }).peerId;
	if (typeof value === 'string' && value.length > 0) {
		return value;
	}
	if (Buffer.isBuffer(value)) {
		const decoded = value.toString('utf8');
		return decoded.length > 0 ? decoded : null;
	}
	return null;
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

	const host = pickReachableHost(service);
	if (!host) {
		console.warn('Discovered LAN peer without a reachable host', {
			peerId: remotePeerId,
			host: service.host,
			addresses: service.addresses,
			referer: service.referer
		});
		return;
	}

	const url = `ws://${websocketHost(host)}:${service.port}`;
	if (!shouldInitiateTo(remotePeerId, localPeerId)) {
		discoveredPeers.set(remotePeerId, { peerId: remotePeerId, url, adapter: null });
		return;
	}

	const adapter = new WebSocketClientAdapter(url);
	trackAdapterPeers(adapter, 'lan-out', url);
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
	const repo = getRepo();
	for (const { adapter } of discoveredPeers.values()) {
		if (!adapter) {
			continue;
		}
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
	discoveredPeers.clear();
}
