import { IconSquare } from '@renderer/components/IconSquare';

export type FocusPageProps = {
	active: boolean;
	onExit: () => void;
	/** e.g. "1 of 3 today" */
	focusSummary: string;
	taskTitle: string;
	intention: string;
	onMarkDone: () => void;
};

export function FocusPage({
	active,
	onExit,
	focusSummary,
	taskTitle,
	intention,
	onMarkDone
}: FocusPageProps): React.JSX.Element {
	return (
		<div className="focus-page" role="region" aria-hidden={!active} aria-label="Focus mode">
			<header className="focus-page__header">
				<div className="focus-page__brand">
					<span className="focus-page__dot" aria-hidden />
					Focus mode
				</div>
				<button type="button" className="btn-ghost" onClick={onExit}>
					<IconSquare />
					Exit focus
				</button>
			</header>

			<div className="focus-page__body">
				<div className="focus-page__inner">
					<div className="focus-page__progress">
						<span className="focus-badge">{focusSummary}</span>
					</div>
					<h1 className="focus-page__title">{taskTitle}</h1>
					{intention ? <p className="focus-page__intention">{intention}</p> : null}

					<div className="focus-timer">
						<div className="focus-timer__ring" aria-label="Session timer">
							<span className="focus-timer__time">20:00</span>
						</div>
						<div className="focus-timer__actions">
							<button type="button" className="btn-ghost">
								<IconSquare />
								Start session
							</button>
							<button type="button" className="btn-ghost">
								<IconSquare />
								Reset
							</button>
						</div>
					</div>

					<div className="focus-page__divider" />

					<label className="focus-notes__label" htmlFor="session-notes">
						Session notes — just for you
					</label>
					<textarea
						id="session-notes"
						className="focus-notes__input"
						placeholder="Jot anything useful while you work..."
						rows={5}
					/>
				</div>
			</div>

			<footer className="focus-page__footer">
				<button type="button" className="btn-ghost" onClick={onMarkDone}>
					<IconSquare />
					Mark done
				</button>
				<button type="button" className="btn-text-outline" onClick={onExit}>
					Pause — back to tasks
				</button>
			</footer>
		</div>
	);
}
