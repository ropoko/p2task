import { ipcMain } from 'electron';

import { P2TASK_NETWORK_GET_STATUS } from '../shared/p2taskIpc';
import type { NetworkStatus } from '../shared/networkTypes';
import { getLanDiscoveredPeers } from './lanDiscovery';
import { getLanServerPort } from './lanServer';
import { getLastNetworkBootError } from './networkBoot';
import { getConnectedPeers, getSeenPeers } from './peerTransports';
import { getPubClientStatuses } from './pubClients';

function snapshot(): NetworkStatus {
	const lanPort = getLanServerPort();
	const lanPeers = getLanDiscoveredPeers();
	const pubs = getPubClientStatuses();
	const connectedPeers = getConnectedPeers();
	const seenPeers = getSeenPeers();
	const networkError = getLastNetworkBootError();

	return { lanPort, networkError, lanPeers, pubs, connectedPeers, seenPeers };
}

export function registerNetworkIpc(): void {
	ipcMain.handle(P2TASK_NETWORK_GET_STATUS, (): NetworkStatus => snapshot());
}
