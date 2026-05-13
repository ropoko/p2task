/**
 * Default TCP port for the LAN Automerge WebSocket server.
 * Override with the `P2TASK_LAN_PORT` environment variable (1–65535).
 */
export const DEFAULT_LAN_SYNC_PORT = 53842;

export function resolveLanListenPort(): number {
	const raw = process.env['P2TASK_LAN_PORT'];

	if (raw === undefined || raw === '') {
		return DEFAULT_LAN_SYNC_PORT;
	}

	const n = Number.parseInt(raw, 10);

	if (!Number.isInteger(n) || n < 1 || n > 65535) {
		console.warn(
			`Invalid P2TASK_LAN_PORT ${JSON.stringify(raw)}; using default ${DEFAULT_LAN_SYNC_PORT}`
		);
		return DEFAULT_LAN_SYNC_PORT;
	}

	return n;
}
