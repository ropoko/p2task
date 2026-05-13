import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAppIdentity, useUpdateProfile } from '../identity/identityContext';

type ProfileSettingsDialogProps = {
	onClose: () => void;
};

type SettingsSection = 'settings' | 'profile';

function IconSettingsNav(): React.JSX.Element {
	return (
		<svg
			className="profile-dialog__nav-icon"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path
				d="M12 15a3 3 0 100-6 3 3 0 000 6z"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function IconProfileNav(): React.JSX.Element {
	return (
		<svg
			className="profile-dialog__nav-icon"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path
				d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle
				cx="12"
				cy="7"
				r="4"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function IconClose(): React.JSX.Element {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

export function ProfileSettingsDialog({ onClose }: ProfileSettingsDialogProps): React.JSX.Element {
	const identity = useAppIdentity();
	const updateProfile = useUpdateProfile();
	const dialogTitleId = useId();
	const sectionTitleId = useId();
	const [section, setSection] = useState<SettingsSection>('profile');
	const [nickname, setNickname] = useState(() => identity.nickname);
	const [email, setEmail] = useState(() => identity.email);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				onClose();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	const save = async (): Promise<void> => {
		setError(null);
		setSubmitting(true);
		try {
			await updateProfile({ nickname, email });
			onClose();
		} catch (err: unknown) {
			const message =
				err &&
				typeof err === 'object' &&
				'message' in err &&
				typeof (err as Error).message === 'string'
					? (err as Error).message
					: 'Could not save profile.';
			setError(message);
		} finally {
			setSubmitting(false);
		}
	};

	const fallbackSettings = (
		<>
			<h2 id={sectionTitleId} className="profile-dialog__section-title">
				Settings
			</h2>
			<p className="profile-dialog__lead">
				General preferences are only available when you run the desktop app with a saved identity.
			</p>
		</>
	);

	const fallbackProfile = (
		<>
			<h2 id={sectionTitleId} className="profile-dialog__section-title">
				Profile
			</h2>
			<p className="profile-dialog__lead">
				Identity and profile editing are only available when you run the desktop app with a saved
				key in <code className="profile-dialog__code">~/.p2task/</code>.
			</p>
			<div className="profile-dialog__actions">
				<button
					type="button"
					className="profile-dialog__btn profile-dialog__btn--primary"
					onClick={onClose}
				>
					Close
				</button>
			</div>
		</>
	);

	const mainSettings = (
		<>
			<h2 id={sectionTitleId} className="profile-dialog__section-title">
				Settings
			</h2>
			<p className="profile-dialog__lead">
				Application preferences will show up here as the product grows (appearance, defaults, and
				more).
			</p>
		</>
	);

	const mainProfile = (
		<>
			<h2 id={sectionTitleId} className="profile-dialog__section-title">
				Profile
			</h2>
			<p className="profile-dialog__lead">
				Update how you appear in the app. Your signing key does not change.
			</p>
			<form
				className="profile-dialog__form"
				onSubmit={(e) => {
					e.preventDefault();
					void save();
				}}
			>
				<label className="profile-dialog__field">
					<span className="profile-dialog__label">Nickname</span>
					<input
						className="profile-dialog__input"
						type="text"
						autoComplete="nickname"
						value={nickname}
						onChange={(ev) => setNickname(ev.target.value)}
						required
						maxLength={80}
					/>
				</label>
				<label className="profile-dialog__field">
					<span className="profile-dialog__label">Email</span>
					<input
						className="profile-dialog__input"
						type="email"
						autoComplete="email"
						value={email}
						onChange={(ev) => setEmail(ev.target.value)}
						required
						maxLength={254}
					/>
				</label>
				{error ? <p className="profile-dialog__error">{error}</p> : null}
				<div className="profile-dialog__actions">
					<button
						type="button"
						className="profile-dialog__btn profile-dialog__btn--ghost"
						onClick={onClose}
					>
						Cancel
					</button>
					<button
						type="submit"
						className="profile-dialog__btn profile-dialog__btn--primary"
						disabled={submitting}
					>
						{submitting ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</>
	);

	const paneContent = (() => {
		if (identity.isFallback) {
			return section === 'settings' ? fallbackSettings : fallbackProfile;
		}
		return section === 'settings' ? mainSettings : mainProfile;
	})();

	return createPortal(
		<div className="profile-dialog-backdrop" role="presentation" onClick={onClose}>
			<div
				className="profile-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby={dialogTitleId}
				onClick={(e) => e.stopPropagation()}
			>
				<header className="profile-dialog__header">
					<h1 id={dialogTitleId} className="profile-dialog__header-title">
						Settings
					</h1>
					<button
						type="button"
						className="profile-dialog__close"
						aria-label="Close"
						onClick={onClose}
					>
						<IconClose />
					</button>
				</header>
				<div className="profile-dialog__split">
					<nav className="profile-dialog__nav" aria-label="Settings sections">
						<button
							type="button"
							className="profile-dialog__nav-btn"
							data-active={section === 'settings' ? 'true' : 'false'}
							aria-current={section === 'settings' ? 'page' : undefined}
							onClick={() => setSection('settings')}
						>
							<IconSettingsNav />
							Settings
						</button>
						<button
							type="button"
							className="profile-dialog__nav-btn"
							data-active={section === 'profile' ? 'true' : 'false'}
							aria-current={section === 'profile' ? 'page' : undefined}
							onClick={() => setSection('profile')}
						>
							<IconProfileNav />
							Profile
						</button>
					</nav>
					<div
						className="profile-dialog__content"
						role="region"
						aria-labelledby={sectionTitleId}
						key={section}
					>
						{paneContent}
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}
