import type { RootDoc } from '../workspace/workspaceDoc';
import { sortedColumns, workspacesInDoc } from '../workspace/workspaceSelectors';

type WorkspaceKanbanPageProps = {
	workspaceId: string;
	doc: RootDoc;
	changeDoc: (fn: (d: RootDoc) => void) => void;
	createdByUserId: string;
};

function newId(): string {
	return crypto.randomUUID();
}

export function WorkspaceKanbanPage({
	workspaceId,
	doc,
	changeDoc,
	createdByUserId
}: WorkspaceKanbanPageProps): React.JSX.Element | null {
	const ws = workspacesInDoc(doc).find((w) => w.id === workspaceId);
	if (!ws) {
		return null;
	}

	const columns = sortedColumns(ws);

	const addColumn = (): void => {
		changeDoc((d) => {
			const w = workspacesInDoc(d).find((x) => x.id === workspaceId);
			if (!w) {
				return;
			}
			const maxOrder = w.columns.reduce((m, c) => Math.max(m, c.order), -1);
			w.columns.push({
				id: newId(),
				title: 'New column',
				order: maxOrder + 1
			});
		});
	};

	const renameColumn = (columnId: string, title: string): void => {
		changeDoc((d) => {
			const w = workspacesInDoc(d).find((x) => x.id === workspaceId);
			if (!w) {
				return;
			}
			const col = w.columns.find((c) => c.id === columnId);
			if (col) {
				col.title = title;
			}
		});
	};

	const deleteColumn = (columnId: string): void => {
		changeDoc((d) => {
			const w = workspacesInDoc(d).find((x) => x.id === workspaceId);
			if (!w || w.columns.length <= 1) {
				return;
			}
			const col = w.columns.find((c) => c.id === columnId);
			if (col?.columnRole === 'done') {
				return;
			}
			const sorted = [...w.columns].sort((a, b) => a.order - b.order);
			const fallback = sorted.find((c) => c.id !== columnId);
			if (!fallback) {
				return;
			}
			for (const t of w.tasks) {
				if (t.columnId === columnId) {
					t.columnId = fallback.id;
				}
			}
			const removeI = w.columns.findIndex((c) => c.id === columnId);
			if (removeI !== -1) {
				w.columns.splice(removeI, 1);
			}
		});
	};

	const addTask = (columnId: string): void => {
		changeDoc((d) => {
			const w = workspacesInDoc(d).find((x) => x.id === workspaceId);
			if (!w) {
				return;
			}
			w.tasks.push({
				id: newId(),
				title: 'New task',
				project: '',
				size: 'M',
				columnId,
				selectedForToday: false,
				backlog: false,
				intention: '',
				created_by: createdByUserId
			});
		});
	};

	const moveTask = (taskId: string, columnId: string): void => {
		changeDoc((d) => {
			const w = workspacesInDoc(d).find((x) => x.id === workspaceId);
			if (!w) {
				return;
			}
			const t = w.tasks.find((x) => x.id === taskId);
			if (t) {
				t.columnId = columnId;
			}
		});
	};

	const renameTask = (taskId: string, title: string): void => {
		changeDoc((d) => {
			const w = workspacesInDoc(d).find((x) => x.id === workspaceId);
			if (!w) {
				return;
			}
			const t = w.tasks.find((x) => x.id === taskId);
			if (t) {
				t.title = title;
			}
		});
	};

	return (
		<div className="kanban">
			{columns.map((col) => (
				<KanbanColumnView
					key={col.id}
					column={col}
					tasks={ws.tasks.filter((t) => t.columnId === col.id)}
					allColumns={columns}
					canDeleteColumn={ws.columns.length > 1 && col.columnRole !== 'done'}
					onRenameColumn={renameColumn}
					onDeleteColumn={() => deleteColumn(col.id)}
					onAddTask={() => addTask(col.id)}
					onMoveTask={moveTask}
					onRenameTask={renameTask}
				/>
			))}
			<button type="button" className="kanban__add-column" onClick={addColumn}>
				+ Add column
			</button>
		</div>
	);
}

type KanbanColumnViewProps = {
	column: { id: string; title: string; order: number; columnRole?: string };
	tasks: { id: string; title: string; columnId: string }[];
	allColumns: { id: string; title: string }[];
	canDeleteColumn: boolean;
	onRenameColumn: (columnId: string, title: string) => void;
	onDeleteColumn: () => void;
	onAddTask: () => void;
	onMoveTask: (taskId: string, columnId: string) => void;
	onRenameTask: (taskId: string, title: string) => void;
};

function KanbanColumnView({
	column,
	tasks,
	allColumns,
	canDeleteColumn,
	onRenameColumn,
	onDeleteColumn,
	onAddTask,
	onMoveTask,
	onRenameTask
}: KanbanColumnViewProps): React.JSX.Element {
	return (
		<section className="kanban__column" aria-labelledby={`col-${column.id}`}>
			<header className="kanban__column-head">
				<input
					id={`col-${column.id}`}
					className="kanban__column-title-input"
					value={column.title}
					onChange={(e) => onRenameColumn(column.id, e.target.value)}
				/>
				{canDeleteColumn ? (
					<button
						type="button"
						className="kanban__icon-btn"
						aria-label="Delete column"
						onClick={onDeleteColumn}
					>
						×
					</button>
				) : null}
			</header>
			<div className="kanban__tasks">
				{tasks.map((task) => (
					<div key={task.id} className="kanban__task-card">
						<input
							className="kanban__task-title-input"
							value={task.title}
							onChange={(e) => onRenameTask(task.id, e.target.value)}
						/>
						<label className="kanban__task-move">
							<span className="kanban__task-move-label">Move to</span>
							<select
								className="kanban__select"
								value={task.columnId}
								onChange={(e) => onMoveTask(task.id, e.target.value)}
							>
								{allColumns.map((c) => (
									<option key={c.id} value={c.id}>
										{c.title}
									</option>
								))}
							</select>
						</label>
					</div>
				))}
			</div>
			<button type="button" className="kanban__add-task" onClick={onAddTask}>
				+ Add task
			</button>
		</section>
	);
}
