function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
export async function onRequestPost({request,env}){
 if(!env.DB)return json({error:'Binding D1 DB manquant'},503);
 let body;try{body=await request.json();}catch{return json({error:'JSON invalide'},400);}
 if(typeof body?.slot_id!=='string'||!body.slot_id)return json({error:'Rendez-vous manquant'},400);
 // Date civile en France, calculée côté serveur. Le jour du retour reste indisponible.
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 try{
  const loan=await env.DB.prepare('SELECT s.id,s.entry_date,s.return_date,s.returned_at,r.vehicle_id FROM slots s JOIN replacement_reservations r ON r.slot_id=s.id WHERE s.id=?').bind(body.slot_id).first();
  if(!loan)return json({error:'Aucun VR associé à ce rendez-vous'},404);
  if(loan.returned_at)return json({error:'Retour déjà confirmé'},409);
  if(loan.entry_date>today)return json({error:'Le prêt ne commence que le '+loan.entry_date},409);
  const statements=[
   env.DB.prepare("UPDATE slots SET actual_return_date=?,returned_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND returned_at IS NULL").bind(today,loan.id),
   env.DB.prepare('DELETE FROM replacement_occupancy WHERE slot_id=? AND day>?').bind(loan.id,today)
  ];
  await env.DB.batch(statements);
  return json({ok:true,actual_return_date:today});
 }catch(e){return json({error:String(e?.message||e)},500);}
}
