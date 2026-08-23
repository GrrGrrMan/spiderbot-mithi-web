// web-ui/src/components/ai/AiActionGrid.js
import React from "react"

export const AiActionGrid = ({ actions, activeExecutingAction, onExecuteAction, onStopAll }) => {
    // 1. Dynamic Categorization (Future-Proof against schema additions)
    const movementActions = actions.filter(a => 
        ["walk_forward", "walk_backward", "turn_left", "turn_right", "spin", "stop"].includes(a.id)
    )
    const gestureActions = actions.filter(a => 
        a.payload?.type === "sequence" || a.payload?.type === "preset" || a.id.startsWith("preset_")
    )
    const audioActions = actions.filter(a => a.topic === "audio" || a.payload?.action)
    const systemActions = actions.filter(a => ["freeze", "wake"].includes(a.id) || a.payload?.type === "system")

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Locomotion */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#94a3b8" }}>
                        <span role="img" aria-label="walk">🚶</span> LOCOMOTION & GAITS (3D Animated)
                    </span>
                    {activeExecutingAction && (
                        <button
                            type="button"
                            onClick={onStopAll}
                            style={{ ...btnStyle, padding: "2px 8px", fontSize: "0.65rem", borderColor: "var(--c6-red)", color: "var(--c6-red)" }}
                        >
                            <span role="img" aria-label="stop">⏹</span> Emergency Stop
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
                                onClick={() => onExecuteAction(a)}
                                style={{
                                    ...btnStyle,
                                    borderColor: isRunning ? "var(--c1-green)" : "rgba(41, 128, 185, 0.5)",
                                    background: isRunning ? "rgba(50, 255, 126, 0.15)" : btnStyle.background,
                                    color: isRunning ? "var(--c1-green)" : btnStyle.color,
                                }}
                            >
                                {a.name}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Dynamic Gestures & Sequences */}
            <div>
                <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#94a3b8", marginBottom: "4px" }}>
                    <span role="img" aria-label="mask">🎭</span> DYNAMIC GESTURE SEQUENCES (60FPS Interpolated)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {gestureActions.map(a => {
                        const isRunning = activeExecutingAction === a.payload?.name || activeExecutingAction === a.payload?.preset || activeExecutingAction === a.name
                        return (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => onExecuteAction(a)}
                                style={{
                                    ...btnStyle,
                                    borderColor: isRunning ? "var(--c1-green)" : "rgba(41, 128, 185, 0.5)",
                                    background: isRunning ? "rgba(50, 255, 126, 0.15)" : btnStyle.background,
                                    color: isRunning ? "var(--c1-green)" : btnStyle.color,
                                }}
                            >
                                {a.name}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Audio & System */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#94a3b8", marginBottom: "4px" }}>
                        <span role="img" aria-label="speaker">🔊</span> ACOUSTIC TONES
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {audioActions.map(a => (
                            <button key={a.id} type="button" onClick={() => onExecuteAction(a)} style={btnStyle}>
                                {a.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#94a3b8", marginBottom: "4px" }}>
                        <span role="img" aria-label="power">⚡</span> SYSTEM POWER
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {systemActions.map(a => (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => onExecuteAction(a)}
                                style={{
                                    ...btnStyle,
                                    borderColor: a.id === "freeze" ? "var(--c6-red)" : "var(--c1-green)",
                                    color: a.id === "freeze" ? "var(--c6-red)" : "var(--c1-green)",
                                }}
                            >
                                {a.name}
                            </button>
                        ))}
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
}