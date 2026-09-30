import { app } from '../server/app.ts';

// vercel.json rewrites /api/* here; the original path is preserved on the request URL.
const handler = (request: Request) => app.fetch(request);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
