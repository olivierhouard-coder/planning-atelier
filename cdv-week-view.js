/* CDV : présentation hebdomadaire. Les données et les actions restent celles de l’application. */
(() => {
  if (typeof render !== 'function' || typeof slots === 'undefined') return;
  const dayNames=['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
  // Le mode global conserve toutes les cartes et ouvre les détails au toucher.
  let compact=true;
  try{compact=localStorage.getItem('cdv-week-mode-landscape')!=='detail';}catch{}
  const controls=document.createElement('div');controls.className='cdv-view-controls';
  const modeButton=document.createElement('button');modeButton.type='button';
  const hint=document.createElement('span');hint.textContent='Touchez un véhicule pour lire et modifier ses commentaires.';
  function applyMode(){
    document.body.classList.toggle('cdv-compact',compact);
    modeButton.textContent=compact?'Vue détaillée':'Vue semaine';
    modeButton.setAttribute('aria-pressed',String(!compact));
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(fitWeek);
  }
  modeButton.addEventListener('click',()=>{compact=!compact;applyMode();try{localStorage.setItem('cdv-week-mode-landscape',compact?'compact':'detail');}catch{}});
  controls.append(modeButton,hint);calendar.before(controls);applyMode();
  const actions=document.querySelector('.header-actions');
  if(actions){
    const options=document.createElement('details');options.className='cdv-options';
    const summary=document.createElement('summary');summary.textContent='Options';
    const content=document.createElement('div');content.className='cdv-options-content';
    options.append(summary,content);
    for(const id of ['enableNotifications','manageFleet']){const button=document.getElementById(id);if(button)content.append(button);}
    const push=document.getElementById('pushStatus');if(push)content.append(push);
    actions.append(options);
  }


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
  let dayLayouts=[];
  const dayDialog=document.createElement('dialog');dayDialog.className='cdv-day-dialog';
  const dialogHead=document.createElement('div');dialogHead.className='dialog-head';
  const dialogTitle=document.createElement('h2');dialogTitle.id='cdvDayTitle';dayDialog.setAttribute('aria-labelledby',dialogTitle.id);
  const dialogClose=document.createElement('button');dialogClose.type='button';dialogClose.textContent='Fermer';dialogClose.addEventListener('click',()=>dayDialog.close());
  const dialogList=document.createElement('div');dialogList.className='cdv-dialog-list';dialogHead.append(dialogTitle,dialogClose);dayDialog.append(dialogHead,dialogList);document.body.append(dayDialog);
  function showDay(title,items){dialogTitle.textContent=title;dialogList.replaceChildren();for(const [slot,type] of items)dialogList.append(slotCard(slot,type));dayDialog.showModal();}
  function fitWeek(){
    if(!compact)return;
    const top=calendar.getBoundingClientRect().top;
    const available=Math.max(140,(window.visualViewport?.height||window.innerHeight)-top-32);
    calendar.style.height=available+'px';
    for(const layout of dayLayouts){
      for(const card of layout.cards)card.hidden=false;
      layout.more.hidden=true;
      const area=layout.events.getBoundingClientRect().height;
      if(!area)continue;
      let total=layout.cards.reduce((n,c)=>n+c.getBoundingClientRect().height,0);
      if(total<=area)continue;
      layout.more.hidden=false;const reserved=layout.more.getBoundingClientRect().height||32;
      let used=0,visible=0;
      for(const card of layout.cards){const height=card.getBoundingClientRect().height;const fits=used+height<=Math.max(0,area-reserved);card.hidden=!fits;if(fits){used+=height;visible++;}}
      layout.more.textContent='+ '+(layout.cards.length-visible)+' véhicule(s)';
    }
  }
  if(typeof ResizeObserver!=='undefined'){new ResizeObserver(()=>{if(typeof requestAnimationFrame==='function')requestAnimationFrame(fitWeek);}).observe(calendar);}
  if(typeof window!=='undefined'){window.addEventListener('resize',()=>{if(typeof requestAnimationFrame==='function')requestAnimationFrame(fitWeek);});window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(fitWeek));}
  function slotCard(s,type){
    const ev=document.createElement('button');ev.type='button';ev.className='week-event cdv-slot';
    const marker=document.createElement('span');marker.className='cdv-slot-kind '+(type==='Sortie'?'cdv-exit':'');marker.textContent=type;marker.dataset.short=type==='Sortie'?'S':type==='Entrée'?'E':type==='En cours'?'•':'E/S';
    const content=document.createElement('div');content.className='cdv-slot-content';
    const name=document.createElement('strong');name.textContent=s.vehicle_info||'Client / véhicule à renseigner';
    const note=document.createElement('span');note.className='cdv-slot-note';note.textContent=s.notes||'Aucun commentaire';
    content.append(name,note);
    const reminder=reminders.find(r=>r.slot_id===s.id&&!r.completed_at);
    if(reminder||s.replacement_vehicle_id){const tags=document.createElement('span');tags.className='cdv-slot-tags';if(reminder){const t=document.createElement('small');t.textContent='📦 Pièces';t.title='Pièces à commander · rappel actif';tags.append(t);}if(s.replacement_vehicle_id){const t=document.createElement('small');t.textContent='🚗 VR';t.title='VR réservé · '+(s.replacement_vehicle_name||'Véhicule');tags.append(t);}content.append(tags);}
    ev.setAttribute('aria-label',(s.vehicle_info||'Véhicule')+' · '+type+' · '+(s.notes||'Aucun commentaire'));ev.title=s.notes||'Ouvrir le dossier';ev.append(marker,content);ev.addEventListener('click',()=>{if(dayDialog.open)dayDialog.close();openEdit(s);});return ev;
  }
  render=function renderClearWeek(){
    dayLayouts=[];calendar.replaceChildren();const start=weekStart(viewDate),end=new Date(start);end.setDate(start.getDate()+4);
    $('monthLabel').textContent=`${weekFmt.format(start)} – ${weekFmt.format(end)} ${end.getFullYear()}`;
    const status=document.getElementById('status');if(status)status.classList.toggle('cdv-status-ok',/^\d+ rendez-vous enregistré\(s\)\.$/.test(status.textContent));
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
      const events=document.createElement('div');events.className='cdv-day-events'+(entering.length+leaving.length>6?' cdv-busy-day':'');cell.append(events);
      const ongoing=active.filter(s=>s.entry_date<day&&s.return_date>day);
      for(const s of entering)events.append(slotCard(s,s.return_date===day?'Entrée / sortie':'Entrée'));
      for(const s of leaving)events.append(slotCard(s,'Sortie'));
      if(!entering.length&&!leaving.length){const p=document.createElement('p');p.className='empty-day';p.textContent='Aucune entrée ni sortie prévue';events.append(p);}
      if(ongoing.length){const button=document.createElement('button');button.type='button';button.className='cdv-ongoing-button';button.textContent=`${ongoing.length} en cours ›`;button.addEventListener('click',()=>showDay(label.textContent+' · Véhicules en cours',ongoing.map(s=>[s,'En cours'])));cell.append(button);}
      const allItems=[...entering.map(s=>[s,s.return_date===day?'Entrée / sortie':'Entrée']),...leaving.map(s=>[s,'Sortie'])];
      const cards=Array.from(events.querySelectorAll('.cdv-slot'));
      const more=document.createElement('button');more.type='button';more.className='cdv-more';more.hidden=true;more.addEventListener('click',()=>showDay(label.textContent+' · Tous les mouvements',allItems));events.append(more);
      dayLayouts.push({events,cards,more});
      const footer=document.createElement('div');footer.className='cdv-day-total';footer.textContent=`${entering.length} entrée(s) · ${leaving.length+entering.filter(s=>s.return_date===day).length} sortie(s)`;cell.append(footer);calendar.append(cell);
    }
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(fitWeek);
  };
  const legend=document.querySelector('.legend');if(legend)legend.textContent='E : entrée · S : sortie · 🚗 VR réservé · 📦 Pièces à commander · Touchez un dossier pour le détail.';
  render();
})();
