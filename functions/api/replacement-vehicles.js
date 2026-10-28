function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
export async function onRequestGet({env}){
 if(!env.DB)return json({error:'Binding D1 DB manquant'},503);
 try{const {results=[]}=await env.DB.prepare('SELECT id,name,active FROM replacement_vehicles ORDER BY id').all();return json(results);}catch(e){return json({error:String(e.message||e)},500);}
}
export async function onRequestPut({request,env}){
 if(!env.DB)return json({error:'Binding D1 DB manquant'},503);
 let b;try{b=await request.json();}catch{return json({error:'JSON invalide'},400);}
 const id=Number(b?.id),name=typeof b?.name==='string'?b.name.trim():'';
 if(!Number.isSafeInteger(id)||id<1||!name||name.length>60||typeof b.active!=='boolean')return json({error:'Identifiant, nom (1 à 60 caractères) et état actif requis.'},400);
 try{const result=await env.DB.prepare('UPDATE replacement_vehicles SET name=?,active=? WHERE id=?').bind(name,b.active?1:0,id).run();if(!result.meta?.changes)return json({error:'VR introuvable'},404);return json({ok:true});}catch(e){return json({error:String(e.message||e)},500);}
}
