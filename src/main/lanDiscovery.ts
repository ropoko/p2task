import dgram from 'node:dgram';
import os from 'node:os';

import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';

import { resolveLanDiscoveryUdpPort } from './lanDiscoveryPort';
import { getRepo } from './repo';
import { getLanServerPort } from './lanServer';
import { trackAdapterPeers, untrackAdapterPeers } from './peerTransports';

/** How often we broadcast a beacon and run stale-peer eviction */
const ANNOUNCE_INTERVAL_MS = 3000;
/** Drop a peer after this long without a beacon (multiple of announce interval) */
const STALE_INTERVAL_MULT = 3;

const BEACON_VERSION = 1;
const BROADCAST_ADDR = '255.255.255.255';

type BeaconPayload = {
	v?: unknown;
	peerId?: unknown;
	wsPort?: unknown;
};

type Discovered = {
	peerId: string;
	url: string;
	adapter: WebSocketClientAdapter | null;
	lastSeen: number;
};

let socket: dgram.Socket | null = null;
let announceTimer: ReturnType<typeof setInterval> | null = null;
const discoveredPeers = new Map<string, Discovered>();

function isIpv4Family(family: os.NetworkInterfaceInfo['family']): boolean {
	return family === 'IPv4' || (family as unknown as number) === 4;
}

/** Primary non-internal IPv4 for logging / optional beacon field (IPv4-only discovery). */
function pickPrimaryLanIPv4(): string | null {
	const linkLocal: string[] = [];
	const normal: string[] = [];
	for (const list of Object.values(os.networkInterfaces())) {
		if (!list) {
			continue;
		}
		for (const addr of list) {
			if (!addr || addr.internal) {
				continue;
			}
			if (!isIpv4Family(addr.family)) {
				continue;
			}
			const ip = addr.address;
			if (ip.startsWith('169.254.')) {
				linkLocal.push(ip);
			} else {
				normal.push(ip);
			}
		}
	}
	if (normal.length > 0) {
		return normal[0] ?? null;
	}
	if (linkLocal.length > 0) {
		return linkLocal[0] ?? null;
	}
	return null;
}

function parseBeacon(msg: Buffer): BeaconPayload | null {
	try {
		const parsed: unknown = JSON.parse(msg.toString('utf8'));
		if (typeof parsed !== 'object' || parsed === null) {
			return null;
		}
		return parsed as BeaconPayload;
	} catch {
		return null;
	}
}

function isValidWsPort(n: number): boolean {
	return Number.isInteger(n) && n >= 1 && n <= 65535;
}

function shouldInitiateTo(remotePeerId: string, localPeerId: string): boolean {
	return localPeerId < remotePeerId;
}

function removeDiscoveredPeer(peerId: string): void {
	const entry = discoveredPeers.get(peerId);
	if (!entry) {
		return;
	}
	discoveredPeers.delete(peerId);
	if (!entry.adapter) {
		return;
	}
	const repo = getRepo();
	untrackAdapterPeers(entry.adapter);
	try {
		repo.networkSubsystem.removeNetworkAdapter(entry.adapter);
	} catch {
		// Best-effort.
	}
	try {
		entry.adapter.disconnect();
	} catch {
		// Best-effort.
	}
}

function handleInboundBeacon(senderIp: string, payload: BeaconPayload): void {
	if (payload.v !== BEACON_VERSION) {
		return;
	}
	if (typeof payload.peerId !== 'string' || payload.peerId.length === 0) {
		return;
	}
	const wsPortRaw = payload.wsPort;
	const wsPort =
		typeof wsPortRaw === 'number'
			? wsPortRaw
			: typeof wsPortRaw === 'string'
				? Number.parseInt(wsPortRaw, 10)
				: NaN;
	if (!isValidWsPort(wsPort)) {
		return;
	}

	const repo = getRepo();
	const localPeerId = repo.peerId;
	const remotePeerId = payload.peerId;

	if (remotePeerId === localPeerId) {
		return;
	}

	const url = `ws://${senderIp}:${wsPort}`;
	const now = Date.now();
	const existing = discoveredPeers.get(remotePeerId);
	if (existing) {
		existing.lastSeen = now;
		existing.url = url;
		return;
	}

	if (!shouldInitiateTo(remotePeerId, localPeerId)) {
		discoveredPeers.set(remotePeerId, {
			peerId: remotePeerId,
			url,
			adapter: null,
			lastSeen: now
		});
		return;
	}

	const adapter = new WebSocketClientAdapter(url);
	trackAdapterPeers(adapter, 'lan-out', url);
	repo.networkSubsystem.addNetworkAdapter(adapter);

	discoveredPeers.set(remotePeerId, {
		peerId: remotePeerId,
		url,
		adapter,
		lastSeen: now
	});
}

