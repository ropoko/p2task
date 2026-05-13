export type LanPeerInfo = {
	peerId: string;
	url: string;
};

export type PubInfo = {
	url: string;
	connected: boolean;
};

export type PeerTransport = 'lan-in' | 'lan-out' | 'pub' | 'ipc';

export type ConnectedPeerInfo = {
	peerId: string;
	transport: PeerTransport;
	via?: string;
};

export type NetworkStatus = {
	lanPort: number | null;
	lanPeers: LanPeerInfo[];
	pubs: PubInfo[];
	connectedPeers: ConnectedPeerInfo[];
};
