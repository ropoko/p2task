import { useState } from 'react';

import { FocusPage } from './views/FocusPage';
import { IconSquare } from './components/IconSquare';

type AppView = 'normal' | 'focus';

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

export default function App(): React.JSX.Element {
	const [view, setView] = useState<AppView>('normal');

	const goNormal = (): void => setView('normal');
	const goFocus = (): void => setView('focus');

	return (
		<div className="app-root" data-view={view}>
			<div className="app-chrome" aria-hidden={view === 'focus'}>
				<div className="app-body">
					<aside className="sidebar" aria-label="Workspace">
						<div className="sidebar__label">workspace</div>
						<nav className="sidebar__nav" aria-label="Primary">
							<button type="button" className="sidebar__link" data-active="false">
								<IconSquare />
								Kanban
							</button>
							<button type="button" className="sidebar__link" data-active="true">
								<IconSquare />
								My tasks
							</button>
							<button type="button" className="sidebar__link" data-active="false">
								<IconSquare />
								Activity
							</button>
							<button type="button" className="sidebar__link" data-active="false">
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

					<main className="main">
						<header className="main__header">
							<h1 className="main__title">My tasks — today</h1>
							<div className="main__actions">
								<button type="button" className="btn-ghost">
									<IconSquare />
									Go offline
								</button>
								<button type="button" className="btn-ghost" onClick={goFocus}>
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
								<article className="task-card task-card--active">
									<TaskIconSquareFilled />
									<div className="task-card__body">
										<h3 className="task-card__title">Write the API authentication spec</h3>
										<p className="task-card__meta">Design · M · selected for today</p>
									</div>
									<span className="task-card__badge task-card__badge--progress">in progress</span>
								</article>
								<article className="task-card">
									<TaskIconCircle />
									<div className="task-card__body">
										<h3 className="task-card__title">Ship dark mode QA checklist</h3>
										<p className="task-card__meta">Engineering · S</p>
									</div>
									<span className="task-card__badge task-card__badge--todo">todo</span>
								</article>
								<article className="task-card">
									<TaskIconCircle />
									<div className="task-card__body">
										<h3 className="task-card__title">Prep stakeholder demo</h3>
										<p className="task-card__meta">Product · L</p>
									</div>
									<span className="task-card__badge task-card__badge--todo">todo</span>
								</article>
							</div>
						</section>

						<section className="task-section" aria-labelledby="backlog-heading">
							<h2 className="task-section__label" id="backlog-heading">
								Backlog
							</h2>
							<div className="task-list">
								<article className="task-card task-card--backlog">
									<TaskIconCircle />
									<div className="task-card__body">
										<h3 className="task-card__title">Refine onboarding metrics</h3>
										<p className="task-card__meta">Product · aged 18 days</p>
									</div>
								</article>
								<article className="task-card task-card--backlog">
									<TaskIconCircle />
									<div className="task-card__body">
										<h3 className="task-card__title">Draft support macros v2</h3>
										<p className="task-card__meta">Ops · aged 26 days</p>
									</div>
								</article>
							</div>
						</section>
					</main>
				</div>
			</div>

			<FocusPage active={view === 'focus'} onExit={goNormal} />
		</div>
	);
}