function evictStalePeers(): void {
	const cutoff = Date.now() - ANNOUNCE_INTERVAL_MS * STALE_INTERVAL_MULT;
	for (const [peerId, entry] of discoveredPeers) {
		if (entry.lastSeen < cutoff) {
			removeDiscoveredPeer(peerId);
		}
	}
}

function sendBeacon(discoveryPort: number): void {
	if (!socket) {
		return;
	}
	const repo = getRepo();
	const wsPort = getLanServerPort();
	if (wsPort === null) {
		return;
	}
	const host = pickPrimaryLanIPv4();
	const body: { v: number; peerId: string; wsPort: number; host?: string } = {
		v: BEACON_VERSION,
		peerId: repo.peerId,
		wsPort
	};
	if (host) {
		body.host = host;
	}
	const buf = Buffer.from(JSON.stringify(body), 'utf8');
	socket.send(buf, discoveryPort, BROADCAST_ADDR, (err) => {
		if (err) {
			console.warn('[p2task] LAN discovery beacon send failed', err.message);
		}
	});
}

/**
 * IPv4 UDP broadcast beacons on a dedicated port; peers connect via the LAN
 * WebSocket port advertised in each beacon. No mDNS / multicast DNS.
 */
export function startLanDiscovery(): void {
	if (socket) {
		return;
	}

	const wsPort = getLanServerPort();
	if (wsPort === null) {
		throw new Error('LAN server must be started before discovery.');
	}

	const discoveryPort = resolveLanDiscoveryUdpPort();
	const bindAddr = process.env['P2TASK_LAN_DISCOVERY_BIND']?.trim() || '0.0.0.0';

	const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
	socket = s;

	s.on('error', (err) => {
		console.error('[p2task] LAN discovery UDP socket error', err);
	});

	s.on('message', (msg, rinfo) => {
		if (rinfo.family !== 'IPv4' && (rinfo.family as unknown as number) !== 4) {
			return;
		}
		const payload = parseBeacon(msg);
		if (!payload) {
			return;
		}
		try {
			handleInboundBeacon(rinfo.address, payload);
		} catch {
			// Malformed or unexpected payload; ignore.
		}
	});

	s.bind(discoveryPort, bindAddr, () => {
		try {
			s.setBroadcast(true);
		} catch (err) {
			console.error('[p2task] LAN discovery setBroadcast failed', err);
		}

		const primaryIp = pickPrimaryLanIPv4();
		console.info('[p2task] LAN UDP discovery', {
			udpPort: discoveryPort,
			bind: bindAddr,
			wsPort,
			primaryLanIpv4: primaryIp ?? '(none)',
			peerIdPrefix: getRepo().peerId.slice(0, 16)
		});

		announceTimer = setInterval(() => {
			sendBeacon(discoveryPort);
			evictStalePeers();
		}, ANNOUNCE_INTERVAL_MS);

		sendBeacon(discoveryPort);
	});
}

export function getLanDiscoveredPeers(): Array<{ peerId: string; url: string }> {
	return Array.from(discoveredPeers.values()).map(({ peerId, url }) => ({ peerId, url }));
}

export function stopLanDiscovery(): void {
	if (announceTimer) {
		clearInterval(announceTimer);
		announceTimer = null;
	}
	if (socket) {
		try {
			socket.close();
		} catch {
			// Best-effort shutdown.
		}
		socket = null;
	}
	for (const peerId of [...discoveredPeers.keys()]) {
		removeDiscoveredPeer(peerId);
	}
}
