import { IconSquare } from '../components/IconSquare';
import type { WorkspaceEntity, WorkspaceTask } from '../workspace/workspaceDoc';
import { columnTitle } from '../workspace/workspaceSelectors';

function TaskIconCircle(): React.JSX.Element {
	return (
		<span className="task-card__icon-wrap" aria-hidden>
			<svg
				width="18"
				height="18"
				viewBox="0 0 18 18"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
			</svg>
		</span>
	);
}

function TaskIconSquareFilled(): React.JSX.Element {
	return (
		<span className="task-card__icon-wrap" aria-hidden>
			<svg
				width="18"
				height="18"
				viewBox="0 0 18 18"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect x="4" y="4" width="10" height="10" rx="2" fill="currentColor" />
			</svg>
		</span>
	);
}

function taskMetaLine(t: WorkspaceTask): string {
	const parts = [t.project, t.size].filter(Boolean);
	if (t.selectedForToday && !t.backlog) {
		parts.push('selected for today');
	}
	if (t.backlog && t.agedDays != null) {
		parts.push(`aged ${t.agedDays} days`);
	}
	return parts.length ? parts.join(' · ') : '—';
}

type MyTasksPageProps = {
	workspace: WorkspaceEntity;
	today: WorkspaceTask[];
	backlog: WorkspaceTask[];
	resolvedFocus: WorkspaceTask | undefined;
	onSelectFocusTask: (id: string) => void;
	onOpenFocus: () => void;
};

export function MyTasksPage({
	workspace,
	today,
	backlog,
	resolvedFocus,
	onSelectFocusTask,
	onOpenFocus
}: MyTasksPageProps): React.JSX.Element {
	const progId = workspace.columns.find((c) => c.columnRole === 'in_progress')?.id;

	return (
		<>
			<header className="main__header">
				<h1 className="main__title">My tasks — {workspace.name}</h1>
				<div className="main__actions">
					<button type="button" className="btn-ghost">
						<IconSquare />
						Go offline
					</button>
					<button type="button" className="btn-ghost" onClick={onOpenFocus}>
						<IconSquare />
						Focus mode
					</button>
				</div>
			</header>

			<section className="task-section" aria-labelledby="today-heading">
				<h2 className="task-section__label" id="today-heading">
					Selected for today
				</h2>
				<div className="task-list">
					{today.map((task) => {
						const active = resolvedFocus?.id === task.id;
						const colName = columnTitle(workspace, task.columnId);
						const inProg = progId != null && task.columnId === progId;
						return (
							<article
								key={task.id}
								className={`task-card${active ? ' task-card--active' : ''}`}
								role="button"
								tabIndex={0}
								onClick={() => onSelectFocusTask(task.id)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onSelectFocusTask(task.id);
									}
								}}
							>
								{inProg ? <TaskIconSquareFilled /> : <TaskIconCircle />}
								<div className="task-card__body">
									<h3 className="task-card__title">{task.title}</h3>
									<p className="task-card__meta">{taskMetaLine(task)}</p>
								</div>
								<span
									className={`task-card__badge task-card__badge--${inProg ? 'progress' : 'todo'}`}
								>
									{colName}
								</span>
							</article>
						);
					})}
				</div>
			</section>

			<section className="task-section" aria-labelledby="backlog-heading">
				<h2 className="task-section__label" id="backlog-heading">
					Backlog
				</h2>
				<div className="task-list">
					{backlog.map((task) => (
						<article key={task.id} className="task-card task-card--backlog">
							<TaskIconCircle />
							<div className="task-card__body">
								<h3 className="task-card__title">{task.title}</h3>
								<p className="task-card__meta">{taskMetaLine(task)}</p>
							</div>
						</article>
					))}
				</div>
			</section>
		</>
	);
}
