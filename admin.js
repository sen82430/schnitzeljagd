// =====================================================
//  Admin-Portal
// =====================================================
(function(){
const $ = id => document.getElementById(id);

if (!window.FIREBASE_CONFIG || String(FIREBASE_CONFIG.apiKey).includes('EINFUEGEN')){
  document.body.innerHTML = '<div id="fatal">⚠️ config.js ist noch nicht ausgefüllt.</div>'; return;
}

// ---------- PIN ----------
let ok = false; try { ok = localStorage.getItem('sjAdmin') === ADMIN_PIN; } catch(e){}
const gate = $('gate');
if (ok) gate.remove();
else $('gateForm').onsubmit = e => {
  e.preventDefault();
  if ($('pin').value === ADMIN_PIN){ try { localStorage.setItem('sjAdmin', ADMIN_PIN); } catch(e){} gate.remove(); setTimeout(() => map.invalidateSize(), 50); }
  else { $('pin').value = ''; $('pin').placeholder = 'Falsche PIN'; }
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
const root = db.ref('sj');
const N = GAME.missions.length;
let serverOffset = 0;
db.ref('.info/serverTimeOffset').on('value', s => serverOffset = s.val() || 0);
db.ref('.info/connected').on('value', s => { $('status').textContent = s.val() ? '● live' : '○ verbinde…'; });
$('ver').textContent = 'Version ' + window.APP_VERSION;

// ---------- Karte ----------
const map = L.map('map').setView([47.1745, 8.114], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap'}).addTo(map);
const stLayer = L.layerGroup().addTo(map);
const kidLayer = L.layerGroup().addTo(map);
const div = (html, s, anchor) => L.divIcon({className:'', html, iconSize:[s,s], iconAnchor:anchor || [s/2,s/2]});

let step = null;

function render(){
  const s = step ?? 0;
  stLayer.clearLayers();
  L.marker([GAME.start.lat, GAME.start.lng], {icon:div('<div class="emo">🚩</div>', 30, [7,27])}).bindPopup('Start').addTo(stLayer);
  GAME.missions.forEach((m, i) => {
    const col = i < s ? 'var(--green)' : i === s ? 'var(--red)' : '#9a8a76';
    L.marker([m.lat, m.lng], {icon:div(`<div class="num" style="background:${col}">${i+1}</div>`, 28)}).bindPopup(`<b>${i+1}. ${m.name}</b><br>${m.short}`).addTo(stLayer);
    if (m.lat2){
      L.marker([m.lat2, m.lng2], {icon:div('<div class="emo">🏁</div>', 30)}).bindPopup('Sprint-Ziel').addTo(stLayer);
      L.polyline([[m.lat,m.lng],[m.lat2,m.lng2]], {color:col, weight:3, dashArray:'6 6'}).addTo(stLayer);
    }
  });
  L.marker([GAME.end.lat, GAME.end.lng], {icon:div(`<div class="emo" style="opacity:${s>=N?1:.5}">✕</div>`, 30)}).bindPopup('Endpunkt').addTo(stLayer);

  if (s >= N){
    $('nowTtl').textContent = '🎉 Alle Missionen erfüllt';
    $('nowTask').textContent = 'Die Jungs sehen jetzt den Endpunkt.';
    $('next').textContent = 'Fertig';
  } else {
    const m = GAME.missions[s];
    $('nowTtl').textContent = `Aktuell: ${s+1}/${N} – ${m.name}`;
    $('nowTask').textContent = `${m.short} (${m.proof} per WhatsApp)`;
    $('next').textContent = s + 1 >= N ? `✅ Mission ${s+1} erfüllt – Endpunkt freischalten` : `✅ Mission ${s+1} erfüllt – Ziel ${s+2} freischalten`;
  }
  $('next').disabled = step === null || s >= N;
  $('back').disabled = step === null || s === 0;
  $('list').innerHTML = GAME.missions.map((m, i) => `<li class="${i < s ? 'd' : i === s ? 'c' : ''}">${i < s ? '✅ ' : ''}${m.name} – ${m.short}</li>`).join('')
    + `<li class="${s>=N?'c':''}">✕ Endpunkt – ${GAME.end.task}</li>`;
}

// ---------- Fortschritt ----------
root.child('state').on('value', s => { step = Math.max(0, Math.min(N, Number((s.val() || {}).step) || 0)); render(); },
  e => { $('status').textContent = '⚠️ ' + e.code; alert('Keine Berechtigung auf die Datenbank – sind die Regeln veröffentlicht?'); });

function publish(n){
  n = Math.max(0, Math.min(N, n));
  $('next').disabled = true;
  return root.child('state').set({step:n, t:firebase.database.ServerValue.TIMESTAMP})
    .catch(e => { alert('Speichern fehlgeschlagen: ' + e.message); render(); });
}

// ---------- Standorte ----------
let kids = {}; const order = [];
root.child('pos').on('value', s => {
  kids = s.val() || {};
  Object.keys(kids).forEach(id => { if (!order.includes(id)) order.push(id); });
  drawKids();
});
function ago(t){ const s = Math.max(0, Math.round((Date.now() + serverOffset - t)/1000)); return s < 60 ? `vor ${s} s` : s < 3600 ? `vor ${Math.round(s/60)} min` : `vor ${Math.round(s/3600)} h`; }
function drawKids(){
  kidLayer.clearLayers();
  const rows = [];
  order.filter(id => kids[id]).forEach((id, i) => {
    const k = kids[id], letter = String.fromCharCode(65 + i);
    const old = Date.now() + serverOffset - k.t > 60000;
    L.marker([k.lat, k.lng], {icon:div('<div class="me"></div>', 18), zIndexOffset:1000, opacity: old ? .5 : 1})
      .bindTooltip(letter, {permanent:true, direction:'right', className:'lbl', offset:[8,0]}).addTo(kidLayer);
    rows.push(`<div><span class="dot"></span>Handy ${letter}: <span class="${old?'old':''}">${ago(k.t)}</span>${k.acc ? ` (±${k.acc} m)` : ''}</div>`);
  });
  $('kids').innerHTML = rows.length ? rows.join('') : 'Noch kein Standort.';
}
setInterval(drawKids, 5000);

// ---------- Buttons ----------
$('next').onclick = () => { if (step !== null && step < N) publish(step + 1); };
$('back').onclick = () => { if (step > 0 && confirm('Einen Schritt zurück? Die Jungs sehen dann wieder das vorherige Ziel.')) publish(step - 1); };
$('reset').onclick = () => {
  if (!confirm('Spiel neu starten? Fortschritt auf Ziel 1 und alle Handy-Standorte löschen.')) return;
  publish(0); root.child('pos').remove(); order.length = 0;
};
$('zoomKids').onclick = () => {
  const ll = order.filter(id => kids[id]).map(id => [kids[id].lat, kids[id].lng]);
  if (ll.length) map.fitBounds(L.latLngBounds(ll).pad(0.5), {maxZoom:17}); else alert('Noch kein Standort.');
};
render();
setTimeout(() => {
  const pts = [[GAME.start.lat, GAME.start.lng], [GAME.end.lat, GAME.end.lng]];
  GAME.missions.forEach(m => { pts.push([m.lat, m.lng]); if (m.lat2) pts.push([m.lat2, m.lng2]); });
  map.fitBounds(L.latLngBounds(pts).pad(0.1));
}, 100);
})();
