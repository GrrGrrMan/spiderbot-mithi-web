// web-ui/src/components/camera/OfflinePlaceholder.js
//
// P2 Phase B: empty-state for the camera stage. Shown when no MJPEG URL can
// be resolved (broker disconnected, no config yet, or telemetry missing an
// IP). Renders a centered FaCamera with a one-line reason. The icon is from
// the existing react-icons/fa dep.

import React from "react"
import { FaCamera } from "react-icons/fa"

const OfflinePlaceholder = ({ reason }) => {
    const wrapperStyle = {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: "#000",
        color: "var(--c5-text-dim, #aaa)",
        textAlign: "center",
        padding: "20px",
    }

    return (
        <div style={wrapperStyle} data-testid="camera-offline-placeholder">
            <FaCamera
                style={{
                    fontSize: "3rem",
                    color: "var(--c3-border, #444)",
                }}
            />
            <div
                style={{
                    fontSize: "0.75rem",
                    letterSpacing: "0.04em",
                    maxWidth: "240px",
                }}
            >
                {reason || "Camera not available"}
            </div>
        </div>
    )
}

export default OfflinePlaceholder
