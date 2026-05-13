import type { ElectronAPI } from '@electron-toolkit/preload';

import type { IdentityGetStatusResult, IdentityPublic } from '../shared/identityTypes';

export type P2taskApi = {
	identity: {
		getStatus(): Promise<IdentityGetStatusResult>;
		create(payload: { nickname: string; email: string }): Promise<IdentityPublic>;
		updateProfile(payload: { nickname: string; email: string }): Promise<IdentityPublic>;
	};
};

declare global {
	interface Window {
		electron: ElectronAPI;
		api?: P2taskApi;
	}
}

export {};
