// web-ui/src/hooks/useAiChat.js
import { useState, useEffect, useRef, useCallback } from "react"
import AI_ACTIONS from "../constants/aiActions.json"
import { resolveAction } from "../utils/aiActionResolver"
import { matchAction } from "../utils/aiActionMatcher"
import { useVoiceRecorder } from "./useVoiceRecorder"

const ACTIONS = AI_ACTIONS.actions
const msgKey = m => `${m.role}|${m.type}|${m.content || m.action_id || ""}`

export const useAiChat = ({ aiMessages = [], aiStatus, publishAi, triggerAction }) => {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState("")
    const lastDirectiveKeyRef = useRef(null)
    const aiOnline = Boolean(aiStatus && aiStatus.state !== "offline" && aiStatus.state !== "error")

    const push = useCallback((role, content, type = "text") => {
        setMessages(prev => [...prev, { role, type, content, ts: Date.now() }])
    }, [])

    const getCleanHistory = useCallback(() => {
        return messages
            .filter(m => (m.role === "user" || m.role === "assistant") && m.type !== "audio" && m.type !== "directive")
            .filter(m => typeof m.content === "string" && !m.content.startsWith("🎤 Voice Query") && m.content.length < 500)
            .slice(-10)
            .map(m => ({ role: m.role, content: m.content }))
    }, [messages])

    // Voice Recorder
    const handleAudioRecorded = useCallback(({ base64Wav, durationMs }) => {
        push("user", `🎤 Voice Query (${durationMs}ms audio)`)
        if (aiOnline) {
            publishAi({ type: "audio", role: "user", content: base64Wav, sample_rate_hz: 16000, history: getCleanHistory() })
        } else {
            push("system", "AI Service Offline: Voice transcription requires live bridge.")
        }
    }, [push, aiOnline, publishAi, getCleanHistory])

    const { recording, micBlocked, startMic, stopMic } = useVoiceRecorder({
        onAudioRecorded: handleAudioRecorded,
    })

    // Directive Listener
    useEffect(() => {
        if (!aiMessages?.length) return
        const last = aiMessages[aiMessages.length - 1]
        if (!last || (last.type !== "directive" && !last.action_id && !last.action && !last.joint_params)) return

        const key = `${aiMessages.length}|${msgKey(last)}`
        if (lastDirectiveKeyRef.current === key) return
        lastDirectiveKeyRef.current = key

        const a = resolveAction(last, ACTIONS)
        if (a) triggerAction(a, last.joint_params)
    }, [aiMessages, triggerAction])

    // Incoming Message Sync
    useEffect(() => {
        if (!aiMessages?.length) return
        setMessages(prev => {
            const seen = new Set(prev.map(msgKey))
            const added = aiMessages
                .filter(m => m.type !== "audio" && m.type !== "directive" && typeof m.content === "string" && m.content.length < 1000)
                .filter(m => !seen.has(msgKey(m)))
            return added.length ? [...prev, ...added] : prev
        })
    }, [aiMessages])

    const handleSend = useCallback(() => {
        const text = input.trim()
        if (!text) return
        push("user", text, "text")
        setInput("")

        if (aiOnline) {
            publishAi({ type: "text", role: "user", content: text, history: getCleanHistory() })
            return
        }

        const action = matchAction(text, ACTIONS)
        if (action) {
            triggerAction(action)
            push("assistant", action.reply || `Triggered action: ${action.name}`)
        } else {
            push("system", "AI Service Offline: Direct keyword not recognized.")
        }
    }, [input, aiOnline, publishAi, push, triggerAction, getCleanHistory])

    const handleExecuteAction = useCallback(action => {
        triggerAction(action)
        push("assistant", action.reply || `Triggered action: ${action.name}`)
    }, [triggerAction, push])

    return {
        messages,
        setMessages,
        input,
        setInput,
        handleSend,
        handleExecuteAction,
        recording,
        micBlocked,
        startMic,
        stopMic,
        aiOnline,
        ACTIONS,
    }
}