// web-ui/src/hooks/useContinuousWakeWord.js
import { useState, useEffect, useRef, useCallback } from "react"
import { to16kPcm, buildWav, bytesToBase64 } from "../utils/aiAudio"

const WAKE_WORD_REGEX = /^(?:hey|ok|okay|hi|hello)[\s,.:;!?-]+(?:spider|hexapod)\b[\s,.:;!?-]*(.+)$/i
const STANDALONE_WAKE_REGEX = /^(?:hey|ok|okay|hi|hello)[\s,.:;!?-]+(?:spider|hexapod)[\s,.:;!?-]*$/i

export const useContinuousWakeWord = ({
    onCommand = () => {},
    publishAi = () => {},
    aiOnline = false,
    audioStatus = null,
    isMuted = false,
    enabled = true,
    listenTimeoutMs = 6000,
}) => {
    const [isListening, setIsListening] = useState(false)
    const [wakeWordState, setWakeWordState] = useState("idle")
    const [lastTranscript, setLastTranscript] = useState("")
    const [lastAcceptedCommand, setLastAcceptedCommand] = useState("")
    const [micError, setMicError] = useState(null)

    const isMountedRef = useRef(true)
    const myVadRef = useRef(null)
    const isPromptActiveRef = useRef(false)
    const promptTimerRef = useRef(null)

    // Keep dynamic prop references up-to-date across re-renders
    const isMutedRef = useRef(isMuted)
    isMutedRef.current = isMuted
    const audioStatusRef = useRef(audioStatus)
    audioStatusRef.current = audioStatus

    const onCommandRef = useRef(onCommand)
    onCommandRef.current = onCommand
    const publishAiRef = useRef(publishAi)
    publishAiRef.current = publishAi
    const aiOnlineRef = useRef(aiOnline)
    aiOnlineRef.current = aiOnline
    const enabledRef = useRef(enabled)
    enabledRef.current = enabled

    const clearPromptTimer = () => {
        if (promptTimerRef.current) {
            clearTimeout(promptTimerRef.current)
            promptTimerRef.current = null
        }
        isPromptActiveRef.current = false
    }

    const openListeningWindow = useCallback(() => {
        clearPromptTimer()
        isPromptActiveRef.current = true
        setWakeWordState("listening_prompt")
        promptTimerRef.current = setTimeout(() => {
            isPromptActiveRef.current = false
            setWakeWordState("idle")
        }, listenTimeoutMs)
    }, [listenTimeoutMs])

    const filterAndDispatch = useCallback((rawTranscript) => {
        if (!rawTranscript) return false

        // Strip microphone emojis, wrapping quotes, and punctuation
        let trimmed = rawTranscript.trim()
        trimmed = trimmed.replace(/^🎤\s*["']?|["']?$/g, "").replace(/^[^a-zA-Z0-9]+/, "").trim()
        if (!trimmed) return false

        setLastTranscript(trimmed)

        // 1. Standalone Wake Word ("Hey Spider")
        if (STANDALONE_WAKE_REGEX.test(trimmed)) {
            openListeningWindow()
            return true
        }

        // 2. Wake Word + Directive Command ("Hey Spider, walk forward")
        const match = trimmed.match(WAKE_WORD_REGEX)
        if (match && match[1]) {
            const extractedCommand = match[1].trim()
            if (extractedCommand.length >= 2) {
                clearPromptTimer()
                setWakeWordState("recognized")
                setLastAcceptedCommand(extractedCommand)
                onCommandRef.current(extractedCommand, trimmed)
                return true
            }
        }

        // 3. Command inside active listening prompt window
        if (isPromptActiveRef.current) {
            clearPromptTimer()
            setWakeWordState("recognized")
            setLastAcceptedCommand(trimmed)
            onCommandRef.current(trimmed, trimmed)
            return true
        }

        // 4. Dropped ambient chatter / unrelated conversation
        setWakeWordState("ignored")
        return false
    }, [openListeningWindow])

    useEffect(() => {
        isMountedRef.current = true

        const initVAD = async () => {
            if (!window.vad) {
                await new Promise((resolve) => setTimeout(resolve, 500))
            }
            if (!window.vad) {
                setMicError("AI Voice engine failed to load from CDN. Check network.")
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

                if (enabledRef.current && isMountedRef.current) {
                    myvad.start()
                    setIsListening(true)
                    setMicError(null)
                }
            } catch (err) {
                console.error("[Silero VAD] Init error:", err)
                if (isMountedRef.current) {
                    setMicError("AI Microphone failed to initialize.")
                    setIsListening(false)
                }
            }
        }

        initVAD()

        return () => {
            isMountedRef.current = false
            clearPromptTimer()
            if (myVadRef.current) {
                myVadRef.current.destroy()
                myVadRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!myVadRef.current) return
        if (enabled) {
            myVadRef.current.start()
            setIsListening(true)
        } else {
            myVadRef.current.pause()
            setIsListening(false)
        }
    }, [enabled])

    return {
        isListening,
        wakeWordState,
        lastTranscript,
        lastAcceptedCommand,
        micError,
        filterAndDispatch,
    }
}