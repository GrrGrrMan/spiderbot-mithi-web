// web-ui/src/components/pages/AIPanel.js
import React, { useState, useEffect, useRef, useCallback } from "react"
import AI_ACTIONS from "../../constants/aiActions.json"
import { SECTION_NAMES } from "../vars"
import { buildWav, to16kPcm, bytesToBase64, VOICE_PROCESSOR_CODE } from "../../utils/aiAudio"
import { matchAction } from "../../utils/aiActionMatcher"
import { DEFAULT_POSE, DEFAULT_DIMENSIONS } from "../../templates"
import { buildServoBatchPayload } from "../../utils/servoMapper"
import { generatePresetFramesAsync, generateLocomotionFrames } from "../../hexapod/solvers/motionSynthesizer"
import { usePoseFrameStream } from "../../hooks/usePoseFrameStream"

const ACTIONS = AI_ACTIONS.actions
const SILENCE_RMS = 0.02
const MAX_SLICE_MS = 2500

const msgKey = m => `${m.role}|${m.type}|${m.content}`

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
    const [recording, setRecording] = useState(false)
    const [micBlocked, setMicBlocked] = useState(false)
    const [activeFrames, setActiveFrames] = useState([])
    const [activeExecutingAction, setActiveExecutingAction] = useState(null)

    const chatRef = useRef(null)
    const recordingRef = useRef({})
    const lastDirectiveKeyRef = useRef(null)
    const activeReqIdRef = useRef(0)
    const pendingDirectiveRef = useRef(null)

    const audioChunksRef = useRef([])
    const audioSampleRateRef = useRef(48000)

    const aiOnline = Boolean(aiStatus && aiStatus.state !== "offline" && aiStatus.state !== "error")

    const publishLivePose = useCallback(
        pose => {
            if (pose && typeof pose === "object") {
                publishImmediate("hexapod/cmd", buildServoBatchPayload(pose))
            }
        },
        [publishImmediate]
    )

    const { stop: stopStream } = usePoseFrameStream(
        activeFrames,
        pose => {
            if (activeExecutingAction && !["walk_forward", "walk_backward", "turn_left", "turn_right", "spin"].includes(activeExecutingAction)) {
                publishLivePose(pose)
            }
        },
        {
            onComplete: () => {
                setActiveExecutingAction(null)
            },
        }
    )

    const playPreset = useCallback(
        presetName => {
            if (!presetName) return
            stopStream()
            setActiveExecutingAction(presetName)
            const reqId = ++activeReqIdRef.current
            const dims = (params && params.dimensions) || DEFAULT_DIMENSIONS
            const startPose = (params && params.pose) || DEFAULT_POSE

            generatePresetFramesAsync(presetName, dims, 3, startPose, 30).then(frames => {
                if (reqId === activeReqIdRef.current && Array.isArray(frames) && frames.length > 0) {
                    setActiveFrames(frames)
                }
            })
        },
        [params, stopStream]
    )

    const playLocomotion = useCallback(
        (actionId, durationMs = 3000) => {
            stopStream()
            setActiveExecutingAction(actionId)
            const reqId = ++activeReqIdRef.current
            const dims = (params && params.dimensions) || DEFAULT_DIMENSIONS
            const startPose = (params && params.pose) || DEFAULT_POSE

            generateLocomotionFrames(actionId, dims, durationMs, startPose).then(frames => {
                if (reqId === activeReqIdRef.current && Array.isArray(frames) && frames.length > 0) {
                    setActiveFrames(frames)
                }
            })
        },
        [params, stopStream]
    )

    // Single-Joint Stand Articulation Handler
    const handleSingleJoint = useCallback(
        jointParams => {
            if (!jointParams || !jointParams.leg) return
            const { leg, joint, angle = 0, mode = "relative" } = jointParams
            const jointMap = { coxa: "alpha", coxia: "alpha", femur: "beta", tibia: "gamma" }
            const angleParam = jointMap[joint] || joint

            const currentPose = (params && params.pose) || DEFAULT_POSE
            const currentAngle = (currentPose[leg] && currentPose[leg][angleParam]) || 0

            let targetAngle = mode === "relative" ? currentAngle + angle : angle

            // Safety boundary clamps for presentation stand
            if (angleParam === "alpha") targetAngle = Math.max(-40, Math.min(40, targetAngle))
            if (angleParam === "beta") targetAngle = Math.max(-80, Math.min(80, targetAngle))
            if (angleParam === "gamma") targetAngle = Math.max(-90, Math.min(90, targetAngle))

            const newPose = {
                ...currentPose,
                [leg]: {
                    ...currentPose[leg],
                    [angleParam]: targetAngle,
                },
            }

            setActiveExecutingAction(`FK: ${leg} ${joint}`)
            onUpdate("pose", { pose: newPose })
            publishImmediate("hexapod/cmd", buildServoBatchPayload(newPose))
        },
        [params, onUpdate, publishImmediate]
    )

    const triggerAction = useCallback(
        (action, jointParams = null) => {
            if (!action && !jointParams) return

            if (action === "single_joint" || (action && action.id === "single_joint")) {
                handleSingleJoint(jointParams || (action && action.joint_params))
                return
            }

            const { payload, topic, duration_ms, name, id } = action

            if (topic === "audio") {
                publishAudio(payload)
            } else if (payload && payload.type === "preset") {
                setActiveExecutingAction(name)
                playPreset(payload.preset)
            } else if (payload && payload.type === "motion") {
                setActiveExecutingAction(name)
                publishImmediate("hexapod/cmd", payload)
                if (id === "stop") {
                    stopStream()
                    setActiveExecutingAction(null)
                    onUpdate("pose", { pose: DEFAULT_POSE })
                } else {
                    playLocomotion(id, duration_ms || 3000)
                    if (duration_ms > 0) {
                        setTimeout(() => {
                            publishImmediate("hexapod/cmd", { ...payload, vx: 0, vy: 0, omega: 0 })
                        }, duration_ms)
                    }
                }
            } else {
                setActiveExecutingAction(name)
                publishImmediate("hexapod/cmd", payload)
            }
        },
        [publishAudio, publishImmediate, playPreset, playLocomotion, stopStream, onUpdate, handleSingleJoint]
    )

    useEffect(() => {
        onMount(SECTION_NAMES.ai)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!aiMessages || !aiMessages.length) return
        setMessages(prev => {
            const seen = new Set(prev.map(msgKey))
            const added = aiMessages
                .filter(m => m.type !== "audio" && typeof m.content === "string" && m.content.length < 1000)
                .filter(m => !seen.has(msgKey(m)))
            return added.length ? [...prev, ...added] : prev
        })
    }, [aiMessages])

    // Incoming AI directive watcher: Queue execution if TTS audio is currently active on S3
    useEffect(() => {
        if (!aiMessages || !aiMessages.length) return
        const last = aiMessages[aiMessages.length - 1]
        if (!last || !last.action_id) return
        const key = `${aiMessages.length}|${msgKey(last)}`
        if (lastDirectiveKeyRef.current === key) return
        lastDirectiveKeyRef.current = key

        let a = null
        if (last.action_id === "single_joint") {
            a = { id: "single_joint", joint_params: last.joint_params }
        } else {
            a = ACTIONS.find(x => x.id === last.action_id)
        }
        if (!a) return

        if (audioStatus && audioStatus.state === "playing") {
            pendingDirectiveRef.current = { action: a, joint_params: last.joint_params }
            return
        }

        triggerAction(a, last.joint_params)
    }, [aiMessages, audioStatus, triggerAction])

    // Audio status completion watcher: Safely fires queued actions once S3 speaker turns idle
    useEffect(() => {
        if (audioStatus && audioStatus.state === "idle" && pendingDirectiveRef.current) {
            const { action, joint_params } = pendingDirectiveRef.current
            pendingDirectiveRef.current = null
            const timer = setTimeout(() => {
                triggerAction(action, joint_params)
            }, 200)
            return () => clearTimeout(timer)
        }
    }, [audioStatus, triggerAction])

    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
    }, [messages])

    const push = useCallback((role, content, type = "text") => {
        setMessages(prev => [...prev, { role, type, content, ts: Date.now() }])
    }, [])

    const clearChat = useCallback(() => {
        setMessages([])
        clearAiMessages()
    }, [clearAiMessages])

    const executeAction = useCallback(
        action => {
            const { reply, name } = action
            triggerAction(action)
            push("assistant", reply || `Triggered action: ${name}`)
        },
        [triggerAction, push]
    )

    const getCleanHistory = useCallback(() => {
        return messages
            .filter(m => (m.role === "user" || m.role === "assistant") && m.type !== "audio")
            .filter(m => typeof m.content === "string" && !m.content.startsWith("UklGR") && m.content.length < 500)
            .slice(-10)
            .map(m => ({ role: m.role, content: m.content }))
    }, [messages])

    const handleSend = useCallback(() => {
        const text = input.trim()
        if (!text) return
        push("user", text, "text")
        setInput("")

        if (aiOnline) {
            publishAi({
                type: "text",
                role: "user",
                content: text,
                history: getCleanHistory(),
            })
            return
        }

        const action = matchAction(text, ACTIONS)
        if (action) {
            executeAction(action)
        } else {
            push("system", "AI Service Offline: No LLM connected on hexapod/" + aiDeviceId + "/ai.")
        }
    }, [input, aiOnline, publishAi, push, executeAction, getCleanHistory, aiDeviceId])

    const handleAudioSlice = useCallback(
        (samples, sampleRate) => {
            const pcm = to16kPcm(samples, sampleRate)
            const wav = buildWav(pcm, 16000)
            const b64 = bytesToBase64(wav)

            push("user", `🎤 Voice Query (${Math.round(wav.length / 32)}ms audio)...`, "text")

            if (aiOnline) {
                publishAi({
                    type: "audio",
                    role: "user",
                    content: b64,
                    sample_rate_hz: 16000,
                    history: getCleanHistory(),
                })
            } else {
                push("system", "AI Service Offline: Voice transcription requires the live bridge.")
            }
        },
        [push, aiOnline, publishAi, getCleanHistory]
    )

    const finalizeAudioRecording = useCallback(() => {
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
        const totalDurationMs = Math.round((pcm.length / 16000) * 1000)

        if (totalDurationMs < 200) return

        push("user", `🎤 Voice Query (${totalDurationMs}ms audio)`)

        if (aiOnline) {
            const history = messages
                .filter(m => m.role === "user" || m.role === "assistant")
                .slice(-50)
                .map(m => ({ role: m.role, content: m.content }))
            publishAi({ type: "audio", role: "user", content: b64, sample_rate_hz: 16000, history })
        } else {
            push("system", "AI Service Offline: Voice transcription and LLM reasoning require the Pi-Hub service. Action buttons below remain active.")
        }
    }, [push, aiOnline, publishAi, messages])

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
                if (e.data && e.data.type === "audio_slice") {
                    if (e.data.samples && e.data.samples.length > 0) {
                        audioChunksRef.current.push(e.data.samples)
                        audioSampleRateRef.current = e.data.sampleRate || 48000
                    }
                }
            }

            source.connect(workletNode)
            recordingRef.current = { ctx, stream, workletNode }
            setRecording(true)
            setMicBlocked(false)
        } catch (err) {
            console.error("[AIPanel] Mic error:", err)
            setMicBlocked(true)
        }
    }, [])

    const stopMic = useCallback(() => {
        const rec = recordingRef.current
        if (rec.workletNode) {
            try {
                rec.workletNode.port.postMessage({ command: "flush" })
            } catch (e) {}

            setTimeout(() => {
                if (rec.workletNode) rec.workletNode.disconnect()
                if (rec.stream) rec.stream.getTracks().forEach(t => t.stop())
                if (rec.ctx) rec.ctx.close().catch(() => {})
                recordingRef.current = {}
                setRecording(false)
                finalizeAudioRecording()
            }, 40)
        } else {
            recordingRef.current = {}
            setRecording(false)
            finalizeAudioRecording()
        }
    }, [finalizeAudioRecording])

    const stopAll = () => {
        stopStream()
        activeReqIdRef.current++
        pendingDirectiveRef.current = null
        setActiveExecutingAction(null)
        setActiveFrames([])
        publishImmediate("hexapod/cmd", { type: "motion", vx: 0, vy: 0, omega: 0 })
        onUpdate("pose", { pose: DEFAULT_POSE })
    }

    const movementActions = ACTIONS.filter(a => ["walk_forward", "walk_backward", "turn_left", "turn_right", "spin", "stop"].includes(a.id))
    const presetActions = ACTIONS.filter(a => a.payload && a.payload.type === "preset")
    const audioActions = ACTIONS.filter(a => a.topic === "audio")
    const systemActions = ACTIONS.filter(a => ["freeze", "wake"].includes(a.id))

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
                        onClick={clearChat}
                        style={{ ...btnStyle, padding: "2px 8px", fontSize: "0.65rem" }}
                        disabled={messages.length === 0}
                    >
                        Clear Chat
                    </button>
                </div>
            </div>

            {/* Health Status Bar */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: aiOnline ? "rgba(50, 255, 126, 0.1)" : "rgba(255, 33, 33, 0.1)",
                    border: `1px solid ${aiOnline ? "rgba(50, 255, 126, 0.3)" : "rgba(255, 33, 33, 0.3)"}`,
                    fontSize: "0.72rem",
                    marginBottom: "10px",
                }}
            >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: "bold" }}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: aiOnline ? "var(--c1-green)" : "var(--c6-red)",
                            display: "inline-block",
                        }}
                    />
                    {aiOnline ? "AI Service: Online" : "AI Service: Offline (Direct Hardware Mode)"}
                </span>

                <span style={{ color: "#94a3b8" }}>
                    {aiStatus && aiStatus.llm ? `LLM: ${aiStatus.llm.provider}:${aiStatus.llm.model}` : "LLM: Offline"}
                </span>

                <span style={{ color: audioStatus && audioStatus.state === "playing" ? "var(--c2-pink)" : "#94a3b8" }}>
                    {audioStatus && audioStatus.state === "playing" ? "🔊 S3 Speaker: Playing" : "🔊 S3 Speaker: Idle"}
                </span>

                {!isConnected && (
                    <span style={{ color: "var(--c6-red)", fontWeight: "bold" }}>
                        ⚠️ MQTT Disconnected
                    </span>
                )}
            </div>

            {/* Conversation Terminal */}
            <div
                ref={chatRef}
                style={{
                    height: 170,
                    overflowY: "auto",
                    border: "1px solid rgba(41, 128, 185, 0.4)",
                    borderRadius: "6px",
                    padding: "8px",
                    marginBottom: "8px",
                    background: "rgba(10, 15, 25, 0.7)",
                }}
            >
                {messages.length === 0 && (
                    <div style={{ textAlign: "center", paddingTop: 55, color: "#64748b", fontSize: "0.75rem" }}>
                        Click any action button below or hold/press "Talk" to record a command.
                    </div>
                )}
                {messages.map((m, i) => {
                    const isUser = m.role === "user"
                    const isSystem = m.role === "system"
                    let bubbleBg = "rgba(41, 128, 185, 0.5)"
                    let textColor = "#fff"

                    if (isUser) {
                        bubbleBg = "rgba(50, 255, 126, 0.2)"
                        textColor = "var(--c1-green)"
                    } else if (isSystem) {
                        bubbleBg = "rgba(255, 33, 33, 0.15)"
                        textColor = "#fca5a5"
                    }

                    return (
                        <div key={i} style={{ textAlign: isUser ? "right" : "left", marginBottom: 6 }}>
                            <span
                                style={{
                                    display: "inline-block",
                                    maxWidth: "85%",
                                    padding: "5px 10px",
                                    borderRadius: "8px",
                                    background: bubbleBg,
                                    border: `1px solid ${isUser ? "rgba(50, 255, 126, 0.4)" : isSystem ? "rgba(255, 33, 33, 0.4)" : "rgba(41, 128, 185, 0.4)"}`,
                                    color: textColor,
                                    fontSize: "0.75rem",
                                    wordBreak: "break-word",
                                    whiteSpace: "pre-wrap",
                                    textAlign: "left",
                                }}
                            >
                                {m.content}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Input & Record Controls */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    placeholder={aiOnline ? "Ask AI assistant anything…" : "Type a direct command (e.g., 'walk forward')…"}
                    style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid rgba(41, 128, 185, 0.5)",
                        background: "rgba(10, 15, 25, 0.8)",
                        color: "#fff",
                        height: "2.2rem",
                    }}
                    aria-label="AI input"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    style={{ ...btnStyle, background: "var(--c4-blue)", color: "#fff", height: "2.2rem" }}
                    disabled={!input.trim()}
                >
                    Send
                </button>
                <button
                    type="button"
                    onClick={recording ? stopMic : startMic}
                    style={{
                        ...btnStyle,
                        background: recording ? "var(--c6-red)" : "rgba(23, 33, 43, 0.9)",
                        color: recording ? "#fff" : "var(--c1-green)",
                        height: "2.2rem",
                        minWidth: "75px",
                    }}
                    disabled={micBlocked}
                    title={micBlocked ? "Microphone unavailable" : recording ? "Stop and send recording" : "Record voice query"}
                >
                    {recording ? "⏹ Stop" : "🎤 Talk"}
                </button>
            </div>

            {/* Categorized Direct Action Matrix */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* 1. Locomotion */}
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#94a3b8" }}>
                            🚶 LOCOMOTION & GAITS (3D Animated)
                        </span>
                        {activeExecutingAction && (
                            <button
                                type="button"
                                onClick={stopAll}
                                style={{ ...btnStyle, padding: "2px 8px", fontSize: "0.65rem", borderColor: "var(--c6-red)", color: "var(--c6-red)" }}
                            >
                                ⏹ Emergency Stop
                            </button>
                        )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {movementActions.map(a => {
                            const isRunning = activeExecutingAction === a.name || activeExecutingAction === a.id
                            return (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => executeAction(a)}
                                    style={{
                                        ...btnStyle,
                                        borderColor: isRunning ? "var(--c1-green)" : "rgba(41, 128, 185, 0.5)",
                                        background: isRunning ? "rgba(50, 255, 126, 0.15)" : btnStyle.background,
                                        color: isRunning ? "var(--c1-green)" : btnStyle.color,
                                    }}
                                    aria-label={a.name}
                                >
                                    {a.name}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 2. Gestures */}
                <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#94a3b8", marginBottom: "4px" }}>
                        🎭 DYNAMIC GESTURE PRESETS (60FPS Interpolated)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {presetActions.map(a => {
                            const isRunning = activeExecutingAction === (a.payload && a.payload.preset)
                            return (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => executeAction(a)}
                                    style={{
                                        ...btnStyle,
                                        borderColor: isRunning ? "var(--c1-green)" : "rgba(41, 128, 185, 0.5)",
                                        background: isRunning ? "rgba(50, 255, 126, 0.15)" : btnStyle.background,
                                        color: isRunning ? "var(--c1-green)" : btnStyle.color,
                                    }}
                                    aria-label={a.name}
                                >
                                    {a.name}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 3. Audio & System */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#94a3b8", marginBottom: "4px" }}>
                            🔊 ACOUSTIC TONES
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {audioActions.map(a => (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => executeAction(a)}
                                    style={btnStyle}
                                    aria-label={a.name}
                                >
                                    {a.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#94a3b8", marginBottom: "4px" }}>
                            ⚡ SYSTEM POWER
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {systemActions.map(a => (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => executeAction(a)}
                                    style={{
                                        ...btnStyle,
                                        borderColor: a.id === "freeze" ? "var(--c6-red)" : "var(--c1-green)",
                                        color: a.id === "freeze" ? "var(--c6-red)" : "var(--c1-green)",
                                    }}
                                    aria-label={a.name}
                                >
                                    {a.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const btnStyle = {
    padding: "5px 9px",
    borderRadius: "5px",
    border: "1px solid rgba(41, 128, 185, 0.5)",
    background: "rgba(23, 33, 43, 0.85)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: "0.72rem",
    fontWeight: "500",
    transition: "all 0.15s ease",
}

export default AIPanel