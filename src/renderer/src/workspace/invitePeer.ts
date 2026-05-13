import type { Repo } from '@automerge/automerge-repo';
import type { AutomergeUrl } from '@automerge/react';

import type { InboxDoc } from '../../../shared/inboxSchema';

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

	const targetHandle = await opts.repo.find<InboxDoc>(opts.targetInboxUrl);
	await targetHandle.whenReady();
	if (targetHandle.isUnavailable()) {
		throw new Error('Could not open the peer inbox document (offline or invalid URL).');
	}

	const selfHandle = await opts.repo.find<InboxDoc>(opts.myInboxUrl);
	await selfHandle.whenReady();
	if (selfHandle.isUnavailable()) {
		throw new Error('Local inbox document is unavailable.');
	}

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
