import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

import { isValidAutomergeUrl, type AutomergeUrl, type Repo } from '@automerge/automerge-repo';

import { createInitialInboxDoc, type InboxDoc } from '../shared/inboxSchema';
import { createInitialRootDoc, type RootDoc } from '../shared/workspaceSchema';
import { p2taskDir } from './identityPaths';

const WORKSPACE_FILE = 'workspace.json';

type WorkspaceConfig = {
	rootDocUrl: string;
	inboxDocUrl?: string;
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
		...(prev?.inboxDocUrl ? { inboxDocUrl: prev.inboxDocUrl } : {})
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
