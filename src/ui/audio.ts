/**
 * Procedural sound (WebAudio). No audio files to ship, license or load.
 * Every call is wrapped so a missing/blocked AudioContext can never throw into the game loop.
 */
export class Audio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxOn = true;
  musicOn = true;
  private noise: AudioBuffer | null = null;
  private last: Record<string, number> = {};
  private music: { stop: () => void } | null = null;
  private listenerX = 0;
  private listenerW = 1;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.musicOn && !this.music) this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  suspend() {
    try {
      void this.ctx?.suspend();
    } catch {
      /* ignore */
    }
  }
  resume() {
    try {
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  setListener(x: number, w: number) {
    this.listenerX = x;
    this.listenerW = Math.max(1, w);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!on && this.music) {
      this.music.stop();
      this.music = null;
    } else if (on && this.ctx && !this.music) this.startMusic();
  }

  private gate(k: string, gap: number) {
    const now = performance.now();
    if ((this.last[k] ?? 0) + gap > now) return false;
    this.last[k] = now;
    return true;
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private out(pan: number): AudioNode {
    const c = this.ctx!;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-0.8, Math.min(0.8, pan));
      p.connect(this.master!);
      return p;
    }
    return this.master!;
  }

  private noiseHit(t: number, dur: number, freq: number, q: number, vol: number, type: BiquadFilterType, pan: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, 0.005, vol, dur);
    src.connect(f).connect(g).connect(this.out(pan));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, pan: number, a = 0.01) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, a, vol, dur);
    o.connect(g).connect(this.out(pan));
    o.start(t);
    o.stop(t + a + dur + 0.05);
  }

  play(k: string, worldX = this.listenerX) {
    if (!this.sfxOn || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    try {
      const t = this.ctx.currentTime + 0.01;
      const pan = (worldX - this.listenerX) / this.listenerW;
      switch (k) {
        case 'clash':
          if (!this.gate(k, 70)) return;
          this.noiseHit(t, 0.08, 3200 + Math.random() * 1500, 6, 0.12, 'bandpass', pan);
          this.tone(t, 'square', 1800 + Math.random() * 600, 900, 0.05, 0.025, pan);
          break;
        case 'arrow':
          if (!this.gate(k, 90)) return;
          this.noiseHit(t, 0.12, 5000, 2, 0.05, 'highpass', pan);
          break;
        case 'bolt':
          if (!this.gate(k, 120)) return;
          this.tone(t, 'triangle', 300, 120, 0.08, 0.08, pan);
          this.noiseHit(t, 0.06, 2000, 3, 0.06, 'bandpass', pan);
          break;
        case 'thud':
          if (!this.gate(k, 120)) return;
          this.tone(t, 'sine', 110, 45, 0.25, 0.3, pan);
          this.noiseHit(t, 0.15, 400, 1, 0.12, 'lowpass', pan);
          break;
        case 'collapse':
          if (!this.gate(k, 300)) return;
          this.noiseHit(t, 1.1, 300, 0.7, 0.5, 'lowpass', pan);
          this.tone(t, 'sine', 70, 30, 0.9, 0.35, pan);
          break;
        case 'boom':
          if (!this.gate(k, 150)) return;
          this.noiseHit(t, 0.5, 500, 0.8, 0.35, 'lowpass', pan);
          this.tone(t, 'sine', 90, 35, 0.4, 0.25, pan);
          break;
        case 'treb':
          if (!this.gate(k, 300)) return;
          this.tone(t, 'sawtooth', 140, 60, 0.3, 0.05, pan);
          this.noiseHit(t + 0.05, 0.25, 900, 1, 0.08, 'bandpass', pan);
          break;
        case 'fire':
          if (!this.gate(k, 250)) return;
          this.noiseHit(t, 0.6, 900, 0.6, 0.12, 'lowpass', pan);
          break;
        case 'roar':
          if (!this.gate(k, 1500)) return;
          {
            const c = this.ctx;
            const o = c.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(90, t);
            o.frequency.linearRampToValueAtTime(60, t + 1.4);
            const lfo = c.createOscillator();
            lfo.frequency.value = 18;
            const lg = c.createGain();
            lg.gain.value = 14;
            lfo.connect(lg).connect(o.frequency);
            const f = c.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 700;
            const g = c.createGain();
            this.env(g, t, 0.15, 0.35, 1.3);
            o.connect(f).connect(g).connect(this.out(pan));
            o.start(t);
            lfo.start(t);
            o.stop(t + 1.6);
            lfo.stop(t + 1.6);
            this.noiseHit(t, 1.2, 600, 0.5, 0.2, 'lowpass', pan);
          }
          break;
        case 'wave':
        case 'horn':
          if (!this.gate('horn', 800)) return;
          for (const [f, d] of [
            [196, 0],
            [247, 0.02],
            [294, 0.04],
          ])
            this.tone(t + d, 'sawtooth', f, f * 0.98, 1.1, 0.06, 0, 0.12);
          break;
        case 'volley':
          if (!this.gate(k, 400)) return;
          for (let i = 0; i < 6; i++) this.noiseHit(t + i * 0.03, 0.18, 4500, 1.5, 0.06, 'highpass', pan);
          break;
        case 'hammer':
          if (!this.gate(k, 200)) return;
          this.tone(t, 'square', 900, 700, 0.04, 0.04, pan);
          break;
        case 'wood':
          if (!this.gate(k, 150)) return;
          this.noiseHit(t, 0.15, 700, 4, 0.15, 'bandpass', pan);
          break;
        case 'click':
          if (!this.gate(k, 40)) return;
          this.tone(t, 'triangle', 700, 500, 0.04, 0.05, 0);
          break;
        case 'select':
          if (!this.gate(k, 40)) return;
          this.tone(t, 'triangle', 520, 780, 0.07, 0.06, 0);
          break;
        case 'order':
          if (!this.gate(k, 40)) return;
          this.tone(t, 'triangle', 660, 440, 0.08, 0.06, 0);
          break;
        case 'deny':
          this.tone(t, 'square', 180, 140, 0.12, 0.05, 0);
          break;
        case 'alarm':
          if (!this.gate(k, 1200)) return;
          this.tone(t, 'square', 880, 880, 0.12, 0.05, 0);
          this.tone(t + 0.18, 'square', 880, 880, 0.12, 0.05, 0);
          break;
        case 'victory':
          [392, 494, 587, 784].forEach((f, i) => this.tone(t + i * 0.16, 'triangle', f, f, 0.5, 0.09, 0, 0.02));
          break;
        case 'defeat':
          [330, 294, 247, 196].forEach((f, i) => this.tone(t + i * 0.25, 'sawtooth', f, f * 0.97, 0.6, 0.05, 0, 0.05));
          break;
        case 'coin':
          this.tone(t, 'triangle', 1200, 1600, 0.08, 0.06, 0);
          this.tone(t + 0.07, 'triangle', 1600, 2000, 0.1, 0.05, 0);
          break;
      }
    } catch {
      /* never let audio break the game */
    }
  }

  /** Quiet procedural drone + slow war drum; cheap and loop-free of files. */
  private startMusic() {
    const c = this.ctx;
    if (!c || !this.master) return;
    try {
      const g = c.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 3);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.07;
      const lg = c.createGain();
      lg.gain.value = 180;
      lfo.connect(lg).connect(f.frequency);
      const oscs: OscillatorNode[] = [];
      for (const [fr, det] of [
        [55, 0],
        [55, 7],
        [82.4, -5],
        [110, 3],
      ]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.detune.value = det;
        o.connect(f);
        o.start();
        oscs.push(o);
      }
      f.connect(g).connect(this.master);
      lfo.start();
      let alive = true;
      const drum = () => {
        if (!alive || !this.ctx) return;
        if (this.ctx.state === 'running' && this.sfxOn) {
          const t = this.ctx.currentTime + 0.05;
          this.tone(t, 'sine', 70, 40, 0.35, 0.07, 0);
          this.tone(t + 0.45, 'sine', 70, 40, 0.3, 0.05, 0);
        }
        timer = window.setTimeout(drum, 2400);
      };
      let timer = window.setTimeout(drum, 2400);
      this.music = {
        stop: () => {
          alive = false;
          clearTimeout(timer);
          try {
            g.gain.cancelScheduledValues(c.currentTime);
            g.gain.setValueAtTime(g.gain.value, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
            for (const o of oscs) o.stop(c.currentTime + 0.6);
            lfo.stop(c.currentTime + 0.6);
          } catch {
            /* ignore */
          }
        },
      };
    } catch {
      this.music = null;
    }
  }
}

export const audio = new Audio();

export function haptic(on: boolean, ms = 12) {
  if (!on) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
