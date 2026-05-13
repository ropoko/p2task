import { useState } from 'react';

import { ProfileSettingsDialog } from './ProfileSettingsDialog';
import { IconSquare } from './IconSquare';
import { useAppIdentity } from '../identity/identityContext';

export type AppRoute = 'workspace' | 'myTasks' | 'activity' | 'inbox' | 'peers';

type SidebarWorkspaceItem = {
	key: string;
	name: string;
};

type AppSidebarProps = {
	workspaces: SidebarWorkspaceItem[];
	selectedWorkspaceKey: string;
	route: AppRoute;
	onSelectWorkspace: (key: string) => void;
	onAddWorkspace: () => void;
	onNavigate: (route: AppRoute) => void;
};

function initialsFromNickname(nickname: string): string {
	const t = nickname.trim();
	if (!t) {
		return '?';
	}
	const parts = t.split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
	}
	return t.slice(0, 2).toUpperCase();
}

export function AppSidebar({
	workspaces,
	selectedWorkspaceKey,
	route,
	onSelectWorkspace,
	onAddWorkspace,
	onNavigate
}: AppSidebarProps): React.JSX.Element {
	const identity = useAppIdentity();
	const [profileOpen, setProfileOpen] = useState(false);

	const displayName = identity.nickname.trim() || (identity.isFallback ? 'Local' : 'You');
	const initials = initialsFromNickname(identity.nickname);

	return (
		<aside className="sidebar" aria-label="App">
			<nav className="sidebar__nav sidebar__nav--fixed" aria-label="Shared pages">
				<h1 className="sidebar__title">P2Task</h1>
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
				<button
					type="button"
					className="sidebar__link"
					data-active={route === 'peers' ? 'true' : 'false'}
					onClick={() => onNavigate('peers')}
				>
					<IconSquare />
					Peers
				</button>
			</nav>

			<nav className="sidebar__nav sidebar__nav--scroll" aria-label="Workspaces">
				<label className="sidebar__label">Workspaces</label>
				{workspaces.map((w) => (
					<button
						key={w.key}
						type="button"
						className="sidebar__link"
						data-active={route === 'workspace' && w.key === selectedWorkspaceKey ? 'true' : 'false'}
						onClick={() => {
							onSelectWorkspace(w.key);
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

			<button
				type="button"
				className="sidebar__footer"
				aria-haspopup="dialog"
				aria-expanded={profileOpen}
				onClick={() => setProfileOpen(true)}
			>
				<div className="sidebar__avatar" aria-hidden>
					{initials}
				</div>
				<span className="sidebar__user-name">{displayName}</span>
			</button>

			{profileOpen ? <ProfileSettingsDialog onClose={() => setProfileOpen(false)} /> : null}
		</aside>
	);
}
