import { useCallback, useEffect, useMemo, useState } from 'react';

import { IconSquare } from '../components/IconSquare';
import { useAppIdentity } from '../identity/identityContext';
import type { ConnectedPeerInfo, NetworkStatus } from '../../../shared/networkTypes';

const POLL_INTERVAL_MS = 2000;

export type InvitePeerDraft = {
	targetPeerId: string;
	targetInboxUrl: string;
	label: string;
};

type PeersPageProps = {
	onInvitePeer: (draft: InvitePeerDraft) => void;
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

function connectedPeerKey(peer: ConnectedPeerInfo): string {
	return `${peer.transport}:${peer.via ?? ''}:${peer.peerId}`;
}

type LoadState =
	| { kind: 'loading' }
	| { kind: 'ready'; status: NetworkStatus; updatedAt: Date }
	| { kind: 'error'; message: string };

export function PeersPage({ onInvitePeer }: PeersPageProps): React.JSX.Element {
	const identity = useAppIdentity();
	const [state, setState] = useState<LoadState>({ kind: 'loading' });
	const [notice, setNotice] = useState<string | null>(null);

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

	const pubPeers = useMemo(() => {
		if (!status) {
			return [] as ConnectedPeerInfo[];
		}
		return status.connectedPeers.filter((peer) => peer.transport === 'pub');
	}, [status]);

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

			<section className="task-section" aria-labelledby="peers-local-heading">
				<h2 className="task-section__label" id="peers-local-heading">
					Local (LAN)
				</h2>
				<p className="main__subtitle" style={{ marginBottom: '0.75rem' }}>
					Click a peer to invite them to one or more workspaces (requires inbox from LAN beacon).
				</p>
				{!status ? (
					<p className="main__empty">—</p>
				) : connectedLanPeers.length === 0 && pendingLanPeers.length === 0 ? (
					<p className="main__empty">No peers discovered on this network yet.</p>
				) : (
					<div className="task-list">
						{connectedLanPeers.map((peer) => {
							const hasInbox = inboxByPeerId.has(peer.peerId);
							return (
								<article
									key={connectedPeerKey(peer)}
									className={`task-card${hasInbox ? ' task-card--clickable' : ''}`}
									role={hasInbox ? 'button' : undefined}
									tabIndex={hasInbox ? 0 : undefined}
									onClick={
										hasInbox
											? () => {
													tryInvite(peer.peerId, shortId(peer.peerId));
												}
											: undefined
									}
									onKeyDown={
										hasInbox
											? (e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														tryInvite(peer.peerId, shortId(peer.peerId));
													}
												}
											: undefined
									}
								>
									<span className="peers-card__dot" data-status="on" aria-hidden />
									<div className="task-card__body">
										<h3 className="task-card__title" title={peer.peerId}>
											{shortId(peer.peerId)}
										</h3>
										<p className="task-card__meta">
											{peer.transport === 'lan-out' && peer.via
												? peer.via
												: 'incoming LAN connection'}
											{hasInbox ? '' : ' · inbox URL unknown'}
										</p>
									</div>
									<span className="task-card__badge task-card__badge--progress">connected</span>
								</article>
							);
						})}
						{pendingLanPeers.map((peer) => {
							const hasInbox = inboxByPeerId.has(peer.peerId);
							return (
								<article
									key={peer.peerId}
									className={`task-card${hasInbox ? ' task-card--clickable' : ''}`}
									role={hasInbox ? 'button' : undefined}
									tabIndex={hasInbox ? 0 : undefined}
									onClick={
										hasInbox
											? () => {
													tryInvite(peer.peerId, shortId(peer.peerId));
												}
											: undefined
									}
									onKeyDown={
										hasInbox
											? (e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														tryInvite(peer.peerId, shortId(peer.peerId));
													}
												}
											: undefined
									}
								>
									<span className="peers-card__dot" data-status="off" aria-hidden />
									<div className="task-card__body">
										<h3 className="task-card__title" title={peer.peerId}>
											{shortId(peer.peerId)}
										</h3>
										<p className="task-card__meta">{peer.url}</p>
									</div>
									<span className="task-card__badge task-card__badge--todo">pending</span>
								</article>
							);
						})}
					</div>
				)}
			</section>

			<section className="task-section" aria-labelledby="peers-remote-heading">
				<h2 className="task-section__label" id="peers-remote-heading">
					Remote (pubs)
				</h2>
				{!status ? (
					<p className="main__empty">—</p>
				) : status.pubs.length === 0 ? (
					<p className="main__empty">No pubs configured.</p>
				) : (
					<div className="task-list">
						{status.pubs.map((pub) => (
							<article key={pub.url} className="task-card">
								<span
									className="peers-card__dot"
									data-status={pub.connected ? 'on' : 'off'}
									aria-hidden
								/>
								<div className="task-card__body">
									<h3 className="task-card__title">{pub.url}</h3>
									<p className="task-card__meta">relay</p>
								</div>
								<span
									className={`task-card__badge task-card__badge--${
										pub.connected ? 'progress' : 'todo'
									}`}
								>
									{pub.connected ? 'connected' : 'offline'}
								</span>
							</article>
						))}
					</div>
				)}
				{status && pubPeers.length > 0 ? (
					<div className="task-list peers-list--nested">
						{pubPeers.map((peer) => {
							const hasInbox = inboxByPeerId.has(peer.peerId);
							return (
								<article
									key={connectedPeerKey(peer)}
									className={`task-card${hasInbox ? ' task-card--clickable' : ''}`}
									role={hasInbox ? 'button' : undefined}
									tabIndex={hasInbox ? 0 : undefined}
									onClick={
										hasInbox
											? () => {
													tryInvite(peer.peerId, shortId(peer.peerId));
												}
											: undefined
									}
									onKeyDown={
										hasInbox
											? (e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														tryInvite(peer.peerId, shortId(peer.peerId));
													}
												}
											: undefined
									}
								>
									<span className="peers-card__dot" data-status="on" aria-hidden />
									<div className="task-card__body">
										<h3 className="task-card__title" title={peer.peerId}>
											{shortId(peer.peerId)}
										</h3>
										<p className="task-card__meta">
											{peer.via ? `reached via ${peer.via}` : 'reached via pub'}
											{hasInbox ? '' : ' · inbox URL unknown (LAN only today)'}
										</p>
									</div>
									<span className="task-card__badge task-card__badge--progress">connected</span>
								</article>
							);
						})}
					</div>
				) : null}
			</section>
		</>
	);
}
