import { useDocument, type AutomergeUrl } from '@automerge/react';
import { useLayoutEffect } from 'react';

import type { RootDoc } from '../workspace/workspaceDoc';

export type ShareDocBundle = {
	doc: RootDoc;
	changeDoc: (fn: (d: RootDoc) => void) => void;
};

type ShareDocSyncProps = {
	url: AutomergeUrl;
	onUpdate: (url: AutomergeUrl, bundle: ShareDocBundle) => void;
};

/**
 * Keeps a secondary root document mounted for sync; notifies parent when the
 * handle or document snapshot updates.
 */
export function ShareDocSync({ url, onUpdate }: ShareDocSyncProps): null {
	const [doc, changeDoc] = useDocument<RootDoc>(url, { suspense: true });
	useLayoutEffect(() => {
		onUpdate(url, { doc, changeDoc });
	}, [url, doc, changeDoc, onUpdate]);
	return null;
}
