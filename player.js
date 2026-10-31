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
  } else {
    const t = GAME.missions[s];
    $('ttl').textContent = `Ziel ${s+1}/${N}: ${t.name}`;
    $('task').textContent = t.task;
    $('proof').textContent = `📲 Schickt das ${t.proof} per WhatsApp an die Leiter. Danach erscheint das nächste Ziel.`;
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

$('inboxBtn').onclick = () => {
  const list = [...msgs.entries()].sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
  $('inboxList').innerHTML = list.length ? list.map(([id, m]) =>
    `<div><time>${fmtTime(m.t)}</time>${m.text ? esc(m.text) : ''}${m.type === 'audio' && m.audio ? `<audio controls playsinline preload="none" src="${m.audio}" style="width:100%;margin-top:4px"></audio>` : ''}</div>`
  ).join('') : '<div>Noch keine Nachrichten.</div>';
  list.forEach(([id]) => seen.add(id)); saveSeen(); updateBadge();
  $('inboxOverlay').classList.add('show');
};
$('inboxClose').onclick = () => {
  $('inboxOverlay').classList.remove('show');
  document.querySelectorAll('#inboxList audio').forEach(a => { try { a.pause(); } catch(e){} });
};
})();
