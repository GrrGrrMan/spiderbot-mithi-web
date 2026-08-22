// web-ui/src/components/ai/AiStatusBar.js
import React from "react"

export const AiStatusBar = ({ aiOnline, aiStatus, audioStatus, isConnected }) => (
    <div
        style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: "6px",
            background: aiOnline ? "rgba(50, 255, 126, 0.1)" : "rgba(255, 33, 33, 0.1)",
            border: `1px solid ${aiOnline ? "rgba(50, 255, 126, 0.3)" : "rgba(255, 33, 33, 0.3)"}`,
            fontSize: "0.72rem",
            marginBottom: "10px",
        }}
    >
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
                ? (aiStatus?.state === "busy" ? "AI Service: Processing / Speaking" : "AI Service: Online")
                : "AI Service: Offline (Direct Hardware Mode)"}
        </span>

        <span style={{ color: "#94a3b8" }}>
            {aiStatus?.llm ? `LLM: ${aiStatus.llm.provider}:${aiStatus.llm.model || "ready"}` : "LLM: Offline"}
        </span>

        <span style={{ color: audioStatus?.state === "playing" ? "var(--c2-pink)" : "#94a3b8" }}>
            {audioStatus?.state === "playing" ? "🔊 S3 Speaker: Playing" : "🔊 S3 Speaker: Idle"}
        </span>

        {!isConnected && (
            <span style={{ color: "var(--c6-red)", fontWeight: "bold" }}>
                ⚠️ MQTT Disconnected
            </span>
        )}
    </div>
)