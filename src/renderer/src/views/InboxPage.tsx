import type { Repo } from '@automerge/automerge-repo';
import { isValidAutomergeUrl } from '@automerge/automerge-repo';
import { useDocument, useRepo, type AutomergeUrl } from '@automerge/react';
import { useCallback, useState } from 'react';

import type { InboxDoc, InviteStatus, KnownPeersDoc, RootDoc } from '../workspace/workspaceDoc';
import { upsertKnownPeer } from '../workspace/workspaceDoc';

type InboxPageProps = {
	inboxDocumentUrl: AutomergeUrl;
	knownPeersDocumentUrl: AutomergeUrl;
	changeLocalRoot: (fn: (d: RootDoc) => void) => void;
	myNickname: string;
};

function isoNow(): string {
	return new Date().toISOString();
}

const FIND_POLL_MS = 200;
const FIND_TIMEOUT_MS = 45_000;

const FIND_READY_OR_UNAVAILABLE = ['ready', 'unavailable'] as const;

/**
 * Updates the inviter's `sent` row. Waits until this replica has received that row
 * from the network; otherwise `change` would no-op and Alice would never see accept/decline.
 *
 * Uses `allowableStates: ['ready','unavailable']` so `find` does not throw while the repo is
 * still requesting the document from peers (default `find` rejects immediately on unavailable).
 */
async function patchInboxSentWhenSynced(
	repo: Repo,
	inboxUrl: AutomergeUrl,
	inviteId: string,
	status: InviteStatus
): Promise<void> {
	const deadline = Date.now() + FIND_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const handle = await repo.find<InboxDoc>(inboxUrl, {
			allowableStates: [...FIND_READY_OR_UNAVAILABLE]
		});
		await handle.whenReady([...FIND_READY_OR_UNAVAILABLE]);

		if (handle.isUnavailable()) {
			await new Promise<void>((resolve) => {
				window.setTimeout(resolve, FIND_POLL_MS);
			});
			continue;
		}

		if (!handle.isReady()) {
			await new Promise<void>((resolve) => {
				window.setTimeout(resolve, FIND_POLL_MS);
			});
			continue;
		}

		let doc: InboxDoc;
		try {
			doc = handle.doc();
		} catch {
			await new Promise<void>((resolve) => {
				window.setTimeout(resolve, FIND_POLL_MS);
			});
			continue;
		}

		const sent = doc.sent ?? [];
		const row = sent.find((s) => s.inviteId === inviteId);
		if (row) {
			handle.change((d) => {
				const list = d.sent;
				if (!Array.isArray(list)) {
					return;
				}
				const r = list.find((s) => s.inviteId === inviteId);
				if (r) {
					r.status = status;
					r.updatedAt = isoNow();
				}
			});
			return;
		}

		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, FIND_POLL_MS);
		});
	}

	throw new Error(
		'Could not open the inviter inbox from this device. Stay on the same LAN, keep both apps running, and try again—or ask the inviter to resend after you are connected.'
	);
}

