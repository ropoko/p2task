import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

import type { IdentityGetStatusResult, IdentityPublic } from '../shared/identityTypes';
import {
	P2TASK_IDENTITY_CREATE,
	P2TASK_IDENTITY_GET_STATUS,
	P2TASK_IDENTITY_UPDATE_PROFILE
} from '../shared/p2taskIpc';

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
