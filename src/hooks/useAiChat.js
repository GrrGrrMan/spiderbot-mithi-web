// web-ui/src/hooks/useAiChat.js
import { useState, useEffect, useCallback, useRef } from "react"
import aiActionsData from "../constants/aiActions.json"
import { useVoiceRecorder } from "./useVoiceRecorder"

const STATIC_ACTIONS = aiActionsData.actions || []

export const useAiChat = ({
    aiMessages = [],
    aiStatus = null,
    publishAi = () => {},
    publishAiConfig = () => {},
    triggerAction = () => {},
}) => {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState("")

    // ── Persistent Task & Thinking States ──
    const [taskStatus, setTaskStatus] = useState("idle")
    const [isThinking, setIsThinking] = useState(false)
    const [thoughtText, setThoughtText] = useState("")
    const [thoughtTps, setThoughtTps] = useState(null)
    const [thoughtElapsed, setThoughtElapsed] = useState(0)
    const [currentPlan, setCurrentPlan] = useState(null)
    const [activeStepIndex, setActiveStepIndex] = useState(0)

    // ── Collapsible Settings Drawer State ──
    const [isConfigOpen, setIsConfigOpen] = useState(false)

    const aiOnline = Boolean(aiStatus && aiStatus.state !== "offline")

    const triggerActionRef = useRef(triggerAction)
    useEffect(() => {
        triggerActionRef.current = triggerAction
    }, [triggerAction])

    const aiOnlineRef = useRef(aiOnline)
    aiOnlineRef.current = aiOnline

    const publishAiRef = useRef(publishAi)
    publishAiRef.current = publishAi

    const { recording, micBlocked, startMic, stopMic } = useVoiceRecorder({
        onAudioRecorded: useCallback(({ base64Wav, durationMs }) => {
            if (aiOnlineRef.current) {
                publishAiRef.current({
                    type: "audio",
                    role: "user",
                    content: base64Wav,
                    sample_rate_hz: 16000,
                })
            }
        }, [])
    })

    // Stopwatch for reasoning & active navigation
    useEffect(() => {
        let timer = null
        if (isThinking) {
            setThoughtElapsed(0)
            const startTime = performance.now()
            timer = setInterval(() => {
                setThoughtElapsed((performance.now() - startTime) / 1000)
            }, 100)
        }
        return () => {
            if (timer) clearInterval(timer)
        }
    }, [isThinking])

    // Process MQTT stream with duplicate protection
    useEffect(() => {
        if (!aiMessages || aiMessages.length === 0) return
        const lastMsg = aiMessages[aiMessages.length - 1]
        if (!lastMsg) return

        if (lastMsg.type === "agent_event") {
            if (lastMsg.stage === "thinking" || lastMsg.stage === "tool_executing") {
                setTaskStatus("running")
                setIsThinking(true)
                if (lastMsg.thought) setThoughtText(lastMsg.thought)
            } else if (lastMsg.stage === "thought_chunk") {
                setTaskStatus("running")
                setIsThinking(true)
                if (lastMsg.thought) setThoughtText(lastMsg.thought)
                if (lastMsg.tps) setThoughtTps(lastMsg.tps)
            } else if (lastMsg.stage === "plan") {
                setTaskStatus("running")
                setCurrentPlan({
                    title: lastMsg.title || "Visual Target Search",
                    thought: lastMsg.thought || "",
                    steps: lastMsg.steps || [],
                })
                setActiveStepIndex(lastMsg.active_step || 0)
                if (lastMsg.thought) setThoughtText(lastMsg.thought)
            } else if (lastMsg.stage === "step_progress") {
                setTaskStatus("running")
                if (lastMsg.active_step !== undefined) setActiveStepIndex(lastMsg.active_step)
                if (lastMsg.thought) setThoughtText(lastMsg.thought)
                if (lastMsg.steps && lastMsg.steps.length > 0) {
                    setCurrentPlan(prev => ({
                        title: prev?.title || "Visual Target Search",
                        thought: lastMsg.thought || prev?.thought || "",
                        steps: lastMsg.steps,
                    }))
                }
            } else if (lastMsg.stage === "done") {
                setIsThinking(false)
                setTaskStatus("completed")
                setCurrentPlan(prev => {
                    if (!prev) return null
                    setActiveStepIndex(prev.steps?.length || 0)
                    return { ...prev }
                })
            }
            return
        }

        if (lastMsg.type === "directive" && lastMsg.action_id) {
            const matched = STATIC_ACTIONS.find(a => a.id === lastMsg.action_id)
            if (matched && triggerActionRef.current) {
                triggerActionRef.current(matched)
            }
            return
        }

        if (lastMsg.type === "text" || lastMsg.type === "transcription") {
            setMessages(prev => {
                // Robust multi-factor deduplication
                const exists = prev.some(m =>
                    (m.timestamp && m.timestamp === lastMsg.timestamp) ||
                    (m.role === lastMsg.role && m.content === lastMsg.content && Math.abs((m.timestamp || 0) - (lastMsg.timestamp || 0)) < 1500)
                )
                if (exists) return prev
                return [...prev.slice(-49), lastMsg]
            })
            if (lastMsg.role === "assistant") {
                setIsThinking(false)
                setTaskStatus(prev => (prev === "running" ? "completed" : prev))
            }
        }
    }, [aiMessages])

    const handleSend = useCallback(() => {
        const text = input.trim()
        if (!text) return

        const singleTimestamp = Date.now()
        const userMsg = {
            type: "text",
            role: "user",
            content: text,
            timestamp: singleTimestamp,
        }
        setMessages(prev => [...prev.slice(-49), userMsg])

        setTaskStatus("running")
        setIsThinking(true)
        setThoughtText("Deliberating goal & kinematics...")
        setCurrentPlan(null)

        publishAi({
            type: "text",
            role: "user",
            content: text,
            history: messages.slice(-10),
            timestamp: singleTimestamp,
        })
        setInput("")
    }, [input, messages, publishAi])

    const handleExecuteAction = useCallback((action) => {
        if (!action) return
        if (triggerActionRef.current) triggerActionRef.current(action)

        const userMsg = {
            type: "text",
            role: "user",
            content: `[Manual Card]: ${action.name}`,
            timestamp: Date.now(),
        }
        setMessages(prev => [...prev.slice(-49), userMsg])
    }, [])

    const handleUpdateConfig = useCallback((updatedConfig) => {
        if (publishAiConfig) {
            publishAiConfig(updatedConfig)
        }
    }, [publishAiConfig])

    return {
        messages,
        setMessages,
        input,
        setInput,
        handleSend,
        recording,
        startMic,
        stopMic,
        micBlocked,
        aiOnline,
        ACTIONS: STATIC_ACTIONS,
        handleExecuteAction,
        taskStatus,
        isThinking,
        thoughtText,
        thoughtTps,
        thoughtElapsed,
        currentPlan,
        activeStepIndex,
        isConfigOpen,
        setIsConfigOpen,
        handleUpdateConfig,
    }
}

export default useAiChat