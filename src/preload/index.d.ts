import type { ElectronAPI } from '@electron-toolkit/preload';

import type { IdentityGetStatusResult, IdentityPublic } from '../shared/identityTypes';
import type { NetworkStatus } from '../shared/networkTypes';

export type P2taskApi = {
	identity: {
		getStatus(): Promise<IdentityGetStatusResult>;
		create(payload: { nickname: string; email: string }): Promise<IdentityPublic>;
		updateProfile(payload: { nickname: string; email: string }): Promise<IdentityPublic>;
	};

	repo: {
		requestPort(): Promise<void>;
		getRootUrl(): Promise<string>;
		portChannel: string;
	};

	network: {
		getStatus(): Promise<NetworkStatus>;
	};
};

declare global {
	interface Window {
		electron: ElectronAPI;
		api?: P2taskApi;
	}
}

export {};
