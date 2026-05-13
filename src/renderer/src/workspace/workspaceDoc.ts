/** Re-exports the shared workspace schema so renderer code keeps a stable import path. */

export {
	DEFAULT_CREATED_BY,
	createDefaultWorkspace,
	createInitialRootDoc
} from '../../../shared/workspaceSchema';

export type {
	KanbanColumn,
	KanbanColumnRole,
	NoteEntry,
	RootDoc,
	TaskSize,
	WorkspaceEntity,
	WorkspaceNotes,
	WorkspaceTask
} from '../../../shared/workspaceSchema';
