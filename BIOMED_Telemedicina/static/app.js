const state = { token: null, user: null, data: null, page: 'overview', selectedPatientId: null, cameraStream: null };
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = name => String(name||'U').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const dateText = value => { if(!value) return '—'; const d = new Date(`${value}T12:00:00`); return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}); };
const shortMonth = value => new Date(`${value}T12:00:00`).toLocaleDateString('es-MX',{month:'short'}).replace('.','');
const isDoctor = () => state.user?.role === 'medico';
const patients = () => state.data?.patients || [];
const patientOf = id => patients().find(p=>p.userId===id);
const selectedPatient = () => patientOf(state.selectedPatientId) || patients()[0] || null;
const statusClass = s => s==='Pendiente' || s==='En espera' ? 'pending' : s==='Cancelada' ? 'cancelled' : s==='Finalizada' ? 'neutral' : '';
const statusPill = s => `<span class="status ${statusClass(s)}">${esc(s||'Registrado')}</span>`;

function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),3200); }
async function request(path, body){
  const headers={'Content-Type':'application/json'}; if(state.token) headers.Authorization=`Bearer ${state.token}`;
  const response=await fetch(path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>({error:'Respuesta no válida del servidor.'}));
  if(!response.ok) throw new Error(result.error||'No se pudo completar la solicitud.'); return result;
}
async function enterApp(result){
  state.token=result.token; state.user=result.user;
  try{ await refreshData(); }catch(e){ toast(e.message); logout(false); return; }
  $('#authView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  state.page='overview'; state.selectedPatientId=isDoctor()?patients()[0]?.userId:state.user.id;
  renderShell();
}
async function refreshData(){
  const result=await request('/api/bootstrap'); state.user=result.user; state.data=result.data;
  if(!state.selectedPatientId) state.selectedPatientId=isDoctor()?patients()[0]?.userId:state.user.id;
}
async function logout(show=true){
  if(state.token){ try{await request('/api/logout',{});}catch(e){} }
  if(state.cameraStream){state.cameraStream.getTracks().forEach(t=>t.stop());state.cameraStream=null;}
  state.token=null;state.user=null;state.data=null;state.page='overview';
  $('#appView').classList.add('hidden');$('#authView').classList.remove('hidden');
  if(show) toast('Sesión cerrada.');
}

function setAuthMode(mode){
  const register=mode==='register';
  $('#loginForm').classList.toggle('hidden',register);$('#registerForm').classList.toggle('hidden',!register);
  $('#loginTab').classList.toggle('active',!register);$('#registerTab').classList.toggle('active',register);
  $('#authTitle').textContent=register?'Crea tu espacio en BIOMED.':'Tu salud, nuestra prioridad.';
  $('#authSubtitle').textContent=register?'Regístrate para acceder al entorno de demostración.':'Ingresa para continuar a tu espacio de atención.';
}
$('#loginTab').addEventListener('click',()=>setAuthMode('login'));
$('#registerTab').addEventListener('click',()=>setAuthMode('register'));

let termsLauncher=null;
function showTerms(e){termsLauncher=e?.currentTarget||null;const modal=$('#termsModal');modal.classList.remove('hidden');document.body.classList.add('modal-open');$('#closeTerms').focus();}
function hideTerms(){const modal=$('#termsModal');modal.classList.add('hidden');document.body.classList.remove('modal-open');if(termsLauncher&&!termsLauncher.closest('.hidden'))termsLauncher.focus();termsLauncher=null;}
$('#openTerms').addEventListener('click',showTerms);
$('#openTermsFooter').addEventListener('click',showTerms);
$('#closeTerms').addEventListener('click',hideTerms);
$('#closeTermsBottom').addEventListener('click',hideTerms);
$('#termsModal').addEventListener('click',e=>{if(e.target===$('#termsModal'))hideTerms();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#termsModal').classList.contains('hidden'))hideTerms();});
$('#registerRole').addEventListener('change',e=>$$('.doctor-extra').forEach(el=>el.classList.toggle('hidden',e.target.value!=='medico')));
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=new FormData(e.currentTarget);
  try{const result=await request('/api/login',{email:form.get('email'),password:form.get('password')});await enterApp(result);}catch(err){toast(err.message);}
});
$('#registerForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=new FormData(e.currentTarget);
  const payload={name:form.get('name'),email:form.get('email'),password:form.get('password'),role:form.get('role'),specialty:form.get('specialty'),license:form.get('license'),privacyAccepted:form.get('privacyAccepted')==='on',termsAccepted:form.get('termsAccepted')==='on'};
  try{const result=await request('/api/register',payload);await enterApp(result);}catch(err){toast(err.message);}
});
async function demoLogin(email){try{const result=await request('/api/login',{email,password:'Biomed123!'});await enterApp(result);}catch(err){toast(err.message);}}
$('#demoDoctor').addEventListener('click',()=>demoLogin('medico@biomed.demo'));
$('#demoPatient').addEventListener('click',()=>demoLogin('paciente@biomed.demo'));
$('#logoutBtn').addEventListener('click',()=>logout());


