// web-ui/src/utils/aiAudio.js
// Pure helpers for the P5 voice panel (browser mic -> 16kHz mono 16-bit WAV base64).
// Kept side-effect free so they can be unit-tested without getUserMedia/AudioContext.

/**
 * Downsample + convert a Float32 mono buffer (as delivered by AudioContext,
 * typically 48kHz) to 16-bit signed PCM at 16kHz.
 *
 * @param {Float32Array} samples - mono audio in (-1..1), source sample rate `srcRate`
 * @param {number} srcRate - source sample rate (e.g. 48000)
 * @returns {Int16Array} 16kHz PCM samples
 */
export const to16kPcm = (samples, srcRate) => {
    const targetRate = 16000
    const step = srcRate / targetRate // 48000/16000 = 3 (exact integer on standard hardware)
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
 * @param {number} sampleRate - samples/second (16000 for the STT leg)
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
    view.setUint32(16, 16, true) // PCM fmt chunk size
    view.setUint16(20, 1, true)  // audio format = PCM
    view.setUint16(22, 1, true)  // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true)  // block align
    view.setUint16(34, 16, true) // bits per sample
    writeString(36, "data")
    view.setUint32(40, dataSize, true)

    const offset = 44
    for (let i = 0; i < numSamples; i++) {
        view.setInt16(offset + i * 2, pcm[i], true)
    }
    return new Uint8Array(buffer)
}

/**
 * Base64-encode bytes (chunked to avoid call-stack limits on large slices).
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