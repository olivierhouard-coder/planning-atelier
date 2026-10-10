const $ = (id) => document.getElementById(id);
const calendar = $('calendar');
const dialog = $('slotDialog');
const form = $('slotForm');
let viewDate = new Date();
let slots = [];

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
const safe = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(path, options={}) {
  const res = await fetch(path, { headers: {'Content-Type':'application/json', ...(options.headers||{})}, ...options });
  if (!res.ok) throw new Error(await res.text() || `Erreur HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}
async function loadSlots() {
  $('status').textContent = 'Chargement des rendez-vous…';
  try {
    slots = await api('/api/slots');
    $('status').textContent = `${slots.length} rendez-vous enregistré(s).`;
    render();
  } catch (e) {
    $('status').textContent = 'La base D1 n’est pas encore reliée. Termine la configuration Cloudflare avant utilisation.';
    render();
  }
}
function render() {
  calendar.innerHTML = '';
  $('monthLabel').textContent = monthFmt.format(viewDate);
  ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(w => {
    const el = document.createElement('div'); el.className='weekday'; el.textContent=w; calendar.append(el);
  });
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(first); start.setDate(first.getDate() - ((first.getDay()+6)%7));
  const today = iso(new Date());
  for(let i=0;i<42;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const cell = document.createElement('div');
    cell.className='day'+(d.getMonth()!==viewDate.getMonth()?' other':'')+(iso(d)===today?' today':'');
    cell.innerHTML = `<div class="daynum">${d.getDate()}</div>`;
    const day = iso(d);
    slots.filter(s => s.entry_date <= day && (!s.return_date || s.return_date >= day)).forEach(s => {
      const ev = document.createElement('button');
      ev.type='button'; ev.className='event';
      ev.innerHTML = `<strong>${safe(s.vehicle_info || 'Véhicule / client')}</strong><span class="long">${safe(s.notes || '')}</span>`;
      ev.title = `${s.entry_date}${s.return_date ? ' → '+s.return_date : ''}`;
      ev.addEventListener('click', () => openEdit(s));
      cell.append(ev);
    });
    cell.addEventListener('dblclick', () => openNew(day));
    calendar.append(cell);
  }
}
function openNew(day=iso(new Date())) {
  form.reset(); $('slotId').value=''; $('entryDate').value=day; $('returnDate').value='';
  $('formTitle').textContent='Nouveau rendez-vous'; $('deleteSlot').classList.add('hidden');
  dialog.showModal();
}
function openEdit(s) {
  $('slotId').value=s.id; $('entryDate').value=s.entry_date; $('returnDate').value=s.return_date || '';
  $('vehicleInfo').value=s.vehicle_info || ''; $('notes').value=s.notes || '';
  $('formTitle').textContent='Modifier le rendez-vous'; $('deleteSlot').classList.remove('hidden');
  dialog.showModal();
}
form.addEventListener('submit', async e => {
  e.preventDefault();
  const id=$('slotId').value || crypto.randomUUID();
  const payload={id, entry_date:$('entryDate').value, return_date:$('returnDate').value || null,
    vehicle_info:$('vehicleInfo').value.trim() || null, notes:$('notes').value.trim() || null};
  if(!payload.entry_date){alert('La date d’entrée est obligatoire.');return;}
  try {
    await api('/api/slots', {method:'POST', body:JSON.stringify(payload)});
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
$('prevMonth').addEventListener('click',()=>{viewDate.setMonth(viewDate.getMonth()-1);render();});
$('nextMonth').addEventListener('click',()=>{viewDate.setMonth(viewDate.getMonth()+1);render();});
$('today').addEventListener('click',()=>{viewDate=new Date();render();});
loadSlots();