const doctorNav=[['overview','⌂','Resumen'],['patients','♧','Pacientes'],['appointments','▦','Citas'],['records','▤','Expedientes'],['rehab','↗','Rehabilitación'],['chat','☏','Mensajes'],['videocall','◉','Teleconsulta']];
const patientNav=[['overview','⌂','Resumen'],['profile','♙','Mi expediente'],['appointments','▦','Mis citas'],['rehab','↗','Rehabilitación'],['chat','☏','Mensajes'],['videocall','◉','Teleconsulta']];
const titles={overview:'Resumen general',patients:'Directorio de pacientes',appointments:'Agenda de citas',records:'Expediente clínico',profile:'Mi expediente',rehab:'Fisioterapia y rehabilitación',chat:'Mensajería',videocall:'Teleconsulta'};
function renderShell(){
  $('#sideUserName').textContent=state.user.name;$('#sideRole').textContent=isDoctor()?'Médico':'Paciente';$('#roleIcon').textContent=isDoctor()?'M':'P';$('#topAvatar').textContent=initials(state.user.name);
  const nav=isDoctor()?doctorNav:patientNav;
  $('#mainNav').innerHTML=`<div class="nav-label">ESPACIO DE TRABAJO</div>`+nav.map(([key,icon,label])=>`<button type="button" class="nav-btn ${state.page===key?'active':''}" data-nav="${key}"><span class="nav-ico">${icon}</span>${label}</button>`).join('');
  $('#crumbCurrent').textContent=titles[state.page]||'Resumen';$('#pageTitle').textContent=titles[state.page]||'Resumen general';
  renderPage();
}
function go(page){if(state.page==='videocall')stopLocalMedia(false);state.page=page;renderShell();}
$('#mainNav').addEventListener('click',e=>{const b=e.target.closest('[data-nav]');if(b)go(b.dataset.nav);});

