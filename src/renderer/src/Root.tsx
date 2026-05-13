import { Suspense, useEffect, useState } from 'react';

import {
	MessageChannelNetworkAdapter,
	Repo,
	RepoContext,
	isValidAutomergeUrl,
	type AutomergeUrl
} from '@automerge/react';

import App from './App';
import { LoadingRoot } from './components/LoadingRoot';
import type { AppIdentity } from './identity/appIdentity';
import { IdentityProvider } from './identity/identityContext';
import { WelcomeIdentityPage } from './views/WelcomeIdentityPage';
import type { IdentityPublic } from '../../shared/identityTypes';

type BootState =
	| { phase: 'loading' }
	| { phase: 'welcome' }
	| { phase: 'unavailable' }
	| { phase: 'ready'; workspaceUrl: AutomergeUrl; identity: AppIdentity; repo: Repo };

async function awaitRepoPort(channel: string): Promise<MessagePort> {
	return new Promise<MessagePort>((resolve) => {
		const handler = (event: MessageEvent): void => {
			if (event.source !== window || event.data !== channel) {
				return;
			}
			const port = event.ports[0];
			if (!port) {
				return;
			}
			window.removeEventListener('message', handler);
			resolve(port);
		};
		window.addEventListener('message', handler);
	});
}

/**
 * Strips the transfer list when forwarding `postMessage` calls to the real
 * MessagePort. Electron's MessagePortMain only accepts other MessagePortMain
 * instances as transferables; when the Automerge adapter transfers an
 * ArrayBuffer to the main process the entire message payload is dropped
 * (electron/electron#34905). Forcing a structure-clone copy is correct and
 * costs only a memcpy per sync chunk.
 */
function wrapPortStripTransfers(port: MessagePort): MessagePort {
	return {
		addEventListener: port.addEventListener.bind(port),
		removeEventListener: port.removeEventListener.bind(port),
		postMessage(message: unknown): void {
			port.postMessage(message);
		},
		start(): void {
			port.start();
		},
		close(): void {
			port.close();
		},
		dispatchEvent(event: Event): boolean {
			return port.dispatchEvent(event);
		},
		set onmessage(value: ((this: MessagePort, ev: MessageEvent) => unknown) | null) {
			port.onmessage = value;
		},
		set onmessageerror(value: ((this: MessagePort, ev: MessageEvent) => unknown) | null) {
			port.onmessageerror = value;
		}
	} as unknown as MessagePort;
}

async function buildRepoAndUrl(): Promise<{ repo: Repo; workspaceUrl: AutomergeUrl }> {
	const repoApi = window.api?.repo;
	if (!repoApi) {
		throw new Error('Main process repo API is unavailable.');
	}
	const portPromise = awaitRepoPort(repoApi.portChannel);
	await repoApi.requestPort();
	const port = await portPromise;
	const wrappedPort = wrapPortStripTransfers(port);
	const repo = new Repo({
		network: [new MessageChannelNetworkAdapter(wrappedPort, { useWeakRef: false })]
	});
	const rawUrl = await repoApi.getRootUrl();
	if (!isValidAutomergeUrl(rawUrl)) {
		throw new Error(`Main process returned an invalid Automerge URL: ${rawUrl}`);
	}
	return { repo, workspaceUrl: rawUrl };
}

export function Root(): React.JSX.Element {
	const [boot, setBoot] = useState<BootState>({ phase: 'loading' });

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			const idApi = window.api?.identity;
			if (!idApi) {
				if (!cancelled) {
					setBoot({ phase: 'unavailable' });
				}
				return;
			}

			try {
				const status = await idApi.getStatus();
				if (cancelled) {
					return;
				}
				if (!status.exists) {
					setBoot({ phase: 'welcome' });
					return;
				}
				const { repo, workspaceUrl } = await buildRepoAndUrl();
				if (cancelled) {
					return;
				}
				setBoot({
					phase: 'ready',
					workspaceUrl,
					repo,
					identity: {
						publicKeyId: status.publicKeyId,
						nickname: status.nickname,
						email: status.email,
						isFallback: false
					}
				});
			} catch {
				if (!cancelled) {
					setBoot({ phase: 'welcome' });
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const handleWelcomeSuccess = async (identity: IdentityPublic): Promise<void> => {
		const { repo, workspaceUrl } = await buildRepoAndUrl();
		setBoot({
			phase: 'ready',
			workspaceUrl,
			repo,
			identity: { ...identity, isFallback: false }
		});
	};

	if (boot.phase === 'loading') {
		return <LoadingRoot />;
	}

	if (boot.phase === 'unavailable') {
		return <LoadingRoot />;
	}

	if (boot.phase === 'welcome') {
		return <WelcomeIdentityPage onSuccess={handleWelcomeSuccess} />;
	}

	return (
		<IdentityProvider value={boot.identity}>
			<RepoContext.Provider value={boot.repo}>
				<Suspense fallback={<LoadingRoot />}>
					<App workspaceDocumentUrl={boot.workspaceUrl} />
				</Suspense>
			</RepoContext.Provider>
		</IdentityProvider>
	);
}
