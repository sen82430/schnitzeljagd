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
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap'}).addTo(map);
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
function blink(){
  if (!me) return;
  meMarker.setLatLng([me.lat, me.lng]).addTo(map);
  setTimeout(() => map.removeLayer(meMarker), 2000);
}
function sendPos(){
  if (!me) return;
  root.child('pos/' + devId).set({lat:+me.lat.toFixed(6), lng:+me.lng.toFixed(6), acc, t:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});
}
setInterval(() => { blink(); sendPos(); }, 15000);

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
})();