export function InboxPage({
	inboxDocumentUrl,
	knownPeersDocumentUrl,
	changeLocalRoot,
	myNickname
}: InboxPageProps): React.JSX.Element {
	const repo = useRepo();
	const [inboxDoc, changeInbox] = useDocument<InboxDoc>(inboxDocumentUrl, { suspense: true });
	const [, changeKnownPeers] = useDocument<KnownPeersDoc>(knownPeersDocumentUrl, { suspense: true });
	const [actionError, setActionError] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	const respond = useCallback(
		async (inviteId: string, status: InviteStatus) => {
			const inv = (inboxDoc.received ?? []).find((r) => r.inviteId === inviteId);
			if (!inv || inv.status !== 'pending') {
				return;
			}
			setBusyId(inviteId);
			setActionError(null);
			try {
				// Inviter first: their `sent` row must exist on our replica (synced over the repo).
				// If we updated `received` first, users would see "accepted" locally while the remote
				// never updated because patchInboxSent had no matching `sent` row yet.
				await patchInboxSentWhenSynced(
					repo,
					inv.inviterInboxUrl as AutomergeUrl,
					inv.inviterSentInviteId,
					status
				);

				changeInbox((d) => {
					const list = d.received;
					if (!Array.isArray(list)) {
						return;
					}
					const row = list.find((x) => x.inviteId === inviteId);
					if (row && row.status === 'pending') {
						row.status = status;
						row.updatedAt = isoNow();
					}
				});

				if (status === 'accepted') {
					changeLocalRoot((d) => {
						if (!d.acceptedShares) {
							d.acceptedShares = [];
						}
						const dup = d.acceptedShares.some(
							(s) =>
								s.shareRootUrl === inv.shareRootUrl &&
								s.fromPeerId === inv.fromPeerId &&
								JSON.stringify([...s.workspaceIds].sort()) ===
									JSON.stringify([...inv.workspaceIds].sort())
						);
						if (dup) {
							return;
						}
						d.acceptedShares.push({
							id: crypto.randomUUID(),
							shareRootUrl: inv.shareRootUrl,
							workspaceIds: [...inv.workspaceIds],
							fromPeerId: inv.fromPeerId,
							fromNickname: inv.fromNickname?.trim() || undefined,
							acceptedAt: isoNow()
						});
					});
					if (inv.inviterProfileDocUrl && isValidAutomergeUrl(inv.inviterProfileDocUrl)) {
						const profileUrl = inv.inviterProfileDocUrl;
						changeKnownPeers((d) => {
							if (!Array.isArray(d.peers)) {
								d.peers = [];
							}
							upsertKnownPeer(d.peers, inv.fromPeerId, profileUrl);
						});
					}
				}
			} catch (e) {
				setActionError(e instanceof Error ? e.message : 'Invite update failed.');
			} finally {
				setBusyId(null);
			}
		},
		[changeInbox, changeKnownPeers, changeLocalRoot, inboxDoc, repo]
	);

	const received = inboxDoc.received ?? [];
	const sent = inboxDoc.sent ?? [];

	return (
		<>
			<header className="main__header">
				<h1 className="main__title">Inbox</h1>
				<p className="main__subtitle">Workspace invites and responses (synced with Automerge).</p>
			</header>

			{actionError ? (
				<p className="main__empty peers-device__error" role="alert">
					{actionError}
				</p>
			) : null}

			<section className="task-section" aria-labelledby="inbox-received-heading">
				<h2 className="task-section__label" id="inbox-received-heading">
					Received
				</h2>
				{received.length === 0 ? (
					<p className="main__empty">No invites yet.</p>
				) : (
					<div className="task-list">
						{[...received]
							.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
							.map((row) => (
								<article key={row.inviteId} className="task-card">
									<div className="task-card__body">
										<h3 className="task-card__title">
											From {row.fromNickname?.trim() || row.fromPeerId.slice(0, 12)}
										</h3>
										<p className="task-card__meta">
											Workspaces: {row.workspaceIds.length} · {row.status}
										</p>
									</div>
									<span
										className={`task-card__badge task-card__badge--${
											row.status === 'pending'
												? 'todo'
												: row.status === 'accepted'
													? 'progress'
													: 'todo'
										}`}
									>
										{row.status}
									</span>
									{row.status === 'pending' ? (
										<div className="inbox-card__actions">
											<button
												type="button"
												className="btn-ghost"
												disabled={busyId === row.inviteId}
												onClick={() => {
													void respond(row.inviteId, 'accepted');
												}}
											>
												Accept
											</button>
											<button
												type="button"
												className="btn-ghost"
												disabled={busyId === row.inviteId}
												onClick={() => {
													void respond(row.inviteId, 'declined');
												}}
											>
												Decline
											</button>
										</div>
									) : null}
								</article>
							))}
					</div>
				)}
			</section>

			<section className="task-section" aria-labelledby="inbox-sent-heading">
				<h2 className="task-section__label" id="inbox-sent-heading">
					Sent
				</h2>
				{sent.length === 0 ? (
					<p className="main__empty">No outgoing invites yet.</p>
				) : (
					<div className="task-list">
						{[...sent]
							.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
							.map((row) => (
								<article key={row.inviteId} className="task-card">
									<div className="task-card__body">
										<h3 className="task-card__title">To {row.toPeerId.slice(0, 12)}…</h3>
										<p className="task-card__meta">
											{row.workspaceIds.length} workspace(s) · {row.status}
										</p>
									</div>
									<span
										className={`task-card__badge task-card__badge--${
											row.status === 'pending'
												? 'todo'
												: row.status === 'accepted'
													? 'progress'
													: 'todo'
										}`}
									>
										{row.status}
									</span>
								</article>
							))}
					</div>
				)}
			</section>

			<p className="main__subtitle" aria-live="polite" style={{ marginTop: '1rem' }}>
				Signed in as {myNickname.trim() || 'You'}
			</p>
		</>
	);
}
