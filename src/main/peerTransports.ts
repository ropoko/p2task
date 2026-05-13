import type {
	NetworkAdapterInterface,
	PeerCandidatePayload,
	PeerDisconnectedPayload
} from '@automerge/automerge-repo';

import type { ConnectedPeerInfo, PeerTransport, SeenPeerInfo } from '../shared/networkTypes';

type Tracker = {
	keys: Set<string>;
	onCandidate: (payload: PeerCandidatePayload) => void;
	onDisconnected: (payload: PeerDisconnectedPayload) => void;
};

const trackers = new WeakMap<NetworkAdapterInterface, Tracker>();
const connectedPeers = new Map<string, ConnectedPeerInfo>();
const seenPeerRoutes = new Map<string, { viaLan: boolean; viaPub: boolean }>();

function touchSeenPeerRoute(peerId: string, transport: PeerTransport): void {
	let r = seenPeerRoutes.get(peerId);
	if (!r) {
		r = { viaLan: false, viaPub: false };
		seenPeerRoutes.set(peerId, r);
	}
	if (transport === 'lan-in' || transport === 'lan-out') {
		r.viaLan = true;
	}
	if (transport === 'pub') {
		r.viaPub = true;
	}
}

function peerKey(peer: ConnectedPeerInfo): string {
	return `${peer.transport}:${peer.via ?? ''}:${peer.peerId}`;
}

export function trackAdapterPeers(
	adapter: NetworkAdapterInterface,
	transport: PeerTransport,
	via?: string
): void {
	if (trackers.has(adapter)) {
		return;
	}

	const tracker: Tracker = {
		keys: new Set(),
		onCandidate(payload) {
			const peer: ConnectedPeerInfo = {
				peerId: payload.peerId,
				transport,
				...(via ? { via } : {})
			};
			touchSeenPeerRoute(payload.peerId, transport);
			const key = peerKey(peer);
			tracker.keys.add(key);
			connectedPeers.set(key, peer);
		},
		onDisconnected(payload) {
			for (const key of tracker.keys) {
				const peer = connectedPeers.get(key);
				if (peer?.peerId === payload.peerId) {
					connectedPeers.delete(key);
					tracker.keys.delete(key);
				}
			}
		}
	};

	adapter.on('peer-candidate', tracker.onCandidate);
	adapter.on('peer-disconnected', tracker.onDisconnected);
	trackers.set(adapter, tracker);
}

export function untrackAdapterPeers(adapter: NetworkAdapterInterface): void {
	const tracker = trackers.get(adapter);
	if (!tracker) {
		return;
	}

	adapter.off('peer-candidate', tracker.onCandidate);
	adapter.off('peer-disconnected', tracker.onDisconnected);
	for (const key of tracker.keys) {
		connectedPeers.delete(key);
	}
	trackers.delete(adapter);
}

export function getConnectedPeers(): ConnectedPeerInfo[] {
	return Array.from(connectedPeers.values()).sort((a, b) => {
		const transport = a.transport.localeCompare(b.transport);
		if (transport !== 0) {
			return transport;
		}
		return a.peerId.localeCompare(b.peerId);
	});
}

export function getSeenPeers(): SeenPeerInfo[] {
	return [...seenPeerRoutes.entries()]
		.map(([peerId, { viaLan, viaPub }]) => ({ peerId, viaLan, viaPub }))
		.sort((a, b) => a.peerId.localeCompare(b.peerId));
}
