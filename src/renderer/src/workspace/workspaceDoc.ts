export type TaskSize = 'S' | 'M' | 'L';

/** Optional semantic for focus / listing; at most one `done` per workspace. */
export type KanbanColumnRole = 'done' | 'in_progress';

export type KanbanColumn = {
	id: string;
	title: string;
	order: number;
	columnRole?: KanbanColumnRole;
};

export type NoteEntry = {
	id: string;
	text: string;
	createdAt: string;
	created_by: string;
};

export type WorkspaceNotes = {
	entries: NoteEntry[];
};

export type WorkspaceTask = {
	id: string;
	title: string;
	project: string;
	size: TaskSize;
	columnId: string;
	selectedForToday: boolean;
	backlog: boolean;
	agedDays?: number;
	intention: string;
	created_by: string;
};

export type WorkspaceEntity = {
	id: string;
	name: string;
	columns: KanbanColumn[];
	tasks: WorkspaceTask[];
	notes: WorkspaceNotes;
};

/** Root Automerge document: all workspaces in one doc. */
export type RootDoc = {
	workspaces: WorkspaceEntity[];
};

export const ROOT_DOC_STORAGE_KEY = 'p2task:rootDocUrl';

/** Until app identity is wired; use when creating tasks and notes. */
export const DEFAULT_CREATED_BY = 'local';

function newId(): string {
	return crypto.randomUUID();
}

function defaultColumns(): KanbanColumn[] {
	return [
		{ id: newId(), title: 'Backlog', order: 0 },
		{ id: newId(), title: 'In progress', order: 1, columnRole: 'in_progress' },
		{ id: newId(), title: 'Done', order: 2, columnRole: 'done' }
	];
}

export function createDefaultWorkspace(name: string): WorkspaceEntity {
	const columns = defaultColumns();
	return {
		id: newId(),
		name,
		columns,
		tasks: [],
		notes: { entries: [] }
	};
}

export function createInitialRootDoc(): RootDoc {
	return {
		workspaces: [createDefaultWorkspace('My workspace')]
	};
}
