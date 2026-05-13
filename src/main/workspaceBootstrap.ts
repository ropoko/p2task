import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

import { isValidAutomergeUrl, type AutomergeUrl, type Repo } from '@automerge/automerge-repo';

import { createInitialRootDoc, type RootDoc } from '../shared/workspaceSchema';
import { p2taskDir } from './identityPaths';

const WORKSPACE_FILE = 'workspace.json';

type WorkspaceConfig = {
	rootDocUrl: string;
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
		return { rootDocUrl: (parsed as WorkspaceConfig).rootDocUrl };
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
	writeWorkspaceConfig({ rootDocUrl: url });
	return url;
}
