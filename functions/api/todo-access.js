import { authenticated, accessConfigured, validAccessKey, sessionCookie, sameOrigin, cookieName } from '../_lib/todo-access.js';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return json({ authenticated: await authenticated(request, env), configured: accessConfigured(env) });
  if (!sameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (request.method === 'DELETE') return json({ ok: true }, 200, {
    'Set-Cookie': `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`
  });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!accessConfigured(env)) return json({ error: 'Configure ton code privé TODO_ACCESS_KEY dans Cloudflare pour ouvrir ta liste.' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Saisie invalide.' }, 400); }
  if (!(await validAccessKey(body?.key, env))) return json({ error: 'Code privé incorrect.' }, 401);
  return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie(request, env) });
}
