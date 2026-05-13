import { isValidAutomergeUrl, type AutomergeUrl, type Repo } from '@automerge/react';
import { createInitialRootDoc, ROOT_DOC_STORAGE_KEY, type RootDoc } from './workspaceDoc';

export async function getOrCreateWorkspaceRootUrl(repo: Repo): Promise<AutomergeUrl> {
	const stored = localStorage.getItem(ROOT_DOC_STORAGE_KEY);

	if (stored && isValidAutomergeUrl(stored)) {
		try {
			const handle = await repo.find<RootDoc>(stored);

			await handle.whenReady();

			if (!handle.isUnavailable()) return stored;
		} catch {
			// TODO
		}

		localStorage.removeItem(ROOT_DOC_STORAGE_KEY);
	}

	const handle = repo.create<RootDoc>(createInitialRootDoc());
	await handle.whenReady();

	const url = handle.url;

	localStorage.setItem(ROOT_DOC_STORAGE_KEY, url);

	return url;
}
