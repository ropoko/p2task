import { createPublicKey, generateKeyPairSync, type JsonWebKey } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';

import type { IdentityGetStatusResult, IdentityPublic } from '../shared/identityTypes';
import { identityPaths } from './identityPaths';

export type { IdentityGetStatusResult, IdentityPublic } from '../shared/identityTypes';

type ProfileJson = {
	nickname: string;
	email: string;
};

const MAX_NICKNAME = 80;
const MAX_EMAIL = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicKeyIdFromPublicPem(pem: string): string {
	const jwk = createPublicKey(pem).export({ format: 'jwk' }) as JsonWebKey;
	if (jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string' || !jwk.x) {
		throw new Error('Invalid Ed25519 public key');
	}
	return jwk.x;
}

/** Create path via temp file + rename (new files only). */
function writeNewFileUtf8(filePath: string, data: string): void {
	const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tmp, data, { encoding: 'utf8' });
	renameSync(tmp, filePath);
}

/** Replace existing file (Windows-safe: unlink target before rename). */
function writeUtf8Replace(filePath: string, data: string): void {
	const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tmp, data, { encoding: 'utf8' });
	if (existsSync(filePath)) {
		unlinkSync(filePath);
	}
	renameSync(tmp, filePath);
}

function validateProfileFields(nickname: string, email: string): void {
	if (!nickname || nickname.length > MAX_NICKNAME) {
		throw new Error(`Nickname must be 1–${MAX_NICKNAME} characters`);
	}
	if (!email || email.length > MAX_EMAIL) {
		throw new Error(`Email must be 1–${MAX_EMAIL} characters`);
	}
	if (!EMAIL_PATTERN.test(email)) {
		throw new Error('Email format is invalid');
	}
}

function parseProfile(raw: string): ProfileJson {
	const parsed: unknown = JSON.parse(raw);
	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		typeof (parsed as ProfileJson).nickname !== 'string' ||
		typeof (parsed as ProfileJson).email !== 'string'
	) {
		throw new Error('Invalid profile.json');
	}
	return { nickname: (parsed as ProfileJson).nickname, email: (parsed as ProfileJson).email };
}

export function getIdentityStatus(): IdentityGetStatusResult {
	const p = identityPaths();
	if (!existsSync(p.privateKey)) {
		return { exists: false };
	}
	const publicPem = readFileSync(p.publicKey, 'utf8');
	const profileRaw = readFileSync(p.profile, 'utf8');
	const profile = parseProfile(profileRaw);
	validateProfileFields(profile.nickname.trim(), profile.email.trim());
	const publicKeyId = publicKeyIdFromPublicPem(publicPem);
	return {
		exists: true,
		publicKeyId,
		nickname: profile.nickname.trim(),
		email: profile.email.trim().toLowerCase()
	};
}

export function createIdentity(input: { nickname: string; email: string }): IdentityPublic {
	const nickname = input.nickname.trim();
	const email = input.email.trim().toLowerCase();
	validateProfileFields(nickname, email);

	const p = identityPaths();
	mkdirSync(p.dir, { recursive: true });

	if (existsSync(p.privateKey)) {
		throw new Error('Identity already exists');
	}

	const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
		publicKeyEncoding: { type: 'spki', format: 'pem' },
		privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
	});

	const publicKeyId = publicKeyIdFromPublicPem(publicKey);
	const profile: ProfileJson = { nickname, email };
	const profileJson = `${JSON.stringify(profile, null, '\t')}\n`;

	const written: string[] = [];
	try {
		writeNewFileUtf8(p.privateKey, privateKey);
		written.push(p.privateKey);
		writeNewFileUtf8(p.publicKey, publicKey);
		written.push(p.publicKey);
		writeNewFileUtf8(p.profile, profileJson);
		written.push(p.profile);
	} catch (err) {
		for (const path of written) {
			try {
				unlinkSync(path);
			} catch {
				// best-effort cleanup
			}
		}
		throw err;
	}

	return { publicKeyId, nickname, email };
}

export function updateProfile(input: { nickname: string; email: string }): IdentityPublic {
	const nickname = input.nickname.trim();
	const email = input.email.trim().toLowerCase();
	validateProfileFields(nickname, email);

	const p = identityPaths();
	if (!existsSync(p.privateKey) || !existsSync(p.publicKey)) {
		throw new Error('Identity is not set up');
	}

	const publicPem = readFileSync(p.publicKey, 'utf8');
	const publicKeyId = publicKeyIdFromPublicPem(publicPem);
	const profile: ProfileJson = { nickname, email };
	const profileJson = `${JSON.stringify(profile, null, '\t')}\n`;

	writeUtf8Replace(p.profile, profileJson);

	return { publicKeyId, nickname, email };
}
