import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import {
	BroadcastChannelNetworkAdapter,
	IndexedDBStorageAdapter,
	Repo,
	RepoContext
} from '@automerge/react';

import App from './App';
import { LoadingRoot } from './components/LoadingRoot';
import './assets/app.css';
import './assets/tokens.css';
import { getOrCreateWorkspaceRootUrl } from './workspace/bootstrapRootDocument';

const repo = new Repo({
	network: [new BroadcastChannelNetworkAdapter()],
	storage: new IndexedDBStorageAdapter()
});

async function start(): Promise<void> {
	const workspaceDocumentUrl = await getOrCreateWorkspaceRootUrl(repo);

	createRoot(document.getElementById('root')!).render(
		<StrictMode>
			<RepoContext.Provider value={repo}>
				<Suspense fallback={<LoadingRoot />}>
					<App workspaceDocumentUrl={workspaceDocumentUrl} />
				</Suspense>
			</RepoContext.Provider>
		</StrictMode>
	);
}

void start();
