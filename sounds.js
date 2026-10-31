// =====================================================
//  Soundboard: 20 Sounds, live im Browser erzeugt (keine Audiodateien nötig)
// =====================================================
(function(){
const LIST = [
  {id:'furz',     emoji:'💨', name:'Furz'},
  {id:'airhorn',  emoji:'📯', name:'Airhorn'},
  {id:'tada',     emoji:'🎉', name:'Tada'},
  {id:'fail',     emoji:'🎺', name:'Fail'},
  {id:'laser',    emoji:'🔫', name:'Laser'},
  {id:'boing',    emoji:'🦘', name:'Boing'},
  {id:'sirene',   emoji:'🚨', name:'Sirene'},
  {id:'quak',     emoji:'🦆', name:'Quak'},
  {id:'kuckuck',  emoji:'🐦', name:'Kuckuck'},
  {id:'glocke',   emoji:'🔔', name:'Glocke'},
  {id:'trommel',  emoji:'🥁', name:'Trommelwirbel'},
  {id:'herz',     emoji:'❤️', name:'Herzschlag'},
  {id:'alarm',    emoji:'⏰', name:'Wecker'},
  {id:'boom',     emoji:'💥', name:'Explosion'},
  {id:'blub',     emoji:'💧', name:'Blubb'},
  {id:'rakete',   emoji:'🚀', name:'Rakete'},
  {id:'pfeife',   emoji:'🎵', name:'Flöte'},
  {id:'muenze',   emoji:'🪙', name:'Münze'},
  {id:'gameover', emoji:'👾', name:'Game Over'},
  {id:'grusel',   emoji:'👻', name:'Grusel'}
];

function play(ctx, id){
  if (!ctx) return;
  try { ctx.resume(); } catch(e){}
  const T = ctx.currentTime + 0.03;
  const out = ctx.createGain(); out.gain.value = 0.8; out.connect(ctx.destination);

  function tone(f, s, d, type='sine', vol=.4, fEnd=null, attack=.01){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, T + s);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, T + s + d);
    g.gain.setValueAtTime(.0001, T + s);
    g.gain.exponentialRampToValueAtTime(vol, T + s + attack);
    g.gain.setValueAtTime(vol, T + s + Math.max(attack, d - .05));
    g.gain.exponentialRampToValueAtTime(.0001, T + s + d);
    o.connect(g); g.connect(out); o.start(T + s); o.stop(T + s + d + .02);
    return o;
  }
  function noise(s, d, vol=.4, f=1000, fEnd=null, ftype='lowpass', q=1){
    const len = Math.ceil(ctx.sampleRate * d), buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = ftype; fl.Q.value = q; fl.frequency.setValueAtTime(f, T + s);
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, T + s + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, T + s); g.gain.exponentialRampToValueAtTime(.0001, T + s + d);
    src.connect(fl); fl.connect(g); g.connect(out); src.start(T + s); src.stop(T + s + d);
  }
  function vibrato(o, rate, depth, s, d){
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate; lg.gain.value = depth;
    l.connect(lg); lg.connect(o.frequency); l.start(T + s); l.stop(T + s + d);
  }

  switch(id){
    case 'furz': {
      const o = tone(95, 0, .9, 'sawtooth', .5, 60, .03); vibrato(o, 28, 25, 0, .9);
      noise(0, .9, .25, 400, 150); break; }
    case 'airhorn':
      [0, .45].forEach(s => [349, 440, 523].forEach(f => tone(f, s, .38, 'sawtooth', .15)));
      [349, 440, 523].forEach(f => tone(f, .9, .9, 'sawtooth', .15)); break;
    case 'tada':
      tone(523, 0, .12, 'triangle', .4); tone(659, .12, .12, 'triangle', .4);
      [523, 659, 784, 1047].forEach(f => tone(f, .26, .8, 'triangle', .22)); break;
    case 'fail':
      [[311,0,.4],[294,.45,.4],[277,.9,.4]].forEach(([f,s,d]) => tone(f, s, d, 'sawtooth', .25));
      { const o = tone(262, 1.35, 1.1, 'sawtooth', .25, 245); vibrato(o, 6, 8, 1.35, 1.1); } break;
    case 'laser':
      [0, .2, .4].forEach(s => tone(1800, s, .18, 'square', .3, 200)); break;
    case 'boing': {
      const o = tone(150, 0, .7, 'sine', .5, 600); vibrato(o, 18, 60, 0, .7); break; }
    case 'sirene':
      for (let i = 0; i < 3; i++){ tone(650, i * .8, .4, 'sawtooth', .28, 950); tone(950, i * .8 + .4, .4, 'sawtooth', .28, 650); } break;
    case 'quak':
      [0, .3].forEach(s => { tone(420, s, .2, 'sawtooth', .3, 260); noise(s, .2, .15, 1200, 600, 'bandpass', 3); }); break;
    case 'kuckuck':
      [0, .9].forEach(s => { tone(784, s, .3, 'sine', .4); tone(622, s + .35, .45, 'sine', .4); }); break;
    case 'glocke':
      [0, .6].forEach(s => { tone(880, s, 1.4, 'sine', .35, null, .005); tone(2210, s, .8, 'sine', .12, null, .005); tone(1320, s, 1, 'sine', .1, null, .005); }); break;
    case 'trommel':
      for (let i = 0; i < 28; i++) noise(i * .05, .06, .15 + i * .01, 3000, null, 'bandpass', .8);
      noise(1.45, 1.2, .6, 8000, 3000, 'highpass'); tone(80, 1.45, .4, 'sine', .5, 50); break;
    case 'herz':
      [0, .9].forEach(s => { tone(70, s, .15, 'sine', .8, 45); tone(65, s + .22, .15, 'sine', .6, 40); }); break;
    case 'alarm':
      for (let i = 0; i < 10; i++) tone(2000, i * .14, .07, 'square', .26); break;
    case 'boom':
      noise(0, 1.8, .9, 900, 60); tone(90, 0, 1.2, 'sine', .7, 30); break;
    case 'blub':
      [0, .18, .32, .5, .62].forEach((s, i) => tone(300 + i * 60, s, .12, 'sine', .45, 900 + i * 100)); break;
    case 'rakete':
      noise(0, 2, 1.2, 200, 4000, 'bandpass', 2); tone(150, 0, 2, 'sawtooth', .16, 1200); break;
    case 'pfeife':
      tone(500, 0, .6, 'sine', .35, 1800); tone(1800, .6, .7, 'sine', .35, 400); break;
    case 'muenze':
      tone(988, 0, .08, 'square', .28); tone(1319, .08, .5, 'square', .28); break;
    case 'gameover':
      [494, 466, 440, 415].forEach((f, i) => tone(f, i * .28, .26, 'square', .25));
      { const o = tone(392, 1.12, .9, 'square', .25); vibrato(o, 7, 10, 1.12, .9); } break;
    case 'grusel': {
      const o = tone(300, 0, 2.6, 'sine', .35, 520, .3); vibrato(o, 5, 30, 0, 2.6);
      const o2 = tone(450, .4, 2.2, 'triangle', .12, 300, .3); vibrato(o2, 4, 20, .4, 2.2); break; }
  }
}

window.SFX = {list: LIST, play, byId: id => LIST.find(s => s.id === id)};
})();
