import { ipcMain, MessageChannelMain, type MessagePortMain } from 'electron';

import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel';

import {
	P2TASK_REPO_GET_INBOX_URL,
	P2TASK_REPO_GET_KNOWN_PEERS_URL,
	P2TASK_REPO_GET_PEER_PROFILE_URL,
	P2TASK_REPO_GET_ROOT_URL,
	P2TASK_REPO_PORT_CHANNEL,
	P2TASK_REPO_REQUEST_PORT
} from '../shared/p2taskIpc';
import { trackAdapterPeers, untrackAdapterPeers } from './peerTransports';
import { bootRepoIfReady, getRepo, isRepoReady } from './repo';
import { getOrCreateInboxDocUrl, getOrCreateKnownPeersDocUrl, getOrCreatePeerProfileDocUrl, getOrCreateRootDocUrl } from './workspaceBootstrap';

/**
 * Adapts Electron's MessagePortMain (Node EventEmitter style: `.on`/`.off`)
 * to the browser MessagePort API that
 * `@automerge/automerge-repo-network-messagechannel` expects
 * (`addEventListener`, `postMessage`, `start`).
 *
 * Note: the transfer list passed to `postMessage` is intentionally dropped.
 * Electron's MessagePortMain only supports transferring other
 * MessagePortMain instances; passing an ArrayBuffer in the transfer list
 * causes the entire message payload to be lost on the receiving side
 * (electron/electron#34905). Dropping the transfer list forces the payload
 * to be structure-cloned (copied), which is correct, just slightly slower.
 */
class MessagePortMainAsBrowserShim {
	private readonly port: MessagePortMain;

	constructor(port: MessagePortMain) {
		this.port = port;
	}

	addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
		if (type !== 'message') {
			return;
		}
		this.port.on('message', (event) => {
			listener({ data: event.data });
		});
	}

	postMessage(message: unknown): void {
		this.port.postMessage(message);
	}

	start(): void {
		this.port.start();
	}

	close(): void {
		this.port.close();
	}
}

type Bridge = {
	adapter: MessageChannelNetworkAdapter;
	port: MessagePortMain;
};

const bridgesByWebContentsId = new Map<number, Bridge[]>();

function attachBridge(wcid: number, bridge: Bridge): void {
	const list = bridgesByWebContentsId.get(wcid) ?? [];
	list.push(bridge);
	bridgesByWebContentsId.set(wcid, list);
}

function tearDownBridgesFor(wcid: number): void {
	const list = bridgesByWebContentsId.get(wcid);
	if (!list) {
		return;
	}
	bridgesByWebContentsId.delete(wcid);
	if (!isRepoReady()) {
		return;
	}
	const repo = getRepo();
	for (const bridge of list) {
		untrackAdapterPeers(bridge.adapter);
		try {
			repo.networkSubsystem.removeNetworkAdapter(bridge.adapter);
		} catch {
			// Best-effort teardown; ignore.
		}
		try {
			bridge.port.close();
		} catch {
			// Best-effort teardown; ignore.
		}
	}
}

export function registerRepoIpcBridge(): void {
	ipcMain.handle(P2TASK_REPO_REQUEST_PORT, (event) => {
		const repo = bootRepoIfReady();
		if (!repo) {
			throw new Error('Repo is not ready. Identity must be created first.');
		}

		const { port1, port2 } = new MessageChannelMain();
		const shim = new MessagePortMainAsBrowserShim(port1);
		const adapter = new MessageChannelNetworkAdapter(shim as unknown as MessagePort, {
			useWeakRef: false
		});
		trackAdapterPeers(adapter, 'ipc', `renderer:${event.sender.id}`);
		repo.networkSubsystem.addNetworkAdapter(adapter);

		event.sender.postMessage(P2TASK_REPO_PORT_CHANNEL, null, [port2]);

		const wcid = event.sender.id;
		attachBridge(wcid, { adapter, port: port1 });

		event.sender.once('destroyed', () => {
			tearDownBridgesFor(wcid);
		});
	});

	ipcMain.handle(P2TASK_REPO_GET_ROOT_URL, async () => {
		const repo = bootRepoIfReady();
		if (!repo) {
			throw new Error('Repo is not ready. Identity must be created first.');
		}
		return getOrCreateRootDocUrl(repo);
	});

	ipcMain.handle(P2TASK_REPO_GET_INBOX_URL, async () => {
		const repo = bootRepoIfReady();
		if (!repo) {
			throw new Error('Repo is not ready. Identity must be created first.');
		}
		return getOrCreateInboxDocUrl(repo);
	});

	ipcMain.handle(P2TASK_REPO_GET_PEER_PROFILE_URL, async () => {
		const repo = bootRepoIfReady();
		if (!repo) {
			throw new Error('Repo is not ready. Identity must be created first.');
		}
		return getOrCreatePeerProfileDocUrl(repo);
	});

	ipcMain.handle(P2TASK_REPO_GET_KNOWN_PEERS_URL, async () => {
		const repo = bootRepoIfReady();
		if (!repo) {
			throw new Error('Repo is not ready. Identity must be created first.');
		}
		return getOrCreateKnownPeersDocUrl(repo);
	});
}
