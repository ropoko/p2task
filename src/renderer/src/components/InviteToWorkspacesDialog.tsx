import { useId, useState } from 'react';
import { createPortal } from 'react-dom';

export type WorkspacePickItem = {
	id: string;
	name: string;
};

type InviteToWorkspacesDialogProps = {
	title: string;
	subtitle: string;
	workspaces: WorkspacePickItem[];
	onClose: () => void;
	onConfirm: (workspaceIds: string[]) => void | Promise<void>;
};

export function InviteToWorkspacesDialog({
	title,
	subtitle,
	workspaces,
	onClose,
	onConfirm
}: InviteToWorkspacesDialogProps): React.JSX.Element {
	const titleId = useId();
	const [selected, setSelected] = useState<Set<string>>(() => new Set());
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const toggle = (id: string): void => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleSubmit = async (): Promise<void> => {
		if (selected.size === 0) {
			setError('Select at least one workspace.');
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			await onConfirm([...selected]);
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Invite failed.');
		} finally {
			setSubmitting(false);
		}
	};

	return createPortal(
		<div className="profile-dialog-backdrop" role="presentation" onClick={onClose}>
			<div
				className="profile-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onClick={(e) => {
					e.stopPropagation();
				}}
			>
				<header className="profile-dialog__header">
					<h2 className="profile-dialog__header-title" id={titleId}>
						{title}
					</h2>
					<p className="profile-dialog__lead">{subtitle}</p>
				</header>

				<div className="profile-dialog__content">
					{workspaces.length === 0 ? (
						<p className="main__empty">No local workspaces to invite from.</p>
					) : (
						<ul className="invite-workspace-list">
							{workspaces.map((w) => (
								<li key={w.id}>
									<label className="invite-workspace-row">
										<input
											type="checkbox"
											checked={selected.has(w.id)}
											onChange={() => {
												toggle(w.id);
											}}
										/>
										<span>{w.name}</span>
									</label>
								</li>
							))}
						</ul>
					)}
					{error ? <p className="profile-dialog__error">{error}</p> : null}
				</div>

				<div className="profile-dialog__actions">
					<button
						type="button"
						className="profile-dialog__btn profile-dialog__btn--ghost"
						onClick={onClose}
						disabled={submitting}
					>
						Cancel
					</button>
					<button
						type="button"
						className="profile-dialog__btn profile-dialog__btn--primary"
						onClick={() => {
							void handleSubmit();
						}}
						disabled={submitting || workspaces.length === 0}
					>
						{submitting ? 'Sending…' : 'Send invite'}
					</button>
				</div>
			</div>
		</div>,
		document.body
	);
}
