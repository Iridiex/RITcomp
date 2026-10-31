const RATE = 16000;

function encodeWav(samples, rate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, i) => {
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    });
    return new Blob([buffer], { type: 'audio/wav' });
}

// Browsers record in different formats (webm, mp4); Gemini reliably takes 16 kHz mono WAV
export async function toWav(recording) {
    const context = new AudioContext();
    try {
        const decoded = await context.decodeAudioData(await recording.arrayBuffer());
        const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
        const source = offline.createBufferSource();
        source.buffer = decoded;
        source.connect(offline.destination);
        source.start();
        const rendered = await offline.startRendering();
        return encodeWav(rendered.getChannelData(0), RATE);
    } finally {
        context.close();
    }
}

export const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
