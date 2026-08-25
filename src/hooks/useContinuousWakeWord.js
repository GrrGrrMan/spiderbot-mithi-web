// web-ui/src/hooks/useContinuousWakeWord.js
import { useState, useEffect, useRef, useCallback } from "react"
import { to16kPcm, buildWav, bytesToBase64 } from "../utils/aiAudio"

export const useContinuousWakeWord = ({
    publishAi = () => {},
    aiOnline = false,
    audioStatus = null,
    isMuted = false,
    enabled = true,
}) => {
    const [isListening, setIsListening] = useState(false)
    const [wakeWordState, setWakeWordState] = useState("idle")
    const [lastTranscript, setLastTranscript] = useState("")
    const [lastAcceptedCommand, setLastAcceptedCommand] = useState("")
    const [micError, setMicError] = useState(null)

    const isMountedRef = useRef(true)
    const myVadRef = useRef(null)
    const isInitializingRef = useRef(false)

    // Keep dynamic prop references up-to-date across re-renders
    const isMutedRef = useRef(isMuted)
    isMutedRef.current = isMuted
    const audioStatusRef = useRef(audioStatus)
    audioStatusRef.current = audioStatus

    const publishAiRef = useRef(publishAi)
    publishAiRef.current = publishAi
    const aiOnlineRef = useRef(aiOnline)
    aiOnlineRef.current = aiOnline
    const enabledRef = useRef(enabled)
    enabledRef.current = enabled

    // Receive authoritative wake-word & intent states broadcasted from the Pi-Hub
    const handleSentinelEvent = useCallback((eventMsg) => {
        if (!eventMsg) return
        setWakeWordState(eventMsg.state || "idle")
        if (eventMsg.transcript) setLastTranscript(eventMsg.transcript)
        if (eventMsg.command) setLastAcceptedCommand(eventMsg.command)
    }, [])

    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            if (myVadRef.current) {
                myVadRef.current.destroy()
                myVadRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        const initVAD = async () => {
            if (isInitializingRef.current || myVadRef.current) return
            isInitializingRef.current = true

            if (!window.vad) {
                await new Promise((resolve) => setTimeout(resolve, 500))
            }
            if (!window.vad) {
                if (isMountedRef.current) setMicError("AI Voice engine failed to load from CDN. Check network.")
                isInitializingRef.current = false
                return
            }

            try {
                const myvad = await window.vad.MicVAD.new({
                    baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/",
                    onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
                    positiveSpeechThreshold: 0.65,
                    minSpeechFrames: 4,
                    preSpeechPadFrames: 5,

                    onSpeechEnd: (audio) => {
                        const isEspPlaying = audioStatusRef.current && audioStatusRef.current.state === "playing"
                        if (isMutedRef.current || isEspPlaying) {
                            return
                        }

                        // Convert 16kHz audio slice to Base64 WAV
                        const pcm = to16kPcm(audio, 16000)
                        const wav = buildWav(pcm, 16000)
                        const b64 = bytesToBase64(wav)

                        if (aiOnlineRef.current) {
                            publishAiRef.current({
                                type: "audio",
                                role: "user",
                                content: b64,
                                sample_rate_hz: 16000,
                                is_sentinel: true,
                            })
                        }
                    },
                })

                myVadRef.current = myvad
                isInitializingRef.current = false

                if (enabledRef.current && isMountedRef.current) {
                    myvad.start()
                    setIsListening(true)
                    setMicError(null)
                } else {
                    // Safe teardown if disabled or unmounted during async compilation
                    try { myvad.pause() } catch (_) {}
                    if (!isMountedRef.current) {
                        try { myvad.destroy() } catch (_) {}
                        myVadRef.current = null
                    }
                }
            } catch (err) {
                console.error("[Silero VAD] Init error:", err)
                isInitializingRef.current = false
                if (isMountedRef.current) {
                    setMicError("AI Microphone failed to initialize.")
                    setIsListening(false)
                }
            }
        }

        if (enabled) {
            if (!myVadRef.current) {
                initVAD()
            } else {
                myVadRef.current.start()
                setIsListening(true)
            }
        } else {
            if (myVadRef.current) {
                myVadRef.current.pause()
                setIsListening(false)
            }
        }
    }, [enabled])

    return {
        isListening,
        wakeWordState,
        lastTranscript,
        lastAcceptedCommand,
        micError,
        handleSentinelEvent,
    }
}