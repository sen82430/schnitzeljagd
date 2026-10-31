// =====================================================
//  App für die Jungs
// =====================================================
(function(){
const $ = id => document.getElementById(id);

if (!window.FIREBASE_CONFIG || String(FIREBASE_CONFIG.apiKey).includes('EINFUEGEN')){
  document.body.innerHTML = '<div id="fatal">⚠️ config.js ist noch nicht ausgefüllt.</div>'; return;
}
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
const root = db.ref('sj');
const N = GAME.missions.length;

const map = L.map('map', {zoomControl:false}).setView([GAME.start.lat, GAME.start.lng], 16);
// Karte ohne Strassennamen und Beschriftungen
// Schatzkarten-Look wie am Anfang; leicht "verwittert" (unscharf), damit Strassennamen kaum lesbar sind
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:17, attribution:'© OpenStreetMap'}).addTo(map);
map.setMaxZoom(17);
const layer = L.layerGroup().addTo(map);
const icon = (html, s, anchor) => L.divIcon({className:'', html, iconSize:[s,s], iconAnchor:anchor || [s/2,s/2]});

let step = null; // Anzahl erfüllte Missionen (0..N)
const target = () => step >= N ? GAME.end : GAME.missions[step];

function render(){
  layer.clearLayers();
  L.marker([GAME.start.lat, GAME.start.lng], {icon:icon('<div class="emo">🚩</div>', 34, [8,30])}).bindPopup('<b>Start</b>').addTo(layer);
  const s = step ?? 0;
  GAME.missions.forEach((m, i) => {
    if (i < s) L.marker([m.lat, m.lng], {icon:icon('<div class="ok">✅</div>', 24)}).bindPopup(`<b>${i+1}. ${m.name}</b><br>geschafft`).addTo(layer);
    if (i === s){
      L.marker([m.lat, m.lng], {icon:icon(`<div class="pin"><b>${i+1}</b></div>`, 38, [19,44]), zIndexOffset:500})
        .bindPopup(`<b>${i+1}. ${m.name}</b><br>${m.task}`).addTo(layer);
      if (m.lat2){
        L.marker([m.lat2, m.lng2], {icon:icon('<div class="emo">🏁</div>', 34)}).bindPopup(`<b>Sprint-Ziel</b><br>${m.finishName || ''}`).addTo(layer);
        L.polyline([[m.lat,m.lng],[m.lat2,m.lng2]], {color:'#8b1e1e', weight:4, dashArray:'8 8'}).addTo(layer);
      }
    }
  });
  if (s >= N) L.marker([GAME.end.lat, GAME.end.lng], {icon:icon('<div class="xmark">✕</div>', 44), zIndexOffset:500})
    .bindPopup(`<b>Endpunkt</b><br>${GAME.end.task}`).addTo(layer);

  $('dots').innerHTML = GAME.missions.map((_, i) => `<span class="${i < s ? 'd' : i === s ? 'c' : ''}"></span>`).join('');
  if (s >= N){
    $('ttl').textContent = '✕ Endpunkt';
    $('task').textContent = GAME.end.task;
    $('proof').textContent = 'Alle Missionen geschafft – ab zum ✕!';
    $('proofBtn').style.display = 'none';
  } else {
    const t = GAME.missions[s];
    $('ttl').textContent = `Ziel ${s+1}/${N}: ${t.name}`;
    $('task').textContent = t.task;
    $('proof').textContent = `Sendet das ${t.proof} über «📸 Beweis senden». Sobald die Leiter es geprüft haben, erscheint das nächste Ziel.`;
    $('proofBtn').style.display = 'block';
    $('proofBtn').textContent = t.proof === 'Video' ? '🎥 Video-Beweis senden' : '📷 Foto-Beweis senden';
  }
}

