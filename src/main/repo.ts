import { existsSync } from 'fs';
import { join } from 'path';

import { Repo, type PeerId } from '@automerge/automerge-repo';
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs';

import { identityPaths, p2taskDir } from './identityPaths';
import { getIdentityStatus } from './identityStore';

const AUTOMERGE_DIR = 'automerge';

let repoInstance: Repo | null = null;

export function isRepoReady(): boolean {
	return repoInstance !== null;
}

export function getRepo(): Repo {
	if (!repoInstance) {
		throw new Error('Repo is not ready. Call bootRepoIfReady() after identity is set up.');
	}
	return repoInstance;
}

/**
 * Construct the Repo if identity exists on disk. Idempotent: safe to call
 * multiple times. Returns the Repo if ready, null otherwise.
 */
export function bootRepoIfReady(): Repo | null {
	if (repoInstance) {
		return repoInstance;
	}

	const paths = identityPaths();
	if (!existsSync(paths.privateKey) || !existsSync(paths.publicKey)) {
		return null;
	}

	const status = getIdentityStatus();
	if (!status.exists) {
		return null;
	}

	const storageDir = join(p2taskDir(), AUTOMERGE_DIR);
	const storage = new NodeFSStorageAdapter(storageDir);

	repoInstance = new Repo({
		storage,
		network: [],
		peerId: status.publicKeyId as PeerId
	});

	return repoInstance;
}
