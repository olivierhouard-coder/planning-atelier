// API photo minimale. À compléter par une interface d’upload et une authentification avant usage réel.
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});}
export async function onRequestPost({request,env}) {
  if(!env.PHOTOS || !env.DB) return json({error:'Bindings PHOTOS/DB manquants'},503);
  const form = await request.formData();
  const file = form.get('file'), slotId = form.get('slot_id');
  if(!file || !slotId || typeof file.arrayBuffer !== 'function') return json({error:'Photo ou rendez-vous manquant'},400);
  if(!file.type.startsWith('image/')) return json({error:'Seules les images sont acceptées'},415);
  if(file.size > 8*1024*1024) return json({error:'Photo limitée à 8 Mo'},413);
  const id = crypto.randomUUID(), key = `${slotId}/${id}`;
  await env.PHOTOS.put(key, await file.arrayBuffer(), {httpMetadata:{contentType:file.type}});
  await env.DB.prepare('INSERT INTO slot_photos(id,slot_id,object_key,filename,content_type) VALUES(?,?,?,?,?)')
    .bind(id,slotId,key,String(file.name || 'photo'),file.type).run();
  return json({ok:true,id});
}
export async function onRequestGet({request,env}) {
  if(!env.PHOTOS || !env.DB) return json({error:'Bindings PHOTOS/DB manquants'},503);
  const u = new URL(request.url), id=u.searchParams.get('id');
  if(!id) {
    const slotId=u.searchParams.get('slot_id');
    if(!slotId) return json({error:'id ou slot_id manquant'},400);
    const {results=[]}=await env.DB.prepare('SELECT id,slot_id,filename,content_type FROM slot_photos WHERE slot_id=? ORDER BY created_at').bind(slotId).all();
    return json(results);
  }
  const row=await env.DB.prepare('SELECT object_key,content_type FROM slot_photos WHERE id=?').bind(id).first();
  if(!row) return json({error:'Photo introuvable'},404);
  const obj=await env.PHOTOS.get(row.object_key);
  if(!obj) return json({error:'Fichier introuvable'},404);
  return new Response(obj.body,{headers:{'content-type':row.content_type,'cache-control':'private, max-age=60'}});
}
export async function onRequestDelete({request,env}) {
  if(!env.PHOTOS || !env.DB) return json({error:'Bindings PHOTOS/DB manquants'},503);
  const id=new URL(request.url).searchParams.get('id');
  if(!id) return json({error:'id manquant'},400);
  const row=await env.DB.prepare('SELECT object_key FROM slot_photos WHERE id=?').bind(id).first();
  if(!row) return new Response(null,{status:204});
  await env.PHOTOS.delete(row.object_key);
  await env.DB.prepare('DELETE FROM slot_photos WHERE id=?').bind(id).run();
  return new Response(null,{status:204});
}
