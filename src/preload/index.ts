import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

import type { IdentityGetStatusResult, IdentityPublic } from '../shared/identityTypes';
import type { NetworkStatus } from '../shared/networkTypes';
import {
	P2TASK_IDENTITY_CREATE,
	P2TASK_IDENTITY_GET_STATUS,
	P2TASK_IDENTITY_UPDATE_PROFILE,
	P2TASK_NETWORK_GET_STATUS,
	P2TASK_REPO_GET_ROOT_URL,
	P2TASK_REPO_PORT_CHANNEL,
	P2TASK_REPO_REQUEST_PORT
} from '../shared/p2taskIpc';

// Forward MessagePorts arriving from the main process into the renderer's
// main world via `window.postMessage`. MessagePorts cannot reliably cross the
// `contextBridge` boundary inside a Promise; `window.postMessage` does
// preserve transferables across isolated worlds.
ipcRenderer.on(P2TASK_REPO_PORT_CHANNEL, (event) => {
	const ports = event.ports as unknown as MessagePort[];
	window.postMessage(P2TASK_REPO_PORT_CHANNEL, '*', ports);
});

const api = {
	identity: {
		getStatus(): Promise<IdentityGetStatusResult> {
			return ipcRenderer.invoke(P2TASK_IDENTITY_GET_STATUS);
		},
		create(payload: { nickname: string; email: string }): Promise<IdentityPublic> {
			return ipcRenderer.invoke(P2TASK_IDENTITY_CREATE, payload);
		},
		updateProfile(payload: { nickname: string; email: string }): Promise<IdentityPublic> {
			return ipcRenderer.invoke(P2TASK_IDENTITY_UPDATE_PROFILE, payload);
		}
	},

	repo: {
		/**
		 * Ask the main process to create a MessageChannel and transfer one
		 * end to the renderer. The port is delivered asynchronously to the
		 * renderer's main world via `window.postMessage` with data equal to
		 * `P2TASK_REPO_PORT_CHANNEL` (see `repoPortChannel`).
		 */
		requestPort(): Promise<void> {
			return ipcRenderer.invoke(P2TASK_REPO_REQUEST_PORT);
		},
		getRootUrl(): Promise<string> {
			return ipcRenderer.invoke(P2TASK_REPO_GET_ROOT_URL);
		},
		portChannel: P2TASK_REPO_PORT_CHANNEL
	},

	network: {
		getStatus(): Promise<NetworkStatus> {
			return ipcRenderer.invoke(P2TASK_NETWORK_GET_STATUS);
		}
	}
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld('electron', electronAPI);
		contextBridge.exposeInMainWorld('api', api);
	} catch (error) {
		console.error(error);
	}
} else {
	// @ts-ignore (define in dts)
	window.electron = electronAPI;
	// @ts-ignore (define in dts)
	window.api = api;
}
