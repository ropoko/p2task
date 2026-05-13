import { Suspense, useEffect, useState } from 'react';

import {
	BroadcastChannelNetworkAdapter,
	IndexedDBStorageAdapter,
	Repo,
	RepoContext,
	type AutomergeUrl
} from '@automerge/react';

import App from './App';
import { LoadingRoot } from './components/LoadingRoot';
import { fallbackIdentity, type AppIdentity } from './identity/appIdentity';
import { IdentityProvider } from './identity/identityContext';
import { WelcomeIdentityPage } from './views/WelcomeIdentityPage';
import type { IdentityPublic } from '../../shared/identityTypes';
import { getOrCreateWorkspaceRootUrl } from './workspace/bootstrapRootDocument';

const repo = new Repo({
	network: [new BroadcastChannelNetworkAdapter()],
	storage: new IndexedDBStorageAdapter()
});

type BootState =
	| { phase: 'loading' }
	| { phase: 'welcome' }
	| { phase: 'ready'; workspaceUrl: AutomergeUrl; identity: AppIdentity };

export function Root(): React.JSX.Element {
	const [boot, setBoot] = useState<BootState>({ phase: 'loading' });

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			const idApi = window.api?.identity;
			if (!idApi) {
				const workspaceUrl = await getOrCreateWorkspaceRootUrl(repo);
				if (cancelled) {
					return;
				}
				setBoot({ phase: 'ready', workspaceUrl, identity: fallbackIdentity() });
				return;
			}

			try {
				const status = await idApi.getStatus();
				if (cancelled) {
					return;
				}
				if (status.exists) {
					const workspaceUrl = await getOrCreateWorkspaceRootUrl(repo);
					if (cancelled) {
						return;
					}
					setBoot({
						phase: 'ready',
						workspaceUrl,
						identity: {
							publicKeyId: status.publicKeyId,
							nickname: status.nickname,
							email: status.email,
							isFallback: false
						}
					});
				} else {
					setBoot({ phase: 'welcome' });
				}
			} catch {
				if (cancelled) {
					return;
				}
				setBoot({ phase: 'welcome' });
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const handleWelcomeSuccess = async (identity: IdentityPublic): Promise<void> => {
		const workspaceUrl = await getOrCreateWorkspaceRootUrl(repo);
		setBoot({
			phase: 'ready',
			workspaceUrl,
			identity: { ...identity, isFallback: false }
		});
	};

	if (boot.phase === 'loading') {
		return <LoadingRoot />;
	}

	if (boot.phase === 'welcome') {
		return <WelcomeIdentityPage onSuccess={handleWelcomeSuccess} />;
	}

	return (
		<IdentityProvider value={boot.identity}>
			<RepoContext.Provider value={repo}>
				<Suspense fallback={<LoadingRoot />}>
					<App workspaceDocumentUrl={boot.workspaceUrl} />
				</Suspense>
			</RepoContext.Provider>
		</IdentityProvider>
	);
}