// ---------- Meldung ----------
let toastT;
function toast(html){
  const t = $('toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 7000);
  try { if (navigator.vibrate) navigator.vibrate([200,100,200,100,400]); } catch(e){}
}

function applyStep(n){
  n = Math.max(0, Math.min(N, Number(n) || 0));
  const before = step;
  step = n;
  render();
  if (before === null){ const t = target(); map.setView([t.lat, t.lng], 16); return; }
  if (n > before){
    toast(n >= N ? '🎉 <b>Alle Missionen geschafft!</b><br>Ab zum ✕ – sucht die Schokobananen!'
                 : `🎉 <b>Mission geschafft!</b><br>Nächstes Ziel: ${GAME.missions[n].name}`);
    const t = target(); map.flyTo([t.lat, t.lng], 17);
  }
}

// ---------- Live-Verbindung ----------
root.child('state').on('value', s => applyStep((s.val() || {}).step), () => { $('status').textContent = '⚠️ Fehler'; });
db.ref('.info/connected').on('value', s => { $('status').textContent = s.val() ? '● live' : '○ verbinde…'; });

// ---------- Eigener Standort: alle 15 s für 2 s sichtbar ----------
let me = null, acc = null, devId = null;
try { devId = localStorage.getItem('sjDev'); if (!devId){ devId = Math.random().toString(36).slice(2,8); localStorage.setItem('sjDev', devId); } }
catch(e){ devId = Math.random().toString(36).slice(2,8); }

const meMarker = L.marker([0,0], {icon:icon('<div class="me"></div>', 20), zIndexOffset:1000, interactive:false});
// Takt: 5 s versteckt, 2 s sichtbar
const HIDE_MS = 5000, SHOW_MS = 2000;
let hideT = null;
function showMe(){
  if (!me) return;
  meMarker.setLatLng([me.lat, me.lng]).addTo(map);
  clearTimeout(hideT);
  hideT = setTimeout(() => map.removeLayer(meMarker), SHOW_MS);
}
function sendPos(){
  if (!me) return;
  root.child('pos/' + devId).set({lat:+me.lat.toFixed(6), lng:+me.lng.toFixed(6), acc, t:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});
}
setInterval(showMe, HIDE_MS + SHOW_MS);
setInterval(sendPos, 14000);
const blink = showMe;

function banner(t){ const b = $('banner'); b.textContent = t || ''; b.style.display = t ? 'block' : 'none'; }
if ('geolocation' in navigator){
  navigator.geolocation.watchPosition(p => {
    banner('');
    const first = !me;
    me = {lat:p.coords.latitude, lng:p.coords.longitude};
    acc = Math.round(p.coords.accuracy);
    if (first){ blink(); sendPos(); }
  }, e => {
    banner(e.code === 1
      ? '📍 Standort ist blockiert. Erlaube den Standort für diese Seite (Einstellungen → Datenschutz → Ortungsdienste → Safari/Chrome) und lade die Seite neu.'
      : '📍 Standort wird gesucht…');
  }, {enableHighAccuracy:true, maximumAge:5000, timeout:30000});
} else banner('Dieses Handy unterstützt keinen Standort.');

// ---------- Bildschirm wach halten ----------
let wake = null;
async function keepAwake(){ try { if ('wakeLock' in navigator && !wake){ wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => wake = null); } } catch(e){} }
document.addEventListener('click', keepAwake, {passive:true});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible'){ keepAwake(); checkUpdate(); } });

// ---------- Automatisches Update (neue Version von GitHub) ----------
async function checkUpdate(){
  try {
    const r = await fetch('version.json?t=' + Date.now(), {cache:'no-store'});
    const v = String((await r.json()).v);
    if (v && v !== window.APP_VERSION) location.reload();
  } catch(e){}
}
setInterval(checkUpdate, 60000);

$('go').onclick = () => { if (step === null) return; const t = target(); map.flyTo([t.lat, t.lng], 17); };
$('meBtn').onclick = () => {
  if (!me){ toast('📍 Standort wird noch gesucht…'); return; }
  map.flyTo([me.lat, me.lng], 17);
  setTimeout(showMe, 400);
};

// ---------- Start-Bildschirm (schaltet Ton & Bildschirm-wach frei) ----------
const msgAudio = $('msgAudio');
let actx = null, unlocked = false;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
$('startBtn').onclick = () => {
  $('startScreen').classList.add('hide');
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); if (window.SFX) SFX.preload(actx); } catch(e){}
  try { msgAudio.src = SILENT; const p = msgAudio.play(); if (p) p.then(() => msgAudio.pause()).catch(()=>{}); } catch(e){}
  unlocked = true;
  keepAwake();
  showQueue();
};

