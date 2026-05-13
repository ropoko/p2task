import { useCallback, useEffect, useMemo, useState } from 'react';

import { IconSquare } from '../components/IconSquare';
import { useAppIdentity } from '../identity/identityContext';
import type { NetworkStatus } from '../../../shared/networkTypes';

const POLL_INTERVAL_MS = 2000;

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

type LoadState =
	| { kind: 'loading' }
	| { kind: 'ready'; status: NetworkStatus; updatedAt: Date }
	| { kind: 'error'; message: string };

export function PeersPage(): React.JSX.Element {
	const identity = useAppIdentity();
	const [state, setState] = useState<LoadState>({ kind: 'loading' });

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

	const localPeerIdSet = useMemo(() => {
		if (!status) {
			return new Set<string>();
		}
		return new Set(status.lanPeers.map((p) => p.peerId));
	}, [status]);

	const remotePeerIds = useMemo(() => {
		if (!status) {
			return [] as string[];
		}
		return status.connectedPeerIds.filter((id) => !localPeerIdSet.has(id));
	}, [status, localPeerIdSet]);

	const connectedSet = useMemo(() => {
		if (!status) {
			return new Set<string>();
		}
		return new Set(status.connectedPeerIds);
	}, [status]);

	const lanPort = status?.lanPort ?? null;

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
					</dl>
				</div>
			</section>

			<section className="task-section" aria-labelledby="peers-local-heading">
				<h2 className="task-section__label" id="peers-local-heading">
					Local (LAN)
				</h2>
				{!status ? (
					<p className="main__empty">—</p>
				) : status.lanPeers.length === 0 ? (
					<p className="main__empty">No peers discovered on this network yet.</p>
				) : (
					<div className="task-list">
						{status.lanPeers.map((peer) => {
							const connected = connectedSet.has(peer.peerId);
							return (
								<article key={peer.peerId} className="task-card">
									<span
										className="peers-card__dot"
										data-status={connected ? 'on' : 'off'}
										aria-hidden
									/>
									<div className="task-card__body">
										<h3 className="task-card__title" title={peer.peerId}>
											{shortId(peer.peerId)}
										</h3>
										<p className="task-card__meta">{peer.url}</p>
									</div>
									<span
										className={`task-card__badge task-card__badge--${
											connected ? 'progress' : 'todo'
										}`}
									>
										{connected ? 'connected' : 'pending'}
									</span>
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
				{status && remotePeerIds.length > 0 ? (
					<div className="task-list peers-list--nested">
						{remotePeerIds.map((peerId) => (
							<article key={peerId} className="task-card">
								<span className="peers-card__dot" data-status="on" aria-hidden />
								<div className="task-card__body">
									<h3 className="task-card__title" title={peerId}>
										{shortId(peerId)}
									</h3>
									<p className="task-card__meta">reached via pub</p>
								</div>
								<span className="task-card__badge task-card__badge--progress">connected</span>
							</article>
						))}
					</div>
				) : null}
			</section>
		</>
	);
}
