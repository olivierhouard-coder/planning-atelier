const $ = (id) => document.getElementById(id);
const calendar = $('calendar');
const dialog = $('slotDialog');
const form = $('slotForm');
let viewDate = new Date();
let slots = [];
let reminders = [];

const weekFmt = new Intl.DateTimeFormat('fr-FR', {day:'numeric',month:'long'});
const weekStart = (date) => {const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);return d;};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
const safe = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toLocalInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

async function api(path, options={}) {
  const res = await fetch(path, { headers: {'Content-Type':'application/json', ...(options.headers||{})}, ...options });
  if (!res.ok) throw new Error(await res.text() || `Erreur HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}
async function loadSlots() {
  $('status').textContent = 'Chargement des rendez-vous…';
  try {
    const results = await Promise.allSettled([api('/api/slots'),api('/api/reminders')]);
    if (results[0].status !== 'fulfilled') throw results[0].reason;
    slots = results[0].value;
    reminders = results[1].status === 'fulfilled' ? results[1].value : [];
    $('status').textContent = `${slots.length} rendez-vous enregistré(s).` + (results[1].status === 'fulfilled' ? '' : ' Les rappels ne sont pas disponibles pour le moment.');
    render();
  } catch (e) {
    $('status').textContent = 'Impossible de charger les rendez-vous : '+e.message;
    render();
  }
}
function render() {
  calendar.innerHTML='';
  const start=weekStart(viewDate);
  const end=new Date(start);end.setDate(start.getDate()+4);
  $('monthLabel').textContent=`Semaine du ${weekFmt.format(start)} au ${weekFmt.format(end)} ${end.getFullYear()}`;
  const today=iso(new Date());
  const active=slots.filter(s=>s.entry_date<=iso(end) && (s.return_date||s.entry_date)>=iso(start));
  $('weekCount').textContent=`${active.length} rendez-vous cette semaine`;
  for(let i=0;i<5;i++) {
    const d=new Date(start);d.setDate(start.getDate()+i);
    const day=iso(d);
    const cell=document.createElement('section');
    cell.className='week-day'+(day===today?' today':'');
    const head=document.createElement('div');head.className='week-day-head';
    const label=document.createElement('h3');label.textContent=['Lundi','Mardi','Mercredi','Jeudi','Vendredi'][i]+' '+d.getDate();
    const add=document.createElement('button');add.type='button';add.className='day-add';add.textContent='+ RDV';
    add.setAttribute('aria-label','Ajouter un rendez-vous le '+day);add.addEventListener('click',()=>openNew(day));
    head.append(label,add);cell.append(head);
    const daily=active.filter(s=>s.entry_date<=day && (s.return_date||s.entry_date)>=day);
    if(!daily.length){const empty=document.createElement('p');empty.className='empty-day';empty.textContent='Aucun rendez-vous';cell.append(empty);}
    for(const s of daily){
      const reminder=reminders.find(r=>r.slot_id===s.id && !r.completed_at);
      const ev=document.createElement('button');ev.type='button';ev.className='week-event';
      const name=document.createElement('strong');name.textContent=s.vehicle_info||'Véhicule / client';
      const note=document.createElement('span');note.textContent=s.notes||'Cliquer pour consulter ou modifier';
      name.style.display = 'block'; note.style.display = 'block'; note.style.marginTop = '8px'; note.style.whiteSpace = 'pre-wrap'; note.style.overflowWrap = 'anywhere'; ev.append(name,note);
      if(reminder){const bell=document.createElement('small');bell.textContent='🔔 Rappel pièces';ev.append(bell);}
      ev.addEventListener('click',()=>openEdit(s));cell.append(ev);
    }
    calendar.append(cell);
  }
}
function openNew(day=iso(new Date())) {
  form.reset(); $('slotId').value=''; $('reminderId').value=''; $('entryDate').value=day; $('returnDate').value='';
  $('formTitle').textContent='Nouveau rendez-vous'; $('deleteSlot').classList.add('hidden');
  $('partsNeeded').value='no'; $('reminderAt').value=''; $('reminderMessage').value=''; $('reminderCompleted').checked=false;
  dialog.showModal();
}
function openEdit(s) {
  const r = reminders.find(item => item.slot_id === s.id);
  $('slotId').value=s.id; $('entryDate').value=s.entry_date; $('returnDate').value=s.return_date || '';
  $('vehicleInfo').value=s.vehicle_info || ''; $('notes').value=s.notes || '';
  $('reminderId').value=r?.id || '';
  $('partsNeeded').value=r ? 'yes' : 'no';
  $('reminderAt').value=toLocalInput(r?.remind_at);
  $('reminderMessage').value=r?.message || '';
  $('reminderCompleted').checked=Boolean(r?.completed_at);
  $('formTitle').textContent='Modifier le rendez-vous'; $('deleteSlot').classList.remove('hidden');
  dialog.showModal();
}
form.addEventListener('submit', async e => {
  e.preventDefault();
  const existingId=$('slotId').value;
  const payload={...(existingId?{id:existingId}:{}), entry_date:$('entryDate').value, return_date:$('returnDate').value || null,
    vehicle_info:$('vehicleInfo').value.trim() || null, notes:$('notes').value.trim() || null};
  if(!payload.entry_date){alert('La date d’entrée est obligatoire.');return;}
  const reminderAt=$('reminderAt').value;
  if ($('partsNeeded').value === 'yes' && !reminderAt) { alert('Choisis une date et une heure pour le rappel des pièces.'); return; }
  try {
    const saved=await api('/api/slots', {method:existingId?'PUT':'POST', body:JSON.stringify(payload)});
    const id=saved.id;
    const reminderId=$('reminderId').value;
    if ($('partsNeeded').value === 'yes' && reminderAt) {
      const reminder={id:reminderId || crypto.randomUUID(),slot_id:id,remind_at:new Date(reminderAt).toISOString(),
        message:$('reminderMessage').value.trim() || 'Penser aux pièces à commander',completed:$('reminderCompleted').checked};
      await api('/api/reminders',{method:'POST',body:JSON.stringify(reminder)});
    } else if (reminderId) {
      await api('/api/reminders?id='+encodeURIComponent(reminderId),{method:'DELETE'});
    }
    dialog.close(); await loadSlots();
  } catch(err) { alert('Enregistrement impossible : '+err.message); }
});
$('deleteSlot').addEventListener('click', async () => {
  const id=$('slotId').value; if(!id || !confirm('Supprimer ce rendez-vous ?')) return;
  try { await api('/api/slots?id='+encodeURIComponent(id), {method:'DELETE'}); dialog.close(); await loadSlots(); }
  catch(err) { alert('Suppression impossible : '+err.message); }
});
$('newSlot').addEventListener('click',()=>openNew());
$('closeDialog').addEventListener('click',()=>dialog.close());
$('cancel').addEventListener('click',()=>dialog.close());
$('prevMonth').addEventListener('click',()=>{viewDate.setDate(viewDate.getDate()-7);render();});
$('nextMonth').addEventListener('click',()=>{viewDate.setDate(viewDate.getDate()+7);render();});
$('today').addEventListener('click',()=>{viewDate=new Date();render();});
loadSlots();

function base64UrlToBytes(value) {
  const padded=value + '='.repeat((4-value.length%4)%4);
  const base64=padded.replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function enablePushNotifications() {
  const status=$('pushStatus');
  const button=$('enableNotifications');
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    status.textContent='Ce navigateur ne prend pas en charge les notifications push. Sur iPhone, ouvre Planning Atelier depuis son icône sur l’écran d’accueil.';
    return;
  }
  button.disabled=true;
  status.textContent='Activation des notifications…';
  try {
    const permission=await Notification.requestPermission();
    if (permission!=='granted') throw new Error('Autorisation refusée. Autorise les notifications dans les réglages du navigateur.');
    const config=await api('/api/push-config');
    if (!config.enabled || !config.publicKey) throw new Error('Le service push doit encore être configuré côté Cloudflare.');
    const registration=await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let subscription=await registration.pushManager.getSubscription();
    if (!subscription) subscription=await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64UrlToBytes(config.publicKey)
    });
    await api('/api/push-subscriptions',{method:'POST',body:JSON.stringify({
      subscription:subscription.toJSON(),
      device_name:/iPhone|iPad|iPod/.test(navigator.userAgent)?'iPhone/iPad':/Android/.test(navigator.userAgent)?'Android':'Navigateur ordinateur'
    })});
    status.textContent='Notifications autorisées sur cet appareil. Le service d’envoi automatique doit encore être activé côté Cloudflare.';
    button.textContent='✓ Notifications autorisées';
  } catch(err) {
    status.textContent='Activation incomplète : '+err.message;
    button.disabled=false;
  }
}
$('enableNotifications').addEventListener('click',enablePushNotifications);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(()=> {
    const status=$('pushStatus');
    if(status) status.textContent='Le service de notifications ne peut pas encore être enregistré sur ce navigateur.';
  });
}
async function verifierNotifications() {
  const bouton = document.getElementById('enableNotifications');
  const statut = document.getElementById('pushStatus');

  if (!bouton || !statut || !('Notification' in window) ||
      !('serviceWorker' in navigator) || !('PushManager' in window)) return;

  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const abonnement = await registration.pushManager.getSubscription();

    if (abonnement) {
      bouton.textContent = '✓ Notifications autorisées';
      statut.textContent = 'Notifications déjà activées sur cet appareil.';
    }
  } catch (erreur) {
    console.error('Vérification des notifications :', erreur);
  }
}

verifierNotifications();
