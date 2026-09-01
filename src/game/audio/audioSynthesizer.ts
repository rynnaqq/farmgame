import type { WeatherType, MutationType } from '../../state/storeTypes';

export interface AmbienceInstance {
  gainNode: GainNode;
  stop: (fadeDurationSec?: number) => void;
}

/**
 * Generates an AudioBuffer containing procedural noise (white or pink).
 */
export function createNoiseBuffer(
  ctx: AudioContext,
  durationSec: number = 1.0,
  type: 'white' | 'pink' = 'white'
): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const bufferSize = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'pink') {
    // Paul Kellet's filtered pink noise approximation
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
      b6 = white * 0.115926;
    }
  } else {
    // White noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  return buffer;
}

/**
 * Shared in-memory noise buffer cache to minimize garbage collection.
 */
let cachedWhiteNoiseBuffer: AudioBuffer | null = null;
let cachedPinkNoiseBuffer: AudioBuffer | null = null;

function getCachedNoiseBuffer(
  ctx: AudioContext,
  type: 'white' | 'pink' = 'white'
): AudioBuffer {
  if (type === 'pink') {
    if (!cachedPinkNoiseBuffer || cachedPinkNoiseBuffer.sampleRate !== ctx.sampleRate) {
      cachedPinkNoiseBuffer = createNoiseBuffer(ctx, 2.0, 'pink');
    }
    return cachedPinkNoiseBuffer;
  }
  if (!cachedWhiteNoiseBuffer || cachedWhiteNoiseBuffer.sampleRate !== ctx.sampleRate) {
    cachedWhiteNoiseBuffer = createNoiseBuffer(ctx, 2.0, 'white');
  }
  return cachedWhiteNoiseBuffer;
}

/**
 * Helper to safely schedule node stop and disconnect.
 */
function scheduleCleanup(
  _ctx: AudioContext,
  nodes: { stop?: () => void; disconnect: () => void }[],
  delaySec: number
): void {
  const timeoutMs = Math.max(50, Math.ceil(delaySec * 1000) + 100);
  setTimeout(() => {
    try {
      nodes.forEach((node) => {
        try {
          if (node.stop) node.stop();
        } catch {
          // Ignore if already stopped
        }
        try {
          node.disconnect();
        } catch {
          // Ignore
        }
      });
    } catch {
      // Ignore
    }
  }, timeoutMs);
}

/**
 * Till SFX: Soft earthy thud and scrape.
 */
export function synthesizeTill(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.16;

  // 1. Earthy Thud Tone (low pitch drop)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  const startFreq = 120 * pitchMultiplier;
  const endFreq = 38 * pitchMultiplier;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), now + duration);

  oscGain.gain.setValueAtTime(0.7, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(oscGain);
  oscGain.connect(dest);
  osc.start(now);
  osc.stop(now + duration);

  // 2. Soil Scrape Noise
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getCachedNoiseBuffer(ctx, 'pink');
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(280 * pitchMultiplier, now);
  noiseFilter.Q.setValueAtTime(1.8, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);
  noiseSource.start(now);
  noiseSource.stop(now + 0.12);

  scheduleCleanup(ctx, [osc, oscGain, noiseSource, noiseFilter, noiseGain], duration);
}

/**
 * Water SFX: Liquid splash / trickle with bubbling sine waves.
 */
