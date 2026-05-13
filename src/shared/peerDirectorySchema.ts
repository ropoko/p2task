/** Public peer profile (single Automerge doc per user; replicates to others who open the URL). */

export type PeerProfileDoc = {
	peerId: string;
	nickname: string;
	email: string;
	updatedAt: string;
};

export function createInitialPeerProfileDoc(opts: {
	peerId: string;
	nickname: string;
	email: string;
}): PeerProfileDoc {
	const now = new Date().toISOString();
	return {
		peerId: opts.peerId,
		nickname: opts.nickname.trim(),
		email: opts.email.trim().toLowerCase(),
		updatedAt: now
	};
}

/** Local roster: peerId → their profile Automerge URL (persists across sessions). */

export type KnownPeerEntry = {
	peerId: string;
	profileDocUrl: string;
};

export type KnownPeersDoc = {
	peers: KnownPeerEntry[];
};

export function createInitialKnownPeersDoc(): KnownPeersDoc {
	return { peers: [] };
}

/**
 * Upsert by peerId in-place on a KnownPeersDoc (call inside Automerge `change`).
 */
export function upsertKnownPeer(peers: KnownPeerEntry[], peerId: string, profileDocUrl: string): void {
	const idx = peers.findIndex((p) => p.peerId === peerId);
	const entry: KnownPeerEntry = { peerId, profileDocUrl };
	if (idx >= 0) {
		peers[idx] = entry;
	} else {
		peers.push(entry);
	}
}
