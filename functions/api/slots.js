function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
function validate(b){
 if(!validDate(b?.entry_date)) return 'Date d’entrée invalide ou manquante.';
 if(b.return_date && !validDate(b.return_date)) return 'Date de restitution invalide.';
 if(b.return_date && b.return_date<b.entry_date) return 'La restitution ne peut pas précéder l’entrée.';
 return null;
}
const hasVR=b=>Object.prototype.hasOwnProperty.call(b,'replacement_vehicle_id');
function dates(from,to){
 const start=Date.parse(from+'T12:00:00Z'),end=Date.parse(to+'T12:00:00Z');
 const days=Math.round((end-start)/86400000)+1;
 if(days<1||days>366) throw new Error('Réservation VR limitée à 366 jours.');
 return Array.from({length:days},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
}
async function vehicle(db,id){return db.prepare('SELECT id,name,active FROM replacement_vehicles WHERE id=?').bind(id).first();}
function dbError(e){const msg=String(e?.message||e);if(/UNIQUE constraint failed: replacement_occupancy|replacement_occupancy.vehicle_id/i.test(msg))return json({error:'Ce véhicule de remplacement est déjà réservé sur une ou plusieurs dates. Actualise le planning et choisis un autre VR.'},409);return json({error:msg},500);}
export async function onRequestGet({env}){
 if(!env.DB)return json({error:'Binding D1 DB manquant'},503);
 try {const {results=[]}=await env.DB.prepare(`SELECT s.id,s.entry_date,s.return_date,s.vehicle_info,s.notes,s.created_at,s.updated_at,r.vehicle_id AS replacement_vehicle_id,v.name AS replacement_vehicle_name FROM slots s LEFT JOIN replacement_reservations r ON r.slot_id=s.id LEFT JOIN replacement_vehicles v ON v.id=r.vehicle_id ORDER BY s.entry_date,s.created_at`).all();return json(results);}catch(e){return dbError(e);}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return json({error:'Binding D1 DB manquant'},503);
 let b;try{b=await request.json();}catch{return json({error:'JSON invalide'},400);}
 const err=validate(b);if(err)return json({error:err},400);
 const id=crypto.randomUUID(),vr=b.replacement_vehicle_id==null||b.replacement_vehicle_id===''?null:Number(b.replacement_vehicle_id);
 if(vr!==null&&(!Number.isSafeInteger(vr)||vr<1))return json({error:'VR invalide'},400);
 if(vr!==null&&!b.return_date)return json({error:'Renseigne la date de restitution pour réserver un VR.'},400);
 try{
  if(vr!==null){const v=await vehicle(env.DB,vr);if(!v||!v.active)return json({error:'VR inexistant ou désactivé'},400);}
  const statements=[env.DB.prepare("INSERT INTO slots(id,entry_date,return_date,vehicle_info,notes,updated_at) VALUES(?,?,?,?,?,datetime('now'))").bind(id,b.entry_date,b.return_date||null,b.vehicle_info||null,b.notes||null)];
  if(vr!==null){statements.push(env.DB.prepare('INSERT INTO replacement_reservations(vehicle_id,slot_id) VALUES(?,?)').bind(vr,id));for(const day of dates(b.entry_date,b.return_date))statements.push(env.DB.prepare('INSERT INTO replacement_occupancy(vehicle_id,day,slot_id) VALUES(?,?,?)').bind(vr,day,id));}
  await env.DB.batch(statements);return json({ok:true,id},201);
 }catch(e){return dbError(e);}
}
export async function onRequestPut({request,env}){
 if(!env.DB)return json({error:'Binding D1 DB manquant'},503);
 let b;try{b=await request.json();}catch{return json({error:'JSON invalide'},400);}
 if(!b?.id||typeof b.id!=='string')return json({error:'Identifiant du rendez-vous manquant'},400);
 const err=validate(b);if(err)return json({error:err},400);
 try{
  const current=await env.DB.prepare('SELECT s.id,r.vehicle_id FROM slots s LEFT JOIN replacement_reservations r ON r.slot_id=s.id WHERE s.id=?').bind(b.id).first();
  if(!current)return json({error:'Rendez-vous introuvable'},404);
  const vr=hasVR(b)?(b.replacement_vehicle_id==null||b.replacement_vehicle_id===''?null:Number(b.replacement_vehicle_id)):current.vehicle_id;
  if(vr!==null&&(!Number.isSafeInteger(vr)||vr<1))return json({error:'VR invalide'},400);
  if(vr!==null&&!b.return_date)return json({error:'Renseigne la date de restitution pour réserver un VR.'},400);
  if(vr!==null){const v=await vehicle(env.DB,vr);if(!v||(!v.active&&vr!==current.vehicle_id))return json({error:'VR inexistant ou désactivé'},400);}
  const statements=[env.DB.prepare('DELETE FROM replacement_occupancy WHERE slot_id=?').bind(b.id),env.DB.prepare("UPDATE slots SET entry_date=?,return_date=?,vehicle_info=?,notes=?,updated_at=datetime('now') WHERE id=?").bind(b.entry_date,b.return_date||null,b.vehicle_info||null,b.notes||null,b.id)];
  if(vr===null)statements.push(env.DB.prepare('DELETE FROM replacement_reservations WHERE slot_id=?').bind(b.id));
  else {statements.push(env.DB.prepare('INSERT INTO replacement_reservations(vehicle_id,slot_id) VALUES(?,?) ON CONFLICT(slot_id) DO UPDATE SET vehicle_id=excluded.vehicle_id').bind(vr,b.id));for(const day of dates(b.entry_date,b.return_date))statements.push(env.DB.prepare('INSERT INTO replacement_occupancy(vehicle_id,day,slot_id) VALUES(?,?,?)').bind(vr,day,b.id));}
  await env.DB.batch(statements);return json({ok:true,id:b.id});
 }catch(e){return dbError(e);}
}
export async function onRequestDelete({request,env}){
 if(!env.DB)return json({error:'Binding D1 DB manquant'},503);
 const id=new URL(request.url).searchParams.get('id');if(!id)return json({error:'Identifiant manquant'},400);
 try{
  const found=await env.DB.prepare('SELECT id FROM slots WHERE id=?').bind(id).first();if(!found)return json({error:'Rendez-vous introuvable'},404);
  await env.DB.batch([env.DB.prepare('DELETE FROM replacement_occupancy WHERE slot_id=?').bind(id),env.DB.prepare('DELETE FROM replacement_reservations WHERE slot_id=?').bind(id),env.DB.prepare('DELETE FROM slots WHERE id=?').bind(id)]);
  return new Response(null,{status:204});
 }catch(e){return dbError(e);}
}
