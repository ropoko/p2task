import { useDocument, type AutomergeUrl } from '@automerge/react';
import type { JSX } from 'react';

import { PeerDirectoryName } from './PeerDirectoryName';
import type { KnownPeersDoc } from '../workspace/workspaceDoc';

export type SharedWorkspacePeerRow = {
	peerId: string;
	snapshotLabel: string;
	badge: 'owner' | 'you' | null;
	canRemove?: boolean;
};

type SharedWorkspacePeersRailProps = {
	rows: SharedWorkspacePeerRow[];
	knownPeersDocumentUrl: AutomergeUrl;
	onRemovePeer?: (peerId: string) => void;
};

export function SharedWorkspacePeersRail({
	rows,
	knownPeersDocumentUrl,
	onRemovePeer
}: SharedWorkspacePeersRailProps): JSX.Element {
	const [knownPeersDoc] = useDocument<KnownPeersDoc>(knownPeersDocumentUrl, { suspense: true });

	return (
		<aside className="workspace-peers-rail" aria-label="Workspace peers">
			<h2 className="workspace-peers-rail__title">Peers</h2>
			<ul className="workspace-peers-rail__list">
				{rows.map((row) => (
					<li key={row.peerId} className="workspace-peers-rail__item">
						<div className="workspace-peers-rail__row">
							<span className="workspace-peers-rail__name" title={row.peerId}>
								<PeerDirectoryName
									peerId={row.peerId}
									snapshotLabel={row.snapshotLabel}
									knownPeers={knownPeersDoc}
								/>
							</span>
							<div className="workspace-peers-rail__meta">
								{row.badge === 'owner' ? (
									<span className="workspace-peers-rail__badge">Owner</span>
								) : row.badge === 'you' ? (
									<span className="workspace-peers-rail__badge workspace-peers-rail__badge--you">
										You
									</span>
								) : null}
								{row.canRemove && onRemovePeer ? (
									<button
										type="button"
										className="workspace-peers-rail__remove"
										aria-label={`Remove ${row.snapshotLabel} from workspace`}
										onClick={() => {
											onRemovePeer(row.peerId);
										}}
									>
										Remove
									</button>
								) : null}
							</div>
						</div>
					</li>
				))}
			</ul>
		</aside>
	);
}
