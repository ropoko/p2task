export type IdentityGetStatusResult =
	| { exists: false }
	| { exists: true; publicKeyId: string; nickname: string; email: string };

export type IdentityPublic = {
	publicKeyId: string;
	nickname: string;
	email: string;
};
