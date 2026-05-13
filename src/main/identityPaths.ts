import { homedir } from 'os';
import { join } from 'path';

export const PRIVATE_KEY_FILE = 'ed25519_private.pem';
export const PUBLIC_KEY_FILE = 'ed25519_public.pem';
export const PROFILE_FILE = 'profile.json';

export function p2taskDir(): string {
	return join(homedir(), '.p2task');
}

export function identityPaths(): {
	dir: string;
	privateKey: string;
	publicKey: string;
	profile: string;
} {
	const dir = p2taskDir();
	return {
		dir,
		privateKey: join(dir, PRIVATE_KEY_FILE),
		publicKey: join(dir, PUBLIC_KEY_FILE),
		profile: join(dir, PROFILE_FILE)
	};
}
