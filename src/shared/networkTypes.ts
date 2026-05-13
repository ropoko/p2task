export type LanPeerInfo = {
	peerId: string;
	url: string;
	/** Automerge inbox document URL from LAN beacon (v2+), when available. */
	inboxDocUrl?: string;
	/** Automerge peer profile document URL from LAN beacon, when available. */
	profileDocUrl?: string;
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

/** Peers that have had at least one live repo connection this app session (rows persist after disconnect). */
export type SeenPeerInfo = {
	peerId: string;
	/** Synced over LAN at least once this session */
	viaLan: boolean;
	/** Synced over a pub relay at least once this session */
	viaPub: boolean;
};

export type NetworkStatus = {
	lanPort: number | null;
	/** Set when LAN listen or UDP discovery failed during last boot attempt */
	networkError: string | null;
	lanPeers: LanPeerInfo[];
	pubs: PubInfo[];
	connectedPeers: ConnectedPeerInfo[];
	seenPeers: SeenPeerInfo[];
};
