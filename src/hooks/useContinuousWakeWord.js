// web-ui/src/hooks/useContinuousWakeWord.js
import { useState, useEffect, useRef, useCallback } from "react"

// Strict wake-word regex: matches "hey spider <command>" or "hey hexapod <command>"
const WAKE_WORD_REGEX = /^(?:hey|ok|okay|hi)\s+(?:spider|hexapod)\b[\s,.:;]*(.+)$/i

// Standalone wake word (e.g. user just said "hey spider" without trailing command)
const STANDALONE_WAKE_REGEX = /^(?:hey|ok|okay|hi)\s+(?:spider|hexapod)[\s,.:;?!]*$/i

export const useContinuousWakeWord = ({
    onCommand = () => {},
    minConfidence = 0.45,
    enabled = true,
}) => {
    const [isListening, setIsListening] = useState(false)
    const [wakeWordState, setWakeWordState] = useState("idle") // "idle" | "listening_prompt" | "recognized" | "ignored"
    const [lastTranscript, setLastTranscript] = useState("")
    const [lastAcceptedCommand, setLastAcceptedCommand] = useState("")
    const [micError, setMicError] = useState(null)

    const recognitionRef = useRef(null)
    const isMountedRef = useRef(true)
    const onCommandRef = useRef(onCommand)
    onCommandRef.current = onCommand

    const processUtterance = useCallback((rawTranscript, confidence) => {
        const trimmed = rawTranscript.trim()
        setLastTranscript(trimmed)

        // 1. Mumble & Confidence filter: Discard low-confidence or overly brief artifacts
        if (confidence > 0 && confidence < minConfidence) {
            setWakeWordState("ignored")
            return
        }

        // 2. Standalone wake word greeting ("Hey Spider")
        if (STANDALONE_WAKE_REGEX.test(trimmed)) {
            setWakeWordState("listening_prompt")
            return
        }

        // 3. Strict Wake Word + Directive sentence ("Hey Spider, walk forward")
        const match = trimmed.match(WAKE_WORD_REGEX)
        if (match && match[1]) {
            const extractedCommand = match[1].trim()
            // Ensure the command is not just mumbling or single meaningless characters
            if (extractedCommand.length >= 2) {
                setWakeWordState("recognized")
                setLastAcceptedCommand(extractedCommand)
                onCommandRef.current(extractedCommand, trimmed)
                return
            }
        }

        // 4. Background chatter or speech not addressed to the hexapod
        setWakeWordState("ignored")
    }, [minConfidence])

    useEffect(() => {
        isMountedRef.current = true
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

        if (!SpeechRecognition) {
            setMicError("Speech recognition is not supported in this browser. Please use Chrome or Edge.")
            return undefined
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang = "en-US"
        recognition.maxAlternatives = 1
        recognitionRef.current = recognition

        recognition.onstart = () => {
            if (isMountedRef.current) {
                setIsListening(true)
                setMicError(null)
            }
        }

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript
                    const confidence = event.results[i][0].confidence || 1.0
                    processUtterance(transcript, confidence)
                }
            }
        }

        recognition.onerror = (event) => {
            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                setMicError("Microphone permission denied. Enable microphone access to use 24/7 voice.")
                setIsListening(false)
            }
        }

        // Resilient auto-restart loop for 24/7 continuous listening
        recognition.onend = () => {
            if (isMountedRef.current && enabled) {
                try {
                    recognition.start()
                } catch (e) {
                    // Ignore restart race errors
                }
            } else if (isMountedRef.current) {
                setIsListening(false)
            }
        }

        if (enabled) {
            try {
                recognition.start()
            } catch (e) {
                console.warn("[WakeWord] Error starting recognition:", e)
            }
        }

        return () => {
            isMountedRef.current = false
            try {
                recognition.stop()
            } catch (e) {}
        }
    }, [enabled, processUtterance])

    return {
        isListening,
        wakeWordState,
        lastTranscript,
        lastAcceptedCommand,
        micError,
    }
}