import { createAuthClient } from 'better-auth/react';

// Same-origin API: the browser talks to /api/auth on whichever host serves the app.
export const authClient = createAuthClient({ basePath: '/api/auth' });

export const { useSession, signIn, signOut } = authClient;
