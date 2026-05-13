/**
 * Dedicated UDP port for LAN peer beacons (broadcast), separate from the
 * Automerge WebSocket TCP port. Override with `P2TASK_LAN_DISCOVERY_PORT`.
 */
export const DEFAULT_LAN_DISCOVERY_UDP_PORT = 53428;

export function resolveLanDiscoveryUdpPort(): number {
	const raw = process.env['P2TASK_LAN_DISCOVERY_PORT'];
	if (raw === undefined || raw === '') {
		return DEFAULT_LAN_DISCOVERY_UDP_PORT;
	}
	const n = Number.parseInt(raw, 10);
	if (!Number.isInteger(n) || n < 1 || n > 65535) {
		console.warn(
			`Invalid P2TASK_LAN_DISCOVERY_PORT ${JSON.stringify(raw)}; using default ${DEFAULT_LAN_DISCOVERY_UDP_PORT}`
		);
		return DEFAULT_LAN_DISCOVERY_UDP_PORT;
	}
	return n;
}
