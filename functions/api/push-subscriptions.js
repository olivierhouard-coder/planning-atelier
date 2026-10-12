function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
export async function onRequestPost({request,env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  let body; try {body=await request.json();} catch {return json({error:'JSON invalide'},400);}
  if (!body.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) return json({error:'Abonnement push incomplet'},400);
  const endpoint=String(body.subscription.endpoint);
  const id=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint)).then(buf=>Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join(''));
  try {
    await env.DB.prepare(`INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, device_name, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth,device_name=excluded.device_name,updated_at=datetime('now')`)
      .bind(id,endpoint,String(body.subscription.keys.p256dh),String(body.subscription.keys.auth),String(body.device_name||'Téléphone')).run();
  } catch(e) { return json({error:'Table push_subscriptions absente dans D1. Applique d’abord le SQL fourni.'},503); }
  return json({ok:true});
}
export async function onRequestDelete({request,env}) {
  if (!env.DB) return json({error:'Binding D1 DB manquant'},503);
  let body; try {body=await request.json();} catch {return json({error:'JSON invalide'},400);}
  if (!body.endpoint) return json({error:'Endpoint manquant'},400);
  const id=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(body.endpoint))).then(buf=>Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join(''));
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(id).run();
  return json({ok:true});
}
