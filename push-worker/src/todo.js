import { buildPushPayload } from '@block65/webcrypto-web-push';

export async function deliverDueTasks(env) {
  const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'todo_tasks'").first();
  if (!table) return { due: 0, delivered: 0 };

  const now = new Date().toISOString();
  const retryBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { results: tasks } = await env.DB.prepare(`
    SELECT t.id, t.message, s.id AS subscription_id, s.endpoint, s.p256dh, s.auth
    FROM todo_tasks t JOIN push_subscriptions s ON s.id = t.subscription_id
    WHERE t.owner = 'olivier' AND t.remind_at <= ? AND t.completed_at IS NULL AND t.sent_at IS NULL
      AND (t.claimed_at IS NULL OR t.claimed_at < ?)
    ORDER BY t.remind_at LIMIT 25
  `).bind(now, retryBefore).all();

  let delivered = 0;
  for (const task of tasks) {
    const claim = await env.DB.prepare(`
      UPDATE todo_tasks SET claimed_at = ? WHERE id = ? AND completed_at IS NULL
      AND sent_at IS NULL AND (claimed_at IS NULL OR claimed_at < ?)
    `).bind(now, task.id, retryBefore).run();
    if (!claim.meta.changes) continue;
    try {
      const payload = await buildPushPayload({
        data: {
          title: 'Planning Atelier · À faire',
          body: task.message,
          url: '/#a-faire',
          tag: 'planning-todo-' + task.id
        },
        options: { ttl: 86400, urgency: 'high' }
      }, {
        endpoint: task.endpoint,
        expirationTime: null,
        keys: { p256dh: task.p256dh, auth: task.auth }
      }, {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY
      });
      const response = await fetch(task.endpoint, payload);
      if (response.ok) {
        await env.DB.prepare('UPDATE todo_tasks SET sent_at = ?, claimed_at = NULL WHERE id = ? AND claimed_at = ?')
          .bind(new Date().toISOString(), task.id, now).run();
        delivered++;
      } else if (response.status === 404 || response.status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(task.subscription_id).run();
      } else {
        console.error('Échec rappel tâche', task.id, response.status);
      }
    } catch (error) {
      console.error('Erreur rappel tâche', task.id, String(error?.message || error));
    }
  }
  return { due: tasks.length, delivered };
}
