function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
export async function onRequestGet({env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'}, 503);
  const {results=[]} = await env.DB.prepare(
    'SELECT id, entry_date, return_date, vehicle_info, notes, created_at, updated_at FROM slots ORDER BY entry_date, created_at'
  ).all();
  return json(results);
}
export async function onRequestPost({request, env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'}, 503);
  let body;
  try { body = await request.json(); } catch { return json({error:'JSON invalide'},400); }
  if (!body.id || !body.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.entry_date)) return json({error:'La date d’entrée est obligatoire et doit être valide.'},400);
  const returnDate = body.return_date || null;
  if (returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) return json({error:'Date de restitution invalide'},400);
  await env.DB.prepare(`
    INSERT INTO slots (id, entry_date, return_date, vehicle_info, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET entry_date=excluded.entry_date, return_date=excluded.return_date,
      vehicle_info=excluded.vehicle_info, notes=excluded.notes, updated_at=datetime('now')
  `).bind(String(body.id), body.entry_date, returnDate, body.vehicle_info || null, body.notes || null).run();
  return json({ok:true,id:body.id});
}
export async function onRequestDelete({request, env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({error:'Identifiant manquant'},400);
  await env.DB.prepare('DELETE FROM slots WHERE id=?').bind(id).run();
  return new Response(null,{status:204});
}
