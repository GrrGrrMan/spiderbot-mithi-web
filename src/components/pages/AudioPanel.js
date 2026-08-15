// web-ui/src/components/pages/AudioPanel.js
import React from "react"

// Audio panel (roadmap P3 — MAX98357 alarms/TTS on S3).
// Placeholder: nav entry is hidden until the panel is built.
// To unveil: set hidden: false for PATHS.audio in components/vars.js.
const AudioPanel = () => (
    <div className="border" style={{ margin: "10px", padding: "10px" }}>
        <h2 style={{ marginTop: 0 }}>Audio Panel</h2>
        <p className="label">Coming soon — P3: speaker + alarm/beep/TTS playback.</p>
    </div>
)

export default AudioPanel