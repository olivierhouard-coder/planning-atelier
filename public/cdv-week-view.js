/* CDV : présentation hebdomadaire. Les données et les actions restent celles de l’application. */
(() => {
  if (typeof render !== 'function' || typeof slots === 'undefined') return;
  const dayNames=['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
  function holidays(year) {
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
    const easter=new Date(year,Math.floor((h+l-7*m+114)/31)-1,(h+l-7*m+114)%31+1);
    const after=n=>{const x=new Date(easter);x.setDate(x.getDate()+n);return iso(x);};
    return {[year+'-01-01']:"Jour de l’An",[after(1)]:'Lundi de Pâques',[year+'-05-01']:'Fête du Travail',[year+'-05-08']:'Victoire 1945',[after(39)]:'Ascension',[after(50)]:'Lundi de Pentecôte',[year+'-07-14']:'Fête nationale',[year+'-08-15']:'Assomption',[year+'-11-01']:'Toussaint',[year+'-11-11']:'Armistice 1918',[year+'-12-25']:'Noël'};
  }
  const banner=document.createElement('div');banner.id='cdvHolidayBanner';banner.setAttribute('role','status');banner.hidden=true;
  calendar.before(banner);
  const fleet=document.querySelector('.vr-dashboard');
  if(fleet){const panel=document.createElement('details');panel.className='cdv-fleet-panel';const summary=document.createElement('summary');summary.textContent='Disponibilité des véhicules de remplacement';fleet.before(panel);panel.append(summary,fleet);}
  function slotCard(s,type){
    const ev=document.createElement('button');ev.type='button';ev.className='week-event cdv-slot';
    const marker=document.createElement('span');marker.className='cdv-slot-kind '+(type==='Sortie'?'cdv-exit':'');marker.textContent=type;
    const content=document.createElement('div');content.className='cdv-slot-content';
    const name=document.createElement('strong');name.textContent=s.vehicle_info||'Client / véhicule à renseigner';
    const note=document.createElement('span');note.className='cdv-slot-note';note.textContent=s.notes||'Aucun commentaire';
    content.append(name,note);
    const reminder=reminders.find(r=>r.slot_id===s.id&&!r.completed_at);
    if(reminder||s.replacement_vehicle_id){const tags=document.createElement('span');tags.className='cdv-slot-tags';if(reminder){const t=document.createElement('small');t.textContent='Rappel pièces';tags.append(t);}if(s.replacement_vehicle_id){const t=document.createElement('small');t.textContent='VR · '+(s.replacement_vehicle_name||'Réservé');tags.append(t);}content.append(tags);}
    ev.append(marker,content);ev.addEventListener('click',()=>openEdit(s));return ev;
  }
  render=function renderClearWeek(){
    calendar.replaceChildren();const start=weekStart(viewDate),end=new Date(start);end.setDate(start.getDate()+4);
    $('monthLabel').textContent=`Semaine du ${weekFmt.format(start)} au ${weekFmt.format(end)} ${end.getFullYear()}`;
    const active=slots.filter(s=>s.entry_date<=iso(end)&&(s.return_date||s.entry_date)>=iso(start));
    $('weekCount').textContent=`${active.length} véhicule(s) prévu(s) cette semaine`;
    const h={...holidays(start.getFullYear()),...holidays(end.getFullYear())};
    const sunday=new Date(start);sunday.setDate(sunday.getDate()+6);
    const within=Object.entries(h).filter(([day])=>day>=iso(start)&&day<=iso(sunday));
    banner.hidden=!within.length;
    banner.textContent=within.map(([day,label])=>`${new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(parseDate(day))} · ${label}`).join(' / ')+(within.length?' — jour férié, ouverture de l’atelier à confirmer':'');
    for(let i=0;i<5;i++){
      const d=new Date(start);d.setDate(d.getDate()+i);const day=iso(d),cell=document.createElement('section');
      cell.className='week-day'+(day===iso(new Date())?' today':'')+(h[day]?' cdv-holiday':'');
      const head=document.createElement('div');head.className='week-day-head';const label=document.createElement('h3');label.textContent=dayNames[i]+' '+d.getDate();
      const add=document.createElement('button');add.type='button';add.className='day-add';add.textContent='+';add.setAttribute('aria-label','Ajouter un rendez-vous le '+day);add.addEventListener('click',()=>openNew(day));head.append(label,add);cell.append(head);
      if(h[day]){const marker=document.createElement('div');marker.className='cdv-holiday-label';marker.textContent=h[day]+' · Férié';cell.append(marker);}
      const entering=active.filter(s=>s.entry_date===day),leaving=active.filter(s=>s.return_date===day&&s.entry_date!==day);
      const ongoing=active.filter(s=>s.entry_date<day&&s.return_date>day);
      for(const s of entering)cell.append(slotCard(s,s.return_date===day?'Entrée / sortie':'Entrée'));
      for(const s of leaving)cell.append(slotCard(s,'Sortie'));
      if(!entering.length&&!leaving.length){const p=document.createElement('p');p.className='empty-day';p.textContent='Aucune entrée ni sortie prévue';cell.append(p);}
      if(ongoing.length){const details=document.createElement('details');details.className='cdv-ongoing';const summary=document.createElement('summary');summary.textContent=`${ongoing.length} véhicule(s) en cours`;details.append(summary);for(const s of ongoing)details.append(slotCard(s,'En cours'));cell.append(details);}
      const footer=document.createElement('div');footer.className='cdv-day-total';footer.textContent=`${entering.length} entrée(s) · ${leaving.length+entering.filter(s=>s.return_date===day).length} sortie(s)`;cell.append(footer);calendar.append(cell);
    }
  };
  const legend=document.querySelector('.legend');if(legend)legend.textContent='Entrées et sorties visibles · Dépliez « véhicules en cours » pour retrouver les séjours déjà commencés.';
  render();
})();
