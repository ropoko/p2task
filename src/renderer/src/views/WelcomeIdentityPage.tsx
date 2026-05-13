import { useState, type FormEvent } from 'react';

import type { IdentityPublic } from '../../../shared/identityTypes';

type WelcomeIdentityPageProps = {
	onSuccess: (identity: IdentityPublic) => void | Promise<void>;
};

export function WelcomeIdentityPage({ onSuccess }: WelcomeIdentityPageProps): React.JSX.Element {
	const [nickname, setNickname] = useState('');
	const [email, setEmail] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const submit = async (e: FormEvent): Promise<void> => {
		e.preventDefault();
		setError(null);
		const idApi = window.api?.identity;
		if (!idApi) {
			setError('Identity API is not available.');
			return;
		}
		setSubmitting(true);
		try {
			const created = await idApi.create({ nickname, email });
			await onSuccess(created);
		} catch (err: unknown) {
			const message =
				err &&
				typeof err === 'object' &&
				'message' in err &&
				typeof (err as Error).message === 'string'
					? (err as Error).message
					: 'Could not create identity.';
			setError(message);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="app-root welcome-identity" data-view="normal">
			<div className="welcome-identity__panel">
				<h1 className="welcome-identity__title">Welcome to P2Task</h1>
				<p className="welcome-identity__lead">
					Set up your profile. An Ed25519 key pair will be stored in{' '}
					<code className="welcome-identity__code">~/.p2task/</code> on this machine.
				</p>
				<form className="welcome-identity__form" onSubmit={(e) => void submit(e)}>
					<label className="welcome-identity__field">
						<span className="welcome-identity__label">Nickname</span>
						<input
							className="welcome-identity__input"
							type="text"
							autoComplete="nickname"
							value={nickname}
							onChange={(ev) => setNickname(ev.target.value)}
							required
							maxLength={80}
							placeholder="How you appear in the app"
						/>
					</label>
					<label className="welcome-identity__field">
						<span className="welcome-identity__label">Email</span>
						<input
							className="welcome-identity__input"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(ev) => setEmail(ev.target.value)}
							required
							maxLength={254}
							placeholder="you@example.com"
						/>
					</label>
					{error ? <p className="welcome-identity__error">{error}</p> : null}
					<button type="submit" className="welcome-identity__submit" disabled={submitting}>
						{submitting ? 'Creating…' : 'Continue'}
					</button>
				</form>
			</div>
		</div>
	);
}
