// web-ui/src/components/pages/AIPanel.js
import React from "react"

// AI voice/chat panel (roadmap P5 — STT -> LLM -> MQTT -> TTS via RPi).
// Placeholder: nav entry is hidden until the panel is built.
// To unveil: set hidden: false for PATHS.ai in components/vars.js.
const AIPanel = () => (
    <div className="border" style={{ margin: "10px", padding: "10px" }}>
        <h2 style={{ marginTop: 0 }}>AI Assistant Panel</h2>
        <p className="label">Coming soon — P5: STT → LLM → MQTT → TTS voice layer.</p>
    </div>
)

export default AIPanel