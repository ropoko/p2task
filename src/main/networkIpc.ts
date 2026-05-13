import { ipcMain } from 'electron';

import { P2TASK_NETWORK_GET_STATUS } from '../shared/p2taskIpc';
import type { NetworkStatus } from '../shared/networkTypes';
import { getLanDiscoveredPeers } from './lanDiscovery';
import { getLanServerPort } from './lanServer';
import { getPubClientStatuses } from './pubClients';
import { isRepoReady, getRepo } from './repo';

function snapshot(): NetworkStatus {
	const lanPort = getLanServerPort();
	const lanPeers = getLanDiscoveredPeers();
	const pubs = getPubClientStatuses();
	const connectedPeerIds = isRepoReady() ? [...getRepo().peers] : [];
	return { lanPort, lanPeers, pubs, connectedPeerIds };
}

export function registerNetworkIpc(): void {
	ipcMain.handle(P2TASK_NETWORK_GET_STATUS, (): NetworkStatus => snapshot());
}