export function synthesizeWater(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.28;

  // 1. Resonant Splash Noise
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getCachedNoiseBuffer(ctx, 'pink');
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(750 * pitchMultiplier, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(
    Math.max(50, 1350 * pitchMultiplier),
    now + 0.1
  );
  noiseFilter.frequency.exponentialRampToValueAtTime(
    Math.max(50, 500 * pitchMultiplier),
    now + duration
  );
  noiseFilter.Q.setValueAtTime(3.0, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);
  noiseSource.start(now);
  noiseSource.stop(now + duration);

  // 2. Ascending Bubble Chirp 1
  const b1 = ctx.createOscillator();
  const b1Gain = ctx.createGain();
  b1.type = 'sine';
  b1.frequency.setValueAtTime(420 * pitchMultiplier, now);
  b1.frequency.exponentialRampToValueAtTime(840 * pitchMultiplier, now + 0.08);

  b1Gain.gain.setValueAtTime(0.001, now);
  b1Gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
  b1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  b1.connect(b1Gain);
  b1Gain.connect(dest);
  b1.start(now);
  b1.stop(now + 0.08);

  // 3. Ascending Bubble Chirp 2 (staggered)
  const b2 = ctx.createOscillator();
  const b2Gain = ctx.createGain();
  b2.type = 'sine';
  b2.frequency.setValueAtTime(620 * pitchMultiplier, now + 0.05);
  b2.frequency.exponentialRampToValueAtTime(1200 * pitchMultiplier, now + 0.15);

  b2Gain.gain.setValueAtTime(0.001, now + 0.05);
  b2Gain.gain.linearRampToValueAtTime(0.3, now + 0.07);
  b2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  b2.connect(b2Gain);
  b2Gain.connect(dest);
  b2.start(now + 0.05);
  b2.stop(now + 0.15);

  scheduleCleanup(
    ctx,
    [noiseSource, noiseFilter, noiseGain, b1, b1Gain, b2, b2Gain],
    duration
  );
}

/**
 * Plant SFX: Crisp rustle / seed drop click.
 */
export function synthesizePlant(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.14;

  // 1. Rustle noise burst
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getCachedNoiseBuffer(ctx, 'white');
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(2400 * pitchMultiplier, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.35, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  noiseSource.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);
  noiseSource.start(now);
  noiseSource.stop(now + 0.09);

  // 2. Seed impact click (short downward triangle chirp)
  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = 'triangle';
  click.frequency.setValueAtTime(450 * pitchMultiplier, now);
  click.frequency.exponentialRampToValueAtTime(Math.max(10, 110 * pitchMultiplier), now + 0.05);

  clickGain.gain.setValueAtTime(0.5, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  click.connect(clickGain);
  clickGain.connect(dest);
  click.start(now);
  click.stop(now + 0.05);

  scheduleCleanup(ctx, [noiseSource, filter, noiseGain, click, clickGain], duration);
}

/**
 * Harvest SFX: Organic pluck / pop with harmonic ring.
 */
export function synthesizeHarvest(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.45;

  // 1. Pluck pop
  const pop = ctx.createOscillator();
  const popGain = ctx.createGain();
  pop.type = 'triangle';
  pop.frequency.setValueAtTime(360 * pitchMultiplier, now);
  pop.frequency.exponentialRampToValueAtTime(Math.max(10, 160 * pitchMultiplier), now + 0.06);

  popGain.gain.setValueAtTime(0.65, now);
  popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  pop.connect(popGain);
  popGain.connect(dest);
  pop.start(now);
  pop.stop(now + 0.06);

  // 2. Resonant Harmonic Ring (D5 / 587.33 Hz)
  const ring = ctx.createOscillator();
  const ringGain = ctx.createGain();
  ring.type = 'sine';
  ring.frequency.setValueAtTime(587.33 * pitchMultiplier, now);

  ringGain.gain.setValueAtTime(0.001, now);
  ringGain.gain.linearRampToValueAtTime(0.4, now + 0.015);
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  ring.connect(ringGain);
  ringGain.connect(dest);
  ring.start(now);
  ring.stop(now + duration);

  // 3. Shimmer overtone (A5 / 880 Hz)
  const overtone = ctx.createOscillator();
  const overtoneGain = ctx.createGain();
  overtone.type = 'sine';
  overtone.frequency.setValueAtTime(880 * pitchMultiplier, now);

  overtoneGain.gain.setValueAtTime(0.001, now);
  overtoneGain.gain.linearRampToValueAtTime(0.2, now + 0.02);
  overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  overtone.connect(overtoneGain);
  overtoneGain.connect(dest);
  overtone.start(now);
  overtone.stop(now + 0.35);

  scheduleCleanup(
    ctx,
    [pop, popGain, ring, ringGain, overtone, overtoneGain],
    duration
  );
}

/**
 * Coin SFX: Metallic twin-chime clink (B5 -> E6, 987.77 Hz -> 1318.51 Hz).
 */
export function synthesizeCoin(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.42;

  // Chime 1: B5 (987.77 Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(987.77 * pitchMultiplier, now);

  gain1.gain.setValueAtTime(0.001, now);
  gain1.gain.linearRampToValueAtTime(0.45, now + 0.006);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  osc1.connect(gain1);
  gain1.connect(dest);
  osc1.start(now);
  osc1.stop(now + 0.24);

  // Chime 2: E6 (1318.51 Hz) staggered by 0.065s
  const t2 = now + 0.065;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1318.51 * pitchMultiplier, t2);

  gain2.gain.setValueAtTime(0.001, t2);
  gain2.gain.linearRampToValueAtTime(0.5, t2 + 0.006);
  gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.32);

  osc2.connect(gain2);
  gain2.connect(dest);
  osc2.start(t2);
  osc2.stop(t2 + 0.32);

  scheduleCleanup(ctx, [osc1, gain1, osc2, gain2], duration);
}

