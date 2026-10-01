import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { getAuth } from '../auth.ts';

interface TestHelpers {
  createUser(overrides: { email: string; name: string }): { id: string };
  saveUser(user: { id: string }): Promise<{ id: string }>;
  getCookies(opts: { userId: string; domain?: string }): Promise<{ name: string; value: string; httpOnly?: boolean; sameSite?: string }[]>;
}

/**
 * Browser-test sign-in that skips Google. Only mounted when AUTH_TEST_UTILS=1 outside production
 * (see enableTestUtils), so it never exists on a real deployment.
 */
export const testAuthRoutes = new Hono();

testAuthRoutes.post('/test/sign-in', async c => {
  const { email } = await c.req.json<{ email?: string }>();
  if (!email) return c.json({ error: 'email required' }, 400);
  const ctx = await getAuth().$context;
  const helpers = (ctx as unknown as { test: TestHelpers }).test;
  const existing = await ctx.internalAdapter.findUserByEmail(email);
  const user = existing?.user ?? await helpers.saveUser(helpers.createUser({ email, name: email.split('@')[0]! }));
  for (const cookie of await helpers.getCookies({ userId: user.id })) {
    setCookie(c, cookie.name, cookie.value, { path: '/', httpOnly: true, sameSite: 'Lax' });
  }
  return c.json({ userId: user.id });
});
