import { HEARTBEAT } from './config';

// Ambient-only audio for the preview (spoken sentences arrive in Phase 2).
// Three layers, all degraded by holdT:
//  - childhood vocals: loop; detunes and runs through a waveshaper when held
//  - heartbeat: synthesized lub-dub; rate climbs 58 → 128 bpm
//  - atmosphere: quiet filtered noise bed; darkens when held

export class AudioEngine {
  private ctx!: AudioContext;
  private master!: GainNode;
  private vocalsDry!: GainNode;
  private vocalsWet!: GainNode;
  private vocalsSource: AudioBufferSourceNode | null = null;
  private atmosphereFilter!: BiquadFilterNode;
  private heartbeatGain!: GainNode;
  private nextBeatTime = 0;
  private holdT = 0;
  private _muted = false;
  started = false;

  // Must be called from a user gesture (the intro tap).
  async start() {
    if (this.started) return;
    this.started = true;
    this.ctx = new AudioContext();
    await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.setupVocals();
    this.setupAtmosphere();
    this.setupHeartbeat();
    this.scheduleLoop();
  }

  private async setupVocals() {
    try {
      const res = await fetch('/media/audio/childhood-vocals.m4a');
      if (!res.ok) return;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());

      this.vocalsDry = this.ctx.createGain();
      this.vocalsDry.gain.value = 0.55;
      this.vocalsDry.connect(this.master);

      // held path: detuned + waveshaped + darkened
      const shaper = this.ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 511.5) - 1;
        curve[i] = Math.tanh(x * 4); // hard-ish saturation
      }
      shaper.curve = curve;
      const darken = this.ctx.createBiquadFilter();
      darken.type = 'lowpass';
      darken.frequency.value = 900;
      this.vocalsWet = this.ctx.createGain();
      this.vocalsWet.gain.value = 0;
      shaper.connect(darken).connect(this.vocalsWet).connect(this.master);

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.vocalsDry);
      src.connect(shaper);
      src.start();
      this.vocalsSource = src;
    } catch {
      // vocals are enhancement; heartbeat + atmosphere carry the preview
    }
  }

  private setupAtmosphere() {
    const seconds = 4;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // brown-ish noise
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.atmosphereFilter = this.ctx.createBiquadFilter();
    this.atmosphereFilter.type = 'lowpass';
    this.atmosphereFilter.frequency.value = 380;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(this.atmosphereFilter).connect(gain).connect(this.master);
    src.start();
  }

  private setupHeartbeat() {
    this.heartbeatGain = this.ctx.createGain();
    this.heartbeatGain.gain.value = 0.9;
    this.heartbeatGain.connect(this.master);
    this.nextBeatTime = this.ctx.currentTime + 0.5;
  }

  private thump(at: number, strength: number) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(52, at);
    osc.frequency.exponentialRampToValueAtTime(38, at + 0.12);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(strength, at + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(env).connect(this.heartbeatGain);
    osc.start(at);
    osc.stop(at + 0.3);
  }

  private scheduleLoop() {
    // lub-dub pairs, lookahead scheduling
    const tick = () => {
      if (!this.ctx) return;
      const bpm = HEARTBEAT.restBpm + (HEARTBEAT.heldBpm - HEARTBEAT.restBpm) * this.holdT;
      const period = 60 / bpm;
      while (this.nextBeatTime < this.ctx.currentTime + 0.4) {
        const loud = 0.5 + 0.45 * this.holdT;
        this.thump(this.nextBeatTime, loud);
        this.thump(this.nextBeatTime + period * 0.28, loud * 0.55);
        this.nextBeatTime += period;
      }
      setTimeout(tick, 120);
    };
    tick();
  }

  // Called every frame with eased hold progress.
  setHold(t: number) {
    if (!this.started) return;
    this.holdT = t;
    const now = this.ctx.currentTime;
    if (this.vocalsSource && this.vocalsDry && this.vocalsWet) {
      // audio distortion leads the visual reveal (starts immediately on hold)
      this.vocalsDry.gain.setTargetAtTime(0.55 * (1 - t), now, 0.08);
      this.vocalsWet.gain.setTargetAtTime(0.4 * t, now, 0.08);
      const warble = t > 0.05 ? 1 - 0.13 * t + 0.02 * Math.sin(now * 7) * t : 1;
      this.vocalsSource.playbackRate.setTargetAtTime(warble, now, 0.1);
    }
    if (this.atmosphereFilter) {
      this.atmosphereFilter.frequency.setTargetAtTime(380 + 1400 * t, now, 0.15);
    }
  }

  get muted() {
    return this._muted;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this._muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    return this._muted;
  }
}
