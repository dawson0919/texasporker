let audioContext: AudioContext | null = null;

function getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol: number = 0.3, delay: number = 0) {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + dur);
}

function noise(dur: number, vol: number = 0.1, highpass: number = 2000) {
    const ctx = getCtx();
    if (!ctx) return;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpass, ctx.currentTime);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
}

export const GameSounds = {
    deal() {
        noise(0.08, 0.15);
        tone(800, 0.05, 'square', 0.04);
    },

    check() {
        tone(300, 0.1, 'sine', 0.15);
        tone(200, 0.08, 'sine', 0.08, 0.05);
    },

    call() {
        tone(600, 0.12, 'triangle', 0.18);
        noise(0.06, 0.08);
    },

    raise() {
        tone(500, 0.1, 'triangle', 0.18);
        tone(700, 0.1, 'triangle', 0.18, 0.08);
        tone(900, 0.12, 'triangle', 0.12, 0.16);
        noise(0.05, 0.08);
    },

    fold() {
        tone(400, 0.15, 'sine', 0.08);
        tone(250, 0.2, 'sine', 0.06, 0.05);
    },

    allIn() {
        tone(400, 0.15, 'sawtooth', 0.08);
        tone(600, 0.15, 'sawtooth', 0.1, 0.1);
        tone(800, 0.2, 'sawtooth', 0.12, 0.2);
        tone(1000, 0.3, 'sawtooth', 0.08, 0.3);
        noise(0.15, 0.1);
    },

    win() {
        tone(523, 0.4, 'sine', 0.18);
        tone(659, 0.4, 'sine', 0.14, 0.1);
        tone(784, 0.5, 'sine', 0.18, 0.2);
        tone(1047, 0.6, 'sine', 0.14, 0.35);
    },

    cardFlip() {
        noise(0.04, 0.12);
        tone(1200, 0.03, 'square', 0.03);
    },

    newStage() {
        tone(880, 0.2, 'sine', 0.1);
        tone(1100, 0.15, 'sine', 0.07, 0.1);
    },

    yourTurn() {
        tone(880, 0.15, 'sine', 0.18);
        tone(1100, 0.2, 'sine', 0.14, 0.15);
    },

    blind() {
        tone(500, 0.08, 'triangle', 0.1);
        noise(0.04, 0.05);
    },
};
