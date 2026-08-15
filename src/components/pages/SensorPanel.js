// web-ui/src/components/pages/SensorPanel.js
import React from "react"

// Sensor/ultrasonic panel (roadmap P4 — proximity + zones).
// Placeholder: nav entry is hidden until the panel is built.
// To unveil: set hidden: false for PATHS.sensors in components/vars.js.
const SensorPanel = () => (
    <div className="border" style={{ margin: "10px", padding: "10px" }}>
        <h2 style={{ marginTop: 0 }}>Sensor Panel</h2>
        <p className="label">Coming soon — P4: ultrasonic proximity + reaction zones.</p>
    </div>
)

export default SensorPanel