function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
export async function onRequestGet({env}) {
  if (!env.VAPID_PUBLIC_KEY) return json({enabled:false,error:'Clé publique VAPID non configurée'},503);
  return json({enabled:true,publicKey:env.VAPID_PUBLIC_KEY});
}
