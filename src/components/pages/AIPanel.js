// web-ui/src/components/pages/AIPanel.js
import React, { useState, useEffect, useRef, useCallback } from "react"
import AI_ACTIONS from "../../constants/aiActions.json"
import { SECTION_NAMES } from "../vars"
import { matchAction } from "../../utils/aiActionMatcher"
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder"
import { useAiMotionExecutor } from "../../hooks/useAiMotionExecutor"
import { AiStatusBar } from "../ai/AiStatusBar"
import { AiChatTerminal } from "../ai/AiChatTerminal"
import { AiInputControls } from "../ai/AiInputControls"
import { AiActionGrid } from "../ai/AiActionGrid"

const ACTIONS = AI_ACTIONS.actions
const msgKey = m => `${m.role}|${m.type}|${m.content || m.action_id || ""}`

const AIPanel = ({
    publishImmediate = () => {},
    publishAi = () => {},
    publishAudio = () => {},
    aiMessages = [],
    aiStatus = null,
    audioStatus = null,
    isConnected = false,
    onMount = () => {},
    aiDeviceId = "hexapod-s3-01",
    clearAiMessages = () => {},
    params = {},
    onUpdate = () => {},
}) => {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState("")
    const lastDirectiveKeyRef = useRef(null)

    const aiOnline = Boolean(aiStatus && aiStatus.state !== "offline" && aiStatus.state !== "error")

    // 1. Motion & Kinematics Executor
    const { activeExecutingAction, triggerAction, stopAll } = useAiMotionExecutor({
        params,
        publishImmediate,
        publishAudio,
        onUpdate,
    })

    const push = useCallback((role, content, type = "text") => {
        setMessages(prev => [...prev, { role, type, content, ts: Date.now() }])
    }, [])

    const getCleanHistory = useCallback(() => {
        return messages
            .filter(m => (m.role === "user" || m.role === "assistant") && m.type !== "audio" && m.type !== "directive")
            .filter(m => typeof m.content === "string" && !m.content.startsWith("UklGR") && !m.content.startsWith("🎤 Voice Query") && m.content.length < 500)
            .slice(-10)
            .map(m => ({ role: m.role, content: m.content }))
    }, [messages])

    // 2. Voice Recorder Hook
    const handleAudioRecorded = useCallback(
        ({ base64Wav, durationMs }) => {
            push("user", `🎤 Voice Query (${durationMs}ms audio)`)
            if (aiOnline) {
                publishAi({
                    type: "audio",
                    role: "user",
                    content: base64Wav,
                    sample_rate_hz: 16000,
                    history: getCleanHistory(),
                })
            } else {
                push("system", "AI Service Offline: Voice transcription requires the live bridge.")
            }
        },
        [push, aiOnline, publishAi, getCleanHistory]
    )

    const { recording, micBlocked, startMic, stopMic } = useVoiceRecorder({
        onAudioRecorded: handleAudioRecorded,
    })

    // Helper: Action Resolver for Directives & Aliases
    const resolveAction = useCallback((msg, actionsList) => {
        if (!msg) return null
        if (msg.action_id === "single_joint" || msg.action === "single_joint" || msg.joint_params) {
            return { id: "single_joint", joint_params: msg.joint_params }
        }

        const actionId = msg.action_id || msg.action || (msg.type === "directive" ? msg.preset : null)
        if (!actionId) return null

        const rawStr = String(actionId).trim()
        let found = actionsList.find(x => x.id.toLowerCase() === rawStr.toLowerCase())
        if (found) return found

        found = actionsList.find(x => x.payload?.preset?.toLowerCase() === rawStr.toLowerCase())
        if (found) return found

        found = actionsList.find(x => x.name.toLowerCase() === rawStr.toLowerCase())
        if (found) return found

        const normalized = rawStr.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").toLowerCase()
        found = actionsList.find(x => {
            if (x.id.replace(/[_-]/g, " ").toLowerCase() === normalized) return true
            if (x.name.toLowerCase() === normalized) return true
            if (Array.isArray(x.keywords) && x.keywords.some(kw => kw.toLowerCase() === normalized || normalized.includes(kw.toLowerCase()))) {
                return true
            }
            return false
        })
        if (found) return found

        return matchAction(rawStr, actionsList)
    }, [])

    // 3. Directive Listener (Pi-Hub orchestration)
    useEffect(() => {
        if (!aiMessages || !aiMessages.length) return
        const last = aiMessages[aiMessages.length - 1]
        if (!last || (last.type !== "directive" && !last.action_id && !last.action && !last.joint_params)) {
            return
        }

        const key = `${aiMessages.length}|${msgKey(last)}`
        if (lastDirectiveKeyRef.current === key) return
        lastDirectiveKeyRef.current = key

        const a = resolveAction(last, ACTIONS)
        if (a) triggerAction(a, last.joint_params)
    }, [aiMessages, triggerAction, resolveAction])

    // 4. Message Sync to Chat
    useEffect(() => {
        if (!aiMessages || !aiMessages.length) return
        setMessages(prev => {
            const seen = new Set(prev.map(msgKey))
            const added = aiMessages
                .filter(m => m.type !== "audio" && m.type !== "directive" && typeof m.content === "string" && m.content.length < 1000)
                .filter(m => !seen.has(msgKey(m)))
            return added.length ? [...prev, ...added] : prev
        })
    }, [aiMessages])

    useEffect(() => {
        onMount(SECTION_NAMES.ai)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
            push("system", `AI Service Offline: No LLM connected on hexapod/${aiDeviceId}/ai.`)
        }
    }, [input, aiOnline, publishAi, push, triggerAction, getCleanHistory, aiDeviceId])

    const handleExecuteAction = useCallback(
        action => {
            triggerAction(action)
            push("assistant", action.reply || `Triggered action: ${action.name}`)
        },
        [triggerAction, push]
    )

    return (
        <div className="border" style={{ margin: "10px", padding: "12px", background: "rgba(15, 23, 42, 0.65)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "var(--c1-green)" }}>
                    AI Assistant & Direct Actions
                </h2>
                <div style={{ display: "flex", gap: "6px" }}>
                    {activeExecutingAction && (
                        <span
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                background: "rgba(252, 66, 123, 0.2)",
                                border: "1px solid var(--c2-pink)",
                                color: "var(--c2-pink)",
                                fontSize: "0.65rem",
                            }}
                        >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c2-pink)", animation: "pulse 1s infinite" }} />
                            Active: {activeExecutingAction}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => { setMessages([]); clearAiMessages() }}
                        style={{ padding: "2px 8px", fontSize: "0.65rem", cursor: "pointer", background: "rgba(23, 33, 43, 0.85)", color: "#e2e8f0", border: "1px solid rgba(41, 128, 185, 0.5)", borderRadius: "5px" }}
                        disabled={messages.length === 0}
                    >
                        Clear Chat
                    </button>
                </div>
            </div>

            <AiStatusBar aiOnline={aiOnline} aiStatus={aiStatus} audioStatus={audioStatus} isConnected={isConnected} />
            <AiChatTerminal messages={messages} />
            <AiInputControls
                input={input}
                setInput={setInput}
                onSend={handleSend}
                recording={recording}
                onToggleMic={recording ? stopMic : startMic}
                micBlocked={micBlocked}
                aiOnline={aiOnline}
            />
            <AiActionGrid
                actions={ACTIONS}
                activeExecutingAction={activeExecutingAction}
                onExecuteAction={handleExecuteAction}
                onStopAll={stopAll}
            />
        </div>
    )
}

export default AIPanel