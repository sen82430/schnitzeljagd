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
  if (!confirm('Spiel neu starten? Fortschritt auf Ziel 1 – Standorte, Nachrichten und Fragen werden gelöscht.')) return;
  publish(0); root.child('pos').remove(); root.child('msgs').remove(); root.child('sfx').remove(); root.child('inbox').remove(); order.length = 0;
};

// ---------- Nachrichten ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function sendMsg(data){
  return root.child('msgs').push({...data, t:firebase.database.ServerValue.TIMESTAMP});
}
$('sendText').onclick = async () => {
  const text = $('msgText').value.trim();
  if (!text) return;
  $('sendText').disabled = true;
  try { await sendMsg({type:'text', text}); $('msgText').value = ''; }
  catch(e){ alert('Senden fehlgeschlagen: ' + e.message + '\nSind die neuen Datenbank-Regeln veröffentlicht?'); }
  $('sendText').disabled = false;
};

const hhmm = t => t ? new Date(t).toLocaleTimeString('de-CH', {hour:'2-digit', minute:'2-digit'}) : '';
root.child('msgs').on('value', s => {
  const list = [];
  s.forEach(c => { list.unshift([c.key, c.val() || {}]); });
  $('sent').innerHTML = list.map(([k, m]) =>
    `<div class="it"><div class="tx"><small>${hhmm(m.t)}</small>${m.type === 'audio' ? '🎙️ Sprachmemo' : esc(m.text)}</div><button data-del-msg="${k}" title="Löschen">🗑</button></div>`
  ).join('');
  $('sentClear').style.display = list.length > 1 ? 'block' : 'none';
});
$('sent').addEventListener('click', e => {
  const k = e.target.dataset.delMsg; if (k) root.child('msgs/' + k).remove();
});
$('sentClear').onclick = () => { if (confirm('Alle eigenen Nachrichten löschen? Sie verschwinden auch bei den Jungs.')) root.child('msgs').remove(); };

// ---------- Fragen der Jungs ----------
let qFirst = true, qSeenUntil = Date.now() + serverOffset;
const letterOf = id => { const i = order.indexOf(id); return i >= 0 ? 'Handy ' + String.fromCharCode(65 + i) : 'Handy ?'; };
root.child('inbox').on('value', s => {
  const list = [];
  s.forEach(c => { list.unshift([c.key, c.val() || {}]); });
  const newest = list.length ? (list[0][1].t || 0) : 0;
  if (!qFirst && newest > qSeenUntil){ ping(); flashTitle(); }
  qFirst = false;
  $('qList').innerHTML = list.length ? list.map(([k, q]) =>
    `<div class="it ${(q.t || 0) > qSeenUntil ? 'new' : ''}"><div class="tx"><small>${letterOf(q.dev)} · ${hhmm(q.t)}</small>${esc(q.text)}</div><button data-del-q="${k}" title="Löschen">🗑</button></div>`
  ).join('') : '<div class="it"><div class="tx"><small>Noch keine Fragen.</small></div></div>';
  $('qCount').textContent = list.length ? `(${list.length})` : '';
  $('qClear').style.display = list.length > 1 ? 'block' : 'none';
});
$('qList').addEventListener('click', e => {
  const k = e.target.dataset.delQ; if (k) root.child('inbox/' + k).remove();
  qSeenUntil = Date.now() + serverOffset;
});
$('qClear').onclick = () => { if (confirm('Alle Fragen löschen?')) root.child('inbox').remove(); };

// Fragen erlauben / sperren
root.child('settings/questions').on('value', s => {
  const on = s.val() !== false;
  $('qAllow').checked = on;
  $('qAllowTxt').textContent = on ? 'erlaubt' : 'gesperrt';
  document.querySelector('.qs').classList.toggle('off', !on);
});
$('qAllow').onchange = () => root.child('settings/questions').set($('qAllow').checked);

