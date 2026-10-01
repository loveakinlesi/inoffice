import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oAuthProxy, testUtils } from 'better-auth/plugins';
import { db, type Database } from './db/client.ts';
import * as schema from './db/schema.ts';

const env = process.env;

/** Hosts allowed to serve auth: local dev plus this deployment's own Vercel URLs. */
export const allowedHosts = [
  'localhost:5173',
  '127.0.0.1:5173',
  env.VERCEL_PROJECT_PRODUCTION_URL,
  env.VERCEL_BRANCH_URL,
  env.VERCEL_URL,
  ...(env.AUTH_ALLOWED_HOSTS?.split(',') ?? []),
].filter((h): h is string => Boolean(h?.trim())).map(h => h.trim());

/**
 * Preview deployments get a new URL each time, but Google only accepts pre-registered redirect URIs.
 * With OAUTH_PROXY_SECRET set (same value in Preview and Production), previews send Google to the
 * production callback, which hands the session back to the preview encrypted with that secret.
 */
const productionURL = env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;
const useOAuthProxy = Boolean(env.OAUTH_PROXY_SECRET && productionURL && (env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'production'));

const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  ? { google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: 'select_account' as const,
      ...(useOAuthProxy ? { redirectURI: `${productionURL}/api/auth/callback/google` } : {}),
    } }
  : undefined;

/**
 * Extra origins auth may redirect to, comma-separated, wildcards allowed. Production needs the
 * preview pattern for the OAuth proxy, e.g. `https://inoffice-*-<team>.vercel.app`. Keep it
 * scoped to your own team: a broad pattern like `*.vercel.app` would trust other people's apps.
 */
const extraTrustedOrigins = (env.AUTH_TRUSTED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean);

/** Test-only helpers (create users, mint sessions). Never enabled on a production deployment. */
export const enableTestUtils = env.AUTH_TEST_UTILS === '1' && env.VERCEL_ENV !== 'production';

function createAuth(database: Database) {
  return betterAuth({
    appName: 'InOffice',
    basePath: '/api/auth',
    baseURL: { allowedHosts, protocol: 'auto', fallback: env.BETTER_AUTH_URL },
    // Required in production; Better Auth refuses to start there without it.
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, { provider: 'pg', schema, schemaName: 'inoffice' }),
    socialProviders: google,
    trustedOrigins: [...allowedHosts.flatMap(h => [`http://${h}`, `https://${h}`]), ...extraTrustedOrigins],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Short-lived signed cookie cache avoids a database round trip on every API call.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    plugins: [
      ...(useOAuthProxy ? [oAuthProxy({ productionURL, secret: env.OAUTH_PROXY_SECRET })] : []),
      ...(enableTestUtils ? [testUtils()] : []),
    ],
    advanced: { database: { generateId: 'uuid' } },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth['$Infer']['Session'];

let instance: Auth | undefined;
/** Created on first use so tests can inject a database first. */
export const getAuth = () => (instance ??= createAuth(db()));
