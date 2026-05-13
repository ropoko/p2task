import { useDocument, useRepo, type AutomergeUrl } from '@automerge/react';
import { useCallback, useMemo, useState } from 'react';

import { AppSidebar, type AppRoute } from './components/AppSidebar';
import { IconSquare } from './components/IconSquare';
import { InviteToWorkspacesDialog } from './components/InviteToWorkspacesDialog';
import { ShareDocSync, type ShareDocBundle } from './components/ShareDocSync';
import { useAppIdentity } from './identity/identityContext';
import { FocusPage } from './views/FocusPage';
import { InboxPage } from './views/InboxPage';
import { MyTasksPage } from './views/MyTasksPage';
import { PeersPage } from './views/PeersPage';
import { WorkspaceKanbanPage } from './views/WorkspaceKanbanPage';
import { WorkspaceNotesPage } from './views/WorkspaceNotesPage';
import { invitePeerToWorkspaces } from './workspace/invitePeer';
import { createDefaultWorkspace, type RootDoc } from './workspace/workspaceDoc';
import {
	makeLocalWorkspaceKey,
	makeSharedWorkspaceKey,
	parseWorkspaceKey
} from './workspace/workspaceKeys';
import {
	acceptedSharesInDoc,
	backlogTasks,
	defaultFocusTask,
	doneColumnId,
	getWorkspaceById,
	isListedTask,
	todayTasks,
	workspacesInDoc
} from './workspace/workspaceSelectors';

export type AppProps = {
	workspaceDocumentUrl: AutomergeUrl;
	inboxDocumentUrl: AutomergeUrl;
};

type AppView = 'normal' | 'focus';

type SidebarWorkspaceItem = {
	key: string;
	name: string;
};

type InviteDraft = {
	targetPeerId: string;
	targetInboxUrl: string;
	label: string;
};

