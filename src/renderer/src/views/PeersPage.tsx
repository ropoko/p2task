import { isValidAutomergeUrl } from '@automerge/automerge-repo';
import { useDocument, type AutomergeUrl } from '@automerge/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IconSquare } from '../components/IconSquare';
import { useAppIdentity } from '../identity/identityContext';
import type { ConnectedPeerInfo, NetworkStatus, SeenPeerInfo } from '../../../shared/networkTypes';
import { upsertKnownPeer, type KnownPeersDoc } from '../workspace/workspaceDoc';

const POLL_INTERVAL_MS = 2000;

export type InvitePeerDraft = {
	targetPeerId: string;
	targetInboxUrl: string;
	label: string;
};

type PeersPageProps = {
	onInvitePeer: (draft: InvitePeerDraft) => void;
	knownPeersDocumentUrl: AutomergeUrl;
};

function shortId(id: string): string {
	if (!id) {
		return '—';
	}
	if (id.length <= 14) {
		return id;
	}
	return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function formatTime(date: Date): string {
	const hh = String(date.getHours()).padStart(2, '0');
	const mm = String(date.getMinutes()).padStart(2, '0');
	const ss = String(date.getSeconds()).padStart(2, '0');
	return `${hh}:${mm}:${ss}`;
}

function peerRouteTags(viaLan: boolean, viaPub: boolean): React.JSX.Element {
	const parts: React.JSX.Element[] = [];
	if (viaLan) {
		parts.push(
			<span key="lan" className="peers-card__tag peers-card__tag--lan">
				LAN
			</span>
		);
	}
	if (viaPub) {
		parts.push(
			<span key="remote" className="peers-card__tag peers-card__tag--remote">
				Remote
			</span>
		);
	}
	if (parts.length === 0) {
		parts.push(
			<span key="other" className="peers-card__tag peers-card__tag--muted">
				Other
			</span>
		);
	}
	return <div className="peers-card__tags">{parts}</div>;
}

type PeerPresence = 'live' | 'pending' | 'offline';

type RosterRow = {
	peerId: string;
	presence: PeerPresence;
	meta: string;
	viaLan: boolean;
	viaPub: boolean;
};

function describeLiveConnections(peerId: string, connected: ConnectedPeerInfo[]): string {
	const mine = connected.filter((c) => c.peerId === peerId);
	const lan = mine.find((c) => c.transport === 'lan-in' || c.transport === 'lan-out');
	const pub = mine.find((c) => c.transport === 'pub');
	if (lan) {
		return lan.transport === 'lan-out' && lan.via ? lan.via : 'incoming LAN connection';
	}
	if (pub) {
		return pub.via ? `reached via ${pub.via}` : 'reached via pub';
	}
	return 'Reachable';
}

function routeFlagsForPeer(
	peerId: string,
	seenById: Map<string, SeenPeerInfo>,
	connected: ConnectedPeerInfo[],
	lanDiscoveredPeerIds: Set<string>
): { viaLan: boolean; viaPub: boolean } {
	const s = seenById.get(peerId);
	let viaLan = s?.viaLan ?? false;
	let viaPub = s?.viaPub ?? false;
	if (lanDiscoveredPeerIds.has(peerId)) {
		viaLan = true;
	}
	for (const c of connected) {
		if (c.peerId !== peerId) {
			continue;
		}
		if (c.transport === 'lan-in' || c.transport === 'lan-out') {
			viaLan = true;
		}
		if (c.transport === 'pub') {
			viaPub = true;
		}
	}
	return { viaLan, viaPub };
}

type PeersRosterRowProps = {
	row: RosterRow;
	inviteEnabled: boolean;
	tryInvite: (peerId: string, label: string) => void;
};

function PeersRosterRow({ row, inviteEnabled, tryInvite }: PeersRosterRowProps): React.JSX.Element {
	const { peerId, presence, meta, viaLan, viaPub } = row;
	const dotOn = presence === 'live';
	const badgeClass =
		presence === 'live' ? 'task-card__badge--progress' : 'task-card__badge--todo';
	const badgeLabel = presence === 'live' ? 'connected' : presence === 'pending' ? 'pending' : 'offline';

	return (
		<article
			className={`task-card${inviteEnabled ? ' task-card--clickable' : ''}`}
			role={inviteEnabled ? 'button' : undefined}
			tabIndex={inviteEnabled ? 0 : undefined}
			onClick={
				inviteEnabled
					? () => {
							tryInvite(peerId, shortId(peerId));
						}
					: undefined
			}
			onKeyDown={
				inviteEnabled
					? (e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								tryInvite(peerId, shortId(peerId));
							}
						}
					: undefined
			}
		>
			<span className="peers-card__dot" data-status={dotOn ? 'on' : 'off'} aria-hidden />
			<div className="task-card__body">
				<h3 className="task-card__title" title={peerId}>
					{shortId(peerId)}
				</h3>
				<p className="task-card__meta">{meta}</p>
			</div>
			<div className="peers-card__aside">
				{peerRouteTags(viaLan, viaPub)}
				<span className={`task-card__badge ${badgeClass}`}>{badgeLabel}</span>
			</div>
		</article>
	);
}