function chime(){
  try {
    if (!actx) return;
    actx.resume();
    [0, .18, .36].forEach((d, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = [880, 1175, 1568][i]; o.type = 'sine';
      g.gain.setValueAtTime(.0001, actx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(.4, actx.currentTime + d + .02);
      g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + d + .3);
      o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + d); o.stop(actx.currentTime + d + .32);
    });
  } catch(e){}
}

// ---------- Nachrichten der Leiter ----------
const msgs = new Map(); // id -> {type, text, audio, t}
let seen = new Set(), firstRun = false;
try { const s = localStorage.getItem('sjSeen'); if (s) seen = new Set(JSON.parse(s)); else firstRun = true; } catch(e){ firstRun = true; }
const loadedAt = Date.now();
function saveSeen(){ try { localStorage.setItem('sjSeen', JSON.stringify([...seen].slice(-100))); } catch(e){} }

const queue = [];
let showing = null;
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmtTime(t){ try { return new Date(t).toLocaleTimeString('de-CH', {hour:'2-digit', minute:'2-digit'}); } catch(e){ return ''; } }

function updateBadge(){
  const n = [...msgs.keys()].filter(id => !seen.has(id)).length;
  const b = $('unread'); b.textContent = n; b.style.display = n ? 'block' : 'none';
}

function showQueue(){
  if (showing || !queue.length) return;
  const id = queue.shift();
  const m = msgs.get(id);
  if (!m || seen.has(id)){ showQueue(); return; }
  showing = id;
  $('msgText').textContent = m.text || (m.type === 'audio' ? '🎙️ Sprachnachricht' : '');
  if (m.type === 'audio' && m.audio){
    msgAudio.style.display = 'block'; msgAudio.src = m.audio;
    if (unlocked){ const p = msgAudio.play(); if (p) p.catch(()=>{}); }
  } else { msgAudio.style.display = 'none'; msgAudio.removeAttribute('src'); }
  $('msgOverlay').classList.add('show');
  if (m.type !== 'audio') chime(); else if (!unlocked) chime();
  try { if (navigator.vibrate) navigator.vibrate([300,120,300,120,500]); } catch(e){}
}
$('msgOk').onclick = () => {
  if (showing){ seen.add(showing); saveSeen(); }
  try { msgAudio.pause(); } catch(e){}
  showing = null;
  $('msgOverlay').classList.remove('show');
  updateBadge();
  showQueue();
};

const mref = root.child('msgs').limitToLast(30);
mref.on('child_added', c => {
  const m = c.val() || {};
  msgs.set(c.key, m);
  if (firstRun && !seen.has(c.key) && (m.t || 0) < loadedAt - 60000){ seen.add(c.key); saveSeen(); }
  if (!seen.has(c.key)){ queue.push(c.key); showQueue(); }
  updateBadge();
});
mref.on('child_removed', c => { msgs.delete(c.key); updateBadge(); });

