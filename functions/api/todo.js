import { authenticated, sameOrigin } from '../_lib/todo-access.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequest({ request, env }) {
  if (!(await authenticated(request, env))) return json({ error: 'Accès privé Olivier requis.' }, 401);
  if (request.method !== 'GET' && !sameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  if (!env.DB) return json({ error: 'Base du planning indisponible.' }, 503);

  const owner = 'olivier';
  try {
    const legacyToken = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (legacyToken) {
      await env.DB.prepare('UPDATE todo_tasks SET owner = ? WHERE owner = ?')
        .bind(owner, await digest(legacyToken)).run();
    }
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT id, message, remind_at, completed_at, sent_at FROM todo_tasks WHERE owner = ?
        ORDER BY completed_at IS NOT NULL, COALESCE(remind_at, created_at), created_at
      `).bind(owner).all();
      return json(results);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Saisie invalide.' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Saisie invalide.' }, 400);

    if (request.method === 'PATCH') {
      const result = await env.DB.prepare(`
        UPDATE todo_tasks SET completed_at = COALESCE(completed_at, ?)
        WHERE owner = ? AND id = ?
      `).bind(new Date().toISOString(), owner, String(body.id || '')).run();
      return result.meta.changes ? json({ ok: true }) : json({ error: 'Tâche introuvable.' }, 404);
    }

    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
    if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id)) {
      return json({ error: 'Identifiant de tâche invalide.' }, 400);
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 500) return json({ error: 'Écris une tâche de 1 à 500 caractères.' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM todo_tasks WHERE owner = ? AND id = ?')
      .bind(owner, body.id).first();
    if (existing) return json({ ok: true });

    let remindAt = null;
    let subscriptionId = null;
    if (body.remind_at) {
      const time = Date.parse(body.remind_at);
      if (!Number.isFinite(time) || time <= Date.now()) return json({ error: 'Choisis une date et une heure à venir.' }, 400);
      if (typeof body.endpoint !== 'string' || body.endpoint.length > 4096) {
        return json({ error: 'Active les notifications sur cet appareil.' }, 400);
      }
      subscriptionId = await digest(body.endpoint);
      const subscription = await env.DB.prepare('SELECT id FROM push_subscriptions WHERE id = ?').bind(subscriptionId).first();
      if (!subscription) return json({ error: 'Réactive les notifications sur cet appareil.' }, 400);
      remindAt = new Date(time).toISOString();
    }

    await env.DB.prepare(`
      INSERT INTO todo_tasks (id, owner, message, created_at, remind_at, subscription_id)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING
    `).bind(body.id, owner, message, new Date().toISOString(), remindAt, subscriptionId).run();
    return json({ ok: true }, 201);
  } catch (error) {
    console.error('Erreur liste de tâches', error);
    return json({ error: 'Liste indisponible. Vérifie que la mise à jour de la base a été appliquée.' }, 503);
  }
}