// Hinweis bei neuer Frage: Ton + blinkender Tab-Titel
let pingCtx = null;
document.addEventListener('click', () => { if (!pingCtx){ try { pingCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } }, {once:true});
function ping(){
  try {
    if (!pingCtx) return;
    pingCtx.resume();
    [0, .15].forEach((d, i) => {
      const o = pingCtx.createOscillator(), g = pingCtx.createGain(), t = pingCtx.currentTime + d;
      o.frequency.value = [1046, 1568][i]; g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.35, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .35);
      o.connect(g); g.connect(pingCtx.destination); o.start(t); o.stop(t + .4);
    });
  } catch(e){}
}
let flashT = null;
function flashTitle(txt){
  clearInterval(flashT);
  const base = 'Schnitzeljagd Admin'; let on = false, n = 0;
  flashT = setInterval(() => { document.title = (on = !on) ? (txt || '💬 Neue Frage!') : base; if (++n > 20){ clearInterval(flashT); document.title = base; } }, 700);
}


// Sprachmemo
let rec = null, chunks = [], recStart = 0, recTimer = null, recData = null;
const MAX_SEC = 60;
function pickMime(){
  if (!window.MediaRecorder) return null;
  for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}
$('recBtn').onclick = async () => {
  if (rec && rec.state === 'recording'){ rec.stop(); return; }
  const mime = pickMime();
  if (mime === null){ alert('Dieser Browser kann keine Sprachmemos aufnehmen. Nimm Chrome.'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(e){ alert('Kein Mikrofon-Zugriff. Bitte im Browser erlauben.'); return; }
  chunks = [];
  rec = new MediaRecorder(stream, mime ? {mimeType:mime, audioBitsPerSecond:32000} : {audioBitsPerSecond:32000});
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    clearInterval(recTimer);
    $('recBtn').classList.remove('on'); $('recBtn').textContent = '🎙️ Sprachmemo aufnehmen'; $('recInfo').textContent = '';
    const blob = new Blob(chunks, {type: rec.mimeType || mime || 'audio/webm'});
    const fr = new FileReader();
    fr.onload = () => { recData = fr.result; $('recAudio').src = recData; $('recPreview').style.display = 'block'; };
    fr.readAsDataURL(blob);
  };
  rec.start();
  recStart = Date.now();
  $('recBtn').classList.add('on'); $('recBtn').textContent = '⏹ Stopp';
  $('recPreview').style.display = 'none';
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    $('recInfo').textContent = `${s}s / ${MAX_SEC}s`;
    if (s >= MAX_SEC && rec.state === 'recording') rec.stop();
  }, 250);
};
$('recSend').onclick = async () => {
  if (!recData) return;
  if (recData.length > 900000){ alert('Sprachmemo zu lang – bitte kürzer aufnehmen.'); return; }
  $('recSend').disabled = true;
  try { await sendMsg({type:'audio', audio:recData}); recData = null; $('recPreview').style.display = 'none'; }
  catch(e){ alert('Senden fehlgeschlagen: ' + e.message + '\nSind die neuen Datenbank-Regeln veröffentlicht?'); }
  $('recSend').disabled = false;
};
$('recDiscard').onclick = () => { recData = null; $('recPreview').style.display = 'none'; };

// ---------- Soundboard ----------
let actx = null;
$('sfxGrid').innerHTML = SFX.list.map(s => `<button data-sfx="${s.id}"><span>${s.emoji}</span>${s.name}</button>`).join('');
$('sfxGrid').addEventListener('click', e => {
  const b = e.target.closest('button[data-sfx]'); if (!b) return;
  const id = b.dataset.sfx;
  b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 400);
  if ($('preview').checked){
    if (!actx){ try { actx = new (window.AudioContext || window.webkitAudioContext)(); SFX.preload(actx); } catch(err){} }
    SFX.play(actx, id);
  } else {
    root.child('sfx').push({id, t:firebase.database.ServerValue.TIMESTAMP}).catch(err => alert('Senden fehlgeschlagen: ' + err.message));
  }
});
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
