// web-ui/src/components/camera/StreamStatusBar.js
//
// P2 Phase B: small overlay bar pinned to the bottom-left of the camera
// viewport. Shows measured FPS (EMA-smoothed, ~10 Hz cadence), resolution
// hint, and any human-readable status text from the parent (e.g.
// "stalled — reconnecting…"). Hidden when nothing meaningful to display.

import React from "react"

const fmtFps = fps => {
    if (fps == null || Number.isNaN(fps) || fps <= 0) return "—"
    if (fps < 1) return "<1"
    return `~${Math.round(fps)} fps`
}

const StreamStatusBar = ({ fps, resolutionHint, status }) => {
    // Don't render an empty bar — keeps the viewport clean on first paint.
    if (!fps && !resolutionHint && !status) return null

    const wrapperStyle = {
        position: "absolute",
        bottom: "6px",
        left: "6px",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: "10px",
        background: "rgba(0, 0, 0, 0.55)",
        color: "var(--c5-text, #eee)",
        fontSize: "0.65rem",
        fontFamily: "monospace",
        letterSpacing: "0.02em",
        zIndex: 4,
        pointerEvents: "none",
        maxWidth: "calc(100% - 12px)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    }

    const itemStyle = { display: "flex", alignItems: "center", gap: "4px" }

    return (
        <div style={wrapperStyle} data-testid="stream-status-bar">
            {fps > 0 && (
                <span style={itemStyle} data-testid="stream-fps">
                    {fmtFps(fps)}
                </span>
            )}
            {resolutionHint && (
                <span style={itemStyle} data-testid="stream-resolution">
                    {resolutionHint}
                </span>
            )}
            {status && (
                <span
                    style={{
                        ...itemStyle,
                        color: "var(--c1-green, #2ecc71)",
                        fontWeight: "bold",
                    }}
                    data-testid="stream-status"
                >
                    {status}
                </span>
            )}
        </div>
    )
}

export default StreamStatusBar
