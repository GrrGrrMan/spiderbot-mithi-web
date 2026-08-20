import React, { useState, useEffect, useCallback, useRef } from "react"
import { SECTION_NAMES } from "../vars"
import { useContinuousWakeWord } from "../../hooks/useContinuousWakeWord"
import DualStageViewport from "../camera/DualStageViewport"
import { matchAction } from "../../utils/aiActionMatcher"
import AI_ACTIONS from "../../constants/aiActions.json"
import { DEFAULT_POSE, DEFAULT_DIMENSIONS } from "../../templates"
import { buildServoBatchPayload } from "../../utils/servoMapper"
import { generatePresetFramesAsync, generateLocomotionFrames } from "../../hexapod/solvers/motionSynthesizer"
import { usePoseFrameStream } from "../../hooks/usePoseFrameStream"

const ACTIONS = AI_ACTIONS.actions

const JudgementPanel = ({
    publishImmediate = () => {},
    publishAi = () => {},
    publishAudio = () => {},
    isConnected = false,
    camConfig = null,
    camTelemetry = null,
    hexapod = null,
    revision = 0,
    aiStatus = null,
    aiMessages = [],
    aiDeviceId = "hexapod-s3-01",
    params = {},
    onUpdate = () => {},
    onMount = () => {},
}) => {
    const [actionLog, setActionLog] = useState([])
    const [activeFrames, setActiveFrames] = useState([])
    const [executingName, setExecutingName] = useState(null)
    const activeReqIdRef = useRef(0)

    const aiOnline = Boolean(aiStatus && aiStatus.state !== "offline" && aiStatus.state !== "error")

    const speakFeedback = (text) => {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.rate = 1.05
            utterance.pitch = 1.0
            window.speechSynthesis.speak(utterance)
        }
    }

    const publishLivePose = useCallback(
        (pose) => {
            if (pose && typeof pose === "object") {
                publishImmediate("hexapod/cmd", buildServoBatchPayload(pose))
            }
        },
        [publishImmediate]
    )

    const { stop: stopStream } = usePoseFrameStream(activeFrames, (pose) => {
        // Only publish to MQTT for direct gesture presets (like Wave/Cheer), NOT during locomotion!
        if (executingName && !["walk_forward", "walk_backward", "turn_left", "turn_right", "spin"].includes(executingName)) {
            publishLivePose(pose)
        }
    })

    const playPreset = useCallback(
        (presetName) => {
            if (!presetName) return
            stopStream()
            setExecutingName(presetName)
            const reqId = ++activeReqIdRef.current
            const dims = (params && params.dimensions) || DEFAULT_DIMENSIONS
            const startPose = (params && params.pose) || DEFAULT_POSE

            generatePresetFramesAsync(presetName, dims, 3, startPose, 30).then((frames) => {
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
            setExecutingName(actionId)
            const reqId = ++activeReqIdRef.current
            const dims = (params && params.dimensions) || DEFAULT_DIMENSIONS
            const startPose = (params && params.pose) || DEFAULT_POSE

            generateLocomotionFrames(actionId, dims, durationMs, startPose).then((frames) => {
                if (reqId === activeReqIdRef.current && Array.isArray(frames) && frames.length > 0) {
                    setActiveFrames(frames)
                }
            })
        },
        [params, stopStream]
    )

    const handleVoiceCommand = useCallback(
        (commandText, fullUtterance) => {
            const entry = {
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                full: fullUtterance,
                command: commandText,
            }
            setActionLog((prev) => [entry, ...prev.slice(0, 20)])

            // Match against local action table
            const matchedAction = matchAction(commandText, ACTIONS)

            if (matchedAction) {
                const { payload, topic, reply, name, id, duration_ms } = matchedAction
                speakFeedback(reply || `Executing ${name}`)

                if (topic === "audio") {
                    publishAudio(payload)
                } else if (payload && payload.type === "preset") {
                    playPreset(payload.preset)
                } else if (payload && payload.type === "motion") {
                    publishImmediate("hexapod/cmd", payload)
                    if (id === "stop") {
                        stopStream()
                        setExecutingName(null)
                        onUpdate("pose", { pose: DEFAULT_POSE })
                    } else {
                        playLocomotion(id, duration_ms || 3000)
                    }
                } else {
                    publishImmediate("hexapod/cmd", payload)
                }
            } else if (aiOnline) {
                // Forward directive to Pi-Hub LLM
                publishAi({
                    type: "text",
                    role: "user",
                    content: commandText,
                })
                speakFeedback("Processing directive.")
            } else {
                speakFeedback("Command not recognized.")
            }
        },
        [aiOnline, playPreset, playLocomotion, publishAi, publishAudio, publishImmediate, stopStream, onUpdate]
    )

    const { isListening, wakeWordState, lastTranscript, lastAcceptedCommand, micError } =
        useContinuousWakeWord({
            onCommand: handleVoiceCommand,
            minConfidence: 0.45,
            enabled: true,
        })

    useEffect(() => {
        onMount(SECTION_NAMES.judgement || "Judgement")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
            {/* Top: Balanced Side-by-Side Viewport */}
            <div style={{ height: "460px", width: "100%" }}>
                <DualStageViewport
                    camConfig={camConfig}
                    camTelemetry={camTelemetry}
                    isConnected={isConnected}
                    hexapod={hexapod}
                    revision={revision}
                />
            </div>

            {/* Bottom: 24/7 Voice & Judgement Status HUD */}
            <div className="border" style={{ padding: "12px", backgroundColor: "rgba(15, 23, 42, 0.75)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h3 style={{ margin: 0, color: "var(--c1-green)", fontSize: "0.95rem" }}>
                        24/7 PASSIVE WAKE-WORD SENTINEL
                    </h3>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={stateBadgeStyle(wakeWordState, isListening)}>
                            <span style={pulseDotStyle(isListening)} />
                            {getStatusLabel(wakeWordState, isListening)}
                        </span>
                    </div>
                </div>

                {micError && (
                    <div style={{ color: "var(--c6-red)", fontSize: "0.75rem", marginBottom: "8px" }}>
                        ⚠️ {micError}
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.72rem" }}>
                    {/* Live Audio & Transcript Monitor */}
                    <div style={panelBoxStyle}>
                        <div style={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>
                            AUDIO STREAM ANALYSIS:
                        </div>
                        <div style={{ marginBottom: "4px" }}>
                            <strong>Heard Raw:</strong>{" "}
                            <span style={{ color: "#cbd5e1" }}>{lastTranscript || "(Waiting for speech...)"}</span>
                        </div>
                        <div>
                            <strong>Active Command:</strong>{" "}
                            <span style={{ color: "var(--c1-green)", fontWeight: "bold" }}>
                                {lastAcceptedCommand || "None (Filter Active)"}
                            </span>
                        </div>
                    </div>

                    {/* Filter Status Guide */}
                    <div style={panelBoxStyle}>
                        <div style={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>
                            GATE CRITERIA:
                        </div>
                        <div style={{ color: "#94a3b8" }}>
                            • Responds <strong>ONLY</strong> to <code>"Hey Spider &lt;action&gt;"</code> or <code>"Hey Hexapod &lt;action&gt;"</code>.
                            <br />
                            • Ambient speech, mumbling, and unrelated background sounds are automatically dropped.
                        </div>
                    </div>
                </div>

                {/* Directive Execution Log */}
                {actionLog.length > 0 && (
                    <div style={{ marginTop: "10px" }}>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}>
                            DIRECTIVE HISTORY:
                        </div>
                        <div style={historyBoxStyle}>
                            {actionLog.map((item) => (
                                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                                    <span style={{ color: "var(--c4-blue)" }}>[{item.time}]</span>
                                    <span style={{ flex: 1, color: "var(--c1-green)" }}>{item.command}</span>
                                    <span style={{ color: "#64748b", fontSize: "0.65rem" }}>"{item.full}"</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

const getStatusLabel = (state, isListening) => {
    if (!isListening) return "MIC OFFLINE"
    if (state === "recognized") return "WAKE WORD TRIGGERED"
    if (state === "listening_prompt") return "HEARD WAKE WORD — AWAITING DIRECTIVE"
    if (state === "ignored") return "AMBIENT CHATTER DROPPED"
    return "24/7 LISTENING ('Hey Spider...')"
}

const stateBadgeStyle = (state, isListening) => {
    let bg = "rgba(50, 255, 126, 0.15)"
    let border = "var(--c1-green)"
    let color = "var(--c1-green)"

    if (!isListening) {
        bg = "rgba(255, 33, 33, 0.15)"
        border = "var(--c6-red)"
        color = "var(--c6-red)"
    } else if (state === "recognized") {
        bg = "rgba(252, 66, 123, 0.25)"
        border = "var(--c2-pink)"
        color = "var(--c2-pink)"
    } else if (state === "ignored") {
        bg = "rgba(100, 116, 139, 0.2)"
        border = "#64748b"
        color = "#94a3b8"
    }

    return {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "12px",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: color,
        fontSize: "0.68rem",
        fontWeight: "bold",
    }
}

const pulseDotStyle = (active) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: active ? "var(--c1-green)" : "var(--c6-red)",
    display: "inline-block",
})

const panelBoxStyle = {
    padding: "8px",
    borderRadius: "6px",
    backgroundColor: "rgba(10, 15, 25, 0.7)",
    border: "1px solid rgba(41, 128, 185, 0.3)",
}

const historyBoxStyle = {
    maxHeight: "90px",
    overflowY: "auto",
    padding: "6px",
    borderRadius: "4px",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    fontSize: "0.68rem",
    fontFamily: "monospace",
}

export default JudgementPanel