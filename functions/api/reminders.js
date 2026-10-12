function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
export async function onRequestGet({env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  const {results=[]}=await env.DB.prepare(
    'SELECT id, slot_id, remind_at, message, recipient_olivier, recipient_christophe, completed_at, sent_at FROM reminders ORDER BY remind_at'
  ).all();
  return json(results);
}
export async function onRequestPost({request,env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  let body;
  try { body=await request.json(); } catch { return json({error:'JSON invalide'},400); }
  if (!body.id || !body.slot_id || !body.remind_at) return json({error:'Dossier, date et heure du rappel obligatoires.'},400);
  const parsed=Date.parse(body.remind_at);
  if (!Number.isFinite(parsed)) return json({error:'Date du rappel invalide.'},400);
  const remindAt=new Date(parsed).toISOString();
  const exists=await env.DB.prepare('SELECT id FROM reminders WHERE id=?').bind(String(body.id)).first();
  if (exists) {
    await env.DB.prepare(`UPDATE reminders SET slot_id=?, remind_at=?, message=?, completed_at=?, sent_at=NULL WHERE id=?`)
      .bind(String(body.slot_id),remindAt,body.message||null,body.completed?new Date().toISOString():null,String(body.id)).run();
  } else {
    await env.DB.prepare(`INSERT INTO reminders (id,slot_id,remind_at,message,recipient_olivier,recipient_christophe,completed_at) VALUES (?,?,?,?,1,1,?)`)
      .bind(String(body.id),String(body.slot_id),remindAt,body.message||null,body.completed?new Date().toISOString():null).run();
  }
  return json({ok:true,id:body.id});
}
export async function onRequestDelete({request,env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  const id=new URL(request.url).searchParams.get('id');
  if (!id) return json({error:'Identifiant manquant'},400);
  await env.DB.prepare('DELETE FROM reminders WHERE id=?').bind(id).run();
  return new Response(null,{status:204});
}
