"use strict";

// audio.js - persistent settings + procedural WebAudio sound effects (no audio files)

const SETTINGS_KEY = "spudSurvivorsSettings";

const gameSettings = (() => {
  const defaults = { volume: 0.7, muted: false, screenShake: true };
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { ...defaults, ...(stored ?? {}) };
  } catch {
    return defaults;
  }
})();

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(gameSettings));
  } catch {
    // storage unavailable (private mode / file restrictions) - settings just won't persist
  }
}

let audioCtx = null;
let masterGain = null;
let noiseBuffer = null;
const sfxLastPlayed = new Map();

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  applyAudioSettings();

  const seconds = 1;
  noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * seconds, audioCtx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }
}

function applyAudioSettings() {
  if (masterGain) {
    masterGain.gain.value = gameSettings.muted ? 0 : gameSettings.volume * 0.55;
  }
}

function tone({ freq = 440, endFreq = null, type = "sine", dur = 0.1, vol = 0.12, delay = 0 }) {
  if (!audioCtx) return;
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
  }
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0004, start + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noiseHit({ dur = 0.15, vol = 0.1, filterFreq = 900, filterType = "lowpass", delay = 0 }) {
  if (!audioCtx || !noiseBuffer) return;
  const start = audioCtx.currentTime + delay;
  const source = audioCtx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0004, start + dur);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(start);
  source.stop(start + dur + 0.02);
}

// One-shot playback of a bundled audio file (e.g. the intro vine-boom). Prefers the WebAudio
// path (decode once, cache the buffer, route through masterGain so mute/volume apply). That
// path uses fetch(), which browsers BLOCK on file:// — so when it fails (e.g. the game is
// opened by double-clicking index.html rather than served over http), it falls back to an
// HTMLAudioElement, which is not subject to the file:// fetch restriction. Returns true if a
// clip was triggered, false if unavailable (caller can then use a synth fallback). `gain`
// scales the clip's loudness relative to the file.
const clipBufferCache = new Map();
async function playClip(src, { gain = 1 } = {}) {
  ensureAudio();
  if (gameSettings.muted) return false;

  // Preferred: WebAudio (respects masterGain / mute automatically).
  if (audioCtx) {
    try {
      let buffer = clipBufferCache.get(src);
      if (!buffer) {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`clip ${src} -> ${res.status}`);
        const arr = await res.arrayBuffer();
        buffer = await audioCtx.decodeAudioData(arr);
        clipBufferCache.set(src, buffer);
      }
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      const g = audioCtx.createGain();
      g.gain.value = gain;
      source.connect(g);
      g.connect(masterGain);
      source.start();
      return true;
    } catch {
      // fall through to the HTMLAudioElement path (handles file:// fetch blocks)
    }
  }

  // Fallback: <audio> element. Works on file://. Volume mirrors the master mix manually.
  try {
    const el = new Audio(src);
    el.volume = Math.min(1, Math.max(0, gameSettings.volume * 0.55 * gain));
    const p = el.play();
    if (p && typeof p.then === "function") await p;
    return true;
  } catch {
    return false; // truly unavailable: caller can fall back to a synth sound
  }
}

// A synthesized "vine boom" style hit — a deep, snappy bass thud with a bright transient.
// Used as the intro's fallback if the mp3 clip isn't present.
function synthVineBoom() {
  tone({ freq: 150, endFreq: 42, type: "sine", dur: 0.5, vol: 0.32 });
  tone({ freq: 90, endFreq: 30, type: "triangle", dur: 0.55, vol: 0.24 });
  noiseHit({ dur: 0.12, vol: 0.1, filterFreq: 1200 });
}

const SFX_MIN_INTERVAL = {
  shoot: 0.035,
  flame: 0.09,
  hit: 0.03,
  crit: 0.05,
  kill: 0.04,
  coin: 0.045,
  swing: 0.05,
  zap: 0.08,
  tree: 0.08,
  hover: 0.06
};

