/**
 * Web Audio API synthesizer for realistic mobile ringtones and alarm sounds,
 * with fallback to custom audio playback.
 */

let audioCtx: AudioContext | null = null;
let currentLoopTimer: number | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let isSoundPlaying = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtxClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const PRESET_SOUNDS = [
  { id: 'chime', name: '🔔 デフォルト着信音 (端末)' },
  { id: 'alarm', name: '⏰ システムアラーム (端末)' },
  { id: 'ping', name: '🎵 デフォルト通知音 (端末)' },
  { id: 'fanfare', name: '🎺 ファンファーレ' },
  { id: 'relax', name: '🌿 リラックスベル' },
] as const;

export type PresetSoundId = typeof PRESET_SOUNDS[number]['id'];

/**
 * Plays a single synthesis pattern based on preset sound
 */
function playSynthPattern(ctx: AudioContext, soundName: string) {
  const now = ctx.currentTime;

  if (soundName.includes('システムアラーム') || soundName === 'alarm') {
    // Twin bell ringing alarm pattern (rapid alternating frequencies)
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 988, now + i * 0.08);

      gain.gain.setValueAtTime(0.3, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.08);
    }
  } else if (soundName.includes('デフォルト通知音') || soundName === 'ping') {
    // Two-tone bright notification ping
    const freqs = [659.25, 880]; // E5 -> A5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.4, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.36);
    });
  } else if (soundName.includes('ファンファーレ') || soundName === 'fanfare') {
    // Ascending melody
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.35, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + (idx === 3 ? 0.6 : 0.2));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + (idx === 3 ? 0.65 : 0.22));
    });
  } else if (soundName.includes('リラックス') || soundName === 'relax') {
    // Warm Tibetan bowl / marimba harmonics
    const notes = [440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.2);

      gain.gain.setValueAtTime(0.3, now + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.2 + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.2);
      osc.stop(now + idx * 0.2 + 0.95);
    });
  } else {
    // Default chime: pleasant triple harmonic chime (🔔 デフォルト着信音)
    const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      gain.gain.setValueAtTime(0.35, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.75);
    });
  }
}

/**
 * Starts playing an alarm sound (repeated loop)
 * @param soundName Name of the preset or identifier
 * @param customUrl Optional custom audio URL (data URI or object URL)
 * @param duration Duration in seconds (0 = infinite until stopped)
 */
export const playAlarmSound = (
  soundName: string,
  customUrl?: string,
  duration = 5
) => {
  stopAlarmSound();
  isSoundPlaying = true;

  if (customUrl) {
    try {
      const audio = new Audio(customUrl);
      audio.loop = duration === 0 || duration > 3;
      audio.play().catch((err) => console.warn('Custom audio playback failed:', err));
      currentAudioElement = audio;

      if (duration > 0) {
        setTimeout(() => {
          stopAlarmSound();
        }, duration * 1000);
      }
      return;
    } catch (e) {
      console.warn('Failed to play custom audio, falling back to synth', e);
    }
  }

  // Synthesized Web Audio
  try {
    const ctx = getAudioContext();
    playSynthPattern(ctx, soundName);

    // Loop interval based on sound type
    const loopInterval = soundName.includes('システムアラーム') ? 1200 : 1600;

    currentLoopTimer = window.setInterval(() => {
      if (!isSoundPlaying) {
        if (currentLoopTimer) clearInterval(currentLoopTimer);
        return;
      }
      playSynthPattern(ctx, soundName);
    }, loopInterval);

    if (duration > 0) {
      setTimeout(() => {
        stopAlarmSound();
      }, duration * 1000);
    }
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
};

/**
 * Play a single preview sound without looping
 */
export const previewSound = (soundName: string, customUrl?: string) => {
  stopAlarmSound();
  if (customUrl) {
    try {
      const audio = new Audio(customUrl);
      audio.play().catch((err) => console.warn('Preview failed:', err));
      currentAudioElement = audio;
      setTimeout(() => {
        stopAlarmSound();
      }, 3000);
      return;
    } catch {
      // fallback
    }
  }

  try {
    const ctx = getAudioContext();
    playSynthPattern(ctx, soundName);
  } catch (err) {
    console.warn('Sound preview error:', err);
  }
};

export const stopAlarmSound = () => {
  isSoundPlaying = false;
  if (currentLoopTimer !== null) {
    clearInterval(currentLoopTimer);
    currentLoopTimer = null;
  }
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {}
    currentAudioElement = null;
  }
};
