import type { AutomergeUrl } from '@automerge/react';

const LOCAL_PREFIX = 'local:';
const SHARE_PREFIX = 'share:';

export function makeLocalWorkspaceKey(workspaceId: string): string {
	return `${LOCAL_PREFIX}${workspaceId}`;
}

export function makeSharedWorkspaceKey(shareRootUrl: string, workspaceId: string): string {
	return `${SHARE_PREFIX}${encodeURIComponent(shareRootUrl)}:${workspaceId}`;
}

export type ParsedWorkspaceKey =
	| { kind: 'local'; workspaceId: string }
	| { kind: 'share'; shareRootUrl: AutomergeUrl; workspaceId: string };

export function parseWorkspaceKey(key: string): ParsedWorkspaceKey | null {
	if (key.startsWith(LOCAL_PREFIX)) {
		const workspaceId = key.slice(LOCAL_PREFIX.length);
		return workspaceId ? { kind: 'local', workspaceId } : null;
	}
	if (!key.startsWith(SHARE_PREFIX)) {
		return null;
	}
	const rest = key.slice(SHARE_PREFIX.length);
	const colon = rest.indexOf(':');
	if (colon <= 0) {
		return null;
	}
	const enc = rest.slice(0, colon);
	const workspaceId = rest.slice(colon + 1);
	if (!workspaceId) {
		return null;
	}
	try {
		const shareRootUrl = decodeURIComponent(enc) as AutomergeUrl;
		return { kind: 'share', shareRootUrl, workspaceId };
	} catch {
		return null;
	}
}