function intro(title,description,chip){return `<div class="page-intro"><div><h2>${title}</h2><p>${description}</p></div>${chip?`<span class="intro-chip">${chip}</span>`:''}</div>`;}
function stat(label,value,foot,icon){return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-number">${value}</div><div class="stat-foot">${foot}</div></article>`;}
function patientSelect(value=state.selectedPatientId){return `<select class="field-control patient-select" name="patientId" aria-label="Seleccionar paciente">${patients().map(p=>`<option value="${esc(p.userId)}" ${p.userId===value?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`;}
function noItems(text){return `<div class="empty-state"><span>◌</span>${text}</div>`;}
function appointmentRows(items){
  if(!items.length)return `<div class="empty-table">No hay citas registradas.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Fecha</th><th>Horario</th><th>Tipo</th><th>Estado</th>${isDoctor()?'<th>Acción</th>':''}</tr></thead><tbody>${items.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(a=>{const p=patientOf(a.patientId);return `<tr><td><div class="person-cell"><span class="mini-avatar">${initials(p?.name||'P')}</span><span><b>${esc(p?.name||'Paciente')}</b><small>Atención BIOMED</small></span></div></td><td>${dateText(a.date)}</td><td>${esc(a.time||'—')}</td><td>${esc(a.type||'Consulta')}</td><td>${statusPill(a.status)}</td>${isDoctor()?`<td><select class="small-btn" data-appointment-status="${esc(a.id)}"><option ${a.status==='Pendiente'?'selected':''}>Pendiente</option><option ${a.status==='Confirmada'?'selected':''}>Confirmada</option><option ${a.status==='Finalizada'?'selected':''}>Finalizada</option><option ${a.status==='Cancelada'?'selected':''}>Cancelada</option></select></td>`:''}</tr>`;}).join('')}</tbody></table></div>`;
}
function monthlyBars(items){
  const months=[];const now=new Date();for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString('es-MX',{month:'short'}).replace('.',''),count:0});}
  items.forEach(x=>{const key=String(x.date||x.created||'').slice(0,7);const found=months.find(m=>m.key===key);if(found)found.count++;});const max=Math.max(1,...months.map(m=>m.count));
  return `<div class="bars">${months.map(m=>`<div class="bar-col"><span class="bar-value">${m.count}</span><div class="bar" style="height:${Math.max(5,m.count/max*76)}%"></div><span class="bar-label">${m.label}</span></div>`).join('')}</div>`;
}
function recentRows(items){return items.slice().sort((a,b)=>(b.date||b.time||'').localeCompare(a.date||a.time||'')).slice(0,4).map(a=>`<div class="quick-item"><div class="date-tile"><b>${String(a.date||'').slice(8,10)||'--'}</b><small>${String(a.date||'').slice(5,7)||'--'}</small></div><div><b>${esc(a.diagnosis||a.type||a.title||'Actividad registrada')}</b><p>${dateText(a.date)} · ${esc(a.note||a.type||'Seguimiento BIOMED')}</p></div></div>`).join('')||noItems('Aún no hay actividad en este periodo.');}

function renderOverview(){
  if(isDoctor()){
    const ap=state.data.appointments||[],pending=ap.filter(x=>x.status==='Pendiente').length;
    const records=state.data.records||[];
    return intro(`Buen día, ${esc(state.user.name.split(' ')[0])}`,`Este es el resumen de tu espacio profesional. Administra la atención y el seguimiento de tus pacientes.`,`ROL MÉDICO`)+
      `<div class="stat-grid">${stat('Pacientes registrados',patients().length,'Perfiles en este entorno','♧')}${stat('Citas programadas',ap.length,'Agenda general','▦')}${stat('Pendientes de revisión',pending,'Solicitudes por atender','◷')}${stat('Registros clínicos',records.length,'Notas de seguimiento','▤')}</div>`+
      `<div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Agenda próxima</h3><p>Actividad de citas registrada</p></div><button class="text-btn" data-go="appointments">Ver agenda →</button></div>${appointmentRows(ap.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5))}</section><section class="panel"><div class="panel-head"><div><h3>Accesos rápidos</h3><p>Herramientas del espacio médico</p></div></div><div class="quick-list"><div class="quick-item"><div class="date-tile">♧</div><div><b>Directorio de pacientes</b><p>Consulta perfiles y expedientes.</p><button class="text-btn" data-go="patients">Abrir directorio →</button></div></div><div class="quick-item"><div class="date-tile">↗</div><div><b>Planes de rehabilitación</b><p>Registra planes definidos por el profesional.</p><button class="text-btn" data-go="rehab">Ver módulo →</button></div></div></div></section></div>`+
      `<div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Actividad mensual</h3><p>Registros y citas por mes, últimos seis meses</p></div></div>${monthlyBars([...ap,...records])}</section><section class="panel"><div class="panel-head"><div><h3>Pacientes recientes</h3><p>Perfiles disponibles en la demostración</p></div><button class="text-btn" data-go="patients">Ver todos →</button></div>${patients().slice(0,4).map(p=>`<div class="quick-item"><span class="mini-avatar">${initials(p.name)}</span><div><b>${esc(p.name)}</b><p>${esc(p.phone||'Sin teléfono registrado')}</p></div></div>`).join('')||noItems('No hay pacientes registrados.')}</section></div>`+
      `<div class="notice-strip"><span class="notice-icon">✦</span><div><b>Entorno académico</b>La información de esta plataforma es ficticia. Las decisiones clínicas, indicaciones terapéuticas y planes de rehabilitación corresponden al profesional responsable.</div></div>`;
  }
  const p=patientOf(state.user.id)||{};const ap=state.data.appointments||[],records=state.data.records||[],plans=state.data.rehabPlans||[];
  return intro(`Hola, ${esc(state.user.name.split(' ')[0])}`,`Consulta tu información, próximas citas y seguimiento compartido por tu profesional de salud.`,`ROL PACIENTE`)+
    `<div class="notice-strip"><span class="notice-icon">✦</span><div><b>Tu espacio de seguimiento</b>Aquí puedes consultar la información compartida por tu profesional y actualizar algunos datos personales. Los registros clínicos son de consulta.</div></div>`+
    `<div class="stat-grid">${stat('Próximas citas',ap.filter(a=>a.status!=='Cancelada'&&a.status!=='Finalizada').length,'Citas registradas','▦')}${stat('Registros compartidos',records.length,'Notas de tu expediente','▤')}${stat('Planes de seguimiento',plans.length,'Rehabilitación supervisada','↗')}${stat('Mensajes',state.data.messages.length,'Conversación con tu equipo','☏')}</div>`+
    `<div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Mis próximas citas</h3><p>Fechas y horarios registrados</p></div><button class="text-btn" data-go="appointments">Ver citas →</button></div>${appointmentRows(ap.filter(a=>a.status!=='Cancelada').slice(0,4))}</section><section class="panel"><div class="panel-head"><div><h3>Mi perfil</h3><p>Información personal de contacto</p></div><button class="text-btn" data-go="profile">Consultar →</button></div><div class="profile-grid"><div class="info-box"><small>Nombre</small><b>${esc(p.name||state.user.name)}</b></div><div class="info-box"><small>Teléfono</small><b>${esc(p.phone||'Sin registrar')}</b></div><div class="info-box"><small>Grupo sanguíneo</small><b>${esc(p.bloodType||'No registrado')}</b></div></div></section></div>`+
    `<div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Actividad de seguimiento</h3><p>Citas y registros por mes</p></div></div>${monthlyBars([...ap,...records])}</section><section class="panel"><div class="panel-head"><div><h3>Últimas actualizaciones</h3><p>Información compartida por tu profesional</p></div></div>${recentRows(records)}</section></div>`;
}

function renderPatients(){
  return intro('Directorio de pacientes','Consulta perfiles registrados y abre su expediente para administrar el seguimiento.','ACCESO PROFESIONAL')+
  `<section class="panel"><div class="panel-head"><div><h3>Pacientes registrados</h3><p>${patients().length} perfil(es) disponibles en el entorno local</p></div></div>${patients().length?`<div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Fecha de nacimiento</th><th>Teléfono</th><th>Condiciones registradas</th><th></th></tr></thead><tbody>${patients().map(p=>`<tr><td><div class="person-cell"><span class="mini-avatar">${initials(p.name)}</span><span><b>${esc(p.name)}</b><small>${esc(p.userId)}</small></span></div></td><td>${dateText(p.birthDate)}</td><td>${esc(p.phone||'—')}</td><td>${esc((p.conditions||[]).join(', ')||'—')}</td><td><button class="small-btn" data-open-patient="${esc(p.userId)}">Abrir expediente →</button></td></tr>`).join('')}</tbody></table></div>`:noItems('Todavía no hay pacientes. Registra una cuenta de paciente desde la pantalla de acceso.')}</section>`;
}
function renderAppointments(){
  const list=state.data.appointments||[];
  const form=isDoctor()?`<form class="panel form-panel" data-form="appointment"><h3>Programar una cita</h3><label>Paciente${patientSelect()}</label><div class="field-pair"><label>Fecha<input type="date" name="date" required></label><label>Hora<input type="time" name="time" required></label></div><label>Tipo de atención<select name="type"><option>Consulta general</option><option>Seguimiento</option><option>Revisión de tratamiento</option><option>Valoración de rehabilitación</option><option>Teleconsulta</option></select></label><label>Nota para la agenda<textarea name="notes" placeholder="Información breve para la cita"></textarea></label><button class="btn btn-primary" type="submit">Crear cita</button></form>`:
    `<form class="panel form-panel" data-form="appointment"><h3>Solicitar una cita</h3><p style="margin:0;color:#87969a;font-size:10px">La solicitud quedará pendiente hasta ser revisada por el profesional.</p><div class="field-pair"><label>Fecha deseada<input type="date" name="date" min="${new Date().toISOString().slice(0,10)}" required></label><label>Hora deseada<input type="time" name="time" required></label></div><label>Motivo de la solicitud<select name="type"><option>Consulta general</option><option>Seguimiento</option><option>Revisión de tratamiento</option><option>Valoración de rehabilitación</option><option>Teleconsulta</option></select></label><label>Comentario (opcional)<textarea name="notes" placeholder="Escribe información breve para el equipo médico"></textarea></label><button class="btn btn-primary" type="submit">Enviar solicitud</button></form>`;
  return intro(isDoctor()?'Agenda de atención':'Mis citas','Consulta y organiza las citas registradas en BIOMED.','AGENDA')+
    `<div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>${isDoctor()?'Todas las citas':'Historial de citas'}</h3><p>Estado de las solicitudes y consultas</p></div></div>${appointmentRows(list)}</section>${form}</div>`+
    `${!isDoctor()?'<div class="notice-strip"><span class="notice-icon">ⓘ</span><div><b>Importante</b>La solicitud de una cita no confirma la atención. Espera a que el profesional actualice el estado.</div></div>':''}`;
}
function renderProfile(){
  const p=patientOf(state.user.id)||{};
  return intro('Mi expediente','Consulta los datos de tu perfil y la información clínica que tu profesional ha compartido contigo.','INFORMACIÓN PERSONAL')+
  `<div class="notice-strip"><span class="notice-icon">ⓘ</span><div><b>Edición de información</b>Puedes actualizar tus datos personales y de contacto. Los diagnósticos, notas clínicas, medicamentos y referencias son de consulta y deben ser registrados por el profesional.</div></div>`+
  `<div class="content-grid"><form class="panel form-panel" data-form="profile"><h3>Datos personales y de contacto</h3><label>Nombre completo<input name="name" value="${esc(p.name||state.user.name)}" required></label><div class="field-pair"><label>Fecha de nacimiento<input type="date" name="birthDate" value="${esc(p.birthDate||'')}"></label><label>Sexo (opcional)<select name="sex"><option value="">No especificado</option>${['Femenino','Masculino','Otro','Prefiero no decirlo'].map(x=>`<option ${p.sex===x?'selected':''}>${x}</option>`).join('')}</select></label></div><label>Teléfono<input name="phone" value="${esc(p.phone||'')}" placeholder="Teléfono de contacto"></label><label>Domicilio / ciudad<input name="address" value="${esc(p.address||'')}" placeholder="Dato de contacto"></label><label>Contacto de emergencia<input name="emergencyContact" value="${esc(p.emergencyContact||'')}" placeholder="Nombre y teléfono"></label><button class="btn btn-primary" type="submit">Guardar mis datos</button></form><section class="panel"><div class="panel-head"><div><h3>Resumen del expediente</h3><p>Datos clínicos compartidos por el profesional</p></div></div><div class="profile-grid"><div class="info-box"><small>Estatura</small><b>${esc(p.heightCm||'—')} ${p.heightCm?'cm':''}</b></div><div class="info-box"><small>Peso</small><b>${esc(p.weightKg||'—')} ${p.weightKg?'kg':''}</b></div><div class="info-box"><small>Grupo sanguíneo</small><b>${esc(p.bloodType||'—')}</b></div><div class="info-box"><small>Alergias</small><b>${esc(p.allergies||'—')}</b></div><div class="info-box"><small>Antecedentes</small><b>${esc((p.conditions||[]).join(', ')||'—')}</b></div><div class="info-box"><small>CURP de demostración</small><b>${esc(p.curp||'—')}</b></div></div><div class="section-gap"><div class="panel-head"><div><h3>Notas clínicas</h3><p>Solo lectura</p></div></div>${(state.data.records||[]).map(r=>`<div class="list-card"><div><h4>${esc(r.diagnosis||'Registro clínico')}</h4><p>${esc(r.note||'')}</p><small>${dateText(r.date)}</small></div></div>`).join('')||noItems('No hay notas compartidas todavía.')}</div></section></div>`+
  `<section class="panel section-gap"><div class="panel-head"><div><h3>Medicamentos y referencias</h3><p>Información registrada por el profesional</p></div></div><div class="two-col"><div><b style="font-size:11px">Medicamentos</b><div class="list-stack section-gap">${(state.data.medications||[]).map(m=>`<div class="list-card"><div><h4>${esc(m.name)}</h4><p>${esc(m.dose)} · ${esc(m.frequency)}</p><small>${dateText(m.startDate)} ${m.endDate?'— '+dateText(m.endDate):''}</small></div>${statusPill(m.status)}</div>`).join('')||noItems('Sin medicamentos registrados.')}</div></div><div><b style="font-size:11px">Referencias</b><div class="list-stack section-gap">${(state.data.referrals||[]).map(r=>`<div class="list-card"><div><h4>${esc(r.specialty)}</h4><p>${esc(r.reason)}</p><small>${dateText(r.date)}</small></div>${statusPill(r.status)}</div>`).join('')||noItems('Sin referencias registradas.')}</div></div></div></section>`;
}
function renderRecords(){
  const p=selectedPatient();const id=p?.userId;
  const rec=(state.data.records||[]).filter(x=>x.patientId===id);const meds=(state.data.medications||[]).filter(x=>x.patientId===id);const refs=(state.data.referrals||[]).filter(x=>x.patientId===id);
  if(!p)return intro('Expediente clínico','Selecciona un paciente para comenzar.','')+noItems('No hay pacientes disponibles.');
  return intro('Expediente clínico','Registra y consulta información clínica del paciente seleccionado.','GESTIÓN PROFESIONAL')+
  `<div class="panel" style="margin-bottom:15px"><div class="panel-head"><div><h3>Paciente seleccionado</h3><p>Elige el expediente que deseas consultar.</p></div>${patientSelect(id)}</div><div class="profile-grid"><div class="info-box"><small>Nombre</small><b>${esc(p.name)}</b></div><div class="info-box"><small>Fecha de nacimiento</small><b>${dateText(p.birthDate)}</b></div><div class="info-box"><small>Teléfono</small><b>${esc(p.phone||'—')}</b></div><div class="info-box"><small>Grupo sanguíneo</small><b>${esc(p.bloodType||'—')}</b></div><div class="info-box"><small>Alergias registradas</small><b>${esc(p.allergies||'—')}</b></div><div class="info-box"><small>Antecedentes</small><b>${esc((p.conditions||[]).join(', ')||'—')}</b></div></div></div>`+
  `<div class="content-grid"><form class="panel form-panel" data-form="record"><h3>Agregar nota clínica</h3><input type="hidden" name="patientId" value="${esc(id)}"><label>Diagnóstico / motivo de registro<input name="diagnosis" required placeholder="Descripción breve"></label><label>Fecha<input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Nota profesional<textarea name="note" required placeholder="Escribe la nota correspondiente a la valoración profesional"></textarea></label><button class="btn btn-primary" type="submit">Guardar registro</button></form><form class="panel form-panel" data-form="savePatient"><h3>Actualizar datos del expediente</h3><input type="hidden" name="userId" value="${esc(id)}"><label>Nombre<input name="name" value="${esc(p.name||'')}"></label><div class="field-pair"><label>Estatura (cm)<input name="heightCm" value="${esc(p.heightCm||'')}"></label><label>Peso (kg)<input name="weightKg" value="${esc(p.weightKg||'')}"></label></div><div class="field-pair"><label>Grupo sanguíneo<input name="bloodType" value="${esc(p.bloodType||'')}"></label><label>Alergias<input name="allergies" value="${esc(p.allergies||'')}"></label></div><label>Antecedentes / condiciones<input name="conditions" value="${esc((p.conditions||[]).join(', '))}"></label><label>Notas adicionales<textarea name="notes">${esc(p.notes||'')}</textarea></label><button class="btn btn-primary" type="submit">Actualizar expediente</button></form></div>`+
  `<div class="two-col section-gap"><section class="panel"><div class="panel-head"><div><h3>Notas clínicas</h3><p>Registros del paciente</p></div></div>${rec.map(r=>`<div class="list-card"><div><h4>${esc(r.diagnosis)}</h4><p>${esc(r.note)}</p><small>${dateText(r.date)}</small></div></div>`).join('')||noItems('Sin notas registradas.')}</section><section class="panel"><div class="panel-head"><div><h3>Medicamentos y referencias</h3><p>Información administrada por el profesional</p></div></div><form class="form-panel" data-form="medication"><input type="hidden" name="patientId" value="${esc(id)}"><label>Medicamento<input name="name" required></label><div class="field-pair"><label>Dosis / presentación<input name="dose"></label><label>Frecuencia indicada<input name="frequency"></label></div><div class="field-pair"><label>Fecha de inicio<input type="date" name="startDate"></label><label>Fecha de término<input type="date" name="endDate"></label></div><button class="btn btn-primary" type="submit">Registrar medicamento</button></form><div class="list-stack section-gap">${meds.map(m=>`<div class="list-card"><div><h4>${esc(m.name)}</h4><p>${esc(m.dose)} · ${esc(m.frequency)}</p></div>${statusPill(m.status)}</div>`).join('')}</div><hr style="border:0;border-top:1px solid #edf1f0;margin:17px 0"><form class="form-panel" data-form="referral"><input type="hidden" name="patientId" value="${esc(id)}"><label>Especialidad de referencia<input name="specialty" required placeholder="Ej. Traumatología"></label><label>Motivo<textarea name="reason" required></textarea></label><button class="btn btn-primary" type="submit">Crear referencia</button></form><div class="list-stack section-gap">${refs.map(r=>`<div class="list-card"><div><h4>${esc(r.specialty)}</h4><p>${esc(r.reason)}</p></div>${statusPill(r.status)}</div>`).join('')}</div></section></div>`;
}

function renderRehab(){
  const list=state.data.rehabPlans||[];const visible=isDoctor()?list:list.filter(x=>x.patientId===state.user.id);
  const caseTypes=['Fractura de húmero','Fractura de radio y cúbito','Lesión de hombro','Lesión de rodilla','Lesión de tobillo','Otro caso musculoesquelético'];
  const form=isDoctor()?`<form class="panel form-panel" data-form="rehab"><h3>Registrar plan de seguimiento</h3><p style="font-size:10px;color:#87969a;margin:0">El profesional define el contenido después de valorar el caso y confirmar las indicaciones correspondientes.</p><label>Paciente${patientSelect()}</label><label>Tipo de caso<select name="caseType">${caseTypes.map(x=>`<option>${x}</option>`).join('')}</select></label><label>Nombre del plan<input name="title" required placeholder="Ej. Seguimiento funcional"></label><label>Objetivo de seguimiento<textarea name="objective" placeholder="Objetivos definidos por el profesional"></textarea></label><label>Indicaciones y notas profesionales<textarea name="professionalNotes" placeholder="Registrar únicamente indicaciones individualizadas ya establecidas por el profesional"></textarea></label><div class="field-pair"><label>Fecha de inicio<input type="date" name="startDate" value="${new Date().toISOString().slice(0,10)}"></label><label>Fecha de revisión<input type="date" name="reviewDate"></label></div><button class="btn btn-primary" type="submit">Guardar plan</button></form>`:
  `<div class="panel"><div class="panel-head"><div><h3>Módulo de fisioterapia y rehabilitación</h3><p>Consulta los planes y las notas que tu profesional ha compartido.</p></div><span class="intro-chip">SUPERVISIÓN PROFESIONAL</span></div><div class="notice-strip"><span class="notice-icon">ⓘ</span><div><b>Sobre los planes</b>Las indicaciones y progresiones deben ser determinadas por un profesional después de una valoración individual. Esta plataforma no prescribe ejercicios ni calcula tiempos de recuperación.</div></div><div class="case-chips">${caseTypes.map(x=>`<span class="case-chip">${esc(x)}</span>`).join('')}</div></div>`;
  const cards=visible.map(x=>`<article class="rehab-card"><div class="rehab-top"><span class="rehab-tag">${esc(x.caseType)}</span>${statusPill(x.status)}</div><h3>${esc(x.title)}</h3><p><b>Objetivo:</b> ${esc(x.objective||'No especificado.')}</p><p><b>Notas profesionales:</b> ${esc(x.professionalNotes||'Sin indicaciones adicionales registradas.')}</p><div class="rehab-meta"><span>Inicio: ${dateText(x.startDate)}</span><span>Revisión: ${dateText(x.reviewDate)}</span>${isDoctor()?`<span>Paciente: ${esc(patientOf(x.patientId)?.name||'')}</span>`:''}</div></article>`).join('');
  return intro('Fisioterapia y rehabilitación','Módulo especializado dentro de la plataforma general de telemedicina.','SEGUIMIENTO MUSCULOESQUELÉTICO')+
    `<div class="content-grid"><section><div class="panel-head"><div><h3>${isDoctor()?'Planes registrados':'Mis planes de seguimiento'}</h3><p>${visible.length} plan(es) disponibles</p></div></div><div class="list-stack">${cards||noItems('Todavía no hay planes registrados.')}</div></section>${form}</div>`+
    `<div class="notice-strip section-gap"><span class="notice-icon">✦</span><div><b>Alcance del prototipo</b>Este módulo permite documentar y consultar planes creados por el profesional. No genera diagnósticos, no prescribe ejercicios automáticamente y no determina periodos de recuperación.</div></div>`;
}

function renderChat(){
  const pid=isDoctor()?state.selectedPatientId:state.user.id;const patient=patientOf(pid);const msgs=(state.data.messages||[]).filter(m=>m.patientId===pid);
  return intro('Mensajería','Canal de comunicación de demostración entre paciente y profesional.','CHAT BIOMED')+
  `<div class="chat-layout"><section class="panel chat-box"><div class="panel-head"><div><h3>${isDoctor()?`Conversación · ${esc(patient?.name||'Selecciona paciente')}`:'Conversación con el equipo de salud'}</h3><p>Mensajes guardados en el servidor local</p></div>${isDoctor()?patientSelect(pid):'<span class="intro-chip">PRIVADO EN LA DEMO</span>'}</div><div class="chat-messages" id="chatMessages">${msgs.map(m=>`<div class="bubble ${m.senderId===state.user.id?'mine':''}"><p>${esc(m.text)}</p><small>${esc(m.senderName)} · ${esc(m.time)}</small></div>`).join('')||noItems('Aún no hay mensajes. Inicia la conversación.')}</div><form class="chat-compose" data-form="message"><input type="hidden" name="patientId" value="${esc(pid||'')}"><input name="text" placeholder="Escribe un mensaje..." maxlength="2000" required><button class="btn btn-primary" type="submit">Enviar</button></form></section>${isDoctor()?`<aside class="panel"><div class="panel-head"><div><h3>Conversaciones</h3><p>Pacientes registrados</p></div></div>${patients().map(p=>`<button class="quick-item" data-chat-patient="${esc(p.userId)}" style="width:100%;text-align:left;background:#fff;border:1px solid #edf1f0"><span class="mini-avatar">${initials(p.name)}</span><span><b>${esc(p.name)}</b><p>Abrir conversación</p></span></button>`).join('')||noItems('Sin pacientes.')}</aside>`:`<aside class="panel"><h3 style="font-size:13px">Recomendación</h3><p style="font-size:10px;color:#809095;line-height:1.6">Evita compartir por este chat información extremadamente sensible. En una implementación real se requieren controles de seguridad, privacidad y gestión de incidentes.</p></aside>`}</div>`;
}
function renderVideo(){
  const active=!!state.cameraStream;
  return intro('Teleconsulta','Interfaz de prueba audiovisual para revisar los dispositivos de este equipo.','SESIÓN LOCAL · DEMO')+
  `<div class="teleconsult-layout">
    <section class="panel teleconsult-main">
      <div class="teleconsult-head"><div><span class="eyebrow">SALA DE PRUEBA BIOMED</span><h3>Vista previa de cámara</h3><p>Comprueba imagen y audio antes de una futura implementación remota.</p></div><span class="session-state" id="sessionState"><i></i>${active?'Prueba activa':'En espera'}</span></div>
      <div class="video-stage" id="videoBox">
        <div class="video-placeholder"><div class="camera-orbit"><span>◉</span></div><b>Tu cámara aparecerá aquí</b><p>Inicia la prueba para solicitar acceso a la cámara y al micrófono de este dispositivo.</p></div>
        <div class="video-stage-label"><span class="live-dot"></span> VISTA PREVIA LOCAL <span class="stage-separator">·</span> NO TRANSMITIDA</div>
      </div>
      <div class="device-row"><div class="device-state"><span class="device-icon">◉</span><span><b>Cámara</b><small id="cameraState">Desactivada</small></span></div><div class="device-state"><span class="device-icon">♬</span><span><b>Micrófono</b><small id="microphoneState">Desactivado</small></span></div><span class="device-hint">Los permisos se solicitan al iniciar.</span></div>
      <div class="camera-controls">
        <button class="control-primary" id="startCamera" type="button"><span>◉</span> Iniciar prueba</button>
        <button class="control-secondary" id="toggleVideo" type="button" disabled><span>▣</span> Apagar cámara</button>
        <button class="control-secondary" id="toggleMic" type="button" disabled><span>♬</span> Silenciar</button>
        <button class="control-danger" id="stopCamera" type="button" disabled><span>■</span> Finalizar</button>
      </div>
    </section>
    <aside class="teleconsult-side">
      <section class="panel session-card"><span class="session-icon">✦</span><span class="eyebrow">ENTORNO DE DEMOSTRACIÓN</span><h3>Preparación del dispositivo</h3><p>Esta pantalla permite comprobar que los dispositivos locales responden correctamente.</p><div class="check-list"><div><span>01</span><div><b>Permisos del navegador</b><small>Autoriza cámara y micrófono al iniciar.</small></div></div><div><span>02</span><div><b>Vista previa</b><small>La imagen se muestra únicamente en esta página.</small></div></div><div><span>03</span><div><b>Finalizar prueba</b><small>Detén los dispositivos cuando termines.</small></div></div></div>
      </section>
      <section class="notice-strip tele-notice"><span class="notice-icon">ⓘ</span><div><b>No es una llamada remota</b>Esta versión no conecta a médico y paciente en tiempo real. No utilices esta función para consultas o emergencias reales.</div></section>
      <div class="callout">Para una futura videoconsulta remota se necesitaría WebRTC, señalización, infraestructura STUN/TURN, HTTPS y controles de seguridad y privacidad adicionales.</div>
    </aside>
  </div>`;
}
function stopLocalMedia(showMessage=false){
  if(state.cameraStream){state.cameraStream.getTracks().forEach(track=>track.stop());state.cameraStream=null;}
  if(state.page==='videocall'&&$('#videoBox')){
    $('#videoBox').innerHTML='<div class="video-placeholder"><div class="camera-orbit"><span>◉</span></div><b>Tu cámara aparecerá aquí</b><p>Inicia la prueba para solicitar acceso a la cámara y al micrófono de este dispositivo.</p></div><div class="video-stage-label"><span class="live-dot"></span> VISTA PREVIA LOCAL <span class="stage-separator">·</span> NO TRANSMITIDA</div>';
    $('#cameraState').textContent='Desactivada';$('#microphoneState').textContent='Desactivado';$('#sessionState').innerHTML='<i></i>En espera';
    $('#startCamera').disabled=false;$('#toggleVideo').disabled=true;$('#toggleMic').disabled=true;$('#stopCamera').disabled=true;
    $('#toggleVideo').innerHTML='<span>▣</span> Apagar cámara';$('#toggleMic').innerHTML='<span>♬</span> Silenciar';
  }
  if(showMessage)toast('Prueba finalizada. Cámara y micrófono detenidos.');
}

function renderPage(){
  const content=$('#pageContent');
  const renderers={overview:renderOverview,patients:renderPatients,appointments:renderAppointments,records:renderRecords,profile:renderProfile,rehab:renderRehab,chat:renderChat,videocall:renderVideo};
  content.innerHTML=(renderers[state.page]||renderOverview)();
  if(state.page==='chat'){const box=$('#chatMessages');if(box)box.scrollTop=box.scrollHeight;}
}

$('#pageContent').addEventListener('click',async e=>{
  const nav=e.target.closest('[data-go]');if(nav){go(nav.dataset.go);return;}
  const open=e.target.closest('[data-open-patient]');if(open){state.selectedPatientId=open.dataset.openPatient;go('records');return;}
  const chat=e.target.closest('[data-chat-patient]');if(chat){state.selectedPatientId=chat.dataset.chatPatient;renderPage();return;}
  if(e.target.closest('#startCamera')){
    if(!navigator.mediaDevices?.getUserMedia){toast('Este navegador no permite acceder a la cámara en este contexto.');return;}
    try{
      state.cameraStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
      $('#videoBox').innerHTML='<video autoplay playsinline muted></video><div class="video-stage-label"><span class="live-dot"></span> VISTA PREVIA LOCAL <span class="stage-separator">·</span> NO TRANSMITIDA</div>';
      $('#videoBox video').srcObject=state.cameraStream;
      $('#cameraState').textContent='Activa';$('#microphoneState').textContent='Activo';$('#sessionState').innerHTML='<i class="active"></i>Prueba activa';
      $('#startCamera').disabled=true;$('#toggleVideo').disabled=false;$('#toggleMic').disabled=false;$('#stopCamera').disabled=false;
      toast('Vista previa local activada. No se inició una llamada remota.');
    }catch(err){state.cameraStream=null;toast('No se pudo activar la cámara o el micrófono. Revisa los permisos del navegador.');}
  }
  if(e.target.closest('#toggleVideo')&&state.cameraStream){
    const track=state.cameraStream.getVideoTracks()[0];if(track){track.enabled=!track.enabled;$('#cameraState').textContent=track.enabled?'Activa':'Desactivada';$('#toggleVideo').innerHTML=track.enabled?'<span>▣</span> Apagar cámara':'<span>▣</span> Encender cámara';$('#videoBox').classList.toggle('video-paused',!track.enabled);}
  }
  if(e.target.closest('#toggleMic')&&state.cameraStream){
    const track=state.cameraStream.getAudioTracks()[0];if(track){track.enabled=!track.enabled;$('#microphoneState').textContent=track.enabled?'Activo':'Silenciado';$('#toggleMic').innerHTML=track.enabled?'<span>♬</span> Silenciar':'<span>♬</span> Activar micrófono';}
  }
  if(e.target.closest('#stopCamera'))stopLocalMedia(true);
});
$('#pageContent').addEventListener('change',async e=>{
  if(e.target.matches('[data-appointment-status]')){
    try{await request('/api/action',{action:'appointment_status',payload:{id:e.target.dataset.appointmentStatus,status:e.target.value}});await refreshData();renderPage();toast('Estado de la cita actualizado.');}catch(err){toast(err.message);}
  }
  if(e.target.matches('.patient-select')){state.selectedPatientId=e.target.value;if(state.page==='chat'||state.page==='records')renderPage();}
});
$('#pageContent').addEventListener('submit',async e=>{
  const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());const type=form.dataset.form;
  try{
    if(type==='profile'){
      await request('/api/action',{action:'update_profile',payload:data});
    }else if(type==='savePatient'){
      data.conditions=String(data.conditions||'').split(',').map(x=>x.trim()).filter(Boolean);
      await request('/api/action',{action:'save_patient',payload:data});
    }else{
      const actionMap={appointment:'appointment',record:'record',medication:'medication',referral:'referral',rehab:'rehab_plan',message:'message'};
      await request('/api/action',{action:actionMap[type],payload:data});
    }
    await refreshData();
    if(type==='appointment') toast(isDoctor()?'Cita creada correctamente.':'Solicitud de cita enviada.');
    else if(type==='message') toast('Mensaje enviado.');
    else toast('Información guardada correctamente.');
    renderPage();
  }catch(err){toast(err.message);}
});

// Mantener los formularios de demostración vacíos de datos clínicos reales.
