import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

import { p2taskDir } from './identityPaths';

const PUBS_FILE = 'pubs.json';

type PubsConfig = {
	pubs: string[];
};

function pubsConfigPath(): string {
	return join(p2taskDir(), PUBS_FILE);
}

function isValidPubUrl(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0) {
		return false;
	}
	return value.startsWith('ws://') || value.startsWith('wss://');
}

function readPubsConfig(): string[] {
	const path = pubsConfigPath();
	if (!existsSync(path)) {
		return [];
	}
	try {
		const raw = readFileSync(path, 'utf8');
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!Array.isArray((parsed as PubsConfig).pubs)
		) {
			return [];
		}
		return (parsed as PubsConfig).pubs.filter(isValidPubUrl);
	} catch {
		return [];
	}
}

export function writePubsConfig(urls: string[]): void {
	const path = pubsConfigPath();
	const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
	const data: PubsConfig = { pubs: urls.filter(isValidPubUrl) };
	writeFileSync(tmp, `${JSON.stringify(data, null, '\t')}\n`, { encoding: 'utf8' });
	if (existsSync(path)) {
		unlinkSync(path);
	}
	renameSync(tmp, path);
}

/**
 * Return the configured pub URLs. In development, the `P2TASK_PUB_URL`
 * environment variable overrides the file (single-pub override).
 */
export function getConfiguredPubUrls(): string[] {
	const envOverride = process.env['P2TASK_PUB_URL'];
	if (envOverride && isValidPubUrl(envOverride)) {
		return [envOverride];
	}
	return readPubsConfig();
}