/**
 * Mutation SFX: Ethereal chord flourish with gold, giant, and cosmic variations.
 */
export function synthesizeMutation(
  ctx: AudioContext,
  dest: AudioNode,
  mutationType: MutationType = 'gold',
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.95;
  const nodesToClean: { stop?: () => void; disconnect: () => void }[] = [];

  let frequencies: number[] = [];
  let chordType: OscillatorType = 'sine';

  switch (mutationType) {
    case 'giant':
      // Low booming epic chord: C3, G3, C4, E4
      frequencies = [130.81, 196.0, 261.63, 329.63];
      chordType = 'triangle';
      break;

    case 'cosmic':
      // Mystical lydian shimmer: F#5, A#5, C#6, F6
      frequencies = [739.99, 932.33, 1108.73, 1396.91];
      chordType = 'sine';
      break;

    case 'gold':
    default:
      // G-major golden chime flourish: G5, B5, D6, G6
      frequencies = [783.99, 987.77, 1174.66, 1567.98];
      chordType = 'sine';
      break;
  }

  frequencies.forEach((freq, idx) => {
    const noteTime = now + idx * 0.055;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = chordType;
    osc.frequency.setValueAtTime(freq * pitchMultiplier, noteTime);

    gain.gain.setValueAtTime(0.001, noteTime);
    gain.gain.linearRampToValueAtTime(0.32 / (idx * 0.2 + 1), noteTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.65);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(noteTime);
    osc.stop(noteTime + 0.65);

    nodesToClean.push(osc, gain);
  });

  scheduleCleanup(ctx, nodesToClean, duration);
}

/**
 * Weather Change SFX: Sweeping wind whoosh.
 */
export function synthesizeWeatherChange(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 1.25;

  const noise = ctx.createBufferSource();
  noise.buffer = getCachedNoiseBuffer(ctx, 'pink');

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(180 * pitchMultiplier, now);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(50, 1100 * pitchMultiplier),
    now + 0.55
  );
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(50, 220 * pitchMultiplier),
    now + duration
  );
  filter.Q.setValueAtTime(2.2, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.42, now + 0.45);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(now);
  noise.stop(now + duration);

  scheduleCleanup(ctx, [noise, filter, gain], duration);
}

/**
 * Egg Hatch SFX: Cracking pop followed by a cute chirp.
 */
export function synthesizeEggHatch(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.38;

  // 1. Shell crack (high noise burst + fast click)
  const crack = ctx.createBufferSource();
  crack.buffer = getCachedNoiseBuffer(ctx, 'white');
  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = 'highpass';
  crackFilter.frequency.setValueAtTime(1800 * pitchMultiplier, now);

  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0.5, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  crack.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(dest);
  crack.start(now);
  crack.stop(now + 0.05);

  // 2. Cute baby chirp (sine sweep 880Hz -> 1760Hz)
  const chirpTime = now + 0.06;
  const chirp = ctx.createOscillator();
  const chirpGain = ctx.createGain();
  chirp.type = 'sine';
  chirp.frequency.setValueAtTime(880 * pitchMultiplier, chirpTime);
  chirp.frequency.exponentialRampToValueAtTime(1760 * pitchMultiplier, chirpTime + 0.14);

  chirpGain.gain.setValueAtTime(0.001, chirpTime);
  chirpGain.gain.linearRampToValueAtTime(0.4, chirpTime + 0.02);
  chirpGain.gain.exponentialRampToValueAtTime(0.001, chirpTime + 0.22);

  chirp.connect(chirpGain);
  chirpGain.connect(dest);
  chirp.start(chirpTime);
  chirp.stop(chirpTime + 0.22);

  scheduleCleanup(
    ctx,
    [crack, crackFilter, crackGain, chirp, chirpGain],
    duration
  );
}

/**
 * UI Click SFX: Clean mechanical tick.
 */
