import { isValidAutomergeUrl } from '@automerge/automerge-repo';
import { useDocument, type AutomergeUrl } from '@automerge/react';
import { Suspense } from 'react';

import type { KnownPeersDoc, PeerProfileDoc } from '../workspace/workspaceDoc';

function shortPeerId(id: string): string {
	if (!id) {
		return '—';
	}
	if (id.length <= 14) {
		return id;
	}
	return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function PeerProfileNickname({
	profileUrl,
	fallback
}: {
	profileUrl: AutomergeUrl;
	fallback: string;
}): React.JSX.Element {
	const [doc] = useDocument<PeerProfileDoc>(profileUrl, { suspense: true });
	const n = doc.nickname?.trim();
	return <>{n || fallback}</>;
}

/**
 * Resolves a peer's display nickname from the known-peers directory + replicating profile doc,
 * falling back to `snapshotLabel` (e.g. invite snapshot or short peer id).
 */
export function PeerDirectoryName({
	peerId,
	snapshotLabel,
	knownPeers
}: {
	peerId: string;
	snapshotLabel: string;
	knownPeers: KnownPeersDoc;
}): React.JSX.Element {
	const entry = (knownPeers.peers ?? []).find((p) => p.peerId === peerId);
	const url = entry?.profileDocUrl;
	const fallback = snapshotLabel.trim() || shortPeerId(peerId);
	if (!url || !isValidAutomergeUrl(url)) {
		return <>{fallback}</>;
	}
	return (
		<Suspense fallback={fallback}>
			<PeerProfileNickname profileUrl={url as AutomergeUrl} fallback={fallback} />
		</Suspense>
	);
}
