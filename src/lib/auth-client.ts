import { useEffect, useState } from 'react';
import { createAuthClient } from 'better-auth/react';

// Same-origin API: the browser talks to /api/auth on whichever host serves the app.
export const authClient = createAuthClient({ basePath: '/api/auth' });

export const { useSession, signOut } = authClient;

export interface AuthConfig { providers: { google: boolean } }
const GUEST_ONLY: AuthConfig = { providers: { google: false } };
let configRequest: Promise<AuthConfig> | undefined;

/** Which sign-in providers the server offers. Falls back to guest-only if the API is unreachable. */
export function useAuthConfig() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  useEffect(() => {
    configRequest ??= fetch('/api/config')
      .then(r => (r.ok ? r.json() as Promise<AuthConfig> : GUEST_ONLY))
      .catch(() => { configRequest = undefined; return GUEST_ONLY; });
    let active = true;
    void configRequest.then(c => { if (active) setConfig(c); });
    return () => { active = false; };
  }, []);
  return config;
}

/** Starts Google sign-in and returns to the current page afterwards. */
export async function signInWithGoogle() {
  const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: location.pathname });
  if (error) throw new Error(error.message ?? 'Sign-in failed. Please try again.');
}
