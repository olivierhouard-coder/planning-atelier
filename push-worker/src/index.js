
import { buildPushPayload } from '@block65/webcrypto-web-push';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });

async function deliverDueReminders(env) {
  if (!env.DB) {
    throw new Error('Binding D1 DB manquant');
  }

  if (
    !env.VAPID_PUBLIC_KEY ||
    !env.VAPID_PRIVATE_KEY ||
    !env.VAPID_SUBJECT
  ) {
    throw new Error('Variables VAPID manquantes');
  }

  const now = Date.now();

  const { results: pending = [] } = await env.DB.prepare(`
    SELECT
      r.id,
      r.slot_id,
      r.remind_at,
      r.message,
      s.vehicle_info
    FROM reminders r
    LEFT JOIN slots s ON s.id = r.slot_id
    WHERE r.sent_at IS NULL
      AND r.completed_at IS NULL
    ORDER BY r.remind_at
    LIMIT 100
  `).all();

  const due = pending.filter(reminder => {
    const timestamp = Date.parse(reminder.remind_at);
    return Number.isFinite(timestamp) && timestamp <= now;
  });

  if (!due.length) {
    return { due: 0, delivered: 0 };
  }

  const { results: subscriptions = [] } =
    await env.DB.prepare(`
      SELECT id, endpoint, p256dh, auth
      FROM push_subscriptions
    `).all();

  if (!subscriptions.length) {
    return {
      due: due.length,
      delivered: 0,
      warning: 'Aucun appareil abonné'
    };
  }

  let delivered = 0;
  let failed = 0;

  for (const reminder of due) {
    const title = 'Planning Atelier — rappel';

    const body = [
      reminder.vehicle_info || 'Dossier atelier',
      reminder.message || 'Penser aux pièces à commander'
    ].join(' : ');

    let successful = 0;

    for (const saved of subscriptions) {
      const subscription = {
        endpoint: saved.endpoint,
        expirationTime: null,
        keys: {
          p256dh: saved.p256dh,
          auth: saved.auth
        }
      };

      try {
        const payload = await buildPushPayload(
          {
            data: {
              title,
              body,
              url: '/',
              tag: 'planning-reminder-' + reminder.id
            },
            options: {
              ttl: 86400,
              urgency: 'high'
            }
          },
          subscription,
          {
            subject: env.VAPID_SUBJECT,
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY
          }
        );

        const response = await fetch(saved.endpoint, payload);

        if (response.ok) {
          successful++;
        } else if (
          response.status === 404 ||
          response.status === 410
        ) {
          await env.DB.prepare(
            'DELETE FROM push_subscriptions WHERE id = ?'
          ).bind(saved.id).run();
        } else {
          console.error(
            'Échec notification',
            reminder.id,
            response.status
          );
        }
      } catch (error) {
        console.error(
          'Erreur notification',
          reminder.id,
          String(error?.message || error)
        );
      }
    }

    if (successful > 0) {
      await env.DB.prepare(`
        UPDATE reminders
        SET sent_at = datetime('now')
        WHERE id = ?
          AND sent_at IS NULL
      `).bind(reminder.id).run();

      delivered++;
    } else {
      failed++;
    }
  }

  return {
    due: due.length,
    delivered,
    failed
  };
}

async function recordDiagnostic(env, source, result) {
  if (!env.DB) return;

  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS cron_diagnostic (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        executed_at TEXT NOT NULL,
        result TEXT NOT NULL
      )
    `).run();

    await env.DB.prepare(`
      INSERT INTO cron_diagnostic (executed_at, result)
      VALUES (?, ?)
    `).bind(
      new Date().toISOString(),
      JSON.stringify({ source, ...result })
    ).run();
  } catch (error) {
    console.error('Erreur diagnostic', error);
  }
}

async function executeReminders(env, source) {
  try {
    const result = await deliverDueReminders(env);

    await recordDiagnostic(env, source, result);

    console.log(
      'Rappels exécutés',
      source,
      JSON.stringify(result)
    );

    return result;
  } catch (error) {
    await recordDiagnostic(env, source, {
      error: String(error?.message || error)
    });

    console.error('Erreur rappels', source, error);
    throw error;
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(executeReminders(env, 'cloudflare-cron'));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({
        ok: true,
        worker: 'planning-atelier-push'
      });
    }

    // Test manuel existant
    if (
      url.pathname === '/test' &&
      request.method === 'POST'
    ) {
      try {
        const result = await executeReminders(
          env,
          'manual-test'
        );

        return json({ ok: true, result });
      } catch (error) {
        return json({
          ok: false,
          error: String(error?.message || error)
        }, 500);
      }
    }

    // Déclenchement de secours sécurisé
    if (url.pathname === '/run') {
      if (request.method !== 'POST') {
        return json({ error: 'Méthode non autorisée' }, 405);
      }

      if (!env.CRON_SECRET) {
        return json({
          error: 'CRON_SECRET non configuré'
        }, 503);
      }

      const authorization =
        request.headers.get('Authorization') || '';

      if (authorization !== `Bearer ${env.CRON_SECRET}`) {
        return json({
          error: 'Accès non autorisé'
        }, 401);
      }

      try {
        const result = await executeReminders(
          env,
          'external-scheduler'
        );

        return json({ ok: true, result });
      } catch (error) {
        return json({
          ok: false,
          error: String(error?.message || error)
        }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  }
};
