#!/usr/bin/env node
/**
 * Minimal UDP broadcast smoke test (no Electron).
 * Defaults must stay aligned with src/main/lanDiscoveryPort.ts (UDP) and
 * src/main/lanPort.ts (WebSocket port in JSON is only illustrative here).
 */
const dgram = require('node:dgram');
const os = require('node:os');

const DISCOVERY_PORT = Number(process.env.P2TASK_LAN_DISCOVERY_PORT) || 53428;
const INTERVAL_MS = 3000;

function pickLanIpv4() {
	for (const list of Object.values(os.networkInterfaces())) {
		if (!list) continue;
		for (const a of list) {
			if (!a || a.internal) continue;
			if (a.family !== 'IPv4') continue;
			return a.address;
		}
	}
	return null;
}

const host = pickLanIpv4();
const me = {
	v: 1,
	peerId: `smoke-${process.pid}`,
	wsPort: Number(process.env.P2TASK_LAN_PORT) || 53842,
	...(host ? { host } : {})
};

const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const peers = new Map();

socket.on('message', (msg, rinfo) => {
	if (rinfo.family !== 'IPv4') return;
	let data;
	try {
		data = JSON.parse(msg.toString('utf8'));
	} catch {
		return;
	}
	if (data.peerId === me.peerId) return;
	const key = `${rinfo.address}:${data.peerId}`;
	if (!peers.has(key)) {
		console.log('peer:', key, data);
	}
	peers.set(key, { ...data, lastSeen: Date.now() });
});

socket.bind(DISCOVERY_PORT, () => {
	socket.setBroadcast(true);
	console.log('smoke beacon on UDP', DISCOVERY_PORT, 'as', me);
	setInterval(() => {
		const buf = Buffer.from(JSON.stringify(me), 'utf8');
		socket.send(buf, DISCOVERY_PORT, '255.255.255.255');
	}, INTERVAL_MS);
	setInterval(() => {
		const t = Date.now();
		for (const [k, p] of peers) {
			if (t - p.lastSeen > INTERVAL_MS * 3) peers.delete(k);
		}
	}, INTERVAL_MS);
});
