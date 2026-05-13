import { ipcMain } from 'electron';

import {
	P2TASK_IDENTITY_CREATE,
	P2TASK_IDENTITY_GET_STATUS,
	P2TASK_IDENTITY_UPDATE_PROFILE
} from '../shared/p2taskIpc';
import { createIdentity, getIdentityStatus, updateProfile } from './identityStore';

export function registerIdentityIpc(): void {
	ipcMain.handle(P2TASK_IDENTITY_GET_STATUS, () => getIdentityStatus());

	ipcMain.handle(P2TASK_IDENTITY_CREATE, (_event, payload: unknown) => {
		if (
			typeof payload !== 'object' ||
			payload === null ||
			typeof (payload as { nickname?: unknown }).nickname !== 'string' ||
			typeof (payload as { email?: unknown }).email !== 'string'
		) {
			throw new Error('Invalid identity payload');
		}
		const { nickname, email } = payload as { nickname: string; email: string };
		return createIdentity({ nickname, email });
	});

	ipcMain.handle(P2TASK_IDENTITY_UPDATE_PROFILE, (_event, payload: unknown) => {
		if (
			typeof payload !== 'object' ||
			payload === null ||
			typeof (payload as { nickname?: unknown }).nickname !== 'string' ||
			typeof (payload as { email?: unknown }).email !== 'string'
		) {
			throw new Error('Invalid identity payload');
		}
		const { nickname, email } = payload as { nickname: string; email: string };
		return updateProfile({ nickname, email });
	});
}
