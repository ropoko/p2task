export type LanPeerInfo = {
	peerId: string;
	url: string;
};

export type PubInfo = {
	url: string;
	connected: boolean;
};

export type NetworkStatus = {
	lanPort: number | null;
	lanPeers: LanPeerInfo[];
	pubs: PubInfo[];
	connectedPeerIds: string[];
};
