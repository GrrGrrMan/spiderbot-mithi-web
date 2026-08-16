import { buildWav, to16kPcm, bytesToBase64, blockRms } from "../../utils/aiAudio"

describe("aiAudio", () => {
    test("to16kPcm downsamples 48kHz Float32 to 16kHz Int16", () => {
        const rate = 48000
        const samples = new Float32Array(4800).fill(0.5) // 0.1s @ 48k
        const pcm = to16kPcm(samples, rate)
        expect(pcm).toHaveLength(1600) // 4800/3
        expect(pcm[0]).toBe(16384) // 0.5 * 32767 ≈ 16384
    })

    test("to16kPcm passes through at 16kHz (step 1)", () => {
        const samples = new Float32Array(100).fill(-0.5)
        const pcm = to16kPcm(samples, 16000)
        expect(pcm).toHaveLength(100)
        expect(pcm[0]).toBe(Math.round(-0.5 * 32767)) // JS rounds halves toward +∞ → -16383
    })

    test("buildWav produces a valid 44-byte PCM header", () => {
        const pcm = new Int16Array([1, 2, 3])
        const wav = buildWav(pcm, 16000)
        expect(wav).toHaveLength(44 + 6)
        const str = (start, len) =>
            String.fromCharCode.apply(null, wav.subarray(start, start + len))
        expect(str(0, 4)).toBe("RIFF")
        expect(str(8, 4)).toBe("WAVE")
        expect(str(36, 4)).toBe("data")
        const view = new DataView(wav.buffer)
        expect(view.getUint16(22, true)).toBe(1) // mono
        expect(view.getUint32(24, true)).toBe(16000)
        expect(view.getUint16(34, true)).toBe(16) // bits
        expect(view.getUint32(40, true)).toBe(6) // data size
    })

    test("bytesToBase64 round-trips", () => {
        const bytes = new Uint8Array([77, 97, 110]) // "Man"
        expect(bytesToBase64(bytes)).toBe("TWFu")
        const big = new Uint8Array(70000).fill(3)
        const b64 = bytesToBase64(big)
        expect(b64.length).toBe(Math.ceil(70000 / 3) * 4)
    })

    test("blockRms measures audio level", () => {
        expect(blockRms(new Float32Array([0, 0, 0]))).toBe(0)
        expect(blockRms(new Float32Array([1, 1, 1, 1]))).toBeCloseTo(1, 5)
        expect(blockRms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5, 5)
    })
})