export default function App({
	workspaceDocumentUrl,
	inboxDocumentUrl
}: AppProps): React.JSX.Element {
	const repo = useRepo();
	const { publicKeyId: createdByUserId, nickname } = useAppIdentity();
	const [localDoc, changeLocalDoc] = useDocument<RootDoc>(workspaceDocumentUrl, { suspense: true });

	const [shareDocMap, setShareDocMap] = useState(() => new Map<AutomergeUrl, ShareDocBundle>());
	const onShareUpdate = useCallback((url: AutomergeUrl, bundle: ShareDocBundle) => {
		setShareDocMap((prev) => {
			const next = new Map(prev);
			next.set(url, bundle);
			return next;
		});
	}, []);

	const acceptedShares = acceptedSharesInDoc(localDoc);
	const distinctShareRootUrls = useMemo(
		() => [...new Set(acceptedShares.map((s) => s.shareRootUrl))] as AutomergeUrl[],
		[acceptedShares]
	);

	const sidebarWorkspaces = useMemo((): SidebarWorkspaceItem[] => {
		const items: SidebarWorkspaceItem[] = [];
		for (const w of workspacesInDoc(localDoc)) {
			items.push({ key: makeLocalWorkspaceKey(w.id), name: w.name });
		}
		for (const share of acceptedShares) {
			const bundle = shareDocMap.get(share.shareRootUrl as AutomergeUrl);
			if (!bundle) {
				continue;
			}
			const doc = bundle.doc;
			for (const wid of share.workspaceIds) {
				const ws = workspacesInDoc(doc).find((x) => x.id === wid);
				if (ws) {
					const short =
						share.fromPeerId.length > 10 ? `${share.fromPeerId.slice(0, 8)}…` : share.fromPeerId;
					items.push({
						key: makeSharedWorkspaceKey(share.shareRootUrl, ws.id),
						name: `${ws.name} (shared · ${short})`
					});
				}
			}
		}
		return items;
	}, [localDoc, acceptedShares, shareDocMap]);

	const [rawWorkspaceKey, setRawWorkspaceKey] = useState<string | null>(null);
	const resolvedWorkspaceKey = useMemo(() => {
		if (rawWorkspaceKey && sidebarWorkspaces.some((w) => w.key === rawWorkspaceKey)) {
			return rawWorkspaceKey;
		}
		return sidebarWorkspaces[0]?.key ?? '';
	}, [rawWorkspaceKey, sidebarWorkspaces]);

	const activeParsed = useMemo(
		() => parseWorkspaceKey(resolvedWorkspaceKey),
		[resolvedWorkspaceKey]
	);

	const { activeDoc, changeActiveDoc } = useMemo(() => {
		const p = activeParsed;
		if (!p) {
			return { activeDoc: localDoc, changeActiveDoc: changeLocalDoc };
		}
		if (p.kind === 'local') {
			return { activeDoc: localDoc, changeActiveDoc: changeLocalDoc };
		}
		const bundle = shareDocMap.get(p.shareRootUrl);
		if (!bundle) {
			return { activeDoc: localDoc, changeActiveDoc: changeLocalDoc };
		}
		return { activeDoc: bundle.doc, changeActiveDoc: bundle.changeDoc };
	}, [activeParsed, localDoc, changeLocalDoc, shareDocMap]);

	const activeWorkspaceId = activeParsed?.workspaceId ?? '';
	const activeWorkspace = activeWorkspaceId
		? getWorkspaceById(activeDoc, activeWorkspaceId)
		: undefined;

	const [route, setRoute] = useState<AppRoute>('workspace');
	const [workspaceTab, setWorkspaceTab] = useState<'kanban' | 'notes'>('kanban');
	const [view, setView] = useState<AppView>('normal');
	const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
	const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);

	const today = useMemo(
		() => (activeWorkspaceId ? todayTasks(activeDoc, activeWorkspaceId) : []),
		[activeDoc, activeWorkspaceId]
	);
	const backlog = useMemo(
		() => (activeWorkspaceId ? backlogTasks(activeDoc, activeWorkspaceId) : []),
		[activeDoc, activeWorkspaceId]
	);

	const resolvedFocus = useMemo(() => {
		if (!activeWorkspaceId) {
			return undefined;
		}
		const ws = getWorkspaceById(activeDoc, activeWorkspaceId);
		if (!ws) {
			return undefined;
		}
		if (focusTaskId) {
			const hit = ws.tasks.find((t) => t.id === focusTaskId && isListedTask(t, ws));
			if (hit) {
				return hit;
			}
		}
		return defaultFocusTask(activeDoc, activeWorkspaceId);
	}, [activeDoc, activeWorkspaceId, focusTaskId]);

	const focusIndex = resolvedFocus ? today.findIndex((t) => t.id === resolvedFocus.id) + 1 : 0;
	const focusLabel =
		today.length > 0 && focusIndex > 0 ? `${focusIndex} of ${today.length} today` : '0 of 0 today';

	const goNormal = (): void => setView('normal');
	const goFocus = (): void => setView('focus');

	const markFocusTaskDone = (): void => {
		if (!resolvedFocus || !activeWorkspaceId) {
			return;
		}
		changeActiveDoc((d) => {
			const list = d.workspaces;
			if (!Array.isArray(list)) {
				return;
			}
			const ws = list.find((w) => w.id === activeWorkspaceId);
			if (!ws) {
				return;
			}
			const doneId = doneColumnId(ws);
			if (!doneId) {
				return;
			}
			const t = ws.tasks.find((x) => x.id === resolvedFocus.id);
			if (!t) {
				return;
			}
			t.columnId = doneId;
			t.selectedForToday = false;
		});
		goNormal();
	};

	const addWorkspace = (): void => {
		const nw = createDefaultWorkspace('Untitled');
		changeLocalDoc((d) => {
			if (!Array.isArray(d.workspaces)) {
				d.workspaces = [nw];
				return;
			}
			d.workspaces.push(nw);
		});
		setRawWorkspaceKey(makeLocalWorkspaceKey(nw.id));
		setRoute('workspace');
		setWorkspaceTab('kanban');
	};

	const renameWorkspace = (name: string): void => {
		if (!activeWorkspaceId) {
			return;
		}
		changeActiveDoc((d) => {
			const list = d.workspaces;
			if (!Array.isArray(list)) {
				return;
			}
			const w = list.find((x) => x.id === activeWorkspaceId);
			if (w) {
				w.name = name;
			}
		});
	};

	const workspacePickList = useMemo(
		() => workspacesInDoc(localDoc).map((w) => ({ id: w.id, name: w.name })),
		[localDoc]
	);

	const renderMain = (): React.JSX.Element => {
		if (route === 'peers') {
			return (
				<main className="main">
					<PeersPage
						onInvitePeer={(draft) => {
							setInviteDraft(draft);
						}}
					/>
					{inviteDraft ? (
						<InviteToWorkspacesDialog
							title="Invite to workspaces"
							subtitle={`Pick one or more workspaces to share with ${inviteDraft.label}. They receive the full root document; selection scopes what appears in their sidebar (MVP).`}
							workspaces={workspacePickList}
							onClose={() => {
								setInviteDraft(null);
							}}
							onConfirm={async (workspaceIds) => {
								await invitePeerToWorkspaces({
									repo,
									myPeerId: createdByUserId,
									myNickname: nickname,
									myInboxUrl: inboxDocumentUrl,
									shareRootUrl: workspaceDocumentUrl,
									targetInboxUrl: inviteDraft.targetInboxUrl as AutomergeUrl,
									targetPeerId: inviteDraft.targetPeerId,
									workspaceIds
								});
							}}
						/>
					) : null}
				</main>
			);
		}

		if (route === 'inbox') {
			return (
				<main className="main">
					<InboxPage
						inboxDocumentUrl={inboxDocumentUrl}
						changeLocalRoot={changeLocalDoc}
						myNickname={nickname}
					/>
				</main>
			);
		}

		if (!activeWorkspace) {
			return (
				<main className="main">
					<p className="main__empty">
						{activeParsed?.kind === 'share'
							? 'Loading shared workspace… (stay online with the host peer.)'
							: 'No workspace available.'}
					</p>
				</main>
			);
		}

		if (route === 'myTasks') {
			return (
				<main className="main">
					<MyTasksPage
						workspace={activeWorkspace}
						today={today}
						backlog={backlog}
						resolvedFocus={resolvedFocus}
						onSelectFocusTask={setFocusTaskId}
						onOpenFocus={goFocus}
					/>
				</main>
			);
		}

		if (route === 'activity') {
			return (
				<main className="main">
					<header className="main__header">
						<h1 className="main__title">Activity</h1>
						<p className="main__subtitle">Filtered by workspace: {activeWorkspace.name}</p>
					</header>
					<p className="main__empty">Nothing here yet.</p>
				</main>
			);
		}

		return (
			<main className="main">
				<header className="main__header main__header--stack">
					<div className="main__header-row">
						<input
							className="main__workspace-name"
							type="text"
							value={activeWorkspace.name}
							aria-label="Workspace name"
							onChange={(e) => renameWorkspace(e.target.value)}
						/>
						<div className="main__actions">
							<button type="button" className="btn-ghost" onClick={goFocus}>
								<IconSquare />
								Focus mode
							</button>
						</div>
					</div>
					<div className="main__tabs" role="tablist" aria-label="Workspace">
						<button
							type="button"
							className="main__tab"
							role="tab"
							aria-selected={workspaceTab === 'kanban'}
							onClick={() => setWorkspaceTab('kanban')}
						>
							Kanban
						</button>
						<button
							type="button"
							className="main__tab"
							role="tab"
							aria-selected={workspaceTab === 'notes'}
							onClick={() => setWorkspaceTab('notes')}
						>
							Notes
						</button>
					</div>
				</header>
				{workspaceTab === 'kanban' ? (
					<WorkspaceKanbanPage
						workspaceId={activeWorkspaceId}
						doc={activeDoc}
						changeDoc={changeActiveDoc}
						createdByUserId={createdByUserId}
					/>
				) : (
					<WorkspaceNotesPage
						workspaceId={activeWorkspaceId}
						doc={activeDoc}
						changeDoc={changeActiveDoc}
						createdByUserId={createdByUserId}
					/>
				)}
			</main>
		);
	};

	return (
		<div className="app-root" data-view={view}>
			{distinctShareRootUrls.map((url) => (
				<ShareDocSync key={url} url={url} onUpdate={onShareUpdate} />
			))}
			<div className="app-chrome" aria-hidden={view === 'focus'}>
				<div className="app-body">
					<AppSidebar
						workspaces={sidebarWorkspaces}
						selectedWorkspaceKey={resolvedWorkspaceKey}
						route={route}
						onSelectWorkspace={(key) => {
							setRawWorkspaceKey(key);
						}}
						onAddWorkspace={addWorkspace}
						onNavigate={setRoute}
					/>
					{renderMain()}
				</div>
			</div>

			<FocusPage
				active={view === 'focus'}
				onExit={goNormal}
				focusSummary={focusLabel}
				taskTitle={resolvedFocus?.title ?? 'No task selected'}
				intention={resolvedFocus?.intention ?? ''}
				onMarkDone={markFocusTaskDone}
			/>
		</div>
	);
}