type LoadState =
	| { kind: 'loading' }
	| { kind: 'ready'; status: NetworkStatus; updatedAt: Date }
	| { kind: 'error'; message: string };

export function PeersPage({ onInvitePeer, knownPeersDocumentUrl }: PeersPageProps): React.JSX.Element {
	const identity = useAppIdentity();
	const [state, setState] = useState<LoadState>({ kind: 'loading' });
	const [notice, setNotice] = useState<string | null>(null);
	const [, changeKnownPeers] = useDocument<KnownPeersDoc>(knownPeersDocumentUrl, { suspense: true });
	const lastLanProfileSig = useRef<string>('');

	const fetchStatus = useCallback(async (): Promise<void> => {
		const api = window.api?.network;

		if (!api) {
			setState({
				kind: 'error',
				message: 'Network status is unavailable in this environment.'
			});
			return;
		}

		try {
			const status = await api.getStatus();
			setState({ kind: 'ready', status, updatedAt: new Date() });
		} catch (err) {
			setState({
				kind: 'error',
				message: err instanceof Error ? err.message : 'Failed to load network status.'
			});
		}
	}, []);

	useEffect(() => {
		const initial = window.setTimeout(() => {
			void fetchStatus();
		}, 0);

		const handle = window.setInterval(() => {
			void fetchStatus();
		}, POLL_INTERVAL_MS);

		return () => {
			window.clearTimeout(initial);
			window.clearInterval(handle);
		};
	}, [fetchStatus]);

	const status = state.kind === 'ready' ? state.status : null;

	useEffect(() => {
		if (state.kind !== 'ready') {
			return;
		}
		const lanPeers = state.status.lanPeers;
		const parts: string[] = [];
		for (const p of lanPeers) {
			if (p.profileDocUrl) {
				parts.push(`${p.peerId}\t${p.profileDocUrl}`);
			}
		}
		parts.sort();
		const sig = parts.join('\n');
		if (sig === lastLanProfileSig.current) {
			return;
		}
		lastLanProfileSig.current = sig;
		changeKnownPeers((d) => {
			if (!Array.isArray(d.peers)) {
				d.peers = [];
			}
			for (const p of lanPeers) {
				if (p.profileDocUrl && isValidAutomergeUrl(p.profileDocUrl)) {
					upsertKnownPeer(d.peers, p.peerId, p.profileDocUrl);
				}
			}
		});
	}, [state, changeKnownPeers]);

	const inboxByPeerId = useMemo(() => {
		const m = new Map<string, string>();
		for (const p of status?.lanPeers ?? []) {
			if (p.inboxDocUrl) {
				m.set(p.peerId, p.inboxDocUrl);
			}
		}
		return m;
	}, [status]);

	const connectedLanPeers = useMemo(() => {
		if (!status) {
			return [] as ConnectedPeerInfo[];
		}
		return status.connectedPeers.filter(
			(peer) => peer.transport === 'lan-in' || peer.transport === 'lan-out'
		);
	}, [status]);

	const connectedLanPeerIds = useMemo(() => {
		return new Set(connectedLanPeers.map((peer) => peer.peerId));
	}, [connectedLanPeers]);

	const pendingLanPeers = useMemo(() => {
		if (!status) {
			return [];
		}
		return status.lanPeers.filter((peer) => !connectedLanPeerIds.has(peer.peerId));
	}, [status, connectedLanPeerIds]);

	const pendingLanPeerIds = useMemo(() => {
		return new Set(pendingLanPeers.map((p) => p.peerId));
	}, [pendingLanPeers]);

	const livePeerIds = useMemo(() => {
		if (!status) {
			return new Set<string>();
		}
		return new Set(status.connectedPeers.map((p) => p.peerId));
	}, [status]);

	const seenPeerById = useMemo(() => {
		const m = new Map<string, SeenPeerInfo>();
		for (const p of status?.seenPeers ?? []) {
			m.set(p.peerId, p);
		}
		return m;
	}, [status]);

	const lanDiscoveredPeerIds = useMemo(() => {
		return new Set((status?.lanPeers ?? []).map((p) => p.peerId));
	}, [status]);

	const offlineSeenUnknown = useMemo(() => {
		if (!status) {
			return [] as SeenPeerInfo[];
		}
		const self = identity.publicKeyId;
		return status.seenPeers.filter(
			(p) =>
				p.peerId !== self &&
				!livePeerIds.has(p.peerId) &&
				!inboxByPeerId.has(p.peerId)
		);
	}, [status, identity.publicKeyId, livePeerIds, inboxByPeerId]);

	const connectedRows = useMemo((): RosterRow[] => {
		if (!status) {
			return [];
		}
		const self = identity.publicKeyId;
		const rows: RosterRow[] = [];
		for (const peerId of inboxByPeerId.keys()) {
			if (peerId === self) {
				continue;
			}
			const { viaLan, viaPub } = routeFlagsForPeer(
				peerId,
				seenPeerById,
				status.connectedPeers,
				lanDiscoveredPeerIds
			);
			const live = livePeerIds.has(peerId);
			const pending = !live && pendingLanPeerIds.has(peerId);
			const presence: PeerPresence = live ? 'live' : pending ? 'pending' : 'offline';
			const lan = status.lanPeers.find((p) => p.peerId === peerId);
			let meta: string;
			if (live) {
				meta = describeLiveConnections(peerId, status.connectedPeers);
			} else if (pending && lan) {
				meta = lan.url;
			} else {
				meta = 'Inbox URL from LAN beacon';
			}
			rows.push({ peerId, presence, meta, viaLan, viaPub });
		}
		return rows.sort((a, b) => a.peerId.localeCompare(b.peerId));
	}, [
		status,
		identity.publicKeyId,
		inboxByPeerId,
		seenPeerById,
		lanDiscoveredPeerIds,
		livePeerIds,
		pendingLanPeerIds
	]);

	const unknownRows = useMemo((): RosterRow[] => {
		if (!status) {
			return [];
		}
		const self = identity.publicKeyId;
		const ids = new Set<string>();

		for (const p of offlineSeenUnknown) {
			ids.add(p.peerId);
		}
		for (const c of status.connectedPeers) {
			if (c.peerId !== self && !inboxByPeerId.has(c.peerId)) {
				ids.add(c.peerId);
			}
		}
		for (const lan of pendingLanPeers) {
			if (!inboxByPeerId.has(lan.peerId) && lan.peerId !== self) {
				ids.add(lan.peerId);
			}
		}

		const rows: RosterRow[] = [];
		for (const peerId of ids) {
			const { viaLan, viaPub } = routeFlagsForPeer(
				peerId,
				seenPeerById,
				status.connectedPeers,
				lanDiscoveredPeerIds
			);
			const live = livePeerIds.has(peerId);
			const pending = !live && pendingLanPeerIds.has(peerId);
			const presence: PeerPresence = live ? 'live' : pending ? 'pending' : 'offline';
			const lan = status.lanPeers.find((p) => p.peerId === peerId);
			let meta: string;
			if (live) {
				meta = describeLiveConnections(peerId, status.connectedPeers);
			} else if (pending && lan) {
				meta = lan.url;
			} else {
				meta = '';
			}
			rows.push({ peerId, presence, meta, viaLan, viaPub });
		}
		return rows.sort((a, b) => a.peerId.localeCompare(b.peerId));
	}, [
		status,
		identity.publicKeyId,
		inboxByPeerId,
		seenPeerById,
		lanDiscoveredPeerIds,
		livePeerIds,
		pendingLanPeerIds,
		pendingLanPeers,
		offlineSeenUnknown
	]);

	const lanPort = status?.lanPort ?? null;
	const networkError = status?.networkError ?? null;

	const tryInvite = (peerId: string, label: string): void => {
		const inboxUrl = inboxByPeerId.get(peerId);
		if (!inboxUrl) {
			setNotice(
				'No inbox URL for this peer yet. Wait for LAN discovery (v2 beacon), or the peer may be on an older build.'
			);
			return;
		}
		setNotice(null);
		onInvitePeer({ targetPeerId: peerId, targetInboxUrl: inboxUrl, label });
	};

	return (
		<>
			<header className="main__header">
				<div>
					<h1 className="main__title">Peers</h1>
					<p className="main__subtitle">
						{state.kind === 'ready'
							? `Last updated ${formatTime(state.updatedAt)}`
							: state.kind === 'loading'
								? 'Loading network status…'
								: state.kind === 'error'
									? state.message
									: ''}
					</p>
				</div>
				<div className="main__actions">
					<button
						type="button"
						className="btn-ghost"
						onClick={() => {
							void fetchStatus();
						}}
					>
						<IconSquare />
						Refresh
					</button>
				</div>
			</header>

			{notice ? (
				<p className="main__empty peers-device__error" role="status">
					{notice}
				</p>
			) : null}

			<section className="task-section" aria-labelledby="peers-device-heading">
				<h2 className="task-section__label" id="peers-device-heading">
					This device
				</h2>
				<div className="peers-device">
					<dl className="peers-device__grid">
						<div className="peers-device__row">
							<dt className="peers-device__term">Peer ID</dt>
							<dd className="peers-device__desc">
								<code className="peers-device__code" title={identity.publicKeyId}>
									{shortId(identity.publicKeyId)}
								</code>
							</dd>
						</div>
						<div className="peers-device__row">
							<dt className="peers-device__term">LAN port</dt>
							<dd className="peers-device__desc">
								{lanPort != null ? (
									<code className="peers-device__code">{lanPort}</code>
								) : (
									<span className="peers-device__muted">not listening</span>
								)}
							</dd>
						</div>
						{networkError ? (
							<div className="peers-device__row peers-device__row--full">
								<dt className="peers-device__term">LAN discovery</dt>
								<dd className="peers-device__desc peers-device__error" title={networkError}>
									{networkError}
								</dd>
							</div>
						) : null}
					</dl>
				</div>
			</section>

			<section className="task-section" aria-labelledby="peers-connected-heading">
				<h2 className="task-section__label" id="peers-connected-heading">
					Connected
				</h2>
				<p className="main__subtitle" style={{ marginBottom: '0.75rem' }}>
					Click to invite to workspaces.
				</p>
				{!status ? (
					<p className="main__empty">—</p>
				) : connectedRows.length === 0 ? (
					<p className="main__empty">No peers with a known inbox yet.</p>
				) : (
					<div className="task-list">
						{connectedRows.map((row) => (
							<PeersRosterRow key={row.peerId} row={row} inviteEnabled tryInvite={tryInvite} />
						))}
					</div>
				)}
			</section>

			<section className="task-section" aria-labelledby="peers-unknown-heading">
				<h2 className="task-section__label" id="peers-unknown-heading">
					Unknown
				</h2>
				{!status ? (
					<p className="main__empty">—</p>
				) : unknownRows.length === 0 ? (
					<p className="main__empty">No peers in this group.</p>
				) : (
					<div className="task-list">
						{unknownRows.map((row) => (
							<PeersRosterRow key={row.peerId} row={row} inviteEnabled={false} tryInvite={tryInvite} />
						))}
					</div>
				)}
			</section>
		</>
	);
}