export function synthesizeUiClick(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.035;

  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = 'triangle';
  click.frequency.setValueAtTime(1800 * pitchMultiplier, now);
  click.frequency.exponentialRampToValueAtTime(
    Math.max(10, 400 * pitchMultiplier),
    now + duration
  );

  clickGain.gain.setValueAtTime(0.35, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  click.connect(clickGain);
  clickGain.connect(dest);
  click.start(now);
  click.stop(now + duration);

  scheduleCleanup(ctx, [click, clickGain], duration);
}

/**
 * Error SFX: Gentle low error thud.
 */
export function synthesizeError(
  ctx: AudioContext,
  dest: AudioNode,
  pitchMultiplier: number = 1.0
): void {
  const now = ctx.currentTime;
  const duration = 0.15;

  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140 * pitchMultiplier, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(10, 65 * pitchMultiplier), now + duration);

  oscGain.gain.setValueAtTime(0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(oscGain);
  oscGain.connect(dest);
  osc.start(now);
  osc.stop(now + duration);

  scheduleCleanup(ctx, [osc, oscGain], duration);
}

/**
 * Weather Ambience Loop Generator:
 * Creates continuous ambient audio loops for Sunny, Heavy Rain, Heatwave, and Blood Moon.
 */
export function createWeatherAmbienceNode(
  ctx: AudioContext,
  dest: AudioNode,
  weather: WeatherType
): AmbienceInstance {
  const now = ctx.currentTime;
  const masterAmbienceGain = ctx.createGain();
  masterAmbienceGain.gain.setValueAtTime(1.0, now);
  masterAmbienceGain.connect(dest);

  const activeNodes: { stop?: () => void; disconnect: () => void }[] = [];
  let isStopped = false;

  switch (weather) {
    case 'heavy_rain': {
      // Continuous Rain: Low-passed pink noise + rumble
      const noise = ctx.createBufferSource();
      noise.buffer = getCachedNoiseBuffer(ctx, 'pink');
      noise.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.setValueAtTime(2600, now);

      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.45, now);

      noise.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(masterAmbienceGain);

      noise.start(now);
      activeNodes.push(noise, rainFilter, rainGain);
      break;
    }

    case 'heatwave': {
      // Shimmering Warm Drone: Detuned warm triangle waves + high subtle shimmer
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(110, now);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(111.4, now);

      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.18, now);

      osc1.connect(droneGain);
      osc2.connect(droneGain);
      droneGain.connect(masterAmbienceGain);

      osc1.start(now);
      osc2.start(now);
      activeNodes.push(osc1, osc2, droneGain);
      break;
    }

    case 'blood_moon': {
      // Eerie Low Resonant Drone: Sub-bass 55Hz + minor second dissonant interval
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now);

      const dissonantOsc = ctx.createOscillator();
      dissonantOsc.type = 'triangle';
      dissonantOsc.frequency.setValueAtTime(116.54, now); // Bb2 (tritone / dissonant tension)

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);

      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.22, now);

      subOsc.connect(filter);
      dissonantOsc.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(masterAmbienceGain);

      subOsc.start(now);
      dissonantOsc.start(now);
      activeNodes.push(subOsc, dissonantOsc, filter, droneGain);
      break;
    }

    case 'sunny':
    default: {
      // Gentle Breeze: Filtered pink noise with soft resonance
      const noise = ctx.createBufferSource();
      noise.buffer = getCachedNoiseBuffer(ctx, 'pink');
      noise.loop = true;

      const breezeFilter = ctx.createBiquadFilter();
      breezeFilter.type = 'bandpass';
      breezeFilter.frequency.setValueAtTime(450, now);
      breezeFilter.Q.setValueAtTime(0.8, now);

      const breezeGain = ctx.createGain();
      breezeGain.gain.setValueAtTime(0.2, now);

      noise.connect(breezeFilter);
      breezeFilter.connect(breezeGain);
      breezeGain.connect(masterAmbienceGain);

      noise.start(now);
      activeNodes.push(noise, breezeFilter, breezeGain);
      break;
    }
  }

  const stop = (fadeDurationSec: number = 0.5) => {
    if (isStopped) return;
    isStopped = true;
    const stopTime = ctx.currentTime;
    try {
      masterAmbienceGain.gain.cancelScheduledValues(stopTime);
      masterAmbienceGain.gain.setValueAtTime(masterAmbienceGain.gain.value, stopTime);
      masterAmbienceGain.gain.linearRampToValueAtTime(0.0001, stopTime + fadeDurationSec);
    } catch {
      // Ignore
    }

    setTimeout(() => {
      try {
        activeNodes.forEach((node) => {
          try {
            if (node.stop) node.stop();
          } catch {
            // Ignore
          }
          try {
            node.disconnect();
          } catch {
            // Ignore
          }
        });
        masterAmbienceGain.disconnect();
      } catch {
        // Ignore
      }
    }, Math.ceil(fadeDurationSec * 1000) + 50);
  };

  return {
    gainNode: masterAmbienceGain,
    stop,
  };
}