function playSfx(name) {
  if (gameSettings.muted || !audioCtx) return;
  const now = performance.now() / 1000;
  const minGap = SFX_MIN_INTERVAL[name] ?? 0;
  if (minGap > 0 && now - (sfxLastPlayed.get(name) ?? -1) < minGap) return;
  sfxLastPlayed.set(name, now);

  switch (name) {
    case "shoot":
      tone({ freq: 340 + Math.random() * 90, endFreq: 150, type: "square", dur: 0.07, vol: 0.05 });
      break;
    case "shootHeavy":
      tone({ freq: 210, endFreq: 60, type: "square", dur: 0.13, vol: 0.09 });
      noiseHit({ dur: 0.08, vol: 0.05, filterFreq: 1400 });
      break;
    case "flame":
      noiseHit({ dur: 0.12, vol: 0.035, filterFreq: 620 });
      break;
    case "swing":
      noiseHit({ dur: 0.09, vol: 0.05, filterFreq: 2400, filterType: "bandpass" });
      tone({ freq: 170, endFreq: 90, type: "triangle", dur: 0.09, vol: 0.05 });
      break;
    case "hit":
      tone({ freq: 230 + Math.random() * 40, endFreq: 110, type: "triangle", dur: 0.05, vol: 0.06 });
      break;
    case "crit":
      tone({ freq: 520, endFreq: 240, type: "square", dur: 0.09, vol: 0.08 });
      tone({ freq: 780, endFreq: 500, type: "sine", dur: 0.07, vol: 0.05, delay: 0.015 });
      break;
    case "kill":
      tone({ freq: 300, endFreq: 55, type: "triangle", dur: 0.13, vol: 0.09 });
      noiseHit({ dur: 0.09, vol: 0.045, filterFreq: 800 });
      break;
    case "coin":
      tone({ freq: 880, type: "sine", dur: 0.05, vol: 0.045 });
      tone({ freq: 1310, type: "sine", dur: 0.07, vol: 0.04, delay: 0.045 });
      break;
    case "hurt":
      tone({ freq: 165, endFreq: 62, type: "sawtooth", dur: 0.19, vol: 0.14 });
      noiseHit({ dur: 0.12, vol: 0.07, filterFreq: 500 });
      break;
    case "dodge":
      tone({ freq: 560, endFreq: 940, type: "sine", dur: 0.09, vol: 0.06 });
      break;
    case "explosion":
      noiseHit({ dur: 0.4, vol: 0.16, filterFreq: 340 });
      tone({ freq: 95, endFreq: 28, type: "triangle", dur: 0.35, vol: 0.15 });
      break;
    case "zap":
      tone({ freq: 1250, endFreq: 180, type: "square", dur: 0.08, vol: 0.06 });
      break;
    case "heal":
      tone({ freq: 510, endFreq: 790, type: "sine", dur: 0.16, vol: 0.07 });
      break;
    case "tree":
      noiseHit({ dur: 0.14, vol: 0.08, filterFreq: 420 });
      break;
    case "buy":
      tone({ freq: 660, type: "sine", dur: 0.06, vol: 0.07 });
      tone({ freq: 990, type: "sine", dur: 0.1, vol: 0.06, delay: 0.06 });
      break;
    case "reroll":
      tone({ freq: 290, endFreq: 520, type: "triangle", dur: 0.09, vol: 0.06 });
      break;
    case "merge":
      tone({ freq: 420, type: "sine", dur: 0.07, vol: 0.06 });
      tone({ freq: 630, type: "sine", dur: 0.07, vol: 0.06, delay: 0.06 });
      tone({ freq: 840, type: "sine", dur: 0.12, vol: 0.06, delay: 0.12 });
      break;
    case "wave":
      tone({ freq: 220, type: "triangle", dur: 0.14, vol: 0.08 });
      tone({ freq: 330, type: "triangle", dur: 0.14, vol: 0.08, delay: 0.11 });
      tone({ freq: 440, type: "triangle", dur: 0.22, vol: 0.09, delay: 0.22 });
      break;
    case "gameover":
      tone({ freq: 320, endFreq: 240, type: "triangle", dur: 0.28, vol: 0.11 });
      tone({ freq: 240, endFreq: 150, type: "triangle", dur: 0.3, vol: 0.11, delay: 0.24 });
      tone({ freq: 150, endFreq: 62, type: "triangle", dur: 0.6, vol: 0.12, delay: 0.5 });
      break;
    case "click":
      tone({ freq: 820, type: "sine", dur: 0.035, vol: 0.04 });
      break;
    case "hover":
      // Soft, quick blip when the pointer lands on a title button.
      tone({ freq: 620, endFreq: 760, type: "sine", dur: 0.05, vol: 0.028 });
      break;
    case "whoosh":
      // Rising sweep + airy noise when starting a run from the title.
      tone({ freq: 240, endFreq: 880, type: "triangle", dur: 0.22, vol: 0.07 });
      noiseHit({ dur: 0.2, vol: 0.04, filterFreq: 1800, filterType: "bandpass" });
      break;
    default:
      break;
  }
}
