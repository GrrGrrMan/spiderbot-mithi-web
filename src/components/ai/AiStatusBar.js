// web-ui/src/components/ai/AiStatusBar.js
import React from "react"
import { FaSlidersH } from "react-icons/fa"

export const AiStatusBar = ({ aiOnline, aiStatus, audioStatus, isConnected, onToggleConfig, isConfigOpen }) => {
    const thinking = aiStatus?.llm?.thinking_level || "off"
    const personality = aiStatus?.llm?.personality || "friendly"

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: "6px",
                background: aiOnline ? "rgba(50, 255, 126, 0.1)" : "rgba(255, 33, 33, 0.1)",
                border: `1px solid ${aiOnline ? "rgba(50, 255, 126, 0.3)" : "rgba(255, 33, 33, 0.3)"}`,
                fontSize: "0.72rem",
                marginBottom: "8px",
            }}
        >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: "bold" }}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: !aiOnline ? "var(--c6-red)" : aiStatus?.state === "busy" ? "#fbbf24" : "var(--c1-green)",
                            display: "inline-block",
                        }}
                    />
                    {aiOnline
                        ? (aiStatus?.state === "busy" ? "AI: Busy" : "AI: Online")
                        : "AI: Offline"}
                </span>

                <span style={{ color: "#94a3b8" }}>
                    {aiStatus?.llm ? `${aiStatus.llm.model || "ready"}` : "LLM: Offline"}
                </span>

                {aiOnline && (
                    <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: "10px", background: "rgba(41, 128, 185, 0.25)", color: "#60a5fa" }}>
                        Think: {thinking.toUpperCase()} • {personality}
                    </span>
                )}

                <span style={{ color: audioStatus?.state === "playing" ? "var(--c2-pink)" : "#94a3b8" }}>
                    {audioStatus?.state === "playing" ? "🔊 S3: Playing" : "🔊 S3: Idle"}
                </span>
            </div>

            {onToggleConfig && (
                <button
                    type="button"
                    onClick={onToggleConfig}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        backgroundColor: isConfigOpen ? "rgba(50, 255, 126, 0.2)" : "rgba(23, 33, 43, 0.8)",
                        border: `1px solid ${isConfigOpen ? "var(--c1-green)" : "rgba(41, 128, 185, 0.5)"}`,
                        color: isConfigOpen ? "var(--c1-green)" : "#cbd5e1",
                        fontSize: "0.65rem",
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                    title="Toggle AI Parameter Settings"
                >
                    <FaSlidersH /> Settings
                </button>
            )}
        </div>
    )
}