// ---------- Soundboard der Leiter ----------
let srvOff = 0;
db.ref('.info/serverTimeOffset').on('value', s => srvOff = s.val() || 0);
const played = new Set();
root.child('sfx').limitToLast(3).on('child_added', c => {
  const d = c.val() || {};
  if (played.has(c.key)) return;
  played.add(c.key);
  const age = Date.now() + srvOff - (d.t || 0);
  if (age > 15000 || !window.SFX) return; // alte Sounds nicht nachspielen
  const s = SFX.byId(d.id);
  if (!s) return;
  if (!actx){ try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
  SFX.play(actx, d.id);
  toast(`${s.emoji} <b>${s.name}</b>`);
});

// ---------- Fragen an die Leiter ----------
const mine = new Map(); // eigene Fragen
let inboxOpen = false;
let askAllowed = true;
root.child('settings/questions').on('value', s => { askAllowed = s.val() !== false; updateAsk(); });
function updateAsk(){
  $('askBox').style.display = askAllowed ? 'flex' : 'none';
  $('askOff').style.display = askAllowed ? 'none' : 'block';
}
const qref = root.child('inbox').orderByChild('dev').equalTo(devId);
qref.on('child_added', c => { mine.set(c.key, c.val() || {}); if (inboxOpen) renderInbox(); });
qref.on('child_removed', c => { mine.delete(c.key); if (inboxOpen) renderInbox(); });

$('askSend').onclick = () => {
  const text = $('askText').value.trim();
  if (!text || !askAllowed) return;
  $('askSend').disabled = true;
  root.child('inbox').push({dev:devId, text:text.slice(0, 300), t:firebase.database.ServerValue.TIMESTAMP})
    .then(() => { $('askText').value = ''; toast('✉️ Nachricht an die Leiter gesendet'); })
    .catch(() => toast('⚠️ Senden fehlgeschlagen – Internet prüfen'));
  setTimeout(() => { $('askSend').disabled = false; }, 8000);
};

// ---------- Nachrichten-Fenster ----------
function renderInbox(){
  const items = [
    ...[...msgs.entries()].map(([id, m]) => ({...m, from:'leiter'})),
    ...[...mine.values()].map(m => ({...m, from:'ich'}))
  ].sort((a, b) => (b.t || 0) - (a.t || 0));
  $('inboxList').innerHTML = items.length ? items.map(m => m.from === 'ich'
    ? `<div class="mine"><time>${fmtTime(m.t)} · Du</time>${esc(m.text)}</div>`
    : `<div><time>${fmtTime(m.t)} · Leiter</time>${m.text ? esc(m.text) : ''}${m.type === 'audio' && m.audio ? `<audio controls playsinline preload="none" src="${m.audio}" style="width:100%;margin-top:4px"></audio>` : ''}</div>`
  ).join('') : '<div>Noch keine Nachrichten.</div>';
}
mref.on('child_removed', () => { if (inboxOpen) renderInbox(); });
$('inboxBtn').onclick = () => {
  inboxOpen = true; updateAsk(); renderInbox();
  [...msgs.keys()].forEach(id => seen.add(id)); saveSeen(); updateBadge();
  $('inboxOverlay').classList.add('show');
};
$('inboxClose').onclick = () => {
  inboxOpen = false;
  $('inboxOverlay').classList.remove('show');
  document.querySelectorAll('#inboxList audio').forEach(a => { try { a.pause(); } catch(e){} });
};

// ---------- Beweis senden (Foto / Video) ----------
const VMAX = 40;                  // max. Videolänge in Sekunden
const MAX_BYTES = 11 * 1024 * 1024; // Obergrenze für die Datenbank
let pData = null, pType = null, pMission = null;
let camStream = null, facing = 'environment', vrec = null, vchunks = [], vTimer = null, vStart = 0;

function pShow(part){
  ['pChoose','pRec','pPreview'].forEach(id => $(id).style.display = id === part ? (id === 'pChoose' ? 'flex' : 'block') : 'none');
}
function pStatus(t){ $('pStatus').textContent = t || ''; }
function stopCam(){
  try { if (vrec && vrec.state === 'recording') vrec.stop(); } catch(e){}
  clearInterval(vTimer);
  if (camStream){ camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  $('camView').srcObject = null;
}
function pReset(){
  stopCam(); pData = null; pType = null;
  $('pImg').removeAttribute('src'); $('pVid').removeAttribute('src');
  pShow('pChoose'); pStatus('');
}

$('proofBtn').onclick = () => {
  if (step === null || step >= N) return;
  pMission = step;
  const m = GAME.missions[step];
  $('proofFor').textContent = `Ziel ${step+1}: ${m.name} – gewünscht: ${m.proof}`;
  pReset();
  $('proofOverlay').classList.add('show');
};
$('proofClose').onclick = () => { pReset(); $('proofOverlay').classList.remove('show'); };

// Foto: Kamera des Handys, dann verkleinern
$('photoBtn').onclick = () => $('photoInput').click();
$('photoInput').onchange = e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  pStatus('Foto wird vorbereitet…');
  const url = URL.createObjectURL(f), img = new Image();
  img.onload = () => {
    const max = 1400, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    pData = c.toDataURL('image/jpeg', 0.75); pType = 'foto';
    $('pImg').src = pData; $('pImg').style.display = 'block'; $('pVid').style.display = 'none';
    pShow('pPreview'); pStatus('');
  };
  img.onerror = () => { URL.revokeObjectURL(url); pStatus('⚠️ Foto konnte nicht gelesen werden.'); };
  img.src = url;
};

// Video: direkt in der App aufnehmen (klein, damit es hochgeladen werden kann)
async function startCam(){
  stopCam();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:facing}, width:{ideal:640}, height:{ideal:480}, frameRate:{ideal:24}}, audio:true});
  } catch(e){
    pStatus('⚠️ Kamera/Mikrofon nicht erlaubt. Bitte erlauben und nochmals versuchen.'); pShow('pChoose'); return false;
  }
  $('camView').srcObject = camStream;
  try { await $('camView').play(); } catch(e){}
  return true;
}
function pickVideoMime(){
  if (!window.MediaRecorder) return null;
  for (const t of ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}
$('videoBtn').onclick = async () => {
  if (pickVideoMime() === null){ pStatus('⚠️ Dieses Handy kann in der App kein Video aufnehmen.'); return; }
  pShow('pRec'); pStatus('');
  $('vRecBtn').textContent = '⏺ Aufnahme starten'; $('vTime').textContent = `max. ${VMAX} Sekunden`;
  await startCam();
};
$('vFlip').onclick = async () => {
  if (vrec && vrec.state === 'recording') return;
  facing = facing === 'environment' ? 'user' : 'environment';
  await startCam();
};
$('vRecBtn').onclick = () => {
  if (vrec && vrec.state === 'recording'){ vrec.stop(); return; }
  if (!camStream) return;
  const mime = pickVideoMime();
  vchunks = [];
  try { vrec = new MediaRecorder(camStream, {...(mime ? {mimeType:mime} : {}), videoBitsPerSecond:450000, audioBitsPerSecond:48000}); }
  catch(e){ vrec = new MediaRecorder(camStream); }
  vrec.ondataavailable = ev => { if (ev.data && ev.data.size) vchunks.push(ev.data); };
  vrec.onstop = () => {
    clearInterval(vTimer);
    const blob = new Blob(vchunks, {type: vrec.mimeType || mime || 'video/webm'});
    stopCam();
    if (blob.size > MAX_BYTES / 1.37){ pStatus('⚠️ Video zu gross – bitte kürzer aufnehmen.'); pShow('pChoose'); return; }
    const fr = new FileReader();
    fr.onload = () => {
      pData = fr.result; pType = 'video';
      $('pVid').src = pData; $('pVid').style.display = 'block'; $('pImg').style.display = 'none';
      pShow('pPreview'); pStatus(`Länge ok (${(blob.size/1024/1024).toFixed(1)} MB)`);
    };
    fr.readAsDataURL(blob);
  };
  vrec.start(1000);
  vStart = Date.now();
  $('vRecBtn').textContent = '⏹ Stopp';
  vTimer = setInterval(() => {
    const s = Math.floor((Date.now() - vStart) / 1000);
    $('vTime').textContent = `● ${s} / ${VMAX} s`;
    if (s >= VMAX && vrec.state === 'recording') vrec.stop();
  }, 250);
};

$('pRetry').onclick = () => pReset();
$('pSend').onclick = async () => {
  if (!pData) return;
  if (pData.length > MAX_BYTES){ pStatus('⚠️ Zu gross – bitte nochmals kürzer.'); return; }
  $('pSend').disabled = true; $('pRetry').disabled = true;
  pStatus('⏳ Wird hochgeladen… bitte warten und App offen lassen.');
  try {
    const id = root.child('proofs').push().key;
    await root.child('proofData/' + id).set({data:pData});
    await root.child('proofs/' + id).set({type:pType, mission:pMission, dev:devId, size:pData.length, t:firebase.database.ServerValue.TIMESTAMP});
    pReset();
    $('proofOverlay').classList.remove('show');
    toast('✅ <b>Beweis gesendet!</b><br>Die Leiter prüfen ihn – gleich geht\'s weiter.');
  } catch(e){
    pStatus('⚠️ Hochladen fehlgeschlagen – Internet prüfen und nochmals «Senden».');
  }
  $('pSend').disabled = false; $('pRetry').disabled = false;
};

// Installierbar als App (ohne Adressleiste)
if ('serviceWorker' in navigator){ try { navigator.serviceWorker.register('sw.js'); } catch(e){} }
})();
