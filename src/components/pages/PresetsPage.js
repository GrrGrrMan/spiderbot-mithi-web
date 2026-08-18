// web-ui/src/components/pages/PresetsPage.js
import React, { useState, useCallback, useEffect, useRef } from "react"
import { SECTION_NAMES } from "../vars"
import { DEFAULT_POSE, DEFAULT_DIMENSIONS } from "../../templates"
import { generatePresetFramesAsync } from "../../hexapod/solvers/motionSynthesizer"
import { buildServoBatchPayload } from "../../utils/servoMapper"
import { usePoseFrameStream } from "../../hooks/usePoseFrameStream"

const PRESETS = [
    { name: "wave", label: "Wave", category: "Greeting", icon: "🌊", desc: "Single front leg wave" },
    { name: "cheer", label: "Cheer", category: "Greeting", icon: "🎉", desc: "Dual front leg celebration" },
    { name: "lookAround", label: "Look Around", category: "Survey", icon: "🔭", desc: "3D Torso orientation sweep" },
    { name: "stretch", label: "Stretch", category: "Agility", icon: "🤸", desc: "Multi-axis full stance limbering" },
    { name: "pushups", label: "Push-ups", category: "Agility", icon: "💪", desc: "Vertical body dips" },
    { name: "bow", label: "Bow", category: "Social", icon: "🙇", desc: "Formal forward pitch bow" },
    { name: "dance", label: "Dance", category: "Social", icon: "💃", desc: "Rhythmic sway and body roll" },
    { name: "standUp", label: "Stand Tall", category: "Stance", icon: "🧍", desc: "Maximum height stance" },
    { name: "sitDown", label: "Sit Down", category: "Stance", icon: "🧎", desc: "Low clearance stance" },
]

const PresetsPage = ({
    onMount = () => {},
    onUpdate = () => {},
    publishThrottled = () => {},
    params = {},
}) => {
    const dimensions = (params && params.dimensions) || DEFAULT_DIMENSIONS
    const startPose = (params && params.pose) || DEFAULT_POSE
    const [frames, setFrames] = useState([])
    const [activePreset, setActivePreset] = useState(null)
    const activeReqIdRef = useRef(0)

    useEffect(() => {
        onMount(SECTION_NAMES.presets)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const publishPose = useCallback(
        pose => {
            if (pose && typeof pose === "object") {
                publishThrottled("hexapod/cmd", buildServoBatchPayload(pose))
            }
        },
        [publishThrottled]
    )

    const { stop } = usePoseFrameStream(frames, publishPose, {
        onComplete: finalPose => {
            if (finalPose && typeof finalPose === "object") {
                onUpdate("pose", { pose: finalPose })
            }
            setActivePreset(null)
        },
    })

    const play = name => {
        stop()
        setActivePreset(name)
        const reqId = ++activeReqIdRef.current

        generatePresetFramesAsync(name, dimensions, 3, startPose, 30).then(generatedFrames => {
            if (reqId === activeReqIdRef.current && Array.isArray(generatedFrames) && generatedFrames.length > 0) {
                setFrames(generatedFrames)
            }
        })
    }

    const stopAll = () => {
        stop()
        activeReqIdRef.current++
        setActivePreset(null)
        setFrames([])
    }

    return (
        <div className="border" style={{ margin: "10px", padding: "12px", background: "rgba(15, 23, 42, 0.65)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "var(--c1-green)" }}>
                    Dynamic Motion Presets
                </h2>
                {activePreset && (
                    <span style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "6px", 
                        padding: "2px 8px", 
                        borderRadius: "12px", 
                        background: "rgba(252, 66, 123, 0.2)",
                        border: "1px solid var(--c2-pink)",
                        fontSize: "0.7rem",
                        color: "var(--c2-pink)"
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c2-pink)", animation: "pulse 1s infinite" }} />
                        Executing: <strong>{activePreset}</strong>
                    </span>
                )}
            </div>

            <p className="label" style={{ marginBottom: "12px", color: "#94a3b8" }}>
                High-speed 60FPS Quintic Minimum-Jerk interpolation streamed to hardware at 10Hz.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px", marginBottom: "12px" }}>
                {PRESETS.map(p => {
                    const isRunning = activePreset === p.name
                    return (
                        <button
                            key={p.name}
                            type="button"
                            onClick={() => play(p.name)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                padding: "8px 10px",
                                borderRadius: "6px",
                                border: isRunning ? "1px solid var(--c1-green)" : "1px solid rgba(41, 128, 185, 0.4)",
                                background: isRunning ? "rgba(50, 255, 126, 0.15)" : "rgba(23, 33, 43, 0.8)",
                                color: isRunning ? "var(--c1-green)" : "#e2e8f0",
                                cursor: "pointer",
                                transition: "all 0.2s ease-in-out",
                                textAlign: "left"
                            }}
                            aria-label={p.label}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: "bold" }}>
                                <span>{p.icon}</span>
                                <span>{p.label}</span>
                            </div>
                            <span style={{ fontSize: "0.62rem", color: "#64748b", marginTop: "4px" }}>
                                {p.desc}
                            </span>
                        </button>
                    )
                })}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
                <button
                    type="button"
                    onClick={stopAll}
                    style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "6px",
                        border: "1px solid var(--c6-red)",
                        background: "rgba(255, 33, 33, 0.15)",
                        color: "var(--c6-red)",
                        fontWeight: "bold",
                        cursor: activePreset ? "pointer" : "default",
                        opacity: activePreset ? 1 : 0.6
                    }}
                    disabled={!activePreset}
                >
                    ⏹ Stop Motion Sequence
                </button>
            </div>
        </div>
    )
}

export default PresetsPage