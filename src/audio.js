// Each original sound object owned one DirectSound buffer; play() rewound it
// to position 0 and restarted it, cutting off any previous playback of that
// same object. Sound instances here behave the same way.

export class Audio {
  constructor() {
    this.ctx = new AudioContext();
    this.buffers = {};
  }

  async load(key, url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    this.buffers[key] = await this.ctx.decodeAudioData(await res.arrayBuffer());
  }

  resume() {
    return this.ctx.resume();
  }

  sound(key) {
    return new Sound(this, this.buffers[key]);
  }
}

export class Sound {
  constructor(audio, buffer) {
    this.audio = audio;
    this.buffer = buffer;
    this.source = null;
  }

  play() {
    this.stop();
    if (!this.buffer) return;
    const src = this.audio.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.audio.ctx.destination);
    src.start();
    this.source = src;
  }

  stop() {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch {
      // already finished
    }
    this.source = null;
  }
}

// The original scanned data\music\* with FindFirstFile and streamed a random
// file through DirectShow when "FIGHT!" was announced, stopping it when the
// round ended. The shipped music folder is empty, so this is usually silent.
export class MusicPlayer {
  constructor(tracks) {
    this.tracks = tracks;
    this.element = null;
  }

  playRandom() {
    if (this.tracks.length === 0) return;
    const track = this.tracks[Math.floor(Math.random() * this.tracks.length)];
    this.element = new window.Audio(track);
    this.element.play().catch(() => {});
  }

  stop() {
    this.element?.pause();
    this.element = null;
  }
}
