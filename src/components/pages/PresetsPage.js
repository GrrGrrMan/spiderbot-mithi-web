// web-ui/src/components/pages/PresetsPage.js
// Chunk 2 — "custom animation interpolation + presets" restored from the legacy
// hexapod web-ui. Each button streams a cosine-eased keyframe animation through
// the normal servo payload path ({type:"pose", pose}) via usePoseFrameStream —
// ZERO firmware changes.
//
// Nav entry: unveiled 2026-08-18 (PATHS.presets.hidden = false in components/vars.js).
import React, { useState, useCallback, useEffect } from "react"
import { SECTION_NAMES } from "../vars"
import { DEFAULT_POSE, DEFAULT_DIMENSIONS } from "../../templates"
import { generatePresetFrames } from "../../hexapod/solvers/motionSynthesizer"
import { buildServoBatchPayload } from "../../utils/servoMapper"
import { usePoseFrameStream } from "../../hooks/usePoseFrameStream"

const PRESETS = [
    { name: "wave", label: "Wave" },
    { name: "cheer", label: "Cheer" },
    { name: "lookAround", label: "Look Around" },
    { name: "stretch", label: "Stretch" },
    { name: "pushups", label: "Push-ups" },
    { name: "bow", label: "Bow" },
    { name: "dance", label: "Dance" },
]

const btnStyle = {
    padding: "5px 10px",
    borderRadius: 4,
    border: "1px solid var(--c3-grey)",
    background: "var(--c0-bg)",
    cursor: "pointer",
    fontSize: "0.75rem",
}

const PresetsPage = ({ onMount = () => {}, publishThrottled = () => {}, params = {} }) => {
    const dimensions = (params && params.dimensions) || DEFAULT_DIMENSIONS
    const startPose = (params && params.pose) || DEFAULT_POSE
    const [frames, setFrames] = useState([])
    const [activePreset, setActivePreset] = useState(null)

    useEffect(() => {
        onMount(SECTION_NAMES.presets)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const publishPose = useCallback(
        pose => publishThrottled("hexapod/cmd", buildServoBatchPayload(pose)),
        [publishThrottled]
    )

    const { stop } = usePoseFrameStream(frames, publishPose)

    const play = name => {
        stop()
        setActivePreset(name)
        setFrames(generatePresetFrames(name, dimensions, 3, startPose, 10))
    }

    const stopAll = () => {
        stop()
        setActivePreset(null)
        setFrames([])
    }

    return (
        <div className="border" style={{ margin: "10px", padding: "10px" }}>
            <h2 style={{ marginTop: 0 }}>Presets</h2>
            <p className="label">Keyframe animations streamed locally at ≤10 Hz — no firmware changes needed.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {PRESETS.map(p => (
                    <button
                        key={p.name}
                        type="button"
                        onClick={() => play(p.name)}
                        style={btnStyle}
                        aria-label={p.label}
                    >
                        {p.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={stopAll}
                    style={btnStyle}
                    aria-label="Stop Preset"
                    disabled={!activePreset}
                >
                    Stop
                </button>
            </div>
            {activePreset && (
                <div className="label" style={{ marginTop: 6, color: "var(--c4-amber)" }}>
                    ▶ {activePreset}…
                </div>
            )}
        </div>
    )
}

export default PresetsPage