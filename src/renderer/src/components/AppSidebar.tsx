import { IconSquare } from './IconSquare';
import type { WorkspaceEntity } from '../workspace/workspaceDoc';

export type AppRoute = 'workspace' | 'myTasks' | 'activity' | 'inbox';

type AppSidebarProps = {
	workspaces: WorkspaceEntity[];
	selectedWorkspaceId: string;
	route: AppRoute;
	onSelectWorkspace: (id: string) => void;
	onAddWorkspace: () => void;
	onNavigate: (route: AppRoute) => void;
};

export function AppSidebar({
	workspaces,
	selectedWorkspaceId,
	route,
	onSelectWorkspace,
	onAddWorkspace,
	onNavigate
}: AppSidebarProps): React.JSX.Element {
	return (
		<aside className="sidebar" aria-label="App">
			<div className="sidebar__label">Workspaces</div>
			<nav className="sidebar__nav sidebar__nav--scroll" aria-label="Workspaces">
				{workspaces.map((w) => (
					<button
						key={w.id}
						type="button"
						className="sidebar__link"
						data-active={route === 'workspace' && w.id === selectedWorkspaceId ? 'true' : 'false'}
						onClick={() => {
							onSelectWorkspace(w.id);
							onNavigate('workspace');
						}}
					>
						<IconSquare />
						{w.name}
					</button>
				))}
				<button
					type="button"
					className="sidebar__link sidebar__link--subtle"
					onClick={onAddWorkspace}
				>
					+ Add workspace
				</button>
			</nav>

			<div className="sidebar__label sidebar__label--spaced">Shared</div>
			<nav className="sidebar__nav" aria-label="Shared pages">
				<button
					type="button"
					className="sidebar__link"
					data-active={route === 'myTasks' ? 'true' : 'false'}
					onClick={() => onNavigate('myTasks')}
				>
					<IconSquare />
					My tasks
				</button>
				<button
					type="button"
					className="sidebar__link"
					data-active={route === 'activity' ? 'true' : 'false'}
					onClick={() => onNavigate('activity')}
				>
					<IconSquare />
					Activity
				</button>
				<button
					type="button"
					className="sidebar__link"
					data-active={route === 'inbox' ? 'true' : 'false'}
					onClick={() => onNavigate('inbox')}
				>
					<IconSquare />
					Inbox
				</button>
			</nav>

			<div className="sidebar__footer">
				<div className="sidebar__avatar" aria-hidden>
					AL
				</div>
				<span className="sidebar__user-name">Ana Lima</span>
			</div>
		</aside>
	);
}
