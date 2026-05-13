import type { RootDoc, WorkspaceEntity, WorkspaceTask } from './workspaceDoc';

export function workspacesInDoc(doc: RootDoc): WorkspaceEntity[] {
	return doc.workspaces ?? [];
}

export function getWorkspaceById(doc: RootDoc, workspaceId: string): WorkspaceEntity | undefined {
	return workspacesInDoc(doc).find((w) => w.id === workspaceId);
}

export function doneColumnId(ws: WorkspaceEntity): string | undefined {
	return ws.columns.find((c) => c.columnRole === 'done')?.id;
}

export function inProgressColumnId(ws: WorkspaceEntity): string | undefined {
	return ws.columns.find((c) => c.columnRole === 'in_progress')?.id;
}

export function columnTitle(ws: WorkspaceEntity, columnId: string): string {
	return ws.columns.find((c) => c.id === columnId)?.title ?? 'Unknown';
}

export function isListedTask(task: WorkspaceTask, ws: WorkspaceEntity): boolean {
	const doneId = doneColumnId(ws);
	if (!doneId) {
		return true;
	}
	return task.columnId !== doneId;
}

export function todayTasks(doc: RootDoc, workspaceId: string): WorkspaceTask[] {
	const ws = getWorkspaceById(doc, workspaceId);
	if (!ws) {
		return [];
	}
	return ws.tasks.filter((t) => t.selectedForToday && !t.backlog && isListedTask(t, ws));
}

export function backlogTasks(doc: RootDoc, workspaceId: string): WorkspaceTask[] {
	const ws = getWorkspaceById(doc, workspaceId);
	if (!ws) {
		return [];
	}
	return ws.tasks.filter((t) => t.backlog && isListedTask(t, ws));
}

export function defaultFocusTask(doc: RootDoc, workspaceId: string): WorkspaceTask | undefined {
	const ws = getWorkspaceById(doc, workspaceId);
	if (!ws) {
		return undefined;
	}
	const today = todayTasks(doc, workspaceId);
	const progId = inProgressColumnId(ws);
	if (progId) {
		const inProg = today.find((t) => t.columnId === progId);
		if (inProg) {
			return inProg;
		}
	}
	return today[0];
}

export function sortedColumns(ws: WorkspaceEntity): typeof ws.columns {
	return [...ws.columns].sort((a, b) => a.order - b.order);
}
