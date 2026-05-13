import { DEFAULT_CREATED_BY } from '../workspace/workspaceDoc';

export type AppIdentity = {
	publicKeyId: string;
	nickname: string;
	email: string;
	isFallback: boolean;
};

export function fallbackIdentity(): AppIdentity {
	return {
		publicKeyId: DEFAULT_CREATED_BY,
		nickname: '',
		email: '',
		isFallback: true
	};
}
