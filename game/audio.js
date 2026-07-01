"use strict";
/* Redemption's Edge — audio.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   4. AUDIO MANAGER  —  synthesized SFX, no external files (Tier 3)
   --------------------------------------------------------------------------- */
const Audio = {
  ctx: null,
  enabled: true,
  master: null,
  windNode: null,
  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._startWind();
    } catch (e) { this.enabled = false; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  // Low ambient prairie wind — a filtered noise bed.
  _startWind() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 380;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start();
    this.windNode = g;
  },
  _env(type, freq, dur, vol, slideTo) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  },
  // Gunshot: noise burst + low thump.
  shot() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=2200;
    const g = ctx.createGain(); g.gain.value = 0.55;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start();
    this._env('sine', 140, 0.18, 0.5, 55);
  },
  enemyShot() { this._env('square', 220, 0.12, 0.18, 90); },
  reload() { this._env('triangle', 600, 0.05, 0.2); setTimeout(()=>this._env('triangle',900,0.05,0.2),140); },
  hit() { this._env('sawtooth', 160, 0.12, 0.25, 60); },
  hurt() { this._env('sawtooth', 90, 0.22, 0.3, 40); },
  pickup() { this._env('sine', 660, 0.08, 0.25, 990); },
  money() { this._env('sine', 880, 0.07, 0.22, 1320); },
  click() { this._env('square', 1200, 0.03, 0.08); },
  dash() { this._env('sine', 520, 0.16, 0.16, 180); },   // whoosh
  lasso() { this._env('sine', 300, 0.22, 0.14, 520); },  // rope whip
  whistle() { this._env('sine', 900, 0.18, 0.16, 1500); setTimeout(()=>this._env('sine',1300,0.16,0.14,700),120); },
  deadeye() { this._env('sine', 240, 0.5, 0.22, 90); },  // low time-warp swell
  // Explosion: heavy filtered noise boom + low sub thump.
  explosion() {
    if (!this.enabled || !this.ctx) return;
    const ctx=this.ctx, t=ctx.currentTime;
    const buf=ctx.createBuffer(1, ctx.sampleRate*0.4, ctx.sampleRate);
    const d=buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.6);
    const src=ctx.createBufferSource(); src.buffer=buf;
    const filt=ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=900;
    const g=ctx.createGain(); g.gain.value=0.7;
    src.connect(filt); filt.connect(g); g.connect(this.master); src.start();
    this._env('sine', 90, 0.5, 0.6, 30);
  },
};
