import type { DocHandle, Repo } from '@automerge/automerge-repo';
import type { AutomergeUrl } from '@automerge/react';

import type { InboxDoc } from '../../../shared/inboxSchema';

const FIND_POLL_MS = 200;
const FIND_TIMEOUT_MS = 45_000;
const FIND_READY_OR_UNAVAILABLE = ['ready', 'unavailable'] as const;

async function waitForInboxHandle(repo: Repo, url: AutomergeUrl): Promise<DocHandle<InboxDoc>> {
	const deadline = Date.now() + FIND_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const handle = await repo.find<InboxDoc>(url, {
			allowableStates: [...FIND_READY_OR_UNAVAILABLE]
		});
		await handle.whenReady([...FIND_READY_OR_UNAVAILABLE]);
		if (handle.isReady()) {
			return handle;
		}
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, FIND_POLL_MS);
		});
	}
	throw new Error(
		'Could not reach that inbox document yet. Confirm both peers are on the same LAN and try again.'
	);
}

export async function invitePeerToWorkspaces(opts: {
	repo: Repo;
	myPeerId: string;
	myNickname: string;
	myInboxUrl: AutomergeUrl;
	shareRootUrl: AutomergeUrl;
	targetInboxUrl: AutomergeUrl;
	targetPeerId: string;
	workspaceIds: string[];
}): Promise<void> {
	const inviteId = crypto.randomUUID();
	const now = new Date().toISOString();
	const inviterSentInviteId = inviteId;

	const targetHandle = await waitForInboxHandle(opts.repo, opts.targetInboxUrl);

	const selfHandle = await waitForInboxHandle(opts.repo, opts.myInboxUrl);

	selfHandle.change((d) => {
		if (!Array.isArray(d.sent)) {
			d.sent = [];
		}
		d.sent.push({
			inviteId,
			toPeerId: opts.targetPeerId,
			targetInboxUrl: opts.targetInboxUrl,
			shareRootUrl: opts.shareRootUrl,
			workspaceIds: [...opts.workspaceIds],
			status: 'pending',
			createdAt: now
		});
	});

	targetHandle.change((d) => {
		if (!Array.isArray(d.received)) {
			d.received = [];
		}
		d.received.push({
			inviteId,
			fromPeerId: opts.myPeerId,
			fromNickname: opts.myNickname.trim() || undefined,
			shareRootUrl: opts.shareRootUrl,
			workspaceIds: [...opts.workspaceIds],
			inviterInboxUrl: opts.myInboxUrl,
			inviterSentInviteId,
			status: 'pending',
			createdAt: now
		});
	});
}
