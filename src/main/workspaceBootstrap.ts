import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

import { isValidAutomergeUrl, type AutomergeUrl, type Repo } from '@automerge/automerge-repo';

import { createInitialInboxDoc, type InboxDoc } from '../shared/inboxSchema';
import {
	createInitialKnownPeersDoc,
	createInitialPeerProfileDoc,
	type KnownPeersDoc,
	type PeerProfileDoc
} from '../shared/peerDirectorySchema';
import { createInitialRootDoc, type RootDoc } from '../shared/workspaceSchema';
import { getIdentityStatus } from './identityStore';
import { p2taskDir } from './identityPaths';

const WORKSPACE_FILE = 'workspace.json';

type WorkspaceConfig = {
	rootDocUrl: string;
	inboxDocUrl?: string;
	peerProfileDocUrl?: string;
	knownPeersDocUrl?: string;
};

function workspaceConfigPath(): string {
	return join(p2taskDir(), WORKSPACE_FILE);
}

function readWorkspaceConfig(): WorkspaceConfig | null {
	const path = workspaceConfigPath();
	if (!existsSync(path)) {
		return null;
	}
	try {
		const raw = readFileSync(path, 'utf8');
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			typeof (parsed as WorkspaceConfig).rootDocUrl !== 'string'
		) {
			return null;
		}
		const p = parsed as WorkspaceConfig;
		const out: WorkspaceConfig = { rootDocUrl: p.rootDocUrl };
		if (typeof p.inboxDocUrl === 'string') {
			out.inboxDocUrl = p.inboxDocUrl;
		}
		if (typeof p.peerProfileDocUrl === 'string') {
			out.peerProfileDocUrl = p.peerProfileDocUrl;
		}
		if (typeof p.knownPeersDocUrl === 'string') {
			out.knownPeersDocUrl = p.knownPeersDocUrl;
		}
		return out;
	} catch {
		return null;
	}
}

function writeWorkspaceConfig(config: WorkspaceConfig): void {
	const path = workspaceConfigPath();
	const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(config, null, '\t')}\n`, { encoding: 'utf8' });
	if (existsSync(path)) {
		unlinkSync(path);
	}
	renameSync(tmp, path);
}

/**
 * Returns the persisted root doc URL, creating a fresh root document on first
 * boot. The URL is stored alongside identity in `~/.p2task/workspace.json`.
 */
export async function getOrCreateRootDocUrl(repo: Repo): Promise<AutomergeUrl> {
	const config = readWorkspaceConfig();
	if (config && isValidAutomergeUrl(config.rootDocUrl)) {
		try {
			const handle = await repo.find<RootDoc>(config.rootDocUrl);
			await handle.whenReady();
			if (!handle.isUnavailable()) {
				return config.rootDocUrl;
			}
		} catch {
			// Fall through and create a fresh root doc below.
		}
	}

	const handle = repo.create<RootDoc>(createInitialRootDoc());
	await handle.whenReady();
	const url = handle.url;
	const prev = readWorkspaceConfig();
	writeWorkspaceConfig({
		rootDocUrl: url,
		...(prev?.inboxDocUrl ? { inboxDocUrl: prev.inboxDocUrl } : {}),
		...(prev?.peerProfileDocUrl ? { peerProfileDocUrl: prev.peerProfileDocUrl } : {}),
		...(prev?.knownPeersDocUrl ? { knownPeersDocUrl: prev.knownPeersDocUrl } : {})
	});
	return url;
}

/**
 * Returns the persisted inbox doc URL, creating one on first use / migration.
 * Depends on a valid root doc URL already being on disk (call after getOrCreateRootDocUrl).
 */
export async function getOrCreateInboxDocUrl(repo: Repo): Promise<AutomergeUrl> {
	await getOrCreateRootDocUrl(repo);
	const config = readWorkspaceConfig();
	if (!config) {
		throw new Error('workspace.json missing after root bootstrap');
	}
	if (config.inboxDocUrl && isValidAutomergeUrl(config.inboxDocUrl)) {
		try {
			const handle = await repo.find<InboxDoc>(config.inboxDocUrl);
			await handle.whenReady();
			if (!handle.isUnavailable()) {
				return config.inboxDocUrl;
			}
		} catch {
			// Fall through and create a fresh inbox doc below.
		}
	}

	const handle = repo.create<InboxDoc>(createInitialInboxDoc());
	await handle.whenReady();
	const inboxUrl = handle.url;
	writeWorkspaceConfig({ ...config, inboxDocUrl: inboxUrl });
	return inboxUrl;
}

/**
 * Replicating public profile (nickname / email) for this peer identity.
 */
export async function getOrCreatePeerProfileDocUrl(repo: Repo): Promise<AutomergeUrl> {
	await getOrCreateRootDocUrl(repo);
	const config = readWorkspaceConfig();
	if (!config) {
		throw new Error('workspace.json missing after root bootstrap');
	}
	if (config.peerProfileDocUrl && isValidAutomergeUrl(config.peerProfileDocUrl)) {
		try {
			const handle = await repo.find<PeerProfileDoc>(config.peerProfileDocUrl);
			await handle.whenReady();
			if (!handle.isUnavailable()) {
				return config.peerProfileDocUrl;
			}
		} catch {
			// Fall through and create a fresh profile doc below.
		}
	}

	const id = getIdentityStatus();
	if (!id.exists) {
		throw new Error('Identity is required to create a peer profile document.');
	}

	const handle = repo.create<PeerProfileDoc>(
		createInitialPeerProfileDoc({
			peerId: id.publicKeyId,
			nickname: id.nickname,
			email: id.email
		})
	);
	await handle.whenReady();
	const profileUrl = handle.url;
	writeWorkspaceConfig({ ...config, peerProfileDocUrl: profileUrl });
	return profileUrl;
}

/**
 * Local roster of peerId → profile Automerge URL.
 */
export async function getOrCreateKnownPeersDocUrl(repo: Repo): Promise<AutomergeUrl> {
	await getOrCreateRootDocUrl(repo);
	const config = readWorkspaceConfig();
	if (!config) {
		throw new Error('workspace.json missing after root bootstrap');
	}
	if (config.knownPeersDocUrl && isValidAutomergeUrl(config.knownPeersDocUrl)) {
		try {
			const handle = await repo.find<KnownPeersDoc>(config.knownPeersDocUrl);
			await handle.whenReady();
			if (!handle.isUnavailable()) {
				return config.knownPeersDocUrl;
			}
		} catch {
			// Fall through and create a fresh known-peers doc below.
		}
	}

	const handle = repo.create<KnownPeersDoc>(createInitialKnownPeersDoc());
	await handle.whenReady();
	const knownUrl = handle.url;
	writeWorkspaceConfig({ ...config, knownPeersDocUrl: knownUrl });
	return knownUrl;
}
