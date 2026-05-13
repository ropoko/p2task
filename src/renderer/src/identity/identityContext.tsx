/* eslint-disable react-refresh/only-export-components -- context hook paired with provider */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { AppIdentity } from './appIdentity';

type IdentityContextValue = {
	identity: AppIdentity;
	updateProfile: (input: { nickname: string; email: string }) => Promise<void>;
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({
	value,
	children
}: {
	value: AppIdentity;
	children: ReactNode;
}): React.JSX.Element {
	const [identity, setIdentity] = useState<AppIdentity>(value);

	const updateProfile = useCallback(async (input: { nickname: string; email: string }) => {
		const update = window.api?.identity.updateProfile;
		if (!update) {
			throw new Error('Profile updates are not available in this environment.');
		}
		const updated = await update(input);
		setIdentity((prev) => ({
			...prev,
			nickname: updated.nickname,
			email: updated.email,
			publicKeyId: updated.publicKeyId
		}));
	}, []);

	const ctxValue = useMemo<IdentityContextValue>(
		() => ({
			identity,
			updateProfile
		}),
		[identity, updateProfile]
	);

	return <IdentityContext.Provider value={ctxValue}>{children}</IdentityContext.Provider>;
}

export function useAppIdentity(): AppIdentity {
	const ctx = useContext(IdentityContext);
	if (!ctx) {
		throw new Error('useAppIdentity must be used within IdentityProvider');
	}
	return ctx.identity;
}

export function useUpdateProfile(): (input: { nickname: string; email: string }) => Promise<void> {
	const ctx = useContext(IdentityContext);
	if (!ctx) {
		throw new Error('useUpdateProfile must be used within IdentityProvider');
	}
	return ctx.updateProfile;
}
