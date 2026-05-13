import { useDocument, type AutomergeUrl } from '@automerge/react';
import { useMemo, useState } from 'react';

import { AppSidebar, type AppRoute } from './components/AppSidebar';
import { IconSquare } from './components/IconSquare';
import { useAppIdentity } from './identity/identityContext';
import { FocusPage } from './views/FocusPage';
import { MyTasksPage } from './views/MyTasksPage';
import { WorkspaceKanbanPage } from './views/WorkspaceKanbanPage';
import { WorkspaceNotesPage } from './views/WorkspaceNotesPage';
import { createDefaultWorkspace, type RootDoc } from './workspace/workspaceDoc';
import {
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
};

type AppView = 'normal' | 'focus';

export default function App({ workspaceDocumentUrl }: AppProps): React.JSX.Element {
	const { publicKeyId: createdByUserId } = useAppIdentity();
	const [doc, changeDoc] = useDocument<RootDoc>(workspaceDocumentUrl, { suspense: true });
	const [route, setRoute] = useState<AppRoute>('workspace');
	const [workspaceTab, setWorkspaceTab] = useState<'kanban' | 'notes'>('kanban');
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
		() => workspacesInDoc(doc)[0]?.id ?? ''
	);
	const [view, setView] = useState<AppView>('normal');
	const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

	const resolvedWorkspaceId = useMemo(() => {
		if (getWorkspaceById(doc, selectedWorkspaceId)) {
			return selectedWorkspaceId;
		}
		return workspacesInDoc(doc)[0]?.id ?? '';
	}, [doc, selectedWorkspaceId]);

	const activeWorkspace = getWorkspaceById(doc, resolvedWorkspaceId);

	const goNormal = (): void => setView('normal');
	const goFocus = (): void => setView('focus');

	const today = useMemo(
		() => (resolvedWorkspaceId ? todayTasks(doc, resolvedWorkspaceId) : []),
		[doc, resolvedWorkspaceId]
	);
	const backlog = useMemo(
		() => (resolvedWorkspaceId ? backlogTasks(doc, resolvedWorkspaceId) : []),
		[doc, resolvedWorkspaceId]
	);

	const resolvedFocus = useMemo(() => {
		if (!resolvedWorkspaceId) {
			return undefined;
		}
		const ws = getWorkspaceById(doc, resolvedWorkspaceId);
		if (!ws) {
			return undefined;
		}
		if (focusTaskId) {
			const hit = ws.tasks.find((t) => t.id === focusTaskId && isListedTask(t, ws));
			if (hit) {
				return hit;
			}
		}
		return defaultFocusTask(doc, resolvedWorkspaceId);
	}, [doc, focusTaskId, resolvedWorkspaceId]);

	const focusIndex = resolvedFocus ? today.findIndex((t) => t.id === resolvedFocus.id) + 1 : 0;
	const focusLabel =
		today.length > 0 && focusIndex > 0 ? `${focusIndex} of ${today.length} today` : '0 of 0 today';

	const markFocusTaskDone = (): void => {
		if (!resolvedFocus || !resolvedWorkspaceId) {
			return;
		}
		changeDoc((d) => {
			const list = d.workspaces;
			if (!Array.isArray(list)) {
				return;
			}
			const ws = list.find((w) => w.id === resolvedWorkspaceId);
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
		changeDoc((d) => {
			if (!Array.isArray(d.workspaces)) {
				d.workspaces = [nw];
				return;
			}
			d.workspaces.push(nw);
		});
		setSelectedWorkspaceId(nw.id);
		setRoute('workspace');
		setWorkspaceTab('kanban');
	};

	const renameWorkspace = (name: string): void => {
		if (!resolvedWorkspaceId) {
			return;
		}
		changeDoc((d) => {
			const list = d.workspaces;
			if (!Array.isArray(list)) {
				return;
			}
			const w = list.find((x) => x.id === resolvedWorkspaceId);
			if (w) {
				w.name = name;
			}
		});
	};

	const renderMain = (): React.JSX.Element => {
		if (!activeWorkspace) {
			return (
				<main className="main">
					<p className="main__empty">No workspace available.</p>
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

		if (route === 'activity' || route === 'inbox') {
			return (
				<main className="main">
					<header className="main__header">
						<h1 className="main__title">{route === 'activity' ? 'Activity' : 'Inbox'}</h1>
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
						workspaceId={resolvedWorkspaceId}
						doc={doc}
						changeDoc={changeDoc}
						createdByUserId={createdByUserId}
					/>
				) : (
					<WorkspaceNotesPage
						workspaceId={resolvedWorkspaceId}
						doc={doc}
						changeDoc={changeDoc}
						createdByUserId={createdByUserId}
					/>
				)}
			</main>
		);
	};

	return (
		<div className="app-root" data-view={view}>
			<div className="app-chrome" aria-hidden={view === 'focus'}>
				<div className="app-body">
					<AppSidebar
						workspaces={workspacesInDoc(doc)}
						selectedWorkspaceId={resolvedWorkspaceId}
						route={route}
						onSelectWorkspace={setSelectedWorkspaceId}
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
