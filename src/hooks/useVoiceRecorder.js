// web-ui/src/hooks/useVoiceRecorder.js
import { useState, useRef, useCallback } from "react"
import { buildWav, to16kPcm, bytesToBase64, VOICE_PROCESSOR_CODE } from "../utils/aiAudio"

const SILENCE_RMS = 0.02
const MAX_SLICE_MS = 2500

export const useVoiceRecorder = ({ onAudioRecorded = () => {} }) => {
    const [recording, setRecording] = useState(false)
    const [micBlocked, setMicBlocked] = useState(false)

    const recordingRef = useRef({})
    const audioChunksRef = useRef([])
    const audioSampleRateRef = useRef(48000)

    const finalizeRecording = useCallback(() => {
        const chunks = audioChunksRef.current
        audioChunksRef.current = []
        if (!chunks || chunks.length === 0) return

        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0)
        if (totalLen === 0) return

        const joined = new Float32Array(totalLen)
        let offset = 0
        for (let i = 0; i < chunks.length; i++) {
            joined.set(chunks[i], offset)
            offset += chunks[i].length
        }

        const sampleRate = audioSampleRateRef.current || 48000
        const pcm = to16kPcm(joined, sampleRate)
        const wav = buildWav(pcm, 16000)
        const b64 = bytesToBase64(wav)
        const durationMs = Math.round((pcm.length / 16000) * 1000)

        if (durationMs >= 200) {
            onAudioRecorded({ base64Wav: b64, durationMs })
        }
    }, [onAudioRecorded])

    const startMic = useCallback(async () => {
        try {
            audioChunksRef.current = []
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            })
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            const ctx = new AudioCtx()
            const source = ctx.createMediaStreamSource(stream)

            const blob = new Blob([VOICE_PROCESSOR_CODE], { type: "application/javascript" })
            const workletUrl = URL.createObjectURL(blob)
            await ctx.audioWorklet.addModule(workletUrl)
            URL.revokeObjectURL(workletUrl)

            const workletNode = new AudioWorkletNode(ctx, "voice-capture-processor", {
                processorOptions: {
                    sampleRate: ctx.sampleRate || 48000,
                    silenceRms: SILENCE_RMS,
                    maxSliceMs: MAX_SLICE_MS,
                },
            })

            workletNode.port.onmessage = e => {
                if (e.data?.type === "audio_slice" && e.data.samples?.length > 0) {
                    audioChunksRef.current.push(e.data.samples)
                    audioSampleRateRef.current = e.data.sampleRate || 48000
                }
            }

            source.connect(workletNode)
            recordingRef.current = { ctx, stream, workletNode }
            setRecording(true)
            setMicBlocked(false)
        } catch (err) {
            console.error("[useVoiceRecorder] Mic error:", err)
            setMicBlocked(true)
        }
    }, [])

    const stopMic = useCallback(() => {
        const rec = recordingRef.current
        if (rec.workletNode) {
            try { rec.workletNode.port.postMessage({ command: "flush" }) } catch (e) {}
            setTimeout(() => {
                if (rec.workletNode) rec.workletNode.disconnect()
                if (rec.stream) rec.stream.getTracks().forEach(t => t.stop())
                if (rec.ctx) rec.ctx.close().catch(() => {})
                recordingRef.current = {}
                setRecording(false)
                finalizeRecording()
            }, 40)
        } else {
            recordingRef.current = {}
            setRecording(false)
            finalizeRecording()
        }
    }, [finalizeRecording])

    return { recording, micBlocked, startMic, stopMic }
}