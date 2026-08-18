// web-ui/public/audio-processor.js
// AudioWorkletProcessor running on the dedicated Web Audio rendering thread.
// Collects 128-sample blocks, computes block RMS for silence/VAD,
// and streams assembled audio slices to the main thread via MessagePort.

class VoiceCaptureProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super()
        const opts = (options && options.processorOptions) || {}
        this.sampleRate = opts.sampleRate || 48000
        this.silenceRms = opts.silenceRms || 0.02
        this.silentBlocksForEnd = opts.silentBlocksForEnd || 30 // ~0.8s of silence @ 128 blocks
        this.maxSliceSamples = opts.maxSliceMs
            ? Math.floor((opts.maxSliceMs * this.sampleRate) / 1000)
            : Math.floor(2.5 * this.sampleRate) // 2.5s maximum slice

        this.buffer = []
        this.silentBlocks = 0
        this.totalSamples = 0

        this.port.onmessage = (e) => {
            if (e.data && e.data.command === "flush") {
                this.flush(true)
            }
        }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]
        if (!input || !input[0] || input[0].length === 0) {
            return true
        }

        const channelData = input[0]
        const len = channelData.length

        // Clone incoming 128-sample block
        const copy = new Float32Array(len)
        copy.set(channelData)
        this.buffer.push(copy)
        this.totalSamples += len

        // Compute Root-Mean-Square (RMS) for silence / VAD detection
        let sum = 0
        for (let i = 0; i < len; i++) {
            sum += channelData[i] * channelData[i]
        }
        const rms = Math.sqrt(sum / len)

        if (rms < this.silenceRms) {
            this.silentBlocks++
        } else {
            this.silentBlocks = 0
        }

        const hasMinSpeech = this.totalSamples >= (0.4 * this.sampleRate)
        const silenceDetected = this.silentBlocks >= this.silentBlocksForEnd && hasMinSpeech
        const maxDurationExceeded = this.totalSamples >= this.maxSliceSamples

        if (silenceDetected || maxDurationExceeded) {
            this.flush(false)
        }

        return true
    }

    flush(forced) {
        if (this.totalSamples === 0) return

        const joined = new Float32Array(this.totalSamples)
        let offset = 0
        for (let i = 0; i < this.buffer.length; i++) {
            joined.set(this.buffer[i], offset)
            offset += this.buffer[i].length
        }

        this.port.postMessage({
            type: "audio_slice",
            samples: joined,
            sampleRate: this.sampleRate,
            forced: forced
        })

        this.buffer = []
        this.totalSamples = 0
        this.silentBlocks = 0
    }
}

registerProcessor("voice-capture-processor", VoiceCaptureProcessor)