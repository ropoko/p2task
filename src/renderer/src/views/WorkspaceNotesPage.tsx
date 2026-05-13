import { useState } from 'react';

import type { RootDoc } from '../workspace/workspaceDoc';
import { workspacesInDoc } from '../workspace/workspaceSelectors';

type WorkspaceNotesPageProps = {
	workspaceId: string;
	doc: RootDoc;
	changeDoc: (fn: (d: RootDoc) => void) => void;
	createdByUserId: string;
};

function newId(): string {
	return crypto.randomUUID();
}

export function WorkspaceNotesPage({
	workspaceId,
	doc,
	changeDoc,
	createdByUserId
}: WorkspaceNotesPageProps): React.JSX.Element | null {
	const ws = workspacesInDoc(doc).find((w) => w.id === workspaceId);
	const [draft, setDraft] = useState('');

	if (!ws) {
		return null;
	}

	const entries = [...ws.notes.entries].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	);

	const submit = (): void => {
		const text = draft.trim();
		if (!text) {
			return;
		}
		changeDoc((d) => {
			const w = workspacesInDoc(d).find((x) => x.id === workspaceId);
			if (!w) {
				return;
			}
			w.notes.entries.push({
				id: newId(),
				text,
				createdAt: new Date().toISOString(),
				created_by: createdByUserId
			});
		});
		setDraft('');
	};

	return (
		<div className="notes-page">
			<ul className="notes-page__list" aria-label="Comments">
				{entries.map((e) => (
					<li key={e.id} className="notes-page__entry">
						<time className="notes-page__time" dateTime={e.createdAt}>
							{new Date(e.createdAt).toLocaleString()}
						</time>
						<p className="notes-page__text">{e.text}</p>
					</li>
				))}
			</ul>
			<div className="notes-page__composer">
				<label className="notes-page__label" htmlFor="notes-composer-input">
					Add a comment
				</label>
				<textarea
					id="notes-composer-input"
					className="notes-page__textarea"
					rows={4}
					placeholder="Write a note for this workspace…"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
				/>
				<div className="notes-page__composer-actions">
					<button type="button" className="btn-ghost" disabled title="Attachments coming later">
						Attach file
					</button>
					<button type="button" className="btn-ghost" onClick={submit} disabled={!draft.trim()}>
						Post
					</button>
				</div>
			</div>
		</div>
	);
}
