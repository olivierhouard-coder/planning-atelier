function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
function validate(body) {
  if (!validDate(body?.entry_date)) return 'Date d’entrée invalide ou manquante.';
  if (body.return_date && !validDate(body.return_date)) return 'Date de restitution invalide.';
  if (body.return_date && body.return_date < body.entry_date) return 'La restitution ne peut pas précéder l’entrée.';
  return null;
}
export async function onRequestGet({env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  try {
    const {results=[]}=await env.DB.prepare('SELECT id, entry_date, return_date, vehicle_info, notes, created_at, updated_at FROM slots ORDER BY entry_date, created_at').all();
    return json(results);
  } catch(error) { return json({error:String(error.message||error)},500); }
}
// Création : l'identifiant est généré côté serveur et jamais réutilisé.
export async function onRequestPost({request,env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  let body; try {body=await request.json();} catch {return json({error:'JSON invalide'},400);}
  const error=validate(body); if(error) return json({error},400);
  const id=crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO slots (id,entry_date,return_date,vehicle_info,notes,updated_at) VALUES (?,?,?,?,?,datetime(\'now\'))')
      .bind(id,body.entry_date,body.return_date||null,body.vehicle_info||null,body.notes||null).run();
    return json({ok:true,id},201);
  } catch(e) {return json({error:String(e.message||e)},500);}
}
// Modification : ne touche qu'au RDV explicitement sélectionné.
export async function onRequestPut({request,env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  let body; try {body=await request.json();} catch {return json({error:'JSON invalide'},400);}
  if (!body?.id || typeof body.id !== 'string') return json({error:'Identifiant du rendez-vous manquant'},400);
  const error=validate(body); if(error) return json({error},400);
  try {
    const result=await env.DB.prepare('UPDATE slots SET entry_date=?,return_date=?,vehicle_info=?,notes=?,updated_at=datetime(\'now\') WHERE id=?')
      .bind(body.entry_date,body.return_date||null,body.vehicle_info||null,body.notes||null,body.id).run();
    if (!result.meta?.changes) return json({error:'Rendez-vous introuvable'},404);
    return json({ok:true,id:body.id});
  } catch(e) {return json({error:String(e.message||e)},500);}
}
export async function onRequestDelete({request,env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  const id=new URL(request.url).searchParams.get('id');
  if(!id) return json({error:'Identifiant manquant'},400);
  try {
    const result=await env.DB.prepare('DELETE FROM slots WHERE id=?').bind(id).run();
    if (!result.meta?.changes) return json({error:'Rendez-vous introuvable'},404);
    return new Response(null,{status:204});
  } catch(e) {return json({error:String(e.message||e)},500);}
}
