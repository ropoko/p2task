/** Automerge inbox document: invites received and sent (per device). */

export type InviteStatus = 'pending' | 'accepted' | 'declined';

export type InboxReceivedInvite = {
	inviteId: string;
	fromPeerId: string;
	fromNickname?: string;
	/** Inviter's replicating profile doc URL (LAN / sync). */
	inviterProfileDocUrl?: string;
	shareRootUrl: string;
	workspaceIds: string[];
	inviterInboxUrl: string;
	inviterSentInviteId: string;
	status: InviteStatus;
	createdAt: string;
	updatedAt?: string;
};

export type InboxSentInvite = {
	inviteId: string;
	toPeerId: string;
	targetInboxUrl: string;
	shareRootUrl: string;
	workspaceIds: string[];
	/** Inviter's profile doc URL (echo for sent list / future sync). */
	inviterProfileDocUrl?: string;
	status: InviteStatus;
	createdAt: string;
	updatedAt?: string;
};

export type InboxDoc = {
	received: InboxReceivedInvite[];
	sent: InboxSentInvite[];
};

export function createInitialInboxDoc(): InboxDoc {
	return {
		received: [],
		sent: []
	};
}
