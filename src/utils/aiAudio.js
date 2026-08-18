// web-ui/src/utils/aiAudio.js
// Pure helpers for the P5 voice panel (browser mic -> 16kHz mono 16-bit WAV base64).
// Kept side-effect free so they can be unit-tested without getUserMedia/AudioContext.

export const VOICE_PROCESSOR_CODE = `
class VoiceCaptureProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const opts = (options && options.processorOptions) || {};
        this.sampleRate = opts.sampleRate || 48000;
        this.silenceRms = opts.silenceRms || 0.02;
        this.silentBlocksForEnd = opts.silentBlocksForEnd || 30;
        this.maxSliceSamples = opts.maxSliceMs
            ? Math.floor((opts.maxSliceMs * this.sampleRate) / 1000)
            : Math.floor(2.5 * this.sampleRate);
        this.buffer = [];
        this.silentBlocks = 0;
        this.totalSamples = 0;
        this.port.onmessage = (e) => {
            if (e.data && e.data.command === "flush") {
                this.flush(true);
            }
        };
    }
    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0] || input[0].length === 0) return true;
        const channelData = input[0];
        const len = channelData.length;
        const copy = new Float32Array(len);
        copy.set(channelData);
        this.buffer.push(copy);
        this.totalSamples += len;
        let sum = 0;
        for (let i = 0; i < len; i++) sum += channelData[i] * channelData[i];
        const rms = Math.sqrt(sum / len);
        if (rms < this.silenceRms) {
            this.silentBlocks++;
        } else {
            this.silentBlocks = 0;
        }
        const hasMinSpeech = this.totalSamples >= (0.4 * this.sampleRate);
        const silenceDetected = this.silentBlocks >= this.silentBlocksForEnd && hasMinSpeech;
        const maxDurationExceeded = this.totalSamples >= this.maxSliceSamples;
        if (silenceDetected || maxDurationExceeded) {
            this.flush(false);
        }
        return true;
    }
    flush(forced) {
        if (this.totalSamples === 0) return;
        const joined = new Float32Array(this.totalSamples);
        let offset = 0;
        for (let i = 0; i < this.buffer.length; i++) {
            joined.set(this.buffer[i], offset);
            offset += this.buffer[i].length;
        }
        this.port.postMessage({
            type: "audio_slice",
            samples: joined,
            sampleRate: this.sampleRate,
            forced: forced
        });
        this.buffer = [];
        this.totalSamples = 0;
        this.silentBlocks = 0;
    }
}
registerProcessor("voice-capture-processor", VoiceCaptureProcessor);
`;

/**
 * Downsample + convert a Float32 mono buffer to 16-bit signed PCM at 16kHz.
 *
 * @param {Float32Array} samples - mono audio in (-1..1)
 * @param {number} srcRate - source sample rate (e.g. 48000)
 * @returns {Int16Array} 16kHz PCM samples
 */
export const to16kPcm = (samples, srcRate) => {
    const targetRate = 16000
    const step = srcRate / targetRate
    const outLen = Math.floor(samples.length / step)
    const out = new Int16Array(outLen)
    for (let i = 0; i < outLen; i++) {
        const idx = Math.min(samples.length - 1, Math.floor(i * step))
        const s = samples[idx] * 32767
        out[i] = s > 32767 ? 32767 : s < -32768 ? -32768 : Math.round(s)
    }
    return out
}

/**
 * Build a 16-bit mono WAV file (44-byte PCM header) from PCM samples.
 * @param {Int16Array} pcm - 16-bit signed PCM samples
 * @param {number} sampleRate - samples/second (16000)
 * @returns {Uint8Array} complete WAV bytes
 */
export const buildWav = (pcm, sampleRate) => {
    const numSamples = pcm.length
    const dataSize = numSamples * 2
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i))
        }
    }

    writeString(0, "RIFF")
    view.setUint32(4, 36 + dataSize, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, "data")
    view.setUint32(40, dataSize, true)

    const offset = 44
    for (let i = 0; i < numSamples; i++) {
        view.setInt16(offset + i * 2, pcm[i], true)
    }
    return new Uint8Array(buffer)
}

/**
 * Base64-encode bytes.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export const bytesToBase64 = bytes => {
    let binary = ""
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
    }
    return btoa(binary)
}

/**
 * Root-mean-square of a Float32 mono block (audio level detection).
 * @param {Float32Array} frames
 * @returns {number} 0..1
 */
export const blockRms = frames => {
    if (!frames || !frames.length) return 0
    let sum = 0
    for (let i = 0; i < frames.length; i++) {
        sum += frames[i] * frames[i]
    }
    return Math.sqrt(sum / frames.length)